start:
	docker compose run --build --rm ralph

build:
	docker compose build

clean:
	docker compose down --rmi local

.PHONY: start build clean
