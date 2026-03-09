use shared::domain::driver::{DriverCatalogEntry, DriverDirection};

pub fn built_in_catalog() -> Vec<DriverCatalogEntry> {
    vec![DriverCatalogEntry {
        key: "siemens-s7".to_string(),
        name: "Siemens S7".to_string(),
        vendor: "Neuron".to_string(),
        direction: DriverDirection::Southbound,
        config_schema: serde_json::json!({
            "type": "object",
            "required": ["host", "rack", "slot"],
            "properties": {
                "host": { "type": "string", "title": "PLC Host" },
                "port": { "type": "integer", "default": 102 },
                "rack": { "type": "integer", "default": 0 },
                "slot": { "type": "integer", "default": 1 },
                "poll_ms": { "type": "integer", "default": 1000 }
            }
        }),
        tag_schema: serde_json::json!({
            "type": "object",
            "required": ["name", "address", "data_type", "access"],
            "properties": {
                "name": { "type": "string" },
                "address": { "type": "string", "title": "S7 Address" },
                "data_type": {
                    "type": "string",
                    "enum": ["Bool", "Int16", "Uint16", "Int32", "Uint32", "Float32", "Float64", "String"]
                },
                "access": {
                    "type": "string",
                    "enum": ["Read", "Write", "ReadWrite"]
                },
                "scan_ms": { "type": "integer" }
            }
        }),
    },
    DriverCatalogEntry {
        key: "siemens-s7-native".to_string(),
        name: "Siemens S7 (Native)".to_string(),
        vendor: "Fendtastic".to_string(),
        direction: DriverDirection::Southbound,
        config_schema: serde_json::json!({
            "type": "object",
            "required": ["host"],
            "properties": {
                "host": { "type": "string", "title": "PLC IP Address" },
                "port": { "type": "integer", "default": 102 },
                "rack": { "type": "integer", "default": 0 },
                "slot": { "type": "integer", "default": 1 },
                "poll_ms": { "type": "integer", "default": 1000 }
            }
        }),
        tag_schema: serde_json::json!({
            "type": "object",
            "required": ["name", "address", "data_type", "access"],
            "properties": {
                "name": { "type": "string" },
                "address": { "type": "string", "title": "S7 Address (e.g. I0.0, MW0, DB1.DBW0)" },
                "data_type": {
                    "type": "string",
                    "enum": ["Bool", "Int16", "Uint16", "Int32", "Uint32", "Float32", "Float64", "String"]
                },
                "access": {
                    "type": "string",
                    "enum": ["Read", "Write", "ReadWrite"]
                },
                "scan_ms": { "type": "integer" }
            }
        }),
    }]
}
