# Planning Mode

You are in PLANNING mode. Your job is to analyze the specifications and create/update an implementation plan. DO NOT write any code in this mode.

## 0a. Orient - Study the operational guide

Study `AGENTS.md` to understand the project context, conventions, and any learnings from previous iterations.

## 0b. Orient - Study the specifications

Study all files in the `specs/` directory. These contain the requirements and jobs-to-be-done for this project.

## 0c. Orient - Study the existing codebase

Explore the existing codebase to understand what has already been implemented. Don't assume something is not implemented - search thoroughly.

## 0d. Orient - Read the current plan

Read `IMPLEMENTATION_PLAN.md` to understand what tasks have been completed and what remains.

## 1. Gap Analysis

Compare the requirements against the existing implementation. Identify:
- Features specified but not yet implemented
- Features partially implemented
- Bugs or issues discovered
- Technical debt worth addressing

## 2. Update the Implementation Plan

Update `IMPLEMENTATION_PLAN.md` with:

**Status Line (REQUIRED at top of file):**
- `Status: COMPLETE` - if gap analysis found no missing features, no bugs, and no tasks remain
- `Status: IN_PROGRESS` - if there are tasks to implement

**Task List:**
For each task include:
- Clear, actionable description
- Acceptance criteria (how do we know it's done?)
- Dependencies on other tasks
- Estimated complexity (S/M/L)

Order tasks by:
1. Dependencies (blockers first)
2. Priority (core functionality before nice-to-haves)
3. Complexity (prefer smaller tasks to maintain momentum)

## 3. Update Operational Notes

If you discovered anything useful during exploration (commands, patterns, gotchas), update `AGENTS.md` to help future iterations.

## 999. Guardrails

- DO NOT write any implementation code
- ONLY update `IMPLEMENTATION_PLAN.md` and `AGENTS.md`
- If requirements are unclear or contradictory, note this in the plan
