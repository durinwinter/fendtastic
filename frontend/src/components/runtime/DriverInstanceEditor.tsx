import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import {
  DriverCatalogEntry,
  DriverBrowseResponse,
  DriverInstance,
  DriverSchemaPayload,
  DriverStatusSnapshot,
  DriverTag,
  RemoteDriverGroup,
  TagGroup,
} from '../../types/driver'
import { RuntimeNode } from '../../types/runtime'
import apiService from '../../services/apiService'
import SchemaForm from './SchemaForm'
import DriverStatusPanel from './DriverStatusPanel'
import TagEditorPanel from './TagEditorPanel'

interface DriverInstanceEditorProps {
  runtimeNode: RuntimeNode | null
  driver: DriverInstance | null
  catalog: DriverCatalogEntry[]
  schema: DriverSchemaPayload | null
  status: DriverStatusSnapshot | null
  onCreate: (payload: any) => Promise<void>
  onUpdate: (id: string, payload: any) => Promise<void>
  onStart: (id: string) => Promise<void>
  onStop: (id: string) => Promise<void>
  onRead: (id: string, tagId: string) => Promise<unknown>
  onWrite: (id: string, tagId: string, value: unknown, peaId: string) => Promise<void>
}

function defaultConfigFromSchema(schema: DriverSchemaPayload | null, fallbackHost?: string) {
  const properties = (schema?.config_schema?.properties ?? {}) as Record<string, any>
  const next: Record<string, unknown> = {}
  Object.entries(properties).forEach(([key, property]) => {
    next[key] = property.default ?? ''
  })
  if (fallbackHost && !next.host) next.host = fallbackHost
  return next
}

function mergeMissingConfigValues(
  current: Record<string, unknown>,
  defaults: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...current }
  Object.entries(defaults).forEach(([key, value]) => {
    if (next[key] === '' || next[key] === null || typeof next[key] === 'undefined') {
      next[key] = value
    }
  })
  return next
}

function newGroup(index: number): TagGroup {
  return {
    id: `group-${Date.now()}-${index}`,
    name: `Group ${index + 1}`,
    description: '',
    tags: [],
  }
}

function newTag(index: number): DriverTag {
  return {
    id: `tag-${Date.now()}-${index}`,
    name: `Tag ${index + 1}`,
    address: 'DB1,X0.1',
    data_type: 'Bool',
    access: 'ReadWrite',
    scan_ms: 500,
    attributes: {},
  }
}

function starterTagGroups(): TagGroup[] {
  return [
    {
      id: `group-${Date.now()}-0`,
      name: 'Main Signals',
      description: 'Starter read/write tags for initial S7 validation',
      tags: [
        {
          id: `tag-${Date.now()}-0`,
          name: 'Flow Enable',
          address: 'DB1,X0.0',
          data_type: 'Bool',
          access: 'ReadWrite',
          scan_ms: 250,
          attributes: {},
        },
        {
          id: `tag-${Date.now()}-1`,
          name: 'Line Pressure',
          address: 'DB1,REAL4',
          data_type: 'Float32',
          access: 'Read',
          scan_ms: 250,
          attributes: {},
        },
      ],
    },
  ]
}

function groupId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
}

function importRemoteGroups(groups: RemoteDriverGroup[]): TagGroup[] {
  return groups.map((group) => ({
    id: groupId('group'),
    name: group.name,
    description: 'Imported from runtime frontend',
    tags: group.tags.map((tag) => ({
      id: groupId('tag'),
      name: tag.name,
      address: tag.address || '',
      data_type: tag.data_type,
      access: tag.access,
      scan_ms: group.interval ?? 1000,
      attributes: tag.description ? { description: tag.description } : {},
    })),
  }))
}

function mergeImportedGroups(current: TagGroup[], imported: TagGroup[]): TagGroup[] {
  const next = current.map((group) => ({
    ...group,
    tags: [...group.tags],
  }))

  imported.forEach((incomingGroup) => {
    const existingGroup = next.find((group) => group.name === incomingGroup.name)
    if (!existingGroup) {
      next.push(incomingGroup)
      return
    }

    incomingGroup.tags.forEach((incomingTag) => {
      const duplicate = existingGroup.tags.some(
        (tag) => tag.name === incomingTag.name || (tag.address && tag.address === incomingTag.address)
      )
      if (!duplicate) {
        existingGroup.tags.push(incomingTag)
      }
    })
  })

  return next
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const ch = line[index]
    if (ch === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }

  cells.push(current.trim())
  return cells
}

