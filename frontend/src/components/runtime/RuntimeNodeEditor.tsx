import { useEffect, useState } from 'react'
import { Alert, Box, Button, MenuItem, Paper, TextField, Typography } from '@mui/material'
import { RuntimeNode, RuntimeNodeHealthCheck } from '../../types/runtime'
import { PeaConfig } from '../../types/mtp'

interface RuntimeNodeFormState {
  name: string
  architecture: RuntimeNode['architecture']
  host: string
  assigned_pea_id: string
  neuron: {
    base_url: string
    username: string
    password_ref: string
    config_path: string
    mode: RuntimeNode['neuron']['mode']
  }
}

interface RuntimeNodeEditorProps {
  node: RuntimeNode | null
  peas: PeaConfig[]
  onCreate: (payload: any) => Promise<void>
  onUpdate: (nodeId: string, payload: any) => Promise<void>
  onTest: (nodeId: string) => Promise<{ ok: boolean; runtime_node_id: string; checks: RuntimeNodeHealthCheck[] }>
}

interface RuntimeNodeSiteDefaults {
  architecture: RuntimeNode['architecture']
  host: string
  neuron: {
    username: string
    config_path: string
    mode: RuntimeNode['neuron']['mode']
  }
}

const SITE_DEFAULTS_KEY = 'runtime-node-site-defaults-v1'

function derivedNodeName(peaId: string, peaCount: number): string {
  return peaId ? `${peaId}-node` : `arm-node-${peaCount || 1}`
}

function derivedBaseUrl(host: string): string {
  return `http://${host || 'localhost'}:7000`
}

function derivedPasswordRef(nodeName: string): string {
  const safe = nodeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `secret://runtime/${safe || 'default'}/neuron`
}

function loadSiteDefaults(): RuntimeNodeSiteDefaults | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SITE_DEFAULTS_KEY)
    return raw ? JSON.parse(raw) as RuntimeNodeSiteDefaults : null
  } catch {
    return null
  }
}

function saveSiteDefaults(defaults: RuntimeNodeSiteDefaults) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SITE_DEFAULTS_KEY, JSON.stringify(defaults))
}

function applySiteDefaults(
  form: RuntimeNodeFormState,
  defaults: RuntimeNodeSiteDefaults | null
): RuntimeNodeFormState {
  if (!defaults) return form
  return {
    ...form,
    architecture: defaults.architecture,
    host: defaults.host || form.host,
    neuron: {
      ...form.neuron,
      base_url: derivedBaseUrl(defaults.host || form.host),
      username: defaults.neuron.username || form.neuron.username,
      config_path: defaults.neuron.config_path || form.neuron.config_path,
      mode: defaults.neuron.mode,
    },
  }
}

function defaultForm(peas: PeaConfig[]): RuntimeNodeFormState {
  const assignedPeaId = peas[0]?.id ?? ''
  const name = derivedNodeName(assignedPeaId, peas.length)
  const host = '10.0.20.41'
  return {
    name,
    architecture: 'Arm64',
    host,
    assigned_pea_id: assignedPeaId,
    neuron: {
      base_url: derivedBaseUrl(host),
      username: 'admin',
      password_ref: derivedPasswordRef(name),
      config_path: '/opt/neuron/config',
      mode: 'Hybrid',
    },
  }
}

function formFromNode(node: RuntimeNode): RuntimeNodeFormState {
  return {
    name: node.name,
    architecture: node.architecture,
    host: node.host,
    assigned_pea_id: node.assigned_pea_id ?? '',
    neuron: {
      base_url: node.neuron.base_url,
      username: node.neuron.username ?? '',
      password_ref: node.neuron.password_ref ?? '',
      config_path: node.neuron.config_path ?? '',
      mode: node.neuron.mode,
    },
  }
}

