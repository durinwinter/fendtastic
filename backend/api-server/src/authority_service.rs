use shared::domain::authority::{ActorClass, AuthorityAuditRecord, AuthorityChangeRequest, AuthorityState, ControlAuthorityMode};

pub fn default_authority_state(pea_id: &str) -> AuthorityState {
    AuthorityState {
        pea_id: pea_id.to_string(),
        mode: ControlAuthorityMode::ObserveOnly,
        owner_actor_id: None,
        owner_actor_class: None,
        updated_at: chrono::Utc::now(),
        reason: Some("Default authority state".to_string()),
    }
}

pub fn apply_authority_change(pea_id: &str, request: AuthorityChangeRequest) -> (AuthorityState, AuthorityAuditRecord) {
    let updated_at = chrono::Utc::now();
    let state = AuthorityState {
        pea_id: pea_id.to_string(),
        mode: request.mode.clone(),
        owner_actor_id: request.owner_actor_id.clone(),
        owner_actor_class: request.owner_actor_class.clone(),
        updated_at,
        reason: request.reason.clone(),
    };
    let audit = AuthorityAuditRecord {
        pea_id: pea_id.to_string(),
        mode: request.mode,
        owner_actor_id: request.owner_actor_id,
        owner_actor_class: request.owner_actor_class,
        changed_at: updated_at,
        reason: request.reason,
    };
    (state, audit)
}

pub fn validate_write_request(
    authority: &AuthorityState,
    actor_class: &ActorClass,
) -> Result<(), String> {
    match authority.mode {
        ControlAuthorityMode::ObserveOnly => Err("Writes are disabled in ObserveOnly mode".to_string()),
        ControlAuthorityMode::OperatorExclusive if actor_class != &ActorClass::Operator => {
            Err("Only Operator actors may write in OperatorExclusive mode".to_string())
        }
        ControlAuthorityMode::AutoExclusive if actor_class != &ActorClass::Automation => {
            Err("Only Automation actors may write in AutoExclusive mode".to_string())
        }
        ControlAuthorityMode::AIAssisted if actor_class == &ActorClass::AI => {
            Err("AI actors may not write in AIAssisted mode".to_string())
        }
        ControlAuthorityMode::AIExclusive if actor_class != &ActorClass::AI => {
            Err("Only AI actors may write in AIExclusive mode".to_string())
        }
        ControlAuthorityMode::MaintenanceExclusive if actor_class != &ActorClass::Maintenance => {
            Err("Only Maintenance actors may write in MaintenanceExclusive mode".to_string())
        }
        ControlAuthorityMode::EmergencyLockout => Err("Writes are disabled in EmergencyLockout mode".to_string()),
        _ => Ok(()),
    }
}
