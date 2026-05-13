# Alkahest Browser Companion

Browser-local companion sidecar for Alkahest experiments. It runs Gemma 4 through Transformers.js and WebGPU inside a Chrome extension, can inspect and operate the current page, and keeps the default chat path on-device.

This is an incubating fork of Gemma Gem. It is not core Alkahest platform substrate.

## Requirements

- Chrome or Brave with WebGPU support
- pnpm
- About 50 MB for the unpacked extension build before model cache
- First-run model cache: Gemma 4 E2B is still treated as an estimate until measured in Chrome on the target machine

## Setup

```bash
pnpm --ignore-workspace install
pnpm --ignore-workspace build
```

Load the extension in `chrome://extensions` with developer mode enabled from `.output/chrome-mv3-dev/`.

## Runtime Shape

```
Offscreen Document          Service Worker           Content Script
(Gemma/Whisper hosts)   <-> (Message Router)    <-> (Chat UI + DOM Tools)
       |                         |
  WebGPU inference          Screenshot capture
  Token streaming           JS execution
  Local ASR spike           Chrome/OS TTS fallback
```

- **Gemma host**: `@huggingface/transformers` with `Gemma4ForConditionalGeneration`, WebGPU, and `q4f16`.
- **Agent loop**: `@kessler/gemma-agent` with page tools.
- **Voice**: optional local Whisper input loads lazily; Chrome/OS TTS is the explicit non-default speech fallback. Pocket TTS is tracked but not browser-wired yet.
- **MTP**: metadata and disabled UI flag are present. The ONNX/Transformers.js runtime does not currently expose a proven assistant-model path for Gemma 4 MTP.

## Settings

- **Model**: Gemma 4 E2B or E4B.
- **Thinking**: Native Gemma thinking stream.
- **Max tool iterations**: Tool-loop cap per request.
- **MTP acceleration**: Disabled until browser assistant-model support is confirmed.
- **Local Whisper input**: Records microphone input and sends 16 kHz samples to the offscreen Whisper host.
- **Speak responses**: Uses Chrome/OS TTS when selected.
- **Disable on this site**: Per-host extension disable.

## Development

```bash
pnpm --ignore-workspace compile
pnpm --ignore-workspace build
pnpm --ignore-workspace build:prod
```

Use `--ignore-workspace` because this fork lives under the Alkahest monorepo `temp/` directory, and the parent repo has its own pnpm workspace.

## Notes

See `docs/alkahest-browser-companion.md` for baseline measurements, MTP findings, and voice implementation notes.
