#!/bin/bash

# OmniScript Backend Deployment to Hugging Face Spaces
# Usage: ./deploy-to-hf.sh

set -e

echo "🚀 OmniScript Backend Deployment to Hugging Face Spaces"
echo "========================================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if SSH key is configured
echo "📋 Checking SSH configuration..."
if [ ! -f ~/.ssh/huggingface_ed25519 ]; then
    echo -e "${RED}❌ SSH key not found!${NC}"
    echo "Please run the SSH key generation first."
    exit 1
fi

echo -e "${GREEN}✓ SSH key found${NC}"
echo ""

# Check if space directory exists
SPACE_DIR="omniScript-space"

if [ -d "$SPACE_DIR" ]; then
    echo -e "${YELLOW}⚠️  Space directory already exists. Removing...${NC}"
    rm -rf "$SPACE_DIR"
fi

# Clone the space
echo "📥 Cloning Hugging Face Space..."
git clone git@hf.co:spaces/Vidhitts/omniScript "$SPACE_DIR"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to clone space. Please check:${NC}"
    echo "  1. SSH key is added to Hugging Face"
    echo "  2. Space exists at https://huggingface.co/spaces/Vidhitts/omniScript"
    exit 1
fi

echo -e "${GREEN}✓ Space cloned${NC}"
echo ""

# Copy backend files
echo "📦 Copying backend files..."
cd "$SPACE_DIR"

# Copy essential files
cp -r ../backend/src ./src
cp -r ../backend/prisma ./prisma
cp ../backend/package.json ./package.json
cp ../backend/tsconfig.json ./tsconfig.json
cp ../backend/Dockerfile ./Dockerfile
cp ../backend/.dockerignore ./.dockerignore
cp ../backend/README.md ./README.md

# Copy config files if they don't exist
[ ! -f .gitignore ] && cp ../backend/.gitignore ./.gitignore || true

echo -e "${GREEN}✓ Files copied${NC}"
echo ""

# Create .env.example
echo "📝 Creating .env.example..."
cat > .env.example << 'EOF'
# Database
DATABASE_URL=postgresql://user:password@host:5432/omniscript

# Redis
REDIS_URL=redis://host:6379

# MongoDB
MONGODB_URI=mongodb://host:27017/omniscript

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# API Keys
GROQ_API_KEY=gsk_your_groq_api_key
COHERE_API_KEY=your_cohere_api_key

# Server
PORT=7860
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-url.com
EOF

echo -e "${GREEN}✓ .env.example created${NC}"
echo ""

# Git operations
echo "📤 Committing and pushing to Hugging Face..."
git add .
git commit -m "Deploy OmniScript backend with Docker

- Added Dockerfile for containerized deployment
- Configured for Hugging Face Spaces (port 7860)
- Includes health check endpoint
- Production-ready with security headers
- Context compression for token optimization"

echo ""
echo -e "${YELLOW}⚠️  Ready to push. This will deploy to Hugging Face Spaces.${NC}"
echo -e "${YELLOW}   Make sure you have set all environment variables in Space settings!${NC}"
echo ""
read -p "Continue with push? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    git push origin main
    
    echo ""
    echo -e "${GREEN}✅ Deployment initiated!${NC}"
    echo ""
    echo "📊 Monitor your deployment:"
    echo "   https://huggingface.co/spaces/Vidhitts/omniScript"
    echo ""
    echo "🔧 Next steps:"
    echo "   1. Go to Space settings and add environment variables"
    echo "   2. Wait for build to complete (5-10 minutes)"
    echo "   3. Test health endpoint: https://vidhitts-omniscript.hf.space/health"
    echo "   4. Run database migrations if needed"
    echo ""
else
    echo -e "${YELLOW}Deployment cancelled. Files are ready in $SPACE_DIR${NC}"
    echo "You can manually push when ready: cd $SPACE_DIR && git push origin main"
fi

cd ..
