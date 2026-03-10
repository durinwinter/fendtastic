# Fendtastic

Fendtastic is a vertical-agnostic automation substrate built around PEA engineering, runtime-node management, pluggable southbound integration frontends, authority control, and Zenoh-based status distribution.

It is not intended to be the final operator application for every vertical. Instead, it provides the control-data, runtime, networking, and PEA/MTP substrate that vertical capability extensions build on top of.

## Current Architecture

- `frontend/`: React operator UI, including Runtime Studio
- `backend/api-server/`: Actix-web API, runtime registry, authority enforcement, and southbound frontend integration
- `backend/neuron-connector/`: Neuron connector scaffold and driver catalog utilities, representing the first implemented frontend adapter
- `backend/zenoh-bridge/`: Zenoh message utilities
- `backend/shared/`: shared runtime, driver, binding, and authority models
- `docker-compose*.yml`: local Postgres, Zenoh, and default development infrastructure

## Quick Start

```bash
./dev.sh
```

That starts:
- PostgreSQL
- Zenoh router
- a default Neuron-based development frontend
- API server
- frontend dev server

Runtime Studio is currently Neuron-first in the implementation, but the runtime-node model is intended to support other frontends as well, including Siemens Industrial Edge and direct drivers such as Rust7. For local development the default endpoint is `http://localhost:7000`.

## Manual Start

```bash
cd backend && cargo run --bin api-server
cd frontend && npm install && npm run dev
```

Infrastructure-only local stack:

```bash
docker compose -f docker-compose.dev.yml up -d
```

## Key URLs

- Dashboard: `http://localhost:3000`
- API: `http://localhost:8080/api/v1`
- Health: `http://localhost:8080/health`
- Zenoh WebSocket: `ws://localhost:8000`
- Default Neuron frontend: `http://localhost:7000` (admin / 0000)

## Runtime Node Notes

- Initial operational model is `1 PEA : 1 runtime node`.
- Runtime nodes are typically ARM edge computers.
- Frontend credentials are configured per node in the UI.
- `password_ref` supports plain text, `env:NAME`, and `secret://path/to/key`.

## Environment

Copy `.env.example` to `.env` and adjust what you need for local API, Postgres, and Zenoh settings.

## Documentation

- [Control Authority Specification](Control-Authority.md)
- [Architecture](docs/architecture.md)
- [Capability Extension Contract](docs/capability-extension-contract.md)
- [Configuration](docs/configuration.md)
- [Development](docs/development.md)
- [Deployment](docs/deployment.md)
