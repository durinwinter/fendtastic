use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;
use zenoh::Session;
use shared::mtp::{PeaConfig, Recipe};

pub struct AppState {
    pub zenoh_session: Arc<Session>,
    pub connections: Arc<RwLock<usize>>,
    pub pea_configs: Arc<RwLock<HashMap<String, PeaConfig>>>,
    pub recipes: Arc<RwLock<HashMap<String, Recipe>>>,
    pub pea_config_dir: String,
}
