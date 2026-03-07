# Functional Specification

## Modular Automation Platform with Intent-Driven Control

Version: Draft 1.0
Document Scope: Platform Architecture and Control Model

---

# 1. Purpose

This document defines the functional architecture for a **modular automation platform** designed to coordinate distributed automation subsystems using a Packaged Equipment Assembly (PEA) model.

The platform enables humans, automation procedures, and AI systems to interact safely with physical infrastructure while maintaining deterministic machine behavior and operational safety.

The system architecture combines:

• modular automation subsystems (PEAs)
• centralized orchestration (Process Orchestration Layer)
• distributed communication infrastructure
• zero-trust service enforcement
• intent-driven control
• digital twin validation
• dynamic subsystem discovery

The platform is **domain-agnostic**. System functionality is defined entirely by engineered PEAs rather than hardcoded application logic.

---

# 2. System Overview

The platform coordinates automation modules deployed across distributed runtime nodes.

Each automation module represents a **Packaged Equipment Assembly (PEA)** containing:

• device integrations
• operational procedures
• telemetry interfaces
• command interfaces
• digital twin models
• capability definitions

PEAs are orchestrated by a central **Process Orchestration Layer (POL)**.

Actors interacting with the system may include:

• human operators
• maintenance engineers
• automation procedures
• optimization systems
• artificial intelligence models

The platform ensures that these actors interact with automation subsystems safely and predictably.

---

# 3. Core Architectural Principles

The platform is designed according to the following principles.

### Modular Automation

All automation logic is encapsulated inside PEAs.

### Deterministic Machine Semantics

Subsystem behavior is defined by PEA operational state models consistent with MTP orchestration concepts.

### Distributed Infrastructure

Automation components may run on distributed runtime nodes.

### Domain Independence

The platform itself contains no domain-specific logic. System functionality is defined through engineered PEAs.

### Intent-Driven Interaction

Actors influence system behavior through high-level intents rather than direct actuator manipulation.

### Safety by Design

Control actions are validated through machine semantics, policy enforcement, and digital twin simulation.

---

# 4. Control Authority Model

The Control Authority Model determines **which actors may control a subsystem at any given time**.

Authority is determined by the **operational state and control mode of the PEA**.

Examples of control modes include:

ObserveOnly
OperatorExclusive
AutoExclusive
AIAssisted
AIExclusive
MaintenanceExclusive
EmergencyLockout

Control modes are represented through the PEA runtime and exposed through the orchestration interface.

These states determine which actors may issue commands.

Authority transitions are managed by the Process Orchestration Layer.

---

# 5. Command Arbitration

Multiple actors may attempt to influence the same subsystem simultaneously.

Examples include:

• human operators
• automated procedures
• AI optimization engines

Command arbitration is resolved through the following hierarchy:

1. Machine operational state
2. Control authority mode
3. Actor class priority
4. Command ownership

Commands violating authority rules are rejected.

---

# 6. Zero-Trust Service Enforcement

Service access is enforced through a zero-trust architecture.

Each commandable interface is exposed as a **named service**.

Actors interact with services through authenticated identities.

Access policies determine which identities may access each service.

Service enforcement ensures that actors without authority cannot reach command interfaces.

Authority rules are derived from PEA operational state.

---

# 7. Intent-Based Control

External actors do not directly control actuators.

Instead, actors submit **intents** describing desired outcomes.

Examples of intents include:

increase humidity in zone 3
reduce energy consumption
flush irrigation subsystem
recover failed subsystem

The Process Orchestration Layer evaluates intents and translates them into procedures and commands executed through PEAs.

Intent-based control ensures that:

• external actors cannot bypass machine semantics
• optimization systems operate safely
• system behavior remains traceable

---

# 8. Digital Twin Arbitration

Before executing control plans derived from intents, the system may evaluate them using a **facility digital twin**.

The digital twin represents the operational state and behavior of the automation system.

Simulation allows the system to predict the impact of control actions before executing them in the real facility.

The digital twin verifies:

• safety constraints
• system stability
• operational limits

Control actions may be:

Approved
Modified
Rejected

---

# 9. PEA Runtime Architecture

Automation subsystems run inside **PEA runtimes** deployed on distributed nodes.

Each runtime provides:

• device connectivity
• telemetry publication
• command execution
• procedure management
• operational state management

Runtimes register with the Process Orchestration Layer when started.

Runtime configuration defines:

• device integrations
• subsystem capabilities
• communication endpoints
• digital twin models

---

# 10. Distributed Communication Infrastructure

The platform relies on several infrastructure layers.

### Secure Host Networking

Runtime nodes communicate through a secure overlay network.

### Service Access Enforcement

Service-level access is controlled through zero-trust identity policies.

### Event and Data Fabric

Telemetry, configuration, and system events are distributed across the platform through a scalable messaging fabric.

### Orchestration Interfaces

Subsystem state and procedures are exposed through standardized orchestration interfaces.

---

# 11. Capability Discovery

PEAs advertise their capabilities to the orchestration layer.

Capabilities describe the functions provided by a subsystem.

Examples include:

fluid_distribution
robotic_manipulation
energy_storage
environmental_regulation

Capabilities are used to construct a **Facility Capability Graph** describing how subsystems interact.

---

# 12. Self-Assembling Automation

The platform supports dynamic system composition.

When a new PEA runtime starts:

1. it registers with the orchestration layer
2. it publishes its capabilities
3. the orchestration layer integrates it into the facility model

Procedures may be automatically recomposed to include newly discovered subsystems.

This allows facilities to evolve without requiring full system redesign.

---

# 13. Actor Interaction Model

Actors interact with the system at different control levels.

### Observational

Actors read telemetry and system state.

### Advisory

Actors submit intents suggesting system behavior.

### Supervisory

Actors may approve or reject system actions.

### Direct Authority

Actors may directly command subsystems when granted control authority.

Authority levels depend on operational state and system policy.

---

# 14. Safety Model

Safety is enforced through multiple layers.

Machine semantics prevent unsafe commands.

Service enforcement prevents unauthorized access.

Digital twin simulation evaluates proposed actions.

Runtime validation ensures safe command execution.

These mechanisms ensure that system safety is preserved even in the presence of multiple interacting actors.

---

# 15. System Benefits

This architecture provides several advantages.

### Safe AI Integration

Artificial intelligence systems can interact with automation infrastructure without compromising safety.

### Modular Automation

Subsystems can be deployed and replaced independently.

### Dynamic System Composition

Facilities can grow organically as new subsystems are introduced.

### Deterministic Operation

Machine behavior remains predictable and traceable.

---

# 16. Summary

This platform architecture enables distributed automation systems where:

• automation subsystems are modular PEAs
• orchestration is centralized in the POL
• control authority governs command access
• external actors influence behavior through intents
• digital twins validate system actions
• new subsystems integrate automatically

The result is a **scalable, secure, and adaptive automation platform capable of supporting complex physical infrastructure with human and AI collaboration**.

Below is a **reference architecture diagram and control loop hierarchy** that visually summarizes the system described in your specification. It shows how **human operators, AI systems, intents, orchestration, digital twins, PEAs, and physical devices** interact.

---

# Reference Architecture

## Intent-Driven Modular Automation Platform

