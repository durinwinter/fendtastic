pub fn runtime_orchestrator_payload(
    runtime_nodes: usize,
    drivers: usize,
    timestamp: &str,
) -> serde_json::Value {
    serde_json::json!({
        "online": true,
        "runtime_nodes": runtime_nodes,
        "drivers": drivers,
        "timestamp": timestamp,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runtime_orchestrator_payload_contains_counts_and_timestamp() {
        let payload = runtime_orchestrator_payload(3, 7, "2026-03-07T12:00:00Z");
        assert_eq!(payload.get("online").and_then(|value| value.as_bool()), Some(true));
        assert_eq!(payload.get("runtime_nodes").and_then(|value| value.as_u64()), Some(3));
        assert_eq!(payload.get("drivers").and_then(|value| value.as_u64()), Some(7));
        assert_eq!(
            payload.get("timestamp").and_then(|value| value.as_str()),
            Some("2026-03-07T12:00:00Z")
        );
    }
}
