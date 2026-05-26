#!/bin/bash
# เริ่ม Local API Server
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
echo "🚀 เริ่ม Local API Server..."
echo "📊 Web UI: http://localhost:3737"
echo "🔧 API:    http://localhost:3737/api"
echo ""
node dist/api.js
