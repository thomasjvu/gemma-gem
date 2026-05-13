import { createGemIcon, updateGemProgress, setGemDisabled } from '@/content/gem-icon'
import { ChatOverlay } from '@/content/chat-overlay'
import type { ChatSettings } from '@/content/chat-overlay'
import { executeContentTool } from '@/content/tool-executors'
import type { Message } from '@/shared/messages'
import type { ToolCall } from '@kessler/gemma-agent'
import { MODELS, STORAGE_KEY_MODEL, DEFAULT_MODEL_ID, type ModelId } from '@/shared/models'

const STORAGE_KEY = 'alkahest_companion_disabled_sites'
const PAGE_SNAPSHOT_MAX_LENGTH = 8000

function capturePageSnapshot(): string {
  const title = document.title
  const url = location.href
  const body = document.body?.innerText ?? ''
  const truncated = body.length > PAGE_SNAPSHOT_MAX_LENGTH
    ? body.slice(0, PAGE_SNAPSHOT_MAX_LENGTH) + '\n...(truncated)'
    : body

  return `url: ${url}\ntitle: ${title}\n\n${truncated}`
}

function getSiteKey(): string {
  return location.hostname
}

function createScreenMascot(): HTMLElement {
  const container = document.createElement('div')
  container.id = 'alkahest-browser-companion-screen-mascot'
  container.title = 'Alkahest Browser Companion'
  Object.assign(container.style, {
    position: 'fixed',
    top: '12px',
    left: '12px',
    width: '86px',
    height: '86px',
    zIndex: '2147483645',
    pointerEvents: 'none',
    filter: 'drop-shadow(0 8px 16px rgba(0, 0, 0, 0.38))',
  })

  const img = document.createElement('img')
  img.src = browser.runtime.getURL('mascot/alkahest-f-chibi.png' as any)
  img.alt = ''
  Object.assign(img.style, {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    objectPosition: 'top left',
  })
  container.appendChild(img)
  return container
}

async function isDisabledForSite(): Promise<boolean> {
  const data = await browser.storage.local.get(STORAGE_KEY)
  const storedSites = data[STORAGE_KEY]
  const sites = Array.isArray(storedSites) ? storedSites as string[] : []
  return sites.includes(getSiteKey())
}

async function setDisabledForSite(disabled: boolean): Promise<void> {
  const data = await browser.storage.local.get(STORAGE_KEY)
  const storedSites = data[STORAGE_KEY]
  const sites = Array.isArray(storedSites) ? storedSites as string[] : []
  const site = getSiteKey()

  if (disabled && !sites.includes(site)) {
    sites.push(site)
  } else if (!disabled) {
    const idx = sites.indexOf(site)
    if (idx !== -1) sites.splice(idx, 1)
  }

  await browser.storage.local.set({ [STORAGE_KEY]: sites })
}

