import React, { Suspense, useEffect, useMemo, useState } from 'react'
import { Paper, Typography, Box, ButtonGroup, Button, Alert, List, ListItemButton, ListItemText, Chip, Divider } from '@mui/material'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Environment, useGLTF } from '@react-three/drei'
import apiService from '../../services/apiService'
import { PeaConfig } from '../../types/mtp'

const MODEL_OPTIONS = [
  { label: 'Factory 1', path: '/heptapod-assets/models/factory_ex_1.glb' },
  { label: 'Factory 2', path: '/heptapod-assets/models/factory_ex_2.glb' },
  { label: 'Factory 3', path: '/heptapod-assets/models/factory_ex_3.glb' },
  { label: 'Factory 4', path: '/heptapod-assets/models/factory_ex_4.glb' },
]

const STATIC_ASSET_TYPES = [
  {
    type_id: 'asset-coobie',
    label: 'Coobie',
    path: '/heptapod-assets/models/server.glb',
    sprite_path: '/heptapod-assets/sprites/people/coobie.png',
    category: 'people',
  },
  {
    type_id: 'asset-worker-1',
    label: 'Worker',
    path: '/heptapod-assets/models/server.glb',
    sprite_path: '/heptapod-assets/sprites/people/worker1.png',
    category: 'people',
  },
  {
    type_id: 'asset-router',
    label: 'Router',
    path: '/heptapod-assets/models/server.glb',
    sprite_path: '/heptapod-assets/sprites/NetworkMenegment/Router.png',
    category: 'network',
  },
  {
    type_id: 'asset-iem',
    label: 'IEM',
    path: '/heptapod-assets/models/server.glb',
    sprite_path: '/heptapod-assets/sprites/NetworkMenegment/IEM.png',
    category: 'network',
  },
  {
    type_id: 'asset-ied',
    label: 'IED',
    path: '/heptapod-assets/models/server.glb',
    sprite_path: '/heptapod-assets/sprites/NetworkMenegment/IED.png',
    category: 'network',
  },
  {
    type_id: 'asset-plc',
    label: 'PLC',
    path: '/heptapod-assets/models/server.glb',
    sprite_path: '/heptapod-assets/sprites/NetworkMenegment/PLC.png',
    category: 'network',
  },
  {
    type_id: 'asset-robot',
    label: 'Robot',
    path: '/heptapod-assets/models/factory_ex_3.glb',
    sprite_path: '/heptapod-assets/sprites/machines/robot.png',
    category: 'machines',
  },
  {
    type_id: 'asset-generator',
    label: 'Generator',
    path: '/heptapod-assets/models/factory_ex_4.glb',
    sprite_path: '/heptapod-assets/sprites/machines/generator.png',
    category: 'machines',
  },
  {
    type_id: 'asset-mixer',
    label: 'Mixer',
    path: '/heptapod-assets/models/factory_ex_2.glb',
    sprite_path: '/heptapod-assets/sprites/machines/mixer.png',
    category: 'machines',
  },
  {
    type_id: 'asset-pump-jack',
    label: 'Pump Jack',
    path: '/heptapod-assets/models/factory_ex_1.glb',
    sprite_path: '/heptapod-assets/sprites/oilgas/pump_jack.png',
    category: 'oilgas',
  },
  {
    type_id: 'asset-compressor',
    label: 'Compressor',
    path: '/heptapod-assets/models/factory_ex_2.glb',
    sprite_path: '/heptapod-assets/sprites/oilgas/compressor.png',
    category: 'oilgas',
  },
  {
    type_id: 'asset-storage-tank',
    label: 'Storage Tank',
    path: '/heptapod-assets/models/factory_ex_4.glb',
    sprite_path: '/heptapod-assets/sprites/tanks/tank3.png',
    category: 'tanks',
  },
]

const SceneModel: React.FC<{ modelPath: string }> = ({ modelPath }) => {
  const { scene } = useGLTF(modelPath)
  const cloned = useMemo(() => scene.clone(true), [scene])
  return <primitive object={cloned} position={[0, -0.7, 0]} />
}