function secretHints(passwordRef: string) {
  if (!passwordRef.startsWith('secret://')) return null

  const secretPath = passwordRef.replace(/^secret:\/\//, '')
  const envSuffix = secretPath
    .split('')
    .map((ch) => /[a-z0-9]/i.test(ch) ? ch.toUpperCase() : '_')
    .join('')

  return {
    secretPath,
    envPrimary: `SECRET_${envSuffix}`,
    envSecondary: `NEURON_SECRET_${envSuffix}`,
    filePath: `./data/secrets/${secretPath}`,
  }
}

export default function RuntimeNodeEditor({ node, peas, onCreate, onUpdate, onTest }: RuntimeNodeEditorProps) {
  const [draft, setDraft] = useState<RuntimeNodeFormState>(() => applySiteDefaults(defaultForm(peas), loadSiteDefaults()))
  const [testResult, setTestResult] = useState<{ ok: boolean; checks: RuntimeNodeHealthCheck[] } | null>(null)
  const hints = secretHints(draft.neuron.password_ref)

  useEffect(() => {
    setDraft(node ? formFromNode(node) : applySiteDefaults(defaultForm(peas), loadSiteDefaults()))
    setTestResult(null)
  }, [node, peas])

  const applyRecommendedDefaults = () => {
    setDraft((current) => {
      const nextName = derivedNodeName(current.assigned_pea_id, peas.length)
      return {
        ...current,
        name: nextName,
        neuron: {
          ...current.neuron,
          base_url: derivedBaseUrl(current.host),
          password_ref: derivedPasswordRef(nextName),
          config_path: current.neuron.config_path || '/opt/neuron/config',
        },
      }
    })
  }

  const handleFieldChange = (field: 'name' | 'host' | 'assigned_pea_id', value: string) => {
    setDraft((current) => {
      if (field === 'host') {
        const shouldSyncUrl =
          !current.neuron.base_url || current.neuron.base_url === derivedBaseUrl(current.host)
        return {
          ...current,
          host: value,
          neuron: {
            ...current.neuron,
            base_url: shouldSyncUrl ? derivedBaseUrl(value) : current.neuron.base_url,
          },
        }
      }

      if (field === 'assigned_pea_id') {
        const previousSuggestedName = derivedNodeName(current.assigned_pea_id, peas.length)
        const nextSuggestedName = derivedNodeName(value, peas.length)
        const shouldSyncName = !current.name || current.name === previousSuggestedName
        const nextName = shouldSyncName ? nextSuggestedName : current.name
        const shouldSyncPassword =
          !current.neuron.password_ref ||
          current.neuron.password_ref === derivedPasswordRef(current.name) ||
          current.neuron.password_ref === derivedPasswordRef(previousSuggestedName)

        return {
          ...current,
          assigned_pea_id: value,
          name: nextName,
          neuron: {
            ...current.neuron,
            password_ref: shouldSyncPassword ? derivedPasswordRef(nextName) : current.neuron.password_ref,
          },
        }
      }

      const shouldSyncPassword =
        !current.neuron.password_ref || current.neuron.password_ref === derivedPasswordRef(current.name)
      return {
        ...current,
        name: value,
        neuron: {
          ...current.neuron,
          password_ref: shouldSyncPassword ? derivedPasswordRef(value) : current.neuron.password_ref,
        },
      }
    })
  }

  const handleArchitectureChange = (value: RuntimeNode['architecture']) => {
    setDraft((current) => ({ ...current, architecture: value }))
  }

  const handleNeuronChange = (field: 'base_url' | 'username' | 'password_ref' | 'config_path', value: string) => {
    setDraft((current) => ({
      ...current,
      neuron: {
        ...current.neuron,
        [field]: value,
      },
    }))
  }

  const handleNeuronModeChange = (value: RuntimeNode['neuron']['mode']) => {
    setDraft((current) => ({
      ...current,
      neuron: {
        ...current.neuron,
        mode: value,
      },
    }))
  }

  const handleSave = async () => {
    const payload = {
      name: draft.name,
      architecture: draft.architecture,
      host: draft.host,
      assigned_pea_id: draft.assigned_pea_id || null,
      neuron: {
        base_url: draft.neuron.base_url,
        username: draft.neuron.username || null,
        password_ref: draft.neuron.password_ref || null,
        config_path: draft.neuron.config_path || null,
        mode: draft.neuron.mode,
      },
    }

    if (node) {
      await onUpdate(node.id, payload)
    } else {
      await onCreate(payload)
    }
  }

  const handleTest = async () => {
    if (!node) return
    const result = await onTest(node.id)
    setTestResult({ ok: result.ok, checks: result.checks })
  }

  const handleSaveSiteDefaults = () => {
    saveSiteDefaults({
      architecture: draft.architecture,
      host: draft.host,
      neuron: {
        username: draft.neuron.username,
        config_path: draft.neuron.config_path,
        mode: draft.neuron.mode,
      },
    })
  }

  const handleLoadSiteDefaults = () => {
    setDraft((current) => applySiteDefaults(current, loadSiteDefaults()))
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Runtime Node Editor</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <TextField
          label="Name"
          value={draft.name}
          onChange={(event) => handleFieldChange('name', event.target.value)}
          fullWidth
        />
        <TextField
          label="Host"
          value={draft.host}
          onChange={(event) => handleFieldChange('host', event.target.value)}
          fullWidth
        />
        <TextField
          select
          label="Architecture"
          value={draft.architecture}
          onChange={(event) => handleArchitectureChange(event.target.value as RuntimeNode['architecture'])}
          fullWidth
        >
          <MenuItem value="Arm64">Arm64</MenuItem>
          <MenuItem value="ArmV7">ArmV7</MenuItem>
          <MenuItem value="Amd64">Amd64</MenuItem>
        </TextField>
        <TextField
          select
          label="Assigned PEA"
          value={draft.assigned_pea_id}
          onChange={(event) => handleFieldChange('assigned_pea_id', event.target.value)}
          fullWidth
        >
          {peas.map((pea) => (
            <MenuItem key={pea.id} value={pea.id}>
              {pea.name || pea.id}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Frontend Endpoint"
          value={draft.neuron.base_url}
          onChange={(event) => handleNeuronChange('base_url', event.target.value)}
          fullWidth
        />
        <TextField
          label="Frontend User"
          value={draft.neuron.username}
          onChange={(event) => handleNeuronChange('username', event.target.value)}
          fullWidth
        />
        <TextField
          label="Password Ref"
          value={draft.neuron.password_ref}
          onChange={(event) => handleNeuronChange('password_ref', event.target.value)}
          fullWidth
          helperText="Supports plain text, env:NAME, or secret://runtime/path"
        />
        <TextField
          label="Config Path"
          value={draft.neuron.config_path}
          onChange={(event) => handleNeuronChange('config_path', event.target.value)}
          fullWidth
        />
        <TextField
          select
          label="Frontend Mode"
          value={draft.neuron.mode}
          onChange={(event) => handleNeuronModeChange(event.target.value as RuntimeNode['neuron']['mode'])}
          fullWidth
        >
          <MenuItem value="Api">API</MenuItem>
          <MenuItem value="FileExport">File Export</MenuItem>
          <MenuItem value="Hybrid">Hybrid</MenuItem>
        </TextField>
        <TextField label="Status" value={node?.status ?? 'Pending'} fullWidth InputProps={{ readOnly: true }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
        <Button variant="contained" onClick={handleSave} disabled={!draft.name || !draft.host || !draft.neuron.base_url}>
          {node ? 'Save Runtime Node' : 'Create Runtime Node'}
        </Button>
        <Button variant="outlined" onClick={applyRecommendedDefaults}>
          Apply Recommended Defaults
        </Button>
        <Button variant="outlined" onClick={handleLoadSiteDefaults}>
          Load Site Defaults
        </Button>
        <Button variant="outlined" onClick={handleSaveSiteDefaults}>
          Save Site Defaults
        </Button>
        {node && (
          <Button variant="outlined" onClick={handleTest}>
            Run Connection Test
          </Button>
        )}
      </Box>

      <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Alert severity="info">
          `password_ref` supports plain text, `env:NAME`, or `secret://runtime/path`.
        </Alert>
        <Alert severity="info">
          While values still match recommended defaults, host and PEA changes will auto-update the frontend endpoint, node name, and secret path.
        </Alert>
        <Alert severity="info">
          Site defaults persist locally in the browser for architecture, host, frontend user, config path, and mode.
        </Alert>
        {draft.neuron.mode !== 'Api' && (
          <Alert severity="info">
            File-export modes require a writable frontend config path on the ARM node.
          </Alert>
        )}
        {hints && (
          <Paper variant="outlined" sx={{ p: 2, background: 'rgba(255,255,255,0.02)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Secret Resolution</Typography>
            <Typography variant="body2" color="text.secondary">Primary env: {hints.envPrimary}</Typography>
            <Typography variant="body2" color="text.secondary">Alternate env: {hints.envSecondary}</Typography>
            <Typography variant="body2" color="text.secondary">Secret file: {hints.filePath}</Typography>
          </Paper>
        )}
      </Box>

      {!node && (
        <Alert severity="info" sx={{ mt: 2 }}>
          Initial runtime model stays at one ARM node per PEA.
        </Alert>
      )}

      {testResult && (
        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Alert severity={testResult.ok ? 'success' : 'warning'}>
            Runtime test {testResult.ok ? 'passed' : 'reported issues'}
          </Alert>
          {testResult.checks.map((check) => (
            <Alert key={check.name} severity={check.ok ? 'success' : 'error'}>
              {check.name}: {check.message}
            </Alert>
          ))}
        </Box>
      )}
    </Paper>
  )
}
