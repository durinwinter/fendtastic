import { useState, useEffect } from 'react'
import './App.css'

// --- CHAPTER 1: COMMAND FOREWORD ---
const CHAPTER_1 = [
  {
    title: "Classified Briefing: Project Fendtastic",
    subtitle: "Ganymede Base Automation Directive",
    content: [
      "Objective: Coordinate distributed automation subsystems safely.",
      "Vision: Enable human, AI, and procedural collaboration.",
      "Foundation: Deterministic machine behavior + Operational safety.",
      "Domain-Agnostic: Logic is defined by engineered modules, not hardcoded."
    ],
    technical: "STATUS: COMPROMISED // CLEARANCE: OVERRIDE // SRC: CONTROL-AUTHORITY.MD",
    chapter: "1. FOREWORD"
  },
  {
    title: "System Purpose",
    subtitle: "Modular Automation Vision",
    content: [
      "Traditional systems are monolithic and brittle.",
      "Our platform coordinates PEAs (Packaged Equipment Assemblies).",
      "Centralized orchestration via Process Orchestration Layer (POL).",
      "Distributed communication via Zero-Trust infrastructure."
    ],
    technical: "PURPOSE_BLOCK: ACTIVATED // VISION_V1.0",
    chapter: "1. FOREWORD"
  }
];

// --- CHAPTER 2: CORE ARCHITECTURE ---
const CHAPTER_2 = [
  {
    type: "diagram",
    diagramId: "RefArch",
    title: "Reference Architecture",
    subtitle: "Intent-Driven Modular Platform",
    content: [
      "Top: Actors (Humans, AI, Schedulers)",
      "Middle: POL (Orchestration, Intent, Authority)",
      "Bottom: PEA Runtimes (Local control, Devices)"
    ],
    technical: "DOC_REF: SEC_15 // ARCH_V4",
    chapter: "2. ARCHITECTURE"
  },
  {
    title: "The Packaged Equipment Assembly (PEA)",
    subtitle: "The Atomic unit of Automation",
    content: [
      "Device integrations and drivers.",
      "Operational procedures and telemetry.",
      "Onboard Digital Twin models.",
      "Standardized command interfaces."
    ],
    technical: "PEA_SPEC_33 // UNIT_ATOMIC",
    chapter: "2. ARCHITECTURE"
  },
  {
    type: "diagram",
    diagramId: "PEALayers",
    title: "PEA Internal Layers",
    subtitle: "From Device to Orchestration",
    content: [
      "Execution Layer: Commands and Procedures",
      "Semantic Layer: Canonical Tag Model",
      "Logic Layer: Digital Twin Arbitration",
      "I/O Layer: Neuron Device Drivers"
    ],
    technical: "PEA_INTERNAL: VISUALIZED",
    chapter: "2. ARCHITECTURE"
  }
];

// --- CHAPTER 3: CONTROL AUTHORITY ---
const CHAPTER_3 = [
  {
    title: "The Control Authority Model",
    subtitle: "Who pulls the trigger?",
    content: [
      "Authority depends on PEA operational state.",
      "Multiple actors: Humans, Procedures, AI Optimizers.",
      "Determined by machine semantics (MTP concepts).",
      "Enforced by Zero-Trust Service Policy."
    ],
    technical: "AUTH_MODEL_01 // SEC_IDENTITY",
    chapter: "3. AUTHORITY"
  },
  {
    title: "Command Arbitration Hierarchy",
    subtitle: "Resolving Conflicts in Real-Time",
    content: [
      "1. Machine Operational State (Hard Limit)",
      "2. Control Authority Mode (Who is active?)",
      "3. Actor Class Priority (Operator > AI)",
      "4. Command Ownership (Current session lock)"
    ],
    technical: "ARB_QUEUE: PRIORITY_ENABLED",
    chapter: "3. AUTHORITY"
  },
  {
    title: "Actor Classes",
    subtitle: "System Identities",
    content: [
      "Human Operators: HMIs and Supervisory tools.",
      "Procedure Engines: POL logic executing cycles.",
      "AI Systems: Vision, Optimization, and Predictive models.",
      "Maintenance: Direct engineering access."
    ],
    technical: "IDENTITY_REGISTRY: 42_ENTRIES",
    chapter: "3. AUTHORITY"
  }
];

