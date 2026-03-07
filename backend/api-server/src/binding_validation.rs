use crate::state::AppState;
use shared::domain::binding::{BindingDirection, BindingValidationSummary, PeaBinding};
use shared::domain::driver::TagAccess;
use shared::domain::pea::{canonical_tags_from_config, CanonicalTag};

pub async fn validate_binding_request(state: &AppState, binding: &PeaBinding) -> BindingValidationSummary {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    let runtime_nodes = state.runtime_nodes.read().await;
    let driver_instances = state.driver_instances.read().await;
    let pea_configs = state.pea_configs.read().await;

    let Some(runtime_node) = runtime_nodes.get(&binding.runtime_node_id) else {
        errors.push("Runtime node does not exist".to_string());
        return BindingValidationSummary { valid: false, errors, warnings };
    };

    let Some(driver) = driver_instances.get(&binding.driver_instance_id) else {
        errors.push("Driver instance does not exist".to_string());
        return BindingValidationSummary { valid: false, errors, warnings };
    };

    let Some(pea_config) = pea_configs.get(&binding.pea_id) else {
        errors.push("PEA does not exist".to_string());
        return BindingValidationSummary { valid: false, errors, warnings };
    };

    if runtime_node.assigned_pea_id.as_deref() != Some(binding.pea_id.as_str()) {
        errors.push("Runtime node is not assigned to this PEA".to_string());
    }

    if driver.runtime_node_id != binding.runtime_node_id {
        errors.push("Driver instance is not attached to the selected runtime node".to_string());
    }

    if driver.pea_id != binding.pea_id {
        errors.push("Driver instance is not attached to the selected PEA".to_string());
    }

    let canonical_tags = canonical_tags_from_config(pea_config);

    for mapping in &binding.mappings {
        if !has_canonical_tag(&canonical_tags, &mapping.canonical_tag) {
            errors.push(format!("Unknown canonical tag: {}", mapping.canonical_tag));
        }

        let driver_tag = driver
            .tag_groups
            .iter()
            .flat_map(|group| group.tags.iter())
            .find(|tag| tag.id == mapping.driver_tag_id);

        let Some(driver_tag) = driver_tag else {
            errors.push(format!("Unknown driver tag: {}", mapping.driver_tag_id));
            continue;
        };

        match mapping.direction {
            BindingDirection::ReadFromDriver => {
                if !matches!(driver_tag.access, TagAccess::Read | TagAccess::ReadWrite) {
                    errors.push(format!(
                        "Driver tag {} does not support read access",
                        mapping.driver_tag_id
                    ));
                }
            }
            BindingDirection::WriteToDriver => {
                if !matches!(driver_tag.access, TagAccess::Write | TagAccess::ReadWrite) {
                    errors.push(format!(
                        "Driver tag {} does not support write access",
                        mapping.driver_tag_id
                    ));
                }
            }
            BindingDirection::Bidirectional => {
                if driver_tag.access != TagAccess::ReadWrite {
                    warnings.push(format!(
                        "Driver tag {} is not ReadWrite for bidirectional binding",
                        mapping.driver_tag_id
                    ));
                }
            }
        }
    }

    BindingValidationSummary {
        valid: errors.is_empty(),
        errors,
        warnings,
    }
}

fn has_canonical_tag(tags: &[CanonicalTag], key: &str) -> bool {
    tags.iter().any(|tag| tag.key == key)
}
