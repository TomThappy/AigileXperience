#!/bin/bash

# Test job creation and tracing
echo "🚀 Testing Job Creation and Trace System..."
echo "============================================="

# Determine API base URL
API_BASE="https://aigilexperience-backend.onrender.com"
if curl -s "http://localhost:3000/api/jobs/health" > /dev/null 2>&1; then
  API_BASE="http://localhost:3000"
  echo "Using local API endpoint"
else
  echo "Using production API endpoint"
fi

# Create a test job
echo "Creating test job..."
JOB_RESPONSE=$(curl -s -X POST "$API_BASE/api/jobs" \
  -H "Content-Type: application/json" \
  -d '{
    "project_title": "HappyNest - AI Smart Home Platform",
    "elevator_pitch": "HappyNest ist das digitale Zuhause für intelligente Wohnungssteuerung. Unsere KI-Platform lernt die Gewohnheiten der Bewohner und optimiert automatisch Energie, Sicherheit und Komfort durch nahtlose Integration aller Smart-Home-Geräte.",
    "language": "de",
    "target": "Pre-Seed/Seed VCs",
    "geo": "EU/DACH",
    "skip_cache": true,
    "parallel_limit": 1,
    "use_assumptions": true
  }')

echo "Job response: $JOB_RESPONSE"

# Extract job ID
JOB_ID=$(echo "$JOB_RESPONSE" | jq -r '.jobId')

if [ "$JOB_ID" = "null" ] || [ -z "$JOB_ID" ]; then
  echo "❌ Failed to create job. Response: $JOB_RESPONSE"
  exit 1
fi

echo "✅ Job created with ID: $JOB_ID"
echo ""

# Check job status
echo "📊 Checking job status..."
curl -s "$API_BASE/api/jobs/$JOB_ID" | jq .
echo ""

# Wait a moment for the job to start processing
echo "⏳ Waiting for job to start processing..."
sleep 3

# Check for trace data
echo "🔍 Checking trace data..."
TRACE_RESPONSE=$(curl -s "$API_BASE/api/jobs/$JOB_ID/trace")
echo "Trace response: $TRACE_RESPONSE"

if [ "$TRACE_RESPONSE" = '{"error":"Trace not found","message":"No trace found for job '$JOB_ID'"}' ]; then
  echo "ℹ️  No trace data yet (job may still be initializing)"
else
  echo "✅ Trace data found!"
  echo "$TRACE_RESPONSE" | jq .
fi

echo ""
echo "🔴 To monitor job in real-time, run:"
echo "curl -N \"$API_BASE/api/jobs/$JOB_ID/stream\""
echo ""
echo "🔍 To check trace again later, run:"
echo "curl \"$API_BASE/api/jobs/$JOB_ID/trace\" | jq ."
echo ""
echo "API Base URL: $API_BASE"
