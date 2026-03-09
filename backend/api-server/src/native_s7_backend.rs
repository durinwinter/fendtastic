use anyhow::{anyhow, Result};
use async_trait::async_trait;
use rust7::{S7Client, S7_AREA_DB, S7_AREA_MK, S7_AREA_PA, S7_AREA_PE, S7_WL_BYTE};
use serde_json::{json, Value};
use shared::domain::driver::{DriverDataType, DriverInstance};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{mpsc, oneshot, RwLock};
use tracing::{error, info, warn};

use crate::driver_backend::*;

// ---------------------------------------------------------------------------
// S7 address parsing
// ---------------------------------------------------------------------------

/// Parsed S7 address ready for rust7 calls.
#[derive(Debug, Clone)]
pub struct S7Address {
    pub area: u8,
    pub db_num: u16,
    pub byte_offset: u16,
    pub bit: Option<u8>,
    pub byte_width: usize, // 0 for bit access, >0 for byte-level reads
}

/// Parse S7 address strings into area/db/offset/bit tuples.
///
/// Supported formats:
///   I0.0       → Input byte 0, bit 0
///   Q0.5       → Output byte 0, bit 5
///   M0.3       → Marker byte 0, bit 3
///   MW0        → Marker word (2 bytes) at byte 0
///   MD0        → Marker double word (4 bytes) at byte 0
///   MB0        → Marker byte at byte 0
///   IW0, IB0   → Input word / byte
///   QW0, QB0   → Output word / byte
///   DB1.DBX0.1 → Data block 1, byte 0, bit 1
///   DB1.DBW0   → Data block 1, word at byte 0
///   DB1.DBD0   → Data block 1, dword at byte 0
///   DB1.DBB0   → Data block 1, byte at byte 0
pub fn parse_s7_address(address: &str) -> Result<S7Address> {
    let addr = address.trim();

    // DB addresses: DB<n>.DBX<byte>.<bit> or DB<n>.DBW<byte> or DB<n>.DBD<byte> or DB<n>.DBB<byte>
    if addr.starts_with("DB") || addr.starts_with("db") {
        return parse_db_address(addr);
    }

    // I/Q/M addresses
    let first = addr.chars().next().ok_or_else(|| anyhow!("Empty address"))?;
    let area = match first.to_ascii_uppercase() {
        'I' => S7_AREA_PE,
        'Q' => S7_AREA_PA,
        'M' => S7_AREA_MK,
        _ => return Err(anyhow!("Unknown area prefix '{}' in address '{}'", first, addr)),
    };

    let rest = &addr[1..];

    // Check for word/dword/byte suffix: MW0, MD0, MB0, IW0, QW0, etc.
    if let Some(first_char) = rest.chars().next() {
        match first_char.to_ascii_uppercase() {
            'W' => {
                let offset: u16 = rest[1..].parse().map_err(|_| anyhow!("Invalid word offset in '{}'", addr))?;
                return Ok(S7Address { area, db_num: 0, byte_offset: offset, bit: None, byte_width: 2 });
            }
            'D' => {
                let offset: u16 = rest[1..].parse().map_err(|_| anyhow!("Invalid dword offset in '{}'", addr))?;
                return Ok(S7Address { area, db_num: 0, byte_offset: offset, bit: None, byte_width: 4 });
            }
            'B' => {
                let offset: u16 = rest[1..].parse().map_err(|_| anyhow!("Invalid byte offset in '{}'", addr))?;
                return Ok(S7Address { area, db_num: 0, byte_offset: offset, bit: None, byte_width: 1 });
            }
            _ => {}
        }
    }

    // Bit address: I0.0, Q0.5, M0.3
    if let Some(dot_pos) = rest.find('.') {
        let byte_offset: u16 = rest[..dot_pos].parse().map_err(|_| anyhow!("Invalid byte in '{}'", addr))?;
        let bit: u8 = rest[dot_pos + 1..].parse().map_err(|_| anyhow!("Invalid bit in '{}'", addr))?;
        if bit > 7 {
            return Err(anyhow!("Bit index {} out of range (0-7) in '{}'", bit, addr));
        }
        return Ok(S7Address { area, db_num: 0, byte_offset, bit: Some(bit), byte_width: 0 });
    }

    Err(anyhow!("Cannot parse S7 address '{}' — expected format like I0.0, MW0, DB1.DBW0", addr))
}

