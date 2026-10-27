"""Cut the welcome-screen artwork out of the two reference panels into parallax layers.

Source: data/reference/cover/01_welcome_splash_2x.png and 02_welcome_scroll_transition_2x.png
(from the supplied reference pack). The paper and its faint grid are removed (alpha
extraction), the title / small text / controls are masked out because the app draws them as
live UI, and the remaining artwork is sliced into overlapping, feathered layers.

    python scripts/build_cover_assets.py

Outputs src/assets/cover/*.webp plus layers.json (stage-space placement used by the app).
Stage space is the first panel's size: 602 x 1114.
"""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "data" / "reference" / "cover"
OUT = ROOT / "src" / "assets" / "cover"
STAGE_W, STAGE_H = 602, 1114
FRAME = 12  # dark rounded frame of the mock-up, trimmed

# alpha extraction: pixels this close to the paper colour vanish, clearly inked pixels stay opaque
T0, T1 = 26.0, 58.0


def smooth(x: np.ndarray, a: float, b: float) -> np.ndarray:
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def drop_grid_lines(img: Image.Image) -> Image.Image:
    """The mock-up's dark panels carry a fine grid. A median filter removes 1-2 px lines; it is
    blended in only where the surrounding area is dark, so detailed light artwork stays sharp."""
    rgb = img.convert("RGB")
    med = rgb.filter(ImageFilter.MedianFilter(5))
    lum = np.asarray(med.convert("L")).astype(np.float32)
    dark = Image.fromarray((smooth(95 - lum, 0, 35) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))
    w = (np.asarray(dark).astype(np.float32) / 255.0)[..., None]
    out = np.asarray(rgb).astype(np.float32) * (1 - w) + np.asarray(med).astype(np.float32) * w
    return Image.fromarray(out.astype(np.uint8))


def extract(img: Image.Image, paper: tuple[int, int, int]) -> np.ndarray:
    img = drop_grid_lines(img)
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    dist = np.sqrt(((rgb - np.array(paper, np.float32)) ** 2).sum(axis=2))
    alpha = smooth(dist, T0, T1)
    return np.dstack([rgb, alpha * 255.0])


def feather_rect(h: int, w: int, box: tuple[int, int, int, int], f: int, edges: str = "ltrb") -> np.ndarray:
    """1 inside box, ramping to 0 over f px at the chosen edges (l,t,r,b)."""
    x0, y0, x1, y1 = box
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    m = np.ones((h, w), np.float32)
    if "l" in edges:
        m *= np.clip((xx - x0) / f, 0, 1)
    else:
        m *= xx >= x0
    if "r" in edges:
        m *= np.clip((x1 - xx) / f, 0, 1)
    else:
        m *= xx <= x1
    if "t" in edges:
        m *= np.clip((yy - y0) / f, 0, 1)
    else:
        m *= yy >= y0
    if "b" in edges:
        m *= np.clip((y1 - yy) / f, 0, 1)
    else:
        m *= yy <= y1
    return m


def mask_out(a: np.ndarray, boxes: list[tuple[int, int, int, int]], f: int = 10) -> None:
    h, w = a.shape[:2]
    for x0, y0, x1, y1 in boxes:
        inner = feather_rect(h, w, (x0 + f, y0 + f, x1 - f, y1 - f), f)
        # inner is 1 inside the shrunk box and fades outward; pad = 1 - ring
        yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
        dx = np.maximum(np.maximum(x0 - xx, xx - x1), 0)
        dy = np.maximum(np.maximum(y0 - yy, yy - y1), 0)
        d = np.sqrt(dx * dx + dy * dy)
        keep = np.clip(d / f, 0, 1)  # 0 inside the box, 1 beyond f px outside
        a[..., 3] *= keep
        del inner


