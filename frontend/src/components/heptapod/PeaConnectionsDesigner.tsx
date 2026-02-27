import React, { useEffect, useMemo, useState } from 'react'
import {
  Paper, Typography, Box, Button, Select, MenuItem, Alert, Chip
} from '@mui/material'
import apiService from '../../services/apiService'
import { ZENOH_TOPICS } from '../../types/mtp'
import zenohService from '../../services/zenohService'

type NodePos = { x: number; y: number }
type Edge = { from: string; to: string }
type DiscoveredPea = { id: string; name: string }

const CANVAS_WIDTH = 900
const CANVAS_HEIGHT = 460

const PeaConnectionsDesigner: React.FC = () => {
  const [peas, setPeas] = useState<DiscoveredPea[]>([])
  const [nodePos, setNodePos] = useState<Record<string, NodePos>>({})
  const [edges, setEdges] = useState<Edge[]>([])
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [dragNode, setDragNode] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<NodePos>({ x: 0, y: 0 })

  useEffect(() => {
    const upsertPea = (payload: any) => {
      if (!payload || !payload.pea_id) return
      setPeas(prev => {
        const map = new Map(prev.map(p => [p.id, p]))
        map.set(payload.pea_id, {
          id: payload.pea_id,
          name: payload.name || payload.pea_id,
        })
        return Array.from(map.values())
      })

      // Seed a position once when a new PEA is discovered.
      setNodePos(prev => {
        if (prev[payload.pea_id]) return prev
        const idx = Object.keys(prev).length
        return {
          ...prev,
          [payload.pea_id]: {
            x: 70 + (idx % 4) * 200,
            y: 70 + Math.floor(idx / 4) * 120,
          },
        }
      })
    }

    const unsubAnnounce = zenohService.subscribe(
      ZENOH_TOPICS.peaDiscoveryWildcard,
      upsertPea
    )
    const unsubStatus = zenohService.subscribe(
      ZENOH_TOPICS.peaStatusWildcard,
      upsertPea
    )
    return () => {
      unsubAnnounce()
      unsubStatus()
    }
  }, [])

  useEffect(() => {
    const loadTopology = async () => {
      try {
        const topology = await apiService.getPolTopology()
        const parsed = topology.edges ?? []
        if (Array.isArray(parsed)) setEdges(parsed)
      } catch {
        const fromStorage = localStorage.getItem('fendtastic.peaLinks')
        if (fromStorage) {
          try {
            const parsed = JSON.parse(fromStorage) as Edge[]
            if (Array.isArray(parsed)) setEdges(parsed)
          } catch {
            // ignore
          }
        }
      }
    }
    void loadTopology()

    const onTopology = (msg: any) => {
      const incoming = msg?.edges
      if (Array.isArray(incoming)) {
        const normalized = incoming
          .filter((e: any) => typeof e?.from === 'string' && typeof e?.to === 'string')
          .map((e: any) => ({ from: e.from, to: e.to }))
        setEdges(normalized)
      }
    }
    const unsubscribeMurph = zenohService.subscribe('murph/pol/topology', onTopology)
    // Legacy bridge support.
    const unsubscribeLegacy = zenohService.subscribe('fendtastic/pol/topology', onTopology)
    return () => {
      unsubscribeMurph()
      unsubscribeLegacy()
    }
  }, [])

  const idToName = useMemo(() => {
    const map: Record<string, string> = {}
    peas.forEach(p => { map[p.id] = p.name || p.id })
    return map
  }, [peas])

  const addConnection = () => {
    if (!source || !target || source === target) return
    if (edges.some(e => e.from === source && e.to === target)) return
    setEdges(prev => {
      const next = [...prev, { from: source, to: target }]
      localStorage.setItem('fendtastic.peaLinks', JSON.stringify(next))
      void apiService.putPolTopology(next).catch(() => {})
      return next
    })
  }

  const clearConnections = () => {
    setEdges([])
    localStorage.setItem('fendtastic.peaLinks', JSON.stringify([]))
    void apiService.putPolTopology([]).catch(() => {})
  }

  const onMouseMove: React.MouseEventHandler<HTMLDivElement> = (evt) => {
    if (!dragNode) return
    const rect = evt.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(CANVAS_WIDTH - 140, evt.clientX - rect.left - dragOffset.x))
    const y = Math.max(0, Math.min(CANVAS_HEIGHT - 52, evt.clientY - rect.top - dragOffset.y))
    setNodePos(prev => ({ ...prev, [dragNode]: { x, y } }))
  }

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6">PEA Connections Designer</Typography>
      <Alert severity="info" sx={{ py: 0.5 }}>
        Build logical links between PEAs. This graph can be used as orchestration topology.
      </Alert>

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Select size="small" value={source} displayEmpty onChange={(e) => setSource(String(e.target.value))} sx={{ minWidth: 220 }}>
          <MenuItem value="">Source PEA</MenuItem>
          {peas.map(p => <MenuItem key={`src-${p.id}`} value={p.id}>{p.name || p.id}</MenuItem>)}
        </Select>
        <Select size="small" value={target} displayEmpty onChange={(e) => setTarget(String(e.target.value))} sx={{ minWidth: 220 }}>
          <MenuItem value="">Target PEA</MenuItem>
          {peas.map(p => <MenuItem key={`dst-${p.id}`} value={p.id}>{p.name || p.id}</MenuItem>)}
        </Select>
        <Button variant="contained" size="small" onClick={addConnection}>Connect</Button>
        <Button variant="outlined" size="small" color="error" onClick={clearConnections}>Clear</Button>
        <Chip size="small" label={`${edges.length} links`} />
      </Box>

      <Box
        onMouseMove={onMouseMove}
        onMouseUp={() => setDragNode(null)}
        onMouseLeave={() => setDragNode(null)}
        sx={{
          width: '100%',
          maxWidth: CANVAS_WIDTH,
          height: CANVAS_HEIGHT,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          overflow: 'hidden',
          backgroundImage: 'url(/heptapod-assets/icons/background.svg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <svg width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <polygon points="0 0, 7 3.5, 0 7" fill="#89c541" />
            </marker>
          </defs>
          {edges.map((e, idx) => {
            const from = nodePos[e.from]
            const to = nodePos[e.to]
            if (!from || !to) return null
            return (
              <line
                key={`${e.from}-${e.to}-${idx}`}
                x1={from.x + 140}
                y1={from.y + 26}
                x2={to.x}
                y2={to.y + 26}
                stroke="#89c541"
                strokeWidth={2.5}
                markerEnd="url(#arrowhead)"
              />
            )
          })}
        </svg>

        {peas.map(pea => {
          const pos = nodePos[pea.id] || { x: 0, y: 0 }
          return (
            <Box
              key={pea.id}
              onMouseDown={(e) => {
                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                setDragNode(pea.id)
                setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top })
              }}
              sx={{
                width: 140,
                height: 52,
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                cursor: 'grab',
                borderRadius: 1,
                border: '1px solid',
                borderColor: 'primary.main',
                bgcolor: 'rgba(13, 33, 9, 0.88)',
                color: 'common.white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                px: 1,
                fontSize: '0.75rem',
                fontWeight: 600,
                userSelect: 'none',
              }}
            >
              {idToName[pea.id]}
            </Box>
          )
        })}
      </Box>
    </Paper>
  )
}

export default PeaConnectionsDesigner
