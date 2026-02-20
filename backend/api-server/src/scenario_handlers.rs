use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::process::{Command, Stdio};
use uuid::Uuid;
use chrono::Utc;
use tracing::{info, error};

use crate::state::AppState;

/// A running scenario process with metadata
#[derive(Clone, Debug, Serialize)]
#[allow(dead_code)]
pub struct RunningScenario {
    pub id: String,
    pub scenario_id: String,
    pub name: String,
    pub started_at: String,
    pub status: String, // "running", "completed", "failed"
    pub pid: u32,
    pub progress_percent: u32,
    pub message: String,
}

/// Response for listing available scenarios
#[derive(Debug, Serialize)]
pub struct ScenarioInfo {
    pub id: String,
    pub name: String,
    pub spec: String,
    pub priority: String,
    pub tags: Vec<String>,
    pub duration_sim_min: u32,
    pub timeout_real_s: u32,
}

#[derive(Debug, Deserialize)]
pub struct LaunchScenarioRequest {
    pub scenario_id: String,
    pub put_cmd: Option<String>, // Product Under Test command
    pub site: Option<String>,     // Zenoh site name (default: refinery_01)
}

#[derive(Debug, Serialize)]
pub struct LaunchScenarioResponse {
    pub run_id: String,
    pub scenario_id: String,
    pub started_at: String,
    pub status: String,
}

/// List available scenarios from durins-forge
pub async fn list_scenarios(
    _state: web::Data<AppState>,
) -> impl Responder {
    // In a real implementation, this would parse the scenario_matrix.yaml
    // For now, return a static list
    let scenarios = vec![
        ScenarioInfo {
            id: "S001".to_string(),
            name: "Baseline Throughput Under Normal Power".to_string(),
            spec: "factorio/specs/S001_baseline_throughput.md".to_string(),
            priority: "P1".to_string(),
            tags: vec!["power".to_string(), "baseline".to_string(), "throughput".to_string()],
            duration_sim_min: 15,
            timeout_real_s: 300,
        },
        ScenarioInfo {
            id: "S010".to_string(),
            name: "Recovery From Power Loss".to_string(),
            spec: "factorio/specs/S010_recovery_from_power_loss.md".to_string(),
            priority: "P1".to_string(),
            tags: vec!["power".to_string(), "recovery".to_string(), "brownout".to_string()],
            duration_sim_min: 30,
            timeout_real_s: 600,
        },
        ScenarioInfo {
            id: "S020".to_string(),
            name: "Sensor Noise and Debounce".to_string(),
            spec: "factorio/specs/S020_sensor_noise_debounce.md".to_string(),
            priority: "P1".to_string(),
            tags: vec!["fluids".to_string(), "noise".to_string(), "debounce".to_string()],
            duration_sim_min: 20,
            timeout_real_s: 400,
        },
        ScenarioInfo {
            id: "S030".to_string(),
            name: "Deadlock Detection — Fluid Circular Block".to_string(),
            spec: "factorio/specs/S030_deadlock_detection.md".to_string(),
            priority: "P1".to_string(),
            tags: vec!["fluids".to_string(), "deadlock".to_string()],
            duration_sim_min: 25,
            timeout_real_s: 500,
        },
    ];

    HttpResponse::Ok().json(json!({
        "scenarios": scenarios,
        "count": scenarios.len(),
    }))
}

/// Launch a scenario
pub async fn launch_scenario(
    state: web::Data<AppState>,
    req: web::Json<LaunchScenarioRequest>,
) -> impl Responder {
    let scenario_id = &req.scenario_id;
    let put_cmd = req.put_cmd.clone().unwrap_or_else(|| "none".to_string());
    let site = req.site.clone().unwrap_or_else(|| "refinery_01".to_string());

    // Generate a unique run ID
    let run_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();

    info!("Launching scenario: {} (run_id: {})", scenario_id, run_id);

    // Determine the durins-forge root directory
    // This assumes durins-forge is a sibling directory to fendtastic
    let durins_forge_root = std::env::var("DURINS_FORGE_ROOT")
        .unwrap_or_else(|_| "../durins-forge".to_string());

    // Build the command to run the scenario
    let shell_cmd = format!(
        "cd {} && PUT_CMD=\"{}\" PUT_SITE=\"{}\" ./harness/runner/run_one.sh {}",
        durins_forge_root, put_cmd, site, scenario_id
    );

    let mut cmd = Command::new("sh");
    cmd.arg("-c")
        .arg(&shell_cmd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match cmd.spawn() {
        Ok(mut child) => {
            let pid = child.id();
            info!("Scenario process started with PID: {}", pid);

            // Spawn a task to monitor the process
            let run_id_clone = run_id.clone();
            let scenario_id_clone = scenario_id.clone();
            tokio::spawn(async move {
                let _ = child.wait();
                info!("Scenario {} (run_id: {}) completed", scenario_id_clone, run_id_clone);
            });

            HttpResponse::Accepted().json(LaunchScenarioResponse {
                run_id: run_id.clone(),
                scenario_id: scenario_id.clone(),
                started_at,
                status: "running".to_string(),
            })
        }
        Err(e) => {
            error!("Failed to launch scenario: {}", e);
            HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to launch scenario: {}", e),
                "scenario_id": scenario_id,
            }))
        }
    }
}

/// Get status of a running scenario (placeholder)
pub async fn get_scenario_status(
    _state: web::Data<AppState>,
    run_id: web::Path<String>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "run_id": run_id.as_str(),
        "status": "running",
        "progress_percent": 50,
        "message": "Scenario in progress...",
    }))
}

/// List running scenarios (placeholder)
pub async fn list_running_scenarios(
    _state: web::Data<AppState>,
) -> impl Responder {
    HttpResponse::Ok().json(json!({
        "running_scenarios": [],
        "count": 0,
    }))
}
