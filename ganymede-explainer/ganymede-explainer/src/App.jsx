import { useState, useEffect, useRef, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom, Noise, ChromaticAberration, Glitch } from '@react-three/postprocessing'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'
import {
  Shield,
  Cpu,
  Network,
  Terminal,
  Activity,
  ChevronRight,
  Lock,
  Zap,
  Layers,
  Target
} from 'lucide-react'

import { GanymedeMoon } from './components/GanymedeMoon'
import { TechnicalGrid } from './components/TechnicalGrid'
import { SentinelGuide } from './components/SentinelGuide'
import { DataDebris } from './components/DataDebris'
import { DigitalOoze } from './components/DigitalOoze'
import { DataMonolith } from './components/DataMonolith'
import './App.css'

// --- 3D CAMERA RIG ---
const CameraRig = ({ activeTab }) => {
  const { camera, mouse } = useThree()
  const vec = new THREE.Vector3()

  useFrame(() => {
    // Base parallax
    camera.position.lerp(vec.set(mouse.x * 2, mouse.y * 1, 5), 0.05)

    // Target zooming based on active tab
    if (activeTab === 'PEA') camera.position.lerp(vec.set(-2, 0, 3), 0.05)
    if (activeTab === 'POL') camera.position.lerp(vec.set(0, 0, 3), 0.05)
    if (activeTab === 'INTENT') camera.position.lerp(vec.set(2, 0, 3), 0.05)
    if (activeTab === 'SECURITY') camera.position.lerp(vec.set(4, 0, 3), 0.05)

    camera.lookAt(0, 0, 0)
  })
  return null
}

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

// --- CHAPTERS ---
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

// --- AESTHETIC COMPONENTS ---

const ScanlineOverlay = () => (
  <div className="hud-scanlines" style={{
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '100%',
    background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.05) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.01), rgba(0, 255, 0, 0.01), rgba(0, 0, 255, 0.01))',
    backgroundSize: '100% 4px, 4px 100%',
    pointerEvents: 'none',
    zIndex: 100,
    opacity: 0.4
  }} />
)

const DecryptText = ({ text, delay = 0 }) => {
  const [displayText, setDisplayText] = useState('');
  const chars = '!<>-_\\/[]{}—=+*^?#________';

  useEffect(() => {
    let iteration = 0;
    const interval = setInterval(() => {
      setDisplayText(text.split('').map((letter, index) => {
        if (index < iteration) return text[index];
        return chars[Math.floor(Math.random() * chars.length)];
      }).join(''));

      if (iteration >= text.length) clearInterval(interval);
      iteration += 1 / 3;
    }, 30);
    return () => clearInterval(interval);
  }, [text]);

  return <span>{displayText}</span>;
}

const Starfield = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [stars, setStars] = useState([]);

  useEffect(() => {
    const newStars = Array.from({ length: 150 }).map((_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      top: `${Math.random() * 100}%`,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.05 + 0.01,
      depth: Math.random() * 5 + 1
    }));
    setStars(newStars);

    const handleMouseMove = (e) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeMouseMoveListener?.('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="stars-container">
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="star"
          animate={{
            x: (mousePos.x - window.innerWidth / 2) * star.speed,
            y: (mousePos.y - window.innerHeight / 2) * star.speed,
          }}
          style={{
            left: star.left,
            top: star.top,
            width: star.size,
            height: star.size,
            background: `rgba(255, 255, 255, ${0.3 + (star.depth / 10)})`,
            boxShadow: star.size > 2 ? '0 0 10px white' : 'none',
          }}
        />
      ))}
    </div>
  );
};

// --- DIAGRAMS ---

