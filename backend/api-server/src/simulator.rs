use actix_web::{web, HttpResponse, Responder};
use serde::Serialize;
use std::sync::Arc;
use tracing::{error, info};
use zenoh::Session;

use crate::state::{AppState, SimulatorRun, SimulatorTask};

/// Fixed ID for the standalone dashboard simulator
const STANDALONE_SIM_ID: &str = "__fendt_vario_sim__";
const STANDALONE_PEA_ID: &str = "fendt-vario-1001";

/// Sensor definitions for a Fendt Vario tractor
struct SensorSim {
    tag: &'static str,
    oid_suffix: &'static str,
    base: f64,
    variance: f64,
    drift_rate: f64,
    min: f64,
    max: f64,
}

const SENSORS: &[SensorSim] = &[
    SensorSim {
        tag: "engine_temp",
        oid_suffix: "engine_temp",
        base: 85.0,
        variance: 3.0,
        drift_rate: 0.02,
        min: 60.0,
        max: 110.0,
    },
    SensorSim {
        tag: "oil_pressure",
        oid_suffix: "oil_pressure",
        base: 45.0,
        variance: 2.0,
        drift_rate: 0.01,
        min: 30.0,
        max: 65.0,
    },
    SensorSim {
        tag: "rpm",
        oid_suffix: "rpm",
        base: 1800.0,
        variance: 50.0,
        drift_rate: 0.1,
        min: 800.0,
        max: 2400.0,
    },
    SensorSim {
        tag: "fuel_level",
        oid_suffix: "fuel_level",
        base: 92.0,
        variance: 0.0,
        drift_rate: -0.005,
        min: 0.0,
        max: 100.0,
    },
    SensorSim {
        tag: "hydraulic_temp",
        oid_suffix: "hydraulic_temp",
        base: 55.0,
        variance: 2.0,
        drift_rate: 0.015,
        min: 30.0,
        max: 90.0,
    },
    SensorSim {
        tag: "battery_voltage",
        oid_suffix: "battery_voltage",
        base: 13.2,
        variance: 0.15,
        drift_rate: 0.0,
        min: 11.5,
        max: 14.5,
    },
    SensorSim {
        tag: "coolant_level",
        oid_suffix: "coolant_level",
        base: 92.0,
        variance: 0.5,
        drift_rate: -0.002,
        min: 50.0,
        max: 100.0,
    },
    SensorSim {
        tag: "vibration",
        oid_suffix: "vibration",
        base: 35.0,
        variance: 5.0,
        drift_rate: 0.0,
        min: 10.0,
        max: 80.0,
    },
];

/// State machine phases for the baseline scenario.
const BASELINE_STATE_SEQUENCE: &[(&str, u64)] = &[
    ("IDLE", 20),
    ("OPERATING", 40),
    ("MAINTENANCE", 15),
    ("OPERATING", 25),
];

/// State machine phases for a thermal stress scenario.
const THERMAL_STRESS_STATE_SEQUENCE: &[(&str, u64)] = &[
    ("IDLE", 12),
    ("OPERATING", 36),
    ("MAINTENANCE", 10),
    ("OPERATING", 22),
];

/// User actions triggered at state transitions.
const ACTION_AT_TRANSITION: &[&str] = &[
    "START",  // IDLE → OPERATING
    "PAUSE",  // OPERATING → MAINTENANCE
    "RESUME", // MAINTENANCE → OPERATING
    "STOP",   // OPERATING → IDLE (cycle restart)
];

/// Alarm definitions for baseline scenario: (tick offset within cycle, label, severity)
const BASELINE_ALARMS: &[(u64, &str, &str)] = &[
    (35, "TEMP WARNING", "warning"),
    (55, "PRESSURE ALERT", "critical"),
    (75, "VIBRATION HIGH", "warning"),
];

/// Alarm definitions for thermal stress scenario.
const THERMAL_STRESS_ALARMS: &[(u64, &str, &str)] = &[
    (20, "TEMP WARNING", "warning"),
    (35, "OVERHEAT CRITICAL", "critical"),
    (50, "PRESSURE DROP", "critical"),
];

#[derive(Clone)]
struct ScenarioProfile {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    duration_s: u64,
    tick_ms: u64,
    time_ratio: f64,
    rpm_bias: f64,
    engine_temp_bias: f64,
    vibration_multiplier: f64,
    fuel_drain_multiplier: f64,
    state_sequence: &'static [(&'static str, u64)],
    alarms: &'static [(u64, &'static str, &'static str)],
}

#[derive(Serialize)]
struct ScenarioInfo {
    id: String,
    name: String,
    description: String,
    duration_s: u64,
    tick_ms: u64,
    time_ratio: f64,
}

