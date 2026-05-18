#!/usr/bin/env python3
"""
Build the RayHealth EVV App Store icon master.

Output:
  rayhealth-icon-1024.png  — 1024x1024 PNG, no alpha, no rounded corners.
                             Apple applies the squircle mask itself.

Spec:
  - Brand primary: #0B5FB1
  - Brand accent: #10A4A4
  - Subtle vertical gradient (primary -> deeper navy at bottom) for depth
  - Centered shield mark with care-pulse line through it
  - "Care. Verified. Delivered." — the shield IS the verified, the pulse IS care.

Design rationale:
  - Apple HIG: recognizable at small sizes, no text, centered weight
  - High contrast against any home screen background
  - Operations-grade but warm — the rounded shield + teal pulse balance
    the clinical blue
"""
from PIL import Image, ImageDraw, ImageFilter

# ---- Brand tokens ----------------------------------------------------------

PRIMARY = (11, 95, 177)          # #0B5FB1 — RayHealth primary blue
PRIMARY_DEEP = (8, 64, 122)      # darker shade for gradient bottom
ACCENT = (16, 164, 164)          # #10A4A4 — care/accent teal
WHITE = (255, 255, 255)
SHIELD_FILL = (255, 255, 255)
PULSE = (16, 164, 164)

SIZE = 1024


# ---- Gradient background ---------------------------------------------------

