start:
	docker compose run --build --rm ralph /app/agent/loop.sh

loop:
	docker compose run --build --rm ralph /app/agent/loop.sh

start-gemini:
	docker compose run --build --rm ralph /app/agent/loop.sh --gemini

loop-gemini:
	docker compose run --build --rm ralph /app/agent/loop.sh --gemini

shop:
	@docker compose up -d --build
	@sleep 2
	@xdg-open http://localhost:$${SHOP_PORT:-8080} 2>/dev/null || open http://localhost:$${SHOP_PORT:-8080} 2>/dev/null || echo "Open http://localhost:$${SHOP_PORT:-8080}"
	@echo "Ralph Shop running. Ctrl+C to stop."
	@trap 'echo "" && echo "Stopping Ralph..." && docker compose down 2>/dev/null && echo "Ralph stopped."' EXIT; docker logs ralph --follow 2>/dev/null

logs:
	docker logs ralph --follow

stop:
	docker compose down

build:
	docker compose build

clean:
	docker compose down --rmi local

.PHONY: start start-gemini build clean loop loop-gemini shop logs stop
