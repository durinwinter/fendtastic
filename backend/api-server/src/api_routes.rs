use actix_web::web;

use crate::{
    authority_handlers, binding_handlers, driver_handlers, handlers, i3x_handlers, mesh_handlers,
    pea_handlers, pol_handlers, runtime_handlers, scenario_handlers, timeseries_handlers,
};

pub fn configure_api(cfg: &mut web::ServiceConfig) {
    cfg
        // Dashboard endpoints
        .route("/metrics", web::get().to(handlers::get_metrics))
        .route("/machines", web::get().to(handlers::get_machines))
        .route("/machines/{id}", web::get().to(handlers::get_machine_by_id))
        .route("/alarms", web::get().to(handlers::get_alarms))
        .route("/alarms/{id}/ack", web::post().to(pol_handlers::ack_alarm))
        .route("/alarms/{id}/shelve", web::post().to(pol_handlers::shelve_alarm))
        .route("/alarms/{id}/action", web::post().to(pol_handlers::action_alarm))
        .route("/alarms/{id}", web::delete().to(pol_handlers::delete_alarm))
        .route("/alarm-rules", web::get().to(pol_handlers::list_alarm_rules))
        .route("/alarm-rules", web::post().to(pol_handlers::create_alarm_rule))
        .route("/alarm-rules/{id}", web::put().to(pol_handlers::update_alarm_rule))
        .route("/alarm-rules/{id}", web::delete().to(pol_handlers::delete_alarm_rule))
        .route("/blackouts", web::get().to(pol_handlers::list_blackouts))
        .route("/blackouts", web::post().to(pol_handlers::create_blackout))
        .route("/blackouts/{id}", web::delete().to(pol_handlers::delete_blackout))
        .route("/timeseries/{machine_id}", web::get().to(handlers::get_timeseries))
        // Time-series historical data
        .route("/ts/keys", web::get().to(timeseries_handlers::get_ts_keys))
        .route("/ts/query", web::get().to(timeseries_handlers::query_timeseries))
        .route("/ts/latest", web::get().to(timeseries_handlers::get_ts_latest))
        .route("/ts/config", web::get().to(timeseries_handlers::get_ts_config))
        .route("/ts/config", web::put().to(timeseries_handlers::update_ts_config))
        // PEA CRUD
        .route("/pea", web::get().to(pea_handlers::list_peas))
        .route("/pea", web::post().to(pea_handlers::create_pea))
        .route("/pea/{id}", web::get().to(pea_handlers::get_pea))
        .route("/pea/{id}", web::put().to(pea_handlers::update_pea))
        .route("/pea/{id}", web::delete().to(pea_handlers::delete_pea))
        // PEA Lifecycle
        .route("/pea/{id}/deploy", web::post().to(pea_handlers::deploy_pea))
        .route("/pea/{id}/undeploy", web::post().to(pea_handlers::undeploy_pea))
        .route("/pea/{id}/start", web::post().to(pea_handlers::start_pea))
        .route("/pea/{id}/stop", web::post().to(pea_handlers::stop_pea))
        .route(
            "/pea/{id}/services/{service_tag}/command",
            web::post().to(pea_handlers::command_service),
        )
        // Runtime Nodes
        .route("/runtime/nodes", web::get().to(runtime_handlers::list_runtime_nodes))
        .route("/runtime/nodes", web::post().to(runtime_handlers::create_runtime_node))
        .route("/runtime/nodes/{id}", web::get().to(runtime_handlers::get_runtime_node))
        .route(
            "/runtime/nodes/{id}/status",
            web::get().to(runtime_handlers::get_runtime_node_status),
        )
        .route("/runtime/nodes/{id}", web::put().to(runtime_handlers::update_runtime_node))
        .route(
            "/runtime/nodes/{id}",
            web::delete().to(runtime_handlers::delete_runtime_node),
        )
        .route("/runtime/nodes/{id}/test", web::post().to(runtime_handlers::test_runtime_node))
        // Drivers
        .route("/drivers/catalog", web::get().to(driver_handlers::get_driver_catalog))
        .route(
            "/drivers/catalog/{id}/schema",
            web::get().to(driver_handlers::get_driver_schema),
        )
        .route("/drivers", web::get().to(driver_handlers::list_drivers))
        .route("/drivers", web::post().to(driver_handlers::create_driver))
        .route("/drivers/{id}", web::get().to(driver_handlers::get_driver))
        .route("/drivers/{id}", web::put().to(driver_handlers::update_driver))
        .route("/drivers/{id}", web::delete().to(driver_handlers::delete_driver))
        .route("/drivers/{id}/browse", web::get().to(driver_handlers::browse_driver_tags))
        .route("/drivers/{id}/start", web::post().to(driver_handlers::start_driver))
        .route("/drivers/{id}/status", web::get().to(driver_handlers::get_driver_status))
        .route("/drivers/{id}/stop", web::post().to(driver_handlers::stop_driver))
        .route("/drivers/{id}/read", web::post().to(driver_handlers::read_driver_tag))
        .route("/drivers/{id}/write", web::post().to(driver_handlers::write_driver_tag))
        .route("/drivers/{id}/import", web::post().to(driver_handlers::import_driver_tags))
        // Bindings
        .route("/bindings", web::get().to(binding_handlers::list_bindings))
        .route("/bindings", web::post().to(binding_handlers::create_binding))
        .route("/bindings/{id}", web::get().to(binding_handlers::get_binding))
        .route("/bindings/{id}", web::put().to(binding_handlers::update_binding))
        .route("/bindings/{id}", web::delete().to(binding_handlers::delete_binding))
        .route("/bindings/{id}/validate", web::post().to(binding_handlers::validate_binding))
        .route("/bindings/{id}/read", web::post().to(binding_handlers::read_binding_tag))
        .route("/bindings/{id}/write", web::post().to(binding_handlers::write_binding_tag))
        // Authority
        .route("/authority/{pea_id}", web::get().to(authority_handlers::get_authority_state))
        .route("/authority/{pea_id}", web::post().to(authority_handlers::set_authority_state))
        .route(
            "/authority/{pea_id}/audit",
            web::get().to(authority_handlers::get_authority_audit),
        )
        // Recipes
        .route("/recipes", web::get().to(pea_handlers::list_recipes))
        .route("/recipes", web::post().to(pea_handlers::create_recipe))
        .route("/recipes/{id}", web::put().to(pea_handlers::update_recipe))
        .route("/recipes/{id}", web::delete().to(pea_handlers::delete_recipe))
        .route("/recipes/{id}/execute", web::post().to(pea_handlers::execute_recipe))
        .route(
            "/recipes/executions",
            web::get().to(pea_handlers::list_recipe_executions),
        )
        .route(
            "/recipes/executions/{id}",
            web::get().to(pea_handlers::get_recipe_execution),
        )
        // POL topology
        .route("/pol/topology", web::get().to(pol_handlers::get_topology))
        .route("/pol/topology", web::put().to(pol_handlers::put_topology))
        // Mesh / Zenoh Admin
        .route("/mesh/nodes", web::get().to(mesh_handlers::get_nodes))
        .route("/mesh/router", web::get().to(mesh_handlers::get_router_info))
        .route("/mesh/links", web::get().to(mesh_handlers::get_links))
        .route("/mesh/keys", web::get().to(mesh_handlers::get_keys))
        .route(
            "/mesh/keys/{key_expr:.*}",
            web::get().to(mesh_handlers::get_key_value),
        )
        .route("/mesh/config", web::post().to(mesh_handlers::update_config))
        .route(
            "/mesh/generate-config",
            web::post().to(mesh_handlers::generate_node_config),
        )
        // Durins-Forge Scenario Launcher
        .route("/scenarios", web::get().to(scenario_handlers::list_scenarios))
        .route("/scenarios/launch", web::post().to(scenario_handlers::launch_scenario))
        .route(
            "/scenarios/{run_id}/status",
            web::get().to(scenario_handlers::get_scenario_status),
        )
        .route(
            "/scenarios/running",
            web::get().to(scenario_handlers::list_running_scenarios),
        )
        // I3X RFC 4.1 - Exploratory (Discovery)
        .route("/namespaces", web::get().to(i3x_handlers::get_namespaces))
        .route("/objecttypes", web::get().to(i3x_handlers::get_object_types))
        .route("/objecttypes/query", web::post().to(i3x_handlers::query_object_types))
        .route(
            "/objecttypes/{elementId}",
            web::get().to(i3x_handlers::get_object_type_by_id),
        )
        .route("/relationshiptypes", web::get().to(i3x_handlers::get_relationship_types))
        .route(
            "/relationshiptypes/query",
            web::post().to(i3x_handlers::query_relationship_types),
        )
        .route(
            "/relationshiptypes/{elementId}",
            web::get().to(i3x_handlers::get_relationship_type_by_id),
        )
        .route("/objects", web::get().to(i3x_handlers::get_objects))
        .route("/objects/list", web::post().to(i3x_handlers::get_objects_list))
        .route(
            "/objects/related",
            web::post().to(i3x_handlers::get_related_objects_bulk),
        )
        .route("/objects/{elementId}", web::get().to(i3x_handlers::get_object_by_id))
        .route(
            "/objects/{elementId}/related",
            web::get().to(i3x_handlers::get_related_objects),
        )
        // I3X RFC 4.2.1 - Values (Read)
        .route("/objects/value", web::post().to(i3x_handlers::get_current_value_bulk))
        .route(
            "/objects/{elementId}/value",
            web::get().to(i3x_handlers::get_current_value),
        )
        .route(
            "/objects/{elementId}/history",
            web::get().to(i3x_handlers::get_historical_values),
        )
        // I3X RFC 4.2.2 - Values (Write)
        .route(
            "/objects/{elementId}/value",
            web::put().to(i3x_handlers::update_current_value),
        )
        // WebSocket
        .route("/ws", web::get().to(crate::websocket::ws_handler));
}

