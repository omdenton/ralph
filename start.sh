#!/bin/bash

# Start the Ralph Shop visualiser and the Ralph Loop in a single container.
# loop.sh output is teed to a log file that server.js tails.

LOG_FILE="/tmp/ralph.log"
touch "$LOG_FILE"

# Install shop dependencies and start the visualiser server in background
cd /app/agent/shop/src
npm install --omit=dev 2>/dev/null
RALPH_LOG_FILE="$LOG_FILE" PORT="${SHOP_PORT:-8080}" node server.js &
SHOP_PID=$!

# Give the server a moment to bind
sleep 1

# Run the loop, tee all output to the log file
cd /app/project
/app/agent/loop.sh "$@" 2>&1 | tee -a "$LOG_FILE"

# If the loop exits, keep the shop alive briefly so user can see final state
sleep 5
kill $SHOP_PID 2>/dev/null
