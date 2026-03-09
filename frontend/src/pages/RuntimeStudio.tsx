import { useEffect, useMemo, useState } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import Header from '../components/Header'
import Coobie from '../components/Coobie'
import RuntimeShell from '../components/runtime/RuntimeShell'
import { RuntimeSection } from '../components/runtime/SectionNav'
import RuntimeNodeList from '../components/runtime/RuntimeNodeList'
import RuntimeNodeEditor from '../components/runtime/RuntimeNodeEditor'
import RuntimeHealthPanel from '../components/runtime/RuntimeHealthPanel'
import DriverCatalogPanel from '../components/runtime/DriverCatalogPanel'
import DriverInstanceEditor from '../components/runtime/DriverInstanceEditor'
import BindingDesigner from '../components/runtime/BindingDesigner'
import BindingHistoryPanel from '../components/runtime/BindingHistoryPanel'
import AuthorityPanel from '../components/runtime/AuthorityPanel'
import apiService from '../services/apiService'
import zenohService from '../services/zenohService'
import { RuntimeNode, RuntimeNodeStatusSnapshot } from '../types/runtime'
import { DriverCatalogEntry, DriverInstance, DriverSchemaPayload, DriverStatusSnapshot } from '../types/driver'
import { PeaBinding } from '../types/binding'
import { AuthorityState } from '../types/authority'
import { PeaConfig } from '../types/mtp'

