use actix_web::{web, HttpResponse, Responder};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::process::Stdio;
use tokio::process::Command;
use tracing::{error, info};
use uuid::Uuid;

use crate::state::AppState;

#[derive(Clone, Debug, Serialize)]
pub struct RunningScenario {
    pub run_id: String,
    pub scenario_id: String,
    pub name: String,
    pub started_at: String,
    pub status: String,
    pub pid: u32,
    pub progress_percent: u32,
    pub message: String,
    pub timeout_real_s: u32,
}

#[derive(Clone, Debug, Serialize)]
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
    pub put_cmd: Option<String>,
    pub site: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LaunchScenarioResponse {
    pub run_id: String,
    pub scenario_id: String,
    pub started_at: String,
    pub status: String,
}

fn built_in_scenarios() -> Vec<ScenarioInfo> {
    vec![
        ScenarioInfo {
            id: "S001".to_string(),
            name: "Baseline Throughput Under Normal Power".to_string(),
            spec: "factorio/specs/S001_baseline_throughput.md".to_string(),
            priority: "P1".to_string(),
            tags: vec![
                "power".to_string(),
                "baseline".to_string(),
                "throughput".to_string(),
            ],
            duration_sim_min: 15,
            timeout_real_s: 300,
        },
        ScenarioInfo {
            id: "S010".to_string(),
            name: "Recovery From Power Loss".to_string(),
            spec: "factorio/specs/S010_recovery_from_power_loss.md".to_string(),
            priority: "P1".to_string(),
            tags: vec![
                "power".to_string(),
                "recovery".to_string(),
                "brownout".to_string(),
            ],
            duration_sim_min: 30,
            timeout_real_s: 600,
        },
        ScenarioInfo {
            id: "S020".to_string(),
            name: "Sensor Noise and Debounce".to_string(),
            spec: "factorio/specs/S020_sensor_noise_debounce.md".to_string(),
            priority: "P1".to_string(),
            tags: vec![
                "fluids".to_string(),
                "noise".to_string(),
                "debounce".to_string(),
            ],
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
    ]
}

fn compute_progress(started_at: &str, timeout_real_s: u32, status: &str) -> u32 {
    if status == "completed" || status == "failed" {
        return 100;
    }
    let start = DateTime::parse_from_rfc3339(started_at)
        .map(|dt| dt.with_timezone(&Utc))
        .unwrap_or_else(|_| Utc::now());
    let elapsed = (Utc::now() - start).num_seconds().max(0) as u64;
    let timeout = timeout_real_s.max(1) as u64;
    ((elapsed.saturating_mul(100)) / timeout).min(99) as u32
}

pub async fn list_scenarios(_state: web::Data<AppState>) -> impl Responder {
    let scenarios = built_in_scenarios();
    HttpResponse::Ok().json(json!({
        "scenarios": scenarios,
        "count": scenarios.len(),
    }))
}

pub async fn launch_scenario(
    state: web::Data<AppState>,
    req: web::Json<LaunchScenarioRequest>,
) -> impl Responder {
    let scenarios = built_in_scenarios();
    let Some(scenario) = scenarios.iter().find(|s| s.id == req.scenario_id) else {
        return HttpResponse::NotFound().json(json!({"error": "Unknown scenario"}));
    };

    let put_cmd = req.put_cmd.clone().unwrap_or_else(|| "none".to_string());
    let site = req
        .site
        .clone()
        .unwrap_or_else(|| "refinery_01".to_string());
    let run_id = Uuid::new_v4().to_string();
    let started_at = Utc::now().to_rfc3339();

    let durins_forge_root = std::env::var("DURINS_FORGE_ROOT").unwrap_or_else(|_| {
        if std::path::Path::new("../durins-forge").exists() {
            "../durins-forge".to_string()
        } else if std::path::Path::new("/home/earthling/Documents/durins-forge").exists() {
            "/home/earthling/Documents/durins-forge".to_string()
        } else {
            "./durins-forge".to_string()
        }
    });

    let shell_cmd = format!(
        "cd {} && PUT_CMD=\"{}\" PUT_SITE=\"{}\" ./harness/runner/run_one.sh {}",
        durins_forge_root, put_cmd, site, req.scenario_id
    );

    let mut cmd = Command::new("sh");
    cmd.arg("-c")
        .arg(&shell_cmd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    match cmd.spawn() {
        Ok(mut child) => {
            let pid = child.id().unwrap_or(0);
            info!(
                "Scenario {} started (run_id={}, pid={})",
                req.scenario_id, run_id, pid
            );

            {
                let mut runs = state.scenario_runs.write().await;
                runs.insert(
                    run_id.clone(),
                    json!({
                        "run_id": run_id,
                        "scenario_id": req.scenario_id,
                        "name": scenario.name,
                        "started_at": started_at,
                        "status": "running",
                        "pid": pid,
                        "progress_percent": 0,
                        "message": "Scenario is running",
                        "timeout_real_s": scenario.timeout_real_s,
                    }),
                );
            }

            let runs = state.scenario_runs.clone();
            let run_id_cloned = run_id.clone();
            tokio::spawn(async move {
                match child.wait().await {
                    Ok(exit) => {
                        let mut runs_guard = runs.write().await;
                        if let Some(run) = runs_guard.get_mut(&run_id_cloned) {
                            run["status"] = json!(if exit.success() {
                                "completed"
                            } else {
                                "failed"
                            });
                            run["progress_percent"] = json!(100);
                            run["message"] = if exit.success() {
                                json!("Scenario completed successfully")
                            } else {
                                json!(format!("Scenario failed with status {:?}", exit.code()))
                            };
                        }
                    }
                    Err(e) => {
                        error!("Scenario wait failed for {}: {}", run_id_cloned, e);
                        let mut runs_guard = runs.write().await;
                        if let Some(run) = runs_guard.get_mut(&run_id_cloned) {
                            run["status"] = json!("failed");
                            run["progress_percent"] = json!(100);
                            run["message"] = json!(format!("Scenario process error: {}", e));
                        }
                    }
                }
            });

            HttpResponse::Accepted().json(LaunchScenarioResponse {
                run_id,
                scenario_id: req.scenario_id.clone(),
                started_at,
                status: "running".to_string(),
            })
        }
        Err(e) => {
            error!("Failed to launch scenario {}: {}", req.scenario_id, e);
            HttpResponse::InternalServerError().json(json!({
                "error": format!("Failed to launch scenario: {}", e),
                "scenario_id": req.scenario_id,
            }))
        }
    }
}

pub async fn get_scenario_status(
    state: web::Data<AppState>,
    run_id: web::Path<String>,
) -> impl Responder {
    let runs = state.scenario_runs.read().await;
    match runs.get(run_id.as_str()) {
        Some(run) => {
            let mut out = run.clone();
            let started_at = out["started_at"].as_str().unwrap_or_default();
            let timeout_real_s = out["timeout_real_s"].as_u64().unwrap_or(300) as u32;
            let status = out["status"].as_str().unwrap_or("running");
            out["progress_percent"] = json!(compute_progress(started_at, timeout_real_s, status));
            HttpResponse::Ok().json(out)
        }
        None => HttpResponse::NotFound().json(json!({"error": "Run not found"})),
    }
}

pub async fn list_running_scenarios(state: web::Data<AppState>) -> impl Responder {
    let runs = state.scenario_runs.read().await;
    let mut list: Vec<RunningScenario> = runs
        .values()
        .filter_map(|run| {
            Some(RunningScenario {
                run_id: run["run_id"].as_str()?.to_string(),
                scenario_id: run["scenario_id"].as_str()?.to_string(),
                name: run["name"].as_str().unwrap_or_default().to_string(),
                started_at: run["started_at"].as_str()?.to_string(),
                status: run["status"].as_str().unwrap_or("running").to_string(),
                pid: run["pid"].as_u64().unwrap_or(0) as u32,
                progress_percent: compute_progress(
                    run["started_at"].as_str().unwrap_or_default(),
                    run["timeout_real_s"].as_u64().unwrap_or(300) as u32,
                    run["status"].as_str().unwrap_or("running"),
                ),
                message: run["message"].as_str().unwrap_or_default().to_string(),
                timeout_real_s: run["timeout_real_s"].as_u64().unwrap_or(300) as u32,
            })
        })
        .collect();

    list.sort_by(|a, b| b.started_at.cmp(&a.started_at));
    HttpResponse::Ok().json(json!({
        "running_scenarios": list,
        "count": list.len(),
    }))
}