const ReferenceArchitectureDiagram = () => (
  <motion.div
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    className="diagram-box ref-arch"
  >
    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 4 }} className="diag-node actors">
      <Network size={20} style={{ marginRight: 10 }} /> ACTORS (HUMAN/AI)
    </motion.div>
    <div className="diag-arrow">▼ Intents</div>
    <motion.div
      animate={{ boxShadow: ["0 0 10px var(--accent-blue)", "0 0 30px var(--accent-blue)", "0 0 10px var(--accent-blue)"] }}
      transition={{ repeat: Infinity, duration: 2 }}
      className="diag-node pol"
    >
      <Cpu size={20} style={{ marginRight: 10 }} /> PROCESS ORCHESTRATION LAYER (POL)
    </motion.div>
    <div className="diag-arrow">▼ Procedures</div>
    <div className="diag-row runtimes">
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.2 }}
          className="diag-node pea"
        >
          PEA {i}
        </motion.div>
      ))}
    </div>
    <div className="diag-arrow">▼ Actuation</div>
    <div className="diag-node devices">PHYSICAL DEVICES</div>
  </motion.div>
);

const PEALayersDiagram = () => (
  <div className="diagram-box pea-layers">
    {["ORCHESTRATION INTERFACE", "COMMAND SERVICES", "TWIN ARBITRATION", "CANONICAL MODEL", "DEVICE DRIVERS"].map((layer, i) => (
      <motion.div
        key={i}
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: i * 0.1 }}
        whileHover={{ scale: 1.05, x: 10, background: 'rgba(0, 242, 255, 0.2)' }}
        className="layer"
      >
        {layer}
      </motion.div>
    ))}
  </div>
);

const ControlLoopsDiagram = () => (
  <div className="diagram-box loops">
    {['INTENT', 'OPT', 'PROC', 'CTRL'].map((label, i) => (
      <motion.div
        key={label}
        className={`loop-circle ${label.toLowerCase()}`}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12, delay: i * 0.1 }}
        whileHover={{ rotate: 5, scale: 1.02 }}
      >
        {label}
      </motion.div>
    ))}
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

// --- MAIN APP ---

