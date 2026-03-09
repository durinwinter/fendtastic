# Development

## Project Structure

```text
backend/
  api-server/
  neuron-connector/
  shared/
  zenoh-bridge/
frontend/
  src/components/
  src/pages/
  src/services/
  src/types/
docs/
```

## Backend Focus Areas

- `api-server`: runtime registry, bindings, authority, pluggable southbound frontend integration, status publication
- `shared`: canonical domain models for runtime nodes, drivers, bindings, capabilities, and authority
- `neuron-connector`: one connector boundary and catalog helper implementation; additional frontends such as Siemens Industrial Edge or direct drivers like Rust7 should fit the same architectural slot

## Frontend Focus Areas

- `RuntimeStudio.tsx`: main runtime-node workflow
- runtime components under `frontend/src/components/runtime/`
- `apiService.ts`: REST integration surface
- `zenohService.ts`: live status subscriptions

## Common Tasks

### Run backend tests

```bash
cd backend
cargo test -p api-server
```

### Run frontend build

If you are in a Flatpak shell, use host Node tooling:

```bash
flatpak-spawn --host npm run build
```

### Add a new driver catalog entry

1. extend the built-in catalog in `backend/api-server/src/driver_catalog.rs`
2. add driver-specific translation logic in the selected frontend adapter path as needed
3. rely on the schema-driven frontend instead of creating a one-off form

### Southbound frontend strategy

- Neuron is currently the first and most complete implemented frontend
- Siemens Industrial Edge is an expected alternative frontend
- direct adapters such as Rust7 should remain valid where a full frontend platform is unnecessary
- docs and code should avoid assuming that all drivers are hosted by Neuron

### Add a new runtime endpoint

1. create or extend a handler in `backend/api-server/src/`
2. register it in `backend/api-server/src/api_routes.rs`
3. add a route test if the endpoint is part of the primary API surface