// --- CHAPTER 4: INTENT-DRIVEN CONTROL ---
const CHAPTER_4 = [
  {
    title: "Intent-Based Control Architecture",
    subtitle: "Outcomes over Actuators",
    content: [
      "Actors submit 'Intents' describing desired outcomes.",
      "POL evaluates and translates to commands.",
      "Prevents bypassing machine safety semantics.",
      "Improves traceability of AI-driven optimization."
    ],
    technical: "INTENT_ENGINE_30 // GOAL_DECLARATIVE",
    chapter: "4. INTENT"
  },
  {
    type: "diagram",
    diagramId: "ControlLoops",
    title: "The Four Control Loops",
    subtitle: "Timescale and Abstraction Hierarchy",
    content: [
      "Intent Loop (Minutes to Hours): Goals",
      "Optimization Loop (Minutes): Strategies",
      "Procedure Loop (Seconds): Sequences",
      "Control Loop (Milliseconds): Device Physics"
    ],
    technical: "LOOPS_NESTED: 4 // TIME_SYNC: ON",
    chapter: "4. INTENT"
  }
];

// --- CHAPTER 5: DIGITAL TWIN ARBITRATION ---
const CHAPTER_5 = [
  {
    title: "Facility Digital Twin Arbitration",
    subtitle: "Simulate Before Actuation",
    content: [
      "Simulation sandbox inside the POL.",
      "Evaluates intents against system state.",
      "Predicts outcome before execution.",
      "Decision gates: APPROVE / MODIFY / REJECT."
    ],
    technical: "SEC_32 // SIM_SANDBOX",
    chapter: "5. SIMULATION"
  },
  {
    title: "Safety by Design",
    subtitle: "Enforcing Limits Procedurally",
    content: [
      "Twin verifies environmental thresholds.",
      "Equipment limits are checked against physics models.",
      "Process stability is ensured across subsystems.",
      "Final validation happens inside the PEA Runtime."
    ],
    technical: "SAFETY_VER: ENFORCED",
    chapter: "5. SIMULATION"
  }
];

// --- CHAPTER 6: SEMANTIC FRAMEWORK ---
const CHAPTER_6 = [
  {
    title: "PEA Capability Ontology",
    subtitle: "Self-Assembling Automation",
    content: [
      "Standardized vocabulary for subsystem functions.",
      "PEAs declare Functional Capabilities and Interfaces.",
      "POL constructs 'Facility Capability Graph'.",
      "Enables dynamic procedure composition."
    ],
    technical: "ONTOLOGY_37 // SEMANTIC_WEB",
    chapter: "6. SEMANTICS"
  },
  {
    title: "Capability Categories",
    subtitle: "Defining the Subsystem's DNA",
    content: [
      "Actuation: Fluid, Motion, Energy transfer.",
      "Sensing: Temperature, Pressure, Vision.",
      "Processing: Mixing, Filtration, Transport.",
      "Infrastructure: Energy storage, Climate regulation."
    ],
    technical: "CATS: 4 // MODS: REGISTERED",
    chapter: "6. SEMANTICS"
  }
];

// --- CHAPTER 7: INFRASTRUCTURE ---
const CHAPTER_7 = [
  {
    title: "The Secure Data Fabric",
    subtitle: "Hardware & Transport Layers",
    content: [
      "Nebula: Encrypted Overlay Host Networking.",
      "OpenZiti: Zero-Trust Service Access (Identity-Based).",
      "Zenoh: Real-Time Event Fabric and Data Distribution.",
      "OPC UA/MTP: Standard Industry Orchestration."
    ],
    technical: "INFRA_STACK: NEBULA_ZITI_ZENOH",
    chapter: "7. INFRA"
  }
];

// --- FINAL CHAPTER: SUMMARY ---
const CHAPTER_8 = [
  {
    title: "Operational Benefits",
    subtitle: "The Future of Ganymede Automation",
    content: [
      "Safe AI Integration without physical risk.",
      "Modular deployment: Plug-and-play subsystems.",
      "Dynamic facilities that grow without full redesign.",
      "Traceability: Audit every strategy to its outcome."
    ],
    technical: "ADMIN_SUMMARY // CASE_CLOSED",
    chapter: "8. SUMMARY"
  },
  {
    title: "End of Briefing",
    subtitle: "Authority Relinquished",
    content: [
      "System operational.",
      "Clearance maintained.",
      "Stand by for further directives.",
      "Disconnecting session..."
    ],
    technical: "G-BASE-ADMIN // SIG_OFF",
    chapter: "8. SUMMARY"
  }
];

