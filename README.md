# Fendtastic — Modular Automation Platform

A modular automation platform with intent-driven control, designed to coordinate distributed automation subsystems using a Packaged Equipment Assembly (PEA) model.

The platform enables humans, automation procedures, and AI systems to interact safely with physical infrastructure while maintaining deterministic machine behavior and operational safety.

## Core Concepts

### Packaged Equipment Assemblies (PEAs)

Self-contained automation modules encapsulating device integrations, operational procedures, telemetry/command interfaces, digital twin models, and capability definitions. PEAs are the central engineering artifact — all automation logic lives inside them.

### Process Orchestration Layer (POL)

Centralized orchestration engine that evaluates intents, composes procedures across PEAs, manages control authority, and maintains the facility capability graph.

### Intent-Driven Control

External actors (operators, AI systems, schedulers) submit high-level intents describing desired outcomes rather than directly manipulating actuators. The POL translates intents into validated procedures.

### Control Authority Model

Determines which actors may control a subsystem at any given time. Control modes include ObserveOnly, OperatorExclusive, AutoExclusive, AIAssisted, AIExclusive, MaintenanceExclusive, and EmergencyLockout.

### Digital Twin Arbitration

Proposed control plans are evaluated against a facility digital twin before execution. Actions may be approved, modified, or rejected based on safety constraints, system stability, and operational limits.

### Self-Assembling Automation

New PEA runtimes register dynamically with the POL, publish capabilities, and integrate into the facility model automatically.

## Architecture

### Infrastructure Stack

- **Zenoh**: Event mesh and real-time data distribution
- **OpenZiti**: Zero-trust service access enforcement
- **Nebula**: Secure overlay networking between runtime nodes

### Backend

- **Rust API Server**: Actix-web based orchestration and API services
- **PEA Runtimes**: Distributed automation execution on runtime nodes
- **EVA-ICS v4**: Device protocol integration layer

### Frontend

- **React**: Operator interface and monitoring dashboard
- **MURPH Theme**: Mars Rust / Terminal Amber design language

## Control Loop Hierarchy

| Loop              | Responsibility                                        | Timescale          |
| ----------------- | ----------------------------------------------------- | ------------------ |
| Intent Loop       | Humans / AI define desired outcomes                   | Minutes to hours   |
| Optimization Loop | POL evaluates intents, digital twin predicts response | Minutes            |
| Procedure Loop    | POL composes procedures across PEAs                   | Seconds to minutes |
| Control Loop      | Local device control (PID, valve, motor)              | Milliseconds       |

## Layered Architecture

| Layer               | Responsibility            |
| ------------------- | ------------------------- |
| Intent Layer        | Defines goals             |
| Orchestration Layer | Determines system actions |
| Digital Twin        | Validates actions         |
| Authority Layer     | Determines who may act    |
| Execution Layer     | Performs procedures       |
| Device Layer        | Executes control loops    |

## Project Structure

```text
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
│   │   ├── themes/       # Theming
│   │   └── services/     # API & Zenoh clients
├── config/               # Configuration files
└── docs/                 # Documentation
```

## Quick Start (Ubuntu)

### One-Command Launch

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

- **Dashboard**: <http://localhost:3000>
- **API**: <http://localhost:8080>
- **Health check**: <http://localhost:8080/health>

Press `Ctrl+C` to stop all services.

### Prerequisites

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

### Manual Launch

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

**Terminal 4 — EVA-ICS Connector (when EVA-ICS is running):**

```bash
cd backend && cargo run --bin eva-ics-connector
```

### Production (Docker Compose)

```bash
cp .env.example .env
# Edit .env with your configuration
docker compose up -d
```

## Configuration

```bash
cp .env.example .env
```

| Variable          | Default                        | Description                    |
| ----------------- | ------------------------------ | ------------------------------ |
| `EVA_ICS_URL`     | `http://localhost:7727`        | EVA-ICS v4 API endpoint        |
| `EVA_ICS_API_KEY` | —                              | EVA-ICS authentication key     |
| `VITE_API_URL`    | `http://localhost:8080/api/v1` | Frontend API base URL          |
| `VITE_ZENOH_WS`   | `ws://localhost:8000`          | Frontend Zenoh WebSocket URL   |

## Ports

| Port | Service              | Protocol  |
| ---- | -------------------- | --------- |
| 3000 | Frontend dev server  | HTTP      |
| 7447 | Zenoh router         | TCP       |
| 8000 | Zenoh router         | WebSocket |
| 8080 | API server           | HTTP      |

## Documentation

- [Control Authority Specification](Control-Authority.md) — Platform architecture and control model
- [Architecture](docs/architecture.md) — System design and data flow diagrams
- [Configuration](docs/configuration.md) — Detailed setup for all components
- [Development](docs/development.md) — Adding features, components, and sensors
- [Deployment](docs/deployment.md) — Production deployment

## License

MIT
