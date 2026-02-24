use crate::state::{AppState, SimulatorRun, SimulatorTask};
use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use serde::Deserialize;
use shared::mtp::{PeaConfig, Recipe, ServiceCommand, ServiceState};
use std::time::Duration;
use tracing::{error, info};
use uuid::Uuid;

// ─── PEA Configuration CRUD ─────────────────────────────────────────────────

pub async fn list_peas(state: web::Data<AppState>) -> impl Responder {
    let configs = state.pea_configs.read().await;
    let peas: Vec<&PeaConfig> = configs.values().collect();
    HttpResponse::Ok().json(peas)
}

pub async fn get_pea(state: web::Data<AppState>, pea_id: web::Path<String>) -> impl Responder {
    let configs = state.pea_configs.read().await;
    match configs.get(pea_id.as_str()) {
        Some(config) => HttpResponse::Ok().json(config),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "PEA not found"})),
    }
}

pub async fn create_pea(state: web::Data<AppState>, body: web::Json<PeaConfig>) -> impl Responder {
    let mut config = body.into_inner();
    if config.id.is_empty() {
        config.id = Uuid::new_v4().to_string();
    }
    config.created_at = Utc::now();
    config.updated_at = Utc::now();

    let id = config.id.clone();
    persist_pea_config(&state.pea_config_dir, &config);

    let mut configs = state.pea_configs.write().await;
    configs.insert(id, config.clone());

    info!("Created PEA config: {} ({})", config.name, config.id);
    HttpResponse::Created().json(config)
}

pub async fn update_pea(
    state: web::Data<AppState>,
    pea_id: web::Path<String>,
    body: web::Json<PeaConfig>,
) -> impl Responder {
    let mut config = body.into_inner();
    config.id = pea_id.to_string();
    config.updated_at = Utc::now();

    persist_pea_config(&state.pea_config_dir, &config);

    let mut configs = state.pea_configs.write().await;
    configs.insert(pea_id.to_string(), config.clone());

    info!("Updated PEA config: {} ({})", config.name, config.id);
    HttpResponse::Ok().json(config)
}

pub async fn delete_pea(state: web::Data<AppState>, pea_id: web::Path<String>) -> impl Responder {
    let mut configs = state.pea_configs.write().await;
    configs.remove(pea_id.as_str());
    delete_pea_file(&state.pea_config_dir, &pea_id);

    info!("Deleted PEA config: {}", pea_id);
    HttpResponse::NoContent().finish()
}

// ─── PEA Lifecycle ───────────────────────────────────────────────────────────

pub async fn deploy_pea(state: web::Data<AppState>, pea_id: web::Path<String>) -> impl Responder {
    let configs = state.pea_configs.read().await;
    match configs.get(pea_id.as_str()) {
        Some(config) => {
            // Publish deploy command to Zenoh (for eva-ics-connector if running)
            let deploy_msg = serde_json::json!({
                "action": "deploy",
                "pea_config": config
            });
            let topic = shared::mtp::topics::pea_deploy(&pea_id);
            let _ = state
                .zenoh_session
                .put(&topic, deploy_msg.to_string())
                .await;

            // Publish deployed status directly so frontend gets immediate feedback
            let status = serde_json::json!({
                "pea_id": pea_id.as_str(),
                "deployed": true,
                "running": false,
                "services": config.services.iter().map(|s| serde_json::json!({
                    "tag": s.tag,
                    "state": "Idle",
                    "state_code": 16,
                    "operation_mode": "Offline",
                    "source_mode": "Internal",
                })).collect::<Vec<_>>(),
                "last_updated": chrono::Utc::now().to_rfc3339(),
            });
            let status_topic = shared::mtp::topics::pea_status(&pea_id);
            let _ = state
                .zenoh_session
                .put(&status_topic, status.to_string())
                .await;

            info!("PEA deployed: {} ({})", config.name, pea_id);
            HttpResponse::Accepted().json(serde_json::json!({
                "status": "deployed",
                "pea_id": pea_id.as_str()
            }))
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "PEA not found"})),
    }
}