```
                      ┌───────────────────────────────────────────┐
                      │              HUMAN OPERATORS               │
                      │                AI SYSTEMS                  │
                      │          SCHEDULERS / OPTIMIZERS           │
                      └───────────────────────────────────────────┘
                                       │
                                       │  Intents / Requests
                                       ▼
                ┌───────────────────────────────────────────────┐
                │             INTENT INTERFACE LAYER             │
                │                                               │
                │  • Intent Submission API                      │
                │  • Actor Authentication                       │
                │  • Intent Registry                            │
                │  • Intent Prioritization                      │
                └───────────────────────────────────────────────┘
                                       │
                                       ▼
                ┌───────────────────────────────────────────────┐
                │          PROCESS ORCHESTRATION LAYER (POL)     │
                │                                               │
                │  • Intent Evaluation Engine                    │
                │  • Command Authority Service                   │
                │  • Procedure Composer                          │
                │  • Facility Capability Graph                   │
                │  • System State Management                     │
                └───────────────────────────────────────────────┘
                                       │
                                       │ Proposed Control Plan
                                       ▼
                ┌───────────────────────────────────────────────┐
                │           DIGITAL TWIN ARBITRATION             │
                │                                               │
                │  • Facility Simulation                         │
                │  • PEA Twin Models                             │
                │  • Safety Verification                         │
                │  • Outcome Prediction                          │
                │                                               │
                │      Decision: APPROVE / MODIFY / REJECT      │
                └───────────────────────────────────────────────┘
                                       │
                                       ▼
                ┌───────────────────────────────────────────────┐
                │           COMMAND AUTHORITY ENFORCEMENT        │
                │                                               │
                │  • Authority Mode Evaluation                   │
                │  • Actor Permission Verification               │
                │  • Command Ownership                           │
                │                                               │
                │  OpenZiti Policy Enforcement                   │
                └───────────────────────────────────────────────┘
                                       │
                                       ▼
                ┌───────────────────────────────────────────────┐
                │                PEA RUNTIME LAYER               │
                │                                               │
                │  • Procedure Execution                         │
                │  • Runtime Command Validation                  │
                │  • Canonical Tag Model                         │
                │  • Device Protocol Integration                 │
                │  • Telemetry Publication                       │
                └───────────────────────────────────────────────┘
                                       │
                                       ▼
                ┌───────────────────────────────────────────────┐
                │              PHYSICAL DEVICES                  │
                │                                               │
                │  Valves / Pumps / Robots / Sensors / Motors   │
                │  Climate Systems / Energy Systems / etc.      │
                └───────────────────────────────────────────────┘
                                       │
                                       │ Telemetry
                                       ▼
                ┌───────────────────────────────────────────────┐
                │               DATA FABRIC                      │
                │                                               │
                │  Zenoh Event Mesh                              │
                │  Telemetry Streams                             │
                │  State Synchronization                         │
                └───────────────────────────────────────────────┘
                                       │
                                       ▼
                           POL + Digital Twin Update
```

---

# Control Loop Hierarchy

The architecture intentionally separates **four different control loops**, each operating at a different timescale and abstraction level.

```
┌──────────────────────────────────────────────┐
│                 INTENT LOOP                  │
│                                              │
│  Humans / AI define desired outcomes         │
│                                              │
│  Example:                                    │
│  "Reduce water consumption 5%"               │
│                                              │
│  Timescale: minutes to hours                 │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│              OPTIMIZATION LOOP               │
│                                              │
│  POL evaluates intents and selects strategies│
│  Digital Twin predicts system response       │
│                                              │
│  Timescale: minutes                          │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│               PROCEDURE LOOP                 │
│                                              │
│  POL composes procedures across PEAs         │
│                                              │
│  Example:                                    │
│  Irrigation Cycle                            │
│  Nutrient Mixing                             │
│  Climate Stabilization                       │
│                                              │
│  Timescale: seconds to minutes               │
└──────────────────────────────────────────────┘
                    │
                    ▼
┌──────────────────────────────────────────────┐
│                 CONTROL LOOP                 │
│                                              │
│  Local device control                        │
│  PID loops / motor control / valve control   │
│                                              │
│  Executed inside PEA runtime or PLC          │
│                                              │
│  Timescale: milliseconds                     │
└──────────────────────────────────────────────┘
```

---

# Infrastructure Layers

Supporting infrastructure enables the control architecture.

```
Nebula
   │
   ├── Secure host networking
   │
OpenZiti
   │
   ├── Zero-trust service access enforcement
   │
Zenoh
   │
   ├── Event mesh and data distribution
   │
PEA Runtime
   │
   ├── Device integration and procedure execution
   │
POL
   │
   ├── Orchestration, digital twin, and intent engine
```

# Conceptual Summary

This architecture separates **decision making, orchestration, and physical control**.

| Layer               | Responsibility            |
| ------------------- | ------------------------- |
| Intent Layer        | Defines goals             |
| Orchestration Layer | Determines system actions |
| Digital Twin        | Validates actions         |
| Authority Layer     | Determines who may act    |
| Execution Layer     | Performs procedures       |
| Device Layer        | Executes control loops    |

This separation enables:

• safe integration of AI systems
• deterministic machine operation
• modular automation subsystems
• dynamic facility composition

---

Great idea — this diagram makes the **PEA the central engineering artifact**, which is exactly how your architecture works. It shows how **device drivers, data fabric, orchestration interfaces, digital twin models, and command enforcement** all live inside a PEA runtime.

---

# Packaged Equipment Assembly (PEA) Reference Architecture

```
                    ┌───────────────────────────────────────┐
                    │        PROCESS ORCHESTRATION LAYER     │
                    │                 (POL)                  │
                    │                                       │
                    │   • Procedure Orchestration            │
                    │   • Intent Evaluation                  │
                    │   • Command Authority Service          │
                    │   • Facility Capability Graph          │
                    └───────────────▲───────────────────────┘
                                    │
                                    │ OPC UA / MTP Interface
                                    │
┌───────────────────────────────────┼───────────────────────────────────┐
│                           PEA RUNTIME                                 │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐     │
│   │                   COMMAND SERVICE LAYER                     │     │
│   │                                                             │     │
│   │   • Command API                                             │     │
│   │   • Procedure Execution                                     │     │
│   │   • Command Ownership                                       │     │
│   │   • Runtime Validation                                      │     │
│   │                                                             │     │
│   │   Services                                                  │     │
│   │     /observe                                                │     │
│   │     /command                                                │     │
│   │     /diagnostics                                            │     │
│   │     /engineering                                            │     │
│   │     /advisory                                               │     │
│   └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐     │
│   │                 CANONICAL TAG MODEL                         │     │
│   │                                                             │     │
│   │   Unified internal representation of process variables      │     │
│   │                                                             │     │
│   │   Tag Attributes                                            │     │
│   │     id                                                      │     │
│   │     engineering_unit                                        │     │
│   │     timestamp                                               │     │
│   │     data_quality                                            │     │
│   │     alarm_limits                                            │     │
│   │     write_permissions                                       │     │
│   │                                                             │     │
│   │   Used by:                                                  │     │
│   │     telemetry publishing                                    │     │
│   │     command execution                                       │     │
│   │     twin models                                             │     │
│   └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐     │
│   │                    DIGITAL TWIN MODEL                       │     │
│   │                                                             │     │
│   │   Simulated representation of subsystem behavior            │     │
│   │                                                             │     │
│   │   Examples                                                  │     │
│   │     irrigation response                                     │     │
│   │     thermal dynamics                                        │     │
│   │     hydraulic flow                                          │     │
│   │                                                             │     │
│   │   Used by                                                   │     │
│   │     facility digital twin                                   │     │
│   │     intent arbitration                                      │     │
│   │     optimization testing                                    │     │
│   └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐     │
│   │                     ZENOH INTERFACE                         │     │
│   │                                                             │     │
│   │   Distributed data fabric interface                         │     │
│   │                                                             │     │
│   │   Namespaces                                                │     │
│   │     greenhouse/pea_id/telemetry/*                           │     │
│   │     greenhouse/pea_id/commands/*                            │     │
│   │     greenhouse/pea_id/config/*                              │     │
│   │     greenhouse/pea_id/alarms/*                              │     │
│   │     greenhouse/pea_id/health/*                              │     │
│   │                                                             │     │
│   │   Responsibilities                                          │     │
│   │     publish telemetry                                       │     │
│   │     receive commands                                        │     │
│   │     broadcast subsystem state                               │     │
│   └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐     │
│   │                    OPC UA SERVER                            │     │
│   │                                                             │     │
│   │   MTP-compatible orchestration interface                    │     │
│   │                                                             │     │
│   │   Exposes                                                   │     │
│   │     operational state                                       │     │
│   │     commands                                                │     │
│   │     procedures                                              │     │
│   │     alarms                                                  │     │
│   │     diagnostics                                             │     │
│   └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
│   ┌─────────────────────────────────────────────────────────────┐     │
│   │                    NEURON DEVICE LAYER                      │     │
│   │                                                             │     │
│   │   Southbound device connectivity                            │     │
│   │                                                             │     │
│   │   Supported protocols                                       │     │
│   │     Modbus                                                  │     │
│   │     OPC UA Client                                           │     │
│   │     BACnet                                                  │     │
│   │     EtherNet/IP                                             │     │
│   │     Vendor protocols                                        │     │
│   │                                                             │     │
│   │   Converts device data into canonical tag model             │     │
│   └─────────────────────────────────────────────────────────────┘     │
│                                                                       │
└───────────────────────────────▼───────────────────────────────────────┘
                                │
                                │ Physical I/O
                                │
                        ┌───────────────────┐
                        │   PHYSICAL        │
                        │   DEVICES         │
                        │                   │
                        │ valves            │
                        │ pumps             │
                        │ sensors           │
                        │ actuators         │
                        │ robots            │
                        └───────────────────┘
```

