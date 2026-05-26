#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  LocalBiz — ติดตั้ง และ build Electron app
# ─────────────────────────────────────────────────────────────
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "📦 ติดตั้ง dependencies (ข้าม native compile เพื่อหลีกเลี่ยงปัญหา path/C++20)..."
npm install --ignore-scripts

echo ""
echo "⬇️  ดาวน์โหลด Electron binary..."
node ./node_modules/electron/install.js

echo ""
echo "🔧 Build better-sqlite3 สำหรับ Electron 34 (ต้องการ C++20)..."
CXXFLAGS="-std=c++20" npx @electron/rebuild -f -w better-sqlite3

echo ""
echo "🔨 Build TypeScript..."
npm run build

echo ""
echo "✅ พร้อมแล้ว! เลือกสิ่งที่ต้องการ:"
echo ""
echo "  ทดลองรัน (เปิด window ทันที):"
echo "  ─────────────────────────────"
echo "  npx electron ."
echo ""
echo "  Build .app สำหรับ macOS:"
echo "  ─────────────────────────────"
echo "  npm run dist:mac"
echo "  → ไฟล์อยู่ที่ release/LocalBiz-1.0.0.dmg"
echo ""
echo "  Build .exe สำหรับ Windows:"
echo "  ─────────────────────────────"
echo "  npm run dist:win"
echo "  → ไฟล์อยู่ที่ release/LocalBiz Setup 1.0.0.exe"
echo ""