export default defineContentScript({
  matches: ['<all_urls>'],
  async main() {
    let siteDisabled = await isDisabledForSite()

    const modelData = await browser.storage.local.get(STORAGE_KEY_MODEL)
    const storedModelId = modelData[STORAGE_KEY_MODEL]
    const initialModelId: ModelId = typeof storedModelId === 'string' && storedModelId in MODELS
      ? storedModelId as ModelId
      : DEFAULT_MODEL_ID

    function safeSend(message: Message): void {
      try {
        browser.runtime.sendMessage(message).catch(() => {
          chat.updateStatus('Extension reloaded — refresh the page')
        })
      } catch {
        chat.updateStatus('Extension reloaded — refresh the page')
      }
    }

    const chat = new ChatOverlay({
      onSend(text) {
        if (!modelReady) {
          chat.addMessage('Load the selected local model first. The download card shows the exact size and cache state before anything is fetched.', 'agent')
          return
        }
        stopped = false
        chat.setGenerating(true)
        chat.setInputEnabled(false)
        chat.setModelSwitchEnabled(false)
        chat.showTyping()
        const pageContext = capturePageSnapshot()
        safeSend({ type: 'chat:send', text, settings: chat.settings, pageContext } as any)
      },
      onStop() {
        stopped = true
        safeSend({ type: 'chat:stop' } as any)
        safeSend({ type: 'voice:stop' } as any)
        chat.finalizeThinkingStream()
        chat.finalizeStream('')
        chat.addMessage('Stopped', 'stopped')
        chat.setInputEnabled(true)
        chat.setModelSwitchEnabled(true)
      },
      onSettingsChange(settings: ChatSettings) {
        safeSend({ type: 'settings:update', settings } as any)
      },
      onClearContext() {
        safeSend({ type: 'context:clear' } as any)
      },
      onDisableSite() {
        siteDisabled = true
        setDisabledForSite(true)
        chat.hide()
        screenMascot.style.display = 'none'
        setGemDisabled(true)
      },
      onModelSwitch(modelId: ModelId) {
        chat.setInputEnabled(false)
        chat.setModelSwitchEnabled(false)
        chat.updateStatus('Checking cache...')
        chat.addMessage(`Selected ${MODELS[modelId].label}. Checking browser cache before load.`, 'agent')
        modelReady = false
        shownLoadingMessage = false
        safeSend({ type: 'model:switch', modelId })
      },
      onModelLoad(modelId: ModelId) {
        chat.setInputEnabled(false)
        chat.setModelSwitchEnabled(false)
        chat.updateStatus('Loading model...')
        modelReady = false
        shownLoadingMessage = false
        safeSend({ type: 'model:load-request', modelId })
      },
      onScreenMascotChange(visible) {
        screenMascot.style.display = visible ? 'block' : 'none'
      },
      onVoiceTranscribe(payload) {
        safeSend({ type: 'voice:transcribe', ...payload } as any)
      },
      onVoiceStop() {
        safeSend({ type: 'voice:stop' } as any)
      },
      onVoiceClearCache() {
        safeSend({ type: 'voice:clear-cache' } as any)
      },
    })

    chat.setSelectedModel(initialModelId)
    chat.setInputEnabled(false)

    let modelReady = false
    let shownLoadingMessage = false
    let stopped = false

    const icon = createGemIcon(() => {
      if (siteDisabled) {
        if (confirm('Re-enable Alkahest Browser Companion on this site?')) {
          siteDisabled = false
          setDisabledForSite(false)
          setGemDisabled(false)
          screenMascot.style.display = chat.settings.showScreenMascot ? 'block' : 'none'
        }
        return
      }
      chat.toggle()
      safeSend({ type: 'chat:open' })
    })
    const screenMascot = createScreenMascot()

    document.body.appendChild(screenMascot)
    document.body.appendChild(icon)
    document.body.appendChild(chat.getElement())

    if (siteDisabled) {
      setGemDisabled(true)
      screenMascot.style.display = 'none'
    }

    browser.runtime.onMessage.addListener((message: Message) => {
      switch (message.type) {
        case 'agent:response':
          if (stopped) break
          chat.finalizeThinkingStream()
          chat.finalizeStream(message.text)
          chat.setInputEnabled(true)
          chat.setModelSwitchEnabled(true)
          if (chat.settings.voice.speakResponses && chat.settings.voice.ttsProvider !== 'off') {
            safeSend({ type: 'voice:speak', text: message.text, provider: chat.settings.voice.ttsProvider } as any)
          }
          break

        case 'agent:chunk':
          if (stopped) break
          if (message.text.startsWith('[Tool]')) {
            chat.finalizeThinkingStream()
            chat.addMessage(message.text, 'tool')
          } else if (message.text.startsWith('[Thinking]')) {
            chat.appendThinkingStream(message.text.replace(/^\[Thinking\]\s*/, ''))
          } else if (message.text.trim()) {
            chat.finalizeThinkingStream()
            chat.appendStream(message.text)
          }
          break

        case 'agent:tool_call':
          handleToolCall(message.requestId, message.call)
          break

        case 'gpu:warning':
          chat.addMessage(message.text, 'agent')
          break

        case 'model:status':
          if (message.status === 'loading') {
            const pct = message.progress != null ? Math.round(message.progress) : 0
            updateGemProgress(pct)
            chat.updateModelDownloadProgress(pct, message.loadedBytes, message.totalBytes)
            chat.updateStatus(`Loading model... ${pct}%`)
            chat.setInputEnabled(false)
            chat.setModelSwitchEnabled(false)
            if (!shownLoadingMessage) {
              shownLoadingMessage = true
              const modelConfig = MODELS[message.modelId ?? initialModelId]
              chat.addMessage(`Downloading ${modelConfig.label}... This may take a moment on first run (${modelConfig.downloadSize}, cached after).`, 'agent')
            }
          } else if (message.status === 'ready') {
            updateGemProgress(-1)
            chat.updateStatus('Ready')
            chat.setInputEnabled(true)
            chat.setModelSwitchEnabled(true)
            if (message.modelId) {
              chat.setSelectedModel(message.modelId)
              chat.showModelReady(message.modelId)
            }
            if (!modelReady) {
              modelReady = true
              chat.addMessage('Local model loaded. How can I help with this page?', 'agent')
            }
          } else if (message.status === 'error') {
            updateGemProgress(-1)
            chat.updateStatus(`Error: ${message.error}`)
            chat.showModelError(message.error ?? 'Model load failed')
            chat.setModelSwitchEnabled(true)
          }
          break

        case 'model:info':
          chat.showModelInfo(message)
          chat.updateStatus(message.allCached ? 'Cached model available' : 'Download required')
          chat.setInputEnabled(false)
          chat.setModelSwitchEnabled(true)
          break

        case 'voice:transcript':
          chat.applyTranscript(message.text)
          chat.setVoiceStatus('Voice ready')
          break

        case 'voice:status':
          chat.setVoiceStatus(message.text)
          if (message.status === 'error') {
            chat.addMessage(message.text, 'agent')
          }
          break

        case 'voice:audio':
          chat.playAudio(message.bytes, message.mimeType)
          break

        case 'voice:audio-stop':
          chat.stopAudioPlayback()
          break
      }
    })

    function handleToolCall(requestId: string, call: ToolCall): void {
      const result = executeContentTool(call)
      if (result) {
        safeSend({ type: 'tool:result', requestId, result: result.result })
      }
    }
  },
})
