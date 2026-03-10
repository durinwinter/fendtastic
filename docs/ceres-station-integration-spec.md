# Ceres Station Integration Spec

Status: Draft baseline  
Scope: `ceres-station` as a vertical capability application on top of `fendtastic`

## 1. Intent

`ceres-station` is the operator-facing application for a shingle manufacturing line.

`fendtastic` is the substrate beneath it.

Under this model:
- `fendtastic` provides authoritative process context from PLCs and industrial systems
- `ceres-station` consumes that process context through engineered PEA topics
- `ceres-station` adds specialty sensors such as the XI-400 and performs line-specific calculations

This is not a peer-to-peer relationship. `ceres-station` depends on `fendtastic` for control-system context.

## 2. Authoritative Input From `fendtastic`

`ceres-station` should subscribe to the namespaces already emitted by engineered PEAs.

### 2.1 Core PEA topic families

Current `fendtastic` topic helpers generate:
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/announce`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/status`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/config`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/services/{service_tag}/state`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/services/{service_tag}/command`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/data/{data_item}`

Runtime substrate topics also include:
- `entmoot/runtime/nodes/{runtime_id}/status`
- `entmoot/runtime/nodes/{runtime_id}/drivers/{driver_id}/status`
- `entmoot/runtime/nodes/{runtime_id}/pea/{pea_id}/deploy`
- `entmoot/runtime/nodes/{runtime_id}/pea/{pea_id}/lifecycle`

Authority topics include:
- `entmoot/habitat/pea/{pea_id}/authority`

### 2.2 What `ceres-station` should consume

At minimum:
- PEA announce and status for discovery and lifecycle awareness
- PEA config for understanding the engineered assembly
- PEA data topics for process variables and timing anchors
- service state topics where procedure state matters to the line twin
- authority state when UI needs to show commandability context

`ceres-station` should treat these as authoritative and stable relative to PLC reality.

## 3. PEA Inputs Needed By `ceres-station`

For a shingle line, `ceres-station` should consume process context such as:
- line speed
- conveyor state
- cutter running/stopped/faulted state
- exit photoeye events
- station enable/disable state
- recipe or product selection
- line mode and shift/production context if exposed by PEA config or data

These should come from canonical PEA outputs, not from PLC vendor addresses.

## 4. `ceres-station` Direct Sensors

`ceres-station` may own direct acquisition for non-PLC specialty sensors such as:
- XI-400 thermal camera
- line-local accelerometers
- specialty photoeyes not brought into the PLC model
- other quality/twin sensors

These sensors are additive.

They do not replace:
- `fendtastic` driver management
- `fendtastic` PEA/MTP organization
- `fendtastic` control-system authority

## 5. Binding Model

`ceres-station` should maintain a binding table between:
- `required_process_signals`
- engineered PEA identifiers
- canonical or emitted PEA topic keys

Recommended binding record:

```json
{
  "signal_key": "line_speed",
  "pea_id": "LINE-TRANSPORT-PEA-001",
  "node_id": "edge-line-01",
  "source_type": "pea_data",
  "topic": "entmoot/habitat/nodes/edge-line-01/pea/LINE-TRANSPORT-PEA-001/data/active.conveyor_1.rpm_fbk",
  "canonical_tag": "active.conveyor_1.rpm_fbk",
  "required": true
}
```

Recommended source types:
- `pea_status`
- `pea_config`
- `pea_data`
- `service_state`
- `authority`
- `runtime_status`

## 6. Suggested `ceres-station` Config Shape

