import React, { useState, useCallback } from 'react'
import {
  Box, Paper, Typography, TextField, Button, List, ListItemButton, ListItemIcon,
  ListItemText, Collapse, Alert, CircularProgress, InputAdornment,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  FolderOpen as FolderOpenIcon,
  Folder as FolderIcon,
  Description as FileIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import apiService from '../../services/apiService'
import { KeyEntry, KeyTreeNode, buildKeyTree } from '../../types/mesh'

// ─── Recursive Tree Item ─────────────────────────────────────────────────────

interface TreeItemProps {
  node: KeyTreeNode
  depth: number
  selectedKey: string | null
  onSelect: (key: string) => void
}

const TreeItem: React.FC<TreeItemProps> = ({ node, depth, selectedKey, onSelect }) => {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = node.children.length > 0
  const isSelected = selectedKey === node.full_path

  const handleClick = () => {
    if (hasChildren) {
      setOpen(!open)
    }
    if (node.has_value) {
      onSelect(node.full_path)
    }
  }

  return (
    <>
      <ListItemButton
        onClick={handleClick}
        selected={isSelected}
        sx={{
          pl: 2 + depth * 2,
          py: 0.5,
          '&.Mui-selected': {
            backgroundColor: 'rgba(110, 199, 45, 0.1)',
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 32 }}>
          {hasChildren ? (
            open ? <FolderOpenIcon fontSize="small" color="primary" /> : <FolderIcon fontSize="small" color="primary" />
          ) : (
            <FileIcon fontSize="small" sx={{ color: node.has_value ? 'secondary.main' : 'text.secondary' }} />
          )}
        </ListItemIcon>
        <ListItemText
          primary={node.segment}
          primaryTypographyProps={{
            variant: 'body2',
            fontFamily: 'monospace',
            fontSize: 13,
            color: node.has_value ? 'text.primary' : 'text.secondary',
          }}
        />
        {hasChildren && (
          open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />
        )}
      </ListItemButton>
      {hasChildren && (
        <Collapse in={open} timeout="auto" unmountOnExit>
          <List disablePadding>
            {node.children
              .sort((a, b) => a.segment.localeCompare(b.segment))
              .map((child) => (
                <TreeItem
                  key={child.full_path}
                  node={child}
                  depth={depth + 1}
                  selectedKey={selectedKey}
                  onSelect={onSelect}
                />
              ))}
          </List>
        </Collapse>
      )}
    </>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

const NamespaceBrowser: React.FC = () => {
  const [prefix, setPrefix] = useState('murph/habitat/**')
  const [keys, setKeys] = useState<KeyEntry[]>([])
  const [tree, setTree] = useState<KeyTreeNode | null>(null)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [selectedValue, setSelectedValue] = useState<unknown | null>(null)
  const [loading, setLoading] = useState(false)
  const [valueLoading, setValueLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRefresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await apiService.getMeshKeys(prefix)
      setKeys(result)
      setTree(buildKeyTree(result))
      setSelectedKey(null)
      setSelectedValue(null)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to query keys'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [prefix])

  const handleSelectKey = async (keyExpr: string) => {
    setSelectedKey(keyExpr)
    setValueLoading(true)
    try {
      const result = await apiService.getMeshKeyValue(keyExpr)
      setSelectedValue(result)
    } catch {
      // Key might not have a direct value (it's a prefix only)
      const entry = keys.find(k => k.key_expr === keyExpr)
      setSelectedValue(entry?.value ?? null)
    } finally {
      setValueLoading(false)
    }
  }

  const formatValue = (val: unknown): string => {
    if (val === null || val === undefined) return '(no value)'
    if (typeof val === 'string') {
      try {
        return JSON.stringify(JSON.parse(val), null, 2)
      } catch {
        return val
      }
    }
    return JSON.stringify(val, null, 2)
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Search bar */}
      <Paper sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          label="Key Expression"
          value={prefix}
          onChange={(e) => setPrefix(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleRefresh()}
          sx={{ flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            sx: { fontFamily: 'monospace', fontSize: 14 },
          }}
        />
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
          onClick={handleRefresh}
          disabled={loading}
        >
          Query
        </Button>
        <Typography variant="caption" color="text.secondary">
          {keys.length} key{keys.length !== 1 ? 's' : ''}
        </Typography>
      </Paper>

      {error && <Alert severity="error">{error}</Alert>}

      {/* Two-panel layout */}
      <Box sx={{ flex: 1, display: 'flex', gap: 2, overflow: 'hidden' }}>
        {/* Left: Tree */}
        <Paper sx={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
          {tree && tree.children.length > 0 ? (
            <List dense disablePadding>
              {tree.children.map((child) => (
                <TreeItem
                  key={child.full_path}
                  node={child}
                  depth={0}
                  selectedKey={selectedKey}
                  onSelect={handleSelectKey}
                />
              ))}
            </List>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                {keys.length === 0
                  ? 'Click "Query" to browse the Zenoh key space'
                  : 'No keys found for this expression'}
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Right: Value Inspector */}
        <Paper sx={{ flex: 1, overflow: 'auto', minWidth: 0, p: 2 }}>
          {selectedKey ? (
            <>
              <Typography variant="subtitle2" color="primary" gutterBottom>
                Key
              </Typography>
              <Typography
                variant="body2"
                fontFamily="monospace"
                sx={{
                  mb: 2,
                  p: 1,
                  backgroundColor: 'background.default',
                  borderRadius: 1,
                  wordBreak: 'break-all',
                }}
              >
                {selectedKey}
              </Typography>

              <Typography variant="subtitle2" color="primary" gutterBottom>
                Value
              </Typography>
              {valueLoading ? (
                <CircularProgress size={20} />
              ) : (
                <Box sx={{
                  p: 1.5,
                  backgroundColor: 'background.default',
                  borderRadius: 1,
                  overflow: 'auto',
                  maxHeight: 'calc(100% - 120px)',
                }}>
                  <pre style={{
                    margin: 0,
                    fontSize: 12,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#6EC72D',
                  }}>
                    {formatValue(selectedValue)}
                  </pre>
                </Box>
              )}
            </>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Typography color="text.secondary">
                Select a key to inspect its value
              </Typography>
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  )
}

export default NamespaceBrowser
