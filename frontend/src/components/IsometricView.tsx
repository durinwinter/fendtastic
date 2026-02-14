import React, { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Box as ThreeBox } from '@react-three/drei'
import * as THREE from 'three'

const MachineModel: React.FC = () => {
  const groupRef = useRef<THREE.Group>(null)

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.002
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Machine base */}
      <ThreeBox args={[3, 0.3, 2]} position={[0, 0, 0]}>
        <meshStandardMaterial color="#6EC72D" metalness={0.6} roughness={0.4} />
      </ThreeBox>

      {/* Machine body */}
      <ThreeBox args={[2.5, 1.5, 1.5]} position={[0, 1, 0]}>
        <meshStandardMaterial color="#4E9020" metalness={0.5} roughness={0.5} />
      </ThreeBox>

      {/* Cabin/control area */}
      <ThreeBox args={[1.5, 1, 1]} position={[-0.5, 2.2, 0]}>
        <meshStandardMaterial color="#2a2a2a" metalness={0.3} roughness={0.6} />
      </ThreeBox>

      {/* Equipment arm */}
      <ThreeBox args={[0.3, 2, 0.3]} position={[1.2, 1.5, 0]} rotation={[0, 0, 0.3]}>
        <meshStandardMaterial color="#E67E22" metalness={0.7} roughness={0.3} />
      </ThreeBox>

      {/* Wheels */}
      {[-1, 1].map((x) =>
        [-0.8, 0.8].map((z, idx) => (
          <mesh key={`${x}-${idx}`} position={[x, -0.3, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.4, 0.4, 0.3, 16]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
          </mesh>
        ))
      )}

      {/* Status indicator lights */}
      <mesh position={[0, 2.5, 0.8]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial color="#6EC72D" />
        <pointLight color="#6EC72D" intensity={2} distance={5} />
      </mesh>
    </group>
  )
}

const IsometricView: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <Canvas
        camera={{
          position: [5, 5, 5],
          fov: 50,
          near: 0.1,
          far: 1000
        }}
        style={{ background: '#0a0a0a' }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -5]} intensity={0.5} />
        <hemisphereLight groundColor="#1a1a1a" color="#6EC72D" intensity={0.3} />

        {/* Grid */}
        <Grid
          cellSize={1}
          cellThickness={0.5}
          cellColor="#6EC72D"
          sectionSize={5}
          sectionThickness={1}
          sectionColor="#4E9020"
          fadeDistance={30}
          fadeStrength={1}
          followCamera={false}
          infiniteGrid
        />

        {/* Machine */}
        <MachineModel />

        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={3}
          maxDistance={20}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

      {/* Overlay info */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        color: '#6EC72D',
        fontSize: '0.75rem',
        fontWeight: 600,
        backgroundColor: 'rgba(26, 26, 26, 0.8)',
        padding: '8px 12px',
        borderRadius: '4px',
        border: '1px solid rgba(110, 199, 45, 0.3)'
      }}>
        APOLLO GROOMER 1001
      </div>
    </div>
  )
}

export default IsometricView
