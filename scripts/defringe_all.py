import os
import glob
from PIL import Image, ImageFilter
from collections import deque

def flood_fill_background(img: Image.Image) -> set:
    """Flood-fill to find all transparent/background pixels."""
    pixels = img.load()
    w, h = img.size
    visited = set()
    background = set()
    queue = deque()

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
        # Treat transparent or near-transparent as background
        if a < 30:
            background.add((x, y))
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if dx == 0 and dy == 0:
                        continue
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                        queue.append((nx, ny))

    return background

def clean_existing_sprite(filepath: str):
    print(f"Processing: {os.path.basename(filepath)}")
    img = Image.open(filepath).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    background = flood_fill_background(img)

    # Pass 1: Make sure background is fully transparent
    for (x, y) in background:
        r, g, b, a = pixels[x, y]
        pixels[x, y] = (r, g, b, 0)

    # Pass 2: Defringe edges
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
        brightness = (r + g + b) / 3
        if brightness > 200:
            factor = 0.7
            pixels[x, y] = (int(r * factor), int(g * factor), int(b * factor), int(a * 0.5))
        elif brightness > 150:
            pixels[x, y] = (r, g, b, int(a * 0.8))

    # Pass 3: Gentle smooth
    alpha = img.split()[3]
    alpha_smooth = alpha.filter(ImageFilter.GaussianBlur(0.3))
    img.putalpha(alpha_smooth)

    img.save(filepath, "PNG", optimize=True)
    print(f"  [OK] Cleaned {os.path.basename(filepath)}")

if __name__ == "__main__":
    out_dir = r"c:\Users\dryos\Downloads\Shooter\public\assets\gameplay"
    files = glob.glob(os.path.join(out_dir, "keeper-toy-*.png"))
    
    for filepath in files:
        # Skip the ones we just created from the raw chatgpt images
        if "save-celebrate" in filepath or "celebrate" in filepath:
            continue
        clean_existing_sprite(filepath)
    print("All existing sprites cleaned!")
