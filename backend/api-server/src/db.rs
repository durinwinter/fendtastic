use chrono::{DateTime, Utc};
use tokio_postgres::{Client, NoTls};
use tracing::{error, info};

use crate::state::{AlarmRecord, AlarmRule, BlackoutWindow, PolEdge, PolTopology};

pub async fn connect_and_migrate(db_url: &str) -> anyhow::Result<Client> {
    let (client, connection) = tokio_postgres::connect(db_url, NoTls).await?;
    tokio::spawn(async move {
        if let Err(e) = connection.await {
            error!("Postgres connection error: {}", e);
        }
    });

    client
        .batch_execute(
            "
            CREATE TABLE IF NOT EXISTS alarms (
                id TEXT PRIMARY KEY,
                severity TEXT NOT NULL,
                status TEXT NOT NULL,
                source TEXT NOT NULL,
                event TEXT NOT NULL,
                value TEXT NOT NULL,
                description TEXT NOT NULL,
                timestamp TIMESTAMPTZ NOT NULL,
                duplicate_count INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE IF NOT EXISTS alarm_rules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                severity TEXT NOT NULL,
                source_pattern TEXT NOT NULL,
                event_pattern TEXT NOT NULL,
                enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS blackout_windows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                starts_at TIMESTAMPTZ NOT NULL,
                ends_at TIMESTAMPTZ NOT NULL,
                scope TEXT NOT NULL DEFAULT 'global',
                created_at TIMESTAMPTZ NOT NULL
            );

            CREATE TABLE IF NOT EXISTS topology_edges (
                source_pea TEXT NOT NULL,
                target_pea TEXT NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL,
                PRIMARY KEY (source_pea, target_pea)
            );
            ",
        )
        .await?;

    info!("Postgres migrations ensured");
    Ok(client)
}

pub async fn load_alarms(
    client: &Client,
) -> anyhow::Result<std::collections::HashMap<String, AlarmRecord>> {
    let rows = client
        .query(
            "SELECT id, severity, status, source, event, value, description, timestamp, duplicate_count FROM alarms",
            &[],
        )
        .await?;
    let mut alarms = std::collections::HashMap::new();
    for row in rows {
        let id: String = row.get(0);
        alarms.insert(
            id.clone(),
            AlarmRecord {
                id,
                severity: row.get(1),
                status: row.get(2),
                source: row.get(3),
                event: row.get(4),
                value: row.get(5),
                description: row.get(6),
                timestamp: row.get::<_, DateTime<Utc>>(7).to_rfc3339(),
                duplicate_count: row.get::<_, i32>(8) as u32,
            },
        );
    }
    Ok(alarms)
}

pub async fn load_alarm_rules(
    client: &Client,
) -> anyhow::Result<std::collections::HashMap<String, AlarmRule>> {
    let rows = client
        .query(
            "SELECT id, name, severity, source_pattern, event_pattern, enabled, created_at, updated_at FROM alarm_rules",
            &[],
        )
        .await?;
    let mut rules = std::collections::HashMap::new();
    for row in rows {
        let id: String = row.get(0);
        rules.insert(
            id.clone(),
            AlarmRule {
                id,
                name: row.get(1),
                severity: row.get(2),
                source_pattern: row.get(3),
                event_pattern: row.get(4),
                enabled: row.get(5),
                created_at: row.get::<_, DateTime<Utc>>(6).to_rfc3339(),
                updated_at: row.get::<_, DateTime<Utc>>(7).to_rfc3339(),
            },
        );
    }
    Ok(rules)
}

pub async fn load_blackouts(
    client: &Client,
) -> anyhow::Result<std::collections::HashMap<String, BlackoutWindow>> {
    let rows = client
        .query(
            "SELECT id, name, starts_at, ends_at, scope, created_at FROM blackout_windows",
            &[],
        )
        .await?;
    let mut windows = std::collections::HashMap::new();
    for row in rows {
        let id: String = row.get(0);
        windows.insert(
            id.clone(),
            BlackoutWindow {
                id,
                name: row.get(1),
                starts_at: row.get::<_, DateTime<Utc>>(2).to_rfc3339(),
                ends_at: row.get::<_, DateTime<Utc>>(3).to_rfc3339(),
                scope: row.get(4),
                created_at: row.get::<_, DateTime<Utc>>(5).to_rfc3339(),
            },
        );
    }
    Ok(windows)
}

pub async fn load_topology(client: &Client) -> anyhow::Result<PolTopology> {
    let rows = client
        .query("SELECT source_pea, target_pea, updated_at FROM topology_edges ORDER BY source_pea, target_pea", &[])
        .await?;
    let mut edges = Vec::new();
    let mut updated_at = Utc::now().to_rfc3339();
    for row in rows {
        edges.push(PolEdge {
            from: row.get::<_, String>(0),
            to: row.get::<_, String>(1),
        });
        updated_at = row.get::<_, DateTime<Utc>>(2).to_rfc3339();
    }
    Ok(PolTopology { edges, updated_at })
}
