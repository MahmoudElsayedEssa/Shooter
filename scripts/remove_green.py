"""Remove green (#00FF00) background from generated game sprites — no numpy/scipy needed."""
from pathlib import Path
from PIL import Image
import shutil

def remove_green(input_path: str, output_path: str) -> None:
    """Remove bright green background pixels, replacing with transparent."""
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    w, h = img.size
    
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            # Detect bright green: high green, low red and blue
            if g > 150 and r < 120 and b < 120:
                pixels[x, y] = (r, g, b, 0)
            # Detect greenish tones (anti-alias edges)
            elif g > 120 and g > r * 1.8 and g > b * 1.8:
                # Partial transparency for edge pixels
                green_strength = min(255, int((g - max(r, b)) * 2))
                new_alpha = max(0, a - green_strength)
                pixels[x, y] = (r, g, b, new_alpha)
    
    img.save(output_path, "PNG")
    print(f"Saved: {output_path} ({w}x{h})")

import sys

if __name__ == "__main__":
    if len(sys.argv) == 3:
        input_file = sys.argv[1]
        output_file = sys.argv[2]
        print(f"Processing single file: {input_file} -> {output_file}")
        remove_green(input_file, output_file)
    else:
        print("Usage: python remove_green.py <input> <output>")
