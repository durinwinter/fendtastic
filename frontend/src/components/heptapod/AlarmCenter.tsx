import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Chip, IconButton, Paper, Select, MenuItem, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, Tab, TextField, Tooltip, Typography
} from '@mui/material'
import { CheckCircleOutline, DeleteOutline, Snooze } from '@mui/icons-material'
import apiService from '../../services/apiService'
import zenohService from '../../services/zenohService'

type AlarmRecord = {
  id: string
  severity: 'critical' | 'warning' | 'info'
  status: 'open' | 'acknowledged' | 'shelved' | 'cleared'
  source: string
  event: string
  value: string
  description: string
  timestamp: string
}

type AlarmRule = {
  id: string
  name: string
  severity: string
  source_pattern: string
  event_pattern: string
  enabled: boolean
}

type Blackout = {
  id: string
  name: string
  starts_at: string
  ends_at: string
  scope: string
}

const AlarmCenter: React.FC = () => {
  const [tab, setTab] = useState(0)
  const [alarms, setAlarms] = useState<AlarmRecord[]>([])
  const [rules, setRules] = useState<AlarmRule[]>([])
  const [blackouts, setBlackouts] = useState<Blackout[]>([])

  const [newRule, setNewRule] = useState({
    name: '',
    severity: 'warning',
    source_pattern: 'fendtastic/pea/',
    event_pattern: '',
    enabled: true,
  })
  const [newBlackout, setNewBlackout] = useState({
    name: '',
    starts_at: '',
    ends_at: '',
    scope: 'global',
  })

  useEffect(() => {
    const loadAlarms = async () => {
      try {
        const result = await apiService.getAlarms()
        setAlarms(result.alarms ?? [])
      } catch {
        setAlarms([])
      }
    }
    const loadRules = async () => {
      try {
        setRules(await apiService.listAlarmRules())
      } catch {
        setRules([])
      }
    }
    const loadBlackouts = async () => {
      try {
        setBlackouts(await apiService.listBlackouts())
      } catch {
        setBlackouts([])
      }
    }

    void loadAlarms()
    void loadRules()
    void loadBlackouts()

    const refresh = setInterval(() => {
      void loadAlarms()
      void loadRules()
      void loadBlackouts()
    }, 4000)

    const unsubscribe = zenohService.subscribe('fendtastic/pea/+/swimlane/alarm', () => {
      void loadAlarms()
    })

    return () => {
      clearInterval(refresh)
      unsubscribe()
    }
  }, [])

  const activeCount = useMemo(
    () => alarms.filter(a => a.status === 'open' || a.status === 'acknowledged').length,
    [alarms]
  )

  const ackAlarm = async (id: string) => {
    await apiService.acknowledgeAlarm(id)
    const result = await apiService.getAlarms()
    setAlarms(result.alarms ?? [])
  }

  const shelveAlarm = async (id: string) => {
    await apiService.shelveAlarm(id)
    const result = await apiService.getAlarms()
    setAlarms(result.alarms ?? [])
  }

  const deleteAlarm = async (id: string) => {
    await apiService.deleteAlarmById(id)
    setAlarms(prev => prev.filter(a => a.id !== id))
  }

  const addRule = async () => {
    if (!newRule.name.trim()) return
    await apiService.createAlarmRule(newRule)
    setNewRule({
      name: '',
      severity: 'warning',
      source_pattern: 'murph/habitat/nodes/',
      event_pattern: '',
      enabled: true,
    })
    setRules(await apiService.listAlarmRules())
  }

  const deleteRule = async (id: string) => {
    await apiService.deleteAlarmRule(id)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const addBlackout = async () => {
    if (!newBlackout.name.trim() || !newBlackout.starts_at || !newBlackout.ends_at) return
    await apiService.createBlackout({
      ...newBlackout,
      starts_at: new Date(newBlackout.starts_at).toISOString(),
      ends_at: new Date(newBlackout.ends_at).toISOString(),
    })
    setNewBlackout({ name: '', starts_at: '', ends_at: '', scope: 'global' })
    setBlackouts(await apiService.listBlackouts())
  }

  const deleteBlackout = async (id: string) => {
    await apiService.deleteBlackout(id)
    setBlackouts(prev => prev.filter(b => b.id !== id))
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Alarm Center</Typography>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Chip label={`Total ${alarms.length}`} size="small" />
        <Chip label={`Active ${activeCount}`} color={activeCount > 0 ? 'error' : 'success'} size="small" />
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Alarms" />
        <Tab label="Rules" />
        <Tab label="Blackouts" />
      </Tabs>

      {tab === 0 && (
        <>
          {alarms.length === 0 ? (
            <Alert severity="info">No alarms yet.</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Severity</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Time</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {alarms.map(alarm => (
                    <TableRow key={alarm.id} hover>
                      <TableCell>{alarm.severity}</TableCell>
                      <TableCell>{alarm.status}</TableCell>
                      <TableCell>{new Date(alarm.timestamp).toLocaleString()}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{alarm.source}</TableCell>
                      <TableCell>{alarm.event}</TableCell>
                      <TableCell>{alarm.description}</TableCell>
                      <TableCell align="right">
                        <Tooltip title="Acknowledge">
                          <IconButton size="small" onClick={() => void ackAlarm(alarm.id)}>
                            <CheckCircleOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Shelve">
                          <IconButton size="small" onClick={() => void shelveAlarm(alarm.id)}>
                            <Snooze fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" onClick={() => void deleteAlarm(alarm.id)}>
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {tab === 1 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField size="small" label="Rule Name" value={newRule.name} onChange={(e) => setNewRule({ ...newRule, name: e.target.value })} />
            <Select size="small" value={newRule.severity} onChange={(e) => setNewRule({ ...newRule, severity: String(e.target.value) })} sx={{ minWidth: 120 }}>
              <MenuItem value="critical">critical</MenuItem>
              <MenuItem value="warning">warning</MenuItem>
              <MenuItem value="info">info</MenuItem>
            </Select>
            <TextField size="small" label="Source pattern" value={newRule.source_pattern} onChange={(e) => setNewRule({ ...newRule, source_pattern: e.target.value })} sx={{ minWidth: 220 }} />
            <TextField size="small" label="Event pattern" value={newRule.event_pattern} onChange={(e) => setNewRule({ ...newRule, event_pattern: e.target.value })} sx={{ minWidth: 180 }} />
            <Button variant="contained" size="small" onClick={() => void addRule()}>Add Rule</Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Severity</TableCell>
                  <TableCell>Source Pattern</TableCell>
                  <TableCell>Event Pattern</TableCell>
                  <TableCell>Enabled</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell>{rule.name}</TableCell>
                    <TableCell>{rule.severity}</TableCell>
                    <TableCell>{rule.source_pattern}</TableCell>
                    <TableCell>{rule.event_pattern}</TableCell>
                    <TableCell>{String(rule.enabled)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => void deleteRule(rule.id)}><DeleteOutline fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {tab === 2 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField size="small" label="Blackout Name" value={newBlackout.name} onChange={(e) => setNewBlackout({ ...newBlackout, name: e.target.value })} />
            <TextField size="small" type="datetime-local" label="Starts" InputLabelProps={{ shrink: true }} value={newBlackout.starts_at} onChange={(e) => setNewBlackout({ ...newBlackout, starts_at: e.target.value })} />
            <TextField size="small" type="datetime-local" label="Ends" InputLabelProps={{ shrink: true }} value={newBlackout.ends_at} onChange={(e) => setNewBlackout({ ...newBlackout, ends_at: e.target.value })} />
            <Select size="small" value={newBlackout.scope} onChange={(e) => setNewBlackout({ ...newBlackout, scope: String(e.target.value) })} sx={{ minWidth: 120 }}>
              <MenuItem value="global">global</MenuItem>
              <MenuItem value="pea">pea</MenuItem>
            </Select>
            <Button variant="contained" size="small" onClick={() => void addBlackout()}>Add Blackout</Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Start</TableCell>
                  <TableCell>End</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {blackouts.map(b => (
                  <TableRow key={b.id}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{new Date(b.starts_at).toLocaleString()}</TableCell>
                    <TableCell>{new Date(b.ends_at).toLocaleString()}</TableCell>
                    <TableCell>{b.scope}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => void deleteBlackout(b.id)}><DeleteOutline fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Paper>
  )
}

export default AlarmCenter
