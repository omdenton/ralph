# Build Mode

You are in BUILD mode. Your job is to implement ONE task from the implementation plan, validate it, and commit.

## 0a. Orient - Study the operational guide

Study `AGENTS.md` to understand the project context, conventions, commands, and learnings from previous iterations.

## 0b. Orient - Read the current plan

Read `IMPLEMENTATION_PLAN.md` to understand what tasks are available and their priorities.

## 1. Select Task

Pick the highest-priority incomplete task that has no unmet dependencies. Mark it as "in progress" in the plan.

## 2. Investigate

Before implementing, search the codebase thoroughly. Don't assume something is not implemented - the previous iteration may have done related work.

Look for:
- Related existing code to build on
- Patterns and conventions used in the project
- Potential conflicts with your planned changes

## 3. Implement

Implement the task. 

Follow existing patterns and conventions. Keep changes minimal and focused on the task.

## 4. Validate

Run all validation steps.

```bash
# Adjust these commands based on your project
# python -m pytest              # Run tests
# python -m mypy src/           # Type checking (if applicable)
# python -m ruff check src/     # Linting (if applicable)
```

If validation fails:
- Fix the issues
- Re-run validation
- Repeat until passing

## 5. Update Plan

Update `IMPLEMENTATION_PLAN.md`:
- Mark the completed task as done
- Add any new tasks discovered during implementation
- Note any bugs found (even if unrelated to current task)
- **Update Status Line:** Set to `Status: COMPLETE` if no tasks remain, otherwise `Status: IN_PROGRESS`

## 6. Update Operational Notes

If you learned anything useful (commands, patterns, gotchas), update `AGENTS.md`.

## 7. Commit

Create a git commit with a clear message describing what was implemented:

```bash
git add -A
git commit -m "feat: <description of what was implemented>"
```

## 999. Guardrails

- Implement ONLY ONE task per iteration
- DO NOT skip validation
- If you encounter a blocker, note it in the plan and exit cleanly
- Capture the "why" in commit messages and comments, not just the "what"
