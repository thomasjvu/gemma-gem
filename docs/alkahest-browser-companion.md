# Alkahest Browser Companion Implementation Notes

## Fork Setup

- Cloned from `git@github.com:thomasjvu/gemma-gem.git`.
- Local branch: `codex/alkahest-browser-companion`.
- The fork lives under `temp/gemma-gem`, which is ignored by the parent Alkahest repo.
- Use `pnpm --ignore-workspace ...` for every command from this directory so pnpm does not climb into the parent monorepo workspace.

## Baseline Measurements

Measured before reskin and feature edits:

- `pnpm --ignore-workspace install`: passed.
- `pnpm --ignore-workspace compile`: failed in upstream baseline because Chrome/WebGPU globals and several strict-mode spots were missing types.
- `pnpm --ignore-workspace build`: passed.
- `.output/chrome-mv3-dev`: `49M` on disk.
- WXT build summary total: `50.5 MB`.
- `public/ort`: `23M`.

Model cache size, cold-load latency, warm-load latency, first-token latency, tokens/sec, and WebGPU memory still require a manual Chrome unpacked-extension run because no Gemma model files are downloaded during `pnpm build`.

## Final Verification

Measured after the Alkahest Browser Companion changes:

- `pnpm --ignore-workspace compile`: passed.
- `pnpm --ignore-workspace build`: passed.
- WXT build summary total: `51.56 MB`.
- `.output/chrome-mv3-dev`: `50M` on disk.
- `public/mascot`: `964K`.
- `public/icon`: `44K`.
- Generated manifest name: `Alkahest Browser Companion [dev]`.
- Generated manifest permissions include `tts` for the opt-in Chrome/OS TTS fallback.
- Follow-up build after consent/cache UX: `pnpm --ignore-workspace compile` and `pnpm --ignore-workspace build` passed.
- Generated manifest now declares `mascot/*` and `icon/*` as web-accessible resources so page-injected mascot images render.

## Why E2B Feels Light

The fork does not run a full Python/PyTorch model stack. It loads Gemma 4 through Transformers.js and ONNX Runtime Web in the offscreen document, with:

- `onnx-community/gemma-4-E2B-it-ONNX`
- `dtype: "q4f16"`
- `device: "webgpu"`
- browser cache reuse after first download

That combination keeps runtime overhead much lower than local server stacks that bring Python, PyTorch, full precision weights, or broader model-serving machinery.

## MTP Status

Gemma 4 MTP needs a main model plus an assistant/drafter model, for example the Python Transformers shape of `google/gemma-4-E2B-it` plus `google/gemma-4-E2B-it-assistant`.

This fork now stores `assistantModelId` and `supportsMtp` in model metadata, and the UI exposes an MTP toggle. When enabled, the runtime records the request but keeps baseline decoding unless support becomes available because:

- `@huggingface/transformers@4.1.0` does not expose `assistant_model` in its generation types.
- A matching browser-ready ONNX assistant model was not found during the planning pass.
- Custom speculative decoding would be a larger runtime change and was intentionally kept out of this slice.

## Download Consent And Cache Status

Opening the panel now inspects the selected model before loading:

- The offscreen runtime uses Transformers.js `ModelRegistry` to resolve the exact files needed for the selected `q4f16` WebGPU runtime.
- It checks browser Cache API state per file and fetches file metadata for byte sizes.
- The panel shows total selected runtime bytes, cached bytes, missing bytes, and cached file counts.
- The model only loads after the user clicks `Download and load` or `Load cached model`.
- Progress reports downloaded bytes when Transformers.js emits byte-level progress.

## Voice Status

Implemented:

- Optional microphone recording from the content-script UI.
- 16 kHz mono preparation for Whisper.
- Lazy offscreen local ASR with `onnx-community/whisper-tiny.en`, WebGPU first and WASM fallback.
- Voice model disposal after each transcription to avoid keeping Whisper resident next to Gemma.
- Web Speech API ASR option for Chrome users who want speech input without downloading Whisper. This is not the privacy-default path because browser speech recognition can use browser/remote services depending on Chrome capabilities.
- Explicit Chrome/OS TTS fallback for spoken responses.
- Pocket TTS local-server option. Start it with `uvx pocket-tts serve`; the extension posts form data to `http://127.0.0.1:8000/tts` and plays the returned WAV in the page.

Pocket TTS browser-native WASM/ONNX remains a future path. The current implementation is local-server based, opt-in, and not enabled by default.
