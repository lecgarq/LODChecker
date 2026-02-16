"""
Optimized Pipeline Orchestrator (Staged Batch Processing)
=========================================================
Target: ~20s per image on RTX 5070 Ti

Architecture:
-------------
1. Stage 1: Prep & Upscale (CPU Parallel)
2. Stage 2: Background Removal (GPU Batch)
3. Stage 3: Captioning (GPU Batch)
4. Stage 4: Refinement (GPU Batch - Conditional)
5. Stage 5: Embeddings (GPU Batch)
6. Stage 6: Finalize (CPU)

Attributes:
-----------
- Persistent Models: Loaded once per stage.
- VRAM Management: Explicit gc.collect() and empty_cache().
- Threading: CPU tasks run in parallel.
- Lazy Imports: Modules imported only when needed to prevent startup hangs.
"""

print("DEBUG: Pipeline startup...")
import sys
import json
import time
import logging
import argparse
import gc
import shutil
from pathlib import Path
from datetime import datetime
from typing import Any

# Configure Logging
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger("OptimizedPipeline")

# Allow processing of large images
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

# Add project root to path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.append(str(ROOT_DIR))

def clean_vram():
    """Force VRAM cleanup"""
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass


def gpu_mem_snapshot() -> dict[str, float]:
    try:
        import torch
        if not torch.cuda.is_available():
            return {"allocated_gb": 0.0, "reserved_gb": 0.0, "max_allocated_gb": 0.0}
        return {
            "allocated_gb": torch.cuda.memory_allocated() / 1024**3,
            "reserved_gb": torch.cuda.memory_reserved() / 1024**3,
            "max_allocated_gb": torch.cuda.max_memory_allocated() / 1024**3,
        }
    except Exception:
        return {"allocated_gb": 0.0, "reserved_gb": 0.0, "max_allocated_gb": 0.0}


def log_stage_profile(stage_profiles: list[dict[str, Any]]) -> None:
    if not stage_profiles:
        return
    logger.info("=== STAGE PROFILE SUMMARY ===")
    for p in stage_profiles:
        logger.info(
            "[PROFILE] %s: %.2fs | GPU alloc %.2f->%.2f GB | peak %.2f GB",
            p["name"],
            p["seconds"],
            p["gpu_start"]["allocated_gb"],
            p["gpu_end"]["allocated_gb"],
            p["gpu_end"]["max_allocated_gb"],
        )

def scan_images(input_dir, limit=None, include_folders=None):
    images = []
    logger.info(f"[SCAN] Scanning {input_dir}...")
    valid_exts = {'.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'}
    for p in input_dir.rglob("*"):
        if p.suffix.lower() in valid_exts:
            if include_folders:
                relative = p.relative_to(input_dir)
                if not any(part in include_folders for part in relative.parts): continue
            images.append(p)
    
    images = sorted(set(images))
    if limit: images = images[:limit]
    logger.info(f"[SCAN] Found {len(images)} images")
    return images

# ==================================================================================
# STAGE 1: UPSCALE (CPU/Threaded)
# ==================================================================================
def process_upscale_item(img_path, temp_dir):
    try:
        from PIL import Image
        from Step12_Upscale import upscale_with_alpha_preservation
        
        upscaled_path = temp_dir / f"{img_path.stem}_upscaled.png"
        if upscaled_path.exists():
            return (img_path, upscaled_path, True)
            
        img = Image.open(img_path)
        upscaled = upscale_with_alpha_preservation(img)
        upscaled.save(upscaled_path)
        return (img_path, upscaled_path, True)
    except Exception as e:
        logger.error(f"Upscale failed for {img_path}: {e}")
        return (img_path, None, False)

def run_stage_upscale(images, temp_dir):
    logger.info(">>> STAGE 1: UPSCALING (CPU Parallel) <<<")
    results = {}
    from concurrent.futures import ThreadPoolExecutor, as_completed
    from tqdm import tqdm
    
    with ThreadPoolExecutor(max_workers=min(2, len(images))) as executor:
        futures = {executor.submit(process_upscale_item, p, temp_dir): p for p in images}
        
        for future in tqdm(as_completed(futures), total=len(images), desc="Upscaling"):
            original, upscaled, success = future.result()
            if success:
                results[original] = upscaled
    
    return results

