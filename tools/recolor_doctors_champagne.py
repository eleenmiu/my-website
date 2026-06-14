from pathlib import Path

import numpy as np
from PIL import Image


SOURCE_DIR = Path("assets/images/doctors-clean")
OUTPUT_DIR = Path("assets/images/doctors-champagne")

DOCTOR_IMAGES = [
    "meituan-doctor-3.jpg",
    "meituan-doctor-5.jpg",
    "meituan-doctor-9.jpg",
    "meituan-doctor-4.jpg",
    "meituan-doctor-2.jpg",
    "meituan-doctor-1.jpg",
    "meituan-doctor-6.jpg",
    "meituan-doctor-7.jpg",
    "chen-lei-wechatimg2190.jpg",
]


def rgb_to_hsv(rgb: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    arr = rgb / 255.0
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    maxc = arr.max(axis=-1)
    minc = arr.min(axis=-1)
    delta = maxc - minc

    hue = np.zeros_like(maxc)
    nonzero = delta > 1e-6
    red = (maxc == r) & nonzero
    green = (maxc == g) & nonzero
    blue = (maxc == b) & nonzero

    hue[red] = ((g[red] - b[red]) / delta[red]) % 6
    hue[green] = ((b[green] - r[green]) / delta[green]) + 2
    hue[blue] = ((r[blue] - g[blue]) / delta[blue]) + 4
    hue *= 60

    sat = np.zeros_like(maxc)
    sat[maxc > 1e-6] = delta[maxc > 1e-6] / maxc[maxc > 1e-6]
    return hue, sat, maxc


def champagne_map(rgb: np.ndarray) -> np.ndarray:
    hue, sat, val = rgb_to_hsv(rgb)
    luma = (0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]) / 255.0

    blue_mask = (
        (hue >= 175)
        & (hue <= 245)
        & (sat >= 0.18)
        & (val >= 0.28)
        & (rgb[..., 2] > rgb[..., 0] * 1.12)
        & (rgb[..., 2] > rgb[..., 1] * 0.82)
    )

    # Soft feather the blue selection so antialiased ring edges stay natural.
    strength = np.clip((sat - 0.16) / 0.48, 0, 1)
    strength *= np.clip((val - 0.22) / 0.35, 0, 1)
    strength = np.where(blue_mask, strength, 0)
    strength = np.expand_dims(strength, axis=-1)

    shadow = np.array([142, 115, 72], dtype=np.float32)
    mid = np.array([214, 188, 128], dtype=np.float32)
    highlight = np.array([247, 238, 217], dtype=np.float32)

    t = np.clip((luma - 0.12) / 0.78, 0, 1)
    low = shadow * (1 - t[..., None]) + mid * t[..., None]
    high = mid * (1 - t[..., None]) + highlight * t[..., None]
    champagne = np.where((t[..., None] < 0.58), low, high)

    # Add a small contrast lift to make the gold ring read polished instead of flat.
    contrast = (luma[..., None] - 0.5) * 14
    champagne = np.clip(champagne + contrast, 0, 255)

    out = rgb * (1 - strength) + champagne * strength

    # Warm the pale studio background very lightly while protecting skin and coats.
    pale = (sat < 0.16) & (val > 0.58) & (luma > 0.55)
    warm = np.array([247, 239, 222], dtype=np.float32)
    pale_strength = np.expand_dims(np.where(pale, 0.08, 0), axis=-1)
    out = out * (1 - pale_strength) + warm * pale_strength

    return np.clip(out, 0, 255).astype(np.uint8)


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for filename in DOCTOR_IMAGES:
        source = SOURCE_DIR / filename
        output = OUTPUT_DIR / filename
        image = Image.open(source).convert("RGB")
        arr = np.asarray(image, dtype=np.float32)
        recolored = champagne_map(arr)
        Image.fromarray(recolored, "RGB").save(
            output,
            format="JPEG",
            quality=94,
            optimize=True,
            progressive=True,
        )
        print(f"{source} -> {output}")


if __name__ == "__main__":
    main()