#[cfg(test)]
mod tests {
    use super::*;
    use actix_web::{http::StatusCode, test, App};

    #[actix_web::test]
    async fn runtime_status_route_is_registered() {
        let app = test::init_service(
            App::new().service(web::scope("/api/v1").configure(configure_api)),
        )
        .await;

        let request = test::TestRequest::get()
            .uri("/api/v1/runtime/nodes/example/status")
            .to_request();
        let response = test::call_service(&app, request).await;

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn driver_write_route_is_registered() {
        let app = test::init_service(
            App::new().service(web::scope("/api/v1").configure(configure_api)),
        )
        .await;

        let request = test::TestRequest::post()
            .uri("/api/v1/drivers/example/write")
            .to_request();
        let response = test::call_service(&app, request).await;

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn binding_read_route_is_registered() {
        let app = test::init_service(
            App::new().service(web::scope("/api/v1").configure(configure_api)),
        )
        .await;

        let request = test::TestRequest::post()
            .uri("/api/v1/bindings/example/read")
            .to_request();
        let response = test::call_service(&app, request).await;

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn driver_browse_route_is_registered() {
        let app = test::init_service(
            App::new().service(web::scope("/api/v1").configure(configure_api)),
        )
        .await;

        let request = test::TestRequest::get()
            .uri("/api/v1/drivers/example/browse")
            .to_request();
        let response = test::call_service(&app, request).await;

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }

    #[actix_web::test]
    async fn ts_config_route_is_registered() {
        let app = test::init_service(
            App::new().service(web::scope("/api/v1").configure(configure_api)),
        )
        .await;

        let request = test::TestRequest::get()
            .uri("/api/v1/ts/config")
            .to_request();
        let response = test::call_service(&app, request).await;

        assert_ne!(response.status(), StatusCode::NOT_FOUND);
    }
}
