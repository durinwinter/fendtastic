mod config_sync;
mod driver_catalog;
mod neuron_client;
mod runtime_bridge;

use tracing::Level;

#[tokio::main(flavor = "multi_thread")]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt().with_max_level(Level::INFO).init();
    let catalog = driver_catalog::built_in_catalog();
    tracing::info!("Starting neuron-connector with {} built-in drivers", catalog.len());
    Ok(())
}
