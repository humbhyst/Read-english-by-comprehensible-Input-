# ULW: Learn English with English you can understand

ULW (Understandable Language Wrapper) is a lightweight Chrome extension for English learners. It explains selected words/phrases directly on the page using simple English tailored to your CEFR level (A1 to C2).

It uses Google Gemini to help you keep your reading flow with comprehensible input (no translations).

## Key Features

- Contextual explanations: select text on any webpage and get an instant explanation
- Level-aware output: choose CEFR level (A1-C2) and the explanation adapts
- English-only learning: avoids translation to build immersion
- Example sentence: each response includes a small example
- Performance: in-memory cache + basic rate limiting
- Local-first: Gemini API key is stored on your device via `chrome.storage.local`

## Installation (Load Unpacked)

1. Clone/download this repository.
2. Open `chrome://extensions/`.
3. Enable "Developer mode".
4. Click "Load unpacked".
5. Select the folder that contains `manifest.json` (the repository root).

Works in Chrome and other Chromium-based browsers (Edge, Brave, etc.).

## Configuration

Before using the extension, add your Gemini API key:

1. Open the extension options page (from the Extensions page, or click "Options" in the on-page card).
2. Enter your Gemini API key (get one from Google AI Studio: https://aistudio.google.com/app/apikey).
3. Select your reading level (CEFR).
4. (Optional) Click "Refresh" to load available Gemini models and pick one.
5. Click "Save".

Settings are stored locally via `chrome.storage.local`.

## How to Use

1. Visit any webpage with English content.
2. Highlight a word, phrase, or sentence.
3. Click the small "Explain" button (star icon) near your selection.
4. Read the explanation card (Meaning + Example).
5. You can drag the card by its header to reposition it.

## Security & Privacy Notes

- Your Gemini API key is stored locally in `chrome.storage.local`.
- The extension talks directly to `https://generativelanguage.googleapis.com/*` using the `x-goog-api-key` header.
- Client-side API keys cannot be perfectly hidden from a determined user. Treat your key as a private credential.
- Never commit `.env`/key files or paste your API key into the repo.

## Troubleshooting

- Missing API key: open Options and save a valid key.
- Selection too long: selections are limited to 1000 characters.
- Rate limit: wait a few seconds and retry.
- Extension reloaded: refresh the current webpage after reloading the extension.

## License

MIT - see `LICENSE`.

## 中文快速入门

1. 安装：打开 `chrome://extensions/`，开启“开发者模式”，点击“加载已解压的扩展程序”，选择本项目根目录（包含 `manifest.json`）。
2. 配置：在 Options 页面填入 Gemini API Key（https://aistudio.google.com/app/apikey），选择 CEFR 等级；可点 Refresh 选择模型。
3. 使用：在网页选中英文文本，点击旁边出现的星形 Explain 按钮，即可查看英文解释。
