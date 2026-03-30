#!/bin/bash
set -e

echo "🚀 Setting up Safari AI Dev Studio for Zorin OS..."

# Install system dependencies
echo "📦 Installing system dependencies..."
sudo apt-get update || echo "Skipping apt-get update (requires root)"
sudo apt-get install -y curl git build-essential dpkg fakeroot || echo "Skipping apt-get install (requires root)"

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install project dependencies
echo "📦 Installing npm dependencies..."
npm install

# Make scripts executable
chmod +x run.sh build.sh

echo "✅ Setup complete! Run ./run.sh to start the studio."
