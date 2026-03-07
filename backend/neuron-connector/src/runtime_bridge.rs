use shared::domain::driver::DriverInstance;

pub fn render_driver_snapshot(driver: &DriverInstance) -> serde_json::Value {
    serde_json::json!({
        "driver_id": driver.id,
        "driver_key": driver.driver_key,
        "display_name": driver.display_name,
        "config": driver.config,
        "tag_groups": driver.tag_groups,
    })
}
