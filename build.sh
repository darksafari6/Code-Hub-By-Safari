#!/bin/bash
set -e

echo "🏗️ Building Safari AI Dev Studio for Zorin OS (.deb)..."

# Build the frontend
echo "📦 Building frontend..."
npm run build

# Build the backend server
echo "📦 Building backend..."
npx esbuild server.ts --bundle --platform=node --target=node18 --outfile=dist/server.js --external:express --external:ws --external:node-pty --external:@google/genai

# Build the Electron app
echo "📦 Packaging .deb file..."
npx electron-builder --linux deb

echo "✅ Build complete! Check the 'dist' folder for your .deb package."
