use shared::domain::runtime::{
    RuntimeNodeHealthCheck, RuntimeNodeStatus, RuntimeNodeStatusSnapshot,
};

pub fn summarize_runtime_status(checks: &[RuntimeNodeHealthCheck]) -> RuntimeNodeStatus {
    if checks.is_empty() {
        return RuntimeNodeStatus::Unknown;
    }

    if checks.iter().all(|check| check.ok) {
        return RuntimeNodeStatus::Online;
    }

    let connectivity_failure = checks.iter().any(|check| {
        !check.ok
            && matches!(
                check.name.as_str(),
                "auth" | "system" | "plugins" | "neuron_api" | "config_path"
            )
    });

    if connectivity_failure {
        RuntimeNodeStatus::Offline
    } else {
        RuntimeNodeStatus::Degraded
    }
}

pub fn build_runtime_status_snapshot(
    runtime_node_id: String,
    checks: Vec<RuntimeNodeHealthCheck>,
) -> RuntimeNodeStatusSnapshot {
    RuntimeNodeStatusSnapshot {
        runtime_node_id,
        status: summarize_runtime_status(&checks),
        checks,
        updated_at: chrono::Utc::now(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn check(name: &str, ok: bool) -> RuntimeNodeHealthCheck {
        RuntimeNodeHealthCheck {
            name: name.to_string(),
            ok,
            message: String::new(),
        }
    }

    #[test]
    fn summarize_unknown_when_no_checks() {
        assert_eq!(summarize_runtime_status(&[]), RuntimeNodeStatus::Unknown);
    }

    #[test]
    fn summarize_online_when_all_checks_pass() {
        let checks = vec![check("assigned_pea", true), check("auth", true)];
        assert_eq!(summarize_runtime_status(&checks), RuntimeNodeStatus::Online);
    }

    #[test]
    fn summarize_offline_for_connectivity_failures() {
        let checks = vec![check("assigned_pea", true), check("neuron_api", false)];
        assert_eq!(summarize_runtime_status(&checks), RuntimeNodeStatus::Offline);
    }

    #[test]
    fn summarize_degraded_for_non_connectivity_failures() {
        let checks = vec![check("assigned_pea", false), check("auth", true)];
        assert_eq!(summarize_runtime_status(&checks), RuntimeNodeStatus::Degraded);
    }
}
