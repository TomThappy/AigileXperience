#!/bin/bash

# Pipeline Test Script
# Vollständiges Testing der Pipeline-API mit allen neuen Features

set -e

BASE_URL="http://localhost:3001"
if [ ! -z "$1" ]; then
    BASE_URL="$1"
fi

echo "🚀 Pipeline Test Script"
echo "Testing API at: $BASE_URL"
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    local expected_status=$5
    
    echo -e "\n${BLUE}🧪 Test: ${description}${NC}"
    echo -e "   ${YELLOW}${method} ${url}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\\n%{http_code}" "$BASE_URL$url" || echo -e "\n000")
    else
        response=$(curl -s -w "\\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$url" || echo -e "\n000")
    fi
    
    # Split response and status code
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "   ${GREEN}✅ SUCCESS (${status_code})${NC}"
        return 0
    else
        echo -e "   ${RED}❌ FAILED (Expected: ${expected_status}, Got: ${status_code})${NC}"
        echo -e "   ${RED}Response: ${response_body}${NC}"
        return 1
    fi
}

# Test function with JSON response validation
test_endpoint_json() {
    local method=$1
    local url=$2
    local data=$3
    local description=$4
    local expected_status=$5
    local json_key=$6
    
    echo -e "\n${BLUE}🧪 Test: ${description}${NC}"
    echo -e "   ${YELLOW}${method} ${url}${NC}"
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\\n%{http_code}" "$BASE_URL$url" || echo -e "\n000")
    else
        response=$(curl -s -w "\\n%{http_code}" -X "$method" \
            -H "Content-Type: application/json" \
            -d "$data" \
            "$BASE_URL$url" || echo -e "\n000")
    fi
    
    # Split response and status code
    status_code=$(echo "$response" | tail -n1)
    response_body=$(echo "$response" | sed '$d')
    
    if [ "$status_code" = "$expected_status" ]; then
        if [ ! -z "$json_key" ] && command -v jq &> /dev/null; then
            value=$(echo "$response_body" | jq -r ".$json_key" 2>/dev/null || echo "null")
            if [ "$value" != "null" ] && [ "$value" != "" ]; then
                echo -e "   ${GREEN}✅ SUCCESS (${status_code}) - $json_key: $value${NC}"
                # Store for later use
                if [ "$json_key" = "jobId" ]; then
                    export TEST_JOB_ID="$value"
                fi
            else
                echo -e "   ${GREEN}✅ SUCCESS (${status_code})${NC}"
            fi
        else
            echo -e "   ${GREEN}✅ SUCCESS (${status_code})${NC}"
        fi
        return 0
    else
        echo -e "   ${RED}❌ FAILED (Expected: ${expected_status}, Got: ${status_code})${NC}"
        echo -e "   ${RED}Response: ${response_body}${NC}"
        return 1
    fi
}

echo -e "\n${YELLOW}📋 Step 1: Health & Configuration Tests${NC}"
echo "=========================================="

# Test health endpoint
test_endpoint "GET" "/health" "" "Health Check" "200"

# Test config endpoint
test_endpoint_json "GET" "/api/config" "" "Configuration Check" "200" "effective_routing"

echo -e "\n${YELLOW}📋 Step 2: Job Queue Tests${NC}"
echo "================================"

# Test job creation
JOB_DATA='{
  "project_title": "AI-Enhanced Pipeline Testing Tool",
  "elevator_pitch": "We are building a revolutionary testing framework for AI pipelines that automatically validates LLM responses, tracks performance metrics, and ensures robust error handling with detailed trace analysis.",
  "language": "en",
  "target": "Pre-Seed VCs",
  "geo": "EU/DACH",
  "skip_cache": false,
  "parallel_limit": 1,
  "timeout_ms": 60000
}'

test_endpoint_json "POST" "/api/jobs" "$JOB_DATA" "Create New Job" "202" "jobId"

if [ -z "$TEST_JOB_ID" ]; then
    echo -e "${RED}❌ Failed to get job ID, stopping tests${NC}"
    exit 1
fi

echo -e "\n${BLUE}📋 Job ID for testing: ${TEST_JOB_ID}${NC}"

# Test job status
test_endpoint_json "GET" "/api/jobs/$TEST_JOB_ID" "" "Get Job Status" "200" "status"

# Test trace endpoint
test_endpoint_json "GET" "/api/jobs/$TEST_JOB_ID/trace" "" "Get Job Trace" "200" "job_id"

echo -e "\n${YELLOW}📋 Step 3: Advanced Trace Features${NC}"
echo "======================================"

# Test trace summary
test_endpoint "GET" "/api/jobs/$TEST_JOB_ID/trace/summary" "" "Get Trace Summary" "200"

# Test specific step trace (this might 404 if step doesn't exist yet)
test_endpoint "GET" "/api/jobs/$TEST_JOB_ID/trace/entries/evidence" "" "Get Evidence Step Trace" "200"

echo -e "\n${YELLOW}📋 Step 4: Queue Statistics${NC}"
echo "==============================="

# Test queue stats
test_endpoint_json "GET" "/api/jobs/stats" "" "Queue Statistics" "200" "queued"

# Test job system health
test_endpoint_json "GET" "/api/jobs/health" "" "Job System Health" "200" "status"

echo -e "\n${YELLOW}📋 Step 5: Stream Testing (Background)${NC}"
echo "============================================"

echo -e "${BLUE}Starting SSE stream test in background...${NC}"

