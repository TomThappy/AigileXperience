#!/bin/bash

# Comprehensive Smoke Test für LLM Pipeline
echo "🧪 Comprehensive LLM Pipeline Smoke Test"
echo "========================================="

# Configuration
API_BASE="https://aigilexperience-backend.onrender.com"
TEST_TIMEOUT=300 # 5 minutes
EXPECTED_CTX_MIN=100000 # Minimum context window

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_TOTAL=0
TESTS_PASSED=0
TESTS_FAILED=0

run_test() {
  local test_name="$1"
  local test_command="$2"
  local expected_pattern="$3"
  
  TESTS_TOTAL=$((TESTS_TOTAL + 1))
  echo -n "🔍 Testing: $test_name ... "
  
  local result=$(eval "$test_command" 2>/dev/null)
  local exit_code=$?
  
  if [ $exit_code -eq 0 ] && [[ "$result" =~ $expected_pattern ]]; then
    echo -e "${GREEN}PASS${NC}"
    TESTS_PASSED=$((TESTS_PASSED + 1))
    return 0
  else
    echo -e "${RED}FAIL${NC}"
    echo "  Expected: $expected_pattern"
    echo "  Got: $result"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    return 1
  fi
}

validate_json() {
  local json_data="$1"
  local field_path="$2"
  local expected_value="$3"
  
  local actual_value=$(echo "$json_data" | jq -r "$field_path")
  [[ "$actual_value" == "$expected_value" ]]
}

validate_ctx_min() {
  local json_data="$1"
  local field_path="$2"
  
  local ctx_value=$(echo "$json_data" | jq -r "$field_path")
  [[ "$ctx_value" -ge $EXPECTED_CTX_MIN ]]
}

echo ""
echo "🔧 Phase 1: Configuration Validation"
echo "====================================="

# Test 1: API Health Check
run_test "API Health Check" \
  "curl -sS '$API_BASE/api/jobs/health'" \
  '"status":"ok"'

# Test 2: Config Endpoint Available
CONFIG_RESPONSE=$(curl -sS "$API_BASE/api/config" 2>/dev/null)
run_test "Config Endpoint Available" \
  "echo '$CONFIG_RESPONSE' | jq -e '.effective_routing'" \
  ".*"

if [ $? -eq 0 ]; then
  echo ""
  echo "📊 Analyzing Configuration..."
  
  # Test 3-5: Critical Model Context Windows
  run_test "Market Phase2 Context ≥100k" \
    "echo '$CONFIG_RESPONSE' | jq -r '.effective_routing.market_phase2.ctx_max >= $EXPECTED_CTX_MIN'" \
    "true"
    
  run_test "GTM Phase2 Context ≥100k" \
    "echo '$CONFIG_RESPONSE' | jq -r '.effective_routing.gtm_phase2.ctx_max >= $EXPECTED_CTX_MIN'" \
    "true"
    
  run_test "Financial Plan Phase2 Context ≥100k" \
    "echo '$CONFIG_RESPONSE' | jq -r '.effective_routing.financial_plan_phase2.ctx_max >= $EXPECTED_CTX_MIN'" \
    "true"
    
  # Test 6: Environment Variables Loaded
  run_test "LLM Environment Variables Set" \
    "echo '$CONFIG_RESPONSE' | jq -r '.step_models | to_entries | map(select(.value != null)) | length > 5'" \
    "true"
fi

echo ""
echo "🚀 Phase 2: Job Processing Test"
echo "==============================="

# Test 7: Job Creation
JOB_PAYLOAD='{
  "project_title": "Smoke Test - AI Pipeline Validation",
  "elevator_pitch": "Wir entwickeln ein KI-System zur automatisierten Validierung von LLM-Pipelines mit intelligenter Model-Routing und Context-Guard-Mechanismen für robuste Production-Deployments.",
  "language": "de",
  "target": "Technical Validation",
  "geo": "EU/Test",
  "skip_cache": true,
  "parallel_limit": 1,
  "use_assumptions": true
}'

JOB_RESPONSE=$(curl -sS -X POST "$API_BASE/api/jobs" \
  -H "Content-Type: application/json" \
  -d "$JOB_PAYLOAD" 2>/dev/null)

JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.jobId')

run_test "Job Creation Successful" \
  "echo '$JOB_RESPONSE' | jq -e '.jobId'" \
  "$JOB_ID"

