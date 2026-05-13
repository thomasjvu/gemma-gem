import type { ToolCall } from '@kessler/gemma-agent'
import type { ModelId } from './models'

// Content Script -> Service Worker
export type ChatSettings = {
  thinking: boolean
  maxIterations: number
  experimentalMtp: boolean
  showScreenMascot: boolean
  voice: VoiceSettings
}

export type VoiceAsrProvider = 'off' | 'webspeech' | 'whisper'
export type VoiceTtsProvider = 'off' | 'chrome' | 'pocket'

export type VoiceSettings = {
  asrProvider: VoiceAsrProvider
  speakResponses: boolean
  ttsProvider: VoiceTtsProvider
}

export type ChatSendMessage = {
  type: 'chat:send'
  text: string
  settings?: ChatSettings
  pageContext?: string
}

export type SettingsUpdateMessage = {
  type: 'settings:update'
  settings: ChatSettings
}

export type ContextClearMessage = {
  type: 'context:clear'
}

export type ChatOpenMessage = {
  type: 'chat:open'
}

export type ModelLoadRequestMessage = {
  type: 'model:load-request'
  modelId?: ModelId
}

export type ModelInspectMessage = {
  type: 'model:inspect'
  modelId?: ModelId
}

export type ChatStopMessage = {
  type: 'chat:stop'
}

export type ToolResultMessage = {
  type: 'tool:result'
  requestId: string
  result: unknown
}

// Service Worker -> Content Script
export type AgentResponseMessage = {
  type: 'agent:response'
  text: string
}

export type AgentChunkMessage = {
  type: 'agent:chunk'
  text: string
}

export type AgentThinkingMessage = {
  type: 'agent:thinking'
  text: string
}

export type AgentToolCallMessage = {
  type: 'agent:tool_call'
  requestId: string
  call: ToolCall
}

export type ModelStatusMessage = {
  type: 'model:status'
  status: 'loading' | 'ready' | 'error'
  modelId?: ModelId
  progress?: number
  loadedBytes?: number
  totalBytes?: number
  error?: string
}

export type ModelInfoMessage = {
  type: 'model:info'
  modelId: ModelId
  label: string
  allCached: boolean
  cachedFiles: number
  totalFiles: number
  cachedBytes: number
  totalBytes: number
  missingBytes: number
  files: Array<{
    file: string
    cached: boolean
    size: number
  }>
  supportsMtp: boolean
  mtpAvailable: boolean
  mtpReason: string
}

export type ModelSwitchMessage = {
  type: 'model:switch'
  modelId: ModelId
}

export type VoiceStatus = 'idle' | 'recording' | 'loading' | 'transcribing' | 'speaking' | 'error'

export type VoiceTranscribeMessage = {
  type: 'voice:transcribe'
  tabId?: number
  audioSamples: number[]
  sampleRate: number
}

export type VoiceTranscriptMessage = {
  type: 'voice:transcript'
  tabId?: number
  text: string
}

export type VoiceStatusMessage = {
  type: 'voice:status'
  tabId?: number
  status: VoiceStatus
  text: string
}

export type VoiceSpeakMessage = {
  type: 'voice:speak'
  provider: VoiceTtsProvider
  text: string
}

export type VoiceAudioMessage = {
  type: 'voice:audio'
  mimeType: string
  bytes: number[]
}

export type VoiceAudioStopMessage = {
  type: 'voice:audio-stop'
}

export type VoiceStopMessage = {
  type: 'voice:stop'
}

export type VoiceClearCacheMessage = {
  type: 'voice:clear-cache'
  tabId?: number
}

// Service Worker -> Offscreen Document
export type AgentRunMessage = {
  type: 'agent:run'
  tabId: number
  userMessage: string
  settings?: ChatSettings
  pageContext?: string
}

export type ModelLoadMessage = {
  type: 'model:load'
  modelId?: ModelId
}

// Offscreen Document -> Service Worker
export type OffscreenToolExecuteMessage = {
  type: 'tool:execute'
  tabId: number
  requestId: string
  call: ToolCall
}

export type OffscreenAgentResponseMessage = {
  type: 'agent:response'
  tabId: number
  text: string
}

export type OffscreenAgentChunkMessage = {
  type: 'agent:chunk'
  tabId: number
  text: string
}

export type OffscreenModelStatusMessage = {
  type: 'model:status'
  status: 'loading' | 'ready' | 'error'
  modelId?: ModelId
  progress?: number
  loadedBytes?: number
  totalBytes?: number
  error?: string
}

export type GPUWarningMessage = {
  type: 'gpu:warning'
  text: string
}

export type Message =
  | ChatSendMessage
  | ChatOpenMessage
  | ModelLoadRequestMessage
  | ModelInspectMessage
  | ChatStopMessage
  | SettingsUpdateMessage
  | ContextClearMessage
  | ToolResultMessage
  | AgentResponseMessage
  | AgentChunkMessage
  | AgentThinkingMessage
  | AgentToolCallMessage
  | ModelStatusMessage
  | ModelInfoMessage
  | ModelSwitchMessage
  | VoiceTranscribeMessage
  | VoiceTranscriptMessage
  | VoiceStatusMessage
  | VoiceSpeakMessage
  | VoiceAudioMessage
  | VoiceAudioStopMessage
  | VoiceStopMessage
  | VoiceClearCacheMessage
  | AgentRunMessage
  | ModelLoadMessage
  | OffscreenToolExecuteMessage
  | OffscreenAgentResponseMessage
  | OffscreenAgentChunkMessage
  | OffscreenModelStatusMessage
  | GPUWarningMessage
