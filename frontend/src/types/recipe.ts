// Recipe / Sequence types for Heptapod POL orchestration
import { ServiceCommand, ServiceState } from './mtp'

export interface Recipe {
  id: string
  name: string
  description: string
  steps: RecipeStep[]
  created_at: string
}

export interface RecipeStep {
  order: number
  pea_id: string
  service_tag: string
  command: ServiceCommand
  procedure_id: number | null
  parameters: RecipeParameterValue[]
  wait_for_state: ServiceState | null
  timeout_ms: number | null
}

export interface RecipeParameterValue {
  parameter_tag: string
  value: unknown
}

export interface RecipeExecutionStatus {
  recipe_id: string
  recipe_name: string
  current_step: number
  total_steps: number
  step_statuses: StepStatus[]
  state: 'pending' | 'running' | 'completed' | 'failed' | 'aborted'
}

export type StepStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'skipped'
