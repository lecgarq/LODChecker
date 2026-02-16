from __future__ import annotations

import sys
from pathlib import Path

import torch
from transformers import Blip2ForConditionalGeneration, Blip2Processor

ROOT_DIR = Path(__file__).resolve().parents[3]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))
from config import load_config

CFG = load_config(ROOT_DIR)


def load_blip2_model() -> tuple[Blip2ForConditionalGeneration, Blip2Processor, str]:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    model_name = CFG["models"]["blip2"]
    processor = Blip2Processor.from_pretrained(model_name)

    try:
        if device == "cuda":
            model = Blip2ForConditionalGeneration.from_pretrained(
                model_name,
                torch_dtype=torch.float16,
            )
            model = model.to(device)
            torch.zeros(1).to(device)
            torch.cuda.synchronize()
        else:
            model = Blip2ForConditionalGeneration.from_pretrained(model_name)
            model = model.to(device)
    except RuntimeError as exc:
        print(f"[BLIP2] Warning: CUDA failed ({exc}), falling back to CPU (slower)")
        device = "cpu"
        model = Blip2ForConditionalGeneration.from_pretrained(model_name)
        model = model.to(device)

    model.eval()
    return model, processor, device
