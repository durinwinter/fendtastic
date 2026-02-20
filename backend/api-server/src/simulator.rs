use std::sync::Arc;
use zenoh::Session;
use tracing::{info, error};

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
    SensorSim { tag: "engine_temp",     oid_suffix: "engine_temp",     base: 85.0,  variance: 3.0,   drift_rate: 0.02,  min: 60.0,  max: 110.0 },
    SensorSim { tag: "oil_pressure",    oid_suffix: "oil_pressure",    base: 45.0,  variance: 2.0,   drift_rate: 0.01,  min: 30.0,  max: 65.0  },
    SensorSim { tag: "rpm",             oid_suffix: "rpm",             base: 1800.0, variance: 50.0, drift_rate: 0.1,   min: 800.0, max: 2400.0 },
    SensorSim { tag: "fuel_level",      oid_suffix: "fuel_level",      base: 92.0,  variance: 0.0,   drift_rate: -0.005, min: 0.0,  max: 100.0 },
    SensorSim { tag: "hydraulic_temp",  oid_suffix: "hydraulic_temp",  base: 55.0,  variance: 2.0,   drift_rate: 0.015, min: 30.0,  max: 90.0  },
    SensorSim { tag: "battery_voltage", oid_suffix: "battery_voltage", base: 13.2,  variance: 0.15,  drift_rate: 0.0,   min: 11.5,  max: 14.5  },
    SensorSim { tag: "coolant_level",   oid_suffix: "coolant_level",   base: 92.0,  variance: 0.5,   drift_rate: -0.002, min: 50.0, max: 100.0 },
    SensorSim { tag: "vibration",       oid_suffix: "vibration",       base: 35.0,  variance: 5.0,   drift_rate: 0.0,   min: 10.0,  max: 80.0  },
];

/// Spawn a background task that publishes simulated Fendt Vario telemetry.
/// Returns the JoinHandle so the caller can abort it to stop simulation.
pub fn spawn_simulator(
    session: Arc<Session>,
    pea_id: String,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        info!("Simulator started for PEA: {}", pea_id);

        // Mutable state for each sensor (current drifted value)
        let mut values: Vec<f64> = SENSORS.iter().map(|s| s.base).collect();
        let mut tick: u64 = 0;

        loop {
            for (i, sensor) in SENSORS.iter().enumerate() {
                // Apply drift
                values[i] += sensor.drift_rate;

                // Add noise
                let noise = (pseudo_random(tick, i as u64) - 0.5) * 2.0 * sensor.variance;
                let reading = (values[i] + noise).clamp(sensor.min, sensor.max);
                let rounded = (reading * 10.0).round() / 10.0;

                // Publish to PEA data topic (for namespace browser)
                let data_topic = format!("fendtastic/pea/{}/data/{}", pea_id, sensor.tag);
                let data_payload = serde_json::json!({
                    "oid": format!("sensor:pea/{}/{}", pea_id, sensor.oid_suffix),
                    "value": rounded,
                    "status": 1,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                });
                if let Err(e) = session.put(&data_topic, data_payload.to_string()).await {
                    error!("Simulator put failed for {}: {}", data_topic, e);
                }
            }

            tick += 1;
            tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;
        }
    })
}

/// Simple deterministic pseudo-random [0, 1) from tick + sensor index.
/// Not cryptographic — just enough for smooth-looking noise.
fn pseudo_random(tick: u64, idx: u64) -> f64 {
    let mut x = tick.wrapping_mul(6364136223846793005).wrapping_add(idx.wrapping_mul(1442695040888963407));
    x ^= x >> 33;
    x = x.wrapping_mul(0xff51afd7ed558ccd);
    x ^= x >> 33;
    (x & 0x7FFFFFFF) as f64 / 0x7FFFFFFF as f64
}
