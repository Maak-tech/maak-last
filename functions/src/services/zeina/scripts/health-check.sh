#!/bin/bash
# Zeina AI Health Check Script
# Performs health check on deployed service

set -e

echo "🏥 Zeina AI Health Check"
echo "========================"
echo ""

# Parse arguments
ENV="${1:-staging}"

case $ENV in
    "staging"|"production"|"local")
        ;;
    *)
        echo "❌ Invalid environment: $ENV"
        echo "Usage: ./health-check.sh [environment]"
        echo "Environments: local, staging, production"
        exit 1
        ;;
esac

echo "Environment: $ENV"
echo ""

# Check recent logs
echo "📋 Checking recent logs..."
firebase functions:log --only zeina --limit 20

echo ""
echo "📊 Checking for errors..."
ERROR_COUNT=$(firebase functions:log --only zeina --limit 100 --filter "severity>=ERROR" | wc -l)
echo "Recent errors (last 100 logs): $ERROR_COUNT"

if [ $ERROR_COUNT -gt 10 ]; then
    echo "⚠️  WARNING: High error count detected!"
else
    echo "✅ Error count within acceptable range"
fi

echo ""
echo "🔍 Service Status:"
echo "- Check metrics in Cloud Console"
echo "- Review recent alerts in Firestore"
echo "- Verify Zeina analysis is running"
echo ""

if [ "$ENV" = "production" ]; then
    echo "⚠️  PRODUCTION: Monitor closely for the next 24 hours"
fi

echo ""
echo "📚 For detailed monitoring, see:"
echo "   - DEPLOYMENT.md § Monitoring Setup"
echo "   - monitoring.ts for health check API"