fn parse_db_address(addr: &str) -> Result<S7Address> {
    // Find the dot separator between DB number and sub-address
    let upper = addr.to_ascii_uppercase();
    let dot_pos = upper.find('.').ok_or_else(|| anyhow!("DB address '{}' missing '.' separator", addr))?;
    let db_part = &upper[2..dot_pos]; // "1" from "DB1"
    let sub = &upper[dot_pos + 1..]; // "DBX0.1" or "DBW0" etc.
    let db_num: u16 = db_part.parse().map_err(|_| anyhow!("Invalid DB number in '{}'", addr))?;

    if sub.starts_with("DBX") {
        // Bit access: DBX<byte>.<bit>
        let rest = &sub[3..];
        let inner_dot = rest.find('.').ok_or_else(|| anyhow!("DBX address missing bit index in '{}'", addr))?;
        let byte_offset: u16 = rest[..inner_dot].parse().map_err(|_| anyhow!("Invalid byte in '{}'", addr))?;
        let bit: u8 = rest[inner_dot + 1..].parse().map_err(|_| anyhow!("Invalid bit in '{}'", addr))?;
        Ok(S7Address { area: S7_AREA_DB, db_num, byte_offset, bit: Some(bit), byte_width: 0 })
    } else if sub.starts_with("DBW") {
        let offset: u16 = sub[3..].parse().map_err(|_| anyhow!("Invalid word offset in '{}'", addr))?;
        Ok(S7Address { area: S7_AREA_DB, db_num, byte_offset: offset, bit: None, byte_width: 2 })
    } else if sub.starts_with("DBD") {
        let offset: u16 = sub[3..].parse().map_err(|_| anyhow!("Invalid dword offset in '{}'", addr))?;
        Ok(S7Address { area: S7_AREA_DB, db_num, byte_offset: offset, bit: None, byte_width: 4 })
    } else if sub.starts_with("DBB") {
        let offset: u16 = sub[3..].parse().map_err(|_| anyhow!("Invalid byte offset in '{}'", addr))?;
        Ok(S7Address { area: S7_AREA_DB, db_num, byte_offset: offset, bit: None, byte_width: 1 })
    } else {
        Err(anyhow!("Unknown DB sub-address '{}' in '{}'", sub, addr))
    }
}

// ---------------------------------------------------------------------------
// Worker thread command protocol
// ---------------------------------------------------------------------------

enum S7Command {
    Connect {
        host: String,
        port: u16,
        rack: u16,
        slot: u16,
        reply: oneshot::Sender<Result<f64>>,
    },
    Disconnect {
        reply: oneshot::Sender<()>,
    },
    ReadBit {
        area: u8,
        db_num: u16,
        byte_offset: u16,
        bit: u8,
        reply: oneshot::Sender<Result<bool>>,
    },
    ReadBytes {
        area: u8,
        db_num: u16,
        start: u16,
        size: usize,
        reply: oneshot::Sender<Result<Vec<u8>>>,
    },
    WriteBit {
        area: u8,
        db_num: u16,
        byte_offset: u16,
        bit: u8,
        value: bool,
        reply: oneshot::Sender<Result<()>>,
    },
    WriteBytes {
        area: u8,
        db_num: u16,
        start: u16,
        data: Vec<u8>,
        reply: oneshot::Sender<Result<()>>,
    },
    Status {
        reply: oneshot::Sender<(bool, f64)>,
    },
    Shutdown,
}

