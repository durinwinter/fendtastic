use crate::binding_validation;
use crate::authority_service;
use crate::driver_handlers;
use crate::runtime_store;
use crate::state::AppState;
use actix_web::{web, HttpResponse, Responder};
use shared::domain::authority::ActorClass;
use shared::domain::driver::DriverInstance;
use shared::domain::binding::BindingDirection;
use shared::domain::binding::{BindingValidationSummary, PeaBinding, TagBinding};
use serde_json::Value;
use std::collections::HashMap;
use uuid::Uuid;

#[derive(serde::Deserialize)]
pub struct CreateBindingRequest {
    pub pea_id: String,
    pub runtime_node_id: String,
    pub driver_instance_id: String,
    pub mappings: Vec<shared::domain::binding::TagBinding>,
}

#[derive(serde::Deserialize)]
pub struct UpdateBindingRequest {
    pub mappings: Vec<shared::domain::binding::TagBinding>,
}

#[derive(serde::Deserialize)]
pub struct BindingReadRequest {
    pub canonical_tag: String,
}

#[derive(serde::Deserialize)]
pub struct BindingWriteRequest {
    pub canonical_tag: String,
    pub value: serde_json::Value,
    pub actor_id: String,
    pub actor_class: ActorClass,
}

#[derive(Debug, Clone, PartialEq)]
enum BindingOperationError {
    NotFound(String),
    BadRequest(String),
    Forbidden(String),
}

#[derive(Debug, Clone)]
struct PreparedBindingOperation {
    binding: PeaBinding,
    mapping: TagBinding,
    driver: DriverInstance,
}

pub async fn list_bindings(state: web::Data<AppState>) -> impl Responder {
    let bindings = state.pea_bindings.read().await;
    let list: Vec<PeaBinding> = bindings.values().cloned().collect();
    HttpResponse::Ok().json(list)
}

pub async fn create_binding(state: web::Data<AppState>, body: web::Json<CreateBindingRequest>) -> impl Responder {
    let mut binding = PeaBinding {
        id: Uuid::new_v4().to_string(),
        pea_id: body.pea_id.clone(),
        runtime_node_id: body.runtime_node_id.clone(),
        driver_instance_id: body.driver_instance_id.clone(),
        mappings: body.mappings.clone(),
        validation: BindingValidationSummary::default(),
    };

    binding.validation = binding_validation::validate_binding_request(&state, &binding).await;
    runtime_store::persist_json(&state.binding_dir, &binding.id, &binding);
    state.pea_bindings.write().await.insert(binding.id.clone(), binding.clone());
    HttpResponse::Created().json(binding)
}

pub async fn get_binding(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let bindings = state.pea_bindings.read().await;
    match bindings.get(id.as_str()) {
        Some(binding) => HttpResponse::Ok().json(binding),
        None => HttpResponse::NotFound().json(serde_json::json!({"error": "Binding not found"})),
    }
}

pub async fn update_binding(state: web::Data<AppState>, id: web::Path<String>, body: web::Json<UpdateBindingRequest>) -> impl Responder {
    let mut bindings = state.pea_bindings.write().await;
    let Some(binding) = bindings.get_mut(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Binding not found"}));
    };

    binding.mappings = body.mappings.clone();
    binding.validation = binding_validation::validate_binding_request(&state, binding).await;
    runtime_store::persist_json(&state.binding_dir, &binding.id, binding);
    HttpResponse::Ok().json(binding)
}

pub async fn delete_binding(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let mut bindings = state.pea_bindings.write().await;
    if bindings.remove(id.as_str()).is_none() {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Binding not found"}));
    }
    runtime_store::delete_json(&state.binding_dir, id.as_str());
    HttpResponse::NoContent().finish()
}

