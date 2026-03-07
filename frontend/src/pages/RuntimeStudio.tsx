import { useEffect, useMemo, useState } from 'react'
import { Box, Paper, Typography } from '@mui/material'
import Header from '../components/Header'
import Coobie from '../components/Coobie'
import RuntimeShell from '../components/runtime/RuntimeShell'
import { RuntimeSection } from '../components/runtime/SectionNav'
import RuntimeNodeList from '../components/runtime/RuntimeNodeList'
import RuntimeNodeEditor from '../components/runtime/RuntimeNodeEditor'
import DriverCatalogPanel from '../components/runtime/DriverCatalogPanel'
import DriverInstanceEditor from '../components/runtime/DriverInstanceEditor'
import BindingDesigner from '../components/runtime/BindingDesigner'
import AuthorityPanel from '../components/runtime/AuthorityPanel'
import apiService from '../services/apiService'
import { RuntimeNode } from '../types/runtime'
import { DriverCatalogEntry, DriverInstance } from '../types/driver'
import { PeaBinding } from '../types/binding'
import { AuthorityState } from '../types/authority'
import { PeaConfig } from '../types/mtp'

export default function RuntimeStudio() {
  const [section, setSection] = useState<RuntimeSection>('runtime')
  const [peas, setPeas] = useState<PeaConfig[]>([])
  const [nodes, setNodes] = useState<RuntimeNode[]>([])
  const [catalog, setCatalog] = useState<DriverCatalogEntry[]>([])
  const [drivers, setDrivers] = useState<DriverInstance[]>([])
  const [bindings, setBindings] = useState<PeaBinding[]>([])
  const [authority, setAuthority] = useState<AuthorityState | null>(null)
  const [selectedNode, setSelectedNode] = useState<RuntimeNode | null>(null)

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.runtime_node_id === selectedNode?.id) ?? null,
    [drivers, selectedNode]
  )
  const selectedBinding = useMemo(
    () => bindings.find((binding) => binding.runtime_node_id === selectedNode?.id) ?? null,
    [bindings, selectedNode]
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
    if (!selectedNode && nodeData.length > 0) setSelectedNode(nodeData[0])
    if (!authority && peaData.length > 0) {
      setAuthority(await apiService.getAuthority(peaData[0].id))
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const workspace = (() => {
    switch (section) {
      case 'runtime':
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 2, height: '100%' }}>
            <RuntimeNodeList nodes={nodes} selectedId={selectedNode?.id} onSelect={setSelectedNode} />
            <RuntimeNodeEditor
              node={selectedNode}
              peas={peas}
              onCreate={async (payload) => {
                await apiService.createRuntimeNode(payload)
                await loadAll()
              }}
              onTest={async (nodeId) => {
                await apiService.testRuntimeNode(nodeId)
              }}
            />
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
              onCreate={async (payload) => {
                await apiService.createDriver(payload)
                await loadAll()
              }}
              onStart={async (id) => {
                await apiService.startDriver(id)
                await loadAll()
              }}
              onStop={async (id) => {
                await apiService.stopDriver(id)
                await loadAll()
              }}
            />
          </Box>
        )
      case 'binding':
        return (
          <BindingDesigner
            runtimeNode={selectedNode}
            driver={selectedDriver}
            binding={selectedBinding}
            onCreate={async (payload) => {
              await apiService.createBinding(payload)
              await loadAll()
            }}
            onValidate={async (id) => {
              await apiService.validateBinding(id)
              await loadAll()
            }}
          />
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
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>PEA Engineering Compatibility View</Typography>
            <Typography variant="body2" color="text.secondary">Legacy PEA engineering remains available in the existing editor. Runtime Studio now treats PEA definitions as deployment targets for ARM runtime nodes and Neuron drivers.</Typography>
          </Paper>
        )
    }
  })()

  const inspectorLines = selectedNode
    ? [
        `Node: ${selectedNode.name}`,
        `Host: ${selectedNode.host}`,
        `Architecture: ${selectedNode.architecture}`,
        `Status: ${selectedNode.status}`,
        `Assigned PEA: ${selectedNode.assigned_pea_id ?? 'unassigned'}`,
        `Driver: ${selectedDriver?.driver_key ?? 'none'}`,
      ]
    : ['Select a runtime node to inspect health, binding status, and deployment context.']

  return (
    <Box sx={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Header />
      <Box sx={{ flex: 1, p: 2, overflow: 'hidden', background: 'radial-gradient(circle at top left, rgba(155,74,33,0.22), transparent 35%), linear-gradient(180deg, #1f130d 0%, #120c09 100%)' }}>
        <Box sx={{ borderBottom: '1px solid rgba(255,255,255,0.08)', mb: 2, pb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '0.04em' }}>Runtime Studio</Typography>
          <Typography variant="body2" color="text.secondary">ARM runtime nodes, Neuron drivers, bindings, and authority control.</Typography>
        </Box>
        <RuntimeShell
          section={section}
          onSectionChange={setSection}
          workspace={workspace}
          inspectorTitle="Runtime Inspector"
          inspectorLines={inspectorLines}
          inspectorStatus={selectedBinding && !selectedBinding.validation.valid ? 'warn' : 'ok'}
        />
      </Box>
      <Box sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}>
        <Coobie />
      </Box>
    </Box>
  )
}
