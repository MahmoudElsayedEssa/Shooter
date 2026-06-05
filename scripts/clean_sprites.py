"""
Smart keeper sprite background removal.

Uses flood-fill from image edges to find ONLY background pixels,
leaving internal white details (eyes, shirt logos, numbers) untouched.
Then applies gentle alpha-edge defringe to remove the halo.
"""
from PIL import Image, ImageFilter
import os
from collections import deque


def flood_fill_background(img: Image.Image, tolerance: int = 30) -> set:
    """
    Flood-fill from image edges to find all background pixels.
    Background = pixels reachable from edges that are near-white/grey/transparent.
    """
    pixels = img.load()
    w, h = img.size
    visited = set()
    background = set()
    queue = deque()

    def is_background_like(r, g, b, a):
        """Check if pixel looks like background (light, or already transparent)."""
        if a < 30:
            return True
        brightness = (r + g + b) / 3
        # Background is typically very bright and uniform
        color_spread = max(r, g, b) - min(r, g, b)
        return brightness > (255 - tolerance) and color_spread < 40

    # Seed from all 4 edges
    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited:
            continue
        if x < 0 or x >= w or y < 0 or y >= h:
            continue
        visited.add((x, y))

        r, g, b, a = pixels[x, y]
        if not is_background_like(r, g, b, a):
            continue

        background.add((x, y))

        # Expand to 8-connected neighbors
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                    queue.append((nx, ny))

    return background


def clean_sprite(input_path: str, output_path: str):
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    print(f"  Finding background via edge flood-fill...")
    background = flood_fill_background(img, tolerance=30)
    print(f"  Found {len(background)} background pixels out of {w * h} total")

    # Pass 1: Make background pixels fully transparent
    for (x, y) in background:
        r, g, b, a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

    # Pass 2: Defringe — for pixels RIGHT NEXT to the background,
    # reduce their alpha slightly to soften the edge (anti-alias)
    # This creates a 1-2px soft transition instead of a hard cutoff
    edge_pixels = set()
    for (bx, by) in background:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = bx + dx, by + dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in background:
                    edge_pixels.add((nx, ny))

    for (x, y) in edge_pixels:
        r, g, b, a = pixels[x, y]
        if a == 0:
            continue
        # Check if this edge pixel is very bright (likely halo bleed)
        brightness = (r + g + b) / 3
        if brightness > 200:
            # This is a bright edge pixel = halo remnant
            # Darken it and reduce alpha
            factor = 0.7
            new_a = int(a * 0.5)
            pixels[x, y] = (int(r * factor), int(g * factor), int(b * factor), new_a)
        elif brightness > 150:
            # Moderate brightness edge — gentle alpha reduction
            pixels[x, y] = (r, g, b, int(a * 0.8))

    # Pass 3: Very gentle alpha smooth (0.3px blur) — just to clean up jaggies
    # We do NOT use MinFilter (erosion) because that would eat details
    alpha = img.split()[3]
    alpha_smooth = alpha.filter(ImageFilter.GaussianBlur(0.3))
    img.putalpha(alpha_smooth)

    img.save(output_path, "PNG", optimize=True)
    size_kb = os.path.getsize(output_path) // 1024
    print(f"  [OK] Saved: {output_path} ({size_kb}KB)")


if __name__ == "__main__":
    base = r"c:\Users\dryos\Downloads"
    out_dir = r"c:\Users\dryos\Downloads\Shooter\public\assets\gameplay"

    files = [
        (
            os.path.join(base, "ChatGPT Image Jun 5, 2026, 04_05_37 PM.png"),
            os.path.join(out_dir, "keeper-toy-save-celebrate.png"),
            "Save Celebrate (ball + fist pump)"
        ),
        (
            os.path.join(base, "ChatGPT Image Jun 5, 2026, 03_48_52 PM.png"),
            os.path.join(out_dir, "keeper-toy-celebrate.png"),
            "Match Win Celebrate (both fists raised)"
        ),
    ]

    for src, dst, label in files:
        print(f"Processing: {label}")
        if not os.path.exists(src):
            print(f"  [MISSING] Source not found: {src}")
            continue
        clean_sprite(src, dst)

    print("\nDone! Eyes, logos, and shirt details preserved.")