pub async fn validate_binding(state: web::Data<AppState>, id: web::Path<String>) -> impl Responder {
    let mut bindings = state.pea_bindings.write().await;
    let Some(binding) = bindings.get_mut(id.as_str()) else {
        return HttpResponse::NotFound().json(serde_json::json!({"error": "Binding not found"}));
    };
    binding.validation = binding_validation::validate_binding_request(&state, binding).await;
    runtime_store::persist_json(&state.binding_dir, &binding.id, binding);
    HttpResponse::Ok().json(&binding.validation)
}

pub async fn read_binding_tag(
    state: web::Data<AppState>,
    id: web::Path<String>,
    body: web::Json<BindingReadRequest>,
) -> impl Responder {
    let binding = {
        let bindings = state.pea_bindings.read().await;
        match bindings.get(id.as_str()) {
            Some(binding) => binding.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Binding not found"}))
            }
        }
    };

    let drivers = {
        let drivers = state.driver_instances.read().await;
        drivers.clone()
    };

    let prepared = match resolve_binding_read_operation(&binding, &body.canonical_tag, &drivers) {
        Ok(prepared) => prepared,
        Err(error) => return binding_error_response(error),
    };

    match driver_handlers::execute_driver_read(&state, &prepared.driver, &prepared.mapping.driver_tag_id).await {
        Ok(result) => HttpResponse::Ok().json(serde_json::json!({
            "binding_id": prepared.binding.id,
            "canonical_tag": prepared.mapping.canonical_tag,
            "driver_instance_id": prepared.binding.driver_instance_id,
            "driver_tag_id": prepared.mapping.driver_tag_id,
            "result": publish_read_snapshot(&state, &prepared.binding, &prepared.mapping, result).await,
        })),
        Err(response) => response,
    }
}

pub async fn write_binding_tag(
    state: web::Data<AppState>,
    id: web::Path<String>,
    body: web::Json<BindingWriteRequest>,
) -> impl Responder {
    let binding = {
        let bindings = state.pea_bindings.read().await;
        match bindings.get(id.as_str()) {
            Some(binding) => binding.clone(),
            None => {
                return HttpResponse::NotFound()
                    .json(serde_json::json!({"error": "Binding not found"}))
            }
        }
    };

    let drivers = {
        let drivers = state.driver_instances.read().await;
        drivers.clone()
    };
    let authority = driver_handlers::get_authority_for_pea(&state, &binding.pea_id).await;

    let prepared = match resolve_binding_write_operation(
        &binding,
        &body.canonical_tag,
        &drivers,
        &authority,
        &body.actor_class,
    ) {
        Ok(prepared) => prepared,
        Err(error) => return binding_error_response(error),
    };

    let driver_value = match apply_write_transform(&prepared.mapping, body.value.clone()) {
        Ok(value) => value,
        Err(message) => {
            return HttpResponse::BadRequest().json(serde_json::json!({
                "error": message
            }))
        }
    };

    match driver_handlers::execute_driver_write(&state, &prepared.driver, &prepared.mapping.driver_tag_id, driver_value.clone()).await {
        Ok(result) => {
            let snapshot = serde_json::json!({
                "tag_id": result.tag_id,
                "value": body.value,
                "driver_value": driver_value,
                "quality": "good",
                "timestamp": chrono::Utc::now().to_rfc3339(),
            });
            publish_binding_value_snapshot(&state, &prepared.binding, &prepared.mapping, snapshot).await;
            HttpResponse::Ok().json(serde_json::json!({
                "binding_id": prepared.binding.id,
                "canonical_tag": prepared.mapping.canonical_tag,
                "driver_instance_id": prepared.binding.driver_instance_id,
                "driver_tag_id": result.tag_id,
                "value": body.value,
                "driver_value": driver_value,
                "actor_id": body.actor_id,
                "status": "accepted",
                "timestamp": chrono::Utc::now().to_rfc3339(),
            }))
        }
        Err(response) => response,
    }
}

pub(crate) async fn publish_read_snapshot(
    state: &web::Data<AppState>,
    binding: &PeaBinding,
    mapping: &TagBinding,
    result: Value,
) -> Value {
    let transformed = transformed_read_result(mapping, result);
    publish_binding_value_snapshot(state, binding, mapping, transformed.clone()).await;
    transformed
}