---

# Runtime Infrastructure Around the PEA

Each PEA runtime operates within the distributed platform infrastructure.

```
                    ┌──────────────────────────────┐
                    │           POL SERVER         │
                    │                              │
                    │  • Intent Engine             │
                    │  • Digital Twin              │
                    │  • Command Authority         │
                    │  • Capability Graph          │
                    │                              │
                    │  Zenoh Router                │
                    │  Nebula Lighthouse           │
                    │  OpenZiti Controller         │
                    └──────────────▲───────────────┘
                                   │
                                   │
                ┌──────────────────┴──────────────────┐
                │                                     │
       ┌─────────────────────┐              ┌─────────────────────┐
       │   PEA Runtime Node   │              │   PEA Runtime Node   │
       │                     │              │                     │
       │  PEA Instance A     │              │  PEA Instance B     │
       │                     │              │                     │
       │  Neuron Drivers     │              │  Neuron Drivers     │
       │  Zenoh Client       │              │  Zenoh Client       │
       │  OPC UA Server      │              │  OPC UA Server      │
       └─────────────────────┘              └─────────────────────┘
```

---

# Conceptual Role of a PEA

A **PEA is the atomic unit of automation** in this architecture.

Each PEA encapsulates:

• device integration
• subsystem behavior
• telemetry
• control procedures
• digital twin model
• orchestration interface

This allows automation systems to be built from **modular components rather than monolithic control systems**.

---

# Why This Structure Works Well

This architecture cleanly separates responsibilities:

| Layer            | Responsibility          |
| ---------------- | ----------------------- |
| Device Layer     | physical control        |
| Neuron           | protocol abstraction    |
| Canonical Tags   | internal data model     |
| Command Services | subsystem behavior      |
| Zenoh            | distributed telemetry   |
| OPC UA           | orchestration interface |
| Digital Twin     | predictive validation   |

---

Excellent — this final diagram ties **everything together** so a reader can understand the entire architecture in one view. Think of it as **Figure 1: System Architecture Overview** for the specification or a whitepaper.

---

# Unified System Architecture

## Intent-Driven Modular Automation Platform

```
                                     ┌──────────────────────────────┐
                                     │        HUMAN OPERATORS       │
                                     │                              │
                                     │   HMIs / Engineering Tools   │
                                     └───────────────┬──────────────┘
                                                     │
                                                     │
                                     ┌───────────────▼──────────────┐
                                     │          AI SYSTEMS           │
                                     │                               │
                                     │  Optimization / Vision / ML   │
                                     └───────────────┬──────────────┘
                                                     │
                                                     │ Intents / Requests
                                                     ▼
                      ┌──────────────────────────────────────────────────────────┐
                      │                    INTENT INTERFACE                       │
                      │                                                          │
                      │  • Intent Submission API                                  │
                      │  • Actor Authentication                                   │
                      │  • Intent Registry                                       │
                      │  • Priority and Conflict Resolution                      │
                      └───────────────────────┬──────────────────────────────────┘
                                              │
                                              ▼
                      ┌──────────────────────────────────────────────────────────┐
                      │            PROCESS ORCHESTRATION LAYER (POL)             │
                      │                                                          │
                      │  • Intent Evaluation Engine                              │
                      │  • Command Authority Service                             │
                      │  • Procedure Composer                                    │
                      │  • Facility Capability Graph                             │
                      │  • Runtime Registry                                      │
                      │                                                          │
                      │  Infrastructure Services                                 │
                      │     Zenoh Router                                         │
                      │     Nebula Lighthouse                                    │
                      │     OpenZiti Controller                                  │
                      └───────────────┬──────────────────────────────────────────┘
                                      │
                                      │ Proposed Control Plans
                                      ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │                DIGITAL TWIN ARBITRATION                     │
                    │                                                             │
                    │  • Facility Simulation                                      │
                    │  • PEA Twin Models                                          │
                    │  • Safety Verification                                      │
                    │  • Outcome Prediction                                       │
                    │                                                             │
                    │        Decision: APPROVE / MODIFY / REJECT                 │
                    └───────────────┬─────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────────────────────────────┐
                    │            COMMAND AUTHORITY ENFORCEMENT                    │
                    │                                                             │
                    │  • Authority Mode Evaluation                                │
                    │  • Actor Permission Verification                            │
                    │  • Command Ownership                                        │
                    │                                                             │
                    │  OpenZiti Zero-Trust Policy Enforcement                     │
                    └───────────────┬─────────────────────────────────────────────┘
                                    │
                                    ▼
         ┌─────────────────────────────────────────────────────────────────────────────┐
         │                          DISTRIBUTED PEA RUNTIME LAYER                       │
         │                                                                             │
         │  ┌──────────────────────────┐   ┌──────────────────────────┐                │
         │  │        PEA Runtime       │   │        PEA Runtime       │                │
         │  │        Node A            │   │        Node B            │                │
         │  │                          │   │                          │                │
         │  │  Neuron Device Drivers   │   │  Neuron Device Drivers   │                │
         │  │  Canonical Tag Model     │   │  Canonical Tag Model     │                │
         │  │  Command Services        │   │  Command Services        │                │
         │  │  Digital Twin Model      │   │  Digital Twin Model      │                │
         │  │  Zenoh Client            │   │  Zenoh Client            │                │
         │  │  OPC UA Server           │   │  OPC UA Server           │                │
         │  └───────────────┬──────────┘   └───────────────┬──────────┘                │
         │                  │                              │                           │
         └──────────────────┼──────────────────────────────┼───────────────────────────┘
                            │                              │
                            ▼                              ▼
                   ┌────────────────┐             ┌────────────────┐
                   │ PHYSICAL       │             │ PHYSICAL       │
                   │ DEVICES        │             │ DEVICES        │
                   │                │             │                │
                   │ valves         │             │ pumps          │
                   │ motors         │             │ sensors        │
                   │ robots         │             │ climate units  │
                   └────────────────┘             └────────────────┘
```

