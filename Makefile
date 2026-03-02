start:
	docker compose run --build --rm ralph /app/agent/loop.sh

loop:
	docker compose run --build --rm ralph /app/agent/loop.sh

loop-gemini:
	docker compose run --build --rm ralph /app/agent/loop.sh --gemini

build:
	docker compose build

clean:
	docker compose down --rmi local

.PHONY: start build clean loop loop-gemini
