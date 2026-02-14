# Deployment Guide

## Docker Deployment (Recommended)

### Quick Start

1. Clone the repository:
```bash
git clone <repository-url>
cd fendtastic
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your EVA-ICS credentials and settings
```

3. Start services:
```bash
docker-compose up -d
```

4. Access the dashboard:
```
http://localhost:3000
```

### Docker Compose Services

The `docker-compose.yml` defines three services:

- **zenoh-router**: Message routing backbone
  - Ports: 7447 (TCP), 8000 (WebSocket)

- **backend**: Rust services (API server, bridge, EVA-ICS connector)
  - Port: 8080 (API)

- **frontend**: React application
  - Port: 3000 (HTTP)

### Scaling Services

To run multiple backend instances:

```bash
docker-compose up -d --scale backend=3
```

Add a load balancer (nginx) in front of backend services.

## Manual Deployment

### System Requirements

- Linux (Ubuntu 20.04+ recommended)
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ storage

### Backend Deployment

1. Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Build release binaries:
```bash
cd backend
cargo build --release
```

3. Install binaries:
```bash
sudo cp target/release/api-server /usr/local/bin/
sudo cp target/release/zenoh-bridge /usr/local/bin/
sudo cp target/release/eva-ics-connector /usr/local/bin/
```

4. Create systemd services:

`/etc/systemd/system/fendtastic-api.service`:
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

`/etc/systemd/system/fendtastic-eva-connector.service`:
```ini
[Unit]
Description=Fendtastic EVA-ICS Connector
After=network.target

[Service]
Type=simple
User=fendtastic
WorkingDirectory=/opt/fendtastic
EnvironmentFile=/opt/fendtastic/.env
ExecStart=/usr/local/bin/eva-ics-connector
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

5. Enable and start services:
```bash
sudo systemctl daemon-reload
sudo systemctl enable fendtastic-api fendtastic-eva-connector
sudo systemctl start fendtastic-api fendtastic-eva-connector
```

### Zenoh Router Deployment

```bash
# Install Zenoh
wget https://github.com/eclipse-zenoh/zenoh/releases/download/0.11.0/zenohd
chmod +x zenohd
sudo mv zenohd /usr/local/bin/

# Create systemd service
sudo cat > /etc/systemd/system/zenoh-router.service <<EOF
[Unit]
Description=Zenoh Router
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/zenohd -c /opt/fendtastic/config/zenoh-router.json5
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable zenoh-router
sudo systemctl start zenoh-router
```

### Frontend Deployment

#### Option 1: Nginx Static Hosting

1. Build frontend:
```bash
cd frontend
npm install
npm run build
```

2. Copy build to nginx:
```bash
sudo cp -r dist/* /var/www/fendtastic/
```

3. Configure nginx:

`/etc/nginx/sites-available/fendtastic`:
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/fendtastic;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

4. Enable site:
```bash
sudo ln -s /etc/nginx/sites-available/fendtastic /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Option 2: Node.js Server

```bash
npm install -g serve
serve -s dist -l 3000
```

## Production Checklist

### Security

- [ ] Change default EVA-ICS API key
- [ ] Enable HTTPS/TLS with Let's Encrypt
- [ ] Configure firewall rules
- [ ] Set up authentication for frontend
- [ ] Restrict Zenoh router access
- [ ] Use secrets management (Vault, AWS Secrets Manager)

### Monitoring

- [ ] Set up logging aggregation (ELK, Grafana Loki)
- [ ] Configure metrics collection (Prometheus)
- [ ] Set up alerting (Alertmanager)
- [ ] Monitor system resources

### Backup

- [ ] Configure Zenoh storage persistence
- [ ] Back up configuration files
- [ ] Document recovery procedures

### Performance

- [ ] Enable Zenoh batching for high throughput
- [ ] Configure CDN for frontend assets
- [ ] Optimize database queries (if added)
- [ ] Set up caching layers

## Cloud Deployment

### AWS

1. **EC2 Instance**:
   - Launch t3.medium or larger
   - Security groups: Allow 80, 443, 7447, 8000, 8080

2. **Docker Setup**:
```bash
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# Install docker-compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.20.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

3. **Deploy**:
```bash
git clone <repository-url>
cd fendtastic
cp .env.example .env
# Configure .env
docker-compose up -d
```

### Kubernetes

See `k8s/` directory for Kubernetes manifests (to be added).

## Troubleshooting

### Service Not Starting

Check logs:
```bash
# Docker
docker-compose logs -f backend

# Systemd
sudo journalctl -u fendtastic-api -f
```

### High CPU Usage

- Check Zenoh message throughput
- Reduce EVA-ICS poll frequency
- Scale horizontally

### Memory Leaks

Monitor with:
```bash
# Docker
docker stats

# System
htop
```

### Network Issues

Test connectivity:
```bash
# Zenoh
telnet localhost 7447

# API
curl http://localhost:8080/health

# WebSocket
wscat -c ws://localhost:8000
```