---

# Control Loop Hierarchy

This system operates across **four nested control loops**, each responsible for a different decision level.

```
┌───────────────────────────────────────────────────────────┐
│                    INTENT LOOP                            │
│                                                           │
│  Humans / AI define desired outcomes                      │
│                                                           │
│  Example:                                                 │
│  "Reduce energy consumption by 10%"                       │
│                                                           │
│  Timescale: minutes to hours                              │
└───────────────────────────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────┐
│                  OPTIMIZATION LOOP                        │
│                                                           │
│  POL evaluates intents and strategies                     │
│  Digital Twin simulates outcomes                          │
│                                                           │
│  Timescale: minutes                                       │
└───────────────────────────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────┐
│                   PROCEDURE LOOP                          │
│                                                           │
│  POL composes procedures across PEAs                      │
│                                                           │
│  Example:                                                 │
│  irrigation_cycle                                         │
│  climate_stabilization                                    │
│                                                           │
│  Timescale: seconds                                       │
└───────────────────────────────────────────────────────────┘
                           │
                           ▼
┌───────────────────────────────────────────────────────────┐
│                     CONTROL LOOP                          │
│                                                           │
│  Local device control                                     │
│  PID loops / motor control / valve control                │
│                                                           │
│  Executed inside PEA runtime or PLC                       │
│                                                           │
│  Timescale: milliseconds                                  │
└───────────────────────────────────────────────────────────┘
```

---

# Infrastructure Layers Supporting the System

```
Nebula
   │
   ├─ Secure host networking
   │
OpenZiti
   │
   ├─ Zero-trust service access enforcement
   │
Zenoh
   │
   ├─ Event mesh / telemetry distribution
   │
PEA Runtime
   │
   ├─ Device integration and procedures
   │
POL
   │
   ├─ orchestration / intent engine / digital twin
```

---

# Conceptual Summary

The architecture intentionally separates **four concerns**:

| Layer               | Responsibility   |
| ------------------- | ---------------- |
| Intent Layer        | defines goals    |
| Orchestration Layer | decides actions  |
| Simulation Layer    | validates safety |
| Execution Layer     | controls devices |

This separation allows:

• **safe AI integration**
• **deterministic machine control**
• **modular subsystem deployment**
• **dynamic facility composition**

Excellent — this is the **semantic layer** that makes the whole architecture actually work across vendors and domains. Without it, self-assembly and capability discovery become brittle because every PEA would describe its functions differently.

What we’re defining here is a **PEA Capability Ontology**: a standardized vocabulary and structure that describes what a PEA *can do*, what it *requires*, and how it *connects to other PEAs*.

This allows the POL to automatically compose subsystems.

---

# Functional Specification

## PEA Capability Ontology

Section: 37
Version: Draft 1.0

---

# 37. Purpose

The PEA Capability Ontology defines the semantic model used to describe automation capabilities provided by Packaged Equipment Assemblies (PEAs).

The ontology enables:

• automatic subsystem discovery
• dynamic procedure composition
• cross-vendor interoperability
• self-assembling automation systems

Each PEA declares its capabilities using a standardized vocabulary.

The Process Orchestration Layer (POL) uses this information to construct the **Facility Capability Graph** and orchestrate procedures across PEAs.

---

# 38. Capability Model Overview

Each PEA publishes a **Capability Declaration** describing:

• functional capabilities
• provided interfaces
• required dependencies
• operational constraints
• physical connections

Capability declarations are published through the system data fabric and registered by the POL.

---

# 39. Capability Declaration Structure

A capability declaration includes the following elements.

```
PEA Identity
Capability List
Provided Services
Required Inputs
Produced Outputs
Operational Constraints
Digital Twin Model Reference
Version Metadata
```

Example declaration:

```
pea_id: irrigation_zone_7

capabilities:
  - fluid_distribution
  - irrigation_control

inputs:
  - nutrient_solution
  - control_commands

outputs:
  - water_flow
  - moisture_measurements

constraints:
  max_pressure: 8 bar
  max_flow_rate: 25 L/min
```

---

# 40. Capability Categories

Capabilities are organized into broad functional categories.

### Actuation Capabilities

Subsystems capable of affecting the physical environment.

Examples:

• fluid_distribution
• mechanical_motion
• valve_control
• energy_transfer
• robotic_manipulation

---

### Sensing Capabilities

Subsystems capable of measuring environmental or system conditions.

Examples:

• temperature_sensing
• pressure_sensing
• flow_measurement
• visual_inspection
• vibration_monitoring

---

### Processing Capabilities

Subsystems capable of transforming materials or information.

Examples:

• nutrient_mixing
• water_filtration
• chemical_reaction
• material_transport

---

### Infrastructure Capabilities

Subsystems that support facility operation.

Examples:

• energy_storage
• network_routing
• climate_regulation
• safety_monitoring

---

# 41. Capability Interfaces

Capabilities expose standardized interfaces.

Interfaces define how other PEAs interact with the subsystem.

Interface types include:

| Interface   | Purpose                 |
| ----------- | ----------------------- |
| Command     | control operations      |
| Telemetry   | measurement data        |
| Procedure   | orchestrated operations |
| Diagnostics | system health           |
| Engineering | configuration           |

Example interface definition:

```
interface: fluid_distribution

commands:
  open_valve
  close_valve
  set_flow_rate

telemetry:
  flow_rate
  pressure
```

---

# 42. Capability Inputs and Outputs

Each capability defines the resources it consumes and produces.

### Inputs

Inputs represent required resources.

Examples:

• fluid supply
• electrical power
• command signals
• upstream process output

### Outputs

Outputs represent resources generated by the subsystem.

Examples:

• processed materials
• environmental changes
• telemetry data

Example:

```
capability: nutrient_mixing

inputs:
  water
  nutrient_concentrate

outputs:
  nutrient_solution
```

---

# 43. Capability Constraints

Capabilities may define operational constraints.

Examples include:

• maximum flow rate
• allowable temperature range
• energy limits
• safety thresholds

Constraints are used by the POL when composing procedures.

Example:

```
constraints:
  max_temperature: 80C
  max_flow_rate: 50 L/min
```

---

# 44. Capability Compatibility

The POL determines subsystem compatibility by matching outputs to inputs.

Example:

```
nutrient_mixer.output → nutrient_solution
irrigation_controller.input → nutrient_solution
```

This relationship allows the POL to automatically connect the two PEAs in a procedure.

---

# 45. Facility Capability Graph

The POL constructs a **Facility Capability Graph**.

Nodes represent:

• PEAs
• capabilities
• resources

Edges represent:

• resource flow
• control dependencies
• physical connections

Example graph:

```
water_supply
     ↓
nutrient_mixer
     ↓
irrigation_controller
     ↓
crop_zone
```

This graph is updated dynamically as PEAs join or leave the system.

---

# 46. Capability Composition

The POL composes higher-level procedures using capability relationships.

Example procedure:

```
fertigation_cycle
```

Required capabilities:

• water_supply
• nutrient_mixing
• fluid_distribution
• moisture_measurement

The POL identifies PEAs providing each capability and generates an execution plan.

---

# 47. Cross-Vendor Interoperability

