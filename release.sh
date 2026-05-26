#!/bin/bash
# ─────────────────────────────────────────────────────────────────────
#  LocalBiz — ปล่อย version ใหม่ (GitHub Actions จะ build ให้อัตโนมัติ)
#
#  วิธีใช้:
#    bash release.sh 1.1.0
#
#  GitHub Actions จะ build Windows .exe และ macOS .dmg ให้อัตโนมัติ
#  ดูผล build ได้ที่: https://github.com/suphasin01/fruit/actions
# ─────────────────────────────────────────────────────────────────────
set -e

NEW_VERSION="$1"
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

if [ -z "$NEW_VERSION" ]; then
  echo "❌  ระบุเวอร์ชั่นด้วย เช่น: bash release.sh 1.1.0"
  exit 1
fi

OLD_VERSION=$(node -p "require('./package.json').version")
echo "📦  อัพเดท v${OLD_VERSION} → v${NEW_VERSION}"

# ── bump version ──────────────────────────────────────────────────────
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json','utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✅  package.json updated');
"

# ── commit + tag + push ───────────────────────────────────────────────
git add package.json
git commit -m "chore: release v${NEW_VERSION}"
git tag "v${NEW_VERSION}"
git push origin main
git push origin "v${NEW_VERSION}"

echo ""
echo "🚀  Pushed tag v${NEW_VERSION} — GitHub Actions กำลัง build..."
echo "    ดูผลได้ที่: https://github.com/suphasin01/fruit/actions"
echo ""
echo "    เมื่อ build เสร็จ (~5 นาที) ไฟล์จะอยู่ที่:"
echo "    https://github.com/suphasin01/fruit/releases/tag/v${NEW_VERSION}"
echo ""
echo "    แอพของ user จะเห็นอัพเดทอัตโนมัติภายใน 4 ชั่วโมง"
