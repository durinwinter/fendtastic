import React, { useEffect, useMemo, useState } from 'react'
import {
  Paper, Typography, Box, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, IconButton, Tooltip, Alert
} from '@mui/material'
import { CheckCircleOutline, Snooze, DeleteOutline } from '@mui/icons-material'
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

function severityColor(severity: AlarmRecord['severity']): 'error' | 'warning' | 'info' {
  if (severity === 'critical') return 'error'
  if (severity === 'warning') return 'warning'
  return 'info'
}

const AlarmCenter: React.FC = () => {
  const [alarms, setAlarms] = useState<AlarmRecord[]>([])

  useEffect(() => {
    const loadStaticAlarms = async () => {
      try {
        const result = await apiService.getAlarms()
        const list: AlarmRecord[] = (result.alarms ?? []).map((a: any, idx: number) => ({
          id: a.id ?? `api-${idx}-${Date.now()}`,
          severity: a.severity ?? 'warning',
          status: a.status ?? 'open',
          source: a.resource ?? a.source ?? 'backend',
          event: a.event ?? 'Alarm',
          value: String(a.value ?? ''),
          description: a.text ?? a.description ?? '',
          timestamp: a.lastReceiveTime ?? a.timestamp ?? new Date().toISOString(),
        }))
        setAlarms(list)
      } catch {
        setAlarms([])
      }
    }

    loadStaticAlarms()
    const refresh = setInterval(loadStaticAlarms, 4000)

    const unsubscribe = zenohService.subscribe('fendtastic/pea/+/swimlane/alarm', (msg: any) => {
      const active = Boolean(msg?.active)
      const alarmText = String(msg?.alarm ?? '')
      if (!active || !alarmText) return
      const severity = (String(msg?.severity ?? 'warning').toLowerCase() as AlarmRecord['severity'])
      const key = String(msg?._key ?? '')
      const source = key.split('/').slice(0, 4).join('/') || 'zenoh'
      const now = String(msg?.timestamp ?? new Date().toISOString())

      setAlarms(prev => [
        {
          id: `zenoh-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
          severity: severity === 'critical' ? 'critical' : severity === 'info' ? 'info' : 'warning',
          status: 'open',
          source,
          event: alarmText,
          value: String(msg?.value ?? ''),
          description: `Live alarm from ${source}`,
          timestamp: now,
        },
        ...prev,
      ].slice(0, 200))
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

  const updateStatus = (id: string, status: AlarmRecord['status']) => {
    setAlarms(prev => prev.map(a => (a.id === id ? { ...a, status } : a)))
    if (status === 'acknowledged') {
      void apiService.acknowledgeAlarm(id).catch(() => {})
    } else if (status === 'shelved') {
      void apiService.shelveAlarm(id).catch(() => {})
    }
  }

  const removeAlarm = (id: string) => {
    setAlarms(prev => prev.filter(a => a.id !== id))
    void apiService.deleteAlarmById(id).catch(() => {})
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Alarm Center</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip label={`Total ${alarms.length}`} size="small" />
          <Chip label={`Active ${activeCount}`} color={activeCount > 0 ? 'error' : 'success'} size="small" />
        </Box>
      </Box>

      {alarms.length === 0 ? (
        <Alert severity="info">No alarms yet. Live swimlane alarms will appear here.</Alert>
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
                <TableCell>Value</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {alarms.map(alarm => (
                <TableRow key={alarm.id} hover>
                  <TableCell>
                    <Chip size="small" label={alarm.severity.toUpperCase()} color={severityColor(alarm.severity)} />
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label={alarm.status.toUpperCase()} variant="outlined" />
                  </TableCell>
                  <TableCell>{new Date(alarm.timestamp).toLocaleString()}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{alarm.source}</TableCell>
                  <TableCell>{alarm.event}</TableCell>
                  <TableCell>{alarm.value}</TableCell>
                  <TableCell>{alarm.description}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Acknowledge">
                      <IconButton size="small" onClick={() => updateStatus(alarm.id, 'acknowledged')}>
                        <CheckCircleOutline fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Shelve">
                      <IconButton size="small" onClick={() => updateStatus(alarm.id, 'shelved')}>
                        <Snooze fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Clear">
                      <IconButton size="small" onClick={() => removeAlarm(alarm.id)}>
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
    </Paper>
  )
}

export default AlarmCenter
