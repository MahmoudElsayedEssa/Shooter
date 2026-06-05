"""
Fix keeper-toy-miss.png — remove ONLY the large trapped white pocket
between his arms/head without touching eyes, teeth, flag, numbers, or logos.

Strategy:
1. Edge flood-fill (transparent only) — clean outer background
2. Find interior white clusters — ONLY remove clusters > 1500px
   (the trapped pocket is ~3000px, eyes/teeth/flag/numbers are all < 500px)
"""
import os
import subprocess
from PIL import Image, ImageFilter
from collections import deque

def flood_fill_edges(img: Image.Image) -> set:
    """Edge flood-fill through transparent pixels only."""
    pixels = img.load()
    w, h = img.size
    visited = set()
    background = set()
    queue = deque()

    for x in range(w):
        queue.append((x, 0))
        queue.append((x, h - 1))
    for y in range(h):
        queue.append((0, y))
        queue.append((w - 1, y))

    while queue:
        x, y = queue.popleft()
        if (x, y) in visited or x < 0 or x >= w or y < 0 or y >= h:
            continue
        visited.add((x, y))
        r, g, b, a = pixels[x, y]

        # Only spread through transparent/near-transparent
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


def find_large_white_clusters(img: Image.Image, known_bg: set, min_size: int = 1500) -> set:
    """
    Find connected white pixel clusters > min_size.
    
    Trapped background pocket: ~3000px
    Eyes: ~50px each
    Teeth: ~30px
    Flag white stripe: ~100px
    Number "10": ~200px
    Logo details: ~100px
    
    So min_size=1500 safely catches ONLY the trapped pocket.
    """
    pixels = img.load()
    w, h = img.size
    visited = set()
    trapped = set()

    for y in range(h):
        for x in range(w):
            if (x, y) in visited or (x, y) in known_bg:
                continue

            r, g, b, a = pixels[x, y]
            if a == 0:
                visited.add((x, y))
                continue

            brightness = (r + g + b) / 3
            if brightness < 220:
                visited.add((x, y))
                continue

            # Flood-fill this white cluster
            cluster = set()
            queue = deque([(x, y)])
            while queue:
                cx, cy = queue.popleft()
                if (cx, cy) in visited or cx < 0 or cx >= w or cy < 0 or cy >= h:
                    continue
                if (cx, cy) in known_bg:
                    continue
                visited.add((cx, cy))

                cr, cg, cb, ca = pixels[cx, cy]
                if ca == 0:
                    continue
                cb_bright = (cr + cg + cb) / 3
                # Spread through white/near-white pixels
                if cb_bright >= 210 and ca >= 150:
                    cluster.add((cx, cy))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            if dx == 0 and dy == 0:
                                continue
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in visited:
                                queue.append((nx, ny))

            if len(cluster) >= min_size:
                print(f"  REMOVING trapped cluster: {len(cluster)}px at ~({x},{y})")
                trapped.update(cluster)
            elif len(cluster) >= 30:
                print(f"  KEEPING detail cluster: {len(cluster)}px at ~({x},{y})")

    return trapped


def fix_sprite(filepath: str):
    print(f"Processing: {os.path.basename(filepath)}")
    img = Image.open(filepath).convert("RGBA")
    pixels = img.load()
    w, h = img.size

    # Step 1: Edge background (transparent only)
    edge_bg = flood_fill_edges(img)
    print(f"  Edge background: {len(edge_bg)} pixels")
    for (x, y) in edge_bg:
        pixels[x, y] = (0, 0, 0, 0)

    # Step 2: Find and remove ONLY large trapped white pockets
    trapped = find_large_white_clusters(img, edge_bg, min_size=1500)
    print(f"  Total trapped removed: {len(trapped)} pixels")
    for (x, y) in trapped:
        pixels[x, y] = (0, 0, 0, 0)

    all_bg = edge_bg | trapped

    # Step 3: Gentle defringe (1px border around removed regions)
    edge_pixels = set()
    for (bx, by) in trapped:  # Only defringe around trapped pockets
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = bx + dx, by + dy
                if 0 <= nx < w and 0 <= ny < h and (nx, ny) not in all_bg:
                    edge_pixels.add((nx, ny))

    for (x, y) in edge_pixels:
        r, g, b, a = pixels[x, y]
        if a == 0:
            continue
        brightness = (r + g + b) / 3
        if brightness > 220:
            pixels[x, y] = (int(r * 0.75), int(g * 0.75), int(b * 0.75), int(a * 0.6))

    # Step 4: Very gentle alpha smooth
    alpha = img.split()[3]
    alpha_smooth = alpha.filter(ImageFilter.GaussianBlur(0.25))
    img.putalpha(alpha_smooth)

    img.save(filepath, "PNG", optimize=True)
    print(f"  [OK] {os.path.basename(filepath)}")


if __name__ == "__main__":
    filepath = r"c:\Users\dryos\Downloads\Shooter\public\assets\gameplay\keeper-toy-miss.png"
    
    # Restore original from git first
    subprocess.run(
        ["git", "checkout", "HEAD", "--", "public/assets/gameplay/keeper-toy-miss.png"],
        cwd=r"c:\Users\dryos\Downloads\Shooter"
    )
    print("Restored original from git\n")
    
    fix_sprite(filepath)