# ==================================================================================
# STAGE 2: BACKGROUND REMOVAL (GPU Batch)
# ==================================================================================
def run_stage_rmbg(upscaled_map, temp_dir):
    logger.info(">>> STAGE 2: BACKGROUND REMOVAL (GPU Batch) <<<")
    clean_vram()
    
    from tqdm import tqdm
    import Step03_Background as Step03
    
    model, device = Step03.load_rmbg()
    alpha_map = {}
    
    try:
        for original, upscaled_path in tqdm(upscaled_map.items(), desc="Removing Background"):
            alpha_path = temp_dir / f"{original.stem}_alpha.png"
            
            if alpha_path.exists():
                alpha_map[original] = alpha_path
                continue
                
            alpha = Step03.process_image(model, device, upscaled_path)
            alpha.save(alpha_path)
            alpha_map[original] = alpha_path
            
    except Exception as e:
        logger.error(f"RMBG Stage Error: {e}")
    finally:
        del model
        clean_vram()
        
    return alpha_map

# ==================================================================================
# STAGE 3: CAPTIONING (GPU Batch)
# ==================================================================================
def run_stage_caption(upscaled_map):
    logger.info(">>> STAGE 3: CAPTIONING (GPU Batch) <<<")
    clean_vram()
    
    from tqdm import tqdm
    from PIL import Image
    import Step02_Caption as Step02
    
    # Load BLIP-2 (Heavy)
    model, processor, device = Step02.load_blip2()
    captions = {}
    
    try:
        for original, upscaled_path in tqdm(upscaled_map.items(), desc="Generating Captions"):
            try:
                img = Image.open(upscaled_path)
                cap = Step02.generate_caption(model, processor, device, img)
                captions[original] = cap
            except Exception as e:
                logger.error(f"Caption failed for {original}: {e}")
                captions[original] = "No description"
    finally:
        del model
        del processor
        clean_vram()
        
    return captions

# ==================================================================================
# STAGE 4: REFINEMENT (Conditional GPU Batch)
# ==================================================================================
def run_stage_refinement(upscaled_map, alpha_map, temp_dir, category_index):
    logger.info(">>> STAGE 4: REFINEMENT (Conditional GPU) <<<")
    clean_vram()
    
    from tqdm import tqdm
    from PIL import Image
    import numpy as np
    import Step10_Vision as Step10
    import Step11_Detection as Step11
    
    # Identify needs
    needs_refinement = []
    final_masks = {}
    
    logger.info("   Checking Quality Gates...")
    for original, alpha_path in alpha_map.items():
        alpha = Image.open(alpha_path)
        passes, _ = Step10.check_quality_gate(alpha)
        if not passes:
            needs_refinement.append(original)
        else:
            final_masks[original] = alpha
            
    if not needs_refinement:
        logger.info("   All masks passed quality gate. Skipping refinement models.")
        return final_masks, {}
        
    logger.info(f"   Refining {len(needs_refinement)} images...")
    
    detected_classes = {}
    
    # Load GDINO
    model_gd, proc_gd = Step11.load_gdino()
    temp_boxes = {}
    
    try:
        for original in tqdm(needs_refinement, desc="Detecting Objects"):
            img = Image.open(upscaled_map[original])
            detections, best_cat = Step11.detect_taxonomy_categories(img, category_index)
            if detections:
                temp_boxes[original] = [d["box"] for d in detections]
                detected_classes[original] = best_cat
    finally:
        Step11.unload_gdino()
        clean_vram()
        
    # Load SAM
    if temp_boxes:
        model_sam, proc_sam = Step11.load_sam()
        try:
            for original, boxes in tqdm(temp_boxes.items(), desc="Segmenting Objects"):
                img = Image.open(upscaled_map[original])
                # Combine first 3 boxes
                combined = np.zeros(img.size[::-1], dtype=np.uint8)
                for box in boxes[:3]:
                    mask = Step11.segment_with_boxes(img, box)
                    combined = np.maximum(combined, mask)
                
                # Merge with RMBG Alpha
                rmbg_alpha = np.array(Image.open(alpha_map[original]).convert("L"))
                final = np.maximum(rmbg_alpha, combined)
                final_masks[original] = Image.fromarray(final, "L")
                
        finally:
            Step11.unload_sam()
            clean_vram()
            
    # Fallback for those that failed Refinement
    for original in needs_refinement:
        if original not in final_masks:
            final_masks[original] = Image.open(alpha_map[original])
            
    return final_masks, detected_classes