Because capability descriptions use standardized vocabulary, PEAs from different vendors can interoperate.

Example scenario:

Vendor A provides:

```
nutrient_mixing
```

Vendor B provides:

```
fluid_distribution
```

The POL composes these subsystems automatically.

---

# 48. Capability Versioning

Capabilities include version information.

Example:

```
capability: fluid_distribution
version: 2.1
```

Versioning ensures compatibility when systems evolve.

---

# 49. Capability Ontology Governance

The ontology vocabulary must be governed to ensure consistency.

Governance responsibilities include:

• defining standard capability names
• approving new capability types
• maintaining compatibility rules
• publishing ontology updates

Ontology definitions may be stored in a central repository.

---

# 50. Example Capability Declaration

Example PEA declaration:

```
pea_id: pump_station_3

capabilities:
  - fluid_transport
  - pressure_generation

inputs:
  water

outputs:
  pressurized_water

constraints:
  max_pressure: 12 bar
  max_flow_rate: 120 L/min

interfaces:
  commands:
    start_pump
    stop_pump

  telemetry:
    pressure
    flow_rate
```

---

# 51. Ontology Benefits

The PEA Capability Ontology provides several advantages.

### Automatic System Composition

Subsystems can integrate without manual configuration.

### Cross-Vendor Compatibility

Subsystems from different vendors interoperate.

### Dynamic Facility Evolution

Facilities can grow organically as new PEAs are introduced.

### Semantic Clarity

Subsystem capabilities are described consistently across the system.

---

# 52. Summary

The PEA Capability Ontology defines the semantic framework that enables modular automation systems to assemble dynamically.

By standardizing capability descriptions, the system enables:

• automated subsystem discovery
• dynamic procedure composition
• cross-vendor interoperability
• scalable automation architecture

This ontology forms the semantic foundation of the modular automation platform.




This section defines the **Command Authority and Zero-Trust Enforcement Model** using:

* **MTP / OPC UA** for operational semantics
* **OpenZiti** for service-level enforcement
* **Nebula** for host networking
* **Zenoh** for state/event propagation
* **PEA runtimes** for final command validation

---

# Functional Specification

## Command Authority and Zero-Trust Enforcement

Version: Draft 1.0

---

# 19. Command Authority Model

## 19.1 Purpose

The Command Authority Model defines how multiple actors — including humans, automation procedures, and AI systems — interact with controllable assets within a PEA.

The system shall support scenarios in which multiple actors may attempt to control the same asset concurrently while ensuring that:

• operational safety is preserved
• machine state semantics are respected
• command arbitration is deterministic
• unauthorized command sources are blocked

Authority decisions are determined by **PEA operational state and MTP semantics** and enforced through **OpenZiti service access policies**.

---

# 19.2 Actor Classes

The system shall support multiple classes of command actors.

Example actor classes include:

| Actor Class           | Description                                        |
| --------------------- | -------------------------------------------------- |
| Human Operator        | Operator HMI or manual supervisory control         |
| Maintenance Engineer  | Engineering access for diagnostics and calibration |
| Procedure Engine      | POL orchestration logic executing procedures       |
| AI Optimization Model | AI system optimizing process behavior              |
| AI Vision Model       | AI system observing physical conditions            |
| AI Predictive Model   | AI system predicting faults or failures            |

Each actor is represented by a **network identity** in OpenZiti.

---

# 19.3 Commandable Assets

A commandable asset is any device or subsystem capable of receiving control commands.

Examples include:

• valves
• pumps
• motors
• lighting systems
• climate control units
• robotic systems
• dosing systems

Each asset exists within a **PEA runtime** and exposes command services.

---

# 19.4 Authority Determination

Authority is determined by the **PEA operational state** and **control mode**.

Control modes are represented using OPC UA state variables consistent with MTP orchestration semantics.

Example control modes include:

| Mode                 | Description                                        |
| -------------------- | -------------------------------------------------- |
| ObserveOnly          | No actor may issue commands                        |
| OperatorExclusive    | Human operator has command authority               |
| AutoExclusive        | POL procedure engine controls subsystem            |
| AIAssisted           | AI models may recommend actions but cannot actuate |
| AIExclusive          | Approved AI identity controls subsystem            |
| MaintenanceExclusive | Maintenance engineers have exclusive access        |
| EmergencyLockout     | No remote commands permitted                       |

The current mode is published through:

• OPC UA variables
• Zenoh state events

---

# 20. Enforcement Architecture

Command authority enforcement occurs at three layers.

---

# 20.1 Layer 1 — Machine Semantics (MTP / OPC UA)

The PEA runtime exposes machine state and command interfaces through OPC UA.

OPC UA provides:

• operational state
• control mode
• command methods
• procedures
• interlock status

These elements represent the **authoritative machine state**.

The POL reads these states to determine system behavior.

---

# 20.2 Layer 2 — Service Access Enforcement (OpenZiti)

OpenZiti enforces which actors may access command services.

OpenZiti identities represent:

• operator workstations
• AI models
• maintenance tools
• orchestration engines

Each command surface is exposed as a **named OpenZiti service**.

Example services:

```
pea/zone7/valve23/observe
pea/zone7/valve23/command
pea/zone7/valve23/diagnostics
pea/zone7/valve23/engineering
pea/zone7/valve23/advisory
```

Access to each service is governed by OpenZiti policy.

Policy updates occur dynamically based on system mode.

---

# 20.3 Layer 3 — Runtime Command Validation

Even when network access is granted, the PEA runtime must validate commands before execution.

Validation checks include:

• operational mode
• command source identity
• procedure ownership
• interlock conditions
• safety constraints

Commands violating these rules shall be rejected.

This provides a final protection layer.

---

# 21. Command Arbitration Workflow

## 21.1 Authority Change Event

When machine state changes:

1. PEA runtime updates OPC UA state
2. State event published via Zenoh
3. Command Authority Service detects change
4. OpenZiti policy updated
5. Access to command services adjusted

---

## 21.2 Example Scenario: Operator Control

Initial state:

```
Mode = OperatorExclusive
```

Allowed actors:

• human.operator

Denied actors:

• AI models
• procedure engines

OpenZiti policy:

```
ALLOW human.operator → valve-command
DENY ai.* → valve-command
```

---

## 21.3 Example Scenario: Automated Procedure

Mode changes:

```
Mode = AutoExclusive
```

Authority:

• procedure engine

OpenZiti policy:

```
ALLOW pol.procedure-engine → valve-command
DENY human.operator → valve-command
DENY ai.* → valve-command
```

---

## 21.4 Example Scenario: AI Optimization

Mode changes:

```
Mode = AIExclusive
```

Authority:

• ai.optimizer.primary

OpenZiti policy:

```
ALLOW ai.optimizer.primary → valve-command
DENY all other actors
```

---

# 22. Service Exposure Model

Each commandable asset shall expose multiple service types.

| Service     | Purpose                       |
| ----------- | ----------------------------- |
| Observe     | telemetry and state access    |
| Command     | actuation commands            |
| Advisory    | AI suggestions                |
| Diagnostics | health and troubleshooting    |
| Engineering | configuration and calibration |

This separation ensures precise access control.

---

# 23. Command Authority Service

The system includes a **Command Authority Service** within the POL.

Responsibilities include:

• tracking current authority state
• mapping state to OpenZiti policy
• coordinating authority changes
• logging command ownership
• resolving command conflicts

---

# 24. Command Ownership

When a command session begins, the system may grant temporary ownership.

Ownership includes:

• actor identity
• start timestamp
• expiration timeout
• asset identifier

Ownership may automatically expire if activity stops.

