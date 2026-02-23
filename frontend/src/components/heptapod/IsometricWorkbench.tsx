import React, { Suspense, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Slider,
  Stack,
  Typography,
} from '@mui/material'
import { Add, Close, DeleteOutline, Link as LinkIcon } from '@mui/icons-material'
import { Canvas } from '@react-three/fiber'
import { Environment, Grid, Line, OrbitControls, useGLTF, useTexture } from '@react-three/drei'
import apiService from '../../services/apiService'
import { createEmptyService, PeaConfig, ServiceConfig } from '../../types/mtp'
import ServiceEditor from '../pea-launcher/ServiceEditor'

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
    sprite_path: '/heptapod-assets/sprites/people/coobie.png',
    category: 'people',
  },
  {
    type_id: 'asset-worker-1',
    label: 'Worker',
    sprite_path: '/heptapod-assets/sprites/people/worker1.png',
    category: 'people',
  },
  {
    type_id: 'asset-router',
    label: 'Router',
    sprite_path: '/heptapod-assets/sprites/NetworkMenegment/Router.png',
    category: 'network',
  },
  {
    type_id: 'asset-iem',
    label: 'IEM',
    sprite_path: '/heptapod-assets/sprites/NetworkMenegment/IEM.png',
    category: 'network',
  },
  {
    type_id: 'asset-ied',
    label: 'IED',
    sprite_path: '/heptapod-assets/sprites/NetworkMenegment/IED.png',
    category: 'network',
  },
  {
    type_id: 'asset-plc',
    label: 'PLC',
    sprite_path: '/heptapod-assets/sprites/NetworkMenegment/PLC.png',
    category: 'network',
  },
  {
    type_id: 'asset-robot',
    label: 'Robot',
    sprite_path: '/heptapod-assets/sprites/machines/robot.png',
    category: 'machines',
  },
  {
    type_id: 'asset-generator',
    label: 'Generator',
    sprite_path: '/heptapod-assets/sprites/machines/generator.png',
    category: 'machines',
  },
  {
    type_id: 'asset-mixer',
    label: 'Mixer',
    sprite_path: '/heptapod-assets/sprites/machines/mixer.png',
    category: 'machines',
  },
  {
    type_id: 'asset-pump-jack',
    label: 'Pump Jack',
    sprite_path: '/heptapod-assets/sprites/oilgas/pump_jack.png',
    category: 'oilgas',
  },
  {
    type_id: 'asset-compressor',
    label: 'Compressor',
    sprite_path: '/heptapod-assets/sprites/oilgas/compressor.png',
    category: 'oilgas',
  },
  {
    type_id: 'asset-storage-tank',
    label: 'Storage Tank',
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
  sprite_path: string
  category: string
  pea_id?: string
}

type PlacedAsset = {
  id: string
  type_id: string
  label: string
  sprite_path: string
  category: string
  pea_id?: string
  position: [number, number, number]
  scale: number
}

type SpriteConnection = {
  id: string
  from_id: string
  to_id: string
}

type SpriteServiceConfig = {
  services: ServiceConfig[]
}

type LinkDraft = {
  from_id: string
  to_position: [number, number, number]
}

const DroppedSprite: React.FC<{
  asset: PlacedAsset
  selected: boolean
  onPointerDown: (assetId: string, point: [number, number, number], event: unknown) => void
  onPointerUp: (assetId: string, point: [number, number, number], event: unknown) => void
  onDoubleClick: (assetId: string, event: unknown) => void
}> = ({ asset, selected, onPointerDown, onPointerUp, onDoubleClick }) => {
  const texture = useTexture(asset.sprite_path)
  const size = 1.1 * asset.scale

  return (
    <group position={[asset.position[0], 0, asset.position[2]]}>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <ringGeometry args={[0.45 * asset.scale, 0.62 * asset.scale, 32]} />
          <meshBasicMaterial color="#9ef01a" transparent opacity={0.9} />
        </mesh>
      )}
      <sprite
        position={[0, 0.1 + size * 0.4, 0]}
        scale={[size, size, size]}
        onPointerDown={(event) => {
          event.stopPropagation()
          onPointerDown(asset.id, asset.position, event)
        }}
        onPointerUp={(event) => {
          event.stopPropagation()
          onPointerUp(asset.id, asset.position, event)
        }}
        onDoubleClick={(event) => {
          event.stopPropagation()
          onDoubleClick(asset.id, event)
        }}
      >
        <spriteMaterial map={texture} transparent depthWrite={false} />
      </sprite>
    </group>
  )
}

