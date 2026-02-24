use crate::eva_client::EvaIcsClient;
use crate::pea_deployer::PeaDeployer;
use anyhow::Result;
use shared::mtp::*;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{error, info, warn};
use zenoh::Session;

/// Tracks deployed PEAs and their configurations
pub struct PeaBridge {
    eva_client: EvaIcsClient,
    deployer: PeaDeployer,
    zenoh_session: Session,
    /// Deployed PEA configs keyed by pea_id
    deployed_peas: Arc<RwLock<HashMap<String, PeaConfig>>>,
}

impl PeaBridge {
    pub fn new(eva_client: EvaIcsClient, zenoh_session: Session) -> Self {
        let deployer = PeaDeployer::new(eva_client.clone());
        Self {
            eva_client,
            deployer,
            zenoh_session,
            deployed_peas: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Listens for deploy, lifecycle, and service command messages on Zenoh
    pub async fn run_command_listener(&self) -> Result<()> {
        info!("Starting PeaBridge command listener");

        // Subscribe to deploy commands
        let deploy_sub = self
            .zenoh_session
            .declare_subscriber(topics::PEA_DEPLOY_WILDCARD)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to subscribe to deploy topic: {}", e))?;

        // Subscribe to lifecycle commands (start/stop)
        let lifecycle_sub = self
            .zenoh_session
            .declare_subscriber(topics::PEA_LIFECYCLE_WILDCARD)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to subscribe to lifecycle topic: {}", e))?;

        // Subscribe to service commands
        let service_cmd_sub = self
            .zenoh_session
            .declare_subscriber(topics::PEA_SERVICE_COMMAND_WILDCARD)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to subscribe to service command topic: {}", e))?;

        info!("PeaBridge subscribed to deploy, lifecycle, and service command topics");

        loop {
            tokio::select! {
                sample = deploy_sub.recv_async() => {
                    match sample {
                        Ok(sample) => {
                            let key = sample.key_expr().as_str().to_string();
                            let payload = sample.payload().try_to_string()
                                .unwrap_or_else(|e| e.to_string().into()).to_string();
                            self.handle_deploy_message(&key, &payload).await;
                        }
                        Err(e) => {
                            error!("Deploy subscriber error: {}", e);
                            break;
                        }
                    }
                }
                sample = lifecycle_sub.recv_async() => {
                    match sample {
                        Ok(sample) => {
                            let key = sample.key_expr().as_str().to_string();
                            let payload = sample.payload().try_to_string()
                                .unwrap_or_else(|e| e.to_string().into()).to_string();
                            self.handle_lifecycle_message(&key, &payload).await;
                        }
                        Err(e) => {
                            error!("Lifecycle subscriber error: {}", e);
                            break;
                        }
                    }
                }
                sample = service_cmd_sub.recv_async() => {
                    match sample {
                        Ok(sample) => {
                            let key = sample.key_expr().as_str().to_string();
                            let payload = sample.payload().try_to_string()
                                .unwrap_or_else(|e| e.to_string().into()).to_string();
                            self.handle_service_command(&key, &payload).await;
                        }
                        Err(e) => {
                            error!("Service command subscriber error: {}", e);
                            break;
                        }
                    }
                }
            }
        }

        Ok(())
    }

    /// Handles deploy/undeploy commands from Zenoh
    async fn handle_deploy_message(&self, key: &str, payload: &str) {
        // Extract pea_id from key: murph/pea/{pea_id}/deploy
        let pea_id = match extract_pea_id_from_key(key) {
            Some(id) => id,
            None => {
                warn!("Could not extract PEA ID from key: {}", key);
                return;
            }
        };

        let msg: serde_json::Value = match serde_json::from_str(payload) {
            Ok(v) => v,
            Err(e) => {
                error!("Failed to parse deploy message: {}", e);
                return;
            }
        };

        let action = msg["action"].as_str().unwrap_or("");

        match action {
            "deploy" => {
                if let Some(config_val) = msg.get("pea_config") {
                    match serde_json::from_value::<PeaConfig>(config_val.clone()) {
                        Ok(config) => {
                            info!("Deploying PEA: {} ({})", config.name, pea_id);
                            match self.deployer.deploy(&config).await {
                                Ok(plan) => {
                                    info!(
                                        "PEA {} deployed: {} items, controller: {}",
                                        pea_id,
                                        plan.items.len(),
                                        plan.controller_service.is_some()
                                    );

                                    // Track deployed PEA
                                    self.deployed_peas
                                        .write()
                                        .await
                                        .insert(pea_id.clone(), config.clone());

                                    // Publish status update
                                    let status = PeaInstanceStatus {
                                        pea_id: pea_id.clone(),
                                        deployed: true,
                                        running: false,
                                        services: config
                                            .services
                                            .iter()
                                            .map(|s| ServiceRuntimeState {
                                                tag: s.tag.clone(),
                                                state: ServiceState::Idle,
                                                current_procedure_id: None,
                                                operation_mode: OperationMode::Offline,
                                                source_mode: SourceMode::Internal,
                                            })
                                            .collect(),
                                        opcua_endpoint: Some(config.opcua_config.endpoint.clone()),
                                        last_updated: chrono::Utc::now(),
                                    };
                                    self.publish_pea_status(&pea_id, &status).await;
                                }
                                Err(e) => error!("Failed to deploy PEA {}: {}", pea_id, e),
                            }
                        }
                        Err(e) => error!("Failed to parse PEA config: {}", e),
                    }
                }
            }
            "undeploy" => {
                info!("Undeploying PEA: {}", pea_id);
                match self.deployer.undeploy(&pea_id).await {
                    Ok(()) => {
                        self.deployed_peas.write().await.remove(&pea_id);
                        info!("PEA {} undeployed", pea_id);
                    }
                    Err(e) => error!("Failed to undeploy PEA {}: {}", pea_id, e),
                }
            }
            _ => warn!("Unknown deploy action: {}", action),
        }
    }

    /// Handles start/stop lifecycle commands
    async fn handle_lifecycle_message(&self, key: &str, payload: &str) {
        let pea_id = match extract_pea_id_from_key(key) {
            Some(id) => id,
            None => {
                warn!("Could not extract PEA ID from lifecycle key: {}", key);
                return;
            }
        };

        let msg: serde_json::Value = match serde_json::from_str(payload) {
            Ok(v) => v,
            Err(e) => {
                error!("Failed to parse lifecycle message: {}", e);
                return;
            }
        };

        let action = msg["action"].as_str().unwrap_or("");

        match action {
            "start" => {
                info!("Starting PEA: {}", pea_id);
                let deployed = self.deployed_peas.read().await;
                if let Some(config) = deployed.get(&pea_id) {
                    // Set all service states to Execute
                    for service in &config.services {
                        let state_oid = format!("lvar:pea/{}/{}/state", pea_id, service.tag);
                        if let Err(e) = self
                            .eva_client
                            .set_item_state(
                                &state_oid,
                                1,
                                serde_json::json!(ServiceState::Execute.code()),
                            )
                            .await
                        {
                            error!("Failed to set state for {}: {}", state_oid, e);
                        }

                        // Publish service state to Zenoh
                        let topic = topics::pea_service_state(&pea_id, &service.tag);
                        let state_msg = serde_json::json!({
                            "state": ServiceState::Execute,
                            "state_code": ServiceState::Execute.code(),
                        });
                        let _ = self.zenoh_session.put(&topic, state_msg.to_string()).await;
                    }

                    // Update PEA status
                    let status = PeaInstanceStatus {
                        pea_id: pea_id.clone(),
                        deployed: true,
                        running: true,
                        services: config
                            .services
                            .iter()
                            .map(|s| ServiceRuntimeState {
                                tag: s.tag.clone(),
                                state: ServiceState::Execute,
                                current_procedure_id: None,
                                operation_mode: OperationMode::Automatic,
                                source_mode: SourceMode::External,
                            })
                            .collect(),
                        opcua_endpoint: Some(config.opcua_config.endpoint.clone()),
                        last_updated: chrono::Utc::now(),
                    };
                    self.publish_pea_status(&pea_id, &status).await;
                } else {
                    warn!("Cannot start PEA {}: not deployed", pea_id);
                }
            }
            "stop" => {
                info!("Stopping PEA: {}", pea_id);
                let deployed = self.deployed_peas.read().await;
                if let Some(config) = deployed.get(&pea_id) {
                    for service in &config.services {
                        let state_oid = format!("lvar:pea/{}/{}/state", pea_id, service.tag);
                        if let Err(e) = self
                            .eva_client
                            .set_item_state(
                                &state_oid,
                                1,
                                serde_json::json!(ServiceState::Idle.code()),
                            )
                            .await
                        {
                            error!("Failed to set state for {}: {}", state_oid, e);
                        }

                        let topic = topics::pea_service_state(&pea_id, &service.tag);
                        let state_msg = serde_json::json!({
                            "state": ServiceState::Idle,
                            "state_code": ServiceState::Idle.code(),
                        });
                        let _ = self.zenoh_session.put(&topic, state_msg.to_string()).await;
                    }

                    let status = PeaInstanceStatus {
                        pea_id: pea_id.clone(),
                        deployed: true,
                        running: false,
                        services: config
                            .services
                            .iter()
                            .map(|s| ServiceRuntimeState {
                                tag: s.tag.clone(),
                                state: ServiceState::Idle,
                                current_procedure_id: None,
                                operation_mode: OperationMode::Offline,
                                source_mode: SourceMode::Internal,
                            })
                            .collect(),
                        opcua_endpoint: Some(config.opcua_config.endpoint.clone()),
                        last_updated: chrono::Utc::now(),
                    };
                    self.publish_pea_status(&pea_id, &status).await;
                } else {
                    warn!("Cannot stop PEA {}: not deployed", pea_id);
                }
            }
            _ => warn!("Unknown lifecycle action for PEA {}: {}", pea_id, action),
        }
    }

    /// Handles individual service commands (from POL or UI)
    async fn handle_service_command(&self, key: &str, payload: &str) {
        // key: murph/habitat/nodes/{node_id}/pea/{pea_id}/services/{service_tag}/command
        let parts: Vec<&str> = key.split('/').collect();
        if parts.len() < 8 {
            warn!("Invalid service command key: {}", key);
            return;
        }
        let pea_id = parts[5];
        let service_tag = parts[7];

        let msg: serde_json::Value = match serde_json::from_str(payload) {
            Ok(v) => v,
            Err(e) => {
                error!("Failed to parse service command: {}", e);
                return;
            }
        };

        info!(
            "Service command for PEA {}, service {}: {:?}",
            pea_id, service_tag, msg
        );

        // Write command to EVA-ICS lvar
        let cmd_oid = format!("lvar:pea/{}/{}/command", pea_id, service_tag);
        if let Some(cmd_code) = msg["command_code"].as_u64() {
            if let Err(e) = self
                .eva_client
                .set_item_state(&cmd_oid, 1, serde_json::json!(cmd_code))
                .await
            {
                error!("Failed to write service command to {}: {}", cmd_oid, e);
            }
        }

        // If a procedure is selected, update the current procedure lvar
        if let Some(proc_id) = msg["procedure_id"].as_u64() {
            let proc_oid = format!("lvar:pea/{}/{}/procedure_cur", pea_id, service_tag);
            if let Err(e) = self
                .eva_client
                .set_item_state(&proc_oid, 1, serde_json::json!(proc_id))
                .await
            {
                error!("Failed to set procedure for {}: {}", proc_oid, e);
            }
        }
    }

    /// Reads EVA-ICS item states for deployed PEAs and publishes to Zenoh
    pub async fn sync_pea_states(&self) -> Result<()> {
        let deployed = self.deployed_peas.read().await;

        for (pea_id, config) in deployed.iter() {
            let mut service_states = Vec::new();
            let mut running = false;

            for service in &config.services {
                let state_oid = format!("lvar:pea/{}/{}/state", pea_id, service.tag);
                let state = match self.eva_client.get_item_states(&state_oid).await {
                    Ok(items) if !items.is_empty() => {
                        let code = items[0]
                            .value
                            .as_ref()
                            .and_then(|v| v.as_u64())
                            .unwrap_or(ServiceState::Idle.code() as u64)
                            as u32;
                        ServiceState::from_code(code).unwrap_or(ServiceState::Idle)
                    }
                    _ => ServiceState::Idle,
                };

                if state == ServiceState::Execute {
                    running = true;
                }

                // Read current procedure
                let proc_oid = format!("lvar:pea/{}/{}/procedure_cur", pea_id, service.tag);
                let current_procedure_id = match self.eva_client.get_item_states(&proc_oid).await {
                    Ok(items) if !items.is_empty() => items[0]
                        .value
                        .as_ref()
                        .and_then(|v| v.as_u64())
                        .map(|v| v as u32),
                    _ => None,
                };

                // Publish per-service state
                let topic = topics::pea_service_state(pea_id, &service.tag);
                let state_msg = serde_json::json!({
                    "state": state,
                    "state_code": state.code(),
                    "current_procedure_id": current_procedure_id,
                });
                let _ = self.zenoh_session.put(&topic, state_msg.to_string()).await;

                service_states.push(ServiceRuntimeState {
                    tag: service.tag.clone(),
                    state,
                    current_procedure_id,
                    operation_mode: if state == ServiceState::Execute {
                        OperationMode::Automatic
                    } else {
                        OperationMode::Offline
                    },
                    source_mode: SourceMode::External,
                });
            }

            // Publish PEA-level status
            let status = PeaInstanceStatus {
                pea_id: pea_id.clone(),
                deployed: true,
                running,
                services: service_states,
                opcua_endpoint: Some(config.opcua_config.endpoint.clone()),
                last_updated: chrono::Utc::now(),
            };
            self.publish_pea_status(pea_id, &status).await;
        }

        Ok(())
    }

    /// Publishes PEA announcement for auto-discovery by Heptapod POL
    pub async fn publish_announcements(&self) {
        let deployed = self.deployed_peas.read().await;

        for (pea_id, config) in deployed.iter() {
            let topic = topics::pea_announce(pea_id);
            let announcement = serde_json::json!({
                "pea_id": pea_id,
                "name": config.name,
                "version": config.version,
                "services": config.services.iter().map(|s| serde_json::json!({
                    "tag": s.tag,
                    "name": s.name,
                })).collect::<Vec<_>>(),
                "opcua_endpoint": config.opcua_config.endpoint,
                "timestamp": chrono::Utc::now().to_rfc3339(),
            });
            let _ = self
                .zenoh_session
                .put(&topic, announcement.to_string())
                .await;
        }
    }

    async fn publish_pea_status(&self, pea_id: &str, status: &PeaInstanceStatus) {
        let topic = topics::pea_status(pea_id);
        match serde_json::to_string(status) {
            Ok(json) => {
                let _ = self.zenoh_session.put(&topic, json).await;
            }
            Err(e) => error!("Failed to serialize PEA status: {}", e),
        }
    }
}

/// Syncs all sensor states from EVA-ICS to Zenoh (backward compat with Dashboard)
pub async fn sync_sensors(eva_client: &EvaIcsClient, zenoh_session: &Session) -> Result<()> {
    let sensors = eva_client.list_sensors().await?;

    for sensor in sensors {
        let key = format!("murph/eva-ics/sensors/{}", sensor.oid);
        let payload = serde_json::json!({
            "oid": sensor.oid,
            "status": sensor.status,
            "value": sensor.value,
            "timestamp": sensor.t
        });
        zenoh_session
            .put(&key, payload.to_string())
            .await
            .map_err(|e| anyhow::anyhow!(e))?;
    }

    // Publish EVA-ICS status
    let status_payload = serde_json::json!({
        "online": true,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    zenoh_session
        .put(topics::STATUS_EVA_ICS, status_payload.to_string())
        .await
        .map_err(|e| anyhow::anyhow!(e))?;

    Ok(())
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/// Extracts pea_id from a Zenoh key like "murph/pea/{pea_id}/..."
fn extract_pea_id_from_key(key: &str) -> Option<String> {
    let parts: Vec<&str> = key.split('/').collect();
    if parts.len() >= 6 && parts[0] == "murph" && parts[4] == "pea" {
        Some(parts[5].to_string())
    } else {
        None
    }
}
