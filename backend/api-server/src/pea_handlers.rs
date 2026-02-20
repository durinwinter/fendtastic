use actix_web::{web, HttpResponse, Responder};
use shared::mtp::{PeaConfig, Recipe};
use crate::state::AppState;
use chrono::Utc;
use uuid::Uuid;
use tracing::{info, error};

// ─── PEA Configuration CRUD ─────────────────────────────────────────────────

pub async fn list_peas(state: web::Data<AppState>) -> impl Responder {
    let configs = state.pea_configs.read().await;
    let peas: Vec<&PeaConfig> = configs.values().collect();
    HttpResponse::Ok().json(peas)
}

pub async fn get_pea(
    state: web::Data<AppState>,
    pea_id: web::Path<String>,
) -> impl Responder {
    let configs = state.pea_configs.read().await;
    match configs.get(pea_id.as_str()) {
        Some(config) => HttpResponse::Ok().json(config),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "PEA not found"})),
    }
}

pub async fn create_pea(
    state: web::Data<AppState>,
    body: web::Json<PeaConfig>,
) -> impl Responder {
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

pub async fn delete_pea(
    state: web::Data<AppState>,
    pea_id: web::Path<String>,
) -> impl Responder {
    let mut configs = state.pea_configs.write().await;
    configs.remove(pea_id.as_str());
    delete_pea_file(&state.pea_config_dir, &pea_id);

    info!("Deleted PEA config: {}", pea_id);
    HttpResponse::NoContent().finish()
}

// ─── PEA Lifecycle ───────────────────────────────────────────────────────────

pub async fn deploy_pea(
    state: web::Data<AppState>,
    pea_id: web::Path<String>,
) -> impl Responder {
    let configs = state.pea_configs.read().await;
    match configs.get(pea_id.as_str()) {
        Some(config) => {
            let deploy_msg = serde_json::json!({
                "action": "deploy",
                "pea_config": config
            });
            let topic = shared::mtp::topics::pea_deploy(&pea_id);
            match state.zenoh_session.put(&topic, deploy_msg.to_string()).await {
                Ok(_) => {
                    info!("Deploy command sent for PEA: {}", pea_id);
                    HttpResponse::Accepted().json(serde_json::json!({
                        "status": "deploying",
                        "pea_id": pea_id.as_str()
                    }))
                }
                Err(e) => {
                    error!("Failed to publish deploy command: {}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": format!("Failed to publish deploy: {}", e)
                    }))
                }
            }
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "PEA not found"})),
    }
}

pub async fn start_pea(
    state: web::Data<AppState>,
    pea_id: web::Path<String>,
) -> impl Responder {
    let cmd = serde_json::json!({"action": "start"});
    let topic = shared::mtp::topics::pea_lifecycle(&pea_id);
    match state.zenoh_session.put(&topic, cmd.to_string()).await {
        Ok(_) => {
            info!("Start command sent for PEA: {}", pea_id);
            HttpResponse::Accepted().json(serde_json::json!({"status": "starting"}))
        }
        Err(e) => {
            error!("Failed to send start command: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to start: {}", e)
            }))
        }
    }
}

pub async fn stop_pea(
    state: web::Data<AppState>,
    pea_id: web::Path<String>,
) -> impl Responder {
    let cmd = serde_json::json!({"action": "stop"});
    let topic = shared::mtp::topics::pea_lifecycle(&pea_id);
    match state.zenoh_session.put(&topic, cmd.to_string()).await {
        Ok(_) => {
            info!("Stop command sent for PEA: {}", pea_id);
            HttpResponse::Accepted().json(serde_json::json!({"status": "stopping"}))
        }
        Err(e) => {
            error!("Failed to send stop command: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": format!("Failed to stop: {}", e)
            }))
        }
    }
}

// ─── Recipe CRUD ─────────────────────────────────────────────────────────────

pub async fn list_recipes(state: web::Data<AppState>) -> impl Responder {
    let recipes = state.recipes.read().await;
    let list: Vec<&Recipe> = recipes.values().collect();
    HttpResponse::Ok().json(list)
}

pub async fn create_recipe(
    state: web::Data<AppState>,
    body: web::Json<Recipe>,
) -> impl Responder {
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

pub async fn execute_recipe(
    state: web::Data<AppState>,
    recipe_id: web::Path<String>,
) -> impl Responder {
    let recipes = state.recipes.read().await;
    match recipes.get(recipe_id.as_str()) {
        Some(recipe) => {
            let cmd = serde_json::json!({
                "action": "execute",
                "recipe": recipe
            });
            let topic = shared::mtp::topics::POL_RECIPES_COMMAND;
            match state.zenoh_session.put(topic, cmd.to_string()).await {
                Ok(_) => {
                    info!("Execute recipe command sent: {}", recipe.name);
                    HttpResponse::Accepted().json(serde_json::json!({
                        "status": "executing",
                        "recipe_id": recipe_id.as_str()
                    }))
                }
                Err(e) => {
                    error!("Failed to execute recipe: {}", e);
                    HttpResponse::InternalServerError().json(serde_json::json!({
                        "error": format!("Failed to execute: {}", e)
                    }))
                }
            }
        }
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Recipe not found"})),
    }
}

// ─── Persistence Helpers ─────────────────────────────────────────────────────

fn persist_pea_config(dir: &str, config: &PeaConfig) {
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