def vertical_gradient(size: int, top: tuple[int, int, int], bottom: tuple[int, int, int]) -> Image.Image:
    img = Image.new('RGB', (size, size), top)
    draw = ImageDraw.Draw(img)
    for y in range(size):
        t = y / (size - 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        draw.line([(0, y), (size, y)], fill=(r, g, b))
    return img


# ---- Shield path -----------------------------------------------------------
# Heraldic shield: rounded top, sides curve in, bottom comes to a point.
# Built from many sampled points so we get smooth curves with PIL polygons.

import math


def shield_points(cx: int, cy: int, width: int, height: int) -> list[tuple[int, int]]:
    """Smooth heraldic-style shield, sampled densely so the polygon reads curved."""
    hw = width / 2
    hh = height / 2
    top_y = cy - hh
    bottom_y = cy + hh
    pts: list[tuple[int, int]] = []

    # Top arc: gentle dome from left shoulder to right shoulder.
    # Parametric arc with mild curvature.
    arc_steps = 40
    arc_height = hh * 0.18
    for i in range(arc_steps + 1):
        t = i / arc_steps  # 0..1 left -> right
        x = cx - hw + (width * t)
        # Symmetrical dip: ends are higher (smaller y), middle is lower (larger y)
        # But for a shield the top is FLAT-ish with rounded corners.
        # We'll do: very flat in the middle, dipping down sharply only at the corners.
        # Equivalent to a smoothed rectangle top edge.
        edge_dist = min(t, 1 - t)  # 0 at corners, 0.5 at center
        # Use cosine ease for the corners
        if edge_dist < 0.10:
            corner_t = edge_dist / 0.10  # 0..1
            y_offset = arc_height * (1 - math.sin(corner_t * math.pi / 2))
        else:
            y_offset = 0
        pts.append((int(x), int(top_y + y_offset)))

    # Right side curve: shoulder -> taper -> bottom point.
    side_steps = 40
    for i in range(1, side_steps + 1):
        t = i / side_steps  # 0..1 top -> bottom
        # Width shrinks as we go down, with a slight outward bulge near top.
        # Use a smooth easing: width = hw * (1 - t^p), with p chosen to taper nicely.
        # Add a small outward bulge in the upper third.
        bulge = 0.05 * math.sin(t * math.pi) if t < 0.5 else 0
        w = hw * ((1 - t ** 2.2) + bulge)
        x = cx + w
        y = top_y + (bottom_y - top_y) * (0.18 * (1 if t == 0 else 0) + t)
        # Simpler vertical mapping: linear from top_y+arc_height down to bottom_y.
        y = top_y + arc_height + (bottom_y - top_y - arc_height) * t
        pts.append((int(x), int(y)))

    # Bottom point already included as the last right-side step (t=1, w~0).

    # Left side curve: bottom point -> taper -> shoulder.
    for i in range(1, side_steps + 1):
        t = 1 - (i / side_steps)
        bulge = 0.05 * math.sin(t * math.pi) if t < 0.5 else 0
        w = hw * ((1 - t ** 2.2) + bulge)
        x = cx - w
        y = top_y + arc_height + (bottom_y - top_y - arc_height) * t
        pts.append((int(x), int(y)))

    return pts


# ---- Build the icon --------------------------------------------------------

def build() -> Image.Image:
    bg = vertical_gradient(SIZE, PRIMARY, PRIMARY_DEEP)
    draw = ImageDraw.Draw(bg)

    # Center anchor
    cx, cy = SIZE // 2, SIZE // 2

    # Shield: ~60% of canvas, centered slightly above visual center for balance.
    shield_w = int(SIZE * 0.56)
    shield_h = int(SIZE * 0.62)
    shield_cy = cy - int(SIZE * 0.02)

    # Subtle outer halo (white at very low alpha to lift the shield off the bg)
    halo = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
    halo_draw = ImageDraw.Draw(halo)
    halo_pts = shield_points(cx, shield_cy, shield_w + 40, shield_h + 40)
    halo_draw.polygon(halo_pts, fill=(255, 255, 255, 30))
    halo = halo.filter(ImageFilter.GaussianBlur(radius=18))
    bg.paste(halo, (0, 0), halo)

    # Main shield (white fill)
    pts = shield_points(cx, shield_cy, shield_w, shield_h)
    draw.polygon(pts, fill=SHIELD_FILL)

    # Care-pulse line through the center of the shield (teal)
    # This is the ECG-style pulse waveform — flat / spike / flat — drawn with
    # a fairly thick stroke so it reads at small sizes.
    pulse_y = shield_cy + int(SIZE * 0.02)
    pulse_stroke = max(14, SIZE // 64)
    pulse_pts: list[tuple[int, int]] = []
    px_start = cx - int(shield_w * 0.35)
    px_end = cx + int(shield_w * 0.35)
    # Build a simple ECG: --- /\  /\___ ---
    pulse_pts.extend([
        (px_start, pulse_y),
        (cx - int(shield_w * 0.18), pulse_y),
        (cx - int(shield_w * 0.10), pulse_y - int(SIZE * 0.07)),  # up spike
        (cx - int(shield_w * 0.02), pulse_y + int(SIZE * 0.05)),  # dip
        (cx + int(shield_w * 0.06), pulse_y - int(SIZE * 0.03)),  # small bump
        (cx + int(shield_w * 0.14), pulse_y),
        (px_end, pulse_y),
    ])
    draw.line(pulse_pts, fill=PULSE, width=pulse_stroke, joint='curve')

    # Small accent dot at the start of the pulse — represents "verified, alive"
    dot_r = max(10, SIZE // 96)
    draw.ellipse(
        [
            (px_start - dot_r, pulse_y - dot_r),
            (px_start + dot_r, pulse_y + dot_r),
        ],
        fill=PRIMARY,
    )

    return bg


def main() -> None:
    import os
    out_dir = os.path.dirname(os.path.abspath(__file__))
    icon = build()
    # Apple App Store: 1024x1024 PNG, no alpha. Flatten by saving as plain RGB.
    out = os.path.join(out_dir, 'rayhealth-icon-1024.png')
    icon.convert('RGB').save(out, 'PNG', optimize=True)
    print(f'wrote {out} ({icon.size[0]}x{icon.size[1]}, mode=RGB)')

    # Generate iOS/Android required sizes for convenience.
    sizes = {
        'rayhealth-icon-180.png': 180,    # iPhone @3x
        'rayhealth-icon-120.png': 120,    # iPhone @2x
        'rayhealth-icon-167.png': 167,    # iPad Pro
        'rayhealth-icon-152.png': 152,    # iPad
        'rayhealth-icon-512-android.png': 512,
        'rayhealth-icon-192-android.png': 192,
    }
    for name, sz in sizes.items():
        path = os.path.join(out_dir, name)
        resized = icon.resize((sz, sz), Image.LANCZOS).convert('RGB')
        resized.save(path, 'PNG', optimize=True)
        print(f'wrote {path} ({sz}x{sz})')


if __name__ == '__main__':
    main()
