use actix_web::{web, HttpResponse, Responder};
use serde::Deserialize;

use crate::runtime_store;
use crate::state::{AppState, TimeSeriesPoint};

#[derive(Deserialize)]
pub struct TsQuery {
    /// Zenoh key expression (exact key, e.g. "murph/runtime/nodes/node-1/pea/pea-1/bindings/active.pump.pv/value")
    pub key: String,
    /// Start of range as Unix milliseconds
    pub start_ms: i64,
    /// End of range as Unix milliseconds
    pub end_ms: i64,
    /// Optional max points to return after downsampling.
    pub max_points: Option<usize>,
}

#[derive(Deserialize)]
pub struct TsConfigUpdateRequest {
    pub max_points_per_key: usize,
}

#[derive(Clone, serde::Serialize, serde::Deserialize)]
pub struct TimeSeriesConfigRecord {
    pub max_points_per_key: usize,
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

pub async fn get_ts_config(state: web::Data<AppState>) -> impl Responder {
    let store = state.timeseries.read().await;
    HttpResponse::Ok().json(serde_json::json!({
        "max_points_per_key": store.max_points_per_key,
        "key_count": store.data.len(),
    }))
}

pub async fn update_ts_config(
    state: web::Data<AppState>,
    body: web::Json<TsConfigUpdateRequest>,
) -> impl Responder {
    if body.max_points_per_key < 32 {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": "max_points_per_key must be at least 32"
        }));
    }

    let mut store = state.timeseries.write().await;
    store.set_max_points_per_key(body.max_points_per_key);
    runtime_store::persist_json_file(
        &state.timeseries_config_path,
        &TimeSeriesConfigRecord {
            max_points_per_key: store.max_points_per_key,
        },
    );
    HttpResponse::Ok().json(serde_json::json!({
        "max_points_per_key": store.max_points_per_key,
        "key_count": store.data.len(),
    }))
}

/// GET /ts/query?key=...&start_ms=...&end_ms=...&max_points=... — query historical data for a key.
pub async fn query_timeseries(
    state: web::Data<AppState>,
    query: web::Query<TsQuery>,
) -> impl Responder {
    let store = state.timeseries.read().await;
    let points = store.query(&query.key, query.start_ms, query.end_ms);
    let original_count = points.len();
    let max_points = query.max_points.filter(|value| *value > 0);
    let result = downsample_points(points, max_points);

    HttpResponse::Ok().json(serde_json::json!({
        "key": query.key,
        "start_ms": query.start_ms,
        "end_ms": query.end_ms,
        "count": result.len(),
        "original_count": original_count,
        "sampled": max_points.is_some_and(|limit| original_count > limit),
        "max_points": max_points,
        "points": result,
    }))
}

fn downsample_points(
    points: Vec<&TimeSeriesPoint>,
    max_points: Option<usize>,
) -> Vec<serde_json::Value> {
    let Some(limit) = max_points else {
        return points
            .into_iter()
            .map(point_to_json)
            .collect();
    };

    if points.len() <= limit {
        return points
            .into_iter()
            .map(point_to_json)
            .collect();
    }

    let bucket_size = ((points.len() as f64) / (limit as f64)).ceil() as usize;
    let mut sampled = Vec::with_capacity(limit);

    for bucket in points.chunks(bucket_size) {
        if bucket.is_empty() {
            continue;
        }

        let numeric_values: Vec<f64> = bucket
            .iter()
            .filter_map(|point| extract_numeric_value(&point.value))
            .collect();

        if numeric_values.len() == bucket.len() {
            let average = numeric_values.iter().sum::<f64>() / numeric_values.len() as f64;
            sampled.push(serde_json::json!({
                "t": bucket.last().map(|point| point.timestamp_ms).unwrap_or_default(),
                "v": average,
                "min": numeric_values.iter().fold(f64::INFINITY, |acc, value| acc.min(*value)),
                "max": numeric_values.iter().fold(f64::NEG_INFINITY, |acc, value| acc.max(*value)),
            }));
        } else if let Some(last) = bucket.last() {
            sampled.push(point_to_json(last));
        }
    }

    sampled
}

fn point_to_json(point: &TimeSeriesPoint) -> serde_json::Value {
    serde_json::json!({
        "t": point.timestamp_ms,
        "v": point.value,
    })
}

fn extract_numeric_value(value: &serde_json::Value) -> Option<f64> {
    value
        .get("result")
        .and_then(|result| result.get("value"))
        .and_then(|inner| inner.as_f64())
        .or_else(|| value.get("v").and_then(|inner| inner.as_f64()))
        .or_else(|| value.as_f64())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::TimeSeriesStore;

    fn point(timestamp_ms: i64, value: serde_json::Value) -> TimeSeriesPoint {
        TimeSeriesPoint { timestamp_ms, value }
    }

    #[test]
    fn downsample_points_keeps_latest_when_values_are_non_numeric() {
        let points = vec![
            point(1, serde_json::json!({"result": {"value": "open"}})),
            point(2, serde_json::json!({"result": {"value": "closed"}})),
            point(3, serde_json::json!({"result": {"value": "open"}})),
        ];
        let refs = points.iter().collect::<Vec<_>>();
        let sampled = downsample_points(refs, Some(2));

        assert_eq!(sampled.len(), 2);
        assert_eq!(sampled[0]["t"], 2);
        assert_eq!(sampled[1]["t"], 3);
    }

    #[test]
    fn downsample_points_averages_numeric_buckets() {
        let points = vec![
            point(1, serde_json::json!({"result": {"value": 10.0}})),
            point(2, serde_json::json!({"result": {"value": 20.0}})),
            point(3, serde_json::json!({"result": {"value": 30.0}})),
            point(4, serde_json::json!({"result": {"value": 40.0}})),
        ];
        let refs = points.iter().collect::<Vec<_>>();
        let sampled = downsample_points(refs, Some(2));

        assert_eq!(sampled.len(), 2);
        assert_eq!(sampled[0]["v"], serde_json::json!(15.0));
        assert_eq!(sampled[0]["min"], serde_json::json!(10.0));
        assert_eq!(sampled[0]["max"], serde_json::json!(20.0));
        assert_eq!(sampled[1]["v"], serde_json::json!(35.0));
    }

    #[test]
    fn set_max_points_prunes_existing_buffers() {
        let mut store = TimeSeriesStore::new(10);
        for index in 0..8 {
            store.insert("key".to_string(), serde_json::json!(index), index);
        }

        store.set_max_points_per_key(4);

        assert_eq!(store.max_points_per_key, 4);
        assert_eq!(store.data.get("key").map(|buf| buf.len()), Some(4));
        assert_eq!(store.data.get("key").and_then(|buf| buf.front()).map(|point| point.timestamp_ms), Some(4));
    }
}
