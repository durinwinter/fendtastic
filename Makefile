.PHONY: all build-backend build-frontend dev-backend dev-frontend clean test

all: build-backend build-frontend

# Backend commands
build-backend:
	cd backend && cargo build --release

dev-backend:
	cd backend && cargo watch -x run

test-backend:
	cd backend && cargo test

# Frontend commands
build-frontend:
	cd frontend && npm run build

dev-frontend:
	cd frontend && npm run dev

install-frontend:
	cd frontend && npm install

# Docker commands
docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-build:
	docker-compose build

# Development
dev:
	make -j2 dev-backend dev-frontend

# Clean
clean:
	cd backend && cargo clean
	cd frontend && rm -rf node_modules dist build

# Full setup
setup: install-frontend
	cd backend && cargo build
	@echo "Setup complete! Run 'make dev' to start development servers"
