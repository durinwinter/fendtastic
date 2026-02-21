use actix::prelude::*;
use actix_web::{web, Error, HttpRequest, HttpResponse};
use actix_web_actors::ws;
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info};
use uuid::Uuid;
use zenoh::Session;

use crate::state::AppState;

// ─── Actor Messages ──────────────────────────────────────────────────────────

/// A Zenoh update forwarded to the WebSocket client
#[derive(Message)]
#[rtype(result = "()")]
struct ZenohUpdate {
    key: String,
    payload: String,
}

// ─── WebSocket Connection Actor ──────────────────────────────────────────────

pub struct WsConnection {
    id: Uuid,
    zenoh_session: Arc<Session>,
    /// Active Zenoh subscriber tasks keyed by subscription key expression
    subscription_tasks: HashMap<String, tokio::task::JoinHandle<()>>,
}

impl Actor for WsConnection {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, _ctx: &mut Self::Context) {
        info!("WebSocket {} connected", self.id);
    }

    fn stopped(&mut self, _ctx: &mut Self::Context) {
        info!(
            "WebSocket {} disconnected — cancelling {} subscriptions",
            self.id,
            self.subscription_tasks.len()
        );
        for (_, handle) in self.subscription_tasks.drain() {
            handle.abort();
        }
    }
}

// Handle ZenohUpdate → send JSON to WebSocket client
impl Handler<ZenohUpdate> for WsConnection {
    type Result = ();

    fn handle(&mut self, msg: ZenohUpdate, ctx: &mut Self::Context) {
        let payload_value = serde_json::from_str::<serde_json::Value>(&msg.payload)
            .unwrap_or(serde_json::Value::String(msg.payload));
        let envelope = serde_json::json!({
            "key": msg.key,
            "payload": payload_value
        });
        ctx.text(envelope.to_string());
    }
}

// Handle incoming WebSocket frames
impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for WsConnection {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(data)) => ctx.pong(&data),
            Ok(ws::Message::Pong(_)) => {}
            Ok(ws::Message::Text(text)) => {
                self.handle_client_message(&text, ctx);
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => {}
        }
    }
}

impl WsConnection {
    fn handle_client_message(&mut self, text: &str, ctx: &mut ws::WebsocketContext<Self>) {
        let msg: serde_json::Value = match serde_json::from_str(text) {
            Ok(v) => v,
            Err(e) => {
                error!("WS {}: invalid JSON: {}", self.id, e);
                return;
            }
        };

        match msg["type"].as_str().unwrap_or("") {
            "subscribe" => {
                if let Some(key) = msg["key"].as_str() {
                    self.start_zenoh_subscription(key.to_string(), ctx);
                }
            }
            "unsubscribe" => {
                if let Some(key) = msg["key"].as_str() {
                    self.stop_zenoh_subscription(key);
                }
            }
            "publish" => {
                if let (Some(key), Some(payload)) = (msg["key"].as_str(), msg.get("payload")) {
                    self.publish_to_zenoh(key.to_string(), payload.clone());
                }
            }
            _ => {}
        }
    }

    fn start_zenoh_subscription(&mut self, key: String, ctx: &mut ws::WebsocketContext<Self>) {
        if self.subscription_tasks.contains_key(&key) {
            return;
        }

        let session = self.zenoh_session.clone();
        let addr = ctx.address();
        let key_expr = key.clone();
        let ws_id = self.id;

        let handle = tokio::spawn(async move {
            let subscriber = match session.declare_subscriber(&key_expr).await {
                Ok(sub) => sub,
                Err(e) => {
                    error!("WS {}: subscribe to '{}' failed: {}", ws_id, key_expr, e);
                    return;
                }
            };
            info!("WS {}: subscribed to '{}'", ws_id, key_expr);

            loop {
                match subscriber.recv_async().await {
                    Ok(sample) => {
                        let k = sample.key_expr().as_str().to_string();
                        let p = sample
                            .payload()
                            .try_to_string()
                            .unwrap_or_else(|e| e.to_string().into())
                            .to_string();
                        if addr.try_send(ZenohUpdate { key: k, payload: p }).is_err() {
                            break; // actor gone
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        self.subscription_tasks.insert(key, handle);
    }

    fn stop_zenoh_subscription(&mut self, key: &str) {
        if let Some(handle) = self.subscription_tasks.remove(key) {
            handle.abort();
            info!("WS {}: unsubscribed from '{}'", self.id, key);
        }
    }

    fn publish_to_zenoh(&self, key: String, payload: serde_json::Value) {
        let session = self.zenoh_session.clone();
        let ws_id = self.id;
        tokio::spawn(async move {
            let payload_str = payload.to_string();
            if let Err(e) = session.put(&key, payload_str).await {
                error!("WS {}: publish to '{}' failed: {}", ws_id, key, e);
            }
        });
    }
}

// ─── HTTP Handler ────────────────────────────────────────────────────────────

pub async fn ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    state: web::Data<AppState>,
) -> Result<HttpResponse, Error> {
    let ws_conn = WsConnection {
        id: Uuid::new_v4(),
        zenoh_session: state.zenoh_session.clone(),
        subscription_tasks: HashMap::new(),
    };
    ws::start(ws_conn, &req, stream)
}
