from PIL import Image
from pathlib import Path
import sys

def resize_image(path, target_size):
    print(f"Resizing {path} to {target_size}...")
    img = Image.open(path)
    # Use LANCZOS for high-quality downsampling
    img_resized = img.resize(target_size, Image.LANCZOS)
    img_resized.save(path)

assets_dir = Path(r"c:\Users\dryos\Downloads\Shooter\public\assets\gameplay")

# Goal display size is ~ 470x210. 2x = 940x420. The texture is 1024x1024 (mostly transparent padding)
# We can just resize everything by exactly 0.5 (so 512x512). That's a safe 2x-3x retina size.
files_to_resize = [
    "keeper-idle.png",
    "keeper-ready.png",
    "keeper-save.png",
    "keeper-miss.png",
    "keeper-dive-left.png",
    "keeper-dive-right.png",
    "ball.png",
    "goal-front-frame.png"
]

for filename in files_to_resize:
    filepath = assets_dir / filename
    if filepath.exists():
        # Open to check current size
        with Image.open(filepath) as img:
            w, h = img.size
            if w == 1024:
                target_w = w // 2
                target_h = h // 2
                if filename == "ball.png":
                    target_w = 128
                    target_h = 128
                elif "keeper" in filename:
                    target_w = 350
                    target_h = 350
                elif "goal" in filename:
                    target_w = 900
                    target_h = 900
                
                # Resize directly
                img_resized = img.resize((target_w, target_h), Image.LANCZOS)
                img_resized.save(filepath)
                print(f"Resized {filename} to {target_w}x{target_h}")
            else:
                print(f"Skipped {filename} (already resized: {w}x{h})")
