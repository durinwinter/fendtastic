# Configuration

## Prerequisites

- Rust toolchain
- Node.js 18+
- Docker / Docker Compose
- Optional external runtime nodes running a southbound integration frontend such as Neuron, Siemens Industrial Edge, or a direct driver stack like Rust7

## Environment File

Create `.env` from `.env.example`.

Relevant variables:

```bash
ZENOH_ROUTER=tcp/127.0.0.1:7447
API_HOST=0.0.0.0
API_PORT=8080
PEA_CONFIG_DIR=./data/pea-configs
POL_DB_DIR=./data/pol
RECIPE_DIR=./data/recipes
DATABASE_URL=postgres://fendtastic:fendtastic@localhost:5432/fendtastic
VITE_API_URL=http://localhost:8080/api/v1
VITE_ZENOH_WS=ws://localhost:8000
```

## Runtime Node Configuration

Runtime nodes are configured through Runtime Studio, not static env vars.

Per node you define:
- node name
- host
- integration frontend endpoint or runtime address
- username
- `password_ref`
- config path
- access mode (`Api`, `FileExport`, `Hybrid`)

The current Runtime Studio implementation is Neuron-first, but the runtime-node model is intentionally frontend-agnostic. Neuron is one pluggable southbound frontend, not the only target.

## Capability Extension Context

Vertical applications should consume process context from the engineered PEA namespace emitted by `fendtastic`.

Relevant topic families:

- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/announce`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/status`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/config`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/services/{service_tag}/state`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/services/{service_tag}/command`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/data/{data_item}`

Vertical applications may also consume substrate/runtime context from:

- `entmoot/runtime/nodes/{runtime_id}/status`
- `entmoot/runtime/nodes/{runtime_id}/drivers/{driver_id}/status`
- `entmoot/habitat/pea/{pea_id}/authority`

The intended model is:
- `fendtastic` publishes authoritative PLC and PEA context
- capability extensions subscribe to that namespace
- capability extensions add direct specialty sensors only where needed
- derived outputs are published under an extension-specific namespace, not back into authoritative PEA topics

See also:
- [Capability Extension Contract](./capability-extension-contract.md)
- [Ceres Station Integration Spec](./ceres-station-integration-spec.md)

## `password_ref` Resolution

The backend currently resolves frontend credentials in this order:

1. plain string
2. `env:NAME`
3. `secret://path/to/key`

For `secret://runtime/default/neuron`, the backend checks:
- `SECRET_RUNTIME_DEFAULT_NEURON`
- `NEURON_SECRET_RUNTIME_DEFAULT_NEURON`
- `./data/secrets/runtime/default/neuron`
- `../data/secrets/runtime/default/neuron`

## Local Development Stack

```bash
./dev.sh
```

That starts Postgres, Zenoh, the API server, and the frontend.

## External Runtime Frontends

Fendtastic no longer starts a local southbound frontend container by default.

Use Runtime Studio to register an external node such as an ARM device running Neuron, Siemens Industrial Edge, or a direct driver service, then:
- test node connectivity
- select a driver from the catalog
- configure Siemens S7 or another driver
- define tag groups and tags
- bind canonical PEA tags

Those bindings become the stable process-context surface that vertical applications should consume rather than binding directly to PLC addresses.