# Start SSE stream in background and capture for 10 seconds
curl -s -N "$BASE_URL/api/jobs/$TEST_JOB_ID/stream" > "/tmp/sse_test_$TEST_JOB_ID.log" 2>&1 &
SSE_PID=$!

# Give it some time to connect
sleep 2

if ps -p $SSE_PID > /dev/null; then
    echo -e "${GREEN}✅ SSE stream connected successfully${NC}"
    
    # Wait a bit more to capture some events
    sleep 5
    
    # Check if we got any data
    if [ -s "/tmp/sse_test_$TEST_JOB_ID.log" ]; then
        echo -e "${GREEN}✅ SSE stream receiving data${NC}"
        
        # Show first few lines
        echo -e "${BLUE}Sample SSE events:${NC}"
        head -10 "/tmp/sse_test_$TEST_JOB_ID.log" | while read line; do
            echo "   $line"
        done
    else
        echo -e "${YELLOW}⚠️  SSE stream connected but no data yet${NC}"
    fi
    
    # Kill the background process
    kill $SSE_PID 2>/dev/null || true
else
    echo -e "${RED}❌ SSE stream failed to connect${NC}"
fi

echo -e "\n${YELLOW}📋 Step 6: Error Handling Tests${NC}"
echo "==================================="

# Test with missing job ID
test_endpoint "GET" "/api/jobs/nonexistent-job-id" "" "Non-existent Job" "404"

# Test with invalid job creation data
INVALID_JOB_DATA='{"project_title": ""}'
test_endpoint "POST" "/api/jobs" "$INVALID_JOB_DATA" "Invalid Job Data" "400"

# Test trace for non-existent job
test_endpoint "GET" "/api/jobs/nonexistent-job-id/trace" "" "Non-existent Job Trace" "404"

echo -e "\n${YELLOW}📋 Step 7: Artifact Testing${NC}"
echo "============================="

# Wait a bit to let some artifacts potentially be created
echo -e "${BLUE}Waiting 10 seconds for potential artifacts...${NC}"
sleep 10

# Get job status again to check for artifacts
echo -e "${BLUE}Checking for artifacts...${NC}"
response=$(curl -s "$BASE_URL/api/jobs/$TEST_JOB_ID" || echo "{}")

if command -v jq &> /dev/null; then
    artifacts=$(echo "$response" | jq -r '.artifacts // {}' 2>/dev/null)
    if [ "$artifacts" != "{}" ] && [ "$artifacts" != "null" ]; then
        echo -e "${GREEN}✅ Artifacts found${NC}"
        echo "$response" | jq '.artifacts' | head -5
        
        # Try to get first artifact
        first_artifact=$(echo "$response" | jq -r '.artifacts | keys[0] // empty' 2>/dev/null)
        if [ ! -z "$first_artifact" ]; then
            test_endpoint "GET" "/api/jobs/$TEST_JOB_ID/artifacts/$first_artifact" "" "Get First Artifact" "200"
        fi
    else
        echo -e "${YELLOW}⚠️  No artifacts found yet (this is normal for new jobs)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  jq not available, skipping artifact JSON parsing${NC}"
fi

echo -e "\n${YELLOW}📋 Step 8: Performance Metrics${NC}"
echo "=================================="

# Final job status check
final_response=$(curl -s "$BASE_URL/api/jobs/$TEST_JOB_ID" || echo "{}")
if command -v jq &> /dev/null; then
    status=$(echo "$final_response" | jq -r '.status // "unknown"' 2>/dev/null)
    progress=$(echo "$final_response" | jq -r '.progress.percentage // "unknown"' 2>/dev/null)
    echo -e "${BLUE}Final Job Status: $status${NC}"
    echo -e "${BLUE}Progress: $progress%${NC}"
fi

# Final trace check
final_trace=$(curl -s "$BASE_URL/api/jobs/$TEST_JOB_ID/trace" || echo "{}")
if command -v jq &> /dev/null; then
    entries=$(echo "$final_trace" | jq -r '.entries | length // 0' 2>/dev/null)
    errors=$(echo "$final_trace" | jq -r '.summary.errors // 0' 2>/dev/null)
    models=$(echo "$final_trace" | jq -r '.summary.models_used | keys | length // 0' 2>/dev/null)
    
    echo -e "${BLUE}Trace Entries: $entries${NC}"
    echo -e "${BLUE}Errors: $errors${NC}"
    echo -e "${BLUE}Models Used: $models${NC}"
fi

echo -e "\n${YELLOW}📋 Step 9: Cleanup${NC}"
echo "==================="

# Cleanup SSE log file
rm -f "/tmp/sse_test_$TEST_JOB_ID.log" 2>/dev/null || true

echo -e "\n${GREEN}🎉 Pipeline Test Completed!${NC}"
echo -e "${BLUE}Job ID tested: $TEST_JOB_ID${NC}"
echo -e "${YELLOW}Check the job status and trace endpoints for detailed results.${NC}"

echo -e "\n${YELLOW}💡 Useful Commands for Further Testing:${NC}"
echo "curl $BASE_URL/api/jobs/$TEST_JOB_ID | jq ."
echo "curl $BASE_URL/api/jobs/$TEST_JOB_ID/trace | jq .summary"
echo "curl $BASE_URL/api/jobs/$TEST_JOB_ID/stream"
echo "curl $BASE_URL/api/config | jq .effective_routing"