---

# 25. AI Interaction Modes

AI systems interact with PEAs in one of three modes.

### Advisory Mode

AI may propose commands but cannot execute them.

### Assisted Mode

AI commands require operator confirmation.

### Autonomous Mode

AI commands may be executed automatically.

Authority mode determines which mode is active.

---

# 26. Security Model

Security is layered across the system.

| Layer           | Technology  |
| --------------- | ----------- |
| Host Network    | Nebula      |
| Service Network | OpenZiti    |
| Data Fabric     | Zenoh       |
| Orchestration   | OPC UA      |
| Execution       | PEA Runtime |

Nebula provides encrypted host connectivity.

OpenZiti provides service-level zero-trust enforcement.

---

# 27. Safety Requirements

The system shall enforce the following safety rules:

• network access control cannot override machine safety interlocks
• command validation occurs inside the PEA runtime
• authority transitions are logged
• unauthorized command attempts are rejected and recorded

---

# 28. Audit and Logging

The system shall record:

• command source identity
• command timestamp
• machine state at time of command
• result of command execution
• authority state

Logs shall be accessible for diagnostics and compliance.

---

# 29. Summary

This architecture provides a deterministic command arbitration model where:

• **MTP / OPC UA defines operational semantics**
• **OpenZiti enforces service-level access control**
• **PEA runtime validates commands at execution**

The result is a system capable of safely supporting concurrent actors including:

• humans
• automation procedures
• AI systems

while maintaining deterministic and secure control of physical assets.

Love this direction. What you’re proposing is essentially **intent-based industrial control**, which is a very natural evolution once you have PEAs, orchestration, and multiple actors (humans + AI). It also neatly solves the “three AIs and a human fighting over a valve” problem by **removing direct actuator control from most actors entirely**.

Below is the **final section of the functional specification** that adds **Intent-Based Control for PEAs**.

---

# Functional Specification

## Intent-Based Control for PEAs

Section: 30
Version: Draft 1.0

---

# 30. Intent-Based Control Architecture

## 30.1 Purpose

Intent-Based Control provides a mechanism for actors — including AI systems, optimization engines, and supervisory operators — to influence system behavior **without directly actuating physical devices**.

Instead of issuing commands to actuators such as valves or pumps, actors submit **intents** describing desired outcomes.

The Process Orchestration Layer (POL) evaluates these intents and translates them into:

• procedures
• command sequences
• configuration adjustments

This approach improves safety, coordination, and traceability while enabling advanced optimization and AI participation in automation systems.

---

# 30.2 Design Goals

The Intent-Based Control system shall achieve the following goals:

• prevent uncontrolled actuator access by external systems
• enable AI-driven optimization without compromising safety
• centralize control arbitration in the POL
• preserve deterministic machine semantics defined by PEAs
• maintain clear traceability of system decisions

---

# 30.3 Intent Definition

An **Intent** is a declarative request describing a desired system outcome.

An intent does not specify:

• specific actuator commands
• exact device operations
• low-level control steps

Instead, the intent describes a **goal state**.

---

## Example Intents

Examples include:

Increase zone humidity to 70 percent

Reduce nutrient consumption by 5 percent

Stabilize temperature within acceptable range

Minimize energy usage while maintaining production targets

Flush irrigation line

Recover subsystem from fault

Each intent may include:

• target subsystem
• objective
• priority
• constraints
• expiration time

---

# 30.4 Intent Submission

Actors submit intents through the **Intent Interface** exposed by the POL.

Intent messages may arrive from:

• human operators
• AI optimization models
• predictive maintenance systems
• facility management systems
• scheduling systems

Intent submission occurs through:

• Zenoh services
• POL API endpoints
• operator HMI interfaces

---

# 30.5 Intent Message Structure

Example intent message:

```
intent_id: INT-00943
source: ai.optimizer.primary
target_pea: irrigation_zone_7
objective: reduce_water_consumption
constraints:
  humidity_min: 60
  humidity_max: 75
priority: medium
expiration: 2h
```

The intent is recorded in the POL Intent Registry.

---

# 30.6 Intent Registry

The POL maintains an **Intent Registry** containing active intents.

Each registry entry contains:

Intent ID
Source identity
Target subsystem
Objective
Constraints
Priority
Timestamp
Expiration time
Current status

Intent status values include:

• Pending
• Evaluating
• Accepted
• Rejected
• Executing
• Completed
• Expired

---

# 30.7 Intent Evaluation Engine

The POL includes an **Intent Evaluation Engine** responsible for analyzing incoming intents.

The evaluation engine performs:

• conflict detection
• constraint verification
• safety checks
• priority resolution
• compatibility with current machine state

The engine may reject intents that violate:

• safety limits
• machine interlocks
• operational mode constraints

---

# 30.8 Intent Conflict Resolution

Multiple intents may target the same subsystem simultaneously.

The system resolves conflicts using:

• priority level
• actor authority
• subsystem state
• safety rules

Example:

AI optimizer intent:

```
reduce_water_consumption
```

Operator intent:

```
increase irrigation for crop recovery
```

Operator intent may override AI intent based on authority class.

---

# 30.9 Intent Translation

Once accepted, the intent is translated into an executable control plan.

This plan may consist of:

• procedure invocation
• setpoint adjustments
• actuator command sequences
• multi-PEA orchestration

The resulting actions are executed through standard PEA command interfaces.

---

# 30.10 Example Intent Workflow

### Step 1 — Intent Submission

AI optimizer submits:

```
reduce_water_consumption 5 percent
```

---

### Step 2 — Intent Evaluation

POL verifies:

• irrigation PEA operational state
• crop safety constraints
• humidity minimum limits

---

### Step 3 — Intent Translation

POL selects strategy:

Reduce irrigation frequency by 10 percent.

---

### Step 4 — Procedure Invocation

POL invokes irrigation procedure:

```
adjust_irrigation_schedule
```

---

### Step 5 — PEA Execution

The irrigation PEA executes commands internally.

---

### Step 6 — Monitoring

Results are monitored through telemetry.

Intent status transitions to:

```
Executing → Completed
```

---

# 30.11 AI Interaction Modes

AI systems interact with the automation platform through three control levels.

### Level 1 — Observational

AI reads telemetry only.

---

### Level 2 — Advisory

AI submits intents but cannot directly actuate equipment.

---

### Level 3 — Autonomous

AI intents may be automatically translated into control procedures.

Authorization level is determined through the **Command Authority Model**.

---

# 30.12 Intent Scope

Intents may target:

• a single device
• a PEA subsystem
• multiple PEAs
• an entire facility

Examples:

Increase temperature in zone 4.

Optimize energy usage across facility.

Flush irrigation subsystem.

Recover subsystem from failure.

---

# 30.13 Intent Safety Boundaries

The system shall enforce the following safety rules:

• intents cannot bypass machine safety interlocks
• intents cannot override emergency states
• intents cannot execute commands outside PEA-defined procedures

All execution occurs through validated PEA interfaces.

---

# 30.14 Intent Visibility

Operators must be able to view:

• active intents
• source of intent
• system evaluation decisions
• resulting actions

Intent activity shall be visible through the operator interface.

---

# 30.15 Intent Logging

The system shall log:

• intent source identity
• intent parameters
• evaluation decisions
• resulting actions
• execution outcome

This ensures traceability of AI and operator influence.

---

# 30.16 Benefits of Intent-Based Control

Intent-Based Control provides several advantages:

### Safety

AI systems cannot directly manipulate actuators.

---

### Coordination

Multiple optimization systems can propose actions without conflict.

---

### Transparency

