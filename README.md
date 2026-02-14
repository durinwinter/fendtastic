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
├── backend/              # Rust backend services
│   ├── zenoh-bridge/     # Zenoh messaging bridge
│   ├── api-server/       # REST API server
│   └── eva-ics-connector/# EVA-ICS v4 integration
├── frontend/             # React application
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── themes/       # Fendt & Mars theming
│   │   └── services/     # API & Zenoh clients
├── config/               # Configuration files
└── docs/                 # Documentation
```

## Quick Start

### Prerequisites
- Rust 1.70+
- Node.js 18+
- EVA-ICS v4 instance
- Zenoh router

### Backend Setup
```bash
cd backend
cargo build --release
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Configuration

See [docs/configuration.md](docs/configuration.md) for detailed setup instructions.

## License

MIT
