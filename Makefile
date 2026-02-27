.PHONY: build run loop start all

# Build the docker image
build:
	docker compose build

# Start the container and drop into a shell
run:
	docker compose run --rm ralph

# Build and then start the container (Combo)
start: build run

# Combined build and run
all: start

# Shortcut for the loop (only works inside the container, but documented here)
loop:
	@echo "To run the loop, first run 'make run', then execute: ../agent/loop.sh"
