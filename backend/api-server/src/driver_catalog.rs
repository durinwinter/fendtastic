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
                "data_type": { "type": "string" },
                "access": { "type": "string" },
                "scan_ms": { "type": "integer" }
            }
        }),
    }]
}