fn built_in_scenarios() -> Vec<ScenarioProfile> {
    vec![
        ScenarioProfile {
            id: "baseline_cycle",
            name: "Baseline Work Cycle",
            description: "Nominal operation with periodic maintenance and moderate alarms.",
            duration_s: 300,
            tick_ms: 1000,
            time_ratio: 128.0,
            rpm_bias: 0.0,
            engine_temp_bias: 0.0,
            vibration_multiplier: 1.0,
            fuel_drain_multiplier: 1.0,
            state_sequence: BASELINE_STATE_SEQUENCE,
            alarms: BASELINE_ALARMS,
        },
        ScenarioProfile {
            id: "thermal_stress",
            name: "Thermal Stress and Recovery",
            description: "Higher load profile with accelerated heating, vibration, and recovery.",
            duration_s: 240,
            tick_ms: 1000,
            time_ratio: 192.0,
            rpm_bias: 280.0,
            engine_temp_bias: 10.0,
            vibration_multiplier: 1.8,
            fuel_drain_multiplier: 1.6,
            state_sequence: THERMAL_STRESS_STATE_SEQUENCE,
            alarms: THERMAL_STRESS_ALARMS,
        },
    ]
}

fn scenario_info(profile: &ScenarioProfile) -> ScenarioInfo {
    ScenarioInfo {
        id: profile.id.to_string(),
        name: profile.name.to_string(),
        description: profile.description.to_string(),
        duration_s: profile.duration_s,
        tick_ms: profile.tick_ms,
        time_ratio: profile.time_ratio,
    }
}