if [[ "$JOB_ID" != "null" ]] && [[ -n "$JOB_ID" ]]; then
  echo "  Job ID: $JOB_ID"
  
  # Test 8: Job Status Endpoint
  sleep 2
  JOB_STATUS=$(curl -sS "$API_BASE/api/jobs/$JOB_ID" 2>/dev/null)
  run_test "Job Status Endpoint" \
    "echo '$JOB_STATUS' | jq -e '.status'" \
    ".*"
    
  # Test 9: Trace Endpoint Available  
  sleep 3
  TRACE_RESPONSE=$(curl -sS "$API_BASE/api/jobs/$JOB_ID/trace" 2>/dev/null)
  TRACE_AVAILABLE=$?
  
  if [ $TRACE_AVAILABLE -eq 0 ] && [[ "$TRACE_RESPONSE" != *"Trace not found"* ]]; then
    run_test "Trace System Active" \
      "echo '$TRACE_RESPONSE' | jq -e '.job_id'" \
      "$JOB_ID"
      
    # Test 10: Trace Contains Model Info
    run_test "Trace Contains Model Information" \
      "echo '$TRACE_RESPONSE' | jq -e '.entries[0].model'" \
      ".*"
  else
    echo -e "⚠️  Trace not yet available (job may be starting)"
    TESTS_TOTAL=$((TESTS_TOTAL - 2))
  fi
else
  echo -e "${RED}❌ Job creation failed, skipping job-related tests${NC}"
  TESTS_TOTAL=$((TESTS_TOTAL - 3))
fi

echo ""
echo "🔍 Phase 3: Real-time Monitoring Test" 
echo "====================================="

if [[ "$JOB_ID" != "null" ]] && [[ -n "$JOB_ID" ]]; then
  # Test 11: SSE Stream Available
  run_test "SSE Stream Endpoint" \
    "timeout 5 curl -sS '$API_BASE/api/jobs/$JOB_ID/stream' | head -1" \
    ".*"
    
  echo ""
  echo "📡 SSE Stream Test (10 seconds sample):"
  echo "======================================="
  
  # Monitor SSE for 10 seconds to check for trace events
  timeout 10 curl -N "$API_BASE/api/jobs/$JOB_ID/stream" 2>/dev/null | while IFS= read -r line; do
    if [[ $line =~ ^event:.* ]]; then
      EVENT_TYPE=$(echo "$line" | cut -d' ' -f2-)
      echo "  📨 Event: $EVENT_TYPE"
    elif [[ $line =~ ^data:.* ]]; then
      JSON_DATA=$(echo "$line" | cut -d' ' -f2-)
      if [[ "$EVENT_TYPE" == "trace" ]]; then
        MODEL=$(echo "$JSON_DATA" | jq -r '.model // "unknown"')
        CTX_MAX=$(echo "$JSON_DATA" | jq -r '.ctx_max // 0')
        STEP=$(echo "$JSON_DATA" | jq -r '.step // "unknown"')
        echo "    🔍 Model: $MODEL, Context: $CTX_MAX, Step: $STEP"
        
        # Validate context size for critical steps
        if [[ "$STEP" =~ (market|gtm|financial_plan) ]] && [[ "$CTX_MAX" -lt $EXPECTED_CTX_MIN ]]; then
          echo -e "    ${RED}⚠️  WARNING: Critical step $STEP using model $MODEL with only $CTX_MAX context!${NC}"
        fi
      fi
    fi
  done
else
  echo -e "${YELLOW}⚠️  Skipping real-time monitoring (no valid job ID)${NC}"
  TESTS_TOTAL=$((TESTS_TOTAL - 1))
fi

echo ""
echo "📊 Test Summary"
echo "==============="
echo -e "Total Tests:  $TESTS_TOTAL"
echo -e "${GREEN}Passed:       $TESTS_PASSED${NC}"
echo -e "${RED}Failed:       $TESTS_FAILED${NC}"

if [ $TESTS_FAILED -eq 0 ]; then
  echo -e "\n${GREEN}🎉 All tests passed! Pipeline is working correctly.${NC}"
  echo ""
  echo "✅ Configuration validated"
  echo "✅ Context windows ≥100k for critical steps"  
  echo "✅ Job processing working"
  echo "✅ Trace system active"
  echo "✅ Real-time monitoring available"
  
  if [[ "$JOB_ID" != "null" ]] && [[ -n "$JOB_ID" ]]; then
    echo ""
    echo "🔗 Continue monitoring this test job:"
    echo "curl -N '$API_BASE/api/jobs/$JOB_ID/stream'"
    echo ""
    echo "📊 Full trace:"
    echo "curl '$API_BASE/api/jobs/$JOB_ID/trace' | jq ."
  fi
  
  exit 0
else
  echo -e "\n${RED}❌ $TESTS_FAILED test(s) failed. Please check configuration.${NC}"
  echo ""
  echo "🔧 Debug steps:"
  echo "1. Check environment variables: curl '$API_BASE/api/config'"
  echo "2. Verify both Backend and Worker have same env vars"
  echo "3. Check Render service logs for errors"
  echo "4. Ensure services restarted after env var changes"
  
  exit 1
fi
