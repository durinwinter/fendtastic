use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;

use crate::state::AppState;

#[derive(Deserialize)]
pub struct TsQuery {
    /// Zenoh key expression (exact key, e.g. "fendtastic/sensor/temperature")
    pub key: String,
    /// Start of range as Unix milliseconds
    pub start_ms: i64,
    /// End of range as Unix milliseconds
    pub end_ms: i64,
}

/// GET /ts/keys — list all key expressions with stored time-series data.
pub async fn get_ts_keys(state: web::Data<AppState>) -> impl Responder {
    let store = state.timeseries.read().await;
    let keys: Vec<&String> = store.keys();
    HttpResponse::Ok().json(serde_json::json!({ "keys": keys }))
}

/// GET /ts/latest — return the most recent value for every stored key.
pub async fn get_ts_latest(state: web::Data<AppState>) -> impl Responder {
    let store = state.timeseries.read().await;
    let mut entries = serde_json::Map::new();
    for (key, buf) in &store.data {
        if let Some(last) = buf.back() {
            entries.insert(
                key.clone(),
                serde_json::json!({
                    "t": last.timestamp_ms,
                    "v": last.value,
                }),
            );
        }
    }
    HttpResponse::Ok().json(serde_json::Value::Object(entries))
}

/// GET /ts/query?key=...&start_ms=...&end_ms=... — query historical data for a key.
pub async fn query_timeseries(
    state: web::Data<AppState>,
    query: web::Query<TsQuery>,
) -> impl Responder {
    let store = state.timeseries.read().await;
    let points = store.query(&query.key, query.start_ms, query.end_ms);

    let result: Vec<serde_json::Value> = points
        .into_iter()
        .map(|p| {
            serde_json::json!({
                "t": p.timestamp_ms,
                "v": p.value,
            })
        })
        .collect();

    HttpResponse::Ok().json(serde_json::json!({
        "key": query.key,
        "start_ms": query.start_ms,
        "end_ms": query.end_ms,
        "count": result.len(),
        "points": result,
    }))
}