/// Background worker loop running on a dedicated OS thread.
/// Owns the S7Client (which is !Send due to TcpStream internals).
fn s7_worker_loop(driver_id: String, mut rx: mpsc::Receiver<S7Command>) {
    let mut client = S7Client::new();
    let mut last_rtt: f64 = 0.0;

    info!("[native-s7 {}] Worker thread started", &driver_id[..8.min(driver_id.len())]);

    while let Some(cmd) = rx.blocking_recv() {
        match cmd {
            S7Command::Connect { host, port, rack, slot, reply } => {
                if client.connected {
                    client.disconnect();
                }
                if port != 102 {
                    let _ = client.set_connection_port(port);
                }
                let result = client.connect_rack_slot(&host, rack, slot);
                let rtt = client.last_time;
                last_rtt = rtt;
                let _ = reply.send(result.map(|_| rtt).map_err(|e| anyhow!("{}", e)));
            }
            S7Command::Disconnect { reply } => {
                client.disconnect();
                let _ = reply.send(());
            }
            S7Command::ReadBit { area, db_num, byte_offset, bit, reply } => {
                let result = client.read_bit(area, db_num, byte_offset, bit);
                last_rtt = client.last_time;
                let _ = reply.send(result.map_err(|e| anyhow!("{}", e)));
            }
            S7Command::ReadBytes { area, db_num, start, size, reply } => {
                let mut buf = vec![0u8; size];
                let result = client.read_area(area, db_num, start, S7_WL_BYTE, &mut buf);
                last_rtt = client.last_time;
                let _ = reply.send(result.map(|_| buf).map_err(|e| anyhow!("{}", e)));
            }
            S7Command::WriteBit { area, db_num, byte_offset, bit, value, reply } => {
                let result = client.write_bit(area, db_num, byte_offset, bit, value);
                last_rtt = client.last_time;
                let _ = reply.send(result.map_err(|e| anyhow!("{}", e)));
            }
            S7Command::WriteBytes { area, db_num, start, data, reply } => {
                let result = client.write_area(area, db_num, start, S7_WL_BYTE, &data);
                last_rtt = client.last_time;
                let _ = reply.send(result.map_err(|e| anyhow!("{}", e)));
            }
            S7Command::Status { reply } => {
                let _ = reply.send((client.connected, last_rtt));
            }
            S7Command::Shutdown => {
                client.disconnect();
                info!("[native-s7 {}] Worker thread shutting down", &driver_id[..8.min(driver_id.len())]);
                break;
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Connection registry
// ---------------------------------------------------------------------------

/// Registry of active native S7 worker threads, keyed by driver ID.
pub struct NativeS7Registry {
    workers: RwLock<HashMap<String, mpsc::Sender<S7Command>>>,
}

impl NativeS7Registry {
    pub fn new() -> Self {
        Self {
            workers: RwLock::new(HashMap::new()),
        }
    }

    async fn get_worker(&self, driver_id: &str) -> Option<mpsc::Sender<S7Command>> {
        self.workers.read().await.get(driver_id).cloned()
    }

    async fn ensure_worker(&self, driver_id: &str) -> mpsc::Sender<S7Command> {
        if let Some(tx) = self.get_worker(driver_id).await {
            return tx;
        }

        let (tx, rx) = mpsc::channel::<S7Command>(64);
        let id = driver_id.to_string();
        std::thread::Builder::new()
            .name(format!("s7-{}", &driver_id[..8.min(driver_id.len())]))
            .spawn(move || s7_worker_loop(id, rx))
            .expect("Failed to spawn S7 worker thread");

        self.workers.write().await.insert(driver_id.to_string(), tx.clone());
        tx
    }

    async fn remove_worker(&self, driver_id: &str) {
        if let Some(tx) = self.workers.write().await.remove(driver_id) {
            let _ = tx.send(S7Command::Shutdown).await;
        }
    }
}

// ---------------------------------------------------------------------------
// DriverBackend implementation
// ---------------------------------------------------------------------------

pub struct NativeS7Backend {
    registry: Arc<NativeS7Registry>,
}

impl NativeS7Backend {
    pub fn new(registry: Arc<NativeS7Registry>) -> Self {
        Self { registry }
    }

    fn extract_config(driver: &DriverInstance) -> Result<(String, u16, u16, u16)> {
        let host = driver
            .config
            .get("host")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("Missing 'host' in driver config"))?
            .to_string();
        let port = driver.config.get("port").and_then(|v| v.as_u64()).unwrap_or(102) as u16;
        let rack = driver.config.get("rack").and_then(|v| v.as_u64()).unwrap_or(0) as u16;
        let slot = driver.config.get("slot").and_then(|v| v.as_u64()).unwrap_or(1) as u16;
        Ok((host, port, rack, slot))
    }
}

#[async_trait]
impl DriverBackend for NativeS7Backend {
    async fn sync_driver(&self, _driver: &DriverInstance) -> Result<()> {
        // Native backend has no external state to sync — tags and config are local.
        Ok(())
    }

    async fn start_driver(&self, driver: &DriverInstance) -> Result<()> {
        let (host, port, rack, slot) = Self::extract_config(driver)?;
        let tx = self.registry.ensure_worker(&driver.id).await;
        let (reply_tx, reply_rx) = oneshot::channel();
        tx.send(S7Command::Connect { host, port, rack, slot, reply: reply_tx })
            .await
            .map_err(|_| anyhow!("S7 worker channel closed"))?;
        let rtt = reply_rx.await.map_err(|_| anyhow!("S7 worker dropped reply"))??;
        info!(
            "[native-s7 {}] Connected in {:.1}ms",
            &driver.id[..8.min(driver.id.len())],
            rtt
        );
        Ok(())
    }

    async fn stop_driver(&self, driver: &DriverInstance) -> Result<()> {
        if let Some(tx) = self.registry.get_worker(&driver.id).await {
            let (reply_tx, reply_rx) = oneshot::channel();
            let _ = tx.send(S7Command::Disconnect { reply: reply_tx }).await;
            let _ = reply_rx.await;
        }
        Ok(())
    }

    async fn get_driver_state(&self, driver: &DriverInstance) -> Result<Option<BackendDriverState>> {
        if let Some(tx) = self.registry.get_worker(&driver.id).await {
            let (reply_tx, reply_rx) = oneshot::channel();
            tx.send(S7Command::Status { reply: reply_tx })
                .await
                .map_err(|_| anyhow!("S7 worker channel closed"))?;
            let (connected, rtt) = reply_rx.await.map_err(|_| anyhow!("S7 worker dropped reply"))?;
            Ok(Some(BackendDriverState {
                running: connected,
                link: Some(if connected { 1 } else { 0 }),
                rtt: if rtt > 0.0 { Some(rtt as i64) } else { None },
            }))
        } else {
            Ok(Some(BackendDriverState {
                running: false,
                link: Some(0),
                rtt: None,
            }))
        }
    }

    async fn read_tag(&self, driver: &DriverInstance, _group: &str, tag_name: &str) -> Result<TagReadResult> {
        let tag = find_tag_by_name(driver, tag_name)?;
        let addr = parse_s7_address(&tag.address)?;
        let tx = self
            .registry
            .get_worker(&driver.id)
            .await
            .ok_or_else(|| anyhow!("Native S7 driver not started"))?;

        let value = if addr.bit.is_some() {
            // Bit read
            let (reply_tx, reply_rx) = oneshot::channel();
            tx.send(S7Command::ReadBit {
                area: addr.area,
                db_num: addr.db_num,
                byte_offset: addr.byte_offset,
                bit: addr.bit.unwrap(),
                reply: reply_tx,
            })
            .await
            .map_err(|_| anyhow!("S7 worker channel closed"))?;
            let bit_val = reply_rx.await.map_err(|_| anyhow!("S7 worker dropped reply"))??;
            Value::from(bit_val as i64)
        } else {
            // Byte-level read
            let (reply_tx, reply_rx) = oneshot::channel();
            tx.send(S7Command::ReadBytes {
                area: addr.area,
                db_num: addr.db_num,
                start: addr.byte_offset,
                size: addr.byte_width,
                reply: reply_tx,
            })
            .await
            .map_err(|_| anyhow!("S7 worker channel closed"))?;
            let buf = reply_rx.await.map_err(|_| anyhow!("S7 worker dropped reply"))??;
            decode_bytes(&buf, &tag.data_type)
        };

        Ok(TagReadResult {
            name: tag_name.to_string(),
            value: Some(value),
            error: Some(0),
        })
    }

    async fn write_tag(&self, driver: &DriverInstance, _group: &str, tag_name: &str, value: Value) -> Result<()> {
        let tag = find_tag_by_name(driver, tag_name)?;
        let addr = parse_s7_address(&tag.address)?;
        let tx = self
            .registry
            .get_worker(&driver.id)
            .await
            .ok_or_else(|| anyhow!("Native S7 driver not started"))?;

        if addr.bit.is_some() {
            let bool_val = match &value {
                Value::Bool(b) => *b,
                Value::Number(n) => n.as_i64().unwrap_or(0) != 0,
                _ => return Err(anyhow!("Cannot convert {:?} to bool for bit write", value)),
            };
            let (reply_tx, reply_rx) = oneshot::channel();
            tx.send(S7Command::WriteBit {
                area: addr.area,
                db_num: addr.db_num,
                byte_offset: addr.byte_offset,
                bit: addr.bit.unwrap(),
                value: bool_val,
                reply: reply_tx,
            })
            .await
            .map_err(|_| anyhow!("S7 worker channel closed"))?;
            reply_rx.await.map_err(|_| anyhow!("S7 worker dropped reply"))??;
        } else {
            let data = encode_value(&value, &tag.data_type, addr.byte_width)?;
            let (reply_tx, reply_rx) = oneshot::channel();
            tx.send(S7Command::WriteBytes {
                area: addr.area,
                db_num: addr.db_num,
                start: addr.byte_offset,
                data,
                reply: reply_tx,
            })
            .await
            .map_err(|_| anyhow!("S7 worker channel closed"))?;
            reply_rx.await.map_err(|_| anyhow!("S7 worker dropped reply"))??;
        }

        Ok(())
    }

    async fn browse_tags(&self, driver: &DriverInstance) -> Result<Vec<BrowseGroup>> {
        // Native backend returns tags as configured in the driver (no remote discovery).
        Ok(driver
            .tag_groups
            .iter()
            .map(|g| BrowseGroup {
                name: g.name.clone(),
                interval: g.tags.iter().filter_map(|t| t.scan_ms.map(u64::from)).min(),
                tags: g
                    .tags
                    .iter()
                    .map(|t| BrowseTag {
                        name: t.name.clone(),
                        address: Some(t.address.clone()),
                        data_type: None,
                        attribute: None,
                        description: t.attributes.get("description").and_then(|v| v.as_str()).map(String::from),
                    })
                    .collect(),
            })
            .collect())
    }

    fn node_name(&self, driver: &DriverInstance) -> String {
        format!("native-s7-{}", &driver.id[..8.min(driver.id.len())])
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn find_tag_by_name<'a>(driver: &'a DriverInstance, tag_name: &str) -> Result<&'a shared::domain::driver::DriverTag> {
    driver
        .tag_groups
        .iter()
        .flat_map(|g| g.tags.iter())
        .find(|t| t.name == tag_name)
        .ok_or_else(|| anyhow!("Tag '{}' not found in driver", tag_name))
}

/// Decode raw bytes from the PLC into a JSON value based on the declared data type.
fn decode_bytes(buf: &[u8], data_type: &DriverDataType) -> Value {
    match data_type {
        DriverDataType::Bool => {
            Value::from(if buf.first().copied().unwrap_or(0) != 0 { 1 } else { 0 })
        }
        DriverDataType::Int16 if buf.len() >= 2 => {
            Value::from(i16::from_be_bytes([buf[0], buf[1]]))
        }
        DriverDataType::Uint16 if buf.len() >= 2 => {
            Value::from(u16::from_be_bytes([buf[0], buf[1]]))
        }
        DriverDataType::Int32 if buf.len() >= 4 => {
            Value::from(i32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]))
        }
        DriverDataType::Uint32 if buf.len() >= 4 => {
            Value::from(u32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]))
        }
        DriverDataType::Float32 if buf.len() >= 4 => {
            let f = f32::from_be_bytes([buf[0], buf[1], buf[2], buf[3]]);
            json!(f)
        }
        DriverDataType::Float64 if buf.len() >= 8 => {
            let f = f64::from_be_bytes([buf[0], buf[1], buf[2], buf[3], buf[4], buf[5], buf[6], buf[7]]);
            json!(f)
        }
        DriverDataType::String => {
            // S7 strings: first two bytes are max_len and actual_len
            if buf.len() >= 2 {
                let actual_len = buf[1] as usize;
                let s = std::str::from_utf8(&buf[2..2 + actual_len.min(buf.len() - 2)])
                    .unwrap_or("")
                    .to_string();
                Value::String(s)
            } else {
                Value::String(String::new())
            }
        }
        _ => {
            // Fallback: return raw bytes as array
            Value::Array(buf.iter().map(|b| Value::from(*b)).collect())
        }
    }
}

