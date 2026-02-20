use actix_web::{web, HttpResponse, Responder};
use crate::state::AppState;
use serde::Deserialize;
use tracing::{info, error};

// ─── Query Parameters ────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct KeysQuery {
    pub prefix: Option<String>,
}

#[derive(Deserialize)]
pub struct ConfigUpdateBody {
    pub admin_key: String,
    pub value: serde_json::Value,
}

// ─── Helper: query Zenoh and collect results ─────────────────────────────────

async fn query_zenoh(
    session: &zenoh::Session,
    selector: &str,
) -> Result<Vec<serde_json::Value>, String> {
    let replies = session
        .get(selector)
        .await
        .map_err(|e| format!("Zenoh get failed: {}", e))?;

    let mut results = Vec::new();

    while let Ok(reply) = replies.recv_async().await {
        match reply.into_result() {
            Ok(sample) => {
                let key = sample.key_expr().as_str().to_string();
                let payload_str = sample
                    .payload()
                    .try_to_string()
                    .unwrap_or_else(|e| e.to_string().into())
                    .to_string();

                let value = serde_json::from_str::<serde_json::Value>(&payload_str)
                    .unwrap_or(serde_json::Value::String(payload_str));

                results.push(serde_json::json!({
                    "key": key,
                    "value": value,
                }));
            }
            Err(err) => {
                let payload_str = err
                    .payload()
                    .try_to_string()
                    .unwrap_or_else(|e| std::borrow::Cow::Owned(e.to_string()))
                    .to_string();
                results.push(serde_json::json!({
                    "error": payload_str,
                }));
            }
        }
    }

    Ok(results)
}

// ─── GET /mesh/nodes ─────────────────────────────────────────────────────────

/// Returns connected Zenoh sessions (nodes) from the admin space.
pub async fn get_nodes(state: web::Data<AppState>) -> impl Responder {
    let session = &*state.zenoh_session;

    // Also grab our own ZID
    let local_zid = session.zid().to_string();

    match query_zenoh(session, "@/*/session/**").await {
        Ok(raw_entries) => {
            // Group entries by source ZID
            let mut nodes: std::collections::HashMap<String, serde_json::Value> =
                std::collections::HashMap::new();

            for entry in &raw_entries {
                if let Some(key) = entry["key"].as_str() {
                    // Admin keys look like: @/<zid>/session/<peer_zid>
                    let parts: Vec<&str> = key.split('/').collect();
                    if parts.len() >= 4 {
                        let src_zid = parts[1];
                        let peer_zid = parts[3];

                        let node = nodes.entry(peer_zid.to_string()).or_insert_with(|| {
                            serde_json::json!({
                                "zid": peer_zid,
                                "whatami": "unknown",
                                "locators": [],
                                "links": [],
                                "source_zid": src_zid,
                            })
                        });

                        // Merge info from the value
                        if let Some(val) = entry.get("value") {
                            if let Some(whatami) = val.get("whatami").and_then(|w| w.as_str()) {
                                node["whatami"] = serde_json::Value::String(whatami.to_string());
                            }
                            if let Some(locators) = val.get("locators") {
                                node["locators"] = locators.clone();
                            }
                            // Copy all raw fields for transparency
                            if let Some(obj) = val.as_object() {
                                for (k, v) in obj {
                                    if k != "whatami" && k != "locators" {
                                        node[k] = v.clone();
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Add our own session
            let mut node_list: Vec<serde_json::Value> = nodes.into_values().collect();
            node_list.push(serde_json::json!({
                "zid": local_zid,
                "whatami": "peer",
                "locators": [],
                "links": [],
                "is_local": true,
            }));

            HttpResponse::Ok().json(serde_json::json!({
                "local_zid": local_zid,
                "nodes": node_list,
                "raw_entries": raw_entries,
            }))
        }
        Err(e) => {
            error!("Failed to query mesh nodes: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e,
            }))
        }
    }
}

// ─── GET /mesh/router ────────────────────────────────────────────────────────

/// Returns router configuration and info from the admin space.
pub async fn get_router_info(state: web::Data<AppState>) -> impl Responder {
    let session = &*state.zenoh_session;
    let local_zid = session.zid().to_string();

    match query_zenoh(session, "@/*/router/**").await {
        Ok(entries) => {
            HttpResponse::Ok().json(serde_json::json!({
                "local_zid": local_zid,
                "entries": entries,
            }))
        }
        Err(e) => {
            error!("Failed to query router info: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e,
            }))
        }
    }
}

// ─── GET /mesh/links ─────────────────────────────────────────────────────────

/// Returns transport link details from the admin space.
pub async fn get_links(state: web::Data<AppState>) -> impl Responder {
    let session = &*state.zenoh_session;

    match query_zenoh(session, "@/*/transport/unicast/**").await {
        Ok(entries) => HttpResponse::Ok().json(entries),
        Err(e) => {
            error!("Failed to query mesh links: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e,
            }))
        }
    }
}

// ─── GET /mesh/keys?prefix=fendtastic/** ─────────────────────────────────────

/// Lists stored keys and their latest values by querying the Zenoh storage.
pub async fn get_keys(
    state: web::Data<AppState>,
    query: web::Query<KeysQuery>,
) -> impl Responder {
    let prefix = query
        .prefix
        .as_deref()
        .unwrap_or("fendtastic/**");

    let session = &*state.zenoh_session;

    match query_zenoh(session, prefix).await {
        Ok(entries) => {
            let keys: Vec<serde_json::Value> = entries
                .into_iter()
                .map(|e| {
                    serde_json::json!({
                        "key_expr": e["key"],
                        "value": e["value"],
                        "encoding": "application/json",
                        "timestamp": serde_json::Value::Null,
                    })
                })
                .collect();
            HttpResponse::Ok().json(keys)
        }
        Err(e) => {
            error!("Failed to query keys: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e,
            }))
        }
    }
}

