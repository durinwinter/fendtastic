use crate::state::AppState;
use actix_web::{web, HttpResponse, Responder};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;

// ═══════════════════════════════════════════════════════════════════════════
// I3X Core Data Types (RFC 001)
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Namespace {
    pub uri: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectType {
    #[serde(rename = "elementId")]
    pub element_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "namespaceUri")]
    pub namespace_uri: String,
    pub schema: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelationshipType {
    #[serde(rename = "elementId")]
    pub element_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "namespaceUri")]
    pub namespace_uri: String,
    #[serde(rename = "reverseOf")]
    pub reverse_of: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectInstance {
    #[serde(rename = "elementId")]
    pub element_id: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "typeId")]
    pub type_id: String,
    #[serde(rename = "parentId")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(rename = "isComposition")]
    pub is_composition: bool,
    #[serde(rename = "namespaceUri")]
    pub namespace_uri: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relationships: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RelatedObject {
    #[serde(flatten)]
    pub instance: ObjectInstance,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    #[serde(rename = "relationshipType")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relationship_type: Option<String>,
    #[serde(rename = "relationshipTypeInverse")]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub relationship_type_inverse: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VQT {
    pub value: Value,
    pub quality: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LastKnownValue {
    #[serde(rename = "elementId")]
    pub element_id: String,
    #[serde(rename = "isComposition")]
    pub is_composition: bool,
    pub value: VQT,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoricalValue {
    #[serde(rename = "elementId")]
    pub element_id: String,
    #[serde(rename = "isComposition")]
    pub is_composition: bool,
    pub value: Vec<VQT>,
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.1.1 - List Namespaces
// ═══════════════════════════════════════════════════════════════════════════

pub async fn get_namespaces(_state: web::Data<AppState>) -> impl Responder {
    let namespaces = vec![
        Namespace {
            uri: "https://underhill.murph/ns/pea".to_string(),
            display_name: "Underhill PEA Equipment".to_string(),
        },
        Namespace {
            uri: "https://www.i3x.org/relationships".to_string(),
            display_name: "I3X Standard Relationships".to_string(),
        },
    ];
    HttpResponse::Ok().json(namespaces)
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.1.2/4.1.3 - Object Types
// ═══════════════════════════════════════════════════════════════════════════

pub async fn get_object_types(
    state: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> impl Responder {
    let namespace_filter = query.get("namespaceUri").map(|s| s.as_str());

    let mut types = vec![
        ObjectType {
            element_id: "BaseEquipment".to_string(),
            display_name: "Base Equipment Type".to_string(),
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            schema: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string" },
                    "name": { "type": "string" },
                    "description": { "type": "string" },
                    "vendor": { "type": "string" },
                    "model": { "type": "string" }
                }
            }),
        },
        ObjectType {
            element_id: "PEAType".to_string(),
            display_name: "Process Equipment Asset".to_string(),
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            schema: json!({
                "type": "object",
                "properties": {
                    "pea_id": { "type": "string" },
                    "pea_type": { "type": "string" },
                    "services": {
                        "type": "array",
                        "items": { "type": "object" }
                    },
                    "status": { "type": "string" },
                    "opcua_endpoint": { "type": "string" }
                }
            }),
        },
        ObjectType {
            element_id: "ServiceType".to_string(),
            display_name: "PEA Service".to_string(),
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            schema: json!({
                "type": "object",
                "properties": {
                    "service_tag": { "type": "string" },
                    "service_name": { "type": "string" },
                    "state": { "type": "string" },
                    "procedures": {
                        "type": "array",
                        "items": { "type": "object" }
                    }
                }
            }),
        },
        ObjectType {
            element_id: "ProcedureType".to_string(),
            display_name: "Service Procedure".to_string(),
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            schema: json!({
                "type": "object",
                "properties": {
                    "procedure_id": { "type": "integer" },
                    "procedure_name": { "type": "string" },
                    "parameters": { "type": "array" },
                    "is_self_completing": { "type": "boolean" }
                }
            }),
        },
    ];

    // Add PEA-specific types based on loaded configs
    let pea_configs = state.pea_configs.read().await;
    for config in pea_configs.values() {
        let pea_type = &config.name;
        types.push(ObjectType {
            element_id: format!("{}PEA", pea_type),
            display_name: format!("{} PEA", pea_type),
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            schema: json!({
                "type": "object",
                "extends": "PEAType",
                "properties": {
                    "vendor": { "type": "string", "const": config.writer.vendor },
                    "version": { "type": "string", "const": &config.version }
                }
            }),
        });
    }

    // Filter by namespace if provided
    let filtered = if let Some(ns) = namespace_filter {
        types
            .into_iter()
            .filter(|t| t.namespace_uri == ns)
            .collect()
    } else {
        types
    };

    HttpResponse::Ok().json(filtered)
}

pub async fn get_object_type_by_id(
    state: web::Data<AppState>,
    element_id: web::Path<String>,
) -> impl Responder {
    let pea_configs = state.pea_configs.read().await;
    let element_id = element_id.into_inner();

    // Return base type definitions
    if element_id == "BaseEquipment" {
        return HttpResponse::Ok().json(ObjectType {
            element_id: "BaseEquipment".to_string(),
            display_name: "Base Equipment Type".to_string(),
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            schema: json!({
                "type": "object",
                "properties": {
                    "id": { "type": "string" },
                    "name": { "type": "string" }
                }
            }),
        });
    }

    if element_id == "PEAType" {
        return HttpResponse::Ok().json(ObjectType {
            element_id: "PEAType".to_string(),
            display_name: "Process Equipment Asset".to_string(),
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            schema: json!({
                "type": "object",
                "properties": {
                    "pea_id": { "type": "string" },
                    "services": { "type": "array" }
                }
            }),
        });
    }

    if element_id == "ServiceType" {
        return HttpResponse::Ok().json(ObjectType {
            element_id: "ServiceType".to_string(),
            display_name: "PEA Service".to_string(),
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            schema: json!({
                "type": "object",
                "properties": {
                    "service_tag": { "type": "string" },
                    "state": { "type": "string" }
                }
            }),
        });
    }

    // Check if it's a PEA-specific type
    for config in pea_configs.values() {
        let pea_type = &config.name;
        let type_id = format!("{}PEA", pea_type);
        if element_id == type_id {
            return HttpResponse::Ok().json(ObjectType {
                element_id: type_id.clone(),
                display_name: format!("{} PEA", pea_type),
                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                schema: json!({
                    "type": "object",
                    "extends": "PEAType",
                    "properties": {
                        "vendor": { "type": "string", "const": &config.writer.vendor },
                        "version": { "type": "string", "const": &config.version }
                    }
                }),
            });
        }
    }

    HttpResponse::NotFound().json(json!({
        "error": "ObjectType not found",
        "elementId": element_id
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.1.4 - Relationship Types
// ═══════════════════════════════════════════════════════════════════════════

pub async fn get_relationship_types(
    _state: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> impl Responder {
    let namespace_filter = query.get("namespaceUri").map(|s| s.as_str());

    let types = vec![
        RelationshipType {
            element_id: "HasParent".to_string(),
            display_name: "Has Parent".to_string(),
            namespace_uri: "https://www.i3x.org/relationships".to_string(),
            reverse_of: "HasChildren".to_string(),
        },
        RelationshipType {
            element_id: "HasChildren".to_string(),
            display_name: "Has Children".to_string(),
            namespace_uri: "https://www.i3x.org/relationships".to_string(),
            reverse_of: "HasParent".to_string(),
        },
        RelationshipType {
            element_id: "HasComponent".to_string(),
            display_name: "Has Component".to_string(),
            namespace_uri: "https://www.i3x.org/relationships".to_string(),
            reverse_of: "ComponentOf".to_string(),
        },
        RelationshipType {
            element_id: "ComponentOf".to_string(),
            display_name: "Component Of".to_string(),
            namespace_uri: "https://www.i3x.org/relationships".to_string(),
            reverse_of: "HasComponent".to_string(),
        },
    ];

    let filtered = if let Some(ns) = namespace_filter {
        types
            .into_iter()
            .filter(|t| t.namespace_uri == ns)
            .collect()
    } else {
        types
    };

    HttpResponse::Ok().json(filtered)
}

pub async fn get_relationship_type_by_id(
    element_id: web::Path<String>,
) -> impl Responder {
    let element_id = element_id.into_inner();

    let rel_types = vec![
        RelationshipType {
            element_id: "HasParent".to_string(),
            display_name: "Has Parent".to_string(),
            namespace_uri: "https://www.i3x.org/relationships".to_string(),
            reverse_of: "HasChildren".to_string(),
        },
        RelationshipType {
            element_id: "HasChildren".to_string(),
            display_name: "Has Children".to_string(),
            namespace_uri: "https://www.i3x.org/relationships".to_string(),
            reverse_of: "HasParent".to_string(),
        },
        RelationshipType {
            element_id: "HasComponent".to_string(),
            display_name: "Has Component".to_string(),
            namespace_uri: "https://www.i3x.org/relationships".to_string(),
            reverse_of: "ComponentOf".to_string(),
        },
        RelationshipType {
            element_id: "ComponentOf".to_string(),
            display_name: "Component Of".to_string(),
            namespace_uri: "https://www.i3x.org/relationships".to_string(),
            reverse_of: "HasComponent".to_string(),
        },
    ];

    for rel_type in rel_types {
        if rel_type.element_id == element_id {
            return HttpResponse::Ok().json(rel_type);
        }
    }

    HttpResponse::NotFound().json(json!({
        "error": "RelationshipType not found",
        "elementId": element_id
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.1.5/4.1.7 - Object Instances
// ═══════════════════════════════════════════════════════════════════════════

pub async fn get_objects(
    state: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> impl Responder {
    let _type_id_filter = query.get("typeId").map(|s| s.as_str());
    let _include_metadata = query
        .get("includeMetadata")
        .and_then(|s| s.parse::<bool>().ok())
        .unwrap_or(false);

    let pea_configs = state.pea_configs.read().await;
    let mut objects = vec![
        ObjectInstance {
            element_id: "underhill-base".to_string(),
            display_name: "Underhill Base".to_string(),
            type_id: "BaseEquipment".to_string(),
            parent_id: None,
            is_composition: true,
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            relationships: None,
        },
    ];

    // Add PEA instances
    for (pea_id, config) in pea_configs.iter() {
        let pea_type = config.name.clone();
        objects.push(ObjectInstance {
            element_id: pea_id.clone(),
            display_name: config.name.clone(),
            type_id: format!("{}PEA", pea_type),
            parent_id: Some("underhill-base".to_string()),
            is_composition: true,
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            relationships: None,
        });

        // Add Service instances
        for service in &config.services {
            let service_id = format!("{}-{}", pea_id, service.tag);
            objects.push(ObjectInstance {
                element_id: service_id,
                display_name: service.name.clone(),
                type_id: "ServiceType".to_string(),
                parent_id: Some(pea_id.clone()),
                is_composition: true,
                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                relationships: None,
            });

            // Add Procedure instances
            for procedure in &service.procedures {
                let proc_id = format!(
                    "{}-{}-proc-{}",
                    pea_id, service.tag, procedure.id
                );
                objects.push(ObjectInstance {
                    element_id: proc_id,
                    display_name: procedure.name.clone(),
                    type_id: "ProcedureType".to_string(),
                    parent_id: Some(format!("{}-{}", pea_id, service.tag)),
                    is_composition: false,
                    namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                    relationships: None,
                });
            }
        }
    }

    HttpResponse::Ok().json(objects)
}

pub async fn get_object_by_id(
    state: web::Data<AppState>,
    element_id: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
) -> impl Responder {
    let element_id = element_id.into_inner();
    let _include_metadata = query
        .get("includeMetadata")
        .and_then(|s| s.parse::<bool>().ok())
        .unwrap_or(false);

    if element_id == "underhill-base" {
        return HttpResponse::Ok().json(ObjectInstance {
            element_id: "underhill-base".to_string(),
            display_name: "Underhill Base".to_string(),
            type_id: "BaseEquipment".to_string(),
            parent_id: None,
            is_composition: true,
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            relationships: None,
        });
    }

    let pea_configs = state.pea_configs.read().await;

    // Check if it's a PEA ID
    if let Some(config) = pea_configs.get(&element_id) {
        let pea_type = config.name.clone();
        return HttpResponse::Ok().json(ObjectInstance {
            element_id: element_id.clone(),
            display_name: config.name.clone(),
            type_id: format!("{}PEA", pea_type),
            parent_id: Some("underhill-base".to_string()),
            is_composition: true,
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            relationships: None,
        });
    }

    // Check if it's a Service ID
    for (pea_id, config) in pea_configs.iter() {
        for service in &config.services {
            let service_id = format!("{}-{}", pea_id, service.tag);
            if element_id == service_id {
                return HttpResponse::Ok().json(ObjectInstance {
                    element_id: service_id.clone(),
                    display_name: service.name.clone(),
                    type_id: "ServiceType".to_string(),
                    parent_id: Some(pea_id.clone()),
                    is_composition: true,
                    namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                    relationships: None,
                });
            }

            // Check if it's a Procedure ID
            for procedure in &service.procedures {
                let proc_id = format!(
                    "{}-{}-proc-{}",
                    pea_id, service.tag, procedure.id
                );
                if element_id == proc_id {
                    return HttpResponse::Ok().json(ObjectInstance {
                        element_id: proc_id.clone(),
                        display_name: procedure.name.clone(),
                        type_id: "ProcedureType".to_string(),
                        parent_id: Some(service_id.clone()),
                        is_composition: false,
                        namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                        relationships: None,
                    });
                }
            }
        }
    }

    HttpResponse::NotFound().json(json!({
        "error": "Object not found",
        "elementId": element_id
    }))
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.1.6 - Related Objects
// ═══════════════════════════════════════════════════════════════════════════

pub async fn get_related_objects(
    state: web::Data<AppState>,
    element_id: web::Path<String>,
    query: web::Query<HashMap<String, String>>,
) -> impl Responder {
    let element_id = element_id.into_inner();
    let relationship_type = query.get("relationshiptype").map(|s| s.as_str());

    let pea_configs = state.pea_configs.read().await;
    let mut related = Vec::new();

    // Get base object first
    let base_object = if element_id == "underhill-base" {
        Some(ObjectInstance {
            element_id: "underhill-base".to_string(),
            display_name: "Underhill Base".to_string(),
            type_id: "BaseEquipment".to_string(),
            parent_id: None,
            is_composition: true,
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            relationships: None,
        })
    } else if let Some(config) = pea_configs.get(&element_id) {
        let pea_type = config.name.clone();
        Some(ObjectInstance {
            element_id: element_id.clone(),
            display_name: config.name.clone(),
            type_id: format!("{}PEA", pea_type),
            parent_id: Some("underhill-base".to_string()),
            is_composition: true,
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            relationships: None,
        })
    } else {
        None
    };

    if base_object.is_none() {
        return HttpResponse::NotFound().json(json!({
            "error": "Object not found",
            "elementId": element_id
        }));
    }

    let base_obj = base_object.unwrap();

    // Find HasChildren relationships
    if relationship_type.is_none() || relationship_type == Some("HasChildren") {
        if element_id == "underhill-base" {
            for pea_id in pea_configs.keys() {
                if let Some(config) = pea_configs.get(pea_id) {
                    let pea_type = config.name.clone();
                    related.push(RelatedObject {
                        instance: ObjectInstance {
                            element_id: pea_id.clone(),
                            display_name: config.name.clone(),
                            type_id: format!("{}PEA", pea_type),
                            parent_id: Some("underhill-base".to_string()),
                            is_composition: true,
                            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                            relationships: None,
                        },
                        subject: Some("underhill-base".to_string()),
                        relationship_type: Some("HasChildren".to_string()),
                        relationship_type_inverse: Some("HasParent".to_string()),
                    });
                }
            }
        } else if let Some(config) = pea_configs.get(&element_id) {
            for service in &config.services {
                let service_id = format!("{}-{}", element_id, service.tag);
                related.push(RelatedObject {
                    instance: ObjectInstance {
                        element_id: service_id,
                        display_name: service.name.clone(),
                        type_id: "ServiceType".to_string(),
                        parent_id: Some(element_id.clone()),
                        is_composition: true,
                        namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                        relationships: None,
                    },
                    subject: Some(element_id.clone()),
                    relationship_type: Some("HasChildren".to_string()),
                    relationship_type_inverse: Some("HasParent".to_string()),
                });
            }
        }
    }

    // Find HasParent relationship
    if relationship_type.is_none() || relationship_type == Some("HasParent") {
        if element_id != "underhill-base" {
            related.push(RelatedObject {
                instance: base_obj.clone(),
                subject: Some(element_id.clone()),
                relationship_type: Some("HasParent".to_string()),
                relationship_type_inverse: Some("HasChildren".to_string()),
            });
        }
    }

    HttpResponse::Ok().json(related)
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.2.1.1 - Current Value Query
// ═══════════════════════════════════════════════════════════════════════════

pub async fn get_current_value(
    _state: web::Data<AppState>,
    element_id: web::Path<String>,
) -> impl Responder {
    let element_id = element_id.into_inner();

    // For demonstration, return a mock value
    // In production, this would query the actual PEA state/values
    let now = Utc::now().to_rfc3339();

    LastKnownValue {
        element_id,
        is_composition: false,
        value: VQT {
            value: json!({"status": "operational"}),
            quality: "Good".to_string(),
            timestamp: now,
        },
    }
    .pipe(|value| HttpResponse::Ok().json(value))
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.2.1.2 - Historical Value Query
// ═══════════════════════════════════════════════════════════════════════════

pub async fn get_historical_values(
    state: web::Data<AppState>,
    element_id: web::Path<String>,
) -> impl Responder {
    let element_id = element_id.into_inner();
    let _start_time = std::env::var("START_TIME").ok();
    let _end_time = std::env::var("END_TIME").ok();

    // For demonstration, return recent time series data if available
    let timeseries = state.timeseries.read().await;
    let mut history = Vec::new();

    // Look for time series data matching this element
    for (key, points) in &timeseries.data {
        if key.contains(&element_id) || key.contains("swimlane") {
            for point in points.iter().rev().take(10) {
                history.push(VQT {
                    value: point.value.clone(),
                    quality: "Good".to_string(),
                    timestamp: chrono::DateTime::<Utc>::from_timestamp_millis(
                        point.timestamp_ms,
                    )
                    .map(|dt| dt.to_rfc3339())
                    .unwrap_or_else(|| Utc::now().to_rfc3339()),
                });
            }
            break;
        }
    }

    if history.is_empty() {
        history.push(VQT {
            value: json!({"status": "no_data"}),
            quality: "GoodNoData".to_string(),
            timestamp: Utc::now().to_rfc3339(),
        });
    }

    HttpResponse::Ok().json(vec![HistoricalValue {
        element_id,
        is_composition: false,
        value: history,
    }])
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.2.2 - Value Updates
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct ValueUpdate {
    pub value: Value,
}

pub async fn update_current_value(
    _state: web::Data<AppState>,
    element_id: web::Path<String>,
    body: web::Json<ValueUpdate>,
) -> impl Responder {
    let element_id = element_id.into_inner();

    // In a production system, this would write the value to the actual PEA
    // For now, return a successful update response
    HttpResponse::Ok().json(json!({
        "elementId": element_id,
        "status": "updated",
        "timestamp": Utc::now().to_rfc3339(),
        "value": body.value
    }))
}

// Trait implementation helper
trait Pipe: Sized {
    fn pipe<F, R>(self, f: F) -> R
    where
        F: FnOnce(Self) -> R;
}

impl<T: Sized> Pipe for T {
    fn pipe<F, R>(self, f: F) -> R
    where
        F: FnOnce(Self) -> R,
    {
        f(self)
    }
}
