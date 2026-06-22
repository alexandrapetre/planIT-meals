.PHONY: help install install-frontend install-backend start start-frontend start-backend dev dev-frontend dev-backend build clean typecheck mongo-up mongo-down

FRONTEND_DIR := frontend
BACKEND_DIR  := backend

mongo-up:
	docker compose up -d

mongo-down:
	docker compose down

help:
	@echo "planIT Meals - available targets"
	@echo "  make mongo-up         Start MongoDB (Docker) on port 27017"
	@echo "  make mongo-down       Stop MongoDB container"
	@echo "  make install          Install dependencies for frontend and backend"
	@echo "  make start            Run frontend and backend together"
	@echo "  make start-frontend   Run the Vite dev server (npm start in frontend)"
	@echo "  make start-backend    Run the Express server (npm start in backend)"
	@echo "  make dev              Alias for start (with nodemon on backend)"
	@echo "  make build            Production build of the frontend"
	@echo "  make typecheck        Run TypeScript in the frontend"
	@echo "  make clean            Remove node_modules and build artifacts"

install: install-frontend install-backend

install-frontend:
	cd $(FRONTEND_DIR) && npm install

install-backend:
	cd $(BACKEND_DIR) && npm install

start:
	@echo "Starting backend and frontend (Ctrl+C stops both)..."
	@trap 'kill 0' INT TERM EXIT; \
		( cd $(BACKEND_DIR) && npm start ) & \
		( cd $(FRONTEND_DIR) && npm start ) & \
		wait

start-frontend:
	cd $(FRONTEND_DIR) && npm start

start-backend:
	cd $(BACKEND_DIR) && npm start

dev:
	@echo "Starting backend (nodemon) and frontend (vite)..."
	@trap 'kill 0' INT TERM EXIT; \
		( cd $(BACKEND_DIR) && npm run dev ) & \
		( cd $(FRONTEND_DIR) && npm run dev ) & \
		wait

dev-frontend:
	cd $(FRONTEND_DIR) && npm run dev

dev-backend:
	cd $(BACKEND_DIR) && npm run dev

build:
	cd $(FRONTEND_DIR) && npm run build

typecheck:
	cd $(FRONTEND_DIR) && npm run typecheck

clean:
	rm -rf $(FRONTEND_DIR)/node_modules $(FRONTEND_DIR)/dist
	rm -rf $(BACKEND_DIR)/node_modules