const SLIDES = [
  ...CHAPTER_1,
  ...CHAPTER_2,
  ...CHAPTER_3,
  ...CHAPTER_4,
  ...CHAPTER_5,
  ...CHAPTER_6,
  ...CHAPTER_7,
  ...CHAPTER_8
];

const ReferenceArchitectureDiagram = () => (
  <div className="diagram-box ref-arch">
    <div className="diag-node actors">ACTORS (HUMAN/AI)</div>
    <div className="diag-arrow">▼ Intents</div>
    <div className="diag-node pol">PROCESS ORCHESTRATION LAYER (POL)</div>
    <div className="diag-arrow">▼ Procedures</div>
    <div className="diag-row runtimes">
      <div className="diag-node pea">PEA 1</div>
      <div className="diag-node pea">PEA 2</div>
      <div className="diag-node pea">PEA 3</div>
    </div>
    <div className="diag-arrow">▼ Actuation</div>
    <div className="diag-node devices">PHYSICAL DEVICES</div>
  </div>
);

const PEALayersDiagram = () => (
  <div className="diagram-box pea-layers">
    <div className="layer orchestration">ORCHESTRATION INTERFACE (OPC UA)</div>
    <div className="layer command">COMMAND & PROCEDURE SERVICES</div>
    <div className="layer logic">LOGIC & TWIN ARBITRATION</div>
    <div className="layer canonical">CANONICAL TAG MODEL</div>
    <div className="layer drivers">NEURON DEVICE DRIVERS</div>
  </div>
);

const ControlLoopsDiagram = () => (
  <div className="diagram-box loops">
    <div className="loop-circle int">INTENT</div>
    <div className="loop-circle opt">OPT</div>
    <div className="loop-circle pro">PROC</div>
    <div className="loop-circle dev">CTRL</div>
  </div>
);

const Diagram = ({ id }) => {
  switch (id) {
    case 'RefArch': return <ReferenceArchitectureDiagram />;
    case 'PEALayers': return <PEALayersDiagram />;
    case 'ControlLoops': return <ControlLoopsDiagram />;
    default: return null;
  }
};

// --- DEEP DIVE CONTENT ---
const DEEP_DIVES = {
  PEA: {
    title: "PEA Subsystems: Atomic Automation",
    meta: "DOC_ID: TECH-PEA-01 // AUTH: GAN-SYS-ARCH",
    sections: [
      {
        title: "Packaged Equipment Assembly (PEA) Model",
        content: "A PEA is a modular automation unit that encapsulates sensors, actuators, and the local logic required to manage a specific process function (e.g., pH adjustment, thermal regulation).",
        code: "Capability Ontology: fluid_transport\nInterfaces: OPC UA, Zenoh\nLatency Target: < 10ms"
      },
      {
        title: "Semantic Layer: The Machine DNA",
        content: "Each PEA exposes its functionality through a standardized 'Capability Ontology'. This allows the central orchestration layer to discover and command the unit without knowing its internal hardware vendor or implementation details.",
      }
    ]
  },
  POL: {
    title: "POL: Process Orchestration Layer",
    meta: "DOC_ID: TECH-POL-04 // AUTH: GAN-SYS-ARCH",
    sections: [
      {
        title: "The Central Nervous System",
        content: "The POL is responsible for high-level facility coordination. It maintains the registry of all active PEAs and constructs the 'Facility Capability Graph' used for procedure generation.",
        code: "Registry: Zenoh-based distributed KV\nOrchestrator: Procedure Engine v4.2"
      },
      {
        title: "Dynamic Procedure Composition",
        content: "Procedures are not hardcoded. The POL dynamically assembles command sequences by matching 'Intent Objectives' with 'PEA Capabilities' found in the capability graph.",
      }
    ]
  },
  INTENT: {
    title: "Intent & AI Arbitration",
    meta: "DOC_ID: TECH-INT-09 // AUTH: GAN-SYS-ARCH",
    sections: [
      {
        title: "Intent-Based Control",
        content: "External actors (Humans or AI models) do not send direct 'Open Valve' commands. They submit declarative 'Intents' describing a desired state (e.g., 'Maintain Humidity 70%').",
      },
      {
        title: "Digital Twin Arbitration",
        content: "Before any Intent is translated into a physical procedure, it is simulated in the POL's Digital Twin sandbox. If the simulation detects a safety violation or process instability, the Intent is rejected.",
        code: "Outcome 1: APPROVE (Proceed to execution)\nOutcome 2: MODIFY (Adjust setpoints and retry)\nOutcome 3: REJECT (Safety violation detected)"
      }
    ]
  },
  SECURITY: {
    title: "Zero-Trust Infrastructure",
    meta: "DOC_ID: TECH-SEC-07 // AUTH: GAN-SYS-ARCH",
    sections: [
      {
        title: "Service-Level Security",
        content: "The Ganymede Base platform utilizes OpenZiti for service-level zero-trust. No device is reachable on the network without a cryptographically verified identity.",
        code: "Protocol: MTP / OPC UA over Ziti\nIdentity Provider: Ganymede-Auth-Service"
      },
      {
        title: "Network Overlay",
        content: "Nebula provides a flat, encrypted host-to-host network while Zenoh ensures high-performance, low-latency data distribution across the base's distributed nodes.",
      }
    ]
  }
};

