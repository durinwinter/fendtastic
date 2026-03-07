# Architecture

## Active Runtime Model

Fendtastic is now centered on explicit runtime nodes and Neuron-backed drivers.

```text
Frontend (Runtime Studio)
        |
        v
API Server (registry, authority, bindings, runtime status)
        |
        +--> Zenoh topics for runtime, habitat, POL, and status traffic
        |
        +--> Runtime nodes (1 PEA : 1 node)
                |
                +--> Neuron driver instances
                +--> Southbound protocols such as Siemens S7
```

## Main Components

### Frontend
- Runtime Studio for runtime nodes, drivers, bindings, authority, and capabilities
- Dashboard and operational views consuming API and Zenoh status

### API Server
- PEA CRUD and runtime deployment commands
- Runtime-node registry
- Driver catalog and instance lifecycle
- Binding validation
- Control-authority enforcement
- Runtime and driver status publication on Zenoh

### Runtime Nodes
- Usually ARM edge computers
- Run one PEA in the current operating model
- Connect to Neuron for southbound protocol access

### Neuron
- Hosts southbound driver instances
- Provides driver configuration and tag management
- First supported vertical slice is Siemens S7 read/write

## Primary Topic Families

- `murph/runtime/nodes/{runtime_id}/status`
- `murph/runtime/nodes/{runtime_id}/drivers/{driver_id}/status`
- `murph/runtime/nodes/{runtime_id}/pea/{pea_id}/deploy`
- `murph/runtime/nodes/{runtime_id}/pea/{pea_id}/lifecycle`
- `murph/habitat/nodes/{node_id}/pea/{pea_id}/status`
- `murph/pol/**`
- `murph/status/runtime-orchestrator`

## Data Flow

### Runtime Health
1. API server polls configured runtime nodes and drivers
2. Status snapshots are published on Zenoh
3. Frontend subscribes for live runtime and driver state
4. REST endpoints provide initial snapshots for non-subscribers

### Driver Read/Write
1. Operator configures a runtime node and Neuron driver instance
2. Canonical PEA tags are bound to Neuron tags
3. Writes are checked against authority state in the API server
4. API server executes Neuron read/write calls
5. Status and last-operation records are published to Zenoh
