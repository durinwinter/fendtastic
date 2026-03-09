use serde::de::DeserializeOwned;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::io;
use std::path::Path;
use tracing::error;

pub fn load_map<T>(dir: &str) -> HashMap<String, T>
where
    T: DeserializeOwned,
{
    let mut result = HashMap::new();
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(err) if err.kind() == io::ErrorKind::NotFound => return result,
        Err(err) => {
            error!("Failed to read dir {}: {}", dir, err);
            return result;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
            continue;
        }
        match fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str::<T>(&contents) {
                Ok(value) => {
                    if let Some(stem) = path.file_stem().and_then(|stem| stem.to_str()) {
                        result.insert(stem.to_string(), value);
                    }
                }
                Err(err) => error!("Failed to parse {}: {}", path.display(), err),
            },
            Err(err) => error!("Failed to read {}: {}", path.display(), err),
        }
    }

    result
}

pub fn persist_json<T>(dir: &str, id: &str, value: &T)
where
    T: Serialize,
{
    if let Err(err) = fs::create_dir_all(dir) {
        error!("Failed to create dir {}: {}", dir, err);
        return;
    }

    let path = Path::new(dir).join(format!("{}.json", id));
    match serde_json::to_string_pretty(value) {
        Ok(json) => {
            if let Err(err) = fs::write(&path, json) {
                error!("Failed to write {}: {}", path.display(), err);
            }
        }
        Err(err) => error!("Failed to serialize {}: {}", path.display(), err),
    }
}

pub fn delete_json(dir: &str, id: &str) {
    let path = Path::new(dir).join(format!("{}.json", id));
    if let Err(err) = fs::remove_file(&path) {
        if err.kind() != io::ErrorKind::NotFound {
            error!("Failed to delete {}: {}", path.display(), err);
        }
    }
}

pub fn load_json<T>(path: &str) -> Option<T>
where
    T: DeserializeOwned,
{
    match fs::read_to_string(path) {
        Ok(contents) => match serde_json::from_str::<T>(&contents) {
            Ok(value) => Some(value),
            Err(err) => {
                error!("Failed to parse {}: {}", path, err);
                None
            }
        },
        Err(err) if err.kind() == io::ErrorKind::NotFound => None,
        Err(err) => {
            error!("Failed to read {}: {}", path, err);
            None
        }
    }
}

pub fn persist_json_file<T>(path: &str, value: &T)
where
    T: Serialize,
{
    if let Some(parent) = Path::new(path).parent() {
        if let Err(err) = fs::create_dir_all(parent) {
            error!("Failed to create dir {}: {}", parent.display(), err);
            return;
        }
    }

    match serde_json::to_string_pretty(value) {
        Ok(json) => {
            if let Err(err) = fs::write(path, json) {
                error!("Failed to write {}: {}", path, err);
            }
        }
        Err(err) => error!("Failed to serialize {}: {}", path, err),
    }
}
