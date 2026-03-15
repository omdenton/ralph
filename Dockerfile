FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=C.UTF-8
ENV LC_ALL=C.UTF-8

# Install base dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3 \
    python3-pip \
    python3-venv \
    ripgrep \
    jq \
    tree \
    htop \
    vim \
    sudo \
    openssh-client \
    && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (required for Claude Code)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code and Gemini CLI globally
RUN npm install -g @anthropic-ai/claude-code @google/gemini-cli

# Create non-root user with UID 1000 to match host user (for mounted credentials)
# Remove existing user with UID 1000 if present (ubuntu base image has 'ubuntu' user)
RUN userdel -r ubuntu 2>/dev/null || true && \
    useradd -m -s /bin/bash -u 1000 ralph && \
    echo "ralph ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers
USER ralph
WORKDIR /home/ralph

# Pre-trust GitHub SSH host key to avoid interactive prompt
RUN mkdir -p /home/ralph/.ssh && \
    ssh-keyscan -t ed25519,rsa github.com >> /home/ralph/.ssh/known_hosts 2>/dev/null && \
    chmod 700 /home/ralph/.ssh && chmod 600 /home/ralph/.ssh/known_hosts

# Set up Python virtual environment
RUN python3 -m venv /home/ralph/.venv
ENV PATH="/home/ralph/.venv/bin:$PATH"

# Install common Python packages
RUN pip install --no-cache-dir \
    pytest \
    black \
    ruff \
    mypy \
    requests \
    httpx

# Working directory for projects
WORKDIR /workspace

# Default command - drop into bash
CMD ["/bin/bash"]
