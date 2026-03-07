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

const Starfield = () => {
  const [stars, setStars] = useState([]);

  useEffect(() => {
    const newStars = Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: `${Math.random() * 2 + 1}px`,
      duration: `${Math.random() * 3 + 2}s`,
      delay: `${Math.random() * 5}s`
    }));
    setStars(newStars);
  }, []);

  return (
    <div className="stars-container">
      {stars.map((star) => (
        <div
          key={star.id}
          className="star"
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            '--duration': star.duration,
            animationDelay: star.delay
          }}
        />
      ))}
    </div>
  );
};

function App() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => setCurrentSlide((prev) => Math.min(prev + 1, SLIDES.length - 1));
  const prevSlide = () => setCurrentSlide((prev) => Math.max(prev - 1, 0));

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const slide = SLIDES[currentSlide];

  return (
    <div className="app-container" onClick={nextSlide}>
      <Starfield />

      {/* HUD Elements */}
      <div className="hud-corner top-left flicker"></div>
      <div className="hud-corner top-right flicker"></div>
      <div className="hud-corner bottom-left flicker"></div>
      <div className="hud-corner bottom-right flicker"></div>

      <div className="technical-data glow-text" style={{ position: 'absolute', top: '25px', left: '50px' }}>
        TERMINAL: G-BASE-CMD // CHAPTER: {slide.chapter} // SLIDE: {currentSlide + 1}/{SLIDES.length}
      </div>

      <div className="technical-data" style={{ position: 'absolute', bottom: '25px', left: '50px' }}>
        {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC // LAT: 0.709°N // LON: 128.3°W
      </div>

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
    </div>
  )
}

export default App
