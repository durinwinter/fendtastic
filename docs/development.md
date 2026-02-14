# Development Guide

## Project Structure

```
fendtastic/
├── backend/
│   ├── api-server/          # REST API and WebSocket server
│   │   ├── src/
│   │   │   ├── main.rs      # Entry point
│   │   │   ├── handlers.rs  # HTTP handlers
│   │   │   ├── state.rs     # Application state
│   │   │   └── websocket.rs # WebSocket handlers
│   │   └── Cargo.toml
│   │
│   ├── zenoh-bridge/        # Zenoh message routing
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── publisher.rs
│   │   │   └── subscriber.rs
│   │   └── Cargo.toml
│   │
│   ├── eva-ics-connector/   # EVA-ICS integration
│   │   ├── src/
│   │   │   ├── main.rs
│   │   │   ├── eva_client.rs
│   │   │   └── bridge.rs
│   │   └── Cargo.toml
│   │
│   ├── shared/              # Shared data types
│   │   ├── src/
│   │   │   └── lib.rs
│   │   └── Cargo.toml
│   │
│   ├── Cargo.toml           # Workspace configuration
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── components/      # React components
│   │   │   ├── Header.tsx
│   │   │   ├── SwimlaneDiagram.tsx
│   │   │   ├── TimeSeriesChart.tsx
│   │   │   ├── SpotValues.tsx
│   │   │   └── IsometricView.tsx
│   │   │
│   │   ├── pages/           # Page components
│   │   │   └── Dashboard.tsx
│   │   │
│   │   ├── services/        # API and Zenoh clients
│   │   │   ├── apiService.ts
│   │   │   └── zenohService.ts
│   │   │
│   │   ├── themes/          # Styling
│   │   │   └── fendtTheme.ts
│   │   │
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── Dockerfile
│
├── config/
│   ├── zenoh-router.json5
│   └── backend.toml
│
├── docs/
│   ├── architecture.md
│   ├── configuration.md
│   └── development.md
│
├── docker-compose.yml
├── Makefile
├── .gitignore
├── .env.example
└── README.md
```

## Backend Development

### Adding a New Sensor Type

1. Define the data structure in `backend/shared/src/lib.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VibrationType {
    pub sensor_id: String,
    pub machine_id: String,
    pub frequency: f64,
    pub amplitude: f64,
    pub timestamp: DateTime<Utc>,
}
```

2. Add EVA-ICS polling in `backend/eva-ics-connector/src/bridge.rs`:

```rust
pub async fn sync_vibration_sensors(
    eva_client: &EvaIcsClient,
    zenoh_session: &Session,
) -> Result<()> {
    let sensors = eva_client.list_sensors_by_type("vibration").await?;

    for sensor in sensors {
        let key = format!("fendtastic/vibration/{}", sensor.oid);
        let payload = serde_json::to_string(&sensor)?;
        zenoh_session.put(&key, payload).await?;
    }

    Ok(())
}
```

3. Add API endpoint in `backend/api-server/src/handlers.rs`:

```rust
pub async fn get_vibration_data(
    state: web::Data<AppState>,
    machine_id: web::Path<String>,
) -> impl Responder {
    // Query Zenoh for vibration data
    let key = format!("fendtastic/vibration/{}", machine_id);
    // Implementation...
}
```

### Adding a New API Endpoint

1. Define handler in `backend/api-server/src/handlers.rs`
2. Register route in `backend/api-server/src/main.rs`:

```rust
.service(
    web::scope("/api/v1")
        .route("/your-endpoint", web::get().to(handlers::your_handler))
)
```

### Testing Backend Components

```bash
# Test specific component
cd backend
cargo test --package api-server

# Test with logging
RUST_LOG=debug cargo test

# Run integration tests
cargo test --test integration_tests
```

## Frontend Development

### Adding a New Component

1. Create component file in `frontend/src/components/`:

```tsx
import React from 'react'
import { Box, Typography } from '@mui/material'

interface MyComponentProps {
  data: any
}

const MyComponent: React.FC<MyComponentProps> = ({ data }) => {
  return (
    <Box>
      <Typography>My Component</Typography>
    </Box>
  )
}

export default MyComponent
```

2. Import and use in `Dashboard.tsx`

### Subscribing to Zenoh Data

```tsx
import { useEffect, useState } from 'react'
import zenohService from '@/services/zenohService'

const MyComponent: React.FC = () => {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    const unsubscribe = zenohService.subscribe(
      'fendtastic/sensors/**',
      (payload) => {
        setData(payload)
      }
    )

    return () => unsubscribe()
  }, [])

  return <div>{JSON.stringify(data)}</div>
}
```

### Customizing Theme

Edit `frontend/src/themes/fendtTheme.ts`:

```typescript
export const fendtTheme = createTheme({
  palette: {
    primary: {
      main: '#6EC72D', // Fendt Green
    },
    // Add more colors...
  },
  typography: {
    // Customize fonts...
  },
})
```

### Testing Frontend Components

```bash
cd frontend

# Run dev server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Adding New Features

### Example: Add Machine Control Panel

1. **Backend**: Add control endpoint

```rust
// backend/api-server/src/handlers.rs
pub async fn control_machine(
    state: web::Data<AppState>,
    machine_id: web::Path<String>,
    command: web::Json<ControlCommand>,
) -> impl Responder {
    // Publish command to Zenoh
    let key = format!("fendtastic/commands/{}/{}", machine_id, command.action);
    state.zenoh_session.put(&key, command.to_string()).await;

    HttpResponse::Ok().json(json!({"status": "command sent"}))
}
```

2. **EVA-ICS Connector**: Handle command

```rust
// backend/eva-ics-connector/src/bridge.rs
pub async fn handle_control_command(
    eva_client: &EvaIcsClient,
    machine_id: &str,
    command: &ControlCommand,
) -> Result<()> {
    eva_client.set_unit_action(
        &format!("unit:{}", machine_id),
        serde_json::to_value(command)?,
    ).await
}
```

3. **Frontend**: Add control panel component

```tsx
// frontend/src/components/ControlPanel.tsx
const ControlPanel: React.FC = () => {
  const handleCommand = async (action: string) => {
    await apiService.controlMachine('machine-001', action)
  }

  return (
    <Box>
      <Button onClick={() => handleCommand('start')}>Start</Button>
      <Button onClick={() => handleCommand('stop')}>Stop</Button>
    </Box>
  )
}
```

## Code Style

### Rust
- Follow Rust standard naming conventions
- Use `rustfmt` for formatting: `cargo fmt`
- Run clippy for linting: `cargo clippy`

### TypeScript
- Use functional components with hooks
- Prefer named exports
- Use TypeScript strict mode

## Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: add my feature"

# Push and create PR
git push origin feature/my-feature
```

## Debugging

### Backend Debugging

Enable detailed logging:

```bash
RUST_LOG=trace cargo run --bin api-server
```

### Frontend Debugging

Use browser DevTools:
- Network tab: Monitor API calls and WebSocket
- Console: Check for JavaScript errors
- React DevTools: Inspect component state

### Zenoh Debugging

Monitor all Zenoh traffic:

```bash
# Subscribe to all topics
zenoh-cli subscribe "**"
```