All system decisions are visible and auditable.

---

### Scalability

High-level goals can control large systems without micromanagement.

---

# 30.17 Example Integrated Architecture

```
AI Models
    │
    │ Intents
    ▼
POL Intent Engine
    │
    │ Procedure Invocation
    ▼
PEA Runtime
    │
    │ Command Execution
    ▼
Devices
```

OpenZiti ensures only authorized actors can submit intents or command services.

---

# 31. Summary

Intent-Based Control transforms the automation platform from a system where external actors directly control devices into one where actors **influence system behavior through goals**.

This architecture:

• protects actuator integrity
• enables AI participation safely
• centralizes decision making in the POL
• preserves deterministic PEA behavior

Intent-Based Control therefore provides a scalable framework for integrating advanced optimization and AI systems into industrial automation environments.


Perfect next step. Once you introduce **intent-based control**, the natural safety mechanism above it is exactly what you suggested: **Facility Digital Twin Arbitration**. This turns the POL into a **decision sandbox** where intents are simulated before touching real equipment.

Below is the next section of the functional specification that builds directly on the previous ones.

---

# Functional Specification

## Facility Digital Twin Arbitration

Section: 32
Version: Draft 1.0

---

# 32. Facility Digital Twin Arbitration

## 32.1 Purpose

Facility Digital Twin Arbitration introduces a simulation layer within the Process Orchestration Layer (POL) that evaluates proposed control actions before they are executed in the physical facility.

The digital twin represents the current state and behavior of the automation system, including:

• PEA subsystems
• process dynamics
• operational constraints
• equipment limitations

The digital twin allows the system to test intents and proposed control actions in a simulated environment prior to execution.

This mechanism improves system safety, enables advanced optimization, and provides a validation layer for autonomous or AI-generated control decisions.

---

# 32.2 Digital Twin Architecture

The digital twin operates as a **simulation environment inside the POL**.

It consists of:

• a structural model of the facility
• behavioral models of PEAs
• simulated state variables
• evaluation logic for proposed actions

The twin continuously synchronizes with the real system through telemetry.

Architecture overview:

```
Real System
   │
   │ Telemetry
   ▼
Digital Twin State Model
   │
   │ Intent Evaluation
   ▼
Simulation Engine
   │
   │ Result
   ▼
Execution Approval
```

---

# 32.3 Twin Synchronization

The digital twin maintains a real-time representation of the facility.

State synchronization occurs through:

• Zenoh telemetry streams
• OPC UA state variables
• PEA runtime reports

The twin updates:

• device states
• process measurements
• subsystem operational modes
• alarm conditions

Synchronization latency should remain within acceptable operational limits defined by system requirements.

---

# 32.4 Twin Modeling

Each PEA may optionally include a **digital twin model**.

The model describes:

• expected system behavior
• process relationships
• actuator effects
• dynamic response characteristics

Twin models may range from:

Simple rule-based approximations
to
High-fidelity physics or process simulations.

Example PEA twin models:

| PEA             | Model Type                    |
| --------------- | ----------------------------- |
| Climate Control | thermal model                 |
| Irrigation      | soil moisture model           |
| Nutrient Dosing | chemical mixing model         |
| Lighting        | energy and plant growth model |
| Pump System     | hydraulic flow model          |

---

# 32.5 Intent Simulation Workflow

Before executing an intent, the system performs a simulation.

### Step 1 — Intent Submission

An actor submits an intent.

Example:

```
reduce_water_consumption 5 percent
```

---

### Step 2 — Intent Evaluation

The Intent Evaluation Engine determines that the intent is valid.

---

### Step 3 — Control Plan Generation

The POL generates a proposed control plan.

Example:

```
reduce irrigation cycle frequency
```

---

### Step 4 — Twin Simulation

The plan is executed inside the digital twin.

Simulation evaluates:

• humidity impact
• crop safety thresholds
• water consumption
• environmental stability

---

### Step 5 — Result Analysis

Simulation produces predicted outcomes.

Example results:

```
water consumption: -5.2%
humidity: stable
crop stress risk: none
```

---

### Step 6 — Execution Decision

The system chooses one of three outcomes.

| Outcome  | Description      |
| -------- | ---------------- |
| Approved | Plan is executed |
| Modified | Plan is adjusted |
| Rejected | Intent denied    |

---

# 32.6 Safety Verification

The twin simulation must verify that the proposed control plan does not violate safety rules.

Safety checks include:

• equipment limits
• environmental thresholds
• operational interlocks
• process stability constraints

Plans violating safety rules are rejected.

---

# 32.7 Multi-Intent Arbitration

Multiple intents may be active simultaneously.

Example intents:

AI optimizer:

```
reduce energy usage
```

Operator:

```
increase airflow in zone 3
```

Maintenance:

```
run pump diagnostic cycle
```

The twin simulation evaluates the combined impact of all intents before execution.

This prevents conflicting actions.

---

# 32.8 Simulation Modes

The digital twin may operate in multiple modes.

| Mode        | Description              |
| ----------- | ------------------------ |
| Passive     | monitoring only          |
| Advisory    | predicts system response |
| Arbitration | validates control plans  |
| Training    | AI experimentation       |
| Replay      | reconstruct past events  |

---

# 32.9 AI Training Environment

The digital twin may provide a safe environment for AI model training.

AI systems may:

• test optimization strategies
• simulate control policies
• explore system behavior

These experiments occur without affecting the real facility.

---

# 32.10 Twin Accuracy Monitoring

The system monitors the accuracy of the digital twin.

Accuracy metrics include:

• prediction error
• model drift
• response mismatch

If model accuracy degrades beyond acceptable limits, the twin may:

• downgrade to advisory mode
• request recalibration
• flag engineering review

---

# 32.11 Model Updates

Twin models may be updated through the PEA engineering environment.

Updates may include:

• improved process models
• calibration adjustments
• new subsystem models

Updated models are deployed through the POL engineering system.

---

# 32.12 Failure Handling

If the digital twin becomes unavailable:

• the system may fall back to direct intent evaluation
• AI autonomy may be restricted
• human operator authority may be required

Twin availability requirements depend on system criticality.

---

# 32.13 Example Use Cases

Digital Twin Arbitration supports many use cases.

### AI Optimization

Test energy optimization strategies before execution.

---

### Fault Recovery

Simulate recovery procedures for failed subsystems.

---

### Procedure Validation

Verify complex procedures before running them.

---

### Multi-System Coordination

Evaluate interactions between multiple PEAs.

---

# 32.14 Integration with Command Authority

Digital Twin Arbitration operates alongside the Command Authority Model.

Authority determines **who may request actions**.

The digital twin determines **whether the requested action is safe**.

Execution only occurs when both conditions are satisfied.

---

# 32.15 Example Architecture

```
Actors
(humans / AI)
     │
     │ Intent
     ▼
Intent Evaluation Engine
     │
     ▼
Digital Twin Simulation
     │
     ▼
Command Authority Check
     │
     ▼
Execution via PEA Runtime
```

---

# 32.16 Benefits

Facility Digital Twin Arbitration provides several advantages.

### Safety

Control strategies are tested before execution.

---

### AI Enablement

AI systems can safely interact with automation infrastructure.

---

### Operational Confidence

Operators can evaluate potential outcomes before making changes.

---

### System Optimization

The system can explore improved operating strategies without risk.

---

# 33. Summary

Facility Digital Twin Arbitration introduces a simulation-based decision layer within the automation platform.

This layer ensures that:

• intents are evaluated safely
• control strategies are validated
• multiple actors can interact with the system safely

