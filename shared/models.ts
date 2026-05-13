export type ModelId = 'gemma-4-e2b' | 'gemma-4-e4b'

export interface ModelConfig {
  id: ModelId
  hfModelId: string
  assistantModelId?: string
  supportsMtp: boolean
  label: string
  downloadSize: string
  dtype: 'q4f16'
  contextLimit: number
}

export const MODELS: Record<ModelId, ModelConfig> = {
  'gemma-4-e2b': {
    id: 'gemma-4-e2b',
    hfModelId: 'onnx-community/gemma-4-E2B-it-ONNX',
    assistantModelId: 'google/gemma-4-E2B-it-assistant',
    supportsMtp: false,
    label: 'Gemma 4 E2B',
    downloadSize: 'measured before download',
    dtype: 'q4f16',
    contextLimit: 128_000,
  },
  'gemma-4-e4b': {
    id: 'gemma-4-e4b',
    hfModelId: 'onnx-community/gemma-4-E4B-it-ONNX',
    assistantModelId: 'google/gemma-4-E4B-it-assistant',
    supportsMtp: false,
    label: 'Gemma 4 E4B',
    downloadSize: 'measured before download',
    dtype: 'q4f16',
    contextLimit: 128_000,
  },
}

export const DEFAULT_MODEL_ID: ModelId = 'gemma-4-e2b'
export const STORAGE_KEY_MODEL = 'alkahest_companion_selected_model'
