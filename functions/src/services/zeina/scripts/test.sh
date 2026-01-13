#!/bin/bash
# Zeina AI Test Runner
# Runs tests with proper configuration

set -e

echo "🧪 Zeina AI Test Runner"
echo "======================="
echo ""

# Check if in functions directory
if [ ! -f "package.json" ]; then
    echo "❌ Must run from functions/ directory"
    exit 1
fi

# Parse arguments
TEST_TYPE="${1:-all}"
WATCH_MODE="${2:-}"

echo "Test type: $TEST_TYPE"
echo ""

case $TEST_TYPE in
    "unit")
        echo "Running unit tests..."
        npm test -- services/zeina/__tests__/guardrails.test.ts services/zeina/__tests__/outputMapper.test.ts
        ;;
    "integration")
        echo "Running integration tests..."
        npm test -- services/zeina/__tests__/integration.test.ts
        ;;
    "all")
        echo "Running all tests..."
        npm test -- services/zeina/__tests__/
        ;;
    "watch")
        echo "Running tests in watch mode..."
        npm test -- services/zeina/__tests__/ --watch
        ;;
    "coverage")
        echo "Running tests with coverage..."
        npm test -- services/zeina/__tests__/ --coverage
        ;;
    *)
        echo "❌ Invalid test type: $TEST_TYPE"
        echo ""
        echo "Usage: ./test.sh [type]"
        echo ""
        echo "Types:"
        echo "  unit        - Run unit tests only"
        echo "  integration - Run integration tests only"
        echo "  all         - Run all tests (default)"
        echo "  watch       - Run tests in watch mode"
        echo "  coverage    - Run tests with coverage report"
        exit 1
        ;;
esac

echo ""
echo "✅ Tests complete!"
