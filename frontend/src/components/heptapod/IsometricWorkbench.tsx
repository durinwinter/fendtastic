import React, { Suspense, useMemo, useState } from 'react'
import { Paper, Typography, Box, ButtonGroup, Button, Alert } from '@mui/material'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, useGLTF } from '@react-three/drei'

const MODEL_OPTIONS = [
  { label: 'Factory 1', path: '/heptapod-assets/models/factory_ex_1.glb' },
  { label: 'Factory 2', path: '/heptapod-assets/models/factory_ex_2.glb' },
  { label: 'Factory 3', path: '/heptapod-assets/models/factory_ex_3.glb' },
  { label: 'Factory 4', path: '/heptapod-assets/models/factory_ex_4.glb' },
  { label: 'Server', path: '/heptapod-assets/models/server.glb' },
]

const SceneModel: React.FC<{ modelPath: string }> = ({ modelPath }) => {
  const { scene } = useGLTF(modelPath)
  const cloned = useMemo(() => scene.clone(true), [scene])
  return <primitive object={cloned} position={[0, -0.7, 0]} />
}

const IsometricWorkbench: React.FC = () => {
  const [modelPath, setModelPath] = useState(MODEL_OPTIONS[0].path)

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6">Isometric Workbench</Typography>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Assets imported from Heptapod Explorer. Use this as the shared visual model foundation.
      </Alert>
      <ButtonGroup size="small" sx={{ flexWrap: 'wrap' }}>
        {MODEL_OPTIONS.map(opt => (
          <Button
            key={opt.path}
            variant={modelPath === opt.path ? 'contained' : 'outlined'}
            onClick={() => setModelPath(opt.path)}
          >
            {opt.label}
          </Button>
        ))}
      </ButtonGroup>

      <Box sx={{ flex: 1, borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
        <Canvas camera={{ position: [8, 8, 8], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[10, 15, 10]} intensity={1.2} />
          <Environment preset="city" />
          <Grid
            cellSize={1}
            cellThickness={0.6}
            cellColor="#74b816"
            sectionSize={5}
            sectionThickness={1.4}
            sectionColor="#2f5d16"
            fadeDistance={60}
            infiniteGrid
          />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, 0]} receiveShadow>
            <planeGeometry args={[40, 40]} />
            <meshStandardMaterial color="#102611" />
          </mesh>

          <Suspense fallback={null}>
            <SceneModel modelPath={modelPath} />
          </Suspense>
          <axesHelper args={[3]} />
          <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={2} maxDistance={30} />
        </Canvas>
      </Box>
    </Paper>
  )
}

useGLTF.preload('/heptapod-assets/models/factory_ex_1.glb')
useGLTF.preload('/heptapod-assets/models/factory_ex_2.glb')
useGLTF.preload('/heptapod-assets/models/factory_ex_3.glb')
useGLTF.preload('/heptapod-assets/models/factory_ex_4.glb')
useGLTF.preload('/heptapod-assets/models/server.glb')

export default IsometricWorkbench