# ==================================================================================
# STAGE 5: EMBEDDINGS (GPU Batch)
# ==================================================================================
def run_stage_embeddings(final_images, captions):
    logger.info(">>> STAGE 5: EMBEDDINGS (GPU Batch) <<<")
    clean_vram()
    
    from tqdm import tqdm
    from PIL import Image
    import Step07_Embeddings as Step07
    
    model_sig, proc_sig = Step07.load_siglip()
    embeddings = {}
    
    try:
        for original, img_path in tqdm(final_images.items(), desc="Computing Embeddings"):
            img = Image.open(img_path)
            img_emb = Step07.get_image_embedding(img)
            
            cap = captions.get(original, "")
            txt_emb = Step07.get_text_embedding(cap)
            
            embeddings[original] = {
                "image_embedding": img_emb.tolist(),
                "text_embedding": txt_emb.tolist()
            }
    finally:
        Step07.unload_siglip()
        clean_vram()
        
    return embeddings

# ==================================================================================
# MAIN ORCHESTRATOR
# ==================================================================================
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", default="processed_optimized")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--provider", default="Unknown")
    args = parser.parse_args()
    
    # GPU Check
    import torch
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        logger.info(f"🚀 Detected GPU: {gpu_name}")
        vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
        logger.info(f"   VRAM Total: {vram:.2f} GB")
    else:
        logger.warning("⚠️  CUDA NOT DETECTED. Pipeline will run on CPU (Slow).")
    
    in_dir = Path(args.input)
    out_dir = Path(args.output)
    temp_dir = out_dir / ".temp_optimized"
    vectors_dir = out_dir / "vectors"
    
    out_dir.mkdir(parents=True, exist_ok=True)
    temp_dir.mkdir(parents=True, exist_ok=True)
    vectors_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "img").mkdir(exist_ok=True)
    
    # Load Categories
    cat_path = ROOT_DIR / "00_data" / "Categories.json"
    with open(cat_path) as f: cat_idx = json.load(f)
    
    stage_profiles: list[dict[str, Any]] = []

    # 0. SCAN
    t0 = time.time()
    st = time.time()
    gpu_start = gpu_mem_snapshot()
    images = scan_images(in_dir, args.limit)
    if not images: return
    stage_profiles.append({
        "name": "Scan",
        "seconds": time.time() - st,
        "gpu_start": gpu_start,
        "gpu_end": gpu_mem_snapshot(),
    })
    logger.info(f"[PROFILE] Scan took {time.time()-st:.2f}s")
    
    # 1. UPSCALE
    t1 = time.time()
    gpu_start = gpu_mem_snapshot()
    upscaled_map = run_stage_upscale(images, temp_dir)
    stage_profiles.append({
        "name": "Stage 1 (Upscale)",
        "seconds": time.time() - t1,
        "gpu_start": gpu_start,
        "gpu_end": gpu_mem_snapshot(),
    })
    logger.info(f"[PROFILE] Stage 1 (Upscale) took {time.time()-t1:.2f}s")
    
    # 2. RMBG
    t2 = time.time()
    gpu_start = gpu_mem_snapshot()
    alpha_map = run_stage_rmbg(upscaled_map, temp_dir)
    stage_profiles.append({
        "name": "Stage 2 (RMBG)",
        "seconds": time.time() - t2,
        "gpu_start": gpu_start,
        "gpu_end": gpu_mem_snapshot(),
    })
    logger.info(f"[PROFILE] Stage 2 (RMBG) took {time.time()-t2:.2f}s")
    
    # 3. CAPTION
    t3 = time.time()
    gpu_start = gpu_mem_snapshot()
    captions = run_stage_caption(upscaled_map)
    stage_profiles.append({
        "name": "Stage 3 (Caption)",
        "seconds": time.time() - t3,
        "gpu_start": gpu_start,
        "gpu_end": gpu_mem_snapshot(),
    })
    logger.info(f"[PROFILE] Stage 3 (Caption) took {time.time()-t3:.2f}s")
    
    # 4. REFINEMENT
    t4 = time.time()
    gpu_start = gpu_mem_snapshot()
    final_masks, detected_classes = run_stage_refinement(upscaled_map, alpha_map, temp_dir, cat_idx)
    stage_profiles.append({
        "name": "Stage 4 (Refinement)",
        "seconds": time.time() - t4,
        "gpu_start": gpu_start,
        "gpu_end": gpu_mem_snapshot(),
    })
    logger.info(f"[PROFILE] Stage 4 (Refinement) took {time.time()-t4:.2f}s")
    
    # PREPARE FINAL IMAGES for Embeddings
    t_prep = time.time()
    gpu_start = gpu_mem_snapshot()
    final_image_paths = {}
    valid_records_data = {} # To store Lod/File size/etc for final step
    
    # Prepare dependencies for finalization without heavy import
    from tqdm import tqdm
    from PIL import Image
    import Step10_Vision as Step10
    from Step08_OutputUtils import (
        estimate_lod, create_image_record, generate_output_filename, 
        generate_simplified_name
    )
    from Step06_Categorization import predict_category_openai
    
    logger.info(">>> PREPARING FINAL IMAGES <<<")
    for original, mask in tqdm(final_masks.items(), desc="Applying Masks"):
        img = Image.open(upscaled_map[original]).convert("RGB")
        
        # Post-process mask
        mask = Step10.refine_mask_aggressive(img, mask)
        cleaned, mask = Step10.remove_background_artifacts(img, mask)
        final_img = Step10.apply_mask_to_image(cleaned, mask)
        
        # Filename generation
        cap = captions.get(original, "")
        out_name = generate_output_filename(
            generate_simplified_name(cap) if cap else original.stem, 
            "final", 
            str(original) # Pass the full path string for stable hashing in Step08
        )
        final_path = out_dir / "img" / out_name
        final_img.save(final_path)
        final_image_paths[original] = final_path
        
        # Calculate LOD & Size
        lod_res = estimate_lod(Image.open(upscaled_map[original]), mask)
        valid_records_data[original] = {
            "lod": lod_res,
            "file_size": final_path.stat().st_size / 1024,
            "processed_at": datetime.now().isoformat()
        }
    logger.info(f"[PROFILE] Image Prep took {time.time()-t_prep:.2f}s")
    stage_profiles.append({
        "name": "Prep Final Images",
        "seconds": time.time() - t_prep,
        "gpu_start": gpu_start,
        "gpu_end": gpu_mem_snapshot(),
    })

    # 5. EMBEDDINGS
    t5 = time.time()
    gpu_start = gpu_mem_snapshot()
    embeddings_map = run_stage_embeddings(final_image_paths, captions)
    stage_profiles.append({
        "name": "Stage 5 (Embeddings)",
        "seconds": time.time() - t5,
        "gpu_start": gpu_start,
        "gpu_end": gpu_mem_snapshot(),
    })
    logger.info(f"[PROFILE] Stage 5 (Embeddings) took {time.time()-t5:.2f}s")
    
    # 6. FINALIZE
    t6 = time.time()
    gpu_start = gpu_mem_snapshot()
    logger.info(">>> STAGE 6: FINALIZING <<<")
    batch_records = []
    
    for original, final_path in final_image_paths.items():
        if original not in embeddings_map: continue
        
        emb_data = embeddings_map[original]
        meta_data = valid_records_data[original]
        cap = captions.get(original, "")
        cat_data = predict_category_openai(cap) # API call
        
        rec = create_image_record(
            original_path=str(original),
            output_path=str(final_path),
            description=cap,
            cat_data=cat_data,
            lod=meta_data["lod"]["lod"],
            lod_label=meta_data["lod"].get("lod_label"),
            lod_metrics=meta_data["lod"].get("metrics"),
            provider=args.provider,
            image_embedding=emb_data["image_embedding"],
            text_embedding=emb_data["text_embedding"],
            processed_at=meta_data["processed_at"],
            file_size_kb=round(meta_data["file_size"], 2),
            simplified_description=generate_simplified_name(cap),
            detected_class=detected_classes.get(original),
            possible_categories=cat_data.get("possible_categories", []),
            category_candidates=cat_data.get("category_candidates", [])
        )
        batch_records.append(rec)
        
    # Save Manifest
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    manifest_path = vectors_dir / f"batch_OPTIMIZED_{timestamp}.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(batch_records, f, indent=2)
        
    logger.info(f"Saved {len(batch_records)} records to {manifest_path}")
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)
    stage_profiles.append({
        "name": "Stage 6 (Finalize)",
        "seconds": time.time() - t6,
        "gpu_start": gpu_start,
        "gpu_end": gpu_mem_snapshot(),
    })
    logger.info(f"[PROFILE] Stage 6 (Finalize) took {time.time()-t6:.2f}s")
    total_seconds = time.time() - t0
    logger.info(f"[PROFILE] Total Pipeline took {total_seconds:.2f}s")
    if images:
        per_image = total_seconds / max(len(images), 1)
        logger.info(f"[PROFILE] Avg per-image time: {per_image:.2f}s (target: ~30s)")
    log_stage_profile(stage_profiles)
    logger.info("PIPELINE COMPLETE")

if __name__ == "__main__":
    main()
