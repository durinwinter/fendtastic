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

- `api-server`: runtime registry, bindings, authority, Neuron integration, status publication
- `shared`: canonical domain models for runtime nodes, drivers, bindings, capabilities, and authority
- `neuron-connector`: connector boundary and catalog helpers

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
2. add driver-specific translation logic in the Neuron client path as needed
3. rely on the schema-driven frontend instead of creating a one-off form

### Add a new runtime endpoint

1. create or extend a handler in `backend/api-server/src/`
2. register it in `backend/api-server/src/api_routes.rs`
3. add a route test if the endpoint is part of the primary API surface
