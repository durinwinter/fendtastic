import { Alert, Box, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material'
import { RuntimeNode } from '../../types/runtime'

interface RuntimeNodeListProps {
  nodes: RuntimeNode[]
  selectedId?: string | null
  onSelect: (node: RuntimeNode) => void
}

export default function RuntimeNodeList({ nodes, selectedId, onSelect }: RuntimeNodeListProps) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Runtime Nodes</Typography>
      {nodes.length === 0 ? (
        <Alert severity="info">No runtime nodes yet</Alert>
      ) : (
        <List sx={{ p: 0 }}>
          {nodes.map((node) => (
            <ListItemButton key={node.id} selected={selectedId === node.id} onClick={() => onSelect(node)}>
              <ListItemText primary={node.name} secondary={`${node.architecture} | ${node.host} | ${node.status}`} />
            </ListItemButton>
          ))}
        </List>
      )}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">Initial model: one ARM node per PEA.</Typography>
      </Box>
    </Paper>
  )
}
