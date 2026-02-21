use actix_web::{web, HttpResponse, Responder};
use std::sync::Arc;
use tracing::{error, info};
use zenoh::Session;

use crate::state::AppState;

/// Fixed ID for the standalone dashboard simulator
const STANDALONE_SIM_ID: &str = "__fendt_vario_sim__";

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

/// State machine phases for the swimlane simulation
const STATE_SEQUENCE: &[(&str, u64)] = &[
    ("IDLE", 20),
    ("OPERATING", 40),
    ("MAINTENANCE", 15),
    ("OPERATING", 25),
];

/// User actions triggered at state transitions
const ACTION_AT_TRANSITION: &[&str] = &[
    "START",  // IDLE → OPERATING
    "PAUSE",  // OPERATING → MAINTENANCE
    "RESUME", // MAINTENANCE → OPERATING
    "STOP",   // OPERATING → IDLE (cycle restart)
];

/// Alarm definitions: (tick offset within cycle, label, severity)
const ALARMS: &[(u64, &str, &str)] = &[
    (35, "TEMP WARNING", "warning"),
    (55, "PRESSURE ALERT", "critical"),
    (75, "VIBRATION HIGH", "warning"),
];

/// Spawn a background task that publishes simulated Fendt Vario telemetry.
pub fn spawn_simulator(session: Arc<Session>, pea_id: String) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        info!("Simulator started for PEA: {}", pea_id);

        let mut values: Vec<f64> = SENSORS.iter().map(|s| s.base).collect();
        let mut tick: u64 = 0;

        // Compute total cycle length and transition boundaries
        let cycle_len: u64 = STATE_SEQUENCE.iter().map(|(_, d)| d).sum();
        let mut boundaries: Vec<u64> = Vec::new();
        let mut acc = 0u64;
        for (_, dur) in STATE_SEQUENCE {
            boundaries.push(acc);
            acc += dur;
        }

        let mut prev_state_idx: Option<usize> = None;
        let mut active_alarm: Option<u64> = None; // tick when alarm started

        loop {
            let now = chrono::Utc::now().to_rfc3339();
            let cycle_tick = tick % cycle_len;

            // ─── Sensor telemetry ──────────────────────────────────
            for (i, sensor) in SENSORS.iter().enumerate() {
                values[i] += sensor.drift_rate;

                let noise = (pseudo_random(tick, i as u64) - 0.5) * 2.0 * sensor.variance;
                let reading = (values[i] + noise).clamp(sensor.min, sensor.max);
                let rounded = (reading * 10.0).round() / 10.0;

                let data_topic = format!("fendtastic/pea/{}/data/{}", pea_id, sensor.tag);
                let data_payload = serde_json::json!({
                    "oid": format!("sensor:pea/{}/{}", pea_id, sensor.oid_suffix),
                    "value": rounded,
                    "status": 1,
                    "timestamp": &now,
                });
                if let Err(e) = session.put(&data_topic, data_payload.to_string()).await {
                    error!("Simulator put failed for {}: {}", data_topic, e);
                }
            }

            // ─── State machine (swimlane events) ──────────────────
            let state_idx = boundaries
                .iter()
                .rposition(|&b| cycle_tick >= b)
                .unwrap_or(0);

            let (state_label, _) = STATE_SEQUENCE[state_idx];

            // Publish state on every tick so the frontend always has the current state
            let state_topic = format!("fendtastic/pea/{}/swimlane/state", pea_id);
            let state_payload = serde_json::json!({
                "state": state_label,
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
                        "timestamp": &now,
                    });
                    let _ = session.put(&action_topic, action_payload.to_string()).await;
                    info!("Simulator: user action '{}' at tick {}", action_label, tick);
                }
                prev_state_idx = Some(state_idx);
            }

            // ─── Alarms ───────────────────────────────────────────
            for &(alarm_tick, label, severity) in ALARMS {
                if cycle_tick == alarm_tick {
                    let alarm_topic = format!("fendtastic/pea/{}/swimlane/alarm", pea_id);
                    let alarm_payload = serde_json::json!({
                        "alarm": label,
                        "severity": severity,
                        "active": true,
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
                        "timestamp": &now,
                    });
                    let _ = session.put(&alarm_topic, alarm_payload.to_string()).await;
                    active_alarm = None;
                }
            }

            tick += 1;
            tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
        }
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

/// POST /simulator/start — start standalone Fendt Vario simulator
pub async fn start_standalone(state: web::Data<AppState>) -> impl Responder {
    let mut sims = state.running_sims.write().await;

    if sims.contains_key(STANDALONE_SIM_ID) {
        return HttpResponse::Ok().json(serde_json::json!({
            "status": "already_running",
            "simulator": "fendt_vario",
        }));
    }

    let handle = spawn_simulator(state.zenoh_session.clone(), "fendt-vario-1001".to_string());
    sims.insert(STANDALONE_SIM_ID.to_string(), handle);

    info!("Standalone Fendt Vario simulator started");
    HttpResponse::Ok().json(serde_json::json!({
        "status": "started",
        "simulator": "fendt_vario",
        "pea_id": "fendt-vario-1001",
    }))
}

/// POST /simulator/stop — stop standalone Fendt Vario simulator
pub async fn stop_standalone(state: web::Data<AppState>) -> impl Responder {
    let mut sims = state.running_sims.write().await;

    if let Some(handle) = sims.remove(STANDALONE_SIM_ID) {
        handle.abort();
        info!("Standalone Fendt Vario simulator stopped");
        HttpResponse::Ok().json(serde_json::json!({
            "status": "stopped",
            "simulator": "fendt_vario",
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
    let sims = state.running_sims.read().await;
    let running = sims.contains_key(STANDALONE_SIM_ID);

    HttpResponse::Ok().json(serde_json::json!({
        "running": running,
        "simulator": "fendt_vario",
        "pea_id": if running { "fendt-vario-1001" } else { "" },
    }))
}
