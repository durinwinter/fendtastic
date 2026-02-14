# Configuration Guide

## Environment Setup

### Prerequisites

1. **Rust** (1.70 or later)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js** (18 or later)
   ```bash
   # Using nvm
   nvm install 18
   nvm use 18
   ```

3. **Docker & Docker Compose** (optional, for containerized deployment)
   ```bash
   # Install Docker Desktop or use package manager
   ```

4. **EVA-ICS v4** instance running and accessible

## Configuration Files

### Backend Configuration

Copy and modify the example configuration:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# EVA-ICS Configuration
EVA_ICS_URL=http://your-eva-ics-host:7727
EVA_ICS_API_KEY=your-actual-api-key

# Zenoh Configuration
ZENOH_ROUTER=tcp/127.0.0.1:7447

# API Server Configuration
API_HOST=0.0.0.0
API_PORT=8080
```

Edit `config/backend.toml`:

```toml
[server]
host = "0.0.0.0"
port = 8080

[zenoh]
router_endpoint = "tcp/127.0.0.1:7447"
key_prefix = "fendtastic"

[eva_ics]
url = "http://your-eva-ics-host:7727"
api_key = "your-api-key"
poll_interval_ms = 500

[logging]
level = "info"  # Options: trace, debug, info, warn, error
format = "json"  # Options: json, pretty
```

### Zenoh Router Configuration

The Zenoh router configuration is in `config/zenoh-router.json5`:

```json5
{
  mode: "router",

  listen: {
    endpoints: [
      "tcp/0.0.0.0:7447",  // TCP endpoint for Rust clients
      "ws/0.0.0.0:8000",   // WebSocket endpoint for browser
    ],
  },

  plugins: {
    storage_manager: {
      storages: {
        fendtastic: {
          key_expr: "fendtastic/**",
          volume: "memory",  // Change to "file" for persistence
        },
      },
    },
  },
}
```

### Frontend Configuration

Copy and modify:

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```bash
VITE_API_URL=http://localhost:8080/api/v1
VITE_ZENOH_WS=ws://localhost:8000
```

## EVA-ICS Setup

### Configure Sensors in EVA-ICS

1. Access EVA-ICS UI at `http://your-eva-ics-host:7727`

2. Define sensor items with OIDs like:
   - `sensor:temp-001` - Temperature sensor
   - `sensor:pressure-001` - Pressure sensor
   - `unit:valve-001` - Control valve

3. Configure item properties:
   ```yaml
   oid: sensor:temp-001
   description: "Engine Temperature"
   unit: "celsius"
   ```

### API Key Generation

Generate an API key in EVA-ICS:

```bash
eva svc api-key create fendtastic-connector
```

Copy the generated key to your `.env` file.

## Running the System

### Development Mode

#### Terminal 1: Start Zenoh Router
```bash
docker run -p 7447:7447 -p 8000:8000 \
  -v ./config/zenoh-router.json5:/etc/zenoh/config.json5 \
  eclipse/zenoh:latest \
  -c /etc/zenoh/config.json5
```

#### Terminal 2: Start EVA-ICS Connector
```bash
cd backend
cargo run --bin eva-ics-connector
```

#### Terminal 3: Start API Server
```bash
cd backend
cargo run --bin api-server
```

#### Terminal 4: Start Frontend
```bash
cd frontend
npm install
npm run dev
```

Access the UI at: `http://localhost:3000`

### Production Mode (Docker)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with your settings

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

Access the UI at: `http://localhost:3000`

## Troubleshooting

### Zenoh Connection Issues

Check if Zenoh router is running:
```bash
# Test TCP endpoint
telnet localhost 7447

# Test WebSocket endpoint (from browser console)
new WebSocket('ws://localhost:8000')
```

### EVA-ICS Connection Issues

Test EVA-ICS API:
```bash
curl -X POST http://localhost:7727/jrpc \
  -H "X-Auth-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"method": "test", "params": {}}'
```

### Frontend Not Connecting

1. Check browser console for errors
2. Verify `VITE_API_URL` and `VITE_ZENOH_WS` in `.env`
3. Ensure API server is running on the correct port
4. Check CORS settings in API server

### Build Issues

Clear caches and rebuild:
```bash
# Backend
cd backend
cargo clean
cargo build

# Frontend
cd frontend
rm -rf node_modules dist
npm install
npm run build
```

## Performance Tuning

### Zenoh Router

For high-throughput scenarios, adjust buffer sizes:

```json5
{
  transport: {
    link: {
      tx: {
        batch_size: 65535,
      },
    },
  },
}
```

### EVA-ICS Connector

Adjust poll interval based on sensor update rates:

```toml
[eva_ics]
poll_interval_ms = 100  # Faster polling for critical sensors
```

### Frontend

Enable production optimizations:

```bash
npm run build -- --mode production
```
