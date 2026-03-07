# MURPH: Mars Habitat Control System Specifications

## 1. Overview
MURPH (Multi-Unit Real-time Processing & Habitat) is the next-generation control system for Martian surface operations. It leverages the Fendtastic/Heptapod codebase as a distributed habitat management suite.

## 2. Technical Architecture

### 2.1 Edge Node PEA (Process Equipment Assembly)
- **Initial Deployment Model**: Each edge node hosts one PEA in the current runtime model.
- **MTP Compatibility**: Each PEA exposes a Module Type Package (MTP) interface for standardized orchestration.
- **Connectivity**: Brownfield hardware is integrated through Neuron southbound drivers and mapped onto Zenoh topic families.

### 2.2 Centralized POL (Process Orchestration Layer)
- **Global Visibility**: Aggregates state and telemetry from all edge nodes.
- **Habitat Automation**: Orchestrates complex sequences across multiple PEAs.
- **Resilience**: Zenoh distributes runtime, capability, and health state across the habitat.

## 3. Design Philosophy: "Red Mars" Aesthetic
- **Environment**: High-reliability, scientifically precise, industrial explorer.
- **Color Palette**:
  - **Primary**: Mars Rust (#B7410E) / Deep Iron (#1A1A1A)
  - **Secondary**: Terminal Amber (#FFBF00) / Oxygen Blue (#00D1FF)
- **Logo**: Features "Coobie" the expedition mascot.
- **Coobie Assistant**: A helper that translates telemetry into operator-facing insights.
- **Typography**: Monospaced fonts for data; clean sans-serif fonts for controls.

## 4. Artificial Intelligence & Orchestration

### 4.1 Coobie (Local LLM Integration)
- **Engine**: Connectivity to LM Studio.
- **Context**: Accesses Zenoh feeds for habitat health and state.
- **Interface**: Non-modal assistant floating in the HUD.

## 5. Key Expressions (Zenoh)
- `murph/runtime/nodes/{node_id}/status`
- `murph/runtime/nodes/{node_id}/pea/{pea_id}/lifecycle`
- `murph/habitat/nodes/{node_id}/pea/{pea_id}/status`
- `murph/pol/status`