function App() {
  const [activeTab, setActiveTab] = useState('HOME');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  const nextSlide = () => {
    if (currentSlide < SLIDES.length - 1) {
      setIsNavigating(true);
      setTimeout(() => {
        setCurrentSlide(curr => curr + 1);
        setIsNavigating(false);
      }, 300);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(curr => curr - 1);
    }
  };

  useEffect(() => {
    if (activeTab !== 'HOME') return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'Enter') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, currentSlide]);

  const slide = SLIDES[currentSlide];

  const renderContent = () => {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab + (activeTab === 'HOME' ? currentSlide : '')}
          initial={{ opacity: 0, x: 20, rotateY: 10 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          exit={{ opacity: 0, x: -20, rotateY: -10 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10 }}
        >
          {activeTab !== 'HOME' ? (
            <div className="terminal-view">
              <header className="terminal-header">
                <h1 className="terminal-title glow-text">
                  <DecryptText text={DEEP_DIVES[activeTab].title} />
                </h1>
                <div className="terminal-meta">{DEEP_DIVES[activeTab].meta}</div>
              </header>
              <div className="terminal-content">
                {DEEP_DIVES[activeTab].sections.map((sec, i) => (
                  <motion.section
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.2 }}
                    className="terminal-section"
                  >
                    <h3 className="glitch-hover">{sec.title}</h3>
                    <p>{sec.content}</p>
                    {sec.code && (
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        className="code-block"
                      >
                        {sec.code}
                      </motion.div>
                    )}
                  </motion.section>
                ))}
              </div>
            </div>
          ) : (
            <main className="slide-container">
              <article className="slide flicker" onClick={nextSlide}>
                <header>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    className="tag"
                  >
                    <Lock size={12} style={{ marginRight: 5 }} /> TOP SECRET // CLEARANCE REQUIRED
                  </motion.div>
                  <h1 className="slide-title glow-text">
                    <DecryptText text={slide.title} />
                  </h1>
                  <motion.h2
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ color: 'var(--accent-orange)', fontSize: '1.2rem', marginTop: '-10px' }}
                  >
                    {slide.subtitle}
                  </motion.h2>
                </header>

                <div className="slide-content">
                  {slide.type === 'diagram' ? (
                    <div className="diagram-layout">
                      <div className="diagram-viz">
                        <Diagram id={slide.diagramId} />
                      </div>
                      <ul className="bullet-list mini">
                        {slide.content.map((item, i) => (
                          <motion.li
                            key={i}
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5 + (i * 0.1) }}
                          >
                            {item}
                          </motion.li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <ul className="bullet-list">
                      {slide.content.map((item, i) => (
                        <motion.li
                          key={i}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: 0.3 + (i * 0.1) }}
                        >
                          {item}
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>

                <footer className="status-bar">
                  <div className="status-item"><Activity size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} /> {slide.technical}</div>
                  <div className="status-item glow-text">G-BASE // AUTH: VALIDATED</div>
                </footer>

                <div className="nav-hint">
                  <ChevronRight size={18} className="flicker" /> [ CLICK ] TO ADVANCE // SECTOR {currentSlide + 1}
                </div>
              </article>
            </main>
          )}
        </motion.div>
      </AnimatePresence>
    )
  }

  return (
    <div className="app-container">
      {/* 3D SCENE BACKGROUND */}
      <div className="canvas-container">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
          <CameraRig activeTab={activeTab} />
          <color attach="background" args={['#000']} />
          <Suspense fallback={null}>
            <ambientLight intensity={0.5} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} color="#00f2ff" />
            <pointLight position={[-10, -5, -10]} intensity={1} color="#ffaa00" />

            <GanymedeMoon />
            <TechnicalGrid isNavigating={isNavigating} />
            <DigitalOoze />
            <SentinelGuide active={activeTab !== 'HOME'} />
            <DataDebris count={200} />

            {/* DATA MONOLITHS (Phase 6 Navigation) */}
            {['PEA', 'POL', 'INTENT', 'SECURITY'].map((tab, i) => (
              <DataMonolith
                key={tab}
                label={tab}
                position={[(i - 1.5) * 4, -1, -2]}
                onClick={() => setActiveTab(tab)}
                active={activeTab === tab}
              />
            ))}

            {/* POST PROCESSING */}
            <EffectComposer>
              <Bloom
                intensity={1.5}
                luminanceThreshold={0.1}
                luminanceSmoothing={0.9}
                mipmapBlur
              />
              <Noise opacity={0.1} />
              <ChromaticAberration offset={[0.005, 0.005]} />
              {isNavigating && <Glitch duration={[0.1, 0.2]} strength={[0.3, 0.5]} ratio={0.5} />}
            </EffectComposer>
          </Suspense>
        </Canvas>
      </div>

      <Starfield />
      <ScanlineOverlay />

      {/* HUD Tabs */}
      <nav className="hud-tabs">
        {['HOME', 'PEA', 'POL', 'INTENT', 'SECURITY'].map((tab, i) => (
          <motion.button
            key={tab}
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.1 }}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'HOME' ? <Terminal size={14} /> : tab}
            {tab === 'HOME' && <span style={{ marginLeft: 8 }}>Briefing</span>}
          </motion.button>
        ))}
      </nav>

      {/* HUD Corners */}
      {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map(pos => (
        <motion.div
          key={pos}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ repeat: Infinity, duration: 4 }}
          className={`hud-corner ${pos} flicker`}
        />
      ))}

      <div className="technical-data glow-text" style={{ position: 'absolute', top: '25px', left: '50px', zIndex: 100 }}>
        <Zap size={14} style={{ marginRight: 8, verticalAlign: 'middle' }} />
        TERMINAL: G-BASE-CMD // {activeTab === 'HOME' ? `CHAPTER_${slide.chapter.replace('.', '')}` : 'DEEP_DIVE'}
      </div>

      <div className="technical-data" style={{ position: 'absolute', bottom: '25px', left: '50px', zIndex: 100 }}>
        {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC // LAT: 0.709°N // LON: 128.3°W
      </div>

      {renderContent()}
    </div>
  )
}

export default App
