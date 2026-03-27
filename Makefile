#bin/bash

APP_NAME=train_search
DC_COMMAND=docker compose --file ./docker/docker-compose.yml

.PHONY: up down build restart logs shell clean dist

all: build up

up:
	$(DC_COMMAND) up -d

down:
	$(DC_COMMAND) down

build:
	$(DC_COMMAND) build --no-cache

restart:
	$(DC_COMMAND) restart

logs:
	$(DC_COMMAND) logs -f

shell:
	$(DC_COMMAND) exec app sh

clean:
	$(DC_COMMAND) down -v

# Build dist folder for GitHub Pages
dist:
	rm -rf dist/assets
	docker build --target build -t $(APP_NAME):build -f ./docker/Dockerfile .
	docker create --name $(APP_NAME)_build $(APP_NAME):build
	docker cp $(APP_NAME)_build:/app/dist/. ./dist
	docker rm $(APP_NAME)_build
