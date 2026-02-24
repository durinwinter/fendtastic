# MURPH: Mars Habitat Control System Specifications

## 1. Overview
MURPH (Multi-Unit Real-time Processing & Habitat) is the next-generation control system for Martian surface operations. It leverages the robust foundation of the Fendtastic/Heptapod codebase, evolved into a distributed, high-reliability habitat management suite.

## 2. Technical Architecture

### 2.1 Edge Node PEA (Process Equipment Assembly)
- **Multi-Machine Hosting**: Each edge node can host multiple virtualized "Machines" (e.g., HVAC, Hydroponics, Power Grid).
- **MTP Compatibility**: Each virtual machine exposes a Module Type Package (MTP) interface for standardized orchestration.
- **Connectivity**: Brownfield hardware is brought into the MURPH ecosystem via EVA-ICS v4 collectors, mapped to Zenoh topics.

### 2.2 Centralized POL (Process Orchestration Layer)
- **Global Visibility**: Aggregates state and telemetry from all Edge Nodes.
- **Habitat Automation**: Orchestrates complex sequences across multiple PEAs (e.g., "Night Cycle Shift" involving lighting, HVAC, and power).
- **Resilience**: High-availability Zenoh mesh ensures communication even during localized node failure.

## 3. Design Philosophy: "Red Mars" Aesthetic
- **Environment**: High-reliability, scientifically precise, industrial explorer.
- **Color Palette**:
  - **Primary**: Mars Rust (#B7410E) / Deep Iron (#1A1A1A)
  - **Secondary**: Terminal Amber (#FFBF00) / Oxygen Blue (#00D1FF)
- **Logo**: Features "Coobie" the expedition mascot.
- **Coobie Assistant**: A Clippy-style helper that translates complex telemetry into human-readable insights.
- **Typography**: Monospaced fonts (e.g., JetBrains Mono, Roboto Mono) for data; clean sans-serif (e.g., Inter, Outfit) for controls.

## 4. Artificial Intelligence & Orchestration

### 4.1 Coobie (Local LLM Integration)
- **Engine**: Connectivity to LM Studio (running locally on port 1234 by default).
- **Context**: Accesses real-time Zenoh feeds for "Habitat Sentiment" and "Health Assessment".
- **Interface**: Clippy-inspired non-modal assistant floating in the corner of the HUD.

## 5. Key Expressions (Zenoh)
- `murph/habitat/nodes/{node_id}/pea/{machine_id}/state`
- `murph/habitat/pol/status`
- `murph/habitat/telemetry/{machine_id}/{sensor}`