/// Spawn a background task that publishes simulated Fendt Vario telemetry.
pub fn spawn_simulator(
    session: Arc<Session>,
    pea_id: String,
    scenario_id: Option<&str>,
) -> tokio::task::JoinHandle<()> {
    let scenario = built_in_scenarios()
        .into_iter()
        .find(|s| Some(s.id) == scenario_id)
        .unwrap_or_else(|| built_in_scenarios()[0].clone());

    tokio::spawn(async move {
        info!(
            "Simulator started for PEA {} with scenario {} ({})",
            pea_id, scenario.id, scenario.name
        );

        let mut values: Vec<f64> = SENSORS.iter().map(|s| s.base).collect();
        let mut tick: u64 = 0;

        // Compute total cycle length and transition boundaries
        let cycle_len: u64 = scenario.state_sequence.iter().map(|(_, d)| d).sum();
        let mut boundaries: Vec<u64> = Vec::new();
        let mut acc = 0u64;
        for (_, dur) in scenario.state_sequence {
            boundaries.push(acc);
            acc += dur;
        }

        let mut prev_state_idx: Option<usize> = None;
        let mut active_alarm: Option<u64> = None; // tick when alarm started

        while tick < scenario.duration_s {
            let now = chrono::Utc::now().to_rfc3339();
            let cycle_tick = tick % cycle_len;
            let simulated_seconds = ((tick as f64) * scenario.time_ratio).round() as u64;

            // ─── Sensor telemetry ──────────────────────────────────
            for (i, sensor) in SENSORS.iter().enumerate() {
                let mut drift = sensor.drift_rate;
                if sensor.tag == "fuel_level" {
                    drift *= scenario.fuel_drain_multiplier;
                }
                values[i] += drift;

                let noise = (pseudo_random(tick, i as u64) - 0.5) * 2.0 * sensor.variance;
                let mut reading = values[i] + noise;
                if sensor.tag == "rpm" {
                    reading += scenario.rpm_bias;
                } else if sensor.tag == "engine_temp" {
                    reading += scenario.engine_temp_bias;
                } else if sensor.tag == "vibration" {
                    reading *= scenario.vibration_multiplier;
                }
                let reading = reading.clamp(sensor.min, sensor.max);
                let rounded = (reading * 10.0).round() / 10.0;

                let data_topic = format!("fendtastic/pea/{}/data/{}", pea_id, sensor.tag);
                let data_payload = serde_json::json!({
                    "oid": format!("sensor:pea/{}/{}", pea_id, sensor.oid_suffix),
                    "value": rounded,
                    "status": 1,
                    "scenario_id": scenario.id,
                    "timestamp": &now,
                });
                if let Err(e) = session.put(&data_topic, data_payload.to_string()).await {
                    error!("Simulator put failed for {}: {}", data_topic, e);
                }
            }

            // ─── Simulation clock telemetry ────────────────────────
            let clock_topic = format!("fendtastic/pea/{}/scenario/clock", pea_id);
            let clock_payload = serde_json::json!({
                "scenario_id": scenario.id,
                "tick": tick,
                "simulated_seconds": simulated_seconds,
                "time_ratio": scenario.time_ratio,
                "timestamp": &now,
            });
            let _ = session.put(&clock_topic, clock_payload.to_string()).await;

            // ─── State machine (swimlane events) ──────────────────
            let state_idx = boundaries
                .iter()
                .rposition(|&b| cycle_tick >= b)
                .unwrap_or(0);

            let (state_label, _) = scenario.state_sequence[state_idx];

            // Publish state on every tick so the frontend always has the current state
            let state_topic = format!("fendtastic/pea/{}/swimlane/state", pea_id);
            let state_payload = serde_json::json!({
                "state": state_label,
                "scenario_id": scenario.id,
                "timestamp": &now,
            });
            let _ = session.put(&state_topic, state_payload.to_string()).await;

            // Publish user action at transitions
            if prev_state_idx != Some(state_idx) {
                if prev_state_idx.is_some() {
                    let action_label = ACTION_AT_TRANSITION[state_idx % ACTION_AT_TRANSITION.len()];
                    let action_topic = format!("fendtastic/pea/{}/swimlane/action", pea_id);
                    let action_payload = serde_json::json!({
                        "action": action_label,
                        "scenario_id": scenario.id,
                        "timestamp": &now,
                    });
                    let _ = session.put(&action_topic, action_payload.to_string()).await;
                    info!("Simulator: user action '{}' at tick {}", action_label, tick);
                }
                prev_state_idx = Some(state_idx);
            }

            // ─── Alarms ───────────────────────────────────────────
            for &(alarm_tick, label, severity) in scenario.alarms {
                if cycle_tick == alarm_tick {
                    let alarm_topic = format!("fendtastic/pea/{}/swimlane/alarm", pea_id);
                    let alarm_payload = serde_json::json!({
                        "alarm": label,
                        "severity": severity,
                        "active": true,
                        "scenario_id": scenario.id,
                        "timestamp": &now,
                    });
                    let _ = session.put(&alarm_topic, alarm_payload.to_string()).await;
                    active_alarm = Some(tick);
                    info!("Simulator: alarm '{}' triggered at tick {}", label, tick);
                }
            }
            // Clear alarm after 5 seconds
            if let Some(start) = active_alarm {
                if tick - start >= 5 {
                    let alarm_topic = format!("fendtastic/pea/{}/swimlane/alarm", pea_id);
                    let alarm_payload = serde_json::json!({
                        "alarm": "",
                        "severity": "none",
                        "active": false,
                        "scenario_id": scenario.id,
                        "timestamp": &now,
                    });
                    let _ = session.put(&alarm_topic, alarm_payload.to_string()).await;
                    active_alarm = None;
                }
            }

            tick += 1;
            tokio::time::sleep(tokio::time::Duration::from_millis(scenario.tick_ms)).await;
        }

        let now = chrono::Utc::now().to_rfc3339();
        let state_topic = format!("fendtastic/pea/{}/swimlane/state", pea_id);
        let _ = session
            .put(
                &state_topic,
                serde_json::json!({
                    "state": "STOPPED",
                    "scenario_id": scenario.id,
                    "timestamp": &now,
                })
                .to_string(),
            )
            .await;

        let lifecycle_topic = format!("fendtastic/pea/{}/scenario/status", pea_id);
        let _ = session
            .put(
                &lifecycle_topic,
                serde_json::json!({
                    "scenario_id": scenario.id,
                    "status": "completed",
                    "timestamp": &now,
                })
                .to_string(),
            )
            .await;

        info!(
            "Simulator completed scenario {} for PEA {}",
            scenario.id, pea_id
        );
    })
}

fn pseudo_random(tick: u64, idx: u64) -> f64 {
    let mut x = tick
        .wrapping_mul(6364136223846793005)
        .wrapping_add(idx.wrapping_mul(1442695040888963407));
    x ^= x >> 33;
    x = x.wrapping_mul(0xff51afd7ed558ccd);
    x ^= x >> 33;
    (x & 0x7FFFFFFF) as f64 / 0x7FFFFFFF as f64
}

// ─── REST Endpoints ─────────────────────────────────────────────────────────

/// GET /simulator/scenarios — list available built-in simulator scenarios.
pub async fn list_scenarios(_state: web::Data<AppState>) -> impl Responder {
    let scenarios: Vec<ScenarioInfo> = built_in_scenarios().iter().map(scenario_info).collect();
    HttpResponse::Ok().json(serde_json::json!({
        "scenarios": scenarios,
        "count": scenarios.len(),
    }))
}

