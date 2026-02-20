use std::sync::Arc;
use std::collections::{HashMap, VecDeque};
use tokio::sync::RwLock;
use zenoh::Session;
use shared::mtp::{PeaConfig, Recipe};

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
        buf.push_back(TimeSeriesPoint { timestamp_ms, value });
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
    pub pea_config_dir: String,
    pub recipe_dir: String,
    pub timeseries: Arc<RwLock<TimeSeriesStore>>,
}
