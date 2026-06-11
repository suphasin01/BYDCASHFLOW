#!/usr/bin/env python3
"""Generate FruitBiz app icon: PNG 1024x1024, ICO, ICNS"""

import struct, zlib, io, os
from PIL import Image, ImageDraw

try:
    import cairosvg
    HAS_CAIRO = True
except ImportError:
    HAS_CAIRO = False

SVG = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
<defs>
  <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
    <stop offset="0%" stop-color="#1e1b4b"/>
    <stop offset="55%" stop-color="#312e81"/>
    <stop offset="100%" stop-color="#4c1d95"/>
  </linearGradient>
  <radialGradient id="shine" cx="38%" cy="28%" r="55%">
    <stop offset="0%" stop-color="#ffffff" stop-opacity="0.13"/>
    <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
  </radialGradient>

  <!-- orange -->
  <radialGradient id="og" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#fed7aa"/>
    <stop offset="60%" stop-color="#fb923c"/>
    <stop offset="100%" stop-color="#c2410c"/>
  </radialGradient>
  <!-- red apple -->
  <radialGradient id="rd" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#fca5a5"/>
    <stop offset="60%" stop-color="#ef4444"/>
    <stop offset="100%" stop-color="#991b1b"/>
  </radialGradient>
  <!-- lime green -->
  <radialGradient id="gn" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#d9f99d"/>
    <stop offset="60%" stop-color="#84cc16"/>
    <stop offset="100%" stop-color="#3f6212"/>
  </radialGradient>
  <!-- yellow mango -->
  <radialGradient id="yw" cx="35%" cy="30%" r="70%">
    <stop offset="0%" stop-color="#fef08a"/>
    <stop offset="60%" stop-color="#facc15"/>
    <stop offset="100%" stop-color="#854d0e"/>
  </radialGradient>
</defs>

<!-- Background rounded square -->
<rect width="1024" height="1024" rx="224" fill="url(#bg)"/>
<rect width="1024" height="1024" rx="224" fill="url(#shine)"/>

<!-- Subtle bottom shadow -->
<ellipse cx="512" cy="860" rx="380" ry="40" fill="black" opacity="0.25"/>

<!-- ── Fruit arrangement (2 top, 2 bottom) ──────────────── -->

<!-- Top-left: Orange -->
<circle cx="348" cy="390" r="152" fill="url(#og)"/>
<!-- Orange navel dimple -->
<circle cx="348" cy="390" r="28" fill="none" stroke="#c2410c" stroke-width="10" opacity="0.4"/>
<!-- Highlight -->
<ellipse cx="308" cy="338" rx="52" ry="38" fill="white" opacity="0.28" transform="rotate(-20 308 338)"/>

<!-- Top-right: Yellow mango -->
<circle cx="676" cy="390" r="152" fill="url(#yw)"/>
<!-- Highlight -->
<ellipse cx="636" cy="338" rx="52" ry="38" fill="white" opacity="0.28" transform="rotate(-20 636 338)"/>

<!-- Bottom-left: Red apple -->
<circle cx="348" cy="680" r="152" fill="url(#rd)"/>
<!-- Apple top indent -->
<path d="M 348 528 Q 355 518 370 522 Q 360 536 348 538 Q 336 536 326 522 Q 341 518 348 528Z" fill="#7f1d1d" opacity="0.6"/>
<!-- Stem -->
<rect x="343" y="508" width="10" height="28" rx="5" fill="#78350f"/>
<!-- Leaf on stem -->
<path d="M 353 518 Q 385 505 388 525 Q 368 530 353 518Z" fill="#16a34a"/>
<!-- Highlight -->
<ellipse cx="308" cy="628" rx="52" ry="38" fill="white" opacity="0.28" transform="rotate(-20 308 628)"/>

