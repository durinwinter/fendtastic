# Fendtastic - Industrial Monitoring System

A real-time industrial monitoring system combining Fendt Tractor UI aesthetics with Mars Control System functionality.

## Architecture

### Backend
- **Zenoh**: High-performance pub/sub messaging for real-time data streaming
- **Rust Web Server**: Actix-web based API server
- **EVA-ICS v4**: Integration layer for physical sensor connectivity

### Frontend
- **React**: Modern UI framework
- **Fendt Theme**: Agricultural machinery inspired design language
- **Mars Control System UI**: Space-grade control interface patterns

## Features

- **Real-time Monitoring Dashboard**
  - Machine state swimlanes with temporal visualization
  - User action tracking lanes
  - Alarm management lanes
  - Time-synchronized time-series graphs
  - Live spot value displays
  - 3D isometric machine views

- **Sensor Integration**
  - Physical sensor connectivity via EVA-ICS v4
  - Low-latency data streaming through Zenoh
  - Bi-directional control capabilities

## Project Structure

```
fendtastic/
├── dev.sh                # One-command dev launcher
├── backend/              # Rust backend services
│   ├── api-server/       # REST API server
│   ├── zenoh-bridge/     # Zenoh messaging bridge
│   ├── eva-ics-connector/# EVA-ICS v4 integration
│   └── shared/           # Common data types
├── frontend/             # React application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── themes/       # Fendt & Mars theming
│   │   └── services/     # API & Zenoh clients
├── config/               # Configuration files
└── docs/                 # Documentation
```

## Quick Start (Ubuntu)

### One-Command Launch

The fastest way to get everything running for development:

```bash
./dev.sh
```

This script will:
1. Check that Rust, Node.js 18+, and Docker are installed
2. Verify ports 3000, 7447, 8000, and 8080 are free
3. Copy `.env.example` to `.env` if needed
4. Install frontend npm packages if missing
5. Start the Zenoh router in Docker
6. Build and start the Rust API server
7. Start the React dev server with hot-reload

Once running:
- **Dashboard**: http://localhost:3000
- **API**: http://localhost:8080
- **Health check**: http://localhost:8080/health

Press `Ctrl+C` to stop all services.

### Prerequisites

Install these before running `dev.sh`:

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Node.js 18+ (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 18

# Docker
sudo apt update && sudo apt install -y docker.io
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect

# Optional: cargo-watch for backend hot-reload
cargo install cargo-watch
```

### Manual Launch (without dev.sh)

If you prefer to run services individually in separate terminals:

**Terminal 1 — Zenoh Router:**
```bash
docker run --rm -p 7447:7447 -p 8000:8000 \
  -v ./config/zenoh-router.json5:/etc/zenoh/config.json5:ro \
  eclipse/zenoh:latest -c /etc/zenoh/config.json5
```

**Terminal 2 — API Server:**
```bash
cd backend && cargo run --bin api-server
```

**Terminal 3 — Frontend:**
```bash
cd frontend && npm install && npm run dev
```

**Terminal 4 — EVA-ICS Connector (when you have EVA-ICS running):**
```bash
cd backend && cargo run --bin eva-ics-connector
```

### Production (Docker Compose)

```bash
cp .env.example .env
# Edit .env with your EVA-ICS credentials
docker compose up -d
```

### Makefile Shortcuts

```bash
make setup          # Install deps and build everything
make dev            # Run backend + frontend in parallel
make docker-up      # Start via Docker Compose
make docker-logs    # Tail all container logs
make test-backend   # Run Rust tests
make clean          # Remove build artifacts
```

## Configuration

Copy the example and edit as needed:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `EVA_ICS_URL` | `http://localhost:7727` | EVA-ICS v4 API endpoint |
| `EVA_ICS_API_KEY` | — | EVA-ICS authentication key |
| `VITE_API_URL` | `http://localhost:8080/api/v1` | Frontend API base URL |
| `VITE_ZENOH_WS` | `ws://localhost:8000` | Frontend Zenoh WebSocket URL |

See [docs/configuration.md](docs/configuration.md) for detailed setup including EVA-ICS sensor configuration.

## Ports

| Port | Service | Protocol |
|---|---|---|
| 3000 | Frontend dev server | HTTP |
| 7447 | Zenoh router | TCP |
| 8000 | Zenoh router | WebSocket |
| 8080 | API server | HTTP |

## Documentation

- [Architecture](docs/architecture.md) — System design and data flow diagrams
- [Configuration](docs/configuration.md) — Detailed setup for all components
- [Development](docs/development.md) — Adding features, components, and sensors
- [Deployment](docs/deployment.md) — Production deployment on bare metal, Docker, and cloud

## License

MIT
