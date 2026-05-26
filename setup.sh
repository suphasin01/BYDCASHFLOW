#!/bin/bash
# ============================================================
#  Local API — ติดตั้งและ build
# ============================================================

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "📦 Local API Setup"
echo "Directory: $DIR"
echo ""

# ลบ node_modules เก่า (ถ้ามี)
if [ -d "node_modules" ]; then
  echo "🧹 ลบ node_modules เก่า..."
  rm -rf node_modules
fi

# ติดตั้ง dependencies
echo "📥 ติดตั้ง dependencies..."
npm install
if [ $? -ne 0 ]; then
  echo "❌ npm install ล้มเหลว"
  exit 1
fi

# Build TypeScript
echo "🔨 Build TypeScript..."
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build ล้มเหลว"
  exit 1
fi

echo ""
echo "✅ Setup เสร็จแล้ว!"
echo ""
echo "วิธีใช้:"
echo "  เริ่ม API Server:  node dist/api.js"
echo "  เปิด Web UI:       http://localhost:3737"
echo ""
echo "สำหรับ Claude Desktop:"
echo "  เพิ่ม config ใน claude_desktop_config.json ดูไฟล์ claude_local_config.json"