pub async fn undeploy_pea(state: web::Data<AppState>, pea_id: web::Path<String>) -> impl Responder {
    let pea_id_str = pea_id.into_inner();
    let exists = {
        let configs = state.pea_configs.read().await;
        configs.contains_key(&pea_id_str)
    };
    if !exists {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "PEA not found"}));
    }

    let undeploy_msg = serde_json::json!({ "action": "undeploy" });
    let topic = shared::mtp::topics::pea_deploy(&pea_id_str);
    let _ = state
        .zenoh_session
        .put(&topic, undeploy_msg.to_string())
        .await;

    let status = serde_json::json!({
        "pea_id": &pea_id_str,
        "deployed": false,
        "running": false,
        "services": [],
        "last_updated": chrono::Utc::now().to_rfc3339(),
    });
    let status_topic = shared::mtp::topics::pea_status(&pea_id_str);
    let _ = state
        .zenoh_session
        .put(&status_topic, status.to_string())
        .await;

    {
        let mut sims = state.running_sims.write().await;
        if let Some(handle) = sims.remove(&pea_id_str) {
            handle.handle.abort();
        }
    }

    HttpResponse::Accepted().json(serde_json::json!({
        "status": "undeployed",
        "pea_id": pea_id_str,
    }))
}

#[derive(Debug, Deserialize)]
pub struct ServiceCommandRequest {
    pub command: ServiceCommand,
    pub procedure_id: Option<u32>,
}

pub async fn command_service(
    state: web::Data<AppState>,
    path: web::Path<(String, String)>,
    body: web::Json<ServiceCommandRequest>,
) -> impl Responder {
    let (pea_id, service_tag) = path.into_inner();
    let req = body.into_inner();

    let exists = {
        let configs = state.pea_configs.read().await;
        configs
            .get(&pea_id)
            .is_some_and(|c| c.services.iter().any(|s| s.tag == service_tag))
    };
    if !exists {
        return HttpResponse::NotFound().json(serde_json::json!({
            "error": "PEA or service not found"
        }));
    }

    let payload = serde_json::json!({
        "command": req.command,
        "command_code": req.command.code(),
        "procedure_id": req.procedure_id,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });
    let topic = shared::mtp::topics::pea_service_command(&pea_id, &service_tag);
    match state.zenoh_session.put(&topic, payload.to_string()).await {
        Ok(_) => HttpResponse::Accepted().json(serde_json::json!({
            "status": "command_sent",
            "pea_id": pea_id,
            "service_tag": service_tag,
        })),
        Err(e) => HttpResponse::InternalServerError().json(serde_json::json!({
            "error": format!("Failed to publish command: {}", e),
        })),
    }
}