The digital twin acts as a **predictive safety barrier** between proposed actions and real-world execution.

---

If you'd like, the **next step (and honestly the part that would make this architecture extremely powerful)** would be one final piece:

**"Self-Assembling Automation Systems."**

Where new PEAs automatically appear in the digital twin, register with the POL, publish their capabilities, and the POL dynamically composes procedures from them.

At that point you basically have **a Kubernetes for industrial automation** — but with actual machine semantics.

You’re basically describing the final step of the architecture: a system where **automation modules discover each other, advertise their capabilities, and the POL composes them into working systems dynamically**. In other words, the plant becomes **composable infrastructure**.

Below is the next section of the functional specification.

---

# Functional Specification

## Self-Assembling Automation Systems

Section: 34
Version: Draft 1.0

---

# 34. Self-Assembling Automation Architecture

## 34.1 Purpose

Self-Assembling Automation Systems allow automation modules (PEAs) to dynamically discover, register, and integrate into the facility control environment without requiring manual system reconfiguration.

This capability enables:

• rapid system expansion
• modular subsystem deployment
• automatic discovery of automation capabilities
• dynamic orchestration of processes

The Process Orchestration Layer (POL) uses information published by PEA runtimes to construct an operational model of the facility and to compose procedures across subsystems.

---

# 34.2 Architectural Principles

The self-assembling system is based on the following principles.

### Modular Automation

Each subsystem is packaged as an independent **PEA runtime instance**.

### Capability Discovery

Each PEA advertises the capabilities it provides.

### Dynamic Integration

The POL integrates newly discovered PEAs into the operational system model.

### Composable Procedures

Procedures may be constructed from multiple PEAs based on capability compatibility.

---

# 34.3 PEA Capability Advertisement

Upon startup, a PEA runtime publishes its capabilities.

Capabilities describe the functions provided by the subsystem.

Examples include:

• fluid control
• climate regulation
• energy storage
• conveyor transport
• robotic manipulation
• sensor observation

Capability advertisement occurs through Zenoh.

Example message:

```
pea_id: irrigation_zone_7
capabilities:
  - fluid_distribution
  - irrigation_control
  - moisture_sensing
interfaces:
  command_service
  telemetry_service
  procedure_service
```

The POL collects these capability declarations.

---

# 34.4 Capability Model

Each capability declaration includes:

Capability Name
Supported Procedures
Supported Commands
Measurement Types
Operating Constraints

Example:

```
capability: fluid_distribution
commands:
  - open_valve
  - close_valve
procedures:
  - flush_line
  - purge_line
measurements:
  - flow_rate
  - pressure
constraints:
  pressure_max: 8 bar
```

---

# 34.5 Facility Capability Graph

The POL maintains a **Facility Capability Graph** representing relationships between PEAs.

Nodes represent:

• PEAs
• capabilities
• physical connections
• logical relationships

Edges represent:

• data flows
• command paths
• process dependencies

Example:

```
nutrient_mixer → irrigation_controller → irrigation_zone
```

The graph is continuously updated as PEAs join or leave the system.

---

# 34.6 Automatic PEA Registration

When a PEA runtime starts:

1. runtime joins Nebula network
2. runtime connects to Zenoh router
3. runtime registers with POL
4. runtime publishes capability metadata

Registration message example:

```
runtime_id: pea-node-12
pea_id: lighting_zone_3
version: 1.2
capabilities:
  - lighting_control
  - light_intensity_monitoring
```

The POL adds the PEA to the Facility Capability Graph.

---

# 34.7 Dynamic System Composition

The POL composes facility functionality from discovered PEAs.

Example scenario:

New irrigation PEA deployed.

Existing system:

```
nutrient_mixer
```

New capability discovered:

```
irrigation_distribution
```

POL automatically links:

```
nutrient_mixer → irrigation_distribution
```

Procedures may now use both subsystems.

---

# 34.8 Procedure Composition

Procedures may be composed dynamically using PEA capabilities.

Example procedure:

```
fertigation_cycle
```

The POL identifies PEAs capable of:

• mixing nutrients
• distributing fluid
• measuring soil moisture

The POL generates a procedure plan using these subsystems.

---

# 34.9 Example Self-Assembly Workflow

### Step 1 — New Subsystem Deployment

A new irrigation controller is installed.

---

### Step 2 — Runtime Startup

The PEA runtime launches.

---

### Step 3 — Network Join

The runtime joins the Nebula mesh.

---

### Step 4 — Capability Advertisement

The PEA publishes capability metadata via Zenoh.

---

### Step 5 — POL Integration

The POL updates the Facility Capability Graph.

---

### Step 6 — Procedure Update

Existing procedures are updated to include the new subsystem.

---

# 34.10 Multi-Subsystem Coordination

Self-assembly supports coordination across multiple PEAs.

Example integrated process:

```
energy_storage
→ climate_control
→ irrigation_control
```

The POL orchestrates actions across these modules.

---

# 34.11 Digital Twin Integration

When a new PEA is registered:

1. the digital twin creates a corresponding twin model
2. the model is inserted into the facility simulation
3. the twin validates interactions with existing systems

This ensures that new subsystems do not destabilize the facility.

---

# 34.12 Capability Constraints

PEAs may define constraints affecting orchestration.

Examples include:

• maximum throughput
• energy limits
• operating ranges
• maintenance requirements

The POL considers these constraints when composing procedures.

---

# 34.13 System Adaptation

The system adapts automatically when subsystems change.

Example events:

• subsystem added
• subsystem removed
• subsystem degraded

The POL updates the Facility Capability Graph and adjusts orchestration strategies accordingly.

---

# 34.14 Operator Visibility

Operators must be able to view:

• discovered PEAs
• available capabilities
• subsystem relationships
• composed procedures

Visualization tools may display the Facility Capability Graph.

---

# 34.15 Failure Handling

If a PEA fails:

• the runtime disconnects from the system
• the POL removes it from the capability graph
• affected procedures are re-evaluated

If alternate capabilities exist, the system may recompose procedures automatically.

---

# 34.16 Example Architecture

```
POL
 ├ Capability Graph
 ├ Intent Engine
 ├ Digital Twin
 └ Orchestration Engine

PEA Runtime A
 └ Capability: fluid_distribution

PEA Runtime B
 └ Capability: nutrient_mixing

PEA Runtime C
 └ Capability: soil_moisture_monitoring
```

Together these modules form a complete irrigation subsystem.

---

# 35. Benefits

Self-Assembling Automation Systems provide significant advantages.

### Rapid Deployment

New subsystems integrate automatically.

---

### Flexibility

Automation systems adapt to changing facility configurations.

---

### Modularity

Subsystems can be replaced or upgraded independently.

---

### Scalability

Large facilities can grow organically without requiring complete redesign.

---

# 36. Summary

Self-Assembling Automation Systems enable automation infrastructure to evolve dynamically.

Through PEA capability discovery and orchestration, the facility becomes a **composable system of automation modules**.

This architecture enables:

• modular deployment
• dynamic orchestration
• safe subsystem integration
• scalable facility automation

---

At this point your spec now describes a **very complete architecture** that includes:

1. **PEA modular automation**
2. **Intent-based control**
3. **Command authority arbitration**
4. **Zero-trust service enforcement**
5. **Digital twin safety validation**
6. **Self-assembling system composition**

One thing that would elevate this even further (and make it **very publishable**) would be one last layer:

**“Automation Capability Ontology.”**

That would standardize the vocabulary for capabilities so PEAs from different vendors can compose automatically.

It’s basically the **missing semantic layer for industrial automation**.

