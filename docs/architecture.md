# Architecture Overview

## System Architecture

Fendtastic is a real-time industrial monitoring system built with a modern, scalable architecture.

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Swimlane     │  │ Time Series  │  │ Spot Values  │     │
│  │ Diagram      │  │ Chart        │  │ Panel        │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────────────────────────────────────────┐     │
│  │        Isometric 3D Machine View (Three.js)      │     │
│  └──────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
                           ▲
                           │ WebSocket / REST
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Zenoh Router (Pub/Sub)                     │
│           High-performance messaging backbone               │
└─────────────────────────────────────────────────────────────┘
         ▲                           ▲
         │                           │
         ▼                           ▼
┌──────────────────┐        ┌──────────────────┐
│  Rust API Server │        │  Zenoh Bridge    │
│  (Actix-web)     │        │  (Data Router)   │
└──────────────────┘        └──────────────────┘
                                     ▲
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  EVA-ICS         │
                            │  Connector       │
                            └──────────────────┘
                                     ▲
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   EVA-ICS v4     │
                            │  (Physical I/O)  │
                            └──────────────────┘
                                     ▲
                                     │
                                     ▼
                            ┌──────────────────┐
                            │  Physical        │
                            │  Sensors/        │
                            │  Actuators       │
                            └──────────────────┘
```

## Components

### Frontend (React + TypeScript)

**Purpose**: Provides the user interface for monitoring and control

**Technologies**:
- React 18 with TypeScript
- Material-UI for base components
- Chart.js for time-series visualization
- Three.js / React Three Fiber for 3D machine visualization
- Custom Fendt/Mars theming

**Key Features**:
- Real-time swimlane visualization of machine states, user actions, and alarms
- Multi-channel time-series graphs
- Live spot value displays with trend indicators
- 3D isometric machine views
- WebSocket connection to Zenoh for real-time updates

### Zenoh Router

**Purpose**: High-performance pub/sub messaging backbone

**Features**:
- Ultra-low latency message routing
- Built-in storage for time-series data
- WebSocket support for browser clients
- REST API for queries

**Key Expressions**:
- `fendtastic/machines/{machine_id}/state` - Machine state updates
- `fendtastic/sensors/{machine_id}/{sensor_id}` - Sensor readings
- `fendtastic/alarms/**` - Alarm notifications
- `fendtastic/eva-ics/**` - EVA-ICS data feed

### Backend Services (Rust)

#### API Server (Actix-web)
- REST API endpoints for historical data queries
- WebSocket endpoint for real-time subscriptions
- Connects to Zenoh for data access

#### Zenoh Bridge
- Publishes telemetry data to Zenoh
- Routes messages between components
- Implements data transformation logic

#### EVA-ICS Connector
- Polls EVA-ICS for sensor data
- Publishes sensor readings to Zenoh
- Forwards control commands from Zenoh to EVA-ICS

### EVA-ICS v4

**Purpose**: Industrial automation controller for physical I/O

**Integration**:
- JSON-RPC API for sensor queries and actuator control
- Supports multiple I/O protocols (Modbus, OPC UA, etc.)
- Real-time state management

## Data Flow

### Sensor Data Flow

1. Physical sensors → EVA-ICS v4
2. EVA-ICS Connector polls EVA-ICS via JSON-RPC
3. Connector publishes to Zenoh: `fendtastic/eva-ics/sensors/{oid}`
4. Zenoh stores data and forwards to subscribers
5. Frontend receives updates via WebSocket
6. UI components update in real-time

### Command Flow

1. User action in frontend
2. Frontend publishes command to Zenoh: `fendtastic/commands/{machine_id}/{action}`
3. EVA-ICS Connector receives command
4. Connector sends action to EVA-ICS via JSON-RPC
5. EVA-ICS executes command on physical actuators
6. State change flows back through sensor data flow

## Scaling Considerations

- **Horizontal Scaling**: Multiple Zenoh routers can form a mesh
- **Data Retention**: Zenoh storage can be backed by persistent storage
- **Load Balancing**: API servers can be load-balanced
- **Edge Deployment**: Components can run on edge devices near sensors

## Security

- API key authentication for EVA-ICS
- WebSocket authentication (to be implemented)
- Network isolation between components
- TLS/SSL for production deployments
