#!/bin/bash

# Test SSE streaming with trace events
echo "📡 Testing Server-Sent Events Stream..."
echo "========================================"

if [ -z "$1" ]; then
  echo "Usage: $0 <JOB_ID>"
  echo "Example: $0 job_12345"
  echo ""
  echo "To get a job ID, run: ./test-job-with-trace.sh"
  exit 1
fi

JOB_ID="$1"
echo "Connecting to SSE stream for job: $JOB_ID"
echo "Press Ctrl+C to stop monitoring"
echo ""

# Connect to SSE stream and format output
curl -N "http://localhost:3000/api/jobs/$JOB_ID/stream" | while IFS= read -r line; do
  if [[ $line =~ ^event:.*$ ]]; then
    # Extract event type
    EVENT_TYPE=$(echo "$line" | cut -d' ' -f2-)
    echo "🔔 EVENT: $EVENT_TYPE"
  elif [[ $line =~ ^data:.*$ ]]; then
    # Extract and format JSON data
    JSON_DATA=$(echo "$line" | cut -d' ' -f2-)
    case $EVENT_TYPE in
      "status")
        echo "  📊 Status Update:"
        echo "    $JSON_DATA" | jq '{status: .status, progress: .progress}'
        ;;
      "trace")
        echo "  🔍 Trace Event:"
        echo "    $JSON_DATA" | jq '{step: .step, phase: .phase, model: .model, context_window: .context_window, estimated_tokens: .estimated_tokens, status: .status}'
        ;;
      "trace-summary")
        echo "  📈 Final Trace Summary:"
        echo "    $JSON_DATA" | jq .
        ;;
      "result")
        echo "  ✅ Final Result Available"
        ;;
      "error")
        echo "  ❌ Error:"
        echo "    $JSON_DATA" | jq '.message'
        ;;
      "done")
        echo "  🏁 Job Complete:"
        echo "    $JSON_DATA" | jq '.status'
        echo ""
        echo "Stream ended. Job processing complete."
        break
        ;;
      *)
        echo "  📄 $EVENT_TYPE:"
        echo "    $JSON_DATA" | jq .
        ;;
    esac
    echo ""
  fi
done
