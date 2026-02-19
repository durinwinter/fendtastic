use shared::mtp::*;
use crate::eva_client::EvaIcsClient;
use anyhow::Result;
use tracing::info;

pub struct PeaDeployer {
    eva_client: EvaIcsClient,
}

impl PeaDeployer {
    pub fn new(eva_client: EvaIcsClient) -> Self {
        Self { eva_client }
    }

    pub async fn deploy(&self, config: &PeaConfig) -> Result<EvaDeploymentPlan> {
        let pea_id = &config.id;
        let mut items = Vec::new();
        let mut node_mappings = Vec::new();

        // Create service-related items
        for service in &config.services {
            // lvar for service state (PackML state machine)
            let state_oid = format!("lvar:pea/{}/{}/state", pea_id, service.tag);
            items.push(serde_json::json!({
                "oid": state_oid,
                "enabled": true,
            }));

            // lvar for service command
            let cmd_oid = format!("lvar:pea/{}/{}/command", pea_id, service.tag);
            items.push(serde_json::json!({
                "oid": cmd_oid,
                "enabled": true,
            }));

            // lvar for current procedure
            let proc_oid = format!("lvar:pea/{}/{}/procedure_cur", pea_id, service.tag);
            items.push(serde_json::json!({
                "oid": proc_oid,
                "enabled": true,
            }));

            // Create items for procedure parameters and outputs
            for procedure in &service.procedures {
                for param in &procedure.parameters {
                    let (tag, mapping) = extract_param_tag_and_mapping(param);
                    let oid = format!("lvar:pea/{}/{}/proc/{}/{}", pea_id, service.tag, procedure.id, tag);
                    items.push(serde_json::json!({"oid": oid, "enabled": true}));

                    if let Some(m) = mapping {
                        if m.protocol == ProtocolType::OpcUa {
                            node_mappings.push(OpcUaNodeMapping {
                                oid,
                                node_id: m.address.clone(),
                                interval_ms: 100,
                            });
                        }
                    }
                }

                for pvo in &procedure.process_value_outs {
                    let (tag, mapping) = extract_indicator_tag_and_mapping(pvo);
                    let oid = format!("sensor:pea/{}/{}/pvo/{}", pea_id, service.tag, tag);
                    items.push(serde_json::json!({"oid": oid, "enabled": true}));

                    if let Some(m) = mapping {
                        if m.protocol == ProtocolType::OpcUa {
                            node_mappings.push(OpcUaNodeMapping {
                                oid,
                                node_id: m.address.clone(),
                                interval_ms: 100,
                            });
                        }
                    }
                }

                for rv in &procedure.report_values {
                    let (tag, mapping) = extract_indicator_tag_and_mapping(rv);
                    let oid = format!("sensor:pea/{}/{}/report/{}", pea_id, service.tag, tag);
                    items.push(serde_json::json!({"oid": oid, "enabled": true}));

                    if let Some(m) = mapping {
                        if m.protocol == ProtocolType::OpcUa {
                            node_mappings.push(OpcUaNodeMapping {
                                oid,
                                node_id: m.address.clone(),
                                interval_ms: 100,
                            });
                        }
                    }
                }
            }
        }

        // Create items for active elements
        for element in &config.active_elements {
            let element_items = create_active_element_items(pea_id, element);
            for (oid, mapping) in &element_items {
                items.push(serde_json::json!({"oid": oid, "enabled": true}));
                if let Some(m) = mapping {
                    if m.protocol == ProtocolType::OpcUa {
                        node_mappings.push(OpcUaNodeMapping {
                            oid: oid.clone(),
                            node_id: m.address.clone(),
                            interval_ms: 100,
                        });
                    }
                }
            }
        }

        // Deploy items to EVA-ICS
        info!("Deploying {} items for PEA {} ({})", items.len(), config.name, pea_id);
        self.eva_client.deploy_items(items.clone()).await?;

        // Initialize service states to Idle
        for service in &config.services {
            let state_oid = format!("lvar:pea/{}/{}/state", pea_id, service.tag);
            self.eva_client.set_item_state(
                &state_oid,
                1,
                serde_json::json!(ServiceState::Idle.code()),
            ).await?;
        }

        // Deploy OPC UA controller service if there are mappings
        let controller_config = if !node_mappings.is_empty() {
            let svc_id = format!("eva.controller.opcua.pea_{}", pea_id.replace('-', "_"));
            let pull_config: Vec<serde_json::Value> = node_mappings.iter()
                .map(|m| serde_json::json!({
                    "node": m.node_id,
                    "map": [{"oid": m.oid}],
                }))
                .collect();

            let svc_config = serde_json::json!({
                "id": svc_id,
                "params": {
                    "command": "svc/eva-controller-opcua",
                    "bus": {"path": "var/bus.ipc"},
                    "config": {
                        "url": config.opcua_config.endpoint,
                        "pull_interval": 1.0,
                        "pull": pull_config,
                    }
                }
            });

            info!("Deploying OPC UA controller service: {}", svc_id);
            self.eva_client.deploy_service(svc_config).await?;

            Some(EvaControllerConfig {
                id: svc_id,
                opcua_endpoint: config.opcua_config.endpoint.clone(),
                node_mappings: node_mappings.clone(),
            })
        } else {
            None
        };

        let eva_items = items.iter()
            .filter_map(|i| i["oid"].as_str().map(|s| EvaItem {
                oid: s.to_string(),
                enabled: true,
            }))
            .collect();

        Ok(EvaDeploymentPlan {
            pea_id: pea_id.clone(),
            items: eva_items,
            controller_service: controller_config,
        })
    }

