import type { Message } from '@/shared/messages'
import { ensureOffscreenDocument } from './offscreen-manager'
import { log } from '@/shared/logger'
import { STORAGE_KEY_MODEL, DEFAULT_MODEL_ID, type ModelId } from '@/shared/models'

function sendToRuntime(message: Message): void {
  chrome.runtime.sendMessage(message).catch(() => {})
}

function sendToTab(tabId: number, message: Message): void {
  chrome.tabs.sendMessage(tabId, message).catch(() => {})
}

async function sendToActiveTab(message: Message): Promise<void> {
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (activeTab?.id) sendToTab(activeTab.id, message)
}

export function setupMessageRouter(): void {
  chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse).catch(e => log.error('Message handler error:', e))
    return true
  })
}

async function handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'chat:send': {
      const tabId = sender.tab?.id
      if (!tabId) return
      log.debug('chat:send from tab', tabId, message.text.slice(0, 50))

      await ensureOffscreenDocument()
      sendToRuntime({ type: 'agent:run', tabId, userMessage: message.text, settings: message.settings, pageContext: message.pageContext })
      return
    }

    case 'chat:open': {
      log.debug('chat:open — inspecting model cache')
      await ensureOffscreenDocument()
      const data = await chrome.storage.local.get(STORAGE_KEY_MODEL)
      const storedModelId = data[STORAGE_KEY_MODEL]
      const modelId: ModelId = typeof storedModelId === 'string'
        ? storedModelId as ModelId
        : DEFAULT_MODEL_ID
      sendToRuntime({ type: 'model:inspect', modelId })
      return
    }

    case 'model:load-request': {
      log.debug('model:load-request', message.modelId)
      await ensureOffscreenDocument()
      const modelId = message.modelId ?? DEFAULT_MODEL_ID
      await chrome.storage.local.set({ [STORAGE_KEY_MODEL]: modelId })
      sendToRuntime({ type: 'model:load', modelId })
      return
    }

    case 'settings:update': {
      log.debug('settings:update', message.settings)
      sendToRuntime(message)
      return
    }

    case 'chat:stop': {
      log.debug('chat:stop')
      sendToRuntime(message)
      return
    }

    case 'context:clear': {
      log.debug('context:clear')
      sendToRuntime(message)
      return
    }

    case 'model:switch': {
      log.debug('model:switch', message.modelId)
      await chrome.storage.local.set({ [STORAGE_KEY_MODEL]: message.modelId })
      await ensureOffscreenDocument()
      sendToRuntime({ type: 'model:inspect', modelId: message.modelId })
      return
    }

    case 'tool:result': {
      log.debug('tool:result', message.requestId)
      sendToRuntime(message)
      return
    }

    case 'voice:transcribe': {
      const tabId = sender.tab?.id
      if (!tabId) return
      log.info('voice:transcribe from tab', tabId, `${message.audioSamples.length} samples`)
      await ensureOffscreenDocument()
      sendToRuntime({ ...message, tabId })
      return
    }

    case 'voice:clear-cache': {
      const tabId = sender.tab?.id
      await ensureOffscreenDocument()
      sendToRuntime({ ...message, tabId })
      return
    }

    case 'voice:speak': {
      const tabId = sender.tab?.id
      if (message.provider === 'pocket') {
        if (!tabId) return
        try {
          sendToTab(tabId, { type: 'voice:status', status: 'loading', text: 'Requesting Pocket TTS...' })
          const body = new FormData()
          body.set('text', message.text)
          const response = await fetch('http://127.0.0.1:8000/tts', {
            method: 'POST',
            body,
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const mimeType = response.headers.get('content-type') ?? 'audio/wav'
          const bytes = Array.from(new Uint8Array(await response.arrayBuffer()))
          sendToTab(tabId, { type: 'voice:audio', mimeType, bytes })
          sendToTab(tabId, { type: 'voice:status', status: 'speaking', text: 'Speaking response' })
        } catch (error) {
          sendToTab(tabId, {
            type: 'voice:status',
            status: 'error',
            text: `Pocket TTS unavailable at 127.0.0.1:8000. Start it with: uvx pocket-tts serve (${error instanceof Error ? error.message : String(error)})`,
          })
        }
        return
      }
      if (message.provider === 'chrome') {
        if (!chrome.tts) {
          if (tabId) sendToTab(tabId, { type: 'voice:status', status: 'error', text: 'Chrome TTS is unavailable in this browser.' })
          return
        }
        chrome.tts.stop()
        chrome.tts.speak(message.text, { enqueue: false }, () => {
          const error = chrome.runtime.lastError?.message
          if (tabId) {
            sendToTab(tabId, {
              type: 'voice:status',
              status: error ? 'error' : 'speaking',
              text: error ? `TTS error: ${error}` : 'Speaking response',
            })
          }
        })
      }
      return
    }

    case 'voice:stop': {
      chrome.tts?.stop()
      if (sender.tab?.id) {
        sendToTab(sender.tab.id, { type: 'voice:audio-stop' })
        sendToTab(sender.tab.id, { type: 'voice:status', status: 'idle', text: 'Voice stopped' })
      }
      return
    }

    case 'tool:execute': {
      const { tabId, call, requestId } = message
      log.info('tool:execute', call.name, JSON.stringify(call.arguments))

      try {
        if (call.name === 'take_screenshot') {
          const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' })
          log.debug('screenshot captured', dataUrl.length, 'bytes')
          sendToRuntime({ type: 'tool:result', requestId, result: { screenshot: dataUrl } })
          return
        }

        if (call.name === 'run_javascript') {
          const code = call.arguments.code
          if (!code || typeof code !== 'string') {
            sendToRuntime({ type: 'tool:result', requestId, result: { error: 'No code provided' } })
            return
          }
          log.debug('executing JS in tab', tabId)
          const results = await chrome.scripting.executeScript({
            target: { tabId },
            world: 'MAIN',
            func: (code: string) => {
              try {
                const result = new Function(code)()
                return { value: String(result) }
              } catch (e) {
                return { error: String(e) }
              }
            },
            args: [call.arguments.code as string],
          })
          sendToRuntime({ type: 'tool:result', requestId, result: results[0]?.result ?? { error: 'No result' } })
          return
        }

        sendToTab(tabId, { type: 'agent:tool_call', requestId, call })
      } catch (e) {
        log.error('tool:execute failed:', call.name, e)
        sendToRuntime({ type: 'tool:result', requestId, result: { error: `Tool ${call.name} failed: ${e}` } })
      }
      return
    }

    case 'agent:response': {
      if ('tabId' in message) {
        log.info('agent:response →', message.text.slice(0, 80))
        sendToTab(message.tabId, { type: 'agent:response', text: message.text })
      }
      return
    }

    case 'agent:chunk': {
      if ('tabId' in message) {
        sendToTab(message.tabId, { type: 'agent:chunk', text: message.text })
      }
      return
    }

    case 'gpu:warning': {
      await sendToActiveTab(message)
      return
    }

    case 'voice:transcript': {
      if (message.tabId) {
        sendToTab(message.tabId, { type: 'voice:transcript', text: message.text })
      }
      return
    }

    case 'voice:status': {
      if (message.tabId) {
        sendToTab(message.tabId, { type: 'voice:status', status: message.status, text: message.text })
      } else {
        await sendToActiveTab(message)
      }
      return
    }

    case 'model:status': {
      log.info('model:status:', message.status, message.progress ?? '', message.error ?? '')
      await sendToActiveTab(message)
      return
    }

    case 'model:info': {
      await sendToActiveTab(message)
      return
    }
  }
}
