use std::fs;
use std::path::Path;

pub fn persist_snapshot(base_dir: &str, name: &str, payload: &serde_json::Value) -> anyhow::Result<()> {
    fs::create_dir_all(base_dir)?;
    let path = Path::new(base_dir).join(format!("{}.json", name));
    fs::write(path, serde_json::to_string_pretty(payload)?)?;
    Ok(())
}