```json
{
  "extension_id": "ceres-station",
  "line_id": "line-02",
  "fendtastic_context": {
    "enabled": true,
    "router": "tcp/zenoh-router:7447",
    "required_process_signals": [
      {
        "signal_key": "line_speed",
        "pea_id": "LINE-TRANSPORT-PEA-001",
        "source_type": "pea_data",
        "topic": "entmoot/habitat/nodes/edge-line-01/pea/LINE-TRANSPORT-PEA-001/data/active.conveyor_1.rpm_fbk",
        "canonical_tag": "active.conveyor_1.rpm_fbk",
        "required": true
      },
      {
        "signal_key": "shingle_exit_detect",
        "pea_id": "PATTERN-CUTTER-PEA-001",
        "source_type": "pea_data",
        "topic": "entmoot/habitat/nodes/edge-line-01/pea/PATTERN-CUTTER-PEA-001/data/active.exit_photoeye.fbk",
        "canonical_tag": "active.exit_photoeye.fbk",
        "required": true
      },
      {
        "signal_key": "cutter_runtime_state",
        "pea_id": "PATTERN-CUTTER-PEA-001",
        "source_type": "pea_status",
        "topic": "entmoot/habitat/nodes/edge-line-01/pea/PATTERN-CUTTER-PEA-001/status",
        "required": true
      }
    ]
  },
  "direct_sensors": [
    {
      "sensor_id": "optris-xi400-01",
      "role": "thermal_primary",
      "sensor_type": "ir_camera"
    }
  ]
}
```

## 7. Topic Consumption Rules

### 7.1 Discovery

`ceres-station` should discover relevant PEAs by:
- reading configured `pea_id` bindings
- optionally subscribing to:
  - `entmoot/habitat/nodes/*/pea/*/announce`
  - `entmoot/habitat/nodes/*/pea/*/status`

### 7.2 Process values

For live process context, subscribe primarily to:
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/data/{data_item}`

That is the expected source for speed, feedbacks, anchors, and other machine variables.

### 7.3 Lifecycle and health

For runtime-aware UX and degraded-mode logic, subscribe to:
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/status`
- `entmoot/runtime/nodes/{runtime_id}/status`
- `entmoot/runtime/nodes/{runtime_id}/drivers/{driver_id}/status`

## 8. `ceres-station` Output Topics

`ceres-station` should publish under an extension namespace, not under authoritative habitat/runtime namespaces.

Recommended output families:
- `entmoot/extensions/ceres-station/line/{line_id}/observations/{feature}`
- `entmoot/extensions/ceres-station/line/{line_id}/detections/{defect_type}`
- `entmoot/extensions/ceres-station/line/{line_id}/health/{segment}`
- `entmoot/extensions/ceres-station/line/{line_id}/events/{class}`
- `entmoot/extensions/ceres-station/line/{line_id}/labels/{shingle_id}`

Optional node heartbeat:
- `entmoot/extensions/ceres-station/nodes/{node_id}/heartbeat`

## 9. Command and Authority Rule

`ceres-station` may:
- display machine state
- display authority state
- recommend actions
- request control operations through `fendtastic`

`ceres-station` must not:
- bypass PEA authority
- issue direct PLC commands outside the `fendtastic` command surfaces
- redefine authoritative machine state

If a control request is needed, it must flow back through:
- `fendtastic` REST APIs
- or `entmoot/habitat/.../services/.../command`

## 10. Mapping To Existing Ceres Concepts

Current `ceres-station` concepts that fit well:
- `SensorProfile`
- `StationConfig`
- `UseCaseDefinition`
- direct XI-400 acquisition
- health and twin event pipelines

What should be added:
- `required_process_signals`
- `optional_process_signals`
- explicit `fendtastic_context` block
- installer validation against subscribed PEA topics

What should be removed or downgraded:
- any assumption that `ceres-station` owns the primary PLC namespace
- any assumption that plant/line runtime identity starts in `ceres-station`

## 11. Recommended Implementation Sequence

1. Add `fendtastic_context.required_process_signals` to `ceres-station` config.
2. Add a Zenoh subscriber layer that consumes configured `entmoot/habitat/**` topics.
3. Feed those values into station/use-case pipelines as process context.
4. Keep XI-400 and other direct sensors as separate acquisition inputs.
5. Publish only derived vertical outputs under `entmoot/extensions/ceres-station/**`.
6. Add installer validation that confirms required PEA topics are present before a use case can be armed.

## 12. Acceptance Criteria

The integration is correct when:

1. `ceres-station` can operate using `fendtastic` PEA topics as its control-system context.
2. XI-400 data is fused with PEA-derived context in the twin pipeline.
3. No PLC vendor addresses appear in `ceres-station` runtime bindings.
4. `ceres-station` outputs remain separate from `entmoot/habitat/**` authoritative process topics.
5. Any control request still routes back through `fendtastic` authority and command surfaces.