// ─── GET /mesh/keys/{key_expr:.*} ────────────────────────────────────────────

/// Gets a specific key's current value.
pub async fn get_key_value(
    state: web::Data<AppState>,
    key_expr: web::Path<String>,
) -> impl Responder {
    let session = &*state.zenoh_session;

    match query_zenoh(session, key_expr.as_str()).await {
        Ok(entries) => {
            if entries.is_empty() {
                HttpResponse::NotFound().json(serde_json::json!({
                    "error": "Key not found",
                    "key_expr": key_expr.as_str(),
                }))
            } else {
                HttpResponse::Ok().json(serde_json::json!({
                    "key_expr": key_expr.as_str(),
                    "results": entries,
                }))
            }
        }
        Err(e) => {
            error!("Failed to get key value: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": e,
            }))
        }
    }
}

// ─── POST /mesh/config ───────────────────────────────────────────────────────

/// Pushes a config update to the Zenoh admin space.
pub async fn update_config(
    state: web::Data<AppState>,
    body: web::Json<ConfigUpdateBody>,
) -> impl Responder {
    let session = &*state.zenoh_session;

    // Validate admin key starts with @/
    if !body.admin_key.starts_with("@/") {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "admin_key must start with @/",
        }));
    }

    let payload = body.value.to_string();
    info!("Updating admin config: {} = {}", body.admin_key, payload);

    match session.put(&body.admin_key, payload).await {
        Ok(_) => HttpResponse::Ok().json(serde_json::json!({
            "status": "updated",
            "admin_key": body.admin_key,
        })),
        Err(e) => {
            error!("Failed to update config: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Admin put failed: {}", e),
            }))
        }
    }
}

// ─── POST /mesh/generate-config ──────────────────────────────────────────────

/// Generates a Zenoh configuration JSON for a new node.
pub async fn generate_node_config(
    body: web::Json<serde_json::Value>,
) -> impl Responder {
    let mode = body["mode"].as_str().unwrap_or("client");
    let listen = body["listen_endpoints"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let connect = body["connect_endpoints"]
        .as_array()
        .cloned()
        .unwrap_or_default();
    let multicast_scouting = body["multicast_scouting"].as_bool().unwrap_or(true);
    let storage_enabled = body["storage_enabled"].as_bool().unwrap_or(false);
    let storage_key_expr = body["storage_key_expr"]
        .as_str()
        .unwrap_or("fendtastic/**");

    let mut config = serde_json::json!({
        "mode": mode,
        "connect": {
            "endpoints": connect,
        },
        "listen": {
            "endpoints": listen,
        },
        "scouting": {
            "multicast": {
                "enabled": multicast_scouting,
                "address": "224.0.0.224:7446",
                "interface": "auto",
            },
        },
        "timestamping": {
            "enabled": true,
        },
    });

    if storage_enabled {
        config["plugins"] = serde_json::json!({
            "storage_manager": {
                "volumes": {
                    "memory": { "backend": "memory" },
                },
                "storages": {
                    "default": {
                        "key_expr": storage_key_expr,
                        "volume": "memory",
                    },
                },
            },
        });
    }

    info!("Generated Zenoh config for mode={}", mode);
    HttpResponse::Ok().json(config)
}