pub(crate) fn binding_value_topic(binding: &PeaBinding, mapping: &TagBinding) -> String {
    format!(
        "murph/runtime/nodes/{}/pea/{}/bindings/{}/value",
        binding.runtime_node_id, binding.pea_id, mapping.canonical_tag
    )
}

pub(crate) async fn publish_binding_value_snapshot(
    state: &web::Data<AppState>,
    binding: &PeaBinding,
    mapping: &TagBinding,
    result: Value,
) {
    let topic = binding_value_topic(binding, mapping);
    let timestamp_ms = chrono::Utc::now().timestamp_millis();
    let payload = serde_json::json!({
        "binding_id": binding.id,
        "runtime_node_id": binding.runtime_node_id,
        "pea_id": binding.pea_id,
        "canonical_tag": mapping.canonical_tag,
        "driver_instance_id": binding.driver_instance_id,
        "driver_tag_id": mapping.driver_tag_id,
        "result": result,
        "timestamp": chrono::Utc::now().to_rfc3339(),
    });
    state
        .timeseries
        .write()
        .await
        .insert(topic.clone(), payload.clone(), timestamp_ms);
    let _ = state
        .zenoh_session
        .put(&topic, payload.to_string())
        .await;
}

fn transformed_read_result(mapping: &TagBinding, result: Value) -> Value {
    let raw_value = result.get("value").cloned().unwrap_or(Value::Null);
    let transformed = apply_read_transform(mapping, raw_value.clone()).unwrap_or(raw_value.clone());
    let mut object = result.as_object().cloned().unwrap_or_default();
    object.insert("raw_value".to_string(), raw_value);
    object.insert("value".to_string(), transformed);
    Value::Object(object)
}

fn apply_read_transform(mapping: &TagBinding, value: Value) -> Result<Value, String> {
    apply_transform(mapping.transform.as_ref(), value, TransformDirection::Read)
}

fn apply_write_transform(mapping: &TagBinding, value: Value) -> Result<Value, String> {
    apply_transform(mapping.transform.as_ref(), value, TransformDirection::Write)
}

fn resolve_binding_read_operation(
    binding: &PeaBinding,
    canonical_tag: &str,
    drivers: &HashMap<String, DriverInstance>,
) -> Result<PreparedBindingOperation, BindingOperationError> {
    let mapping = binding
        .mappings
        .iter()
        .find(|mapping| mapping.canonical_tag == canonical_tag)
        .cloned()
        .ok_or_else(|| BindingOperationError::NotFound("Canonical tag mapping not found".to_string()))?;

    if !matches!(mapping.direction, BindingDirection::ReadFromDriver | BindingDirection::Bidirectional) {
        return Err(BindingOperationError::BadRequest(
            "Binding does not support read access".to_string(),
        ));
    }

    let driver = drivers
        .get(&binding.driver_instance_id)
        .cloned()
        .ok_or_else(|| BindingOperationError::BadRequest("Driver instance not found".to_string()))?;

    Ok(PreparedBindingOperation {
        binding: binding.clone(),
        mapping,
        driver,
    })
}

fn resolve_binding_write_operation(
    binding: &PeaBinding,
    canonical_tag: &str,
    drivers: &HashMap<String, DriverInstance>,
    authority: &shared::domain::authority::AuthorityState,
    actor_class: &ActorClass,
) -> Result<PreparedBindingOperation, BindingOperationError> {
    if let Err(message) = authority_service::validate_write_request(authority, actor_class) {
        return Err(BindingOperationError::Forbidden(message));
    }

    let mapping = binding
        .mappings
        .iter()
        .find(|mapping| mapping.canonical_tag == canonical_tag)
        .cloned()
        .ok_or_else(|| BindingOperationError::NotFound("Canonical tag mapping not found".to_string()))?;

    if !matches!(mapping.direction, BindingDirection::WriteToDriver | BindingDirection::Bidirectional) {
        return Err(BindingOperationError::BadRequest(
            "Binding does not support write access".to_string(),
        ));
    }

    let driver = drivers
        .get(&binding.driver_instance_id)
        .cloned()
        .ok_or_else(|| BindingOperationError::BadRequest("Driver instance not found".to_string()))?;

    Ok(PreparedBindingOperation {
        binding: binding.clone(),
        mapping,
        driver,
    })
}

