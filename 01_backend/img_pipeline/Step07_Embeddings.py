import torch
import numpy as np
import sys
from pathlib import Path
from PIL import Image
from transformers import SiglipModel, SiglipProcessor
from sentence_transformers import SentenceTransformer

ROOT_DIR = Path(__file__).resolve().parents[2]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
from config import load_config

CFG = load_config(ROOT_DIR)
SIGLIP_MODEL_ID = CFG["models"]["siglip"]
TEXT_EMB_MODEL_ID = CFG["models"]["sentence_transformer"]

_SIGLIP_MODEL = None
_SIGLIP_PROCESSOR = None
_SIGLIP_DEVICE = None
_TEXT_MODEL = None

def load_siglip():
    global _SIGLIP_MODEL, _SIGLIP_PROCESSOR, _SIGLIP_DEVICE
    if _SIGLIP_MODEL is None:
        if torch.cuda.is_available():
            try:
                _SIGLIP_DEVICE = "cuda"
                print(f"[SigLIP] Loading model on {_SIGLIP_DEVICE}...")
                _SIGLIP_PROCESSOR = SiglipProcessor.from_pretrained(SIGLIP_MODEL_ID)
                _SIGLIP_MODEL = SiglipModel.from_pretrained(SIGLIP_MODEL_ID).to(_SIGLIP_DEVICE)
                
                # Verify VRAM allocation
                dummy = torch.zeros(1, 3, 224, 224).to(_SIGLIP_DEVICE)
                _SIGLIP_MODEL.get_image_features(pixel_values=dummy)
                print(f"[SigLIP] Validated on GPU. Mem: {torch.cuda.memory_allocated()/1024**2:.1f}MB")
            except Exception as e:
                print(f"[SigLIP] CUDA Init Failed: {e}. Falling back to CPU.")
                _SIGLIP_DEVICE = "cpu"
                _SIGLIP_PROCESSOR = SiglipProcessor.from_pretrained(SIGLIP_MODEL_ID)
                _SIGLIP_MODEL = SiglipModel.from_pretrained(SIGLIP_MODEL_ID).to(_SIGLIP_DEVICE)
        else:
            print("[SigLIP] CUDA not available. Using CPU.")
            _SIGLIP_DEVICE = "cpu"
            _SIGLIP_PROCESSOR = SiglipProcessor.from_pretrained(SIGLIP_MODEL_ID)
            _SIGLIP_MODEL = SiglipModel.from_pretrained(SIGLIP_MODEL_ID).to(_SIGLIP_DEVICE)
            
        _SIGLIP_MODEL.eval()
    return _SIGLIP_MODEL, _SIGLIP_PROCESSOR

def get_image_embedding(img: Image.Image) -> np.ndarray:
    model, processor = load_siglip()
    inputs = processor(images=img.convert("RGB"), return_tensors="pt").to(_SIGLIP_DEVICE)
    with torch.no_grad():
        outputs = model.get_image_features(**inputs)
    emb = outputs[0].cpu().numpy()
    return (emb / (np.linalg.norm(emb) + 1e-8)).astype(np.float32)

def unload_siglip():
    global _SIGLIP_MODEL, _SIGLIP_PROCESSOR
    if _SIGLIP_MODEL:
        del _SIGLIP_MODEL
        del _SIGLIP_PROCESSOR
        _SIGLIP_MODEL = None
        if torch.cuda.is_available(): torch.cuda.empty_cache()

def get_text_embedding(text: str) -> np.ndarray:
    global _TEXT_MODEL
    if _TEXT_MODEL is None:
        device = "cpu" # Force CPU for stability
        print(f"[TextEmb] Loading SentenceTransformer on {device}...")
        _TEXT_MODEL = SentenceTransformer(TEXT_EMB_MODEL_ID, device=device)
    emb = _TEXT_MODEL.encode(text, convert_to_numpy=True)
    return (emb / (np.linalg.norm(emb) + 1e-8)).astype(np.float32)