/// Encode a JSON value into bytes for PLC write based on data type.
fn encode_value(value: &Value, data_type: &DriverDataType, byte_width: usize) -> Result<Vec<u8>> {
    match data_type {
        DriverDataType::Int16 | DriverDataType::Uint16 => {
            let n = value.as_i64().ok_or_else(|| anyhow!("Expected integer value"))? as i16;
            Ok(n.to_be_bytes().to_vec())
        }
        DriverDataType::Int32 | DriverDataType::Uint32 => {
            let n = value.as_i64().ok_or_else(|| anyhow!("Expected integer value"))? as i32;
            Ok(n.to_be_bytes().to_vec())
        }
        DriverDataType::Float32 => {
            let f = value.as_f64().ok_or_else(|| anyhow!("Expected numeric value"))? as f32;
            Ok(f.to_be_bytes().to_vec())
        }
        DriverDataType::Float64 => {
            let f = value.as_f64().ok_or_else(|| anyhow!("Expected numeric value"))?;
            Ok(f.to_be_bytes().to_vec())
        }
        _ => {
            // For Bool byte-level or unknown, write raw
            let n = value.as_i64().unwrap_or(0);
            let mut buf = vec![0u8; byte_width.max(1)];
            if !buf.is_empty() {
                buf[buf.len() - 1] = n as u8;
            }
            Ok(buf)
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_input_bit() {
        let a = parse_s7_address("I0.0").unwrap();
        assert_eq!(a.area, S7_AREA_PE);
        assert_eq!(a.db_num, 0);
        assert_eq!(a.byte_offset, 0);
        assert_eq!(a.bit, Some(0));
    }

    #[test]
    fn parse_output_bit() {
        let a = parse_s7_address("Q0.5").unwrap();
        assert_eq!(a.area, S7_AREA_PA);
        assert_eq!(a.byte_offset, 0);
        assert_eq!(a.bit, Some(5));
    }

    #[test]
    fn parse_marker_bit() {
        let a = parse_s7_address("M0.3").unwrap();
        assert_eq!(a.area, S7_AREA_MK);
        assert_eq!(a.bit, Some(3));
    }

    #[test]
    fn parse_marker_word() {
        let a = parse_s7_address("MW0").unwrap();
        assert_eq!(a.area, S7_AREA_MK);
        assert_eq!(a.byte_offset, 0);
        assert_eq!(a.bit, None);
        assert_eq!(a.byte_width, 2);
    }

    #[test]
    fn parse_marker_dword() {
        let a = parse_s7_address("MD4").unwrap();
        assert_eq!(a.area, S7_AREA_MK);
        assert_eq!(a.byte_offset, 4);
        assert_eq!(a.byte_width, 4);
    }

    #[test]
    fn parse_db_bit() {
        let a = parse_s7_address("DB1.DBX0.1").unwrap();
        assert_eq!(a.area, S7_AREA_DB);
        assert_eq!(a.db_num, 1);
        assert_eq!(a.byte_offset, 0);
        assert_eq!(a.bit, Some(1));
    }

    #[test]
    fn parse_db_word() {
        let a = parse_s7_address("DB1.DBW0").unwrap();
        assert_eq!(a.area, S7_AREA_DB);
        assert_eq!(a.db_num, 1);
        assert_eq!(a.byte_offset, 0);
        assert_eq!(a.byte_width, 2);
    }

    #[test]
    fn parse_db_dword() {
        let a = parse_s7_address("DB10.DBD100").unwrap();
        assert_eq!(a.area, S7_AREA_DB);
        assert_eq!(a.db_num, 10);
        assert_eq!(a.byte_offset, 100);
        assert_eq!(a.byte_width, 4);
    }

    #[test]
    fn parse_input_word() {
        let a = parse_s7_address("IW0").unwrap();
        assert_eq!(a.area, S7_AREA_PE);
        assert_eq!(a.byte_width, 2);
    }

    #[test]
    fn parse_lowercase() {
        let a = parse_s7_address("m0.7").unwrap();
        assert_eq!(a.area, S7_AREA_MK);
        assert_eq!(a.bit, Some(7));
    }

    #[test]
    fn invalid_address_returns_error() {
        assert!(parse_s7_address("X0.0").is_err());
        assert!(parse_s7_address("").is_err());
        assert!(parse_s7_address("I0.9").is_err()); // bit > 7
    }

    #[test]
    fn decode_int16() {
        let buf = 300i16.to_be_bytes();
        let v = decode_bytes(&buf, &DriverDataType::Int16);
        assert_eq!(v, Value::from(300));
    }

    #[test]
    fn decode_float32() {
        let buf = 3.14f32.to_be_bytes();
        let v = decode_bytes(&buf, &DriverDataType::Float32);
        let f = v.as_f64().unwrap();
        assert!((f - 3.14).abs() < 0.01);
    }
}