fn binding_error_response(error: BindingOperationError) -> HttpResponse {
    match error {
        BindingOperationError::NotFound(message) => {
            HttpResponse::NotFound().json(serde_json::json!({ "error": message }))
        }
        BindingOperationError::BadRequest(message) => {
            HttpResponse::BadRequest().json(serde_json::json!({ "error": message }))
        }
        BindingOperationError::Forbidden(message) => {
            HttpResponse::Forbidden().json(serde_json::json!({ "error": message }))
        }
    }
}

#[derive(Clone, Copy)]
enum TransformDirection {
    Read,
    Write,
}

fn apply_transform(transform: Option<&Value>, value: Value, direction: TransformDirection) -> Result<Value, String> {
    let Some(transform) = transform else {
        return Ok(value);
    };
    let Some(transform_obj) = transform.as_object() else {
        return Err("Transform must be an object".to_string());
    };

    let mut current = value;

    if transform_obj
        .get("invert")
        .and_then(|value| value.as_bool())
        .unwrap_or(false)
    {
        current = match current {
            Value::Bool(inner) => Value::Bool(!inner),
            other => other,
        };
    }

    if let Some(map) = transform_obj.get("map").and_then(|value| value.as_object()) {
        current = match direction {
            TransformDirection::Read => apply_value_map(map, &current).unwrap_or(current),
            TransformDirection::Write => apply_reverse_value_map(map, &current).unwrap_or(current),
        };
    }

    if let Some(unit) = transform_obj.get("unit").and_then(|value| value.as_str()) {
        current = apply_unit_transform(current, unit, direction)?;
    }

    let scale = transform_obj.get("scale").and_then(|value| value.as_f64());
    let offset = transform_obj.get("offset").and_then(|value| value.as_f64());
    if scale.is_some() || offset.is_some() {
        current = apply_numeric_transform(current, scale, offset, direction)?;
    }

    Ok(current)
}

fn apply_unit_transform(
    value: Value,
    unit: &str,
    direction: TransformDirection,
) -> Result<Value, String> {
    let Some(number) = value.as_f64() else {
        return Err("Unit transform requires a numeric value".to_string());
    };

    let transformed = match (unit, direction) {
        ("c_to_f", TransformDirection::Read) => number * 9.0 / 5.0 + 32.0,
        ("c_to_f", TransformDirection::Write) => (number - 32.0) * 5.0 / 9.0,
        ("f_to_c", TransformDirection::Read) => (number - 32.0) * 5.0 / 9.0,
        ("f_to_c", TransformDirection::Write) => number * 9.0 / 5.0 + 32.0,
        ("percent_to_fraction", TransformDirection::Read) => number / 100.0,
        ("percent_to_fraction", TransformDirection::Write) => number * 100.0,
        ("fraction_to_percent", TransformDirection::Read) => number * 100.0,
        ("fraction_to_percent", TransformDirection::Write) => number / 100.0,
        ("psi_to_bar", TransformDirection::Read) => number * 0.0689476,
        ("psi_to_bar", TransformDirection::Write) => number / 0.0689476,
        ("bar_to_psi", TransformDirection::Read) => number / 0.0689476,
        ("bar_to_psi", TransformDirection::Write) => number * 0.0689476,
        ("rpm_to_hz", TransformDirection::Read) => number / 60.0,
        ("rpm_to_hz", TransformDirection::Write) => number * 60.0,
        ("hz_to_rpm", TransformDirection::Read) => number * 60.0,
        ("hz_to_rpm", TransformDirection::Write) => number / 60.0,
        ("lpm_to_m3h", TransformDirection::Read) => number * 0.06,
        ("lpm_to_m3h", TransformDirection::Write) => number / 0.06,
        ("m3h_to_lpm", TransformDirection::Read) => number / 0.06,
        ("m3h_to_lpm", TransformDirection::Write) => number * 0.06,
        _ => return Err(format!("Unsupported unit transform: {unit}")),
    };

    serde_json::Number::from_f64(transformed)
        .map(Value::Number)
        .ok_or_else(|| "Unit transformed value is not representable".to_string())
}