    pub async fn undeploy(&self, pea_id: &str) -> Result<()> {
        // Get all items with the PEA's OID prefix
        let items = self.eva_client.get_item_states(&format!("#:pea/{}/**", pea_id)).await?;
        let oids: Vec<String> = items.iter().map(|i| i.oid.clone()).collect();

        if !oids.is_empty() {
            info!("Undeploying {} items for PEA {}", oids.len(), pea_id);
            self.eva_client.undeploy_items(oids).await?;
        }

        // Undeploy controller service
        let svc_id = format!("eva.controller.opcua.pea_{}", pea_id.replace('-', "_"));
        let _ = self.eva_client.undeploy_service(&svc_id).await;

        Ok(())
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn extract_param_tag_and_mapping(param: &ServiceParameter) -> (String, Option<&TagMapping>) {
    match param {
        ServiceParameter::Analog(p) => (p.tag.clone(), p.tag_mapping.as_ref()),
        ServiceParameter::Binary(p) => (p.tag.clone(), p.tag_mapping.as_ref()),
        ServiceParameter::DInt(p) => (p.tag.clone(), p.tag_mapping.as_ref()),
        ServiceParameter::StringParam(p) => (p.tag.clone(), p.tag_mapping.as_ref()),
    }
}

fn extract_indicator_tag_and_mapping(ind: &IndicatorElement) -> (String, Option<&TagMapping>) {
    match ind {
        IndicatorElement::AnaView(v) => (v.tag.clone(), v.tag_mapping.as_ref()),
        IndicatorElement::BinView(v) => (v.tag.clone(), v.tag_mapping.as_ref()),
        IndicatorElement::DIntView(v) => (v.tag.clone(), v.tag_mapping.as_ref()),
        IndicatorElement::StringView(v) => (v.tag.clone(), v.tag_mapping.as_ref()),
    }
}

fn create_active_element_items(pea_id: &str, element: &ActiveElement) -> Vec<(String, Option<&TagMapping>)> {
    let prefix = format!("unit:pea/{}/active", pea_id);
    match element {
        ActiveElement::BinVlv(v) => vec![
            (format!("{}/{}/open_fbk", prefix, v.tag), v.open_fbk_tag.as_ref()),
            (format!("{}/{}/close_fbk", prefix, v.tag), v.close_fbk_tag.as_ref()),
            (format!("{}/{}/open_cmd", prefix, v.tag), v.open_cmd_tag.as_ref()),
            (format!("{}/{}/close_cmd", prefix, v.tag), v.close_cmd_tag.as_ref()),
        ],
        ActiveElement::AnaVlv(v) => vec![
            (format!("{}/{}/pos_fbk", prefix, v.tag), v.pos_fbk_tag.as_ref()),
            (format!("{}/{}/pos_sp", prefix, v.tag), v.pos_sp_tag.as_ref()),
        ],
        ActiveElement::BinDrv(v) => vec![
            (format!("{}/{}/fwd_fbk", prefix, v.tag), v.fwd_fbk_tag.as_ref()),
            (format!("{}/{}/rev_fbk", prefix, v.tag), v.rev_fbk_tag.as_ref()),
            (format!("{}/{}/fwd_cmd", prefix, v.tag), v.fwd_cmd_tag.as_ref()),
            (format!("{}/{}/rev_cmd", prefix, v.tag), v.rev_cmd_tag.as_ref()),
            (format!("{}/{}/stop_cmd", prefix, v.tag), v.stop_cmd_tag.as_ref()),
        ],
        ActiveElement::AnaDrv(v) => vec![
            (format!("{}/{}/rpm_fbk", prefix, v.tag), v.rpm_fbk_tag.as_ref()),
            (format!("{}/{}/rpm_sp", prefix, v.tag), v.rpm_sp_tag.as_ref()),
            (format!("{}/{}/fwd_cmd", prefix, v.tag), v.fwd_cmd_tag.as_ref()),
            (format!("{}/{}/rev_cmd", prefix, v.tag), v.rev_cmd_tag.as_ref()),
            (format!("{}/{}/stop_cmd", prefix, v.tag), v.stop_cmd_tag.as_ref()),
        ],
        ActiveElement::PIDCtrl(v) => vec![
            (format!("{}/{}/pv", prefix, v.tag), v.pv_tag.as_ref()),
            (format!("{}/{}/sp", prefix, v.tag), v.sp_tag.as_ref()),
            (format!("{}/{}/mv", prefix, v.tag), v.mv_tag.as_ref()),
        ],
    }
}
