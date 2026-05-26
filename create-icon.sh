#!/bin/bash
# ─────────────────────────────────────────────
#  LocalBiz — สร้างไฟล์ icon สำหรับ macOS และ Windows
# ─────────────────────────────────────────────
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

mkdir -p assets

echo "🎨 สร้าง PNG icon (512x512)..."
python3 - << 'PYEOF'
import struct, zlib, math

def make_chunk(t, d):
    return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)

W = H = 512
bg   = (10,  15,  30)   # dark navy
acc  = (56, 139, 253)   # blue accent
txt  = (255, 255, 255)  # white

def lerp(a, b, t): return int(a + (b - a) * t)

pixels = []
for y in range(H):
    row = bytearray([0])  # filter = none
    for x in range(W):
        nx = x / W
        ny = y / H

        # rounded-rect mask (radius = 22%)
        r  = 0.22
        cx = max(r, min(1 - r, nx))
        cy = max(r, min(1 - r, ny))
        dist = math.hypot(nx - cx, ny - cy)
        inside = dist <= r

        if not inside:
            row += bytes([0, 0, 0, 0])   # transparent outside
            continue

        # gradient background
        t = ny * 0.6 + nx * 0.4
        pr = lerp(bg[0], acc[0] // 3, t)
        pg = lerp(bg[1], acc[1] // 3, t)
        pb = lerp(bg[2], acc[2] // 3, t)

        # draw "LB" letters (pixel font, centered)
        lx = int(nx * W)
        ly = int(ny * H)

        # Letter L  (x 155–195, y 175–340)
        in_L = (155 <= lx <= 175 and 175 <= ly <= 340) or \
               (155 <= lx <= 210 and 320 <= ly <= 340)

        # Letter B  (x 225–265, y 175–340)
        bx = lx - 225
        by = ly - 175
        top_bulge    = (0 <= bx <= 40 and 0  <= by <= 20) or \
                       (35 <= bx <= 55 and 0  <= by <= 80 and math.hypot(bx - 35, by - 82) < 43)
        mid_bar      = (0 <= bx <= 40 and 78 <= by <= 98)
        bot_bulge    = (0 <= bx <= 40 and 95 <= by <= 165) or \
                       (35 <= bx <= 60 and 82 <= by <= 165 and math.hypot(bx - 35, by - 122) < 50)
        stem_B       = (0 <= bx <= 20 and 0  <= by <= 165)
        in_B = top_bulge or mid_bar or bot_bulge or stem_B

        if in_L or in_B:
            row += bytes([txt[0], txt[1], txt[2], 255])
        else:
            row += bytes([pr, pg, pb, 255])
    pixels.append(bytes(row))

raw  = b''.join(pixels)
comp = zlib.compress(raw, 9)
ihdr = make_chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))  # RGBA
idat = make_chunk(b'IDAT', comp)
iend = make_chunk(b'IEND', b'')
png  = b'\x89PNG\r\n\x1a\n' + ihdr + idat + iend

with open('assets/icon.png', 'wb') as f:
    f.write(png)
print('  ✅ assets/icon.png')
PYEOF

# ── macOS .icns ───────────────────────────────
echo "🍎 สร้าง icon.icns สำหรับ macOS..."
mkdir -p assets/icon.iconset
for S in 16 32 128 256 512; do
    sips -z $S $S assets/icon.png --out "assets/icon.iconset/icon_${S}x${S}.png"      > /dev/null
    sips -z $((S*2)) $((S*2)) assets/icon.png --out "assets/icon.iconset/icon_${S}x${S}@2x.png" > /dev/null
done
iconutil -c icns assets/icon.iconset -o assets/icon.icns
rm -rf assets/icon.iconset
echo "  ✅ assets/icon.icns"

# ── Windows .ico ──────────────────────────────
echo "🪟 สร้าง icon.ico สำหรับ Windows..."
python3 - << 'PYEOF'
import struct, zlib, subprocess, sys, os

# create sized PNGs via sips then embed into ICO
sizes = [16, 32, 48, 64, 128, 256]
pngs  = []
for s in sizes:
    out = f'assets/icon_{s}.png'
    subprocess.run(['sips', '-z', str(s), str(s), 'assets/icon.png', '--out', out],
                   capture_output=True)
    with open(out, 'rb') as f:
        pngs.append(f.read())
    os.remove(out)

# ICO header
n = len(sizes)
ico_header = struct.pack('<HHH', 0, 1, n)
offset = 6 + 16 * n
entries = b''
data    = b''
for i, (s, png) in enumerate(zip(sizes, pngs)):
    w = 0 if s == 256 else s
    entries += struct.pack('<BBBBHHII', w, w, 0, 0, 1, 32, len(png), offset)
    offset  += len(png)
    data    += png

with open('assets/icon.ico', 'wb') as f:
    f.write(ico_header + entries + data)
print('  ✅ assets/icon.ico')
PYEOF

echo ""
echo "✅ สร้าง icon เสร็จแล้ว!"
echo "   assets/icon.icns  ← macOS"
echo "   assets/icon.ico   ← Windows"
