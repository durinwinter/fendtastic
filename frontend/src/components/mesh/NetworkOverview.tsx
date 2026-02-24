import React, { useEffect, useState, useCallback } from 'react'
import {
  Box, Paper, Typography, Table, TableHead, TableBody, TableRow, TableCell,
  Chip, IconButton, Tooltip, Alert, Skeleton, Collapse,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  Circle as CircleIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Router as RouterIcon,
  Devices as DevicesIcon,
  Laptop as LaptopIcon,
} from '@mui/icons-material'
import apiService from '../../services/apiService'
import { ZenohNode, truncateZid, getRoleColor } from '../../types/mesh'

const POLL_INTERVAL = 5000

const NetworkOverview: React.FC = () => {
  const [nodes, setNodes] = useState<ZenohNode[]>([])
  const [localZid, setLocalZid] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedZid, setExpandedZid] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchNodes = useCallback(async () => {
    try {
      const data = await apiService.getMeshNodes()
      setNodes(data.nodes || [])
      setLocalZid(data.local_zid || '')
      setError(null)
      setLastUpdated(new Date())
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to fetch nodes'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNodes()
    const interval = setInterval(fetchNodes, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchNodes])

  const toggleExpand = (zid: string) => {
    setExpandedZid(prev => prev === zid ? null : zid)
  }

  const getRoleIcon = (whatami: string) => {
    switch (whatami) {
      case 'router': return <RouterIcon fontSize="small" />
      case 'peer': return <DevicesIcon fontSize="small" />
      case 'client': return <LaptopIcon fontSize="small" />
      default: return <DevicesIcon fontSize="small" />
    }
  }

  if (loading) {
    return (
      <Box sx={{ height: '100%', overflow: 'auto' }}>
        <Paper sx={{ p: 3 }}>
          <Skeleton variant="rectangular" height={40} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={200} />
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h6">Connected Zenoh Nodes</Typography>
            <Typography variant="caption" color="text.secondary">
              Local session: {truncateZid(localZid, 20)}
              {lastUpdated && ` | Updated: ${lastUpdated.toLocaleTimeString()}`}
            </Typography>
          </Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchNodes} color="primary">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        )}

        {nodes.length === 0 && !error ? (
          <Alert severity="info">
            No remote nodes detected. The local Zenoh session is running in standalone mode.
          </Alert>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width={40} />
                <TableCell>Session ID</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Locators</TableCell>
                <TableCell>Links</TableCell>
                <TableCell align="center">Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nodes.map((node) => {
                const isLocal = node.is_local === true
                const isExpanded = expandedZid === node.zid
                const linkCount = node.links?.length || 0

                return (
                  <React.Fragment key={node.zid}>
                    <TableRow
                      hover
                      sx={{
                        cursor: 'pointer',
                        backgroundColor: isLocal ? 'rgba(110, 199, 45, 0.05)' : 'inherit',
                      }}
                      onClick={() => toggleExpand(node.zid)}
                    >
                      <TableCell>
                        <IconButton size="small">
                          {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={node.zid}>
                          <Typography variant="body2" fontFamily="monospace" fontSize={13}>
                            {truncateZid(node.zid, 16)}
                            {isLocal && (
                              <Chip label="LOCAL" size="small" color="primary" variant="outlined" sx={{ ml: 1, height: 20, fontSize: 10 }} />
                            )}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={getRoleIcon(node.whatami)}
                          label={node.whatami.toUpperCase()}
                          size="small"
                          color={getRoleColor(node.whatami)}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        {node.locators?.length > 0 ? (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {node.locators.map((loc, i) => (
                              <Chip key={i} label={loc} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                            ))}
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{linkCount}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <CircleIcon sx={{ fontSize: 12, color: 'success.main' }} />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={6} sx={{ py: 0, borderBottom: isExpanded ? undefined : 'none' }}>
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2 }}>
                            <Typography variant="subtitle2" gutterBottom>Full Session ID</Typography>
                            <Typography variant="body2" fontFamily="monospace" sx={{ mb: 2 }}>{node.zid}</Typography>

                            {node.links && node.links.length > 0 && (
                              <>
                                <Typography variant="subtitle2" gutterBottom>Transport Links</Typography>
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Destination ZID</TableCell>
                                      <TableCell>Role</TableCell>
                                      <TableCell>Locators</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {node.links.map((link, i) => (
                                      <TableRow key={i}>
                                        <TableCell>
                                          <Typography variant="body2" fontFamily="monospace" fontSize={12}>
                                            {truncateZid(link.dst_zid || '', 16)}
                                          </Typography>
                                        </TableCell>
                                        <TableCell>
                                          <Chip label={link.whatami || 'unknown'} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                          {link.locators?.map((loc, j) => (
                                            <Chip key={j} label={loc} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontSize: 11, mr: 0.5 }} />
                                          ))}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </>
                            )}

                            {/* Show raw JSON for any extra fields */}
                            <Typography variant="subtitle2" sx={{ mt: 2 }} gutterBottom>Raw Data</Typography>
                            <Box sx={{
                              p: 1.5,
                              backgroundColor: 'background.default',
                              borderRadius: 1,
                              overflow: 'auto',
                              maxHeight: 200,
                            }}>
                              <pre style={{ margin: 0, fontSize: 12, fontFamily: 'monospace' }}>
                                {JSON.stringify(node, null, 2)}
                              </pre>
                            </Box>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Box>
  )
}

export default NetworkOverview