pub async fn start_pea(state: web::Data<AppState>, pea_id: web::Path<String>) -> impl Responder {
    let pea_id_str = pea_id.into_inner();

    // Check PEA exists
    let config_name = {
        let configs = state.pea_configs.read().await;
        match configs.get(&pea_id_str) {
            Some(c) => c.name.clone(),
            None => {
                return HttpResponse::NotFound().json(serde_json::json!({"error": "PEA not found"}))
            }
        }
    };

    // Also publish lifecycle command for eva-ics-connector
    let cmd = serde_json::json!({"action": "start"});
    let topic = shared::mtp::topics::pea_lifecycle(&pea_id_str);
    let _ = state.zenoh_session.put(&topic, cmd.to_string()).await;

    // Start the built-in simulator
    {
        let mut sims = state.running_sims.write().await;
        // Stop existing sim if any
        if let Some(handle) = sims.remove(&pea_id_str) {
            handle.handle.abort();
        }
        let run = SimulatorRun {
            scenario_id: "baseline_cycle".to_string(),
            scenario_name: "Baseline Work Cycle".to_string(),
            started_at: chrono::Utc::now().to_rfc3339(),
            duration_s: u64::MAX,
            tick_ms: 1000,
            time_ratio: 128.0,
        };
        let handle = crate::simulator::spawn_simulator(
            state.zenoh_session.clone(),
            pea_id_str.clone(),
            Some("baseline_cycle"),
        );
        sims.insert(pea_id_str.clone(), SimulatorTask { handle, run });
    }

    // Publish running status directly
    {
        let configs = state.pea_configs.read().await;
        if let Some(config) = configs.get(&pea_id_str) {
            let status = serde_json::json!({
                "pea_id": &pea_id_str,
                "deployed": true,
                "running": true,
                "services": config.services.iter().map(|s| serde_json::json!({
                    "tag": s.tag,
                    "state": "Execute",
                    "state_code": 64,
                    "operation_mode": "Automatic",
                    "source_mode": "External",
                })).collect::<Vec<_>>(),
                "last_updated": chrono::Utc::now().to_rfc3339(),
            });
            let status_topic = shared::mtp::topics::pea_status(&pea_id_str);
            let _ = state
                .zenoh_session
                .put(&status_topic, status.to_string())
                .await;
        }
    }

    info!(
        "PEA started (with simulator): {} ({})",
        config_name, pea_id_str
    );
    HttpResponse::Accepted().json(serde_json::json!({
        "status": "running",
        "pea_id": &pea_id_str,
        "simulator": true,
    }))
}

pub async fn stop_pea(state: web::Data<AppState>, pea_id: web::Path<String>) -> impl Responder {
    let pea_id_str = pea_id.into_inner();

    // Also publish lifecycle command for eva-ics-connector
    let cmd = serde_json::json!({"action": "stop"});
    let topic = shared::mtp::topics::pea_lifecycle(&pea_id_str);
    let _ = state.zenoh_session.put(&topic, cmd.to_string()).await;

    // Stop the simulator
    {
        let mut sims = state.running_sims.write().await;
        if let Some(handle) = sims.remove(&pea_id_str) {
            handle.handle.abort();
            info!("Simulator stopped for PEA: {}", pea_id_str);
        }
    }

    // Publish idle status directly
    {
        let configs = state.pea_configs.read().await;
        if let Some(config) = configs.get(&pea_id_str) {
            let status = serde_json::json!({
                "pea_id": &pea_id_str,
                "deployed": true,
                "running": false,
                "services": config.services.iter().map(|s| serde_json::json!({
                    "tag": s.tag,
                    "state": "Idle",
                    "state_code": 16,
                    "operation_mode": "Offline",
                    "source_mode": "Internal",
                })).collect::<Vec<_>>(),
                "last_updated": chrono::Utc::now().to_rfc3339(),
            });
            let status_topic = shared::mtp::topics::pea_status(&pea_id_str);
            let _ = state
                .zenoh_session
                .put(&status_topic, status.to_string())
                .await;
        }
    }

    info!("PEA stopped: {}", pea_id_str);
    HttpResponse::Accepted().json(serde_json::json!({
        "status": "stopped",
        "pea_id": &pea_id_str,
    }))
}

// ─── Recipe CRUD ─────────────────────────────────────────────────────────────

pub async fn list_recipes(state: web::Data<AppState>) -> impl Responder {
    let recipes = state.recipes.read().await;
    let list: Vec<&Recipe> = recipes.values().collect();
    HttpResponse::Ok().json(list)
}

pub async fn create_recipe(state: web::Data<AppState>, body: web::Json<Recipe>) -> impl Responder {
    let mut recipe = body.into_inner();
    if recipe.id.is_empty() {
        recipe.id = Uuid::new_v4().to_string();
    }
    recipe.created_at = Utc::now();

    let id = recipe.id.clone();
    persist_recipe(&state.recipe_dir, &recipe);

    let mut recipes = state.recipes.write().await;
    recipes.insert(id, recipe.clone());

    info!("Created recipe: {} ({})", recipe.name, recipe.id);
    HttpResponse::Created().json(recipe)
}

