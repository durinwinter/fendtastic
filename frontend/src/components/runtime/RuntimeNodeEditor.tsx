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

function defaultForm(peas: PeaConfig[]): RuntimeNodeFormState {
  return {
    name: `arm-node-${peas.length || 1}`,
    architecture: 'Arm64',
    host: '10.0.20.41',
    assigned_pea_id: peas[0]?.id ?? '',
    neuron: {
      base_url: 'http://10.0.20.41:7000',
      username: 'admin',
      password_ref: 'secret://runtime/default/neuron',
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
  const [draft, setDraft] = useState<RuntimeNodeFormState>(() => defaultForm(peas))
  const [testResult, setTestResult] = useState<{ ok: boolean; checks: RuntimeNodeHealthCheck[] } | null>(null)
  const hints = secretHints(draft.neuron.password_ref)

  useEffect(() => {
    setDraft(node ? formFromNode(node) : defaultForm(peas))
    setTestResult(null)
  }, [node, peas])

  const handleFieldChange = (field: 'name' | 'host' | 'assigned_pea_id', value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
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
          label="Neuron URL"
          value={draft.neuron.base_url}
          onChange={(event) => handleNeuronChange('base_url', event.target.value)}
          fullWidth
        />
        <TextField
          label="Neuron User"
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
          label="Neuron Mode"
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
        {draft.neuron.mode !== 'Api' && (
          <Alert severity="info">
            File-export modes require a writable Neuron config path on the ARM node.
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