/// POST /simulator/start — start standalone Fendt Vario simulator
pub async fn start_standalone(
    state: web::Data<AppState>,
    query: web::Query<std::collections::HashMap<String, String>>,
) -> impl Responder {
    let requested_scenario = query
        .get("scenario_id")
        .cloned()
        .unwrap_or_else(|| "baseline_cycle".to_string());
    let scenario = match built_in_scenarios()
        .into_iter()
        .find(|s| s.id == requested_scenario)
    {
        Some(s) => s,
        None => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": format!("Unknown scenario_id '{}'", requested_scenario),
                "available_scenarios": built_in_scenarios().iter().map(|s| s.id).collect::<Vec<_>>(),
            }));
        }
    };

    let mut sims = state.running_sims.write().await;
    if let Some(existing) = sims.get(STANDALONE_SIM_ID) {
        if existing.handle.is_finished() {
            sims.remove(STANDALONE_SIM_ID);
        }
    }

    if sims.contains_key(STANDALONE_SIM_ID) {
        return HttpResponse::Ok().json(serde_json::json!({
            "status": "already_running",
            "simulator": "fendt_vario",
            "scenario_id": requested_scenario,
        }));
    }

    let started_at = chrono::Utc::now().to_rfc3339();
    let run = SimulatorRun {
        scenario_id: scenario.id.to_string(),
        scenario_name: scenario.name.to_string(),
        started_at: started_at.clone(),
        duration_s: scenario.duration_s,
        tick_ms: scenario.tick_ms,
        time_ratio: scenario.time_ratio,
    };

    let handle = spawn_simulator(
        state.zenoh_session.clone(),
        STANDALONE_PEA_ID.to_string(),
        Some(scenario.id),
    );
    sims.insert(
        STANDALONE_SIM_ID.to_string(),
        SimulatorTask {
            handle,
            run: run.clone(),
        },
    );

    let lifecycle_topic = format!("fendtastic/pea/{}/scenario/status", STANDALONE_PEA_ID);
    let _ = state
        .zenoh_session
        .put(
            &lifecycle_topic,
            serde_json::json!({
                "scenario_id": run.scenario_id,
                "status": "started",
                "started_at": started_at,
                "timestamp": chrono::Utc::now().to_rfc3339(),
            })
            .to_string(),
        )
        .await;

    info!(
        "Standalone Fendt Vario simulator started with scenario {}",
        scenario.id
    );
    HttpResponse::Ok().json(serde_json::json!({
        "status": "started",
        "simulator": "fendt_vario",
        "pea_id": STANDALONE_PEA_ID,
        "scenario_id": scenario.id,
        "scenario_name": scenario.name,
        "started_at": run.started_at,
        "duration_s": run.duration_s,
        "tick_ms": run.tick_ms,
        "time_ratio": run.time_ratio,
    }))
}

/// POST /simulator/stop — stop standalone Fendt Vario simulator
pub async fn stop_standalone(state: web::Data<AppState>) -> impl Responder {
    let mut sims = state.running_sims.write().await;

    if let Some(task) = sims.remove(STANDALONE_SIM_ID) {
        task.handle.abort();
        let lifecycle_topic = format!("fendtastic/pea/{}/scenario/status", STANDALONE_PEA_ID);
        let _ = state
            .zenoh_session
            .put(
                &lifecycle_topic,
                serde_json::json!({
                    "scenario_id": task.run.scenario_id,
                    "status": "stopped",
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                })
                .to_string(),
            )
            .await;
        info!("Standalone Fendt Vario simulator stopped");
        HttpResponse::Ok().json(serde_json::json!({
            "status": "stopped",
            "simulator": "fendt_vario",
            "scenario_id": task.run.scenario_id,
        }))
    } else {
        HttpResponse::Ok().json(serde_json::json!({
            "status": "not_running",
            "simulator": "fendt_vario",
        }))
    }
}

/// GET /simulator/status — check if simulator is running
pub async fn get_status(state: web::Data<AppState>) -> impl Responder {
    let mut sims = state.running_sims.write().await;
    if let Some(task) = sims.get(STANDALONE_SIM_ID) {
        if task.handle.is_finished() {
            sims.remove(STANDALONE_SIM_ID);
        }
    }
    let (running, scenario_id, scenario_name, started_at, duration_s, tick_ms, time_ratio) =
        if let Some(task) = sims.get(STANDALONE_SIM_ID) {
            (
                true,
                task.run.scenario_id.clone(),
                task.run.scenario_name.clone(),
                task.run.started_at.clone(),
                task.run.duration_s,
                task.run.tick_ms,
                task.run.time_ratio,
            )
        } else {
            (false, String::new(), String::new(), String::new(), 0, 0, 0.0)
        };

    HttpResponse::Ok().json(serde_json::json!({
        "running": running,
        "simulator": "fendt_vario",
        "pea_id": if running { STANDALONE_PEA_ID } else { "" },
        "scenario_id": scenario_id,
        "scenario_name": scenario_name,
        "started_at": started_at,
        "duration_s": duration_s,
        "tick_ms": tick_ms,
        "time_ratio": time_ratio,
    }))
}
