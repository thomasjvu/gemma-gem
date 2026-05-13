import { pipeline } from '@huggingface/transformers'
import { log } from '@/shared/logger'

const WHISPER_MODEL_ID = 'onnx-community/whisper-tiny.en'

type VoiceStatusCallback = (status: 'loading' | 'transcribing' | 'idle' | 'error', text: string) => void
type AsrOutput = { text: string } | Array<{ text: string }>
type AsrPipeline = {
  (audio: Float32Array, options?: Record<string, unknown>): Promise<AsrOutput>
  dispose?: () => Promise<void> | void
}

export class VoiceHost {
  private transcriber: AsrPipeline | null = null
  private loading = false
  private busy = false
  private readonly onStatus: VoiceStatusCallback

  constructor(onStatus: VoiceStatusCallback) {
    this.onStatus = onStatus
  }

  async transcribe(audioSamples: number[], sampleRate: number): Promise<string> {
    if (this.busy) {
      throw new Error('Voice transcription is already running')
    }
    this.busy = true

    try {
      if (sampleRate !== 16000) {
        log.warn('Whisper input expected 16 kHz audio, got', sampleRate)
      }

      const transcriber = await this.loadTranscriber()
      this.onStatus('transcribing', 'Transcribing locally...')
      const output = await transcriber(new Float32Array(audioSamples), {
        language: 'english',
        task: 'transcribe',
      })
      const text = Array.isArray(output)
        ? output.map(chunk => chunk.text).join(' ')
        : output.text
      this.onStatus('idle', 'Voice ready')
      return text.trim()
    } finally {
      this.busy = false
      await this.unload()
    }
  }

  async unload(): Promise<void> {
    if (this.transcriber?.dispose) {
      await this.transcriber.dispose()
    }
    this.transcriber = null
    this.loading = false
  }

  async clearRuntime(): Promise<string> {
    await this.unload()
    return 'Voice model unloaded. Browser model-cache files remain cached for faster future loads.'
  }

  private async loadTranscriber(): Promise<AsrPipeline> {
    if (this.transcriber) return this.transcriber
    if (this.loading) {
      throw new Error('Voice model is already loading')
    }

    this.loading = true
    try {
      this.onStatus('loading', 'Loading local Whisper...')
      this.transcriber = await this.createPipeline('webgpu')
      return this.transcriber
    } catch (error) {
      log.warn('Whisper WebGPU load failed, falling back to WASM:', error)
      await this.unload()
      this.onStatus('loading', 'Loading Whisper WASM fallback...')
      this.transcriber = await this.createPipeline('wasm')
      return this.transcriber
    } finally {
      this.loading = false
    }
  }

  private async createPipeline(device: 'webgpu' | 'wasm'): Promise<AsrPipeline> {
    const progress_callback = (info: { status: string, progress?: number }) => {
      if (info.status === 'progress' && info.progress != null) {
        this.onStatus('loading', `Loading local Whisper... ${Math.round(info.progress)}%`)
      }
    }

    return pipeline('automatic-speech-recognition', WHISPER_MODEL_ID, {
      device,
      dtype: device === 'webgpu' ? 'q4' : 'q8',
      progress_callback,
    } as Record<string, unknown>) as Promise<AsrPipeline>
  }
}