pub async fn update_recipe(
    state: web::Data<AppState>,
    recipe_id: web::Path<String>,
    body: web::Json<Recipe>,
) -> impl Responder {
    let mut recipe = body.into_inner();
    recipe.id = recipe_id.to_string();
    persist_recipe(&state.recipe_dir, &recipe);

    let mut recipes = state.recipes.write().await;
    recipes.insert(recipe.id.clone(), recipe.clone());
    HttpResponse::Ok().json(recipe)
}

pub async fn delete_recipe(
    state: web::Data<AppState>,
    recipe_id: web::Path<String>,
) -> impl Responder {
    let mut recipes = state.recipes.write().await;
    recipes.remove(recipe_id.as_str());
    delete_recipe_file(&state.recipe_dir, recipe_id.as_str());
    HttpResponse::NoContent().finish()
}

pub async fn execute_recipe(
    state: web::Data<AppState>,
    recipe_id: web::Path<String>,
) -> impl Responder {
    let recipe = {
        let recipes = state.recipes.read().await;
        match recipes.get(recipe_id.as_str()) {
            Some(recipe) => recipe.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Recipe not found"}))
            }
        }
    };

    let execution_id = Uuid::new_v4().to_string();
    let mut steps = recipe.steps.clone();
    steps.sort_by_key(|s| s.order);
    let total_steps = steps.len();

    // Enforce orchestration topology: each cross-PEA transition must follow an edge.
    {
        let topology = state.topology.read().await;
        if steps.len() > 1 {
            for pair in steps.windows(2) {
                let prev = &pair[0];
                let next = &pair[1];
                if prev.pea_id == next.pea_id {
                    continue;
                }
                if topology.edges.is_empty() {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": "Topology is empty. Define PEA connections before executing cross-PEA recipes."
                    }));
                }
                let allowed = topology
                    .edges
                    .iter()
                    .any(|e| e.from == prev.pea_id && e.to == next.pea_id);
                if !allowed {
                    return HttpResponse::BadRequest().json(serde_json::json!({
                        "error": format!(
                            "Topology violation: no connection from '{}' to '{}' for recipe step transition.",
                            prev.pea_id, next.pea_id
                        )
                    }));
                }
            }
        }
    }

    {
        let mut execs = state.recipe_executions.write().await;
        execs.insert(
            execution_id.clone(),
            serde_json::json!({
                "execution_id": execution_id,
                "recipe_id": recipe.id,
                "recipe_name": recipe.name,
                "current_step": 0,
                "total_steps": total_steps,
                "step_statuses": vec!["pending"; total_steps],
                "state": "running",
                "started_at": chrono::Utc::now().to_rfc3339(),
                "updated_at": chrono::Utc::now().to_rfc3339(),
            }),
        );
    }

    let zenoh = state.zenoh_session.clone();
    let executions = state.recipe_executions.clone();
    let timeseries = state.timeseries.clone();
    let execution_id_task = execution_id.clone();
    tokio::spawn(async move {
        let mut step_statuses = vec!["pending".to_string(); total_steps];

        for (idx, step) in steps.iter().enumerate() {
            step_statuses[idx] = "executing".to_string();
            update_exec_status(
                &executions,
                &execution_id_task,
                idx + 1,
                total_steps,
                &step_statuses,
                "running",
            )
            .await;

            let topic = shared::mtp::topics::pea_service_command(&step.pea_id, &step.service_tag);
            let payload = serde_json::json!({
                "command": step.command,
                "command_code": step.command.code(),
                "procedure_id": step.procedure_id,
                "parameters": step.parameters,
                "timestamp": chrono::Utc::now().to_rfc3339(),
            });

            if let Err(e) = zenoh.put(&topic, payload.to_string()).await {
                error!("Recipe step publish failed for {}: {}", topic, e);
                step_statuses[idx] = "failed".to_string();
                update_exec_status(
                    &executions,
                    &execution_id_task,
                    idx + 1,
                    total_steps,
                    &step_statuses,
                    "failed",
                )
                .await;
                return;
            }

            if let Some(wait_state) = step.wait_for_state {
                let timeout_ms = step.timeout_ms.unwrap_or(30000);
                let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
                let status_key = shared::mtp::topics::pea_status(&step.pea_id);
                let mut reached = false;

                while std::time::Instant::now() < deadline {
                    {
                        let ts = timeseries.read().await;
                        if let Some(buf) = ts.data.get(&status_key) {
                            if let Some(last) = buf.back() {
                                if let Some(services) =
                                    last.value.get("services").and_then(|v| v.as_array())
                                {
                                    if services.iter().any(|svc| {
                                        svc.get("tag").and_then(|t| t.as_str())
                                            == Some(step.service_tag.as_str())
                                            && svc.get("state").and_then(|s| s.as_str())
                                                == Some(service_state_name(wait_state))
                                    }) {
                                        reached = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    tokio::time::sleep(Duration::from_millis(500)).await;
                }

                if !reached {
                    step_statuses[idx] = "failed".to_string();
                    update_exec_status(
                        &executions,
                        &execution_id_task,
                        idx + 1,
                        total_steps,
                        &step_statuses,
                        "failed",
                    )
                    .await;
                    return;
                }
            }

            step_statuses[idx] = "completed".to_string();
            update_exec_status(
                &executions,
                &execution_id_task,
                idx + 1,
                total_steps,
                &step_statuses,
                "running",
            )
            .await;
        }

        update_exec_status(
            &executions,
            &execution_id_task,
            total_steps,
            total_steps,
            &step_statuses,
            "completed",
        )
        .await;
    });

    HttpResponse::Accepted().json(serde_json::json!({
        "status": "executing",
        "execution_id": execution_id,
        "recipe_id": recipe_id.as_str(),
    }))
}

pub async fn list_recipe_executions(state: web::Data<AppState>) -> impl Responder {
    let execs = state.recipe_executions.read().await;
    let list: Vec<serde_json::Value> = execs.values().cloned().collect();
    HttpResponse::Ok().json(list)
}

pub async fn get_recipe_execution(
    state: web::Data<AppState>,
    execution_id: web::Path<String>,
) -> impl Responder {
    let execs = state.recipe_executions.read().await;
    match execs.get(execution_id.as_str()) {
        Some(status) => HttpResponse::Ok().json(status),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Execution not found"})),
    }
}

// ─── Persistence Helpers ─────────────────────────────────────────────────────

fn persist_pea_config(dir: &str, config: &PeaConfig) {
    if let Err(e) = std::fs::create_dir_all(dir) {
        error!("Failed to create PEA config dir {}: {}", dir, e);
        return;
    }
    let path = format!("{}/{}.json", dir, config.id);
    match serde_json::to_string_pretty(config) {
        Ok(json) => {
            if let Err(e) = std::fs::write(&path, json) {
                error!("Failed to persist PEA config to {}: {}", path, e);
            }
        }
        Err(e) => error!("Failed to serialize PEA config: {}", e),
    }
}

fn delete_pea_file(dir: &str, pea_id: &str) {
    let path = format!("{}/{}.json", dir, pea_id);
    if let Err(e) = std::fs::remove_file(&path) {
        if e.kind() != std::io::ErrorKind::NotFound {
            error!("Failed to delete PEA config file {}: {}", path, e);
        }
    }
}

fn persist_recipe(dir: &str, recipe: &Recipe) {
    if let Err(e) = std::fs::create_dir_all(dir) {
        error!("Failed to create recipe dir {}: {}", dir, e);
        return;
    }
    let path = format!("{}/{}.json", dir, recipe.id);
    match serde_json::to_string_pretty(recipe) {
        Ok(json) => {
            if let Err(e) = std::fs::write(&path, json) {
                error!("Failed to persist recipe to {}: {}", path, e);
            }
        }
        Err(e) => error!("Failed to serialize recipe: {}", e),
    }
}

fn delete_recipe_file(dir: &str, recipe_id: &str) {
    let path = format!("{}/{}.json", dir, recipe_id);
    if let Err(e) = std::fs::remove_file(&path) {
        if e.kind() != std::io::ErrorKind::NotFound {
            error!("Failed to delete recipe file {}: {}", path, e);
        }
    }
}

async fn update_exec_status(
    executions: &tokio::sync::RwLock<std::collections::HashMap<String, serde_json::Value>>,
    execution_id: &str,
    current_step: usize,
    total_steps: usize,
    step_statuses: &[String],
    state: &str,
) {
    let mut execs = executions.write().await;
    let mut base = execs
        .get(execution_id)
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));
    base["execution_id"] = serde_json::json!(execution_id);
    base["current_step"] = serde_json::json!(current_step);
    base["total_steps"] = serde_json::json!(total_steps);
    base["step_statuses"] = serde_json::json!(step_statuses);
    base["state"] = serde_json::json!(state);
    base["updated_at"] = serde_json::json!(chrono::Utc::now().to_rfc3339());
    execs.insert(execution_id.to_string(), base);
}

fn service_state_name(state: ServiceState) -> &'static str {
    match state {
        ServiceState::Idle => "Idle",
        ServiceState::Starting => "Starting",
        ServiceState::Execute => "Execute",
        ServiceState::Completing => "Completing",
        ServiceState::Completed => "Completed",
        ServiceState::Pausing => "Pausing",
        ServiceState::Paused => "Paused",
        ServiceState::Resuming => "Resuming",
        ServiceState::Holding => "Holding",
        ServiceState::Held => "Held",
        ServiceState::Unholding => "Unholding",
        ServiceState::Stopping => "Stopping",
        ServiceState::Stopped => "Stopped",
        ServiceState::Aborting => "Aborting",
        ServiceState::Aborted => "Aborted",
        ServiceState::Resetting => "Resetting",
    }
}

pub fn load_recipes(dir: &str) -> std::collections::HashMap<String, Recipe> {
    let mut recipes = std::collections::HashMap::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                if let Err(create_err) = std::fs::create_dir_all(dir) {
                    error!("Failed to create recipe dir {}: {}", dir, create_err);
                }
            }
            return recipes;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "json") {
            match std::fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<Recipe>(&content) {
                    Ok(recipe) => {
                        info!("Loaded recipe: {} ({})", recipe.name, recipe.id);
                        recipes.insert(recipe.id.clone(), recipe);
                    }
                    Err(e) => error!("Failed to parse recipe {:?}: {}", path, e),
                },
                Err(e) => error!("Failed to read recipe {:?}: {}", path, e),
            }
        }
    }

    info!("Loaded {} recipes", recipes.len());
    recipes
}

pub fn load_pea_configs(dir: &str) -> std::collections::HashMap<String, PeaConfig> {
    let mut configs = std::collections::HashMap::new();

    let entries = match std::fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                if let Err(create_err) = std::fs::create_dir_all(dir) {
                    error!("Failed to create PEA config dir {}: {}", dir, create_err);
                }
            } else {
                error!("Failed to read PEA config dir {}: {}", dir, e);
            }
            return configs;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "json") {
            match std::fs::read_to_string(&path) {
                Ok(content) => match serde_json::from_str::<PeaConfig>(&content) {
                    Ok(config) => {
                        info!("Loaded PEA config: {} ({})", config.name, config.id);
                        configs.insert(config.id.clone(), config);
                    }
                    Err(e) => error!("Failed to parse PEA config {:?}: {}", path, e),
                },
                Err(e) => error!("Failed to read PEA config {:?}: {}", path, e),
            }
        }
    }

    info!("Loaded {} PEA configurations", configs.len());
    configs
}