<!-- Bottom-right: Lime -->
<circle cx="676" cy="680" r="152" fill="url(#gn)"/>
<!-- Lime texture lines from center -->
<line x1="676" y1="528" x2="676" y2="832" stroke="#166534" stroke-width="6" opacity="0.25"/>
<line x1="524" y1="680" x2="828" y2="680" stroke="#166534" stroke-width="6" opacity="0.25"/>
<line x1="569" y1="573" x2="783" y2="787" stroke="#166534" stroke-width="5" opacity="0.18"/>
<line x1="569" y1="787" x2="783" y2="573" stroke="#166534" stroke-width="5" opacity="0.18"/>
<!-- Center circle -->
<circle cx="676" cy="680" r="30" fill="#bbf7d0" opacity="0.35"/>
<!-- Highlight -->
<ellipse cx="636" cy="628" rx="52" ry="38" fill="white" opacity="0.28" transform="rotate(-20 636 628)"/>

<!-- ── Decorative leaves top center ─────────────────────── -->
<path d="M 490 220 Q 512 168 560 175 Q 548 215 512 228 Z" fill="#16a34a" opacity="0.85"/>
<path d="M 534 220 Q 512 168 464 175 Q 476 215 512 228 Z" fill="#4ade80" opacity="0.65"/>

<!-- Center divider shine strip -->
<rect x="484" y="390" width="56" height="290" rx="28"
      fill="none" stroke="white" stroke-width="5" opacity="0.08"/>

<!-- Outer ring glow -->
<rect width="1024" height="1024" rx="224"
      fill="none" stroke="white" stroke-width="4" opacity="0.08"/>
</svg>'''

# ── 1. Render SVG → 1024×1024 PNG ────────────────────────────────────────────
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'assets')
os.makedirs(OUT_DIR, exist_ok=True)
PNG_PATH  = os.path.join(OUT_DIR, 'icon.png')
ICO_PATH  = os.path.join(OUT_DIR, 'icon.ico')
ICNS_PATH = os.path.join(OUT_DIR, 'icon.icns')

if HAS_CAIRO:
    png_bytes = cairosvg.svg2png(bytestring=SVG.encode(), output_width=1024, output_height=1024)
    img = Image.open(io.BytesIO(png_bytes)).convert('RGBA')
else:
    raise RuntimeError("cairosvg not available")

img.save(PNG_PATH)
print(f"Saved PNG  → {PNG_PATH}")

# ── 2. ICO (16,32,48,64,128,256) ─────────────────────────────────────────────
ico_sizes = [(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)]
ico_images = [img.resize(s, Image.LANCZOS) for s in ico_sizes]
ico_images[0].save(ICO_PATH, format='ICO', sizes=ico_sizes,
                   append_images=ico_images[1:])
print(f"Saved ICO  → {ICO_PATH}")

# ── 3. ICNS (Apple icon format) ───────────────────────────────────────────────
# Build a minimal ICNS manually: just the ic10 (1024×1024 PNG) chunk
# plus ic09 (512), ic08 (256), ic07 (128) so macOS is happy at all sizes.
ICNS_TYPES = [
    (b'ic10', 1024),
    (b'ic09',  512),
    (b'ic08',  256),
    (b'ic07',  128),
    (b'ic05',   72),  # Retina small (36pt@2x is non-standard, 72px works)
    (b'is32',   16),
]

def png_chunk(size_px: int) -> bytes:
    resized = img.resize((size_px, size_px), Image.LANCZOS)
    buf = io.BytesIO()
    resized.save(buf, format='PNG')
    return buf.getvalue()

chunks = []
for icon_type, size_px in ICNS_TYPES:
    data = png_chunk(size_px)
    # Each chunk: 4-byte OSType + 4-byte length (includes 8 header bytes) + data
    chunks.append(icon_type + struct.pack('>I', 8 + len(data)) + data)

body = b''.join(chunks)
icns_data = b'icns' + struct.pack('>I', 8 + len(body)) + body

with open(ICNS_PATH, 'wb') as f:
    f.write(icns_data)
print(f"Saved ICNS → {ICNS_PATH}")
print("Done ✓")
