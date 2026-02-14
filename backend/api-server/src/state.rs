use std::sync::Arc;
use tokio::sync::RwLock;
use zenoh::Session;

pub struct AppState {
    pub zenoh_session: Arc<Session>,
    pub connections: Arc<RwLock<usize>>,
}