def save_layer(a: np.ndarray, name: str, box: tuple[int, int, int, int], f: int, edges: str, scale: float = 1.0, dx: float = 0, entries: dict | None = None) -> None:
    h, w = a.shape[:2]
    x0, y0, x1, y1 = box
    m = feather_rect(h, w, box, f, edges)
    layer = a.copy()
    layer[..., 3] *= m
    crop = layer[y0:y1, x0:x1]
    # trim fully transparent border to keep files small
    ys, xs = np.where(crop[..., 3] > 4)
    if not len(ys):
        return
    ty0, ty1, tx0, tx1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    crop = crop[ty0:ty1, tx0:tx1]
    img = Image.fromarray(np.clip(crop, 0, 255).astype(np.uint8), "RGBA")
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / f"{name}.webp", quality=86, alpha_quality=92, method=6)
    if entries is not None:
        entries[name] = {
            "x": round((x0 + tx0) * scale + dx, 2),
            "y": round((y0 + ty0) * scale, 2),
            "w": round(crop.shape[1] * scale, 2),
            "h": round(crop.shape[0] * scale, 2),
        }


def main() -> None:
    entries: dict = {}

    # ---- panel 1: the poster -------------------------------------------------
    im1 = Image.open(SRC / "01_welcome_splash_2x.png").convert("RGB")
    w, h = im1.size
    a1 = extract(im1, (231, 224, 207))
    # frame, live text, sun icon, controls, title block
    mask_out(a1, [
        (0, 0, w, FRAME), (0, h - FRAME, w, h), (0, 0, FRAME, h), (w - FRAME, 0, w, h),
        (25, 30, 150, 118),      # LAND PEOPLE CLIMATE ...
        (515, 28, 595, 92),      # 2010 - 2023
        (282, 30, 322, 72),      # sun icon
        (180, 1015, 425, h),     # chevron + SCROLL TO EXPLORE
    ])
    mask_out(a1, [(138, 404, 472, 708)], f=34)  # CROP JOURNEY + subtitle, soft edge
    f = 22
    save_layer(a1, "p1-top", (0, 70, w, 480), f, "tb", entries=entries)
    save_layer(a1, "p1-midl", (0, 452, 215, 782), f, "rtb", entries=entries)
    save_layer(a1, "p1-midr", (410, 452, w, 782), f, "ltb", entries=entries)
    save_layer(a1, "p1-botl", (0, 756, 330, h), f, "rt", entries=entries)
    save_layer(a1, "p1-botr", (285, 756, w, h), f, "lt", entries=entries)

    # ---- panel 2: the "bigger picture" state ---------------------------------
    im2 = Image.open(SRC / "02_welcome_scroll_transition_2x.png").convert("RGB")
    w2, h2 = im2.size
    a2 = extract(im2, (218, 213, 195))
    mask_out(a2, [
        (0, 0, w2, FRAME), (0, h2 - FRAME, w2, h2), (0, 0, FRAME, h2), (w2 - FRAME, 0, w2, h2),
        (60, 295, 515, 675),     # CROP JOURNEY + subtitle
        (270, 0, 308, 130),      # vertical axis (rebuilt as UI)
        (270, 690, 308, 1000),
        (250, 835, 325, 905),    # chevron button
        (255, 975, 325, 1010),   # red marker
        (180, 1035, 400, h2),    # EXPLORING A BIGGER PICTURE
    ], f=8)
    s = STAGE_H / h2
    dx = (STAGE_W - w2 * s) / 2
    f = 22
    # layers are stored in panel-2 pixels; placement is converted to stage space with scale s
    for name, box, edges in [
        ("p2-tl", (0, 0, 320, 290), "rb"),
        ("p2-tr", (300, 0, w2, 360), "lb"),
        ("p2-mid", (120, 640, 460, 880), "ltrb"),
        ("p2-bl", (0, 590, 260, h2), "rt"),
        ("p2-br", (300, 700, w2, h2), "lt"),
    ]:
        save_layer(a2, name, box, f, edges, scale=s, dx=dx, entries=entries)

    (OUT / "layers.json").write_text(json.dumps({"stage": [STAGE_W, STAGE_H], "layers": entries}, indent=2), encoding="utf-8")
    for k, v in entries.items():
        print(k, v, (OUT / f"{k}.webp").stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
