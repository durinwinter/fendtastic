import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
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
import { DriverCatalogEntry, DriverInstance, DriverSchemaPayload, DriverStatusSnapshot, TagGroup } from '../../types/driver'
import { RuntimeNode } from '../../types/runtime'
import SchemaForm from './SchemaForm'
import DriverStatusPanel from './DriverStatusPanel'

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
  onRead: (id: string, tagId: string) => Promise<void>
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

  useEffect(() => {
    if (driver) {
      setConfigDraft(driver.config)
      setTagGroupsDraft(driver.tag_groups)
    } else {
      setConfigDraft(defaultConfigFromSchema(schema, runtimeNode?.host))
      setTagGroupsDraft([])
    }
  }, [driver, schema, runtimeNode])

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
    })
  }

  const handleSave = async () => {
    if (!driver) return
    await onUpdate(driver.id, {
      config: configDraft,
      tag_groups: tagGroupsDraft,
    })
  }

  const addTag = () => {
    if (tagGroupsDraft.length === 0) {
      setTagGroupsDraft([
        {
          id: 'main',
          name: 'Main Signals',
          description: 'Editable runtime tags',
          tags: [],
        },
      ])
      return
    }
    setTagGroupsDraft((current) => current.map((group, index) => index === 0
      ? {
          ...group,
          tags: [
            ...group.tags,
            {
              id: `tag-${group.tags.length + 1}`,
              name: `New Tag ${group.tags.length + 1}`,
              address: 'DB1,X0.1',
              data_type: 'Bool',
              access: 'ReadWrite',
              scan_ms: 500,
              attributes: {},
            },
          ],
        }
      : group))
  }

  const updateTagField = (groupIndex: number, tagIndex: number, field: string, nextValue: unknown) => {
    setTagGroupsDraft((current) => current.map((group, currentGroupIndex) => {
      if (currentGroupIndex !== groupIndex) return group
      return {
        ...group,
        tags: group.tags.map((tag, currentTagIndex) => currentTagIndex === tagIndex ? { ...tag, [field]: nextValue } : tag),
      }
    }))
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
          </Box>

          <Divider />

          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Tag Groups</Typography>
              <IconButton size="small" onClick={addTag}><AddIcon fontSize="small" /></IconButton>
            </Box>
            {tagGroupsDraft.length === 0 ? (
              <Alert severity="info">No tag groups yet.</Alert>
            ) : tagGroupsDraft.map((group, groupIndex) => (
              <Box key={group.id} sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>{group.name}</Typography>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Address</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Access</TableCell>
                      <TableCell>Scan</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {group.tags.map((tag, tagIndex) => (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <TextField size="small" value={tag.name} onChange={(event) => updateTagField(groupIndex, tagIndex, 'name', event.target.value)} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" value={tag.address} onChange={(event) => updateTagField(groupIndex, tagIndex, 'address', event.target.value)} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" value={tag.data_type} onChange={(event) => updateTagField(groupIndex, tagIndex, 'data_type', event.target.value)} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" value={tag.access} onChange={(event) => updateTagField(groupIndex, tagIndex, 'access', event.target.value)} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" value={tag.scan_ms ?? ''} onChange={(event) => updateTagField(groupIndex, tagIndex, 'scan_ms', Number(event.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" variant="outlined" onClick={() => onRead(driver.id, tag.id)}>Read</Button>
                            {(tag.access === 'Write' || tag.access === 'ReadWrite') && (
                              <>
                                <TextField
                                  size="small"
                                  placeholder="value"
                                  value={writeDrafts[tag.id] ?? ''}
                                  onChange={(event) => setWriteDrafts((current) => ({ ...current, [tag.id]: event.target.value }))}
                                  sx={{ width: 96 }}
                                />
                                <Button size="small" variant="contained" onClick={() => onWrite(driver.id, tag.id, writeDrafts[tag.id] ?? true, driver.pea_id)}>Write</Button>
                              </>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            ))}
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
          <Button variant="contained" onClick={handleCreate} disabled={!runtimeNode.assigned_pea_id || !s7}>Create Siemens S7 Driver</Button>
        </Box>
      )}
    </Paper>
  )
}