fn apply_numeric_transform(
    value: Value,
    scale: Option<f64>,
    offset: Option<f64>,
    direction: TransformDirection,
) -> Result<Value, String> {
    let Some(number) = value.as_f64() else {
        return Err("Numeric transform requires a numeric value".to_string());
    };

    let scale_value = scale.unwrap_or(1.0);
    let offset_value = offset.unwrap_or(0.0);
    let transformed = match direction {
        TransformDirection::Read => number * scale_value + offset_value,
        TransformDirection::Write => {
            if scale_value == 0.0 {
                return Err("Transform scale cannot be zero for writes".to_string());
            }
            (number - offset_value) / scale_value
        }
    };

    serde_json::Number::from_f64(transformed)
        .map(Value::Number)
        .ok_or_else(|| "Transformed numeric value is not representable".to_string())
}

fn apply_value_map(map: &serde_json::Map<String, Value>, value: &Value) -> Option<Value> {
    let key = scalar_map_key(value)?;
    map.get(&key).cloned()
}

fn apply_reverse_value_map(map: &serde_json::Map<String, Value>, value: &Value) -> Option<Value> {
    let target = scalar_map_key(value)?;
    map.iter()
        .find_map(|(key, mapped)| (scalar_map_key(mapped) == Some(target.clone())).then(|| scalar_value_from_key(key)))
        .flatten()
}

fn scalar_map_key(value: &Value) -> Option<String> {
    match value {
        Value::Null => Some("null".to_string()),
        Value::Bool(inner) => Some(inner.to_string()),
        Value::Number(inner) => Some(inner.to_string()),
        Value::String(inner) => Some(inner.clone()),
        _ => None,
    }
}

