use shared::mtp::{PeaConfig, Recipe};
use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_postgres::Client;
use zenoh::Session;

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct AlarmRecord {
    pub id: String,
    pub severity: String,
    pub status: String,
    pub source: String,
    pub event: String,
    pub value: String,
    pub description: String,
    pub timestamp: String,
    pub duplicate_count: u32,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct PolEdge {
    pub from: String,
    pub to: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize, Default)]
pub struct PolTopology {
    pub edges: Vec<PolEdge>,
    pub updated_at: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct AlarmRule {
    pub id: String,
    pub name: String,
    pub severity: String,
    pub source_pattern: String,
    pub event_pattern: String,
    pub enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct BlackoutWindow {
    pub id: String,
    pub name: String,
    pub starts_at: String,
    pub ends_at: String,
    pub scope: String,
    pub created_at: String,
}

/// A single timestamped data point stored in the ring buffer.
#[derive(Clone, serde::Serialize)]
pub struct TimeSeriesPoint {
    pub timestamp_ms: i64,
    pub value: serde_json::Value,
}

/// Per-key ring buffer of historical data points.
pub struct TimeSeriesStore {
    /// key_expr -> ring buffer of data points (newest at back)
    pub data: HashMap<String, VecDeque<TimeSeriesPoint>>,
    /// Maximum points per key (older points are evicted)
    pub max_points_per_key: usize,
}

impl TimeSeriesStore {
    pub fn new(max_points_per_key: usize) -> Self {
        Self {
            data: HashMap::new(),
            max_points_per_key,
        }
    }

    pub fn insert(&mut self, key: String, value: serde_json::Value, timestamp_ms: i64) {
        let buf = self.data.entry(key).or_insert_with(VecDeque::new);
        buf.push_back(TimeSeriesPoint {
            timestamp_ms,
            value,
        });
        while buf.len() > self.max_points_per_key {
            buf.pop_front();
        }
    }

    /// Query points for a key within [start_ms, end_ms].
    pub fn query(&self, key: &str, start_ms: i64, end_ms: i64) -> Vec<&TimeSeriesPoint> {
        match self.data.get(key) {
            Some(buf) => buf
                .iter()
                .filter(|p| p.timestamp_ms >= start_ms && p.timestamp_ms <= end_ms)
                .collect(),
            None => Vec::new(),
        }
    }

    /// List all keys that have stored data.
    pub fn keys(&self) -> Vec<&String> {
        self.data.keys().collect()
    }
}

pub struct AppState {
    pub zenoh_session: Arc<Session>,
    pub pea_configs: Arc<RwLock<HashMap<String, PeaConfig>>>,
    pub recipes: Arc<RwLock<HashMap<String, Recipe>>>,
    pub recipe_executions: Arc<RwLock<HashMap<String, serde_json::Value>>>,
    pub scenario_runs: Arc<RwLock<HashMap<String, serde_json::Value>>>,
    pub alarms: Arc<RwLock<HashMap<String, AlarmRecord>>>,
    pub alarm_rules: Arc<RwLock<HashMap<String, AlarmRule>>>,
    pub blackout_windows: Arc<RwLock<HashMap<String, BlackoutWindow>>>,
    pub topology: Arc<RwLock<PolTopology>>,
    pub db_client: Arc<Client>,
    pub pea_config_dir: String,
    pub recipe_dir: String,
    pub pol_db_dir: String,
    pub timeseries: Arc<RwLock<TimeSeriesStore>>,
    /// Running simulator tasks keyed by pea_id
    pub running_sims: Arc<RwLock<HashMap<String, tokio::task::JoinHandle<()>>>>,
}
