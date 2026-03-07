use anyhow::{anyhow, Context, Result};
use reqwest::Method;
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use shared::domain::driver::{DriverDataType, DriverInstance, DriverTag, TagAccess, TagGroup};
use shared::domain::runtime::{NeuronConnection, RuntimeNodeHealthCheck};

#[derive(Clone, Default)]
pub struct NeuronHttpClient {
    client: reqwest::Client,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NeuronPlugin {
    pub name: String,
    pub schema: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NeuronGroup {
    pub name: String,
    pub interval: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NeuronTagInfo {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NeuronReadTagValue {
    pub name: String,
    pub value: Option<Value>,
    pub error: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct LoginResponse {
    token: String,
}

#[derive(Debug, Deserialize)]
struct NeuronStateEnvelope {
    states: Vec<NeuronNodeState>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NeuronNodeState {
    pub node: String,
    pub running: i64,
    pub link: i64,
    pub rtt: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct PluginEnvelope {
    plugins: Vec<NeuronPlugin>,
}

#[derive(Debug, Deserialize)]
struct GroupEnvelope {
    groups: Vec<NeuronGroup>,
}

#[derive(Debug, Deserialize)]
struct TagEnvelope {
    tags: Vec<NeuronTagInfo>,
}

#[derive(Debug, Deserialize)]
struct ReadEnvelope {
    tags: Vec<NeuronReadTagValue>,
}

impl NeuronHttpClient {
    pub fn new() -> Self {
        Self {
            client: reqwest::Client::new(),
        }
    }

    pub async fn test_connection(&self, conn: &NeuronConnection) -> Result<Vec<RuntimeNodeHealthCheck>> {
        let token = self.login(conn).await?;
        let system: Value = self.request_json(Method::GET, conn, "/api/system", Some(&token), None::<&Value>).await?;
        let plugins = self.list_plugins(conn).await?;

        Ok(vec![
            RuntimeNodeHealthCheck {
                name: "auth".to_string(),
                ok: true,
                message: "JWT login succeeded".to_string(),
            },
            RuntimeNodeHealthCheck {
                name: "system".to_string(),
                ok: system.get("version").is_some(),
                message: format!(
                    "Neuron system endpoint reachable{}",
                    system
                        .get("version")
                        .and_then(|v| v.as_str())
                        .map(|v| format!(" (version {})", v))
                        .unwrap_or_default()
                ),
            },
            RuntimeNodeHealthCheck {
                name: "plugins".to_string(),
                ok: !plugins.is_empty(),
                message: format!("Neuron returned {} plugins", plugins.len()),
            },
        ])
    }

    pub async fn list_plugins(&self, conn: &NeuronConnection) -> Result<Vec<NeuronPlugin>> {
        let token = self.login(conn).await?;
        let plugins: PluginEnvelope = self
            .request_json(Method::GET, conn, "/api/neuron/plugin", Some(&token), None::<&Value>)
            .await?;
        Ok(plugins.plugins)
    }

    pub async fn get_plugin_schema(&self, conn: &NeuronConnection, schema_name: &str) -> Result<Value> {
        let token = self.login(conn).await?;
        let url = format!("/api/neuron/schema?schema_name={}", encode_query_component(schema_name));
        self.request_json(Method::GET, conn, &url, Some(&token), None::<&Value>)
            .await
    }

    pub async fn sync_driver(&self, conn: &NeuronConnection, driver: &DriverInstance) -> Result<()> {
        let plugin = self.resolve_plugin(conn, &driver.driver_key).await?;
        let node_name = neuron_node_name(driver);
        let token = self.login(conn).await?;

        let create_payload = json!({
            "name": node_name,
            "plugin": plugin.name,
        });
        let create_result = self
            .request_value(Method::POST, conn, "/api/neuron/node", Some(&token), Some(&create_payload))
            .await;
        if let Err(err) = create_result {
            if !is_conflict_error(&err) {
                return Err(err).context("failed to create neuron node");
            }
        }

        let setting_payload = json!({
            "node": node_name,
            "params": driver.config.clone(),
        });
        self.request_value(
            Method::POST,
            conn,
            "/api/neuron/node/setting",
            Some(&token),
            Some(&setting_payload),
        )
        .await
        .context("failed to apply neuron node settings")?;

        for group in &driver.tag_groups {
            self.ensure_group(conn, &token, &node_name, group).await?;
            self.sync_tags(conn, &token, &node_name, group).await?;
        }

        Ok(())
    }

    pub async fn start_driver(&self, conn: &NeuronConnection, driver: &DriverInstance) -> Result<()> {
        self.sync_driver(conn, driver).await?;
        self.node_ctl(conn, &neuron_node_name(driver), 0).await
    }

    pub async fn stop_driver(&self, conn: &NeuronConnection, driver: &DriverInstance) -> Result<()> {
        self.node_ctl(conn, &neuron_node_name(driver), 1).await
    }

    pub async fn get_node_state(&self, conn: &NeuronConnection, driver: &DriverInstance) -> Result<Option<NeuronNodeState>> {
        let token = self.login(conn).await?;
        let url = format!("/api/neuron/node/state?node={}", encode_query_component(&neuron_node_name(driver)));
        let states: NeuronStateEnvelope = self.request_json(Method::GET, conn, &url, Some(&token), None::<&Value>).await?;
        Ok(states.states.into_iter().find(|state| state.node == neuron_node_name(driver)))
    }

    pub async fn read_tag(&self, conn: &NeuronConnection, driver: &DriverInstance, group: &str, tag_name: &str) -> Result<NeuronReadTagValue> {
        let token = self.login(conn).await?;
        let payload = json!({
            "node": neuron_node_name(driver),
            "group": group,
            "sync": true,
            "query": { "name": tag_name },
        });
        let response: ReadEnvelope = self.request_json(Method::POST, conn, "/api/neuron/read", Some(&token), Some(&payload)).await?;
        response
            .tags
            .into_iter()
            .find(|tag| tag.name == tag_name)
            .ok_or_else(|| anyhow!("Neuron did not return requested tag {}", tag_name))
    }

    pub async fn write_tag(&self, conn: &NeuronConnection, driver: &DriverInstance, group: &str, tag_name: &str, value: Value) -> Result<()> {
        let token = self.login(conn).await?;
        let payload = json!({
            "node": neuron_node_name(driver),
            "group": group,
            "tag": tag_name,
            "value": value,
        });
        self.request_value(Method::POST, conn, "/api/neuron/write", Some(&token), Some(&payload)).await?;
        Ok(())
    }

    async fn resolve_plugin(&self, conn: &NeuronConnection, driver_key: &str) -> Result<NeuronPlugin> {
        let plugins = self.list_plugins(conn).await?;
        let normalized_key = driver_key.to_ascii_lowercase();

        let selected = if normalized_key == "siemens-s7" {
            plugins.iter().find(|plugin| {
                let name = plugin.name.to_ascii_lowercase();
                name.contains("siemens") && name.contains("s7")
            })
        } else {
            plugins
                .iter()
                .find(|plugin| plugin.name.to_ascii_lowercase().contains(&normalized_key))
        };

        selected
            .cloned()
            .ok_or_else(|| anyhow!("No matching Neuron plugin found for driver key {}", driver_key))
    }

    async fn ensure_group(&self, conn: &NeuronConnection, token: &str, node_name: &str, group: &TagGroup) -> Result<()> {
        let groups = self.list_groups_with_token(conn, token, node_name).await?;
        let payload = json!({
            "node": node_name,
            "group": group.name,
            "interval": group_interval(group),
        });

        if groups.iter().any(|existing| existing.name == group.name) {
            self.request_value(Method::PUT, conn, "/api/neuron/group", Some(token), Some(&payload)).await?;
        } else {
            self.request_value(Method::POST, conn, "/api/neuron/group", Some(token), Some(&payload)).await?;
        }
        Ok(())
    }

    async fn sync_tags(&self, conn: &NeuronConnection, token: &str, node_name: &str, group: &TagGroup) -> Result<()> {
        let existing_tags = self.list_tags_with_token(conn, token, node_name, &group.name).await.unwrap_or_default();
        let mut create_tags = Vec::new();
        let mut update_tags = Vec::new();

        for tag in &group.tags {
            let payload = neuron_tag_payload(tag);
            if existing_tags.iter().any(|existing| existing.name == tag.name) {
                update_tags.push(payload);
            } else {
                create_tags.push(payload);
            }
        }

        if !create_tags.is_empty() {
            let payload = json!({
                "node": node_name,
                "group": group.name,
                "tags": create_tags,
            });
            self.request_value(Method::POST, conn, "/api/neuron/tags", Some(token), Some(&payload)).await?;
        }

        if !update_tags.is_empty() {
            let payload = json!({
                "node": node_name,
                "group": group.name,
                "tags": update_tags,
            });
            self.request_value(Method::PUT, conn, "/api/neuron/tags", Some(token), Some(&payload)).await?;
        }

        Ok(())
    }

    async fn node_ctl(&self, conn: &NeuronConnection, node_name: &str, cmd: i32) -> Result<()> {
        let token = self.login(conn).await?;
        let payload = json!({
            "node": node_name,
            "cmd": cmd,
        });
        self.request_value(Method::POST, conn, "/api/neuron/node/ctl", Some(&token), Some(&payload)).await?;
        Ok(())
    }

    async fn list_groups_with_token(&self, conn: &NeuronConnection, token: &str, node_name: &str) -> Result<Vec<NeuronGroup>> {
        let url = format!("/api/neuron/group?node={}", encode_query_component(node_name));
        let groups: GroupEnvelope = self.request_json(Method::GET, conn, &url, Some(token), None::<&Value>).await?;
        Ok(groups.groups)
    }

    async fn list_tags_with_token(&self, conn: &NeuronConnection, token: &str, node_name: &str, group_name: &str) -> Result<Vec<NeuronTagInfo>> {
        let url = format!(
            "/api/neuron/tags?node={}&group={}",
            encode_query_component(node_name),
            encode_query_component(group_name)
        );
        let tags: TagEnvelope = self.request_json(Method::GET, conn, &url, Some(token), None::<&Value>).await?;
        Ok(tags.tags)
    }

    async fn login(&self, conn: &NeuronConnection) -> Result<String> {
        let username = conn.username.as_deref().unwrap_or("admin");
        let password = resolve_password(conn)
            .ok_or_else(|| anyhow!("Neuron password is not configured or could not be resolved"))?;
        let payload = json!({
            "name": username,
            "password": password,
        });
        let response: LoginResponse = self.request_json(Method::POST, conn, "/api/login", None, Some(&payload)).await?;
        Ok(response.token)
    }

    async fn request_json<T, B>(&self, method: Method, conn: &NeuronConnection, path: &str, token: Option<&str>, body: Option<&B>) -> Result<T>
    where
        T: DeserializeOwned,
        B: Serialize + ?Sized,
    {
        let value = self.request_value(method, conn, path, token, body).await?;
        serde_json::from_value(value).context("failed to decode Neuron response")
    }

    async fn request_value<B>(&self, method: Method, conn: &NeuronConnection, path: &str, token: Option<&str>, body: Option<&B>) -> Result<Value>
    where
        B: Serialize + ?Sized,
    {
        let mut request = self.client.request(method, format!("{}{}", conn.base_url.trim_end_matches('/'), path));
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        if let Some(body) = body {
            request = request.json(body);
        }
        let response = request.send().await.context("failed to call Neuron API")?;
        let status = response.status();
        let text = response.text().await.context("failed to read Neuron response body")?;
        if !status.is_success() {
            return Err(anyhow!("Neuron API {} {} failed with {}: {}", status.as_u16(), status.canonical_reason().unwrap_or("unknown"), path, text));
        }
        if text.trim().is_empty() {
            return Ok(json!({}));
        }
        serde_json::from_str(&text).or_else(|_| Ok(json!({"raw": text})))
    }
}

fn resolve_password(conn: &NeuronConnection) -> Option<String> {
    match conn.password_ref.as_deref() {
        Some(value) if value.starts_with("env:") => std::env::var(value.trim_start_matches("env:")).ok(),
        Some(value) if value.starts_with("secret://") => None,
        Some(value) => Some(value.to_string()),
        None => Some("0000".to_string()),
    }
}

fn group_interval(group: &TagGroup) -> u64 {
    group.tags.iter().filter_map(|tag| tag.scan_ms.map(u64::from)).min().unwrap_or(1000)
}

fn neuron_tag_payload(tag: &DriverTag) -> Value {
    json!({
        "name": tag.name,
        "address": tag.address,
        "attribute": map_tag_access(tag.access.clone()),
        "type": map_data_type(tag.data_type.clone()),
        "precision": tag.attributes.get("precision").and_then(|v| v.as_i64()).unwrap_or(0),
        "decimal": tag.attributes.get("decimal").cloned().unwrap_or_else(|| json!(0)),
        "description": tag.attributes.get("description").and_then(|v| v.as_str()).unwrap_or(""),
        "value": tag.attributes.get("value").cloned().unwrap_or(Value::Null),
    })
}

fn map_data_type(data_type: DriverDataType) -> i32 {
    match data_type {
        DriverDataType::Bool => 12,
        DriverDataType::Int16 => 3,
        DriverDataType::Uint16 => 4,
        DriverDataType::Int32 => 5,
        DriverDataType::Uint32 => 6,
        DriverDataType::Float32 => 9,
        DriverDataType::Float64 => 10,
        DriverDataType::String => 13,
    }
}

fn map_tag_access(access: TagAccess) -> i32 {
    match access {
        TagAccess::Read => 0x01,
        TagAccess::Write => 0x02,
        TagAccess::ReadWrite => 0x03,
    }
}

pub fn neuron_node_name(driver: &DriverInstance) -> String {
    sanitize_name(&format!("{}-{}", driver.driver_key, &driver.id[..8.min(driver.id.len())]))
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
        .collect()
}

fn is_conflict_error(err: &anyhow::Error) -> bool {
    err.to_string().contains("409") || err.to_string().to_ascii_lowercase().contains("exist")
}

fn encode_query_component(input: &str) -> String {
    let mut encoded = String::with_capacity(input.len());
    for byte in input.bytes() {
        let is_unreserved =
            byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~');
        if is_unreserved {
            encoded.push(byte as char);
        } else {
            encoded.push_str(&format!("%{:02X}", byte));
        }
    }
    encoded
}
