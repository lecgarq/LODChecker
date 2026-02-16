import cv2
import numpy as np
from PIL import Image
from typing import Tuple

def check_quality_gate(alpha: Image.Image, threshold=0.6) -> Tuple[bool, dict]:
    a = np.array(alpha.convert("L"))
    _, bin_img = cv2.threshold(a, 127, 255, cv2.THRESH_BINARY)
    num, _, stats, _ = cv2.connectedComponentsWithStats(bin_img)
    blob_count = num - 1
    frag = 0
    if blob_count > 0:
        areas = stats[1:, cv2.CC_STAT_AREA]
        frag = 1 - (max(areas) / (sum(areas) + 1e-6))
    edges = cv2.Canny(a, 50, 150)
    sharpness = 0
    if np.sum(edges) > 0:
        gy, gx = np.gradient(a)
        mag = np.sqrt(gx**2 + gy**2)
        sharpness = np.mean(mag[edges > 0]) / 255.0
    score = 1.0 - (frag * 0.3) + (sharpness * 0.3)
    if blob_count > 1: score -= 0.2
    score = min(1.0, max(0.0, score))
    needs_refinement = (blob_count == 0) or (blob_count > 3) or (frag > 0.5) or (score < threshold)
    return not needs_refinement, {"score": score, "needs_refinement": needs_refinement}

def flood_fill_background(alpha: Image.Image) -> Image.Image:
    a = np.array(alpha.convert("L"))
    h, w = a.shape
    _, b = cv2.threshold(a, 127, 255, cv2.THRESH_BINARY)
    mask = np.zeros((h+2, w+2), np.uint8)
    for pt in [(0,0), (w-1,0), (0,h-1), (w-1,h-1)]:
        if b[pt[1], pt[0]] == 0:
            cv2.floodFill(b, mask, pt, 128)
    b[b==0] = 255
    b[b==128] = 0
    return Image.fromarray(b, "L")

def remove_background_artifacts(img: Image.Image, alpha: Image.Image):
    return img.convert("RGB"), alpha

def apply_mask_to_image(img, alpha):
    rgba = img.convert("RGB")
    rgba.putalpha(alpha.resize(rgba.size, Image.LANCZOS).convert("L"))
    return rgba

def refine_mask_aggressive(img, alpha, detect_halo=True):
    # 1. Boost low-confidence areas to be more inclusive
    a_np = np.array(alpha)
    a_np[a_np > 30] = 255 # If model thinks it's even 12% object, make it solid
    
    # 2. Flood fill holes
    alpha_boosted = Image.fromarray(a_np, "L")
    alpha_filled = flood_fill_background(alpha_boosted)
    a_np = np.array(alpha_filled)
    
    # 3. Morph close ONLY (fill gaps). NO OPEN (which destroys small details).
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3,3))
    a_np = cv2.morphologyEx(a_np, cv2.MORPH_CLOSE, k, iterations=1)
    
    return Image.fromarray(a_np, "L")
