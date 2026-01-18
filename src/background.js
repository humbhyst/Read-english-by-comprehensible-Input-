const DEFAULT_SETTINGS = {
  cefrLevel: "B1",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

const RATE_LIMIT = {
  maxTokens: 10,
  refillMs: 6000,
};

const cache = new Map();
let rateState = { tokens: RATE_LIMIT.maxTokens, lastRefillMs: Date.now() };

async function getSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  return {
    cefrLevel: stored.cefrLevel || DEFAULT_SETTINGS.cefrLevel,
    geminiApiKey: stored.geminiApiKey || "",
    geminiModel: stored.geminiModel || DEFAULT_SETTINGS.geminiModel,
  };
}

function buildPrompt({ selectionText, cefrLevel }) {
  return [
    "You are an English teacher.",
    `Explain exactly the selected English text in English at CEFR level ${cefrLevel}.`,
    "Rules:",
    "- Explain the selected text itself (do not pick a different word).",
    "- Keep it short and very clear.",
    "- No translation to other languages.",
    "- Use simple words that a learner at that level can understand.",
    "- If the selection is a phrase or sentence, explain its meaning as a whole.",
    "- Include one tiny example sentence that uses the same selected text (or a very close rephrase if it is a long sentence).",
    "Output format:",
    "Meaning: ...",
    "Example: ...",
    "Selected text:",
    selectionText,
  ].join("\n");
}

function getCached(cacheKey) {
  const hit = cache.get(cacheKey);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(cacheKey);
    return null;
  }
  return hit.value;
}

function setCached(cacheKey, value) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(cacheKey, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

function consumeTokenOrThrow() {
  const now = Date.now();
  const elapsed = now - rateState.lastRefillMs;

  if (elapsed > 0) {
    const refill = Math.floor(elapsed / RATE_LIMIT.refillMs);
    if (refill > 0) {
      rateState.tokens = Math.min(RATE_LIMIT.maxTokens, rateState.tokens + refill);
      rateState.lastRefillMs += refill * RATE_LIMIT.refillMs;
    }
  }

  if (rateState.tokens <= 0) {
    throw new Error("RATE_LIMIT");
  }

  rateState.tokens -= 1;
}

function normalizeModelName(model) {
  const raw = String(model || "").trim();
  if (!raw) return DEFAULT_SETTINGS.geminiModel;
  if (raw.startsWith("models/")) return raw.slice("models/".length);
  return raw;
}

async function callGemini({ apiKey, model, promptText }) {
  consumeTokenOrThrow();

  const modelName = normalizeModelName(model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    referrerPolicy: "no-referrer",
    cache: "no-store",
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: promptText }],
        },
      ],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 180,
        thinking_config: {
          thinking_budget: 0,
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GEMINI_HTTP_${res.status}:${text || res.statusText}`);
  }

  const data = await res.json();
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p) => p?.text)
      .filter(Boolean)
      .join("") ||
    "";

  if (!text) throw new Error("GEMINI_EMPTY_RESPONSE");
  return text.trim();
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || typeof msg !== "object") throw new Error("INVALID_MESSAGE");

       if (msg.type === "ULW_GET_SETTINGS") {
         const settings = await getSettings();
         sendResponse({
           ok: true,
           settings: {
             cefrLevel: settings.cefrLevel,
             geminiModel: settings.geminiModel,
           },
         });
         return;
       }

       if (msg.type === "ULW_LIST_GEMINI_MODELS") {
         const apiKey = String(msg.apiKey || "").trim();
         if (!apiKey) throw new Error("MISSING_API_KEY");

         const url = "https://generativelanguage.googleapis.com/v1beta/models?pageSize=200";
         const res = await fetch(url, {
           method: "GET",
           headers: {
             "x-goog-api-key": apiKey,
           },
           referrerPolicy: "no-referrer",
           cache: "no-store",
         });

         if (!res.ok) {
           const text = await res.text().catch(() => "");
           throw new Error(`GEMINI_HTTP_${res.status}:${text || res.statusText}`);
         }

         const data = await res.json();
         const models = Array.isArray(data?.models) ? data.models : [];

         const names = models
           .map((m) => String(m?.name || ""))
           .filter(Boolean)
           .map((n) => (n.startsWith("models/") ? n.slice("models/".length) : n));

         const allowed = models
           .filter((m) => Array.isArray(m?.supportedGenerationMethods) && m.supportedGenerationMethods.includes("generateContent"))
           .map((m) => String(m?.name || ""))
           .filter(Boolean)
           .map((n) => (n.startsWith("models/") ? n.slice("models/".length) : n));

         const filtered = allowed.filter((n) => n.startsWith("gemini-"));
         const list = (filtered.length > 0 ? filtered : allowed).sort();

         sendResponse({ ok: true, models: list });
         return;
       }

      if (msg.type === "ULW_GENERATE_EXPLANATION") {
        const selectionText = String(msg.selectionText || "").trim();
        if (!selectionText) throw new Error("NO_SELECTION");
        if (selectionText.length > 1000) throw new Error("SELECTION_TOO_LONG");

        const { cefrLevel, geminiApiKey, geminiModel } = await getSettings();
        if (!geminiApiKey) {
          sendResponse({ ok: false, error: "MISSING_API_KEY" });
          return;
        }

        const cacheKey = `${cefrLevel}|${geminiModel}|${selectionText}`;
        const cached = getCached(cacheKey);
         if (cached) {
           sendResponse({ ok: true, explanation: cached, cefrLevel, model: geminiModel, cached: true });
           return;
         }

        const promptText = buildPrompt({ selectionText, cefrLevel });
        const explanation = await callGemini({ apiKey: geminiApiKey, model: geminiModel, promptText });
        setCached(cacheKey, explanation);

        sendResponse({ ok: true, explanation, cefrLevel, model: geminiModel, cached: false });
        return;
      }

      throw new Error("UNKNOWN_MESSAGE_TYPE");
    } catch (e) {
      const message = e?.message || String(e);
      sendResponse({ ok: false, error: message });
    }
  })();

  return true;
});
