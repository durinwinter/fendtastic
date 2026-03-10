# Architecture

`fendtastic` is the vertical-agnostic industrial substrate. Vertical applications sit above it as capability extensions.

## Active Runtime Model

Fendtastic is centered on explicit runtime nodes and pluggable southbound integration frontends.

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
                +--> Southbound integration frontend
                        +--> Neuron
                        +--> Siemens Industrial Edge
                        +--> Direct drivers such as Rust7
                +--> Southbound protocols such as Siemens S7
```

## Main Components

### Frontend
- Runtime Studio for runtime nodes, drivers, bindings, authority, and capabilities
- Dashboard and operational views consuming API and Zenoh status
- Runtime Studio is substrate tooling, not the final operator application for every vertical

### API Server
- PEA CRUD and runtime deployment commands
- Runtime-node registry
- Driver catalog and instance lifecycle
- Binding validation
- Control-authority enforcement
- Runtime and driver status publication on Zenoh

### Capability Extensions
- Vertical-specific applications built on the `fendtastic` substrate
- Consume `fendtastic` PEA/canonical data as authoritative process context
- May add direct specialty sensors and publish derived domain outputs
- Example: a line-specific digital twin such as `ceres-station`

### Runtime Nodes
- Usually ARM edge computers
- Run one PEA in the current operating model
- Connect to a pluggable southbound integration frontend for protocol access

### Southbound Integration Frontends
- Neuron is the first supported frontend and currently the most complete path in the implementation
- Other intended frontends include Siemens Industrial Edge and direct driver adapters such as Rust7
- Runtime Studio and the backend should treat these as interchangeable frontend choices behind the same runtime-node and binding model

## Primary Topic Families

- `entmoot/runtime/nodes/{runtime_id}/status`
- `entmoot/runtime/nodes/{runtime_id}/drivers/{driver_id}/status`
- `entmoot/runtime/nodes/{runtime_id}/pea/{pea_id}/deploy`
- `entmoot/runtime/nodes/{runtime_id}/pea/{pea_id}/lifecycle`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/status`
- `entmoot/pol/**`
- `entmoot/status/runtime-orchestrator`

## Data Flow

### Runtime Health
1. API server polls configured runtime nodes and drivers
2. Status snapshots are published on Zenoh
3. Frontend subscribes for live runtime and driver state
4. REST endpoints provide initial snapshots for non-subscribers

### Driver Read/Write
1. Operator configures a runtime node and a selected southbound integration frontend
2. Canonical PEA tags are bound to frontend-specific tags
3. Writes are checked against authority state in the API server
4. API server executes frontend-specific read/write calls
5. Status and last-operation records are published to Zenoh

### Vertical Application Flow
1. PLC and field data enters through `fendtastic`
2. `fendtastic` reorganizes that data into PEA/MTP/canonical structures
3. Capability extensions subscribe to canonical process signals
4. Extensions fuse that context with their own added sensors where needed
5. Extensions publish vertical-specific analytics, events, and operator workflows without replacing the substrate

See also: [Capability Extension Contract](./capability-extension-contract.md)
