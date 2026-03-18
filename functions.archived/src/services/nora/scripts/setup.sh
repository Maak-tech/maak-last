#!/bin/bash
# Nora AI Setup Script
# Automates environment setup for development, staging, and production

set -e

echo "🔧 Nora AI Setup Script"
echo "========================"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Please install it first:"
    echo "   npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI found"
echo ""

# Ask which environment to set up
echo "Which environment do you want to set up?"
echo "1) Development (local)"
echo "2) Staging"
echo "3) Production"
read -p "Enter choice [1-3]: " env_choice

case $env_choice in
    1)
        ENV="development"
        ;;
    2)
        ENV="staging"
        ;;
    3)
        ENV="production"
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "Setting up environment: $ENV"
echo ""

# Get OpenAI API key
read -p "Enter OpenAI API Key (or press Enter to skip): " openai_key

# Configure based on environment
if [ "$ENV" = "development" ]; then
    echo "📝 Creating .env file for local development..."
    cat > functions/.env.development << EOF
# Nora AI Configuration - Development
NORA_ENABLED=true
NORA_LLM_PROVIDER=openai
NORA_MODEL=gpt-4o-mini
NORA_TIMEOUT_MS=8000
NORA_MAX_RETRIES=2
OPENAI_API_KEY=$openai_key
EOF
    echo "✅ Created functions/.env.development"
    
elif [ "$ENV" = "staging" ] || [ "$ENV" = "production" ]; then
    # Set timeout based on environment
    if [ "$ENV" = "staging" ]; then
        TIMEOUT=8000
        RETRIES=2
    else
        TIMEOUT=10000
        RETRIES=3
    fi
    
    echo "📝 Setting Firebase Functions config..."
    firebase functions:config:set \
        nora.enabled=true \
        nora.llm_provider=openai \
        nora.model=gpt-4o-mini \
        nora.timeout_ms=$TIMEOUT \
        nora.max_retries=$RETRIES
    
    if [ -n "$openai_key" ]; then
        echo ""
        echo "📝 Setting OpenAI API Key as secret..."
        echo "$openai_key" | firebase functions:secrets:set OPENAI_API_KEY
        echo "✅ Secret set"
    else
        echo ""
        echo "⚠️  Skipped OpenAI API Key setup"
        echo "   Run manually: firebase functions:secrets:set OPENAI_API_KEY"
    fi
    
    echo "✅ Firebase config set"
fi

echo ""
echo "🎉 Setup complete for $ENV environment!"
echo ""

# Show next steps
echo "Next steps:"
echo ""

if [ "$ENV" = "development" ]; then
    echo "1. Start Firebase emulators:"
    echo "   firebase emulators:start"
    echo ""
    echo "2. Run tests:"
    echo "   npm test -- services/nora"
    echo ""
    echo "3. Test the service locally with emulators"
else
    echo "1. Deploy functions:"
    echo "   firebase deploy --only functions"
    echo ""
    echo "2. Verify deployment:"
    echo "   firebase functions:log --only nora --limit 10"
    echo ""
    echo "3. Run health check (create a test alert)"
fi

echo ""
echo "📚 Documentation:"
echo "   - README.md - Architecture & usage"
echo "   - DEPLOYMENT.md - Deployment guide"
echo "   - MIGRATION.md - API migration guide"
echo ""
