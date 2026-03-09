use anyhow::Result;
use async_trait::async_trait;
use serde_json::Value;
use shared::domain::driver::DriverInstance;
use shared::domain::runtime::NeuronConnection;

use crate::driver_backend::*;
use crate::neuron_client::NeuronHttpClient;

pub struct NeuronBackend {
    conn: NeuronConnection,
    client: NeuronHttpClient,
}

impl NeuronBackend {
    pub fn new(conn: NeuronConnection) -> Self {
        Self {
            conn,
            client: NeuronHttpClient::new(),
        }
    }
}

#[async_trait]
impl DriverBackend for NeuronBackend {
    async fn sync_driver(&self, driver: &DriverInstance) -> Result<()> {
        self.client.sync_driver(&self.conn, driver).await
    }

    async fn start_driver(&self, driver: &DriverInstance) -> Result<()> {
        self.client.start_driver(&self.conn, driver).await
    }

    async fn stop_driver(&self, driver: &DriverInstance) -> Result<()> {
        self.client.stop_driver(&self.conn, driver).await
    }

    async fn get_driver_state(&self, driver: &DriverInstance) -> Result<Option<BackendDriverState>> {
        match self.client.get_node_state(&self.conn, driver).await? {
            Some(state) => Ok(Some(BackendDriverState {
                running: state.running == 3,
                link: Some(state.link),
                rtt: state.rtt,
            })),
            None => Ok(None),
        }
    }

    async fn read_tag(&self, driver: &DriverInstance, group: &str, tag_name: &str) -> Result<TagReadResult> {
        let result = self.client.read_tag(&self.conn, driver, group, tag_name).await?;
        Ok(TagReadResult {
            name: result.name,
            value: result.value,
            error: result.error,
        })
    }

    async fn write_tag(&self, driver: &DriverInstance, group: &str, tag_name: &str, value: Value) -> Result<()> {
        self.client.write_tag(&self.conn, driver, group, tag_name, value).await
    }

    async fn browse_tags(&self, driver: &DriverInstance) -> Result<Vec<BrowseGroup>> {
        let groups = self.client.browse_driver_tags(&self.conn, driver).await?;
        Ok(groups
            .into_iter()
            .map(|(g, tags)| BrowseGroup {
                name: g.name,
                interval: g.interval,
                tags: tags
                    .into_iter()
                    .map(|t| BrowseTag {
                        name: t.name,
                        address: t.address,
                        data_type: t.data_type,
                        attribute: t.attribute,
                        description: t.description,
                    })
                    .collect(),
            })
            .collect())
    }

    fn node_name(&self, driver: &DriverInstance) -> String {
        crate::neuron_client::neuron_node_name(driver)
    }
}