const runtimeFrameOverlay =
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1400 920'%3E%3Cg fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M28 96C114 108 158 74 230 84C312 95 356 140 420 126C496 109 536 54 616 62C696 69 742 139 819 133C908 127 962 52 1048 64C1129 75 1171 133 1252 127C1305 123 1336 104 1372 92' stroke='%23482e1d' stroke-width='28'/%3E%3Cpath d='M30 98C116 110 160 76 230 86C312 97 356 142 420 128C496 111 536 56 616 64C696 71 742 141 819 135C908 129 962 54 1048 66C1129 77 1171 135 1252 129C1305 125 1336 106 1372 94' stroke='%23c69762' stroke-opacity='.56' stroke-width='10'/%3E%3Cpath d='M88 820C137 789 172 720 230 719C288 718 322 783 385 791C454 799 493 731 562 729C633 726 665 800 738 806C816 813 862 739 940 734C1018 729 1058 799 1132 799C1201 799 1247 752 1309 714' stroke='%23482e1d' stroke-width='28'/%3E%3Cpath d='M88 820C137 789 172 720 230 719C288 718 322 783 385 791C454 799 493 731 562 729C633 726 665 800 738 806C816 813 862 739 940 734C1018 729 1058 799 1132 799C1201 799 1247 752 1309 714' stroke='%23c69762' stroke-opacity='.52' stroke-width='10'/%3E%3Cpath d='M66 122C90 216 82 308 74 402C67 487 66 586 85 698C92 738 89 777 78 820' stroke='%23482e1d' stroke-width='24'/%3E%3Cpath d='M66 122C90 216 82 308 74 402C67 487 66 586 85 698C92 738 89 777 78 820' stroke='%23c69762' stroke-opacity='.45' stroke-width='8'/%3E%3Cpath d='M1332 114C1300 202 1306 297 1312 389C1318 481 1321 584 1307 687C1300 740 1302 780 1312 814' stroke='%23482e1d' stroke-width='24'/%3E%3Cpath d='M1332 114C1300 202 1306 297 1312 389C1318 481 1321 584 1307 687C1300 740 1302 780 1312 814' stroke='%23c69762' stroke-opacity='.45' stroke-width='8'/%3E%3Cpath d='M310 130C287 172 259 196 223 212' stroke='%236ea34a' stroke-opacity='.75' stroke-width='5'/%3E%3Cpath d='M1053 130C1080 170 1107 192 1148 208' stroke='%236ea34a' stroke-opacity='.7' stroke-width='5'/%3E%3Cpath d='M109 733C139 690 173 664 210 650' stroke='%23f0c36a' stroke-opacity='.55' stroke-width='5'/%3E%3Cpath d='M1205 703C1231 672 1260 651 1291 642' stroke='%23f0c36a' stroke-opacity='.55' stroke-width='5'/%3E%3Cg fill='%2350331f' stroke='%23a77445' stroke-width='6'%3E%3Ccircle cx='162' cy='705' r='30'/%3E%3Ccircle cx='1190' cy='164' r='34'/%3E%3Ccircle cx='1235' cy='714' r='27'/%3E%3C/g%3E%3Cg stroke='%236b472c' stroke-width='4'%3E%3Cpath d='M162 680V730M137 705H187M144 688L180 722M180 688L144 722'/%3E%3Cpath d='M1190 135V193M1161 164H1219M1169 143L1211 185M1211 143L1169 185'/%3E%3Cpath d='M1235 688V740M1209 714H1261M1217 696L1253 732M1253 696L1217 732'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`

export default function RuntimeStudio() {
  const [section, setSection] = useState<RuntimeSection>('runtime')
  const [peas, setPeas] = useState<PeaConfig[]>([])
  const [nodes, setNodes] = useState<RuntimeNode[]>([])
  const [catalog, setCatalog] = useState<DriverCatalogEntry[]>([])
  const [drivers, setDrivers] = useState<DriverInstance[]>([])
  const [bindings, setBindings] = useState<PeaBinding[]>([])
  const [authority, setAuthority] = useState<AuthorityState | null>(null)
  const [driverSchema, setDriverSchema] = useState<DriverSchemaPayload | null>(null)
  const [driverStatus, setDriverStatus] = useState<DriverStatusSnapshot | null>(null)
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeNodeStatusSnapshot | null>(null)
  const [bindingValues, setBindingValues] = useState<Record<string, unknown>>({})
  const [selectedNode, setSelectedNode] = useState<RuntimeNode | null>(null)

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.runtime_node_id === selectedNode?.id) ?? null,
    [drivers, selectedNode]
  )
  const selectedBinding = useMemo(
    () => bindings.find((binding) => binding.runtime_node_id === selectedNode?.id) ?? null,
    [bindings, selectedNode]
  )
  const selectedPea = useMemo(
    () => peas.find((pea) => pea.id === selectedNode?.assigned_pea_id) ?? null,
    [peas, selectedNode]
  )

  const loadAll = async () => {
    const [peaData, nodeData, catalogData, driverData, bindingData] = await Promise.all([
      apiService.listPeas(),
      apiService.listRuntimeNodes(),
      apiService.getDriverCatalog(),
      apiService.listDrivers(),
      apiService.listBindings(),
    ])
    setPeas(peaData)
    setNodes(nodeData)
    setCatalog(catalogData)
    setDrivers(driverData)
    setBindings(bindingData)
    setSelectedNode((current) => {
      if (!nodeData.length) return null
      if (!current) return nodeData[0]
      return nodeData.find((node) => node.id === current.id) ?? nodeData[0]
    })
    if (!authority && peaData.length > 0) {
      setAuthority(await apiService.getAuthority(peaData[0].id))
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  useEffect(() => {
    const loadDriverContext = async () => {
      if (!selectedNode) {
        setDriverSchema(null)
        setDriverStatus(null)
        return
      }

      try {
        setDriverSchema(await apiService.getDriverSchema(selectedDriver?.driver_key ?? 'siemens-s7', selectedNode.id))
      } catch {
        setDriverSchema(null)
      }

      if (selectedDriver) {
        try {
          setDriverStatus(await apiService.getDriverStatus(selectedDriver.id))
        } catch {
          setDriverStatus(null)
        }
      } else {
        setDriverStatus(null)
      }
    }

    void loadDriverContext()
  }, [selectedNode, selectedDriver?.id, selectedDriver?.driver_key])

  useEffect(() => {
    if (!selectedNode) {
      setRuntimeStatus(null)
      return
    }

    let cancelled = false
    const topic = `murph/runtime/nodes/${selectedNode.id}/status`
    const loadSnapshot = async () => {
      try {
        const snapshot = await apiService.getRuntimeNodeStatus(selectedNode.id)
        if (cancelled) return
        setRuntimeStatus(snapshot)
        setNodes((current) =>
          current.map((node) =>
            node.id === snapshot.runtime_node_id ? { ...node, status: snapshot.status } : node
          )
        )
        setSelectedNode((current) =>
          current && current.id === snapshot.runtime_node_id
            ? { ...current, status: snapshot.status }
            : current
        )
      } catch {
        if (!cancelled) setRuntimeStatus(null)
      }
    }

    void loadSnapshot()
    const unsubscribe = zenohService.subscribe(topic, (payload) => {
      if (cancelled) return
      const parsed = typeof payload === 'string'
        ? (() => {
            try {
              return JSON.parse(payload) as RuntimeNodeStatusSnapshot
            } catch {
              return null
            }
          })()
        : (payload as RuntimeNodeStatusSnapshot)
      if (!parsed) return
      setRuntimeStatus(parsed)
      setNodes((current) =>
        current.map((node) =>
          node.id === parsed.runtime_node_id ? { ...node, status: parsed.status } : node
        )
      )
      setSelectedNode((current) =>
        current && current.id === parsed.runtime_node_id
          ? { ...current, status: parsed.status }
          : current
      )
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [selectedNode?.id])

  useEffect(() => {
    if (!selectedDriver) return

    let cancelled = false
    const topic = `murph/runtime/nodes/${selectedDriver.runtime_node_id}/drivers/${selectedDriver.id}/status`
    const refresh = async () => {
      try {
        const status = await apiService.getDriverStatus(selectedDriver.id)
        if (!cancelled) setDriverStatus(status)
      } catch {
        if (!cancelled) setDriverStatus(null)
      }
    }

    void refresh()
    const unsubscribe = zenohService.subscribe(topic, (payload) => {
      if (cancelled) return
      if (typeof payload === 'string') {
        try {
          setDriverStatus(JSON.parse(payload) as DriverStatusSnapshot)
        } catch {
          return
        }
        return
      }
      setDriverStatus(payload as DriverStatusSnapshot)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [selectedDriver?.id])

  useEffect(() => {
    if (!selectedBinding) {
      setBindingValues({})
      return
    }

    let cancelled = false
    const readableMappings = selectedBinding.mappings.filter(
      (mapping) => mapping.direction === 'ReadFromDriver' || mapping.direction === 'Bidirectional'
    )
    const topic = `murph/runtime/nodes/${selectedBinding.runtime_node_id}/pea/${selectedBinding.pea_id}/bindings/*/value`
    setBindingValues({})

    const seedSnapshot = async () => {
      const results = await Promise.allSettled(
        readableMappings.map((mapping) =>
          apiService.readBindingTag(selectedBinding.id, { canonical_tag: mapping.canonical_tag })
        )
      )

      if (cancelled) return

      setBindingValues((current) => {
        const next = { ...current }
        readableMappings.forEach((mapping, index) => {
          const result = results[index]
          if (result?.status === 'fulfilled') {
            next[mapping.canonical_tag] = result.value.result.value
          }
        })
        return next
      })
    }

    void seedSnapshot()
    const unsubscribe = zenohService.subscribe(topic, (payload) => {
      if (cancelled) return

      const parsed = typeof payload === 'string'
        ? (() => {
            try {
              return JSON.parse(payload) as {
                binding_id: string
                canonical_tag: string
                result?: { value?: unknown }
                value?: unknown
              }
            } catch {
              return null
            }
          })()
        : (payload as {
            binding_id: string
            canonical_tag: string
            result?: { value?: unknown }
            value?: unknown
            _key?: string
          })

      if (!parsed || parsed.binding_id !== selectedBinding.id || !parsed.canonical_tag) {
        return
      }

      const value = parsed.result?.value ?? parsed.value
      setBindingValues((current) => ({
        ...current,
        [parsed.canonical_tag]: value,
      }))
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [selectedBinding?.id, selectedBinding?.mappings])

  const workspace = (() => {
    switch (section) {
      case 'runtime':
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: '280px 1fr 340px', gap: 2, height: '100%' }}>
            <RuntimeNodeList nodes={nodes} selectedId={selectedNode?.id} onSelect={setSelectedNode} />
            <RuntimeNodeEditor
              node={selectedNode}
              peas={peas}
              onCreate={async (payload) => {
                await apiService.createRuntimeNode(payload)
                await loadAll()
              }}
              onUpdate={async (id, payload) => {
                await apiService.updateRuntimeNode(id, payload)
                await loadAll()
              }}
              onTest={async (nodeId) => {
                return apiService.testRuntimeNode(nodeId)
              }}
            />
            <RuntimeHealthPanel node={selectedNode} status={runtimeStatus} />
          </Box>
        )
      case 'driver':
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 2, height: '100%' }}>
            <DriverCatalogPanel catalog={catalog} />
            <DriverInstanceEditor
              runtimeNode={selectedNode}
              driver={selectedDriver}
              catalog={catalog}
              schema={driverSchema}
              status={driverStatus}
              onCreate={async (payload) => {
                await apiService.createDriver(payload)
                await loadAll()
              }}
              onUpdate={async (id, payload) => {
                await apiService.updateDriver(id, payload)
                await loadAll()
                setDriverStatus(await apiService.getDriverStatus(id))
              }}
              onStart={async (id) => {
                await apiService.startDriver(id)
                await loadAll()
                setDriverStatus(await apiService.getDriverStatus(id))
              }}
              onStop={async (id) => {
                await apiService.stopDriver(id)
                await loadAll()
                setDriverStatus(await apiService.getDriverStatus(id))
              }}
              onRead={async (id, tagId) => {
                await apiService.readDriverTag(id, { tag_id: tagId })
                setDriverStatus(await apiService.getDriverStatus(id))
              }}
              onWrite={async (id, tagId, value, peaId) => {
                await apiService.writeDriverTag(id, {
                  tag_id: tagId,
                  value,
                  pea_id: peaId,
                  actor_id: 'operator-console-1',
                  actor_class: 'Operator',
                })
                setDriverStatus(await apiService.getDriverStatus(id))
              }}
            />
          </Box>
        )
      case 'binding':
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1.6fr 0.9fr', gap: 2, height: '100%' }}>
            <BindingDesigner
              runtimeNode={selectedNode}
              driver={selectedDriver}
              binding={selectedBinding}
              pea={selectedPea}
              onCreate={async (payload) => {
                await apiService.createBinding(payload)
                await loadAll()
              }}
              onUpdate={async (id, payload) => {
                await apiService.updateBinding(id, payload)
                await loadAll()
              }}
              onValidate={async (id) => {
                await apiService.validateBinding(id)
                await loadAll()
              }}
              onRead={async (bindingId, canonicalTag) => {
                const result = await apiService.readBindingTag(bindingId, { canonical_tag: canonicalTag })
                setBindingValues((current) => ({
                  ...current,
                  [canonicalTag]: result.result.value,
                }))
                if (selectedDriver) {
                  setDriverStatus(await apiService.getDriverStatus(selectedDriver.id))
                }
                return result
              }}
              onWrite={async (bindingId, canonicalTag, value) => {
                const result = await apiService.writeBindingTag(bindingId, {
                  canonical_tag: canonicalTag,
                  value,
                  actor_id: 'operator-console-1',
                  actor_class: 'Operator',
                })
                setBindingValues((current) => ({
                  ...current,
                  [canonicalTag]: value,
                }))
                if (selectedDriver) {
                  setDriverStatus(await apiService.getDriverStatus(selectedDriver.id))
                }
                return result
              }}
            />
            <BindingHistoryPanel binding={selectedBinding} bindingValues={bindingValues} />
          </Box>
        )
      case 'authority':
        return (
          <AuthorityPanel
            peas={peas}
            authority={authority}
            onLoad={async (peaId) => {
              setAuthority(await apiService.getAuthority(peaId))
            }}
            onSetMode={async (peaId, mode) => {
              await apiService.setAuthority(peaId, {
                mode,
                owner_actor_id: 'operator-console-1',
                owner_actor_class: 'Operator',
                reason: 'Runtime Studio mode change',
              })
              setAuthority(await apiService.getAuthority(peaId))
            }}
          />
        )
      case 'pea':
      default:
        return (
          <Paper sx={{ p: 3, height: '100%', backgroundImage: 'var(--ent-panel-surface), var(--ent-linework-soft), var(--ent-linework)', backgroundSize: 'auto, 320px 120px, 320px 120px' }}>
            <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.6 }}>
              Engineering Compatibility
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: 'secondary.light' }}>PEA Definition View</Typography>
            <Typography variant="body2" color="text.secondary">Legacy PEA engineering remains available in the existing editor. Runtime Studio now treats PEA definitions as deployment targets for ARM runtime nodes and pluggable southbound frontend adapters.</Typography>
          </Paper>
        )
    }
  })()

  const inspectorLines = selectedNode
    ? [
        `Node: ${selectedNode.name}`,
        `Host: ${selectedNode.host}`,
        `Architecture: ${selectedNode.architecture}`,
        `Status: ${runtimeStatus?.status ?? selectedNode.status}`,
        `Assigned PEA: ${selectedNode.assigned_pea_id ?? 'unassigned'}`,
        `Checks: ${runtimeStatus ? `${runtimeStatus.checks.filter((check) => check.ok).length}/${runtimeStatus.checks.length}` : 'pending'}`,
        `Driver: ${selectedDriver?.driver_key ?? 'none'}`,
        `Binding: ${selectedBinding ? `${selectedBinding.mappings.length} mapping(s)` : 'none'}`,
        `Binding valid: ${selectedBinding ? String(selectedBinding.validation.valid) : 'n/a'}`,
        `Remote running: ${String(driverStatus?.remote_running ?? false)}`,
        `Last read: ${driverStatus?.last_read ? `${driverStatus.last_read.tag_name}=${JSON.stringify(driverStatus.last_read.value)}` : 'none'}`,
        `Last write: ${driverStatus?.last_write ? `${driverStatus.last_write.tag_name}=${JSON.stringify(driverStatus.last_write.value)}` : 'none'}`,
        ...Object.entries(bindingValues)
          .slice(0, 4)
          .map(([canonicalTag, value]) => `${canonicalTag}: ${JSON.stringify(value)}`),
        ...(runtimeStatus?.checks.slice(0, 3).map((check) => `${check.name}: ${check.ok ? 'ok' : check.message}`) ?? []),
      ]
    : ['Select a runtime node to inspect health, binding status, and deployment context.']

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header />
      <Box
        sx={{
          flex: 1,
          p: 2,
          overflow: 'hidden',
          background:
            'radial-gradient(circle at 10% 2%, rgba(110,139,74,0.18), transparent 16%), radial-gradient(circle at 88% 6%, rgba(110,139,74,0.1), transparent 14%), radial-gradient(circle at top, rgba(240,195,106,0.08), transparent 24%), linear-gradient(180deg, #0d0906, #120c09 52%, #090604 100%)',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            height: '100%',
            borderRadius: '36px',
            background:
              'linear-gradient(180deg, rgba(19,12,8,0.98), rgba(10,7,5,0.98))',
            boxShadow: '0 20px 36px rgba(0,0,0,0.28)',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              inset: 0,
              borderRadius: '36px',
              pointerEvents: 'none',
              backgroundImage: runtimeFrameOverlay,
              backgroundSize: '100% 100%',
              backgroundRepeat: 'no-repeat',
              opacity: 0.98,
            },
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 16,
              borderRadius: '28px',
              pointerEvents: 'none',
              border: '1px solid rgba(240,195,106,0.12)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 0 0 1px rgba(0,0,0,0.18)',
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              height: '100%',
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            }}
          >
            <Box
              sx={{
                p: 2.25,
                borderRadius: '24px',
                border: '1px solid rgba(240,195,106,0.14)',
                backgroundImage:
                  'radial-gradient(circle at 10% 14%, rgba(110,139,74,0.14), transparent 18%), radial-gradient(circle at 88% 12%, rgba(110,139,74,0.08), transparent 14%), linear-gradient(180deg, rgba(48,31,20,0.94), rgba(17,12,9,0.98)), var(--ent-linework-soft), var(--ent-linework)',
                backgroundSize: 'auto, auto, auto, 320px 120px, 320px 120px',
                boxShadow: '0 12px 22px rgba(0,0,0,0.18)',
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 0.6 }}>
                Ent Workshop Runtime Forge
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '0.06em', color: 'secondary.light', mb: 0.6 }}>
                Runtime Studio
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ARM runtime nodes, southbound frontend adapters, bindings, and authority control with carved shell surfaces inside a rooted control-room frame.
              </Typography>
            </Box>
            <Box sx={{ minHeight: 0, flex: 1 }}>
              <RuntimeShell
                section={section}
                onSectionChange={setSection}
                workspace={workspace}
                inspectorTitle="Runtime Inspector"
                inspectorLines={inspectorLines}
                inspectorStatus={driverStatus?.last_error ? 'error' : selectedBinding && !selectedBinding.validation.valid ? 'warn' : 'ok'}
              />
            </Box>
          </Box>
        </Box>
      </Box>
      <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
        <Coobie />
      </Box>
    </Box>
  )
}
