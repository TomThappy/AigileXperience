#!/bin/bash
set -e

echo "🚀 Starting Render build for backend worker..."
echo "📍 Current directory: $(pwd)"
echo "📂 Directory contents:"
ls -la

echo "🔍 Node.js version: $(node --version)"
echo "📦 NPM version: $(npm --version)"

echo "🔧 Installing root dependencies..."
cd /opt/render/project/src
npm ci --include=dev

echo "🔧 Building common package..."
cd packages/common
npm ci --include=dev
npm run build

echo "🔧 Installing backend dependencies..."
cd ../../apps/backend
npm ci --include=dev

echo "📋 Backend package.json dependencies:"
cat package.json | grep -A 20 '"dependencies"'

echo "📋 Backend package.json devDependencies:"
cat package.json | grep -A 10 '"devDependencies"'

echo "🏗️ Building backend..."
npm run build

echo "✅ Build completed successfully!"
echo "📄 Generated files:"
ls -la dist/

echo "✅ Worker.js exists:"
ls -la dist/worker.js