type PaletteType = {
  type_id: string
  label: string
  path: string
  sprite_path: string
  category: string
  pea_id?: string
}

type PlacedAsset = {
  id: string
  type_id: string
  label: string
  model_path: string
  position: [number, number, number]
}

const IsometricWorkbench: React.FC = () => {
  const [modelPath, setModelPath] = useState(MODEL_OPTIONS[0].path)
  const [peas, setPeas] = useState<PeaConfig[]>([])
  const [assets, setAssets] = useState<PlacedAsset[]>([])

  useEffect(() => {
    const loadPeas = async () => {
      try {
        const list = await apiService.listPeas()
        setPeas(list)
      } catch {
        setPeas([])
      }
    }
    void loadPeas()
  }, [])

  const palette = useMemo<PaletteType[]>(() => {
    const peaTypes = peas.map((pea, index) => ({
      type_id: `pea-${pea.id}`,
      label: pea.name || `PEA ${index + 1}`,
      path: '/heptapod-assets/models/server.glb',
      sprite_path: '/heptapod-assets/sprites/NetworkMenegment/PLC.png',
      category: 'pea',
      pea_id: pea.id,
    }))
    return [...peaTypes, ...STATIC_ASSET_TYPES]
  }, [peas])

  const onDragStartAsset = (type: PaletteType) => (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('application/json', JSON.stringify(type))
    event.dataTransfer.effectAllowed = 'copy'
  }

  const onDragOverCanvas = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  const onDropCanvas = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/json')
    if (!raw) return
    let parsed: PaletteType | null = null
    try {
      parsed = JSON.parse(raw) as PaletteType
    } catch {
      parsed = null
    }
    if (!parsed?.path) return

    const rect = event.currentTarget.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    const x = (px - 0.5) * 20
    const z = (py - 0.5) * 20

    setAssets(prev => [
      ...prev,
      {
        id: `${parsed.type_id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        type_id: parsed.type_id,
        label: parsed.label,
        model_path: parsed.path,
        position: [x, 0, z],
      },
    ])
  }

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6">Isometric Workbench</Typography>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Drag asset types from the left panel into the 3D workspace. PEA types are included as placeable assets.
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

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '280px 1fr', gap: 1.5 }}>
        <Box sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 1.5, py: 1, bgcolor: 'rgba(44, 69, 27, 0.25)', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2">Asset Types</Typography>
            <Typography variant="caption" color="text.secondary">
              Drag onto workspace
            </Typography>
          </Box>
          <List dense sx={{ overflow: 'auto', py: 0 }}>
            {palette.map(item => (
              <React.Fragment key={item.type_id}>
                <ListItemButton draggable onDragStart={onDragStartAsset(item)}>
                  <Box
                    component="img"
                    src={item.sprite_path}
                    alt={item.label}
                    sx={{
                      width: 36,
                      height: 36,
                      mr: 1.25,
                      objectFit: 'contain',
                      borderRadius: 0.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      bgcolor: 'rgba(11, 24, 6, 0.5)',
                      p: 0.25,
                    }}
                  />
                  <ListItemText
                    primary={item.label}
                    secondary={item.pea_id ? `PEA • ${item.pea_id}` : item.category}
                    primaryTypographyProps={{ sx: { fontSize: '0.85rem', fontWeight: 600 } }}
                    secondaryTypographyProps={{ sx: { fontSize: '0.72rem' } }}
                  />
                  <Chip size="small" label={item.pea_id ? 'PEA' : 'Sprite'} />
                </ListItemButton>
                <Divider />
              </React.Fragment>
            ))}
          </List>
        </Box>

        <Box
          onDragOver={onDragOverCanvas}
          onDrop={onDropCanvas}
          sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
        >
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
              {assets.map(asset => (
                <group key={asset.id} position={asset.position}>
                  <SceneModel modelPath={asset.model_path} />
                </group>
              ))}
            </Suspense>
            <axesHelper args={[3]} />
            <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={2} maxDistance={30} />
          </Canvas>
        </Box>
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