const IsometricWorkbench: React.FC = () => {
  const [modelPath, setModelPath] = useState(MODEL_OPTIONS[0].path)
  const [peas, setPeas] = useState<PeaConfig[]>([])
  const [assets, setAssets] = useState<PlacedAsset[]>([])
  const [connections, setConnections] = useState<SpriteConnection[]>([])
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [draggingAssetId, setDraggingAssetId] = useState<string | null>(null)
  const [linkMode, setLinkMode] = useState(false)
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null)
  const [serviceConfigs, setServiceConfigs] = useState<Record<string, SpriteServiceConfig>>({})
  const [activeAssetId, setActiveAssetId] = useState<string | null>(null)

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

  const assetById = useMemo(() => {
    const map: Record<string, PlacedAsset> = {}
    assets.forEach((asset) => {
      map[asset.id] = asset
    })
    return map
  }, [assets])

  const palette = useMemo<PaletteType[]>(() => {
    const peaTypes = peas.map((pea, index) => ({
      type_id: `pea-${pea.id}`,
      label: pea.name || `PEA ${index + 1}`,
      sprite_path: '/heptapod-assets/sprites/NetworkMenegment/PLC.png',
      category: 'pea',
      pea_id: pea.id,
    }))
    return [...peaTypes, ...STATIC_ASSET_TYPES]
  }, [peas])

  const selectedAsset = selectedAssetId ? assetById[selectedAssetId] ?? null : null
  const activeAsset = activeAssetId ? assetById[activeAssetId] ?? null : null
  const activeConfig = activeAssetId ? serviceConfigs[activeAssetId] ?? { services: [] } : { services: [] }

  const syncPeaTopology = (nextConnections: SpriteConnection[]) => {
    const edges = nextConnections
      .map((conn) => {
        const from = assetById[conn.from_id]
        const to = assetById[conn.to_id]
        if (!from?.pea_id || !to?.pea_id || from.pea_id === to.pea_id) return null
        return { from: from.pea_id, to: to.pea_id }
      })
      .filter((edge): edge is { from: string; to: string } => edge !== null)

    const unique = Array.from(new Map(edges.map((edge) => [`${edge.from}->${edge.to}`, edge])).values())
    void apiService.putPolTopology(unique).catch(() => {})
  }

  const addConnection = (fromId: string, toId: string) => {
    if (fromId === toId) return
    if (!assetById[fromId] || !assetById[toId]) return

    setConnections((prev) => {
      if (prev.some((edge) => edge.from_id === fromId && edge.to_id === toId)) return prev
      const next = [...prev, { id: `${fromId}->${toId}`, from_id: fromId, to_id: toId }]
      syncPeaTopology(next)
      return next
    })
  }

  const removeConnection = (edgeId: string) => {
    setConnections((prev) => {
      const next = prev.filter((edge) => edge.id !== edgeId)
      syncPeaTopology(next)
      return next
    })
  }

  const clearConnections = () => {
    setConnections([])
    void apiService.putPolTopology([]).catch(() => {})
  }

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
    if (!parsed?.sprite_path) return

    const rect = event.currentTarget.getBoundingClientRect()
    const px = (event.clientX - rect.left) / rect.width
    const py = (event.clientY - rect.top) / rect.height
    const x = (px - 0.5) * 20
    const z = (py - 0.5) * 20

    const id = `${parsed.type_id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    setAssets((prev) => [
      ...prev,
      {
        id,
        type_id: parsed.type_id,
        label: parsed.label,
        sprite_path: parsed.sprite_path,
        category: parsed.category,
        pea_id: parsed.pea_id,
        position: [x, 0, z],
        scale: 1,
      },
    ])

    if (parsed.pea_id) {
      const pea = peas.find((p) => p.id === parsed.pea_id)
      if (pea) {
        setServiceConfigs((prev) => ({
          ...prev,
          [id]: { services: JSON.parse(JSON.stringify(pea.services)) as ServiceConfig[] },
        }))
      }
    }
    setSelectedAssetId(id)
  }

  const updateAsset = (assetId: string, updater: (asset: PlacedAsset) => PlacedAsset) => {
    setAssets((prev) => prev.map((asset) => (asset.id === assetId ? updater(asset) : asset)))
  }

  const onScenePointerMove = (event: { point: { x: number; z: number } }) => {
    const x = Math.max(-20, Math.min(20, event.point.x))
    const z = Math.max(-20, Math.min(20, event.point.z))

    if (draggingAssetId && !linkMode) {
      updateAsset(draggingAssetId, (asset) => ({ ...asset, position: [x, 0, z] }))
    }

    if (linkDraft && linkMode) {
      setLinkDraft((prev) => (prev ? { ...prev, to_position: [x, 0.1, z] } : prev))
    }
  }

  const onScenePointerUp = () => {
    setDraggingAssetId(null)
    if (linkDraft) setLinkDraft(null)
  }

  const onSpritePointerDown = (assetId: string, point: [number, number, number], event: unknown) => {
    const pointerEvent = event as { stopPropagation: () => void }
    pointerEvent.stopPropagation()
    setSelectedAssetId(assetId)

    if (linkMode) {
      setDraggingAssetId(null)
      setLinkDraft({ from_id: assetId, to_position: [point[0], 0.1, point[2]] })
      return
    }

    setDraggingAssetId(assetId)
  }

  const onSpritePointerUp = (assetId: string, point: [number, number, number], event: unknown) => {
    const pointerEvent = event as { stopPropagation: () => void }
    pointerEvent.stopPropagation()

    if (linkMode && linkDraft) {
      if (linkDraft.from_id !== assetId) addConnection(linkDraft.from_id, assetId)
      setLinkDraft(null)
    }

    setDraggingAssetId(null)
    setSelectedAssetId(assetId)
    updateAsset(assetId, (asset) => ({ ...asset, position: [point[0], 0, point[2]] }))
  }

  const changeSelectedScale = (_: Event, value: number | number[]) => {
    if (!selectedAssetId) return
    const numeric = Array.isArray(value) ? value[0] : value
    updateAsset(selectedAssetId, (asset) => ({ ...asset, scale: numeric }))
  }

  const updateActiveServices = (services: ServiceConfig[]) => {
    if (!activeAssetId) return
    setServiceConfigs((prev) => ({
      ...prev,
      [activeAssetId]: { services },
    }))
  }

  const addServiceToActive = () => {
    if (!activeAssetId) return
    const current = serviceConfigs[activeAssetId]?.services ?? []
    updateActiveServices([...current, createEmptyService()])
  }

  const executionHints = useMemo(() => {
    return connections.map((edge) => {
      const from = assetById[edge.from_id]
      const to = assetById[edge.to_id]
      return {
        id: edge.id,
        fromLabel: from?.label ?? edge.from_id,
        toLabel: to?.label ?? edge.to_id,
      }
    })
  }, [assetById, connections])

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6">Isometric Workbench</Typography>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Drag sprites onto the canvas. Double-click a sprite to edit services/procedures. Use Link Mode to drag execution order connections.
      </Alert>

      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <ButtonGroup size="small" sx={{ flexWrap: 'wrap' }}>
          {MODEL_OPTIONS.map((opt) => (
            <Button
              key={opt.path}
              variant={modelPath === opt.path ? 'contained' : 'outlined'}
              onClick={() => setModelPath(opt.path)}
            >
              {opt.label}
            </Button>
          ))}
        </ButtonGroup>
        <Button
          size="small"
          variant={linkMode ? 'contained' : 'outlined'}
          color={linkMode ? 'warning' : 'primary'}
          startIcon={<LinkIcon fontSize="small" />}
          onClick={() => {
            setLinkMode((prev) => !prev)
            setLinkDraft(null)
            setDraggingAssetId(null)
          }}
        >
          {linkMode ? 'Link Mode: ON' : 'Link Mode: OFF'}
        </Button>
        <Button size="small" variant="outlined" color="error" onClick={clearConnections}>
          Clear Links
        </Button>
        <Chip size="small" label={`${connections.length} execution links`} />
        {selectedAsset && (
          <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1, minWidth: 240 }}>
            <Typography variant="caption" sx={{ minWidth: 70 }}>
              Scale ({selectedAsset.label})
            </Typography>
            <Slider
              size="small"
              min={0.5}
              max={3}
              step={0.1}
              value={selectedAsset.scale}
              onChange={changeSelectedScale}
            />
          </Stack>
        )}
      </Stack>

      <Box sx={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '300px 1fr', gap: 1.5 }}>
        <Box sx={{ borderRadius: 1, border: '1px solid', borderColor: 'divider', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 1.5, py: 1, bgcolor: 'rgba(44, 69, 27, 0.25)', borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2">Asset Types</Typography>
            <Typography variant="caption" color="text.secondary">
              Drag onto workspace
            </Typography>
          </Box>
          <List dense sx={{ overflow: 'auto', py: 0, flex: 1 }}>
            {palette.map((item) => (
              <React.Fragment key={item.type_id + (item.pea_id ?? '')}>
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
          <Divider />
          <Box sx={{ p: 1.25, maxHeight: 170, overflow: 'auto' }}>
            <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
              Execution Order Links
            </Typography>
            {executionHints.length === 0 ? (
              <Typography variant="caption" color="text.secondary">No links yet.</Typography>
            ) : (
              <Stack spacing={0.75}>
                {executionHints.map((edge) => (
                  <Box key={edge.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Typography variant="caption" sx={{ flex: 1 }}>
                      {edge.fromLabel}{' -> '}{edge.toLabel}
                    </Typography>
                    <IconButton size="small" onClick={() => removeConnection(edge.id)}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </Box>

        <Box
          onDragOver={onDragOverCanvas}
          onDrop={onDropCanvas}
          sx={{ borderRadius: 1, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}
        >
          <Canvas camera={{ position: [8, 8, 8], fov: 45 }} onPointerUp={onScenePointerUp}>
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

            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.01, 0]}
              onPointerMove={(event) => onScenePointerMove(event as unknown as { point: { x: number; z: number } })}
              onPointerUp={onScenePointerUp}
            >
              <planeGeometry args={[60, 60]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>

            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.72, 0]} receiveShadow>
              <planeGeometry args={[40, 40]} />
              <meshStandardMaterial color="#102611" />
            </mesh>

            <Suspense fallback={null}>
              <SceneModel modelPath={modelPath} />

              {connections.map((edge) => {
                const from = assetById[edge.from_id]
                const to = assetById[edge.to_id]
                if (!from || !to) return null
                return (
                  <Line
                    key={edge.id}
                    points={[
                      [from.position[0], 0.3, from.position[2]],
                      [to.position[0], 0.3, to.position[2]],
                    ]}
                    color="#89c541"
                    lineWidth={2}
                  />
                )
              })}

              {linkDraft && assetById[linkDraft.from_id] && (
                <Line
                  points={[
                    [assetById[linkDraft.from_id].position[0], 0.35, assetById[linkDraft.from_id].position[2]],
                    [linkDraft.to_position[0], 0.35, linkDraft.to_position[2]],
                  ]}
                  color="#f9c74f"
                  lineWidth={2}
                />
              )}

              {assets.map((asset) => (
                <DroppedSprite
                  key={asset.id}
                  asset={asset}
                  selected={selectedAssetId === asset.id}
                  onPointerDown={onSpritePointerDown}
                  onPointerUp={onSpritePointerUp}
                  onDoubleClick={(assetId) => setActiveAssetId(assetId)}
                />
              ))}
            </Suspense>

            <axesHelper args={[3]} />
            <OrbitControls maxPolarAngle={Math.PI / 2.1} minDistance={2} maxDistance={30} />
          </Canvas>
        </Box>
      </Box>

      <Dialog
        open={Boolean(activeAsset)}
        onClose={() => setActiveAssetId(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6">Sprite Configuration: {activeAsset?.label ?? 'Asset'}</Typography>
            <Typography variant="caption" color="text.secondary">
              Add/Edit/Review services, procedures, and execution metadata for this placed sprite.
            </Typography>
          </Box>
          <IconButton onClick={() => setActiveAssetId(null)}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {activeAsset && (
            <Stack spacing={1.25}>
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="body2" sx={{ minWidth: 90 }}>
                  Sprite Scale
                </Typography>
                <Slider
                  min={0.5}
                  max={3}
                  step={0.1}
                  value={activeAsset.scale}
                  onChange={(_, value) => {
                    const numeric = Array.isArray(value) ? value[0] : value
                    updateAsset(activeAsset.id, (asset) => ({ ...asset, scale: numeric }))
                  }}
                />
                <Chip size="small" label={`${activeAsset.scale.toFixed(1)}x`} />
              </Stack>

              <Stack direction="row" spacing={1} alignItems="center">
                <Button size="small" variant="contained" startIcon={<Add />} onClick={addServiceToActive}>
                  Add Service
                </Button>
                <Chip size="small" label={`${activeConfig.services.length} services`} />
                {activeAsset.pea_id && <Chip size="small" color="success" label={`PEA ${activeAsset.pea_id}`} />}
              </Stack>

              {activeConfig.services.length === 0 ? (
                <Alert severity="info">No services yet for this sprite. Add one to start defining procedures.</Alert>
              ) : (
                activeConfig.services.map((service, idx) => (
                  <ServiceEditor
                    key={`${activeAsset.id}-svc-${idx}-${service.tag}`}
                    service={service}
                    onChange={(nextService) => {
                      const nextServices = [...activeConfig.services]
                      nextServices[idx] = nextService
                      updateActiveServices(nextServices)
                    }}
                    onDelete={() => {
                      updateActiveServices(activeConfig.services.filter((_, i) => i !== idx))
                    }}
                  />
                ))
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setActiveAssetId(null)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

useGLTF.preload('/heptapod-assets/models/factory_ex_1.glb')
useGLTF.preload('/heptapod-assets/models/factory_ex_2.glb')
useGLTF.preload('/heptapod-assets/models/factory_ex_3.glb')
useGLTF.preload('/heptapod-assets/models/factory_ex_4.glb')

export default IsometricWorkbench
