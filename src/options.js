const DEFAULT_SETTINGS = {
  cefrLevel: "B1",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  cachedModels: [],
};

function setStatus(text, type) {
  const el = document.getElementById("status-msg");
  if (!el) return;
  el.textContent = text;
  el.className = type;
  if (!text) el.className = "";
}

function setModelMsg(text, isError) {
  const el = document.getElementById("model-msg");
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? "#dc2626" : "";
}

function setModelControlsEnabled(enabled) {
  const selectEl = document.getElementById("geminiModel");
  const btnEl = document.getElementById("refresh-models-btn");
  if (selectEl) selectEl.disabled = !enabled;
  if (btnEl) btnEl.disabled = !enabled;
}

async function persistSelectedModel() {
  const modelEl = document.getElementById("geminiModel");
  if (!modelEl) return;
  const geminiModel = String(modelEl.value || "").trim();
  if (!geminiModel) return;
  await chrome.storage.local.set({ geminiModel });
}

function setModelOptions(modelNames, selectedModel) {
  const selectEl = document.getElementById("geminiModel");
  if (!selectEl) return;

  selectEl.innerHTML = "";
  if (!Array.isArray(modelNames) || modelNames.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No models";
    selectEl.appendChild(opt);
    return;
  }

  for (const name of modelNames) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    selectEl.appendChild(opt);
  }

  const desired = String(selectedModel || "").trim();
  if (desired && modelNames.includes(desired)) {
    selectEl.value = desired;
  } else {
    selectEl.value = modelNames[0];
  }
}

async function fetchModelsWithKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) throw new Error("MISSING_API_KEY");

  const resp = await chrome.runtime.sendMessage({ type: "ULW_LIST_GEMINI_MODELS", apiKey: key });
  if (!resp || !resp.ok) {
    throw new Error(resp?.error || "FAILED_TO_LIST_MODELS");
  }

  if (!Array.isArray(resp.models)) return [];
  return resp.models.map((m) => String(m)).filter(Boolean);
}

async function loadSettings() {
  const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
  const apiKeyEl = document.getElementById("apiKey");
  const levelEl = document.getElementById("cefrLevel");
  const modelEl = document.getElementById("geminiModel");

  if (apiKeyEl) apiKeyEl.value = stored.geminiApiKey || "";
  if (levelEl) levelEl.value = stored.cefrLevel || DEFAULT_SETTINGS.cefrLevel;

  const cachedModels = Array.isArray(stored.cachedModels) ? stored.cachedModels : [];
  const selectedModel = stored.geminiModel || DEFAULT_SETTINGS.geminiModel;

  if (modelEl) {
    if (cachedModels.length > 0) {
      setModelOptions(cachedModels, selectedModel);
      setModelControlsEnabled(true);
      setModelMsg("", false);
    } else {
      setModelOptions([DEFAULT_SETTINGS.geminiModel], selectedModel);
      setModelControlsEnabled(Boolean((stored.geminiApiKey || "").trim()));
      setModelMsg("Click Refresh to load models", false);
    }
  }
}

async function saveSettings({ geminiApiKey, cefrLevel, geminiModel }) {
  await chrome.storage.local.set({ geminiApiKey, cefrLevel, geminiModel });
}

document.addEventListener("DOMContentLoaded", () => {
  loadSettings().catch(() => setStatus("Failed to load settings", "error"));

  const form = document.getElementById("options-form");
  if (!form) return;

  const refreshBtn = document.getElementById("refresh-models-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async () => {
      setModelMsg("Loading models...", false);
      setModelControlsEnabled(false);

      const apiKeyEl = document.getElementById("apiKey");
      const apiKey = String(apiKeyEl?.value || "").trim();

      try {
        const models = await fetchModelsWithKey(apiKey);
        await chrome.storage.local.set({ cachedModels: models });

        const stored = await chrome.storage.local.get(DEFAULT_SETTINGS);
        const selectedModel = stored.geminiModel || DEFAULT_SETTINGS.geminiModel;

        const finalSelected = models.includes(selectedModel) ? selectedModel : (models[0] || DEFAULT_SETTINGS.geminiModel);
        await chrome.storage.local.set({ geminiModel: finalSelected });

        setModelOptions(models, finalSelected);
        setModelMsg(`Loaded ${models.length} models`, false);
      } catch (e) {
        setModelOptions([DEFAULT_SETTINGS.geminiModel], DEFAULT_SETTINGS.geminiModel);
        setModelMsg(e?.message === "MISSING_API_KEY" ? "Enter API key first" : `Failed: ${e?.message || e}`, true);
      } finally {
        setModelControlsEnabled(Boolean(apiKey));
      }
    });
  }

  const apiKeyEl = document.getElementById("apiKey");
  if (apiKeyEl) {
    apiKeyEl.addEventListener("input", () => {
      const key = String(apiKeyEl.value || "").trim();
      setModelControlsEnabled(Boolean(key));
      if (!key) {
        setModelMsg("Enter API key to load models", false);
      } else {
        setModelMsg("", false);
      }
    });
  }

  const modelEl = document.getElementById("geminiModel");
  if (modelEl) {
    modelEl.addEventListener("change", () => {
      persistSelectedModel().catch(() => {
        setModelMsg("Failed to save model", true);
        window.setTimeout(() => setModelMsg("", false), 1500);
      });
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("", "");

    const apiKeyEl2 = document.getElementById("apiKey");
    const levelEl = document.getElementById("cefrLevel");
    const modelEl = document.getElementById("geminiModel");

    const geminiApiKey = String(apiKeyEl2?.value || "").trim();
    const cefrLevel = String(levelEl?.value || DEFAULT_SETTINGS.cefrLevel);
    const geminiModel = String(modelEl?.value || DEFAULT_SETTINGS.geminiModel).trim() || DEFAULT_SETTINGS.geminiModel;

    if (!cefrLevel) {
      setStatus("Please select a level", "error");
      return;
    }

    try {
      await saveSettings({ geminiApiKey, cefrLevel, geminiModel });
      setStatus("Saved", "success");
      setTimeout(() => setStatus("", ""), 1200);
    } catch {
      setStatus("Save failed", "error");
    }
  });
});
