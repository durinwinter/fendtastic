# Capability Extension Contract

Status: Draft baseline  
Scope: Boundary between `fendtastic` and vertical applications built on top of it

## 1. Purpose

This contract defines how a vertical application integrates with `fendtastic`.

Examples of vertical applications:
- `ceres-station` for a shingle manufacturing digital twin
- future line-specific or facility-specific operator applications

The intent is to keep `fendtastic` vertical-agnostic while allowing capability extensions to become the actual application for a line, process, or facility.

## 2. Core Boundary

### `fendtastic` is the substrate

`fendtastic` owns:
- PLC and industrial connectivity
- southbound frontend integration
- runtime node provisioning and lifecycle
- node networking and release management
- driver configuration
- canonical tag exposure
- PEA/MTP modeling
- authority and capability substrate
- publication of authoritative control-system context

`fendtastic` does not own:
- vertical-specific operator workflows
- line-specific digital twin semantics
- domain-specific analytics UX
- defect labeling UX
- vertical reporting workflows

### capability extensions are the vertical application

A capability extension owns:
- the operator-facing application for a specific vertical
- domain-specific use cases and workflows
- analytics, inference, and digital twin behavior
- added specialty sensors not already represented in PLC control data
- derived observations, domain alarms, and vertical exports

A capability extension does not replace `fendtastic` as the control-system integration layer.

## 3. Required Data Flow

The required flow is:

1. PLCs, industrial devices, and field networks
2. `fendtastic`
3. PEA/MTP/canonical tags and capability advertisements over Zenoh and API
4. capability extension
5. extension-specific sensor fusion and domain logic
6. domain-specific outputs

This is the hard rule:

- `fendtastic` provides authoritative control-system context
- capability extensions consume that context
- capability extensions may add direct sensors and compute new semantics on top

## 4. Canonical Integration Model

Capability extensions integrate through:
- `PEA definitions`
- `canonical tags`
- `capability advertisements`
- runtime and authority state

The extension should bind to canonical tags rather than to PLC addresses directly.

That means:
- no line app should depend on `DB1,X0.0` or vendor-specific addresses
- the extension should depend on canonical names exposed by `fendtastic`

Examples:
- `active.conveyor_1.rpm_fbk`
- `active.exit_photoeye.fbk`
- `service.production.config.recipe_id`
- `active.cutter_1.stop_cmd`

## 5. Extension Inputs

A capability extension may have two input classes.

### 5.1 Control-system context from `fendtastic`

Examples:
- machine state
- line speed
- recipe and mode
- station enable state
- photoeye timing anchors
- drive feedback
- alarms and lifecycle state

These inputs must come from `fendtastic` PEA/canonical data.

### 5.2 Extension-local specialty sensors

Examples:
- XI-400 thermal camera
- accelerometers
- vision cameras
- laser distance sensors
- specialty gap sensors

These inputs may be acquired directly by the extension.

## 6. Extension Outputs

Capability extensions may publish:
- derived observations
- health assessments
- defect detections
- digital twin events
- recommendations
- vertical alarms
- training/export artifacts

They must not silently redefine authoritative control-system state already owned by `fendtastic`.

If an extension wants to influence control behavior, it should do so through:
- declared capabilities
- advisory outputs
- or explicit command requests back through `fendtastic` authority and command surfaces

## 7. Topic Boundary

`fendtastic` remains authoritative under the `entmoot` control-runtime namespace.

Examples:
- `entmoot/runtime/nodes/{runtime_id}/status`
- `entmoot/runtime/nodes/{runtime_id}/drivers/{driver_id}/status`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/status`
- `entmoot/habitat/nodes/{node_id}/pea/{pea_id}/services/{service}/command`

Capability extensions should publish under an extension-specific namespace, for example:
- `entmoot/extensions/{extension_id}/...`

Recommended structure:
- `entmoot/extensions/{extension_id}/nodes/{node_id}/health`
- `entmoot/extensions/{extension_id}/line/{line_id}/observations/{feature}`
- `entmoot/extensions/{extension_id}/line/{line_id}/detections/{type}`
- `entmoot/extensions/{extension_id}/line/{line_id}/events/{class}`

Extensions may subscribe to `entmoot/runtime/**` and `entmoot/habitat/**`, but should not redefine those topic families as their own source of truth.

## 8. Configuration Contract

Every capability extension should declare:

1. `required_process_signals`
2. `optional_process_signals`
3. `required_direct_sensors`
4. `capabilities_exposed`

Suggested structure:

```json
{
  "extension_id": "ceres-station",
  "line_id": "line-02",
  "required_process_signals": [
    {
      "signal_key": "line_speed",
      "pea_id": "LINE-TRANSPORT-PEA-001",
      "canonical_tag": "active.conveyor_1.rpm_fbk"
    },
    {
      "signal_key": "shingle_exit_detect",
      "pea_id": "PATTERN-CUTTER-PEA-001",
      "canonical_tag": "active.exit_photoeye.fbk"
    }
  ],
  "required_direct_sensors": [
    {
      "sensor_id": "optris-xi400-01",
      "role": "thermal_primary"
    }
  ],
  "capabilities_exposed": [
    "adhesive_detection",
    "sling_detection",
    "cutter_health_assessment"
  ]
}
```

## 9. Capability Advertisement Model

`fendtastic` advertises substrate-level capabilities such as:
- line transport state
- cutter runtime state
- station enable state
- recipe context
- machine speed
- command surfaces

Capability extensions advertise higher-order capabilities such as:
- adhesive detection
- sling detection
- cutter health assessment
- shingle trace enrichment
- training capture and labeling

These are complementary, not competing.

## 10. Authority and Control

Authority remains rooted in `fendtastic` PEA semantics.

That means:
- extension applications may display authority state
- extension applications may issue requests
- final command validation still happens through `fendtastic`

A capability extension must not bypass:
- PEA authority mode
- PEA runtime state
- command validation

## 11. Example: `ceres-station`

`ceres-station` is the first reference vertical application under this model.

### What `ceres-station` should own

- shingle-line operator UX
- XI-400 acquisition
- direct labeling and training capture
- defect and anomaly inference
- line-specific digital twin logic
- QA and engineering export workflows

### What `ceres-station` should consume from `fendtastic`

- conveyor speed and state
- cutter state
- exit photoeye state
- station mode and recipe
- line runtime health
- relevant PEA lifecycle and alarm state

### What `ceres-station` should publish

- adhesive detection outputs
- sling detection outputs
- cutter health assessments
- trace enrichment events
- operator annotations

### What `ceres-station` should not do

- become the primary PLC integration layer
- publish a competing authoritative machine-state namespace
- bypass PEA authority for control actions

## 12. Acceptance Criteria

The boundary is considered correctly implemented when:

1. `fendtastic` can run without any single vertical application.
2. A vertical application can bind to canonical PEA tags without knowing PLC vendor addresses.
3. Extension-local sensors can be fused with `fendtastic` process context.
4. Extension outputs are published separately from authoritative control-system topics.
5. All control requests still pass through `fendtastic` authority and PEA validation.
6. Replacing one vertical app with another does not require reworking the `fendtastic` substrate.

## 13. Design Rule

Use this rule when deciding where functionality belongs:

- if it is about getting data out of PLCs, industrial frontends, runtime nodes, or PEA/MTP structures, it belongs in `fendtastic`
- if it is about making sense of a specific line, product, process, or facility domain, it belongs in a capability extension
