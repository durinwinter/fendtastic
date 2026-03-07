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

#[cfg(test)]
mod tests {
    use super::*;

    fn state(mode: ControlAuthorityMode) -> AuthorityState {
        AuthorityState {
            pea_id: "pea-1".to_string(),
            mode,
            owner_actor_id: None,
            owner_actor_class: None,
            updated_at: chrono::Utc::now(),
            reason: None,
        }
    }

    #[test]
    fn observe_only_blocks_writes() {
        let err = validate_write_request(&state(ControlAuthorityMode::ObserveOnly), &ActorClass::Operator)
            .expect_err("observe-only should reject writes");
        assert!(err.contains("ObserveOnly"));
    }

    #[test]
    fn operator_exclusive_allows_only_operators() {
        assert!(validate_write_request(
            &state(ControlAuthorityMode::OperatorExclusive),
            &ActorClass::Operator
        )
        .is_ok());
        assert!(validate_write_request(
            &state(ControlAuthorityMode::OperatorExclusive),
            &ActorClass::AI
        )
        .is_err());
    }

    #[test]
    fn ai_assisted_blocks_ai_but_allows_operator() {
        assert!(validate_write_request(
            &state(ControlAuthorityMode::AIAssisted),
            &ActorClass::Operator
        )
        .is_ok());
        assert!(validate_write_request(
            &state(ControlAuthorityMode::AIAssisted),
            &ActorClass::AI
        )
        .is_err());
    }
}
