#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
#  FruitBiz — ปล่อย version ใหม่ (GitHub Actions จะ build ให้อัตโนมัติ)
#
#  วิธีใช้:
#    bash release.sh 1.3.0
#
#  สคริปต์จะ:
#    1. commit การเปลี่ยนแปลงทั้งหมดที่ยังค้างอยู่
#    2. bump version ใน package.json
#    3. commit "chore: release vX.X.X" + tag + push
#
#  GitHub Actions จะ build อัตโนมัติ:
#    - Windows installer  (.exe — ใช้ติดตั้ง + auto-update)
#    - Windows portable   (.exe — รันตรงไม่ติดตั้ง)
#    - macOS DMG          (.dmg)
# ─────────────────────────────────────────────────────────────────────
set -e

NEW_VERSION="$1"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [ -z "$NEW_VERSION" ]; then
  echo "❌  ระบุเวอร์ชั่นด้วย เช่น: bash release.sh 1.3.1"
  exit 1
fi

OLD_VERSION=$(node -p "require('./package.json').version")
echo "📦  v${OLD_VERSION} → v${NEW_VERSION}"

# ── commit การเปลี่ยนแปลงที่ยังค้างอยู่ก่อน ─────────────────────────
if ! git diff --quiet HEAD 2>/dev/null || [ -n "$(git status --porcelain)" ]; then
  echo "📝  มีการเปลี่ยนแปลงที่ยังไม่ได้ commit — กำลัง commit..."
  git add -A
  git commit -m "feat: changes for v${NEW_VERSION}"
fi

# ── bump version ──────────────────────────────────────────────────────
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✅  package.json → v$NEW_VERSION');
"

# ── release commit + tag + push ───────────────────────────────────────
git add package.json
git commit -m "chore: release v${NEW_VERSION}"
git tag "v${NEW_VERSION}"
git push origin main
git push origin "v${NEW_VERSION}"

echo ""
echo "🚀  Push tag v${NEW_VERSION} แล้ว — GitHub Actions กำลัง build..."
echo "    ดูผลได้ที่: https://github.com/suphasin01/fruit/actions"
echo ""
echo "    เมื่อ build เสร็จ (~8 นาที) ไฟล์จะอยู่ที่:"
echo "    https://github.com/suphasin01/fruit/releases/tag/v${NEW_VERSION}"
echo ""
echo "    ไฟล์ที่จะได้:"
echo "    - FruitBiz Setup ${NEW_VERSION}.exe   (Windows installer + auto-update)"
echo "    - FruitBiz ${NEW_VERSION}.exe          (Windows portable)"
echo "    - FruitBiz-${NEW_VERSION}.dmg           (macOS)"
echo ""
echo "    แอพของ user จะเห็นอัพเดทอัตโนมัติภายใน 4 ชั่วโมง"