function csvToTagGroups(csvText: string): TagGroup[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return []

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase())
  const rows = lines.slice(1).map(parseCsvLine)
  const groups = new Map<string, TagGroup>()

  rows.forEach((row, index) => {
    const record = Object.fromEntries(headers.map((header, headerIndex) => [header, row[headerIndex] ?? '']))
    const groupName = record.group || 'Imported CSV'
    const dataType = (record.data_type || record.type || 'String') as DriverTag['data_type']
    const access = (record.access || 'Read') as DriverTag['access']
    const scanMs = Number(record.scan_ms || record.interval || 1000)

    if (!groups.has(groupName)) {
      groups.set(groupName, {
        id: groupId('group'),
        name: groupName,
        description: 'Imported from CSV',
        tags: [],
      })
    }

    groups.get(groupName)?.tags.push({
      id: groupId(`tag-${index}`),
      name: record.name || `Tag ${index + 1}`,
      address: record.address || '',
      data_type: dataType,
      access,
      scan_ms: Number.isFinite(scanMs) ? scanMs : 1000,
      attributes: record.description ? { description: record.description } : {},
    })
  })

  return Array.from(groups.values())
}

export default function DriverInstanceEditor({
  runtimeNode,
  driver,
  catalog,
  schema,
  status,
  onCreate,
  onUpdate,
  onStart,
  onStop,
  onRead,
  onWrite,
}: DriverInstanceEditorProps) {
  const s7 = catalog.find((entry) => entry.key === 'siemens-s7')
  const [configDraft, setConfigDraft] = useState<Record<string, unknown>>({})
  const [tagGroupsDraft, setTagGroupsDraft] = useState<TagGroup[]>([])
  const [writeDrafts, setWriteDrafts] = useState<Record<string, string>>({})
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null)
  const [browseResult, setBrowseResult] = useState<DriverBrowseResponse | null>(null)
  const [importMessage, setImportMessage] = useState<{ severity: 'success' | 'error' | 'info'; text: string } | null>(null)

  useEffect(() => {
    if (driver) {
      setConfigDraft(driver.config)
      setTagGroupsDraft(driver.tag_groups)
      setSelectedGroupId(driver.tag_groups[0]?.id ?? null)
      setSelectedTagId(driver.tag_groups[0]?.tags[0]?.id ?? null)
    } else {
      setConfigDraft(defaultConfigFromSchema(schema, runtimeNode?.host))
      setTagGroupsDraft([])
      setSelectedGroupId(null)
      setSelectedTagId(null)
    }
  }, [driver, schema, runtimeNode])

  useEffect(() => {
    if (tagGroupsDraft.length === 0) {
      setSelectedGroupId(null)
      setSelectedTagId(null)
      return
    }

    if (!selectedGroupId || !tagGroupsDraft.some((group) => group.id === selectedGroupId)) {
      setSelectedGroupId(tagGroupsDraft[0].id)
    }
  }, [tagGroupsDraft, selectedGroupId])

  const selectedGroup = useMemo(
    () => tagGroupsDraft.find((group) => group.id === selectedGroupId) ?? tagGroupsDraft[0] ?? null,
    [selectedGroupId, tagGroupsDraft]
  )

  useEffect(() => {
    if (!selectedGroup) {
      setSelectedTagId(null)
      return
    }

    if (!selectedTagId || !selectedGroup.tags.some((tag) => tag.id === selectedTagId)) {
      setSelectedTagId(selectedGroup.tags[0]?.id ?? null)
    }
  }, [selectedGroup, selectedTagId])

  const selectedTag = useMemo(
    () => selectedGroup?.tags.find((tag) => tag.id === selectedTagId) ?? null,
    [selectedGroup, selectedTagId]
  )

  const firstWritable = useMemo(
    () => tagGroupsDraft.flatMap((group) => group.tags).find((tag) => tag.access === 'Write' || tag.access === 'ReadWrite') ?? null,
    [tagGroupsDraft]
  )

  const handleCreate = async () => {
    if (!runtimeNode || !runtimeNode.assigned_pea_id || !s7) return
    await onCreate({
      runtime_node_id: runtimeNode.id,
      pea_id: runtimeNode.assigned_pea_id,
      driver_key: s7.key,
      display_name: `${runtimeNode.name} S7`,
      config: Object.keys(configDraft).length > 0 ? configDraft : defaultConfigFromSchema(schema, runtimeNode.host),
      tag_groups: tagGroupsDraft,
    })
  }

  const handleSave = async () => {
    if (!driver) return
    await onUpdate(driver.id, {
      config: configDraft,
      tag_groups: tagGroupsDraft,
    })
  }

  const addGroup = () => {
    const group = newGroup(tagGroupsDraft.length)
    setTagGroupsDraft((current) => [...current, group])
    setSelectedGroupId(group.id)
    setSelectedTagId(null)
  }

  const updateGroup = (field: 'name' | 'description', value: string) => {
    if (!selectedGroup) return
    setTagGroupsDraft((current) =>
      current.map((group) =>
        group.id === selectedGroup.id
          ? { ...group, [field]: value }
          : group
      )
    )
  }

  const removeGroup = () => {
    if (!selectedGroup) return
    setTagGroupsDraft((current) => current.filter((group) => group.id !== selectedGroup.id))
    setSelectedGroupId(null)
    setSelectedTagId(null)
  }

  const addTag = () => {
    let targetGroupId = selectedGroup?.id
    const tag = newTag(selectedGroup?.tags.length ?? 0)

    setTagGroupsDraft((current) => {
      let next = [...current]
      if (!targetGroupId || !next.some((group) => group.id === targetGroupId)) {
        const group = newGroup(next.length)
        next = [...next, group]
        targetGroupId = group.id
      }

      return next.map((group) =>
        group.id === targetGroupId
          ? { ...group, tags: [...group.tags, tag] }
          : group
      )
    })

    setSelectedGroupId(targetGroupId ?? null)
    setSelectedTagId(tag.id)
  }

  const updateTag = (nextTag: DriverTag) => {
    if (!selectedGroup) return
    setTagGroupsDraft((current) =>
      current.map((group) =>
        group.id !== selectedGroup.id
          ? group
          : {
              ...group,
              tags: group.tags.map((tag) => (tag.id === nextTag.id ? nextTag : tag)),
            }
      )
    )
  }

  const removeTag = (tagId: string) => {
    if (!selectedGroup) return
    setTagGroupsDraft((current) =>
      current.map((group) =>
        group.id !== selectedGroup.id
          ? group
          : { ...group, tags: group.tags.filter((tag) => tag.id !== tagId) }
      )
    )
    if (selectedTagId === tagId) setSelectedTagId(null)
  }

  const applyRuntimeHost = () => {
    if (!runtimeNode) return
    setConfigDraft((current) => ({
      ...current,
      host: runtimeNode.host,
    }))
  }

  const applySchemaDefaults = () => {
    setConfigDraft((current) =>
      mergeMissingConfigValues(current, defaultConfigFromSchema(schema, runtimeNode?.host))
    )
  }

  const seedStarterTags = () => {
    const nextGroups = starterTagGroups()
    setTagGroupsDraft(nextGroups)
    setSelectedGroupId(nextGroups[0]?.id ?? null)
    setSelectedTagId(nextGroups[0]?.tags[0]?.id ?? null)
  }

  const duplicateSelectedTag = () => {
    if (!selectedGroup || !selectedTag) return
    const duplicate: DriverTag = {
      ...selectedTag,
      id: `tag-${Date.now()}-dup`,
      name: `${selectedTag.name} Copy`,
    }
    setTagGroupsDraft((current) =>
      current.map((group) =>
        group.id !== selectedGroup.id
          ? group
          : { ...group, tags: [...group.tags, duplicate] }
      )
    )
    setSelectedTagId(duplicate.id)
  }

  const importGroupsIntoDraft = (groups: TagGroup[], sourceLabel: string) => {
    if (groups.length === 0) {
      setImportMessage({ severity: 'info', text: `No tags found in ${sourceLabel}.` })
      return
    }
    setTagGroupsDraft((current) => mergeImportedGroups(current, groups))
    setSelectedGroupId((current) => current ?? groups[0]?.id ?? null)
    setSelectedTagId((current) => current ?? groups[0]?.tags[0]?.id ?? null)
    const importedTagCount = groups.reduce((total, group) => total + group.tags.length, 0)
    setImportMessage({
      severity: 'success',
      text: `Imported ${importedTagCount} tag${importedTagCount === 1 ? '' : 's'} from ${sourceLabel}.`,
    })
  }

  const handleBrowseRemote = async () => {
    if (!driver) return
    try {
      const response = await apiService.browseDriverTags(driver.id)
      setBrowseResult(response)
      setImportMessage({
        severity: 'info',
        text: `Discovered ${response.groups.reduce((total, group) => total + group.tags.length, 0)} remote tag(s).`,
      })
    } catch (error) {
      setImportMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Failed to browse remote tags.',
      })
    }
  }

  const handleImportRemoteAll = () => {
    if (!browseResult) return
    importGroupsIntoDraft(importRemoteGroups(browseResult.groups), 'runtime frontend browse result')
  }

  const handleImportRemoteGroup = (group: RemoteDriverGroup) => {
    importGroupsIntoDraft(importRemoteGroups([group]), group.name)
  }

  const handleCsvImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      importGroupsIntoDraft(csvToTagGroups(text), `${file.name} CSV`)
    } catch (error) {
      setImportMessage({
        severity: 'error',
        text: error instanceof Error ? error.message : 'Failed to import CSV.',
      })
    }
  }

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>Driver Instance</Typography>
      {!runtimeNode ? (
        <Alert severity="info">Select a runtime node first.</Alert>
      ) : driver ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Box>
            <Typography variant="body2">{driver.display_name}</Typography>
            <Typography variant="body2" color="text.secondary">{driver.driver_key} | {driver.state}</Typography>
            {schema && (
              <Typography variant="caption" color="text.secondary">
                Config schema source: {schema.source ?? 'builtin'}
              </Typography>
            )}
          </Box>

          <SchemaForm schema={schema?.config_schema ?? null} value={configDraft} onChange={setConfigDraft} />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="contained" onClick={handleSave}>Save And Sync</Button>
            <Button variant="contained" onClick={() => onStart(driver.id)}>Start Driver</Button>
            <Button variant="outlined" onClick={() => onStop(driver.id)}>Stop Driver</Button>
            <Button variant="outlined" onClick={applyRuntimeHost}>
              Use Runtime Host
            </Button>
            <Button variant="outlined" onClick={applySchemaDefaults}>
              Fill Missing Defaults
            </Button>
            <Button variant="outlined" onClick={seedStarterTags}>
              Seed Starter Tags
            </Button>
            <Button variant="outlined" onClick={() => void handleBrowseRemote()}>
              Browse Remote Tags
            </Button>
            <Button variant="outlined" onClick={handleImportRemoteAll} disabled={!browseResult || browseResult.groups.length === 0}>
              Import All Remote
            </Button>
            <Button variant="outlined" component="label">
              Import CSV
              <input hidden type="file" accept=".csv,text/csv" onChange={handleCsvImport} />
            </Button>
          </Box>

          {importMessage && <Alert severity={importMessage.severity}>{importMessage.text}</Alert>}

          {browseResult && browseResult.groups.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Remote Frontend Tags
              </Typography>
              <List sx={{ p: 0 }}>
                {browseResult.groups.map((group) => (
                  <ListItemButton key={group.name} onClick={() => handleImportRemoteGroup(group)}>
                    <ListItemText
                      primary={group.name}
                      secondary={`${group.tags.length} remote tag${group.tags.length === 1 ? '' : 's'}${group.interval ? ` | ${group.interval} ms` : ''}`}
                    />
                  </ListItemButton>
                ))}
              </List>
              <Typography variant="caption" color="text.secondary">
                Click a group to import it, or use Import All Remote.
              </Typography>
            </Paper>
          )}

          <Divider />

          <Box sx={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 2 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Tag Groups</Typography>
                  <IconButton size="small" onClick={addGroup}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Box>
                {tagGroupsDraft.length === 0 ? (
                  <Alert severity="info">No tag groups yet.</Alert>
                ) : (
                  <List sx={{ p: 0 }}>
                    {tagGroupsDraft.map((group) => (
                      <ListItemButton key={group.id} selected={selectedGroup?.id === group.id} onClick={() => setSelectedGroupId(group.id)}>
                        <ListItemText
                          primary={group.name}
                          secondary={`${group.tags.length} tag${group.tags.length === 1 ? '' : 's'}`}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                )}
                {selectedGroup && (
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, mt: 2 }}>
                    <TextField
                      label="Group Name"
                      value={selectedGroup.name}
                      onChange={(event) => updateGroup('name', event.target.value)}
                      fullWidth
                    />
                    <Button color="error" variant="outlined" onClick={removeGroup}>
                      Remove
                    </Button>
                    <TextField
                      label="Description"
                      value={selectedGroup.description ?? ''}
                      onChange={(event) => updateGroup('description', event.target.value)}
                      fullWidth
                      sx={{ gridColumn: '1 / -1' }}
                    />
                  </Box>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    {selectedGroup ? `${selectedGroup.name} Tags` : 'Tags'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" onClick={duplicateSelectedTag} disabled={!selectedTag}>
                      Duplicate Tag
                    </Button>
                    <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addTag}>
                      Add Tag
                    </Button>
                  </Box>
                </Box>
                {!selectedGroup ? (
                  <Alert severity="info">Create or select a tag group first.</Alert>
                ) : selectedGroup.tags.length === 0 ? (
                  <Alert severity="info">No tags in this group yet.</Alert>
                ) : (
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Address</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Access</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedGroup.tags.map((tag) => (
                        <TableRow
                          key={tag.id}
                          hover
                          selected={selectedTagId === tag.id}
                          onClick={() => setSelectedTagId(tag.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>{tag.name}</TableCell>
                          <TableCell>{tag.address}</TableCell>
                          <TableCell>{tag.data_type}</TableCell>
                          <TableCell>{tag.access}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  onRead(driver.id, tag.id)
                                }}
                              >
                                Read
                              </Button>
                              {(tag.access === 'Write' || tag.access === 'ReadWrite') && (
                                <>
                                  <TextField
                                    size="small"
                                    placeholder="value"
                                    value={writeDrafts[tag.id] ?? ''}
                                    onChange={(event) =>
                                      setWriteDrafts((current) => ({ ...current, [tag.id]: event.target.value }))
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                    sx={{ width: 96 }}
                                  />
                                  <Button
                                    size="small"
                                    variant="contained"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      onWrite(driver.id, tag.id, writeDrafts[tag.id] ?? true, driver.pea_id)
                                    }}
                                  >
                                    Write
                                  </Button>
                                </>
                              )}
                              <IconButton
                                size="small"
                                color="error"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  removeTag(tag.id)
                                }}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Paper>
            </Box>

            <TagEditorPanel
              schema={schema}
              group={selectedGroup}
              tag={selectedTag}
              onChange={updateTag}
              onAdd={addTag}
            />
          </Box>

          <DriverStatusPanel status={status} />

          {firstWritable && (
            <Typography variant="caption" color="text.secondary">
              First writable tag available for commissioning: {firstWritable.name}
            </Typography>
          )}
        </Box>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Alert severity="info">No driver instance for this node yet.</Alert>
          {schema && (
            <SchemaForm schema={schema.config_schema ?? null} value={configDraft} onChange={setConfigDraft} />
          )}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={applyRuntimeHost}>
              Use Runtime Host
            </Button>
            <Button variant="outlined" onClick={applySchemaDefaults}>
              Fill Missing Defaults
            </Button>
            <Button variant="outlined" component="label">
              Import CSV
              <input hidden type="file" accept=".csv,text/csv" onChange={handleCsvImport} />
            </Button>
            <Button variant="contained" onClick={handleCreate} disabled={!runtimeNode.assigned_pea_id || !s7}>
              Create Siemens S7 Driver
            </Button>
          </Box>
          {importMessage && <Alert severity={importMessage.severity}>{importMessage.text}</Alert>}
        </Box>
      )}
    </Paper>
  )
}
