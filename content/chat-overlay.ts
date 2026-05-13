import { marked } from 'marked'
import { MODELS, DEFAULT_MODEL_ID, type ModelId } from '@/shared/models'
import type { ModelInfoMessage, VoiceAsrProvider, VoiceTtsProvider } from '@/shared/messages'

marked.setOptions({ breaks: true })

export interface ChatSettings {
  thinking: boolean
  maxIterations: number
  experimentalMtp: boolean
  showScreenMascot: boolean
  voice: {
    asrProvider: VoiceAsrProvider
    speakResponses: boolean
    ttsProvider: VoiceTtsProvider
  }
}

const DEFAULT_SETTINGS: ChatSettings = {
  thinking: false,
  maxIterations: 10,
  experimentalMtp: false,
  showScreenMascot: true,
  voice: {
    asrProvider: 'off',
    speakResponses: false,
    ttsProvider: 'off',
  },
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`
}

const STYLES = `
  :host {
    all: initial;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .chat-container {
    position: fixed;
    bottom: 80px;
    right: 20px;
    width: 380px;
    height: 500px;
    background: #08090d;
    border: 1px solid rgba(20, 184, 166, 0.28);
    border-radius: 8px;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    color: #e2e8f0;
    font-size: 14px;
  }

  /* Header */
  .chat-header {
    padding: 10px 14px;
    background: rgba(244, 3, 49, 0.12);
    border-bottom: 1px solid rgba(20, 184, 166, 0.22);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .chat-header-title { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 14px; color: #f8fafc; user-select: none; }
  .chat-header-mascot {
    width: 30px; height: 30px; border-radius: 50%; object-fit: cover;
    border: 1px solid rgba(20, 184, 166, 0.45);
    box-shadow: 0 0 0 2px rgba(244, 3, 49, 0.18);
  }
  .chat-status { font-size: 11px; color: #94a3b8; user-select: none; }
  .chat-header-right { display: flex; align-items: center; gap: 6px; }
  .chat-header-btn {
    background: none; border: none; color: #94a3b8; cursor: pointer;
    font-size: 15px; padding: 2px 4px; line-height: 1; transition: color 0.2s;
  }
  .chat-header-btn:hover { color: #e2e8f0; }

  /* Status bar */
  .chat-statusbar {
    padding: 4px 16px;
    background: rgba(20, 184, 166, 0.06);
    border-bottom: 1px solid rgba(20, 184, 166, 0.14);
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 11px;
    color: #64748b;
    user-select: none;
  }
  .statusbar-tags { display: flex; gap: 8px; flex-wrap: wrap; }
  .statusbar-tag {
    display: flex; align-items: center; gap: 3px;
  }
  .statusbar-tag.active { color: #5eead4; }
  .statusbar-tag.warning { color: #fb7185; }
  .statusbar-tag.inactive { color: #475569; }
  .statusbar-clear {
    background: none; border: none; color: #64748b; cursor: pointer;
    font-size: 11px; padding: 0; transition: color 0.2s;
  }
  .statusbar-clear:hover { color: #f87171; }

  /* Settings panel */
  .settings-panel {
    padding: 12px 16px;
    background: rgba(8, 9, 13, 0.97);
    border-bottom: 1px solid rgba(20, 184, 166, 0.18);
    display: none;
    flex-direction: column;
    gap: 10px;
  }
  .settings-panel.open { display: flex; }
  .setting-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px;
  }
  .setting-label { font-size: 12px; color: #94a3b8; }
  .setting-stack { display: flex; flex-direction: column; gap: 2px; }
  .setting-hint { font-size: 10px; color: #64748b; line-height: 1.25; max-width: 210px; }
  .setting-toggle {
    position: relative; width: 36px; height: 20px; cursor: pointer;
  }
  .setting-toggle input { opacity: 0; width: 0; height: 0; }
  .setting-toggle .slider {
    position: absolute; inset: 0; background: #334155; border-radius: 10px; transition: background 0.2s;
  }
  .setting-toggle .slider::before {
    content: ''; position: absolute; width: 14px; height: 14px; left: 3px; bottom: 3px;
    background: #94a3b8; border-radius: 50%; transition: transform 0.2s, background 0.2s;
  }
  .setting-toggle input:checked + .slider { background: rgba(244, 3, 49, 0.58); }
  .setting-toggle input:checked + .slider::before { transform: translateX(16px); background: #f8fafc; }
  .setting-toggle input:disabled + .slider { opacity: 0.45; cursor: not-allowed; }
  .setting-number {
    width: 50px; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(20, 184, 166, 0.24);
    border-radius: 4px; padding: 3px 6px; color: #e2e8f0; font-size: 12px; text-align: center; outline: none;
  }
  .setting-number:focus { border-color: rgba(20, 184, 166, 0.55); }
  .setting-select {
    background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(20, 184, 166, 0.24);
    border-radius: 4px; padding: 3px 6px; color: #e2e8f0; font-size: 12px; outline: none; cursor: pointer;
  }
  .setting-select:focus { border-color: rgba(20, 184, 166, 0.55); }
  .setting-select:disabled { opacity: 0.4; cursor: not-allowed; }
  .setting-action {
    background: rgba(20, 184, 166, 0.12); border: 1px solid rgba(20, 184, 166, 0.28);
    border-radius: 6px; padding: 5px 9px; color: #5eead4; cursor: pointer;
    font-size: 12px; transition: background 0.2s;
  }
  .setting-action:hover { background: rgba(20, 184, 166, 0.2); }
  .setting-disable {
    background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px; padding: 6px 12px; color: #f87171; cursor: pointer;
    font-size: 12px; width: 100%; transition: background 0.2s;
  }
  .setting-disable:hover { background: rgba(239, 68, 68, 0.25); }

  /* Model download card */
  .model-card {
    margin: 10px 12px 0;
    padding: 10px 12px;
    border-radius: 8px;
    border: 1px solid rgba(20, 184, 166, 0.28);
    background: rgba(15, 23, 42, 0.78);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .model-card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    font-weight: 650;
    color: #f8fafc;
  }
  .model-card-state { font-size: 11px; color: #5eead4; white-space: nowrap; }
  .model-card-copy { font-size: 11px; line-height: 1.35; color: #94a3b8; }
  .model-card-progress {
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(100, 116, 139, 0.24);
  }
  .model-card-progress > span {
    display: block;
    width: 0%;
    height: 100%;
    background: linear-gradient(90deg, #14b8a6, #f40331);
    transition: width 0.2s ease;
  }
  .model-card-action {
    align-self: flex-start;
    background: rgba(244, 3, 49, 0.55);
    border: 1px solid rgba(244, 3, 49, 0.28);
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-size: 12px;
    padding: 6px 10px;
  }
  .model-card-action:hover { background: rgba(244, 3, 49, 0.75); }
  .model-card-action:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Messages */
  .chat-messages {
    flex: 1; overflow-y: auto; padding: 12px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .message {
    padding: 8px 12px; border-radius: 8px; max-width: 85%;
    word-wrap: break-word; line-height: 1.4;
  }
  .message-user {
    white-space: pre-wrap; align-self: flex-end;
    background: rgba(244, 3, 49, 0.25); border: 1px solid rgba(244, 3, 49, 0.26);
  }
  .message-agent {
    white-space: normal; align-self: flex-start;
    background: rgba(30, 30, 50, 0.8); border: 1px solid rgba(255, 255, 255, 0.05);
  }
  .message-agent p { margin: 0 0 8px 0; }
  .message-agent p:last-child { margin-bottom: 0; }
  .message-agent code {
    background: rgba(139, 92, 246, 0.15); padding: 1px 5px; border-radius: 3px;
    font-size: 13px; font-family: 'SF Mono', Menlo, Consolas, monospace;
  }
  .message-agent pre {
    background: rgba(0, 0, 0, 0.3); padding: 8px 10px; border-radius: 6px;
    overflow-x: auto; margin: 6px 0;
  }
  .message-agent pre code { background: none; padding: 0; }
  .message-agent ul, .message-agent ol { margin: 4px 0; padding-left: 20px; }
  .message-agent li { margin: 2px 0; }
  .message-agent strong { color: #5eead4; }
  .message-agent a { color: #2dd4bf; }
  .message-agent h1, .message-agent h2, .message-agent h3 {
    font-size: 14px; font-weight: 600; color: #5eead4; margin: 8px 0 4px 0;
  }
  .message-stopped {
    align-self: flex-start; background: rgba(244, 63, 94, 0.1);
    border: 1px solid rgba(244, 63, 94, 0.2); font-size: 12px; color: #fb7185;
  }
  .message-tool {
    align-self: flex-start; background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2); font-size: 12px; color: #6ee7b7; font-family: monospace;
    opacity: 0.4; transition: opacity 0.2s ease;
  }
  .message-tool:hover { opacity: 1; }
  .message-thinking {
    align-self: flex-start; background: rgba(103, 232, 249, 0.1);
    border: 1px solid rgba(103, 232, 249, 0.15); font-size: 12px; color: #67e8f9; font-style: italic;
    cursor: pointer;
    opacity: 0.4; transition: opacity 0.2s ease;
  }
  .message-thinking:hover { opacity: 1; }
  .message-thinking.pinned { opacity: 1; }
  .thinking-header {
    font-weight: 600; margin-bottom: 4px; user-select: none;
  }
  .thinking-body {
    position: relative; overflow: hidden; transition: max-height 0.3s ease;
  }
  .thinking-body.collapsed {
    max-height: 3.6em;
    -webkit-mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
    mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
  }
  .thinking-body.expanded {
    max-height: none;
    -webkit-mask-image: none;
    mask-image: none;
  }
  .message-thinking .thinking-content { white-space: normal; }
  .message-thinking .thinking-content p { margin: 0 0 8px 0; }
  .message-thinking .thinking-content p:last-child { margin-bottom: 0; }
  .message-thinking .thinking-content code {
    background: rgba(103, 232, 249, 0.15); padding: 1px 5px; border-radius: 3px;
    font-size: 13px; font-family: 'SF Mono', Menlo, Consolas, monospace;
  }
  .message-thinking .thinking-content pre {
    background: rgba(0, 0, 0, 0.3); padding: 8px 10px; border-radius: 6px;
    overflow-x: auto; margin: 6px 0;
  }
  .message-thinking .thinking-content pre code { background: none; padding: 0; }
  .message-thinking .thinking-content ul, .message-thinking .thinking-content ol { margin: 4px 0; padding-left: 20px; }
  .message-thinking .thinking-content li { margin: 2px 0; }
  .message-thinking .thinking-content strong { color: #67e8f9; }
  .message-thinking .thinking-content a { color: #67e8f9; }

  /* Typing indicator */
  .typing-indicator {
    align-self: flex-start; padding: 10px 16px;
    background: rgba(30, 30, 50, 0.8); border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 8px; display: flex; gap: 4px; align-items: center;
  }
  .typing-dot {
    width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;
    animation: typing-bounce 1.4s infinite ease-in-out both;
  }
  .typing-dot:nth-child(1) { animation-delay: 0s; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes typing-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* Input */
  .chat-input-area {
    padding: 12px; border-top: 1px solid rgba(20, 184, 166, 0.18);
    display: flex; gap: 8px;
  }
  .chat-input {
    flex: 1; background: rgba(15, 23, 42, 0.75); border: 1px solid rgba(20, 184, 166, 0.24);
    border-radius: 8px; padding: 8px 12px; color: #e2e8f0; font-size: 14px;
    outline: none; font-family: inherit; resize: none;
  }
  .chat-input:focus { border-color: rgba(20, 184, 166, 0.55); }
  .chat-input::placeholder { color: #64748b; }
  .chat-send, .chat-stop, .chat-mic {
    background: rgba(244, 3, 49, 0.55); border: none; border-radius: 8px;
    width: 36px; height: 36px; color: white; cursor: pointer; transition: background 0.2s;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .chat-send:hover, .chat-stop:hover, .chat-mic:hover { background: rgba(244, 3, 49, 0.75); }
  .chat-send:disabled, .chat-mic:disabled { opacity: 0.4; cursor: not-allowed; }
  .chat-stop { background: rgba(239, 68, 68, 0.5); }
  .chat-stop:hover { background: rgba(239, 68, 68, 0.7); }
  .chat-mic { background: rgba(20, 184, 166, 0.36); }
  .chat-mic.recording { background: rgba(244, 3, 49, 0.8); }
  .chat-send svg, .chat-stop svg, .chat-mic svg { width: 18px; height: 18px; }
`

export interface ChatOverlayCallbacks {
  onSend: (text: string) => void
  onStop: () => void
  onSettingsChange: (settings: ChatSettings) => void
  onClearContext: () => void
  onDisableSite: () => void
  onModelSwitch: (modelId: ModelId) => void
  onModelLoad: (modelId: ModelId) => void
  onScreenMascotChange: (visible: boolean) => void
  onVoiceTranscribe: (payload: { audioSamples: number[], sampleRate: number }) => void
  onVoiceStop: () => void
  onVoiceClearCache: () => void
}

export class ChatOverlay {
  private host: HTMLElement
  private shadow: ShadowRoot
  private container: HTMLElement
  private messagesEl: HTMLElement
  private inputEl: HTMLTextAreaElement
  private micBtn: HTMLButtonElement
  private sendBtn: HTMLButtonElement
  private stopBtn: HTMLButtonElement
  private statusEl: HTMLElement
  private settingsPanel: HTMLElement
  private thinkingTag: HTMLElement
  private iterationsTag: HTMLElement
  private modelTag: HTMLElement
  private mtpTag: HTMLElement
  private voiceTag: HTMLElement
  private modelCard: HTMLElement | null = null
  private modelCardState: HTMLElement | null = null
  private modelCardCopy: HTMLElement | null = null
  private modelCardProgress: HTMLElement | null = null
  private modelCardAction: HTMLButtonElement | null = null
  private modelSelect: HTMLSelectElement
  private mediaRecorder: MediaRecorder | null = null
  private mediaStream: MediaStream | null = null
  private speechRecognition: SpeechRecognition | null = null
  private currentAudio: HTMLAudioElement | null = null
  private recordedChunks: Blob[] = []
  private recordingTimeoutId: number | null = null
  private typingEl: HTMLElement | null = null
  private streamEl: HTMLElement | null = null
  private streamText = ''
  private thinkingStreamEl: HTMLElement | null = null
  private thinkingStreamText = ''
  private visible = false
  private selectedModelId: ModelId = DEFAULT_MODEL_ID
  settings: ChatSettings = {
    ...DEFAULT_SETTINGS,
    voice: { ...DEFAULT_SETTINGS.voice },
  }

  constructor(callbacks: ChatOverlayCallbacks) {
    this.host = document.createElement('div')
    this.host.id = 'alkahest-browser-companion-chat'
    this.shadow = this.host.attachShadow({ mode: 'closed' })

    const style = document.createElement('style')
    style.textContent = STYLES
    this.shadow.appendChild(style)

    this.container = document.createElement('div')
    this.container.className = 'chat-container'
    this.container.style.display = 'none'

    // Header
    const header = document.createElement('div')
    header.className = 'chat-header'
    const title = document.createElement('span')
    title.className = 'chat-header-title'
    const mascotUrl = browser.runtime.getURL('mascot/alkahest-f-chibi.png' as any)
    title.innerHTML = `<img class="chat-header-mascot" src="${mascotUrl}" alt="">Alkahest Browser Companion`
    this.statusEl = document.createElement('span')
    this.statusEl.className = 'chat-status'
    this.statusEl.textContent = 'Initializing...'

    const gearBtn = document.createElement('button')
    gearBtn.className = 'chat-header-btn'
    gearBtn.textContent = '\u2699' // gear
    gearBtn.title = 'Settings'
    gearBtn.addEventListener('click', () => {
      this.settingsPanel.classList.toggle('open')
    })

    const minimizeBtn = document.createElement('button')
    minimizeBtn.className = 'chat-header-btn'
    minimizeBtn.textContent = '\u2013'
    minimizeBtn.title = 'Minimize'
    minimizeBtn.addEventListener('click', () => this.toggle())

    const headerRight = document.createElement('div')
    headerRight.className = 'chat-header-right'
    headerRight.appendChild(this.statusEl)
    headerRight.appendChild(gearBtn)
    headerRight.appendChild(minimizeBtn)
    header.appendChild(title)
    header.appendChild(headerRight)

    // Settings panel
    this.settingsPanel = document.createElement('div')
    this.settingsPanel.className = 'settings-panel'

    const modelOptions = Object.values(MODELS).map(m =>
      `<option value="${m.id}">${m.label}</option>`
    ).join('')

    this.settingsPanel.innerHTML = `
      <div class="setting-row">
        <span class="setting-label">Model</span>
        <select class="setting-select" data-setting="modelId">${modelOptions}</select>
      </div>
      <div class="setting-row">
        <span class="setting-label">Thinking</span>
        <label class="setting-toggle">
          <input type="checkbox" data-setting="thinking" ${this.settings.thinking ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <span class="setting-label">Max tool iterations</span>
        <input type="number" class="setting-number" data-setting="maxIterations" value="${this.settings.maxIterations}" min="1" max="50">
      </div>
      <div class="setting-row">
        <span class="setting-stack">
          <span class="setting-label">MTP acceleration</span>
          <span class="setting-hint">Experimental. Falls back to baseline unless browser assistant-model support is present.</span>
        </span>
        <label class="setting-toggle" title="Experimental Gemma 4 MTP">
          <input type="checkbox" data-setting="experimentalMtp" ${this.settings.experimentalMtp ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <span class="setting-stack">
          <span class="setting-label">Screen mascot</span>
          <span class="setting-hint">Shows the character in the page corner.</span>
        </span>
        <label class="setting-toggle">
          <input type="checkbox" data-setting="showScreenMascot" ${this.settings.showScreenMascot ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <span class="setting-stack">
          <span class="setting-label">Speech input</span>
          <span class="setting-hint">Web Speech avoids a Whisper download; Chrome may route recognition through browser services.</span>
        </span>
        <select class="setting-select" data-setting="voiceAsrProvider">
          <option value="off">Off</option>
          <option value="webspeech">Web Speech API</option>
          <option value="whisper">Local Whisper</option>
        </select>
      </div>
      <div class="setting-row">
        <span class="setting-label">Speak responses</span>
        <label class="setting-toggle">
          <input type="checkbox" data-setting="voiceSpeakResponses" ${this.settings.voice.speakResponses ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="setting-row">
        <span class="setting-stack">
          <span class="setting-label">TTS provider</span>
          <span class="setting-hint">Pocket uses a local server at 127.0.0.1:8000.</span>
        </span>
        <select class="setting-select" data-setting="voiceTtsProvider">
          <option value="off">Off</option>
          <option value="chrome">Chrome / OS TTS</option>
          <option value="pocket">Pocket TTS local</option>
        </select>
      </div>
      <div class="setting-row">
        <span class="setting-label">Voice runtime</span>
        <button class="setting-action" data-action="voiceClearCache" type="button">Unload voice model</button>
      </div>
    `
    this.modelSelect = this.settingsPanel.querySelector('[data-setting="modelId"]') as HTMLSelectElement
    const asrSelect = this.settingsPanel.querySelector('[data-setting="voiceAsrProvider"]') as HTMLSelectElement
    asrSelect.value = this.settings.voice.asrProvider
    const ttsSelect = this.settingsPanel.querySelector('[data-setting="voiceTtsProvider"]') as HTMLSelectElement
    ttsSelect.value = this.settings.voice.ttsProvider
    const clearVoiceBtn = this.settingsPanel.querySelector('[data-action="voiceClearCache"]') as HTMLButtonElement
    clearVoiceBtn.addEventListener('click', () => callbacks.onVoiceClearCache())
    const disableBtn = document.createElement('button')
    disableBtn.className = 'setting-disable'
    disableBtn.textContent = 'Disable on this site'
    disableBtn.addEventListener('click', () => callbacks.onDisableSite())
    this.settingsPanel.appendChild(disableBtn)

    this.settingsPanel.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement
      const key = target.dataset.setting
      if (key === 'modelId') {
        const newModelId = target.value as ModelId
        callbacks.onModelSwitch(newModelId)
        return
      }
      if (key === 'thinking') {
        this.settings.thinking = target.checked
      } else if (key === 'maxIterations') {
        this.settings.maxIterations = parseInt(target.value, 10) || 10
      } else if (key === 'experimentalMtp') {
        this.settings.experimentalMtp = target.checked
        if (target.checked) {
          this.addMessage('MTP requested. This browser runtime will keep baseline decoding unless Gemma assistant-model support is available.', 'agent')
        }
      } else if (key === 'showScreenMascot') {
        this.settings.showScreenMascot = target.checked
        callbacks.onScreenMascotChange(target.checked)
      } else if (key === 'voiceAsrProvider') {
        this.settings.voice.asrProvider = target.value as VoiceAsrProvider
      } else if (key === 'voiceAsrEnabled') {
        this.settings.voice.asrProvider = target.checked ? 'whisper' : 'off'
      } else if (key === 'voiceSpeakResponses') {
        this.settings.voice.speakResponses = target.checked
      } else if (key === 'voiceTtsProvider') {
        this.settings.voice.ttsProvider = target.value as VoiceTtsProvider
      }
      this.updateStatusBar()
      callbacks.onSettingsChange(this.settings)
    })

    // Status bar
    const statusBar = document.createElement('div')
    statusBar.className = 'chat-statusbar'
    const tags = document.createElement('div')
    tags.className = 'statusbar-tags'
    this.modelTag = document.createElement('span')
    this.modelTag.className = 'statusbar-tag active'
    this.modelTag.textContent = MODELS[DEFAULT_MODEL_ID].label
    this.thinkingTag = document.createElement('span')
    this.thinkingTag.className = 'statusbar-tag active'
    this.thinkingTag.textContent = '\u{1F9E0} Thinking'
    this.iterationsTag = document.createElement('span')
    this.iterationsTag.className = 'statusbar-tag active'
    this.iterationsTag.textContent = `\u{1F504} ${this.settings.maxIterations} iters`
    this.mtpTag = document.createElement('span')
    this.mtpTag.className = 'statusbar-tag warning'
    this.mtpTag.textContent = 'MTP off'
    this.voiceTag = document.createElement('span')
    this.voiceTag.className = 'statusbar-tag inactive'
    this.voiceTag.textContent = 'Voice off'
    tags.appendChild(this.modelTag)
    tags.appendChild(this.thinkingTag)
    tags.appendChild(this.iterationsTag)
    tags.appendChild(this.mtpTag)
    tags.appendChild(this.voiceTag)
    const clearBtn = document.createElement('button')
    clearBtn.className = 'statusbar-clear'
    clearBtn.textContent = 'Clear context'
    clearBtn.addEventListener('click', () => {
      this.messagesEl.innerHTML = ''
      callbacks.onClearContext()
      this.addMessage('Context cleared.', 'agent')
    })
    statusBar.appendChild(tags)
    statusBar.appendChild(clearBtn)

    // Messages
    this.messagesEl = document.createElement('div')
    this.messagesEl.className = 'chat-messages'

    // Input area
    const inputArea = document.createElement('div')
    inputArea.className = 'chat-input-area'
    this.inputEl = document.createElement('textarea')
    this.inputEl.className = 'chat-input'
    this.inputEl.placeholder = 'Ask about this page...'
    this.inputEl.rows = 1
    this.micBtn = document.createElement('button')
    this.micBtn.className = 'chat-mic'
    this.micBtn.title = 'Record speech input'
    this.micBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/><path d="M8 22h8"/></svg>'
    this.sendBtn = document.createElement('button')
    this.sendBtn.className = 'chat-send'
    this.sendBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'

    this.stopBtn = document.createElement('button')
    this.stopBtn.className = 'chat-stop'
    this.stopBtn.style.display = 'none'
    this.stopBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>'

    inputArea.appendChild(this.inputEl)
    inputArea.appendChild(this.micBtn)
    inputArea.appendChild(this.sendBtn)
    inputArea.appendChild(this.stopBtn)

    this.container.appendChild(header)
    this.container.appendChild(this.settingsPanel)
    this.container.appendChild(statusBar)
    this.createModelCard(callbacks.onModelLoad)
    this.container.appendChild(this.messagesEl)
    this.container.appendChild(inputArea)
    this.shadow.appendChild(this.container)

    this.sendBtn.addEventListener('click', () => this.handleSend(callbacks.onSend))
    this.stopBtn.addEventListener('click', () => callbacks.onStop())
    this.micBtn.addEventListener('click', () => this.handleVoiceRecord(callbacks.onVoiceTranscribe))

    for (const event of ['keydown', 'keyup', 'keypress'] as const) {
      this.inputEl.addEventListener(event, (e) => e.stopPropagation())
    }

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.handleSend(callbacks.onSend)
      }
    })

    this.updateStatusBar()
  }

  private createModelCard(onModelLoad: (modelId: ModelId) => void): void {
    this.modelCard = document.createElement('div')
    this.modelCard.className = 'model-card'

    const title = document.createElement('div')
    title.className = 'model-card-title'
    const titleText = document.createElement('span')
    titleText.textContent = MODELS[this.selectedModelId].label
    this.modelCardState = document.createElement('span')
    this.modelCardState.className = 'model-card-state'
    this.modelCardState.textContent = 'Checking cache...'
    title.appendChild(titleText)
    title.appendChild(this.modelCardState)

    this.modelCardCopy = document.createElement('div')
    this.modelCardCopy.className = 'model-card-copy'
    this.modelCardCopy.textContent = 'Checking browser cache and exact Hugging Face file sizes.'

    const progress = document.createElement('div')
    progress.className = 'model-card-progress'
    this.modelCardProgress = document.createElement('span')
    progress.appendChild(this.modelCardProgress)

    this.modelCardAction = document.createElement('button')
    this.modelCardAction.className = 'model-card-action'
    this.modelCardAction.type = 'button'
    this.modelCardAction.textContent = 'Checking...'
    this.modelCardAction.disabled = true
    this.modelCardAction.addEventListener('click', () => onModelLoad(this.selectedModelId))

    this.modelCard.appendChild(title)
    this.modelCard.appendChild(this.modelCardCopy)
    this.modelCard.appendChild(progress)
    this.modelCard.appendChild(this.modelCardAction)
    this.container.appendChild(this.modelCard)
  }

  showModelInfo(info: ModelInfoMessage): void {
    this.selectedModelId = info.modelId
    this.setSelectedModel(info.modelId)
    if (!this.modelCard || !this.modelCardState || !this.modelCardCopy || !this.modelCardProgress || !this.modelCardAction) return

    const modelTitle = this.modelCard.querySelector('.model-card-title span:first-child')
    if (modelTitle) modelTitle.textContent = info.label

    const total = formatBytes(info.totalBytes)
    const cached = formatBytes(info.cachedBytes)
    const missing = formatBytes(info.missingBytes)
    const fileCount = `${info.cachedFiles}/${info.totalFiles} files`
    this.modelCardProgress.style.width = info.totalBytes > 0
      ? `${Math.round((info.cachedBytes / info.totalBytes) * 100)}%`
      : '0%'

    if (info.allCached) {
      this.modelCardState.textContent = 'Cached'
      this.modelCardCopy.textContent = `${cached} cached locally (${fileCount}). No model download is needed; loading still allocates WebGPU memory.`
      this.modelCardAction.textContent = 'Load cached model'
    } else {
      this.modelCardState.textContent = 'Download required'
      this.modelCardCopy.textContent = `${missing} still needs download. Total selected runtime files: ${total}; currently cached: ${cached} (${fileCount}).`
      this.modelCardAction.textContent = 'Download and load'
    }
    this.modelCardAction.disabled = false
  }

  showModelReady(modelId: ModelId): void {
    this.selectedModelId = modelId
    this.setSelectedModel(modelId)
    if (!this.modelCardState || !this.modelCardCopy || !this.modelCardProgress || !this.modelCardAction) return
    this.modelCardState.textContent = 'Ready'
    this.modelCardCopy.textContent = `${MODELS[modelId].label} is loaded. Future reloads should use the browser cache unless it is cleared.`
    this.modelCardProgress.style.width = '100%'
    this.modelCardAction.textContent = 'Loaded'
    this.modelCardAction.disabled = true
  }

  showModelError(message: string): void {
    if (!this.modelCardState || !this.modelCardCopy || !this.modelCardAction) return
    this.modelCardState.textContent = 'Error'
    this.modelCardCopy.textContent = message
    this.modelCardAction.textContent = 'Retry load'
    this.modelCardAction.disabled = false
  }

  updateModelDownloadProgress(progress: number, loadedBytes?: number, totalBytes?: number): void {
    if (!this.modelCardState || !this.modelCardCopy || !this.modelCardProgress || !this.modelCardAction) return
    const pct = Math.max(0, Math.min(100, Math.round(progress)))
    this.modelCardState.textContent = `${pct}%`
    this.modelCardProgress.style.width = `${pct}%`
    this.modelCardAction.textContent = 'Loading...'
    this.modelCardAction.disabled = true
    if (loadedBytes != null && totalBytes != null && totalBytes > 0) {
      this.modelCardCopy.textContent = `Downloaded ${formatBytes(loadedBytes)} of ${formatBytes(totalBytes)}.`
    } else {
      this.modelCardCopy.textContent = 'Loading model files into the browser cache.'
    }
  }

  private updateStatusBar(): void {
    this.thinkingTag.className = `statusbar-tag ${this.settings.thinking ? 'active' : 'inactive'}`
    this.thinkingTag.textContent = `\u{1F9E0} Thinking ${this.settings.thinking ? 'ON' : 'OFF'}`
    this.iterationsTag.textContent = `\u{1F504} ${this.settings.maxIterations} iters`
    this.mtpTag.className = `statusbar-tag ${this.settings.experimentalMtp ? 'active' : 'warning'}`
    this.mtpTag.textContent = this.settings.experimentalMtp ? 'MTP requested' : 'MTP off'
    const voiceOn = this.settings.voice.asrProvider !== 'off' || this.settings.voice.speakResponses
    this.voiceTag.className = `statusbar-tag ${voiceOn ? 'active' : 'inactive'}`
    this.voiceTag.textContent = voiceOn ? `Voice ${this.settings.voice.asrProvider}` : 'Voice off'
    this.micBtn.disabled = this.settings.voice.asrProvider === 'off'
  }

  private async handleVoiceRecord(
    onVoiceTranscribe: (payload: { audioSamples: number[], sampleRate: number }) => void,
  ): Promise<void> {
    if (this.settings.voice.asrProvider === 'off') {
      this.addMessage('Speech input is disabled. Enable Web Speech or Local Whisper in settings first.', 'agent')
      return
    }

    if (this.settings.voice.asrProvider === 'webspeech') {
      this.handleWebSpeechRecognition()
      return
    }

    if (this.mediaRecorder?.state === 'recording') {
      this.stopVoiceRecording()
      return
    }

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      this.recordedChunks = []
      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : undefined
      this.mediaRecorder = new MediaRecorder(this.mediaStream, options)
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) this.recordedChunks.push(event.data)
      })
      this.mediaRecorder.addEventListener('stop', () => {
        this.finishVoiceRecording(onVoiceTranscribe).catch((error) => {
          this.setVoiceStatus(`Voice error: ${error instanceof Error ? error.message : String(error)}`)
        })
      }, { once: true })
      this.mediaRecorder.start()
      this.micBtn.classList.add('recording')
      this.micBtn.title = 'Stop Whisper recording'
      this.setVoiceStatus('Recording voice...')
      this.recordingTimeoutId = window.setTimeout(() => this.stopVoiceRecording(), 30000)
    } catch (error) {
      this.setVoiceStatus(`Mic unavailable: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private handleWebSpeechRecognition(): void {
    if (this.speechRecognition) {
      this.speechRecognition.stop()
      return
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!Recognition) {
      this.setVoiceStatus('Web Speech unavailable')
      this.addMessage('This Chrome build does not expose SpeechRecognition on this page. Use Local Whisper instead.', 'agent')
      return
    }

    const recognition = new Recognition()
    this.speechRecognition = recognition
    recognition.lang = navigator.language || 'en-US'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      this.micBtn.classList.add('recording')
      this.micBtn.title = 'Stop Web Speech input'
      this.setVoiceStatus('Listening...')
    }
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0]?.transcript ?? '')
        .join(' ')
        .trim()
      if (transcript) this.applyTranscript(transcript)
    }
    recognition.onerror = (event) => {
      this.setVoiceStatus(`Speech error: ${event.error}`)
    }
    recognition.onend = () => {
      this.speechRecognition = null
      this.micBtn.classList.remove('recording')
      this.micBtn.title = 'Record speech input'
      this.setVoiceStatus('Voice ready')
    }
    recognition.start()
  }

  private stopVoiceRecording(): void {
    if (this.recordingTimeoutId != null) {
      window.clearTimeout(this.recordingTimeoutId)
      this.recordingTimeoutId = null
    }
    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop()
    }
  }

  private async finishVoiceRecording(
    onVoiceTranscribe: (payload: { audioSamples: number[], sampleRate: number }) => void,
  ): Promise<void> {
    this.micBtn.classList.remove('recording')
    this.micBtn.title = 'Record speech input'
    this.mediaStream?.getTracks().forEach(track => track.stop())
    this.mediaStream = null

    if (this.recordedChunks.length === 0) {
      this.setVoiceStatus('No voice captured')
      return
    }

    this.setVoiceStatus('Preparing audio...')
    const blob = new Blob(this.recordedChunks, { type: this.recordedChunks[0]?.type || 'audio/webm' })
    const payload = await this.blobToWhisperSamples(blob)
    this.setVoiceStatus('Transcribing locally...')
    onVoiceTranscribe(payload)
  }

  private async blobToWhisperSamples(blob: Blob): Promise<{ audioSamples: number[], sampleRate: number }> {
    const targetSampleRate = 16000
    const audioContext = new AudioContext()
    try {
      const decoded = await audioContext.decodeAudioData(await blob.arrayBuffer())
      const mono = new Float32Array(decoded.length)
      for (let channel = 0; channel < decoded.numberOfChannels; channel++) {
        const channelData = decoded.getChannelData(channel)
        for (let i = 0; i < channelData.length; i++) {
          mono[i] += channelData[i] / decoded.numberOfChannels
        }
      }

      if (decoded.sampleRate === targetSampleRate) {
        return { audioSamples: Array.from(mono), sampleRate: targetSampleRate }
      }

      const sourceBuffer = new AudioBuffer({
        length: mono.length,
        numberOfChannels: 1,
        sampleRate: decoded.sampleRate,
      })
      sourceBuffer.copyToChannel(mono, 0)
      const offlineContext = new OfflineAudioContext(
        1,
        Math.ceil(sourceBuffer.duration * targetSampleRate),
        targetSampleRate,
      )
      const source = offlineContext.createBufferSource()
      source.buffer = sourceBuffer
      source.connect(offlineContext.destination)
      source.start()
      const resampled = await offlineContext.startRendering()
      return { audioSamples: Array.from(resampled.getChannelData(0)), sampleRate: targetSampleRate }
    } finally {
      await audioContext.close()
    }
  }

  private handleSend(onSend: (text: string) => void): void {
    const text = this.inputEl.value.trim()
    if (!text) return
    this.addMessage(text, 'user')
    this.inputEl.value = ''
    onSend(text)
  }

  toggle(): void {
    this.visible = !this.visible
    this.container.style.display = this.visible ? 'flex' : 'none'
    if (this.visible) this.inputEl.focus()
  }

  hide(): void {
    this.visible = false
    this.container.style.display = 'none'
  }

  appendStream(text: string): void {
    this.hideTyping()
    this.streamText += text

    if (!this.streamText.trim()) return

    if (!this.streamEl) {
      this.streamEl = document.createElement('div')
      this.streamEl.className = 'message message-agent'
      if (this.typingEl) {
        this.messagesEl.insertBefore(this.streamEl, this.typingEl)
      } else {
        this.messagesEl.appendChild(this.streamEl)
      }
    }

    const lastNewline = this.streamText.lastIndexOf('\n')
    if (lastNewline === -1) {
      this.streamEl.textContent = this.streamText
    } else {
      const rendered = this.streamText.slice(0, lastNewline + 1)
      const pending = this.streamText.slice(lastNewline + 1)
      this.streamEl.innerHTML = marked.parse(rendered) as string
      if (pending) {
        this.streamEl.appendChild(document.createTextNode(pending))
      }
    }

    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  finalizeStream(fullText: string): void {
    this.hideTyping()
    if (!this.streamEl) {
      if (fullText) this.addMessage(fullText, 'agent')
      return
    }
    if (!fullText) {
      this.streamEl.remove()
    } else {
      this.streamEl.innerHTML = marked.parse(fullText) as string
    }
    this.streamEl = null
    this.streamText = ''
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  appendThinkingStream(text: string): void {
    this.hideTyping()

    if (!this.thinkingStreamEl) {
      const msg = document.createElement('div')
      msg.className = 'message message-thinking'
      const header = document.createElement('div')
      header.className = 'thinking-header'
      header.textContent = 'Thinking...'
      const body = document.createElement('div')
      body.className = 'thinking-body collapsed'
      const content = document.createElement('div')
      content.className = 'thinking-content'
      body.appendChild(content)
      msg.appendChild(header)
      msg.appendChild(body)
      msg.addEventListener('click', () => {
        msg.classList.toggle('pinned')
        body.classList.toggle('collapsed')
        body.classList.toggle('expanded')
      })
      this.messagesEl.appendChild(msg)
      this.thinkingStreamEl = content
    }

    this.thinkingStreamText += text
    this.thinkingStreamEl.textContent = this.thinkingStreamText
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  finalizeThinkingStream(): void {
    if (this.thinkingStreamEl) {
      this.thinkingStreamEl.innerHTML = marked.parse(this.thinkingStreamText) as string
      this.thinkingStreamEl = null
      this.thinkingStreamText = ''
    }
  }

  addMessage(text: string, type: 'user' | 'agent' | 'tool' | 'thinking' | 'stopped'): void {
    if (type === 'user' || type === 'agent') {
      this.hideTyping()
    }
    const msg = document.createElement('div')
    msg.className = `message message-${type}`

    if (type === 'agent') {
      msg.innerHTML = marked.parse(text) as string
    } else if (type === 'thinking') {
      const header = document.createElement('div')
      header.className = 'thinking-header'
      header.textContent = 'Thinking...'
      const body = document.createElement('div')
      body.className = 'thinking-body collapsed'
      const content = document.createElement('div')
      content.className = 'thinking-content'
      content.innerHTML = marked.parse(text.replace(/^\[Thinking\]\s*/, '')) as string
      body.appendChild(content)
      msg.appendChild(header)
      msg.appendChild(body)
      msg.addEventListener('click', () => {
        msg.classList.toggle('pinned')
        body.classList.toggle('collapsed')
        body.classList.toggle('expanded')
      })
    } else {
      msg.textContent = text
    }

    // Insert before typing indicator so it stays at the bottom
    if (this.typingEl) {
      this.messagesEl.insertBefore(msg, this.typingEl)
    } else {
      this.messagesEl.appendChild(msg)
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  showTyping(): void {
    if (this.typingEl) return
    this.typingEl = document.createElement('div')
    this.typingEl.className = 'typing-indicator'
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('div')
      dot.className = 'typing-dot'
      this.typingEl.appendChild(dot)
    }
    this.messagesEl.appendChild(this.typingEl)
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  hideTyping(): void {
    if (this.typingEl) {
      this.typingEl.remove()
      this.typingEl = null
    }
  }

  clearMessages(): void {
    this.messagesEl.innerHTML = ''
    this.streamEl = null
    this.streamText = ''
    this.thinkingStreamEl = null
    this.thinkingStreamText = ''
  }

  setModelSwitchEnabled(enabled: boolean): void {
    this.modelSelect.disabled = !enabled
  }

  setSelectedModel(modelId: ModelId): void {
    this.modelSelect.value = modelId
    this.modelTag.textContent = MODELS[modelId].label
  }

  updateStatus(status: string): void {
    this.statusEl.textContent = status
  }

  setVoiceStatus(status: string): void {
    this.voiceTag.textContent = status
  }

  applyTranscript(text: string): void {
    const trimmed = text.trim()
    if (!trimmed) return
    const prefix = this.inputEl.value.trim()
    this.inputEl.value = prefix ? `${prefix} ${trimmed}` : trimmed
    this.inputEl.focus()
  }

  private generating = false

  setInputEnabled(enabled: boolean): void {
    this.inputEl.disabled = !enabled
    this.sendBtn.disabled = !enabled
    this.micBtn.disabled = !enabled || this.settings.voice.asrProvider === 'off'
    if (enabled) {
      this.generating = false
      this.sendBtn.style.display = 'flex'
      this.stopBtn.style.display = 'none'
    } else if (this.generating) {
      this.sendBtn.style.display = 'none'
      this.stopBtn.style.display = 'flex'
    }
  }

  setGenerating(generating: boolean): void {
    this.generating = generating
    if (generating) {
      this.sendBtn.style.display = 'none'
      this.stopBtn.style.display = 'flex'
    }
  }

  playAudio(bytes: number[], mimeType: string): void {
    this.stopAudioPlayback()
    const blob = new Blob([new Uint8Array(bytes)], { type: mimeType || 'audio/wav' })
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    this.currentAudio = audio
    audio.addEventListener('ended', () => {
      URL.revokeObjectURL(url)
      if (this.currentAudio === audio) this.currentAudio = null
      this.setVoiceStatus('Voice ready')
    }, { once: true })
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      if (this.currentAudio === audio) this.currentAudio = null
      this.setVoiceStatus('Audio playback failed')
    }, { once: true })
    audio.play().then(() => this.setVoiceStatus('Speaking response')).catch(error => {
      URL.revokeObjectURL(url)
      if (this.currentAudio === audio) this.currentAudio = null
      this.setVoiceStatus(`Audio blocked: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  stopAudioPlayback(): void {
    if (!this.currentAudio) return
    const src = this.currentAudio.src
    this.currentAudio.pause()
    this.currentAudio.src = ''
    if (src.startsWith('blob:')) URL.revokeObjectURL(src)
    this.currentAudio = null
  }

  getElement(): HTMLElement {
    return this.host
  }
}
