#!/bin/bash

# Parse flags
USE_GEMINI=false
for arg in "$@"; do
    if [ "$arg" = "--gemini" ]; then
        USE_GEMINI=true
    fi
done

# Set AI command
if [ "$USE_GEMINI" = true ]; then
    AI_CMD="gemini --yolo"
    echo "Using Gemini CLI"
else
    AI_CMD="$AI_CMD"
    echo "Using Claude Code"
fi

# Ensure AGENTS.md and IMPLEMENTATION_PLAN.md exist
touch AGENTS.md
touch IMPLEMENTATION_PLAN.md

echo "Ralph Loop Started. Press Ctrl+C to stop."

# Stuck loop protection variables
STUCK_THRESHOLD=3 # Reverting to original README value
stuck_count=0
TEMP_OUTPUT_FILE="/tmp/claude_output.$$" # Unique temporary file for output

# Auto-restore .claude.json if it's missing but a backup exists
# (This helps fix the "Claude configuration file not found" error)
if [ ! -f "/home/ralph/.claude.json" ]; then
    BACKUP=$(ls -t /home/ralph/.claude/backups/.claude.json.backup.* 2>/dev/null | head -n 1)
    if [ -n "$BACKUP" ]; then
        echo "INFO: .claude.json not found, restoring from latest backup: $BACKUP"
        cp "$BACKUP" "/home/ralph/.claude.json"
    fi
fi

while true; do
    # Capture git state before iteration
    git_hash_before=$(git rev-parse HEAD 2>/dev/null || echo "none")

    echo "========================================="
    echo "Ralph entering Planning Mode... ($(date))"
    echo "========================================="

    # Execute the AI in planning mode and capture output
    if ! $AI_CMD < /app/agent/PROMPT_plan.md 2>&1 | tee "$TEMP_OUTPUT_FILE"; then
        echo "ERROR: AI (Planning) failed. Sleeping longer before retry."
        sleep 300 # Longer sleep on error
        rm -f "$TEMP_OUTPUT_FILE" # Clean up temp file
        continue
    fi
    CURRENT_ITERATION_OUTPUT+=$(cat "$TEMP_OUTPUT_FILE")

    echo "========================================="
    echo "Ralph entering Build Mode... ($(date))"
    echo "========================================="

    # Execute the AI in build mode and capture output
    if ! $AI_CMD < /app/agent/PROMPT_build.md 2>&1 | tee "$TEMP_OUTPUT_FILE"; then
        echo "ERROR: AI (Build) failed. Sleeping longer before retry."
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
    echo "Ralph iteration complete. Sleeping for 15 seconds... ($(date))"
    echo "========================================="
    sleep 15
done
