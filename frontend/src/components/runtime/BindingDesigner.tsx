import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
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
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { DriverInstance, DriverTag } from '../../types/driver'
import { BindingReadResponse, BindingWriteResponse, PeaBinding, TagBinding } from '../../types/binding'
import { RuntimeNode } from '../../types/runtime'
import { ActiveElement, IndicatorElement, PeaConfig, ServiceParameter } from '../../types/mtp'

interface CanonicalTagOption {
  key: string
  direction: TagBinding['direction']
  source: string
}

interface DriverTagOption {
  id: string
  label: string
  access: 'Read' | 'Write' | 'ReadWrite'
  data_type: DriverTag['data_type']
  search_text: string
}

interface DraftMapping extends TagBinding {
  ui_id: string
  transform_raw: string
  transform_error: string | null
  suggested_driver_tag_id: string | null
}

interface CommissionResult {
  severity: 'success' | 'error' | 'info'
  message: string
}

interface BindingDesignerProps {
  runtimeNode: RuntimeNode | null
  driver: DriverInstance | null
  binding: PeaBinding | null
  pea: PeaConfig | null
  onCreate: (payload: any) => Promise<void>
  onUpdate: (id: string, payload: any) => Promise<void>
  onValidate: (id: string) => Promise<void>
  onRead: (bindingId: string, canonicalTag: string) => Promise<BindingReadResponse>
  onWrite: (bindingId: string, canonicalTag: string, value: unknown) => Promise<BindingWriteResponse>
}

function parameterTag(parameter: ServiceParameter): string {
  return parameter.tag
}

function indicatorTag(indicator: IndicatorElement): string {
  return indicator.tag
}

function pushCanonicalTag(
  tags: CanonicalTagOption[],
  key: string,
  direction: CanonicalTagOption['direction'],
  source: string
) {
  if (tags.some((tag) => tag.key === key)) return
  tags.push({ key, direction, source })
}

