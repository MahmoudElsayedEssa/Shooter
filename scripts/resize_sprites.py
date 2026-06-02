"""Resize all game sprites to proper game dimensions and fix quality."""
from pathlib import Path
from PIL import Image
import shutil

assets = Path(r"c:\Users\dryos\Downloads\Shooter\public\assets\gameplay")

def resize(name: str, target_h: int) -> None:
    path = assets / name
    img = Image.open(str(path)).convert("RGBA")
    ratio = target_h / img.height
    new_w = int(img.width * ratio)
    # Use LANCZOS for crisp downscaling
    resized = img.resize((new_w, target_h), Image.LANCZOS)
    resized.save(str(path), "PNG")
    print(f"  {name}: {img.size} -> {resized.size}")

print("Resizing sprites...")
resize("keeper-idle.png", 200)        # Display at ~82px = 2.4x reduction (crisp)
resize("keeper-dive-left.png", 160)   # Display at ~60px = 2.6x reduction
resize("ball.png", 128)               # Display at ~44px = 2.9x reduction
resize("goal-front-frame.png", 300)   # Display at ~210px = 1.4x reduction

# Re-mirror dive right from the resized dive-left
dive_left = Image.open(str(assets / "keeper-dive-left.png"))
dive_right = dive_left.transpose(Image.FLIP_LEFT_RIGHT)
dive_right.save(str(assets / "keeper-dive-right.png"), "PNG")
print(f"  keeper-dive-right.png: mirrored from dive-left")

# Copy resized idle for other poses
for pose in ["keeper-ready.png", "keeper-save.png", "keeper-miss.png"]:
    shutil.copy2(str(assets / "keeper-idle.png"), str(assets / pose))
    print(f"  {pose}: copied from idle")

print("\nAll sprites resized!")
