use crate::neuron_client::NeuronHttpClient;
use shared::domain::runtime::{
    NeuronAccessMode, RuntimeNode, RuntimeNodeHealthCheck, RuntimeNodeStatus, RuntimeNodeStatusSnapshot,
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

pub async fn collect_runtime_status_snapshot(
    runtime_node: &RuntimeNode,
    client: &NeuronHttpClient,
) -> RuntimeNodeStatusSnapshot {
    let mut checks = vec![RuntimeNodeHealthCheck {
        name: "assigned_pea".to_string(),
        ok: runtime_node.assigned_pea_id.is_some(),
        message: if runtime_node.assigned_pea_id.is_some() {
            "Runtime node has an assigned PEA".to_string()
        } else {
            "Runtime node has no assigned PEA yet".to_string()
        },
    }];

    if matches!(runtime_node.neuron.mode, NeuronAccessMode::Api | NeuronAccessMode::Hybrid) {
        match client.test_connection(&runtime_node.neuron).await {
            Ok(mut remote_checks) => checks.append(&mut remote_checks),
            Err(err) => checks.push(RuntimeNodeHealthCheck {
                name: "neuron_api".to_string(),
                ok: false,
                message: err.to_string(),
            }),
        }
    } else {
        checks.push(RuntimeNodeHealthCheck {
            name: "config_path".to_string(),
            ok: runtime_node
                .neuron
                .config_path
                .as_deref()
                .map(|path| !path.trim().is_empty())
                .unwrap_or(false),
            message: if runtime_node
                .neuron
                .config_path
                .as_deref()
                .map(|path| !path.trim().is_empty())
                .unwrap_or(false)
            {
                "Runtime node has a file-export path configured".to_string()
            } else {
                "Runtime node is missing a writable file-export path".to_string()
            },
        });
    }

    build_runtime_status_snapshot(runtime_node.id.clone(), checks)
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::domain::runtime::{NeuronAccessMode, NeuronConnection, RuntimeArchitecture, RuntimeNode};

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

    #[tokio::test]
    async fn collect_status_for_file_export_node_uses_config_path_check() {
        let node = RuntimeNode {
            id: "runtime-1".to_string(),
            name: "arm-node".to_string(),
            architecture: RuntimeArchitecture::Arm64,
            host: "10.0.20.41".to_string(),
            neuron: NeuronConnection {
                base_url: "http://unused".to_string(),
                username: None,
                password_ref: None,
                config_path: Some("/opt/neuron/config".to_string()),
                mode: NeuronAccessMode::FileExport,
            },
            assigned_pea_id: Some("pea-1".to_string()),
            status: RuntimeNodeStatus::Unknown,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let client = NeuronHttpClient::new();
        let snapshot = collect_runtime_status_snapshot(&node, &client).await;

        assert_eq!(snapshot.status, RuntimeNodeStatus::Online);
        assert!(snapshot.checks.iter().any(|check| check.name == "config_path" && check.ok));
        assert!(snapshot.checks.iter().any(|check| check.name == "assigned_pea" && check.ok));
    }

    #[tokio::test]
    async fn collect_status_for_file_export_node_without_path_is_offline() {
        let node = RuntimeNode {
            id: "runtime-2".to_string(),
            name: "arm-node".to_string(),
            architecture: RuntimeArchitecture::Arm64,
            host: "10.0.20.41".to_string(),
            neuron: NeuronConnection {
                base_url: "http://unused".to_string(),
                username: None,
                password_ref: None,
                config_path: None,
                mode: NeuronAccessMode::FileExport,
            },
            assigned_pea_id: Some("pea-1".to_string()),
            status: RuntimeNodeStatus::Unknown,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let client = NeuronHttpClient::new();
        let snapshot = collect_runtime_status_snapshot(&node, &client).await;

        assert_eq!(snapshot.status, RuntimeNodeStatus::Offline);
        assert!(snapshot.checks.iter().any(|check| check.name == "config_path" && !check.ok));
    }
}
