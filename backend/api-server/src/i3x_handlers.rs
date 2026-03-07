use crate::state::AppState;
use shared::mtp::PeaConfig; // bring into scope for helper type signatures
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
// I3X Bulk/Query Request Types (common in I3X clients)
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Deserialize)]
pub struct BulkElementRequest {
    #[serde(rename = "elementIds")]
    pub element_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkRelatedRequest {
    #[serde(rename = "elementIds")]
    pub element_ids: Vec<String>,
    #[serde(rename = "relationshipType")]
    pub relationship_type: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct BulkValueRequest {
    #[serde(rename = "elementIds")]
    pub element_ids: Vec<String>,
    #[serde(rename = "maxDepth")]
    pub max_depth: Option<i32>,
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

pub async fn query_object_types(
    state: web::Data<AppState>,
    body: web::Json<BulkElementRequest>,
) -> impl Responder {
    let pea_configs = state.pea_configs.read().await;
    let mut results = Vec::new();

    for element_id in &body.element_ids {
        if element_id == "BaseEquipment" {
            results.push(ObjectType {
                element_id: "BaseEquipment".to_string(),
                display_name: "Base Equipment Type".to_string(),
                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                schema: json!({
                    "type": "object",
                    "properties": { "id": { "type": "string" }, "name": { "type": "string" } }
                }),
            });
        } else if element_id == "PEAType" {
            results.push(ObjectType {
                element_id: "PEAType".to_string(),
                display_name: "Process Equipment Asset".to_string(),
                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                schema: json!({
                    "type": "object",
                    "properties": { "pea_id": { "type": "string" }, "services": { "type": "array" } }
                }),
            });
        } else if element_id == "ServiceType" {
            results.push(ObjectType {
                element_id: "ServiceType".to_string(),
                display_name: "PEA Service".to_string(),
                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                schema: json!({
                    "type": "object",
                    "properties": { "service_tag": { "type": "string" }, "state": { "type": "string" } }
                }),
            });
        } else {
            for config in pea_configs.values() {
                let type_id = format!("{}PEA", config.name);
                if element_id == &type_id {
                    results.push(ObjectType {
                        element_id: type_id,
                        display_name: format!("{} PEA", config.name),
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
                    break;
                }
            }
        }
    }

    HttpResponse::Ok().json(results)
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

pub async fn query_relationship_types(
    body: web::Json<BulkElementRequest>,
) -> impl Responder {
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

    let results: Vec<_> = rel_types
        .into_iter()
        .filter(|t| body.element_ids.contains(&t.element_id))
        .collect();

    HttpResponse::Ok().json(results)
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
// Helper for building relationship metadata
// ═══════════════════════════════════════════════════════════════════════════

fn compute_relationships(
    element_id: &str,
    pea_configs: &std::collections::HashMap<String, shared::mtp::PeaConfig>,
) -> Option<serde_json::Value> {
    use serde_json::{json, Map, Value};

    let mut map = Map::new();

    if element_id == "underhill-base" {
        let children: Vec<Value> = pea_configs
            .keys()
            .map(|k| Value::String(k.clone()))
            .collect();
        if !children.is_empty() {
            map.insert("HasChildren".to_string(), Value::Array(children));
        }
    } else if let Some(config) = pea_configs.get(element_id) {
        // PEA instance
        map.insert(
            "HasParent".to_string(),
            Value::Array(vec![Value::String("underhill-base".to_string())]),
        );
        let children: Vec<Value> = config
            .services
            .iter()
            .map(|svc| Value::String(format!("{}-{}", element_id, svc.tag)))
            .collect();
        if !children.is_empty() {
            map.insert("HasChildren".to_string(), Value::Array(children.clone()));
            // Also expose as components for richer visualization in some explorers
            map.insert("HasComponent".to_string(), Value::Array(children));
        }
    } else if element_id.contains("-proc-") {
        // procedure id -> parent is service (everything before "-proc-")
        if let Some((svc_id, _)) = element_id.split_once("-proc-") {
            map.insert(
                "HasParent".to_string(),
                Value::Array(vec![Value::String(svc_id.to_string())]),
            );
            map.insert(
                "ComponentOf".to_string(),
                Value::Array(vec![Value::String(svc_id.to_string())]),
            );
        }
    } else if let Some((pea_id, tag)) = element_id.split_once('-') {
        // service id -> parent is PEA, and children are procedures
        map.insert(
            "HasParent".to_string(),
            Value::Array(vec![Value::String(pea_id.to_string())]),
        );
        map.insert(
            "ComponentOf".to_string(),
            Value::Array(vec![Value::String(pea_id.to_string())]),
        );

        if let Some(config) = pea_configs.get(pea_id) {
            if let Some(svc) = config.services.iter().find(|s| s.tag == tag) {
                let procs: Vec<Value> = svc
                    .procedures
                    .iter()
                    .map(|p| Value::String(format!("{}-proc-{}", element_id, p.id)))
                    .collect();
                if !procs.is_empty() {
                    map.insert("HasChildren".to_string(), Value::Array(procs.clone()));
                    map.insert("HasComponent".to_string(), Value::Array(procs));
                }
            }
        }
    }

    if map.is_empty() {
        None
    } else {
        Some(Value::Object(map))
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// RFC 4.1.5/4.1.7 - Object Instances
// ═══════════════════════════════════════════════════════════════════════════

pub async fn get_objects(
    state: web::Data<AppState>,
    query: web::Query<HashMap<String, String>>,
) -> impl Responder {
    let _type_id_filter = query.get("typeId").map(|s| s.as_str());
    let include_metadata = query
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
            relationships: if include_metadata {
                compute_relationships("underhill-base", &pea_configs)
            } else {
                None
            },
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
            relationships: if include_metadata {
                compute_relationships(pea_id, &pea_configs)
            } else {
                None
            },
        });

        // Add Service instances
        for service in &config.services {
            let service_id = format!("{}-{}", pea_id, service.tag);
            objects.push(ObjectInstance {
                element_id: service_id.clone(),
                display_name: service.name.clone(),
                type_id: "ServiceType".to_string(),
                parent_id: Some(pea_id.clone()),
                is_composition: true,
                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                relationships: if include_metadata {
                    compute_relationships(&service_id, &pea_configs)
                } else {
                    None
                },
            });

            // Add Procedure instances
            for procedure in &service.procedures {
                let proc_id = format!(
                    "{}-{}-proc-{}",
                    pea_id, service.tag, procedure.id
                );
                objects.push(ObjectInstance {
                    element_id: proc_id.clone(),
                    display_name: procedure.name.clone(),
                    type_id: "ProcedureType".to_string(),
                    parent_id: Some(format!("{}-{}", pea_id, service.tag)),
                    is_composition: false,
                    namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                    relationships: if include_metadata {
                        compute_relationships(&proc_id, &pea_configs)
                    } else {
                        None
                    },
                });
            }
        }
    }

    HttpResponse::Ok().json(objects)
}

pub async fn get_objects_list(
    state: web::Data<AppState>,
    body: web::Json<BulkElementRequest>,
) -> impl Responder {
    let pea_configs = state.pea_configs.read().await;
    let mut results = Vec::new();

    for element_id in &body.element_ids {
        if element_id == "underhill-base" {
            results.push(ObjectInstance {
                element_id: "underhill-base".to_string(),
                display_name: "Underhill Base".to_string(),
                type_id: "BaseEquipment".to_string(),
                parent_id: None,
                is_composition: true,
                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                relationships: compute_relationships("underhill-base", &pea_configs),
            });
        } else if let Some(config) = pea_configs.get(element_id) {
            results.push(ObjectInstance {
                element_id: element_id.clone(),
                display_name: config.name.clone(),
                type_id: format!("{}PEA", config.name),
                parent_id: Some("underhill-base".to_string()),
                is_composition: true,
                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                relationships: compute_relationships(element_id, &pea_configs),
            });
        } else {
            // Check Services and Procedures
            'outer: for (pea_id, config) in pea_configs.iter() {
                for service in &config.services {
                    let service_id = format!("{}-{}", pea_id, service.tag);
                    if element_id == &service_id {
                        results.push(ObjectInstance {
                            element_id: service_id.clone(),
                            display_name: service.name.clone(),
                            type_id: "ServiceType".to_string(),
                            parent_id: Some(pea_id.clone()),
                            is_composition: true,
                            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                            relationships: compute_relationships(&service_id, &pea_configs),
                        });
                        break 'outer;
                    }
                    for procedure in &service.procedures {
                        let proc_id = format!("{}-{}-proc-{}", pea_id, service.tag, procedure.id);
                        if element_id == &proc_id {
                            results.push(ObjectInstance {
                                element_id: proc_id.clone(),
                                display_name: procedure.name.clone(),
                                type_id: "ProcedureType".to_string(),
                                parent_id: Some(service_id.clone()),
                                is_composition: false,
                                namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                                relationships: compute_relationships(&proc_id, &pea_configs),
                            });
                            break 'outer;
                        }
                    }
                }
            }
        }
    }

    HttpResponse::Ok().json(results)
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
        let pea_map = state.pea_configs.read().await;
        return HttpResponse::Ok().json(ObjectInstance {
            element_id: "underhill-base".to_string(),
            display_name: "Underhill Base".to_string(),
            type_id: "BaseEquipment".to_string(),
            parent_id: None,
            is_composition: true,
            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
            relationships: compute_relationships("underhill-base", &pea_map),
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
            relationships: compute_relationships(&element_id, &pea_configs),
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
                    relationships: compute_relationships(&service_id, &pea_configs),
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
                        relationships: compute_relationships(&proc_id, &pea_configs),
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

pub async fn get_related_objects_bulk(
    state: web::Data<AppState>,
    body: web::Json<BulkRelatedRequest>,
) -> impl Responder {
    let pea_configs = state.pea_configs.read().await;
    let mut all_related = Vec::new();

    for element_id in &body.element_ids {
        let mut related = Vec::new();

        // Hierarchical relationships (HasChildren)
        if body.relationship_type.is_none()
            || body.relationship_type == Some("HasChildren".to_string())
            || body.relationship_type == Some("HasComponent".to_string())
        {
            if element_id == "underhill-base" {
                for pea_id in pea_configs.keys() {
                    if let Some(config) = pea_configs.get(pea_id) {
                        related.push(RelatedObject {
                            instance: ObjectInstance {
                                element_id: pea_id.clone(),
                                display_name: config.name.clone(),
                                type_id: format!("{}PEA", config.name),
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
            } else if let Some(config) = pea_configs.get(element_id) {
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
            } else if let Some((pea_id, tag)) = element_id.split_once('-') {
                if !element_id.contains("-proc-") {
                    if let Some(config) = pea_configs.get(pea_id) {
                        if let Some(svc) = config.services.iter().find(|s| s.tag == tag) {
                            for procedure in &svc.procedures {
                                let proc_id = format!("{}-proc-{}", element_id, procedure.id);
                                related.push(RelatedObject {
                                    instance: ObjectInstance {
                                        element_id: proc_id.clone(),
                                        display_name: procedure.name.clone(),
                                        type_id: "ProcedureType".to_string(),
                                        parent_id: Some(element_id.clone()),
                                        is_composition: false,
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
                }
            }
        }

        // Hierarchical relationships (HasParent)
        if body.relationship_type.is_none()
            || body.relationship_type == Some("HasParent".to_string())
            || body.relationship_type == Some("ComponentOf".to_string())
        {
            if element_id != "underhill-base" {
                // Find parent
                let parent_id = if let Some(_) = pea_configs.get(element_id) {
                    Some("underhill-base".to_string())
                } else if element_id.contains("-proc-") {
                    element_id.split_once("-proc-").map(|(s, _)| s.to_string())
                } else if let Some((pea_id, _)) = element_id.split_once('-') {
                    Some(pea_id.to_string())
                } else {
                    None
                };

                if let Some(pid) = parent_id {
                    let parent_instance = if pid == "underhill-base" {
                        ObjectInstance {
                            element_id: "underhill-base".to_string(),
                            display_name: "Underhill Base".to_string(),
                            type_id: "BaseEquipment".to_string(),
                            parent_id: None,
                            is_composition: true,
                            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                            relationships: None,
                        }
                    } else if let Some(p_config) = pea_configs.get(&pid) {
                        ObjectInstance {
                            element_id: pid.clone(),
                            display_name: p_config.name.clone(),
                            type_id: format!("{}PEA", p_config.name),
                            parent_id: Some("underhill-base".to_string()),
                            is_composition: true,
                            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                            relationships: None,
                        }
                    } else {
                        // Service as parent
                        ObjectInstance {
                            element_id: pid.clone(),
                            display_name: pid.clone(), // Fallback
                            type_id: "ServiceType".to_string(),
                            parent_id: None, // Simplified
                            is_composition: true,
                            namespace_uri: "https://underhill.murph/ns/pea".to_string(),
                            relationships: None,
                        }
                    };

                    related.push(RelatedObject {
                        instance: parent_instance,
                        subject: Some(element_id.clone()),
                        relationship_type: Some("HasParent".to_string()),
                        relationship_type_inverse: Some("HasChildren".to_string()),
                    });
                }
            }
        }

        all_related.extend(related);
    }

    HttpResponse::Ok().json(all_related)
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

pub async fn get_current_value_bulk(
    _state: web::Data<AppState>,
    body: web::Json<BulkValueRequest>,
) -> impl Responder {
    let now = Utc::now().to_rfc3339();
    let mut results = HashMap::new();

    for element_id in &body.element_ids {
        results.insert(
            element_id.clone(),
            json!({
                "elementId": element_id,
                "isComposition": false,
                "value": {
                    "value": {"status": "operational"},
                    "quality": "Good",
                    "timestamp": &now
                }
            }),
        );
    }

    HttpResponse::Ok().json(results)
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