fn scalar_value_from_key(key: &str) -> Option<Value> {
    if key == "null" {
        return Some(Value::Null);
    }
    if key == "true" {
        return Some(Value::Bool(true));
    }
    if key == "false" {
        return Some(Value::Bool(false));
    }
    if let Ok(integer) = key.parse::<i64>() {
        return Some(Value::Number(integer.into()));
    }
    if let Ok(float) = key.parse::<f64>() {
        if let Some(number) = serde_json::Number::from_f64(float) {
            return Some(Value::Number(number));
        }
    }
    Some(Value::String(key.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use shared::domain::binding::TagBinding;

    fn sample_mapping(transform: Value) -> TagBinding {
        TagBinding {
            canonical_tag: "active.valve.open_cmd".to_string(),
            driver_tag_id: "tag-1".to_string(),
            direction: BindingDirection::Bidirectional,
            transform: Some(transform),
        }
    }

    #[test]
    fn read_transform_applies_scale_and_offset() {
        let mapping = sample_mapping(serde_json::json!({
            "scale": 2.0,
            "offset": 1.5
        }));

        let transformed = apply_read_transform(&mapping, serde_json::json!(3.0)).unwrap();
        assert_eq!(transformed, serde_json::json!(7.5));
    }

    #[test]
    fn write_transform_reverses_scale_and_offset() {
        let mapping = sample_mapping(serde_json::json!({
            "scale": 2.0,
            "offset": 1.5
        }));

        let transformed = apply_write_transform(&mapping, serde_json::json!(7.5)).unwrap();
        assert_eq!(transformed, serde_json::json!(3.0));
    }

    #[test]
    fn read_transform_applies_bool_invert_and_map() {
        let mapping = sample_mapping(serde_json::json!({
            "invert": true,
            "map": {
                "false": "closed",
                "true": "open"
            }
        }));

        let transformed = apply_read_transform(&mapping, serde_json::json!(true)).unwrap();
        assert_eq!(transformed, serde_json::json!("closed"));
    }

    #[test]
    fn write_transform_reverses_map_before_write() {
        let mapping = sample_mapping(serde_json::json!({
            "map": {
                "0": "closed",
                "1": "open"
            }
        }));

        let transformed = apply_write_transform(&mapping, serde_json::json!("open")).unwrap();
        assert_eq!(transformed, serde_json::json!(1));
    }

    #[test]
    fn read_transform_applies_unit_conversion() {
        let mapping = sample_mapping(serde_json::json!({
            "unit": "c_to_f"
        }));

        let transformed = apply_read_transform(&mapping, serde_json::json!(25.0)).unwrap();
        assert_eq!(transformed, serde_json::json!(77.0));
    }

    #[test]
    fn resolve_binding_write_operation_rejects_authority_violation() {
        let binding = PeaBinding {
            id: "binding-1".to_string(),
            pea_id: "pea-1".to_string(),
            runtime_node_id: "runtime-1".to_string(),
            driver_instance_id: "driver-1".to_string(),
            mappings: vec![TagBinding {
                canonical_tag: "active.pump.start_cmd".to_string(),
                driver_tag_id: "tag-1".to_string(),
                direction: BindingDirection::WriteToDriver,
                transform: None,
            }],
            validation: BindingValidationSummary::default(),
        };
        let mut drivers = HashMap::new();
        drivers.insert(
            "driver-1".to_string(),
            DriverInstance {
                id: "driver-1".to_string(),
                runtime_node_id: "runtime-1".to_string(),
                pea_id: "pea-1".to_string(),
                driver_key: "siemens-s7".to_string(),
                display_name: "Driver".to_string(),
                state: shared::domain::driver::DriverInstanceState::Running,
                config: serde_json::json!({}),
                tag_groups: vec![],
                last_error: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        );
        let authority = authority_service::default_authority_state("pea-1");

        let result = resolve_binding_write_operation(
            &binding,
            "active.pump.start_cmd",
            &drivers,
            &authority,
            &ActorClass::AI,
        );

        assert!(matches!(
            result,
            Err(BindingOperationError::Forbidden(message))
                if message == "Writes are disabled in ObserveOnly mode"
        ));
    }

    #[test]
    fn resolve_binding_read_operation_returns_driver_for_valid_mapping() {
        let binding = PeaBinding {
            id: "binding-1".to_string(),
            pea_id: "pea-1".to_string(),
            runtime_node_id: "runtime-1".to_string(),
            driver_instance_id: "driver-1".to_string(),
            mappings: vec![TagBinding {
                canonical_tag: "active.pump.pressure".to_string(),
                driver_tag_id: "tag-2".to_string(),
                direction: BindingDirection::ReadFromDriver,
                transform: None,
            }],
            validation: BindingValidationSummary::default(),
        };
        let mut drivers = HashMap::new();
        drivers.insert(
            "driver-1".to_string(),
            DriverInstance {
                id: "driver-1".to_string(),
                runtime_node_id: "runtime-1".to_string(),
                pea_id: "pea-1".to_string(),
                driver_key: "siemens-s7".to_string(),
                display_name: "Driver".to_string(),
                state: shared::domain::driver::DriverInstanceState::Running,
                config: serde_json::json!({}),
                tag_groups: vec![],
                last_error: None,
                created_at: chrono::Utc::now(),
                updated_at: chrono::Utc::now(),
            },
        );

        let prepared =
            resolve_binding_read_operation(&binding, "active.pump.pressure", &drivers).unwrap();

        assert_eq!(prepared.driver.id, "driver-1");
        assert_eq!(prepared.mapping.driver_tag_id, "tag-2");
    }
}
