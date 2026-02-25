#!/bin/bash

# Ensure AGENTS.md and IMPLEMENTATION_PLAN.md exist
touch AGENTS.md
touch IMPLEMENTATION_PLAN.md

echo "Ralph Loop Started. Press Ctrl+C to stop."

# Stuck loop protection variables
STUCK_THRESHOLD=3 # Reverting to original README value
stuck_count=0
TEMP_OUTPUT_FILE="/tmp/claude_output.$$" # Unique temporary file for output

while true; do
    # Capture git state before iteration
    git_hash_before=$(git rev-parse HEAD 2>/dev/null || echo "none")

    echo "========================================="
    echo "Ralph entering Planning Mode... ($(date))"
    echo "========================================="

    # Execute the AI in planning mode and capture output
    if ! claude --dangerously-skip-permissions < /app/agent/PROMPT_plan.md 2>&1 | tee "$TEMP_OUTPUT_FILE"; then
        echo "ERROR: Claude-Code (Planning) failed. Sleeping longer before retry."
        sleep 300 # Longer sleep on error
        rm -f "$TEMP_OUTPUT_FILE" # Clean up temp file
        continue
    fi
    CURRENT_ITERATION_OUTPUT+=$(cat "$TEMP_OUTPUT_FILE")

    echo "========================================="
    echo "Ralph entering Build Mode... ($(date))"
    echo "========================================="

    # Execute the AI in build mode and capture output
    if ! claude --dangerously-skip-permissions < /app/agent/PROMPT_build.md 2>&1 | tee "$TEMP_OUTPUT_FILE"; then
        echo "ERROR: Claude-Code (Build) failed. Sleeping longer before retry."
        sleep 300 # Longer sleep on error
        rm -f "$TEMP_OUTPUT_FILE" # Clean up temp file
        continue
    fi
    rm -f "$TEMP_OUTPUT_FILE" # Clean up temp file after capturing

    # Check for completion status
    if grep -q "^Status: COMPLETE" IMPLEMENTATION_PLAN.md 2>/dev/null; then
        echo "========================================="
        echo "✓ Project marked as COMPLETE in IMPLEMENTATION_PLAN.md"
        echo "All tasks finished. Exiting loop successfully."
        echo "========================================="
        exit 0
    fi

    # Capture git state after iteration
    git_hash_after=$(git rev-parse HEAD 2>/dev/null || echo "none")

    # Check if any commits were made (real work happened)
    if [ "$git_hash_before" != "$git_hash_after" ]; then
        stuck_count=0
        echo "INFO: Files changed (commit detected). Resetting stuck counter."
    else
        stuck_count=$((stuck_count + 1))
        echo "WARNING: No file changes for iteration $stuck_count of $STUCK_THRESHOLD."
    fi

    if [ "$stuck_count" -ge "$STUCK_THRESHOLD" ]; then
        echo "ERROR: Loop appears stuck (identical output $STUCK_THRESHOLD times). Exiting."
        exit 1 # Exit with an error code
    fi

    echo "========================================="
    echo "Ralph iteration complete. Sleeping for 60 seconds... ($(date))"
    echo "========================================="
    sleep 60
done
