#!/bin/bash
# ─────────────────────────────────────────────────────────────
#  FruitBiz — ติดตั้ง dependencies และ build Electron app
#  ใช้ครั้งแรกหลัง clone หรือเมื่อ node_modules หาย
# ─────────────────────────────────────────────────────────────
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "x.x.x")

echo "📦 FruitBiz v${VERSION} — ติดตั้ง dependencies..."
npm install --ignore-scripts

echo ""
echo "⬇️  ดาวน์โหลด Electron binary..."
node ./node_modules/electron/install.js

echo ""
echo "🔧 Build better-sqlite3 สำหรับ Electron..."
npx @electron/rebuild -f -w better-sqlite3

echo ""
echo "🔨 Build TypeScript..."
npm run build

echo ""
echo "✅ Setup เสร็จแล้ว! เลือกสิ่งที่ต้องการ:"
echo ""
echo "  ทดลองรัน (dev mode):"
echo "  ────────────────────────────────────────"
echo "  npm run electron"
echo ""
echo "  Build ไฟล์ติดตั้ง (release ด้วยตัวเอง):"
echo "  ────────────────────────────────────────"
echo "  Windows installer:  npm run dist:win"
echo "  → release/FruitBiz Setup ${VERSION}.exe"
echo ""
echo "  Windows portable:   npx electron-builder --win portable"
echo "  → release/FruitBiz ${VERSION}.exe"
echo ""
echo "  macOS DMG:          npm run dist:mac"
echo "  → release/FruitBiz-${VERSION}.dmg"
echo ""
echo "  ─── หรือ release ขึ้น GitHub (แนะนำ) ───────────────────"
echo "  bash release.sh ${VERSION}"
echo "  → GitHub Actions จะ build + upload ให้อัตโนมัติ"
echo "  → auto-update จะทำงานสำหรับ user ที่ใช้งานอยู่"
echo ""
