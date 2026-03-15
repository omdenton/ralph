> **Warning:** I'm a manager, not a developer. I have no idea what I'm doing. This is not real code. Use at your own peril.

# Ralph Loop v1.11

A containerized setup for running autonomous Claude Code loops using the [Ralph Wiggum technique](https://ghuntley.com/ralph/).

## How It Works

The loop runs Claude Code repeatedly in a bash while loop. Each iteration:

1. Feeds a prompt file to Claude
2. Claude does work, modifies files
3. Context clears when Claude exits
4. Loop restarts with fresh context, but files on disk persist
5. Repeat until done (or you hit Ctrl+C)

### Mode

The loop runs both planning and building steps sequentially in each iteration until it detects no change in output for 5 consecutive iterations.
**Planning** - Claude reads specs, explores the codebase, and builds/updates a task list in `IMPLEMENTATION_PLAN.md`.
**Building** - Claude picks one task from the plan, implements it, validates (tests/lint), commits, and marks it done. One task per iteration.

### State Persistence

Context clears between iterations, but state lives in files:

| File | Purpose |
|------|---------|
| `IMPLEMENTATION_PLAN.md` | Tracks completed tasks and backlog |
| `AGENTS.md` | Operational notes, learnings, gotchas |
| `src/` | Your actual code |
| `specs/` | Requirements and specifications |

### The Container

- Isolates Claude so it can't damage your host system
- Ubuntu 24.04 with Python, Node, and common dev tools
- OAuth token passed via environment variable
- Resource limits (CPU/memory) prevent runaway processes
- Sudo access for installing packages

### The Philosophy

- Each iteration starts fresh (no context bleed between runs)
- State lives in files, not in Claude's memory
- "Let Ralph Ralph" - trust it to self-correct through iteration
- Validation gates (tests, types, lint) enforce quality

## Project Structure

This repository contains the `agent` folder, which is the core of the Ralph Loop project. It is recommended to structure your project as follows:

```
your-project/
├── agent/         # This repository
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── loop.sh
│   └── ...
├── src/           # Your application code
├── specs/         # Your project specifications
└── ...            # Other project files
```

This structure separates the agent's code from your project's code, making it easier to manage both.

## Getting Started

To get started with Ralph Loop, you need to clone this repository into your project folder.

```bash
# 1. Navigate to your project folder
cd your-project

# 2. Clone this repository into the 'agent' folder
git clone git@github.com:omdenton/ralph.git agent
```

## Prerequisites

Before you begin, ensure you have the following software installed on your host machine:

1.  **Docker Engine** or **Docker Desktop**: This is required to build and run the containerized agent.
    -   *Installation*: Follow the official instructions for your operating system at [docs.docker.com/get-docker](https://docs.docker.com/get-docker/).

2.  **Node.js and npm**: The `claude` command-line tool requires Node.js.
    -   *Installation*: Download and install Node.js from [nodejs.org](https://nodejs.org/).

3.  **Claude Code CLI**: This tool is needed to generate the authentication token used by the agent.
    -   *Installation*: Once Node.js and npm are installed, run the following command in your terminal:
        ```bash
        npm install -g @anthropic-ai/claude-code
        ```

4.  **Gemini CLI** *(optional)*: Required only if you want to run the loop with Gemini instead of Claude.
    -   *Installation*:
        ```bash
        npm install -g @google/gemini-cli
        ```
    -   *API Key*: Get one from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and add it to your `agent/.env` file as `GEMINI_API_KEY=...`

## Quick Start

```bash
# 1. Get OAuth token for non-interactive usage
claude setup-token
# Copy the token it gives you

# 2. Set up your agent/.env file
#    This file contains the OAuth token for the Claude Code CLI.
#    Create agent/.env (e.g., using 'touch agent/.env') and paste your CLAUDE_CODE_OAUTH_TOKEN into it.
#    Example content for agent/.env:
#    CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...

# 3. Build and start the container and loop (from the agent directory)
cd agent
make start
```

## Makefile Commands

Run these from the `agent/` directory:

| Command | Description |
|---------|-------------|
| `make shop` | Build, start the loop + visualiser, open browser. Ctrl+C stops everything |
| `make start` | Build (if needed), start the container, and run the loop with Claude |
| `make start-gemini` | Build (if needed), start the container, and run the loop with Gemini |
| `make loop` | Same as `make start` |
| `make loop-gemini` | Same as `make start-gemini` |
| `make logs` | Follow Ralph's container logs |
| `make stop` | Stop all containers |
| `make build` | Build the container image without starting |
| `make clean` | Stop and remove the container image |

Press `Ctrl+C` to stop the loop at any time. Progress is saved in the `project/` directory - just re-run to continue.

The loop will automatically stop if it detects the same output 3 times in a row (stuck loop protection).

### Visualiser

`make shop` runs both the Ralph Loop and a pixel-art office visualiser in a single container. The loop output is tailed by a Node.js server that broadcasts state changes to the browser via WebSocket. Open `http://localhost:8080` (or `SHOP_PORT` if configured) to watch Ralph work.

The visualiser code lives in `agent/shop/src/` and is self-contained — it doesn't depend on anything in `project/`.



## Customization

### Adding Tools/Languages

Edit `agent/Dockerfile` to add runtimes or tools:

```dockerfile
# Example: Add Go
RUN curl -fsSL https://go.dev/dl/go1.22.0.linux-amd64.tar.gz | tar -C /usr/local -xzf -
ENV PATH="/usr/local/go/bin:$PATH"
```

Rebuild with `make build` from the `agent/` directory.

Claude can also install packages at runtime with sudo.

### Modifying Prompts

Edit `agent/PROMPT_plan.md` and `agent/PROMPT_build.md` to change Claude's behavior. Key things to tune:

- Validation commands (pytest, mypy, ruff, etc.)
- Task selection criteria
- Commit message format

### Resource Limits

Edit `agent/docker-compose.yml` to adjust CPU/memory limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 8G
```

### Network Isolation

To fully isolate the container from the network, uncomment in `agent/docker-compose.yml`:

```yaml
network_mode: none
```

Note: You need network access for Claude API calls.

## Workflow

1. **Write specs** - Create markdown files in `specs/` describing what you want built
2. **Run loop** - `./loop.sh` executes planning then building sequentially until no change is detected (stuck loop protection).
3. **Monitor** - Watch the output, Ctrl+C if it goes off track.
4. **Iterate (manually)** - Adjust specs, code, or prompts and restart `./loop.sh` to continue the process.

## Safety Notes

- The container runs with `--dangerously-skip-permissions` which bypasses Claude's safety prompts
- The Docker container is your security boundary
- Don't mount sensitive directories (`.ssh`, `.aws`, etc.)
- Your project IS accessible to Claude - use git for recovery
- `~/.claude` and `~/.claude.json` are mounted for authentication - this only allows API access, not host system access

## Credits

Based on [Geoffrey Huntley's Ralph Wiggum technique](https://ghuntley.com/ralph/) and his [coding agent workshop](https://ghuntley.com/agent/).
