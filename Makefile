start:
	docker compose run --build --rm ralph /app/agent/loop.sh

loop:
	docker compose run --build --rm ralph /app/agent/loop.sh

start-gemini:
	docker compose run --build --rm ralph /app/agent/loop.sh --gemini

loop-gemini:
	docker compose run --build --rm ralph /app/agent/loop.sh --gemini

build:
	docker compose build

clean:
	docker compose down --rmi local

.PHONY: start start-gemini build clean loop loop-gemini