const TerminalDoc = ({ data }) => (
  <div className="terminal-view">
    <header className="terminal-header">
      <h1 className="terminal-title glow-text">{data.title}</h1>
      <div className="terminal-meta">{data.meta}</div>
    </header>
    <div className="terminal-content">
      {data.sections.map((sec, i) => (
        <section key={i} className="terminal-section">
          <h3>{sec.title}</h3>
          <p>{sec.content}</p>
          {sec.code && <div className="code-block">{sec.code}</div>}
        </section>
      ))}
    </div>
  </div>
);

function App() {
  const [activeTab, setActiveTab] = useState('HOME');
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => setCurrentSlide((prev) => Math.min(prev + 1, SLIDES.length - 1));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 0));

  useEffect(() => {
    if (activeTab !== 'HOME') return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  const slide = SLIDES[currentSlide];

  const renderContent = () => {
    switch (activeTab) {
      case 'PEA': return <TerminalDoc data={DEEP_DIVES.PEA} />;
      case 'POL': return <TerminalDoc data={DEEP_DIVES.POL} />;
      case 'INTENT': return <TerminalDoc data={DEEP_DIVES.INTENT} />;
      case 'SECURITY': return <TerminalDoc data={DEEP_DIVES.SECURITY} />;
      default: return (
        <main className="slide-container">
          <article className="slide flicker" key={currentSlide}>
            <header>
              <span className="tag">TOP SECRET // GANYMEDE CLEARANCE</span>
              <h1 className="slide-title glow-text">{slide.title}</h1>
              <h2 style={{ color: 'var(--accent-orange)', fontSize: '1.2rem', marginTop: '-10px' }}>
                {slide.subtitle}
              </h2>
            </header>

            <div className="slide-content">
              {slide.type === 'diagram' ? (
                <div className="diagram-layout">
                  <div className="diagram-viz">
                    <Diagram id={slide.diagramId} />
                  </div>
                  <ul className="bullet-list mini">
                    {slide.content.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <ul className="bullet-list">
                  {slide.content.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="status-bar">
              <div className="status-item">{slide.technical}</div>
              <div className="status-item glow-text">SYSTEM_LINK: ENCRYPTED</div>
            </footer>

            <div className="nav-hint">
              [ SPACE / CLICK ] TO ADVANCE // SECTOR {currentSlide + 1}
            </div>
          </article>
        </main>
      );
    }
  };

  return (
    <div className="app-container" onClick={activeTab === 'HOME' ? nextSlide : undefined}>
      <Starfield />

      {/* HUD Tabs */}
      <nav className="hud-tabs">
        {['HOME', 'PEA', 'POL', 'INTENT', 'SECURITY'].map(tab => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab(tab);
            }}
          >
            {tab === 'HOME' ? 'Briefing' : tab}
          </button>
        ))}
      </nav>

      {/* HUD Elements */}
      <div className="hud-corner top-left flicker"></div>
      <div className="hud-corner top-right flicker"></div>
      <div className="hud-corner bottom-left flicker"></div>
      <div className="hud-corner bottom-right flicker"></div>

      <div className="technical-data glow-text" style={{ position: 'absolute', top: '25px', left: '50px' }}>
        TERMINAL: G-BASE-CMD // MODE: {activeTab === 'HOME' ? `CHAPTER_${slide.chapter}` : 'DEEP_DIVE'}
      </div>

      <div className="technical-data" style={{ position: 'absolute', bottom: '25px', left: '50px' }}>
        {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC // LAT: 0.709°N // LON: 128.3°W
      </div>

      {renderContent()}
    </div>
  )
}

export default App
