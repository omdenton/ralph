#!/bin/bash
# Tests for loop.sh behaviour

PASS=0
FAIL=0

run_test() {
    local name="$1"
    local result="$2"
    local expected="$3"
    if [ "$result" = "$expected" ]; then
        echo "PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $name"
        echo "  Expected: $expected"
        echo "  Got:      $result"
        FAIL=$((FAIL + 1))
    fi
}

# ---------------------------------------------------------------------------
# Helper: replicate flag-parsing logic from loop.sh and return AI_CMD
# ---------------------------------------------------------------------------
resolve_ai_cmd() {
    USE_GEMINI=false
    for arg in "$@"; do
        if [ "$arg" = "--gemini" ]; then
            USE_GEMINI=true
        fi
    done

    if [ "$USE_GEMINI" = true ]; then
        echo "gemini --yolo"
    else
        echo "claude --dangerously-skip-permissions"
    fi
}

# ---------------------------------------------------------------------------
# Unit tests: flag parsing
# ---------------------------------------------------------------------------
echo "=== Flag parsing ==="

run_test "no flags -> Claude" \
    "$(resolve_ai_cmd)" \
    "claude --dangerously-skip-permissions"

run_test "--gemini flag -> Gemini" \
    "$(resolve_ai_cmd --gemini)" \
    "gemini --yolo"

run_test "--gemini among other args -> Gemini" \
    "$(resolve_ai_cmd --some-flag --gemini --another)" \
    "gemini --yolo"

run_test "unrecognised flag -> Claude" \
    "$(resolve_ai_cmd --unknown)" \
    "claude --dangerously-skip-permissions"

# ---------------------------------------------------------------------------
# Structural checks: loop.sh contains expected strings
# ---------------------------------------------------------------------------
echo ""
echo "=== Structural checks ==="

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOOP_SH="$SCRIPT_DIR/loop.sh"

check_contains() {
    local name="$1"
    local pattern="$2"
    if grep -q "$pattern" "$LOOP_SH"; then
        echo "PASS: $name"
        PASS=$((PASS + 1))
    else
        echo "FAIL: $name (pattern not found: $pattern)"
        FAIL=$((FAIL + 1))
    fi
}

check_contains "loop.sh sets gemini --yolo"                    'AI_CMD="gemini --yolo"'
check_contains "loop.sh sets claude --dangerously-skip-permissions" 'AI_CMD="claude --dangerously-skip-permissions"'
check_contains "loop.sh uses \$AI_CMD for plan step"           '\$AI_CMD < /app/agent/PROMPT_plan.md'
check_contains "loop.sh uses \$AI_CMD for build step"          '\$AI_CMD < /app/agent/PROMPT_build.md'
check_contains "loop.sh checks for --gemini flag"              '"$arg" = "--gemini"'

# ---------------------------------------------------------------------------
# Integration test: is gemini binary available?
# ---------------------------------------------------------------------------
echo ""
echo "=== Integration ==="

if command -v gemini &>/dev/null; then
    echo "PASS: gemini binary is available ($(command -v gemini))"
    PASS=$((PASS + 1))

    # If GEMINI_API_KEY is set, do a live smoke test
    if [ -n "$GEMINI_API_KEY" ]; then
        echo "INFO: GEMINI_API_KEY is set — running live smoke test..."
        RESPONSE=$(echo "Reply with only the word: pong" | gemini --yolo 2>&1)
        if echo "$RESPONSE" | grep -qi "pong"; then
            echo "PASS: Gemini live smoke test (got 'pong')"
            PASS=$((PASS + 1))
        else
            echo "FAIL: Gemini live smoke test (unexpected response)"
            echo "  Response: $RESPONSE"
            FAIL=$((FAIL + 1))
        fi
    else
        echo "INFO: GEMINI_API_KEY not set — skipping live smoke test"
    fi
else
    echo "SKIP: gemini binary not found (install with: npm install -g @google/gemini-cli)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