function canonicalTagsFromActiveElement(element: ActiveElement, tags: CanonicalTagOption[]) {
  switch (element.element_type) {
    case 'BinVlv':
      pushCanonicalTag(tags, `active.${element.tag}.open_fbk`, 'ReadFromDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.close_fbk`, 'ReadFromDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.open_cmd`, 'WriteToDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.close_cmd`, 'WriteToDriver', 'active element')
      break
    case 'BinMon':
      pushCanonicalTag(tags, `active.${element.tag}.fbk`, 'ReadFromDriver', 'active element')
      break
    case 'AnaVlv':
      pushCanonicalTag(tags, `active.${element.tag}.pos_fbk`, 'ReadFromDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.pos_sp`, 'WriteToDriver', 'active element')
      break
    case 'BinDrv':
      pushCanonicalTag(tags, `active.${element.tag}.fwd_fbk`, 'ReadFromDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.rev_fbk`, 'ReadFromDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.fwd_cmd`, 'WriteToDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.rev_cmd`, 'WriteToDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.stop_cmd`, 'WriteToDriver', 'active element')
      break
    case 'AnaDrv':
    case 'DIntDrv':
      pushCanonicalTag(tags, `active.${element.tag}.rpm_fbk`, 'ReadFromDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.rpm_sp`, 'WriteToDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.fwd_cmd`, 'WriteToDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.rev_cmd`, 'WriteToDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.stop_cmd`, 'WriteToDriver', 'active element')
      break
    case 'DIntMon':
      pushCanonicalTag(tags, `active.${element.tag}.fbk`, 'ReadFromDriver', 'active element')
      break
    case 'PIDCtrl':
      pushCanonicalTag(tags, `active.${element.tag}.pv`, 'ReadFromDriver', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.sp`, 'Bidirectional', 'active element')
      pushCanonicalTag(tags, `active.${element.tag}.mv`, 'WriteToDriver', 'active element')
      break
  }
}

function canonicalTagsFromPea(pea: PeaConfig | null): CanonicalTagOption[] {
  if (!pea) return []

  const tags: CanonicalTagOption[] = []

  pea.services.forEach((service) => {
    service.config_parameters.forEach((parameter) => {
      pushCanonicalTag(
        tags,
        `service.${service.tag}.config.${parameterTag(parameter)}`,
        'Bidirectional',
        'service config'
      )
    })

    service.procedures.forEach((procedure) => {
      procedure.parameters.forEach((parameter) => {
        pushCanonicalTag(
          tags,
          `service.${service.tag}.procedure.${procedure.id}.param.${parameterTag(parameter)}`,
          'Bidirectional',
          'procedure parameter'
        )
      })
      procedure.process_value_outs.forEach((indicator) => {
        pushCanonicalTag(
          tags,
          `service.${service.tag}.procedure.${procedure.id}.pvo.${indicatorTag(indicator)}`,
          'ReadFromDriver',
          'procedure output'
        )
      })
      procedure.report_values.forEach((indicator) => {
        pushCanonicalTag(
          tags,
          `service.${service.tag}.procedure.${procedure.id}.report.${indicatorTag(indicator)}`,
          'ReadFromDriver',
          'procedure report'
        )
      })
    })
  })

  pea.active_elements.forEach((element) => canonicalTagsFromActiveElement(element, tags))

  return tags
}

function flattenDriverTags(driver: DriverInstance | null): DriverTagOption[] {
  if (!driver) return []
  return driver.tag_groups.flatMap((group) =>
    group.tags.map((tag) => ({
      id: tag.id,
      label: `${group.name} / ${tag.name} (${tag.address})`,
      access: tag.access,
      data_type: tag.data_type,
      search_text: `${group.name} ${tag.name} ${tag.address}`.toLowerCase(),
    }))
  )
}

function supportsDirection(
  access: DriverTagOption['access'],
  direction: TagBinding['direction']
): boolean {
  if (direction === 'ReadFromDriver') return access === 'Read' || access === 'ReadWrite'
  if (direction === 'WriteToDriver') return access === 'Write' || access === 'ReadWrite'
  return access === 'ReadWrite'
}

function compatibleDriverTagId(
  direction: TagBinding['direction'],
  driverTags: DriverTagOption[]
): string {
  return driverTags.find((tag) => supportsDirection(tag.access, direction))?.id ?? driverTags[0]?.id ?? ''
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((token) => token.trim())
    .filter(Boolean)
}

function tagSimilarityScore(canonicalTag: CanonicalTagOption, driverTag: DriverTagOption): number {
  if (!supportsDirection(driverTag.access, canonicalTag.direction)) return -1

  const canonicalTokens = tokenize(canonicalTag.key)
  const driverTokens = new Set(tokenize(driverTag.search_text))
  const shared = canonicalTokens.filter((token) => driverTokens.has(token))
  const lastCanonicalToken = canonicalTokens[canonicalTokens.length - 1]
  const score =
    shared.length * 4 +
    (lastCanonicalToken && driverTokens.has(lastCanonicalToken) ? 6 : 0) +
    (canonicalTag.key.includes('cmd') && (driverTokens.has('cmd') || driverTokens.has('command')) ? 3 : 0) +
    (canonicalTag.key.includes('fbk') && (driverTokens.has('fbk') || driverTokens.has('feedback')) ? 3 : 0)

  return score
}

function bestDriverSuggestion(
  canonicalTag: CanonicalTagOption,
  driverTags: DriverTagOption[],
  usedDriverTagIds: Set<string>
): string | null {
  const ranked = driverTags
    .filter((tag) => !usedDriverTagIds.has(tag.id))
    .map((tag) => ({ tag, score: tagSimilarityScore(canonicalTag, tag) }))
    .sort((left, right) => right.score - left.score)

  if (!ranked.length) return null
  if (ranked[0].score > 0) return ranked[0].tag.id

  const compatible = driverTags.filter(
    (tag) => !usedDriverTagIds.has(tag.id) && supportsDirection(tag.access, canonicalTag.direction)
  )
  if (compatible.length === 1) return compatible[0].id
  return null
}

function parseTransform(raw: string): { value: Record<string, unknown> | null; error: string | null } {
  if (!raw.trim()) return { value: null, error: null }
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      return { value: null, error: 'Transform must be a JSON object.' }
    }
    return { value: parsed as Record<string, unknown>, error: null }
  } catch {
    return { value: null, error: 'Transform must be valid JSON.' }
  }
}

function toDraftMapping(mapping: TagBinding, driverTags: DriverTagOption[]): DraftMapping {
  const transform = mapping.transform ? JSON.stringify(mapping.transform) : ''
  return {
    ...mapping,
    ui_id: crypto.randomUUID(),
    transform_raw: transform,
    transform_error: parseTransform(transform).error,
    suggested_driver_tag_id:
      driverTags.find((tag) => tag.id === mapping.driver_tag_id)?.id ?? null,
  }
}

function buildDraftMapping(
  canonicalTags: CanonicalTagOption[],
  driverTags: DriverTagOption[],
  existing: DraftMapping[]
): DraftMapping {
  const nextCanonical =
    canonicalTags.find((tag) => !existing.some((mapping) => mapping.canonical_tag === tag.key)) ??
    canonicalTags[0]
  const suggested = nextCanonical
    ? bestDriverSuggestion(nextCanonical, driverTags, new Set(existing.map((mapping) => mapping.driver_tag_id)))
    : null

  return {
    ui_id: crypto.randomUUID(),
    canonical_tag: nextCanonical?.key ?? '',
    direction: nextCanonical?.direction ?? 'ReadFromDriver',
    driver_tag_id: suggested ?? compatibleDriverTagId(nextCanonical?.direction ?? 'ReadFromDriver', driverTags),
    transform: null,
    transform_raw: '',
    transform_error: null,
    suggested_driver_tag_id: suggested,
  }
}

function initialCommissionValue(dataType: DriverTag['data_type'] | undefined): unknown {
  switch (dataType) {
    case 'Bool':
      return false
    case 'Int16':
    case 'Uint16':
    case 'Int32':
    case 'Uint32':
    case 'Float32':
    case 'Float64':
      return 0
    default:
      return ''
  }
}

function normalizedMappings(mappings: TagBinding[]): Array<{
  canonical_tag: string
  driver_tag_id: string
  direction: TagBinding['direction']
  transform: Record<string, unknown> | null
}> {
  return mappings
    .map((mapping) => ({
      canonical_tag: mapping.canonical_tag,
      driver_tag_id: mapping.driver_tag_id,
      direction: mapping.direction,
      transform: (mapping.transform as Record<string, unknown> | null) ?? null,
    }))
    .sort((left, right) => left.canonical_tag.localeCompare(right.canonical_tag))
}

function isNumericDataType(dataType: DriverTag['data_type'] | undefined): boolean {
  return ['Int16', 'Uint16', 'Int32', 'Uint32', 'Float32', 'Float64'].includes(dataType ?? '')
}

export default function BindingDesigner({
  runtimeNode,
  driver,
  binding,
  pea,
  onCreate,
  onUpdate,
  onValidate,
  onRead,
  onWrite,
}: BindingDesignerProps) {
  const canonicalTags = useMemo(() => canonicalTagsFromPea(pea), [pea])
  const driverTags = useMemo(() => flattenDriverTags(driver), [driver])
  const driverTagMap = useMemo(
    () => new Map(driverTags.map((tag) => [tag.id, tag])),
    [driverTags]
  )
  const [draftMappings, setDraftMappings] = useState<DraftMapping[]>([])
  const [commissionInputs, setCommissionInputs] = useState<Record<string, unknown>>({})
  const [commissionResults, setCommissionResults] = useState<Record<string, CommissionResult>>({})

  useEffect(() => {
    setDraftMappings((binding?.mappings ?? []).map((mapping) => toDraftMapping(mapping, driverTags)))
    setCommissionResults({})
    setCommissionInputs({})
  }, [binding?.id, binding?.mappings, driverTags])

  const mappedCanonicalTags = useMemo(
    () => new Set(draftMappings.map((mapping) => mapping.canonical_tag)),
    [draftMappings]
  )
  const unmappedCanonicalTags = useMemo(
    () => canonicalTags.filter((tag) => !mappedCanonicalTags.has(tag.key)),
    [canonicalTags, mappedCanonicalTags]
  )
  const hasTransformErrors = draftMappings.some((mapping) => Boolean(mapping.transform_error))
  const hasIncompleteMappings = draftMappings.some(
    (mapping) => !mapping.canonical_tag || !mapping.driver_tag_id
  )
  const draftTagBindings = useMemo<TagBinding[]>(
    () =>
      draftMappings.map(({ ui_id, transform_raw, transform_error, suggested_driver_tag_id, ...mapping }) => ({
        ...mapping,
      })),
    [draftMappings]
  )
  const isDirty = useMemo(() => {
    const persisted = normalizedMappings(binding?.mappings ?? [])
    const draft = normalizedMappings(draftTagBindings)
    return JSON.stringify(persisted) !== JSON.stringify(draft)
  }, [binding?.mappings, draftTagBindings])

  const updateDraftMapping = (uiId: string, updater: (mapping: DraftMapping) => DraftMapping) => {
    setDraftMappings((current) =>
      current.map((mapping) => (mapping.ui_id === uiId ? updater(mapping) : mapping))
    )
  }

  const addMapping = () => {
    setDraftMappings((current) => [...current, buildDraftMapping(canonicalTags, driverTags, current)])
  }

  const removeMapping = (uiId: string) => {
    setDraftMappings((current) => current.filter((mapping) => mapping.ui_id !== uiId))
    setCommissionResults((current) => {
      const next = { ...current }
      delete next[uiId]
      return next
    })
    setCommissionInputs((current) => {
      const next = { ...current }
      delete next[uiId]
      return next
    })
  }

  const autoSuggestUnmapped = () => {
    const usedDriverTagIds = new Set(draftMappings.map((mapping) => mapping.driver_tag_id))
    const additions: DraftMapping[] = []

    unmappedCanonicalTags.forEach((canonicalTag) => {
      const suggested = bestDriverSuggestion(canonicalTag, driverTags, usedDriverTagIds)
      if (!suggested) return
      usedDriverTagIds.add(suggested)
      additions.push({
        ui_id: crypto.randomUUID(),
        canonical_tag: canonicalTag.key,
        direction: canonicalTag.direction,
        driver_tag_id: suggested,
        transform: null,
        transform_raw: '',
        transform_error: null,
        suggested_driver_tag_id: suggested,
      })
    })

    if (additions.length > 0) {
      setDraftMappings((current) => [...current, ...additions])
    }
  }

  const refreshSuggestionForMapping = (mapping: DraftMapping): string | null => {
    const canonical = canonicalTags.find((tag) => tag.key === mapping.canonical_tag)
    if (!canonical) return null
    const usedDriverTagIds = new Set(
      draftMappings
        .filter((candidate) => candidate.ui_id !== mapping.ui_id)
        .map((candidate) => candidate.driver_tag_id)
    )
    return bestDriverSuggestion(canonical, driverTags, usedDriverTagIds)
  }

  const handleCreate = async () => {
    if (!runtimeNode || !runtimeNode.assigned_pea_id || !driver || hasTransformErrors || hasIncompleteMappings) return
    const mappings = draftTagBindings.length > 0
      ? draftTagBindings
      : (() => {
          const seed = buildDraftMapping(canonicalTags, driverTags, [])
          const { ui_id, transform_raw, transform_error, suggested_driver_tag_id, ...mapping } = seed
          void ui_id
          void transform_raw
          void transform_error
          void suggested_driver_tag_id
          return [mapping]
        })()
    await onCreate({
      pea_id: runtimeNode.assigned_pea_id,
      runtime_node_id: runtimeNode.id,
      driver_instance_id: driver.id,
      mappings,
    })
  }

  const handleSave = async () => {
    if (!binding || hasTransformErrors || hasIncompleteMappings || !isDirty) return
    await onUpdate(binding.id, { mappings: draftTagBindings })
  }

  const handleCommissionRead = async (mapping: DraftMapping) => {
    if (!binding) return
    try {
      const result = await onRead(binding.id, mapping.canonical_tag)
      setCommissionResults((current) => ({
        ...current,
        [mapping.ui_id]: {
          severity: 'success',
          message: `Read ${mapping.canonical_tag}: ${JSON.stringify(result.result.value)}`,
        },
      }))
    } catch (error) {
      setCommissionResults((current) => ({
        ...current,
        [mapping.ui_id]: {
          severity: 'error',
          message: error instanceof Error ? error.message : 'Read failed',
        },
      }))
    }
  }

  const handleCommissionWrite = async (mapping: DraftMapping) => {
    if (!binding) return
    try {
      const value = commissionInputs[mapping.ui_id]
      await onWrite(binding.id, mapping.canonical_tag, value)
      setCommissionResults((current) => ({
        ...current,
        [mapping.ui_id]: {
          severity: 'success',
          message: `Wrote ${mapping.canonical_tag}: ${JSON.stringify(value)}`,
        },
      }))
    } catch (error) {
      setCommissionResults((current) => ({
        ...current,
        [mapping.ui_id]: {
          severity: 'error',
          message: error instanceof Error ? error.message : 'Write failed',
        },
      }))
    }
  }

  const validation = binding?.validation ?? null

  return (
    <Paper sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
        Binding Designer
      </Typography>

      {!runtimeNode ? (
        <Alert severity="info">Select a runtime node first.</Alert>
      ) : !driver ? (
        <Alert severity="info">Create and configure a driver before creating bindings.</Alert>
      ) : !pea ? (
        <Alert severity="warning">This runtime node is not assigned to a PEA definition.</Alert>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Chip label={`${canonicalTags.length} canonical tags`} color="primary" variant="outlined" />
            <Chip label={`${driverTags.length} driver tags`} color="secondary" variant="outlined" />
            <Chip label={`${draftMappings.length} mapped`} color={draftMappings.length > 0 ? 'success' : 'default'} variant="outlined" />
            <Chip label={`${unmappedCanonicalTags.length} unmapped`} color={unmappedCanonicalTags.length > 0 ? 'warning' : 'success'} variant="outlined" />
            <Chip label={isDirty ? 'Unsaved Changes' : 'Saved'} color={isDirty ? 'warning' : 'success'} variant="outlined" />
          </Box>

          {validation && (
            <Alert severity={validation.valid ? 'success' : 'warning'}>
              {validation.valid ? 'Binding validates cleanly.' : 'Binding has validation issues.'}
            </Alert>
          )}

          {hasTransformErrors && (
            <Alert severity="error">Fix transform JSON errors before saving or creating the binding.</Alert>
          )}

          <Box sx={{ display: 'grid', gridTemplateColumns: '1.2fr 1.6fr', gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Canonical Tags
              </Typography>
              {canonicalTags.length === 0 ? (
                <Alert severity="info">This PEA does not expose canonical tags yet.</Alert>
              ) : (
                <List dense sx={{ maxHeight: 420, overflow: 'auto' }}>
                  {canonicalTags.map((tag) => (
                    <ListItem key={tag.key} disableGutters>
                      <ListItemText
                        primary={tag.key}
                        secondary={`${tag.source} | ${tag.direction}${mappedCanonicalTags.has(tag.key) ? ' | mapped' : ''}`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Mapping Table
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AutoFixHighIcon />}
                    onClick={autoSuggestUnmapped}
                    disabled={unmappedCanonicalTags.length === 0 || driverTags.length === 0}
                  >
                    Auto-Suggest Unmapped
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addMapping}
                    disabled={canonicalTags.length === 0 || driverTags.length === 0}
                  >
                    Add Mapping
                  </Button>
                </Box>
              </Box>

              {draftMappings.length === 0 ? (
                <Alert severity="info">No mappings configured yet.</Alert>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Canonical Tag</TableCell>
                      <TableCell>Direction</TableCell>
                      <TableCell>Driver Tag</TableCell>
                      <TableCell>Transform</TableCell>
                      <TableCell align="right">Remove</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {draftMappings.map((mapping) => {
                      const selectedDriverTag = driverTags.find((tag) => tag.id === mapping.driver_tag_id)
                      const suggestedDriverTag = mapping.suggested_driver_tag_id
                        ? driverTags.find((tag) => tag.id === mapping.suggested_driver_tag_id)
                        : null

                      return (
                        <TableRow key={mapping.ui_id} hover>
                          <TableCell sx={{ minWidth: 280 }}>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={mapping.canonical_tag}
                              onChange={(event) => {
                                const nextCanonical = canonicalTags.find((tag) => tag.key === event.target.value)
                                const nextDirection = nextCanonical?.direction ?? mapping.direction
                                const nextSuggestion = nextCanonical
                                  ? bestDriverSuggestion(
                                      nextCanonical,
                                      driverTags,
                                      new Set(
                                        draftMappings
                                          .filter((candidate) => candidate.ui_id !== mapping.ui_id)
                                          .map((candidate) => candidate.driver_tag_id)
                                      )
                                    )
                                  : null
                                updateDraftMapping(mapping.ui_id, (current) => ({
                                  ...current,
                                  canonical_tag: event.target.value,
                                  direction: nextDirection,
                                  driver_tag_id: nextSuggestion ?? compatibleDriverTagId(nextDirection, driverTags),
                                  suggested_driver_tag_id: nextSuggestion,
                                }))
                              }}
                            >
                              {canonicalTags.map((tag) => (
                                <MenuItem key={tag.key} value={tag.key}>
                                  {tag.key}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell sx={{ minWidth: 160 }}>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={mapping.direction}
                              onChange={(event) => {
                                const nextDirection = event.target.value as TagBinding['direction']
                                const nextSuggestion = refreshSuggestionForMapping(mapping)
                                updateDraftMapping(mapping.ui_id, (current) => ({
                                  ...current,
                                  direction: nextDirection,
                                  driver_tag_id:
                                    supportsDirection(
                                      driverTags.find((tag) => tag.id === current.driver_tag_id)?.access ?? 'Read',
                                      nextDirection
                                    )
                                      ? current.driver_tag_id
                                      : compatibleDriverTagId(nextDirection, driverTags),
                                  suggested_driver_tag_id: nextSuggestion,
                                }))
                              }}
                            >
                              <MenuItem value="ReadFromDriver">ReadFromDriver</MenuItem>
                              <MenuItem value="WriteToDriver">WriteToDriver</MenuItem>
                              <MenuItem value="Bidirectional">Bidirectional</MenuItem>
                            </TextField>
                          </TableCell>
                          <TableCell sx={{ minWidth: 280 }}>
                            <TextField
                              select
                              fullWidth
                              size="small"
                              value={mapping.driver_tag_id}
                              onChange={(event) =>
                                updateDraftMapping(mapping.ui_id, (current) => ({
                                  ...current,
                                  driver_tag_id: event.target.value,
                                  suggested_driver_tag_id: refreshSuggestionForMapping(current),
                                }))
                              }
                              helperText={
                                selectedDriverTag && !supportsDirection(selectedDriverTag.access, mapping.direction)
                                  ? 'Selected tag access does not match this binding direction.'
                                  : suggestedDriverTag && suggestedDriverTag.id !== mapping.driver_tag_id
                                    ? `Suggested: ${suggestedDriverTag.label}`
                                    : ' '
                              }
                            >
                              {driverTags.map((tag) => (
                                <MenuItem key={tag.id} value={tag.id}>
                                  {tag.label}
                                </MenuItem>
                              ))}
                            </TextField>
                          </TableCell>
                          <TableCell sx={{ minWidth: 220 }}>
                            <TextField
                              fullWidth
                              size="small"
                              placeholder='{"scale":1}'
                              value={mapping.transform_raw}
                              error={Boolean(mapping.transform_error)}
                              helperText={mapping.transform_error ?? ' '}
                              onChange={(event) => {
                                const transform = parseTransform(event.target.value)
                                updateDraftMapping(mapping.ui_id, (current) => ({
                                  ...current,
                                  transform_raw: event.target.value,
                                  transform: transform.value,
                                  transform_error: transform.error,
                                }))
                              }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <IconButton color="error" size="small" onClick={() => removeMapping(mapping.ui_id)}>
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </Paper>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Unmapped Canonical Tags
              </Typography>
              {unmappedCanonicalTags.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  All canonical tags are mapped.
                </Typography>
              ) : (
                <List dense sx={{ maxHeight: 220, overflow: 'auto' }}>
                  {unmappedCanonicalTags.slice(0, 12).map((tag) => (
                    <ListItem key={tag.key} disableGutters>
                      <ListItemText primary={tag.key} secondary={`${tag.source} | ${tag.direction}`} />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Validation Details
              </Typography>
              {!validation ? (
                <Typography variant="body2" color="text.secondary">
                  Save or validate a binding to see backend checks.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {validation.errors.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No validation errors.
                    </Typography>
                  ) : (
                    validation.errors.map((message) => (
                      <Alert key={`error-${message}`} severity="error">
                        {message}
                      </Alert>
                    ))
                  )}
                  {validation.warnings.length > 0 && <Divider />}
                  {validation.warnings.map((message) => (
                    <Alert key={`warning-${message}`} severity="warning">
                      {message}
                    </Alert>
                  ))}
                </Box>
              )}
            </Paper>
          </Box>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Commissioning Panel
            </Typography>
            {!binding ? (
              <Alert severity="info">Create the binding before commissioning canonical tag reads and writes.</Alert>
            ) : draftMappings.length === 0 ? (
              <Alert severity="info">Create mappings before commissioning canonical tag checks.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Canonical Tag</TableCell>
                    <TableCell>Driver Tag</TableCell>
                    <TableCell>Direction</TableCell>
                    <TableCell>Commission</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {draftMappings.map((mapping) => {
                    const result = commissionResults[mapping.ui_id]
                    const driverTag = driverTagMap.get(mapping.driver_tag_id)
                    const dataType = driverTag?.data_type
                    const commissionValue = commissionInputs[mapping.ui_id] ?? initialCommissionValue(dataType)
                    return (
                      <TableRow key={`commission-${mapping.ui_id}`}>
                        <TableCell>{mapping.canonical_tag}</TableCell>
                        <TableCell>{driverTag?.label ?? mapping.driver_tag_id}</TableCell>
                        <TableCell>{mapping.direction}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                              {(mapping.direction === 'ReadFromDriver' || mapping.direction === 'Bidirectional') && (
                                <Button size="small" variant="outlined" onClick={() => void handleCommissionRead(mapping)}>
                                  Read
                                </Button>
                              )}
                              {(mapping.direction === 'WriteToDriver' || mapping.direction === 'Bidirectional') && (
                                <>
                                  {dataType === 'Bool' ? (
                                    <TextField
                                      select
                                      size="small"
                                      value={String(Boolean(commissionValue))}
                                      onChange={(event) =>
                                        setCommissionInputs((current) => ({
                                          ...current,
                                          [mapping.ui_id]: event.target.value === 'true',
                                        }))
                                      }
                                      sx={{ minWidth: 120 }}
                                    >
                                      <MenuItem value="true">true</MenuItem>
                                      <MenuItem value="false">false</MenuItem>
                                    </TextField>
                                  ) : (
                                    <TextField
                                      size="small"
                                      type={isNumericDataType(dataType) ? 'number' : 'text'}
                                      placeholder="value"
                                      value={String(commissionValue)}
                                      onChange={(event) =>
                                        setCommissionInputs((current) => ({
                                          ...current,
                                          [mapping.ui_id]: isNumericDataType(dataType)
                                            ? (event.target.value === '' ? '' : Number(event.target.value))
                                            : event.target.value,
                                        }))
                                      }
                                      sx={{ minWidth: 140 }}
                                    />
                                  )}
                                  <Button size="small" variant="contained" onClick={() => void handleCommissionWrite(mapping)}>
                                    Write
                                  </Button>
                                </>
                              )}
                            </Box>
                            {result && <Alert severity={result.severity}>{result.message}</Alert>}
                          </Box>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </Paper>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {!binding ? (
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={!runtimeNode.assigned_pea_id || canonicalTags.length === 0 || driverTags.length === 0 || hasTransformErrors || hasIncompleteMappings}
              >
                Create Binding
              </Button>
            ) : (
              <>
                <Button variant="contained" onClick={handleSave} disabled={hasTransformErrors || hasIncompleteMappings || !isDirty}>
                  Save Binding
                </Button>
                <Button variant="outlined" onClick={() => onValidate(binding.id)}>
                  Revalidate Binding
                </Button>
              </>
            )}
          </Box>
        </Box>
      )}
    </Paper>
  )
}
