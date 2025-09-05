#!/bin/bash

# Test the config debug endpoint
echo "🔧 Testing Config Debug Endpoint..."
echo "======================================="

# Test both local and production endpoints
echo "Testing local endpoint:"
curl -s "http://localhost:3000/api/config" 2>/dev/null | jq . || echo "Local endpoint not available"

echo "
Testing production endpoint:"
curl -s "https://aigilexperience-backend.onrender.com/api/config" | jq .

echo ""
echo "✅ Config endpoint test complete"
echo "If you see JSON configuration above, the endpoint is working correctly."
echo ""
echo "Key things to check:"
echo "- effective_routing shows model resolution"
echo "- step_models shows all LLM_MODEL_* env vars"
echo "- api_config shows masked API keys"
echo "- rate_gate shows RateGate configuration"
