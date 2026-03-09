# Deployment

## Docker Compose

```bash
cp .env.example .env
docker compose up -d
```

The default compose stack includes:
- PostgreSQL
- Zenoh router
- API server
- frontend

Southbound integration frontends are deployed separately and registered through Runtime Studio. Neuron is one supported frontend, but the deployment model is intended to accommodate Siemens Industrial Edge and direct driver services such as Rust7 as well.

## Manual Backend Deployment

Build binaries:

```bash
cd backend
cargo build --release
```

Install the API server and optional support binaries:

```bash
sudo cp target/release/api-server /usr/local/bin/
sudo cp target/release/zenoh-bridge /usr/local/bin/
sudo cp target/release/neuron-connector /usr/local/bin/
```

Example systemd unit for the API server:

```ini
[Unit]
Description=Fendtastic API Server
After=network.target

[Service]
Type=simple
User=fendtastic
WorkingDirectory=/opt/fendtastic
EnvironmentFile=/opt/fendtastic/.env
ExecStart=/usr/local/bin/api-server
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

## Runtime Nodes

Runtime nodes should be provisioned separately on the target ARM hosts.
A minimal deployment should include:
- network access to Zenoh and the API server as required
- at least one supported southbound integration frontend installed and reachable
- secret material available via env vars or local secret files

## Production Checklist

- rotate default database credentials
- secure Zenoh exposure
- configure HTTPS for the frontend/API edge
- provide secret material for runtime-node integration frontend credentials
- back up `data/` and database state
