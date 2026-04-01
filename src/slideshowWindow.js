import { loadSavedRecordingsFromDirectory } from "./services/downloadService.js";
import { setFullscreenState } from "./services/desktopService.js";
import { logger } from "./services/logger.js";
import { loadDesktopPersistedSettings, loadPersistedSettings } from "./services/settingsPersistence.js";

const PLAYABLE_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 750;
const MAX_ENTRY_FAILURES = 2;
const SETTINGS_SYNC_INTERVAL_MS = 2000;
let entries = [];
let currentIndex = 0;
let loadTimeoutId = null;
let retryTimeoutId = null;
let playGeneration = 0;
let diagnosticsBound = false;
let settingsSyncIntervalId = null;
let lastSettingsSignature = "";
let lastEntriesSignature = "";
const entryFailureCounts = new Map();

function getPersistedSaveDirectory() {
  try {
    const settings = loadPersistedSettings();
    return typeof settings?.saveDirectoryPath === "string" ? settings.saveDirectoryPath : "";
  } catch {
    return "";
  }
}

function getSlideshowSettings() {
  try {
    const settings = loadPersistedSettings() || {};
    return {
      fadeEnabled: typeof settings?.slideshowFadeEnabled === "boolean" ? settings.slideshowFadeEnabled : true,
      fadeDurationMs: Number.isFinite(settings?.slideshowFadeDurationMs) ? Math.max(0, settings.slideshowFadeDurationMs) : 600
    };
  } catch {
    return { fadeEnabled: true, fadeDurationMs: 600 };
  }
}

function getVideoElement() {
  const video = document.getElementById("slideshowVideo");
  return video instanceof HTMLVideoElement ? video : null;
}

function getCurrentEntry() {
  return entries[currentIndex] || null;
}

function getEntryKey(entry) {
  return entry?.path || entry?.filename || "";
}

function getEntryFailureCount(entry) {
  return entryFailureCounts.get(getEntryKey(entry)) || 0;
}

function recordEntryFailure(entry, reason) {
  const entryKey = getEntryKey(entry);
  if (!entryKey) {
    return 0;
  }

  const failureCount = getEntryFailureCount(entry) + 1;
  entryFailureCounts.set(entryKey, failureCount);
  void logger.warn("Slideshow entry playback failed.", {
    reason,
    filename: entry?.filename || "",
    currentIndex,
    failureCount,
    maxFailures: MAX_ENTRY_FAILURES
  });
  return failureCount;
}

function resetEntryFailure(entry) {
  const entryKey = getEntryKey(entry);
  if (entryKey) {
    entryFailureCounts.delete(entryKey);
  }
}

function updateEmptyState(isEmpty, message = "No videos are available in the gallery folder yet.") {
  const emptyState = document.getElementById("slideshowEmptyState");
  const emptyMessage = emptyState?.querySelector("p");
  emptyState?.classList.toggle("hidden", !isEmpty);
  document.getElementById("slideshowVideo")?.classList.toggle("hidden", isEmpty);
  document.getElementById("slideshowMeta")?.classList.toggle("hidden", isEmpty);
  if (emptyMessage) {
    emptyMessage.textContent = message;
  }
}

function clearTimers() {
  if (loadTimeoutId !== null) {
    window.clearTimeout(loadTimeoutId);
    loadTimeoutId = null;
  }

  if (retryTimeoutId !== null) {
    window.clearTimeout(retryTimeoutId);
    retryTimeoutId = null;
  }
}

function getEntriesSignature(nextEntries = entries) {
  return nextEntries
    .map((entry) => `${entry.path || entry.filename || ""}:${entry.modifiedAt || 0}`)
    .join("|");
}

function getSettingsSignature() {
  const settings = loadPersistedSettings() || {};
  return JSON.stringify({
    saveDirectoryPath: settings.saveDirectoryPath || "",
    slideshowFadeEnabled: Boolean(settings.slideshowFadeEnabled),
    slideshowFadeDurationMs: Number.isFinite(settings.slideshowFadeDurationMs) ? Math.max(0, settings.slideshowFadeDurationMs) : 600
  });
}

function clearVideoSource() {
  const video = getVideoElement();
  if (!video) {
    return;
  }

  video.pause();
  video.removeAttribute("src");
  video.load();
}

function describeVideoError(video) {
  if (!video?.error) {
    return "";
  }

  return `${video.error.code}:${video.error.message || "media error"}`;
}

function scheduleRetry(reason, delayMs = RETRY_DELAY_MS) {
  if (retryTimeoutId !== null) {
    window.clearTimeout(retryTimeoutId);
  }

  retryTimeoutId = window.setTimeout(() => {
    retryTimeoutId = null;
    void logger.warn("Slideshow retry scheduled after playback issue.", {
      reason,
      delayMs,
      currentIndex,
      entryCount: entries.length,
      filename: getCurrentEntry()?.filename || ""
    });
    void advanceSlideshow(`retry:${reason}`, { skipCurrent: true });
  }, delayMs);
}

async function loadEntries() {
  const directoryPath = getPersistedSaveDirectory();
  void logger.debug("Slideshow loading entries.", { directoryPath });
  return loadSavedRecordingsFromDirectory(directoryPath || null);
}

function clampIndex() {
  if (entries.length === 0) {
    currentIndex = 0;
    return;
  }

  currentIndex = Math.max(0, Math.min(currentIndex, entries.length - 1));
}

async function refreshEntries(reason = "refresh") {
  const currentEntryKey = getEntryKey(getCurrentEntry());
  const nextEntries = await loadEntries();
  const nextEntriesSignature = getEntriesSignature(nextEntries);
  entries = nextEntries;
  if (currentEntryKey) {
    const matchingIndex = entries.findIndex((entry) => getEntryKey(entry) === currentEntryKey);
    currentIndex = matchingIndex >= 0 ? matchingIndex : 0;
  }
  clampIndex();
  lastEntriesSignature = nextEntriesSignature;
  void logger.info("Slideshow refreshed entries.", {
    reason,
    count: entries.length,
    currentIndex,
    saveDirectoryPath: getPersistedSaveDirectory(),
    filenames: entries.map((entry) => entry.filename)
  });

  if (entries.length === 0) {
    currentIndex = 0;
    clearVideoSource();
    updateEmptyState(true, "No videos are available in the gallery folder yet.");
    return false;
  }

  return true;
}

function bindVideoDiagnostics(video) {
  if (diagnosticsBound) {
    return;
  }

  diagnosticsBound = true;
  ["loadstart", "loadedmetadata", "loadeddata", "canplay", "canplaythrough", "playing", "pause", "waiting", "stalled", "suspend", "emptied"].forEach((eventName) => {
    video.addEventListener(eventName, () => {
      const entry = getCurrentEntry();
      void logger.debug("Slideshow video event fired.", {
        eventName,
        filename: entry?.filename || "",
        currentIndex,
        readyState: video.readyState,
        networkState: video.networkState,
        currentTime: video.currentTime,
        duration: video.duration
      });
    });
  });

  video.addEventListener("error", () => {
    const entry = getCurrentEntry();
    void logger.warn("Slideshow video element emitted an error event.", {
      filename: entry?.filename || "",
      currentIndex,
      readyState: video.readyState,
      networkState: video.networkState,
      mediaError: describeVideoError(video)
    });
  });
}

function bindPlaybackState(video, generation, entry) {
  let settled = false;

  function cleanup() {
    video.removeEventListener("loadedmetadata", handleReady);
    video.removeEventListener("loadeddata", handleReady);
    video.removeEventListener("canplay", handleReady);
    video.removeEventListener("error", handleError);
    if (loadTimeoutId !== null) {
      window.clearTimeout(loadTimeoutId);
      loadTimeoutId = null;
    }
  }

  function finish(callback) {
    if (settled || generation !== playGeneration) {
      return;
    }

    settled = true;
    cleanup();
    callback();
  }

  function handleReady() {
    finish(() => {
      resetEntryFailure(entry);
      void logger.debug("Slideshow entry reached playable state.", {
        filename: entry.filename,
        generation,
        readyState: video.readyState,
        networkState: video.networkState,
        duration: video.duration
      });
      video.play().then(() => {
        void logger.info("Slideshow video playback started.", {
          filename: entry.filename,
          generation,
          duration: video.duration,
          currentTime: video.currentTime
        });
      }).catch((error) => {
        void logger.exception("Slideshow video play() rejected.", error, {
          filename: entry.filename,
          generation,
          readyState: video.readyState,
          networkState: video.networkState
        });
        recordEntryFailure(entry, "play-rejected");
        scheduleRetry("play-rejected");
      });
    });
  }

  function handleError() {
    finish(() => {
      const failureCount = recordEntryFailure(entry, "load-failed");
      void logger.warn("Slideshow video failed to become playable. Retrying.", {
        filename: entry.filename,
        generation,
        readyState: video.readyState,
        networkState: video.networkState,
        mediaError: describeVideoError(video),
        failureCount
      });
      scheduleRetry("load-failed");
    });
  }

  video.addEventListener("loadedmetadata", handleReady);
  video.addEventListener("loadeddata", handleReady);
  video.addEventListener("canplay", handleReady);
  video.addEventListener("error", handleError);
  loadTimeoutId = window.setTimeout(() => {
    void logger.warn("Slideshow timed out waiting for a video to become playable.", {
      filename: entry.filename,
      generation,
      readyState: video.readyState,
      networkState: video.networkState
    });
    handleError();
  }, PLAYABLE_TIMEOUT_MS);
}

function findNextPlayableIndex(startIndex) {
  if (entries.length === 0) {
    return -1;
  }

  for (let offset = 0; offset < entries.length; offset += 1) {
    const candidateIndex = (startIndex + offset) % entries.length;
    if (getEntryFailureCount(entries[candidateIndex]) < MAX_ENTRY_FAILURES) {
      return candidateIndex;
    }
  }

  return -1;
}

async function playCurrentEntry(reason = "play") {
  const video = getVideoElement();
  const filename = document.getElementById("slideshowFilename");
  const counter = document.getElementById("slideshowCounter");
  if (!video || !filename || !counter) {
    updateEmptyState(true, "Photobooth could not initialize the slideshow player.");
    void logger.error("Slideshow player could not initialize because required DOM elements were missing.");
    return;
  }

  if (entries.length === 0) {
    const hasEntries = await refreshEntries(reason);
    if (!hasEntries) {
      return;
    }
  }

  const playableIndex = findNextPlayableIndex(currentIndex);
  if (playableIndex < 0) {
    clearVideoSource();
    updateEmptyState(true, "Photobooth could not play the saved slideshow videos.");
    void logger.error("Slideshow could not find any playable entries.", {
      entryCount: entries.length,
      failureCounts: Object.fromEntries(entryFailureCounts.entries())
    });
    return;
  }

  currentIndex = playableIndex;
  const generation = playGeneration;
  const entry = getCurrentEntry();
  if (!entry) {
    void logger.warn("Slideshow play request skipped because the entry was missing.", { currentIndex, entryCount: entries.length, reason });
    return;
  }

  bindVideoDiagnostics(video);
  void logger.audit("Slideshow playing entry.", {
    reason,
    filename: entry.filename,
    filePath: entry.path || "",
    url: entry.url,
    currentIndex,
    totalEntries: entries.length,
    failureCount: getEntryFailureCount(entry)
  });

  updateEmptyState(true, `Loading ${entry.filename}...`);

  clearTimers();
  clearVideoSource();

  const { fadeEnabled, fadeDurationMs } = getSlideshowSettings();
  video.style.transitionDuration = `${fadeEnabled ? fadeDurationMs : 0}ms`;
  if (fadeEnabled && fadeDurationMs > 0) {
    video.classList.add("is-fading");
    await new Promise((resolve) => window.setTimeout(resolve, fadeDurationMs));
  }

  video.loop = false;
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.preload = "auto";
  video.currentTime = 0;
  bindPlaybackState(video, generation, entry);
  video.src = entry.url;
  video.load();
  updateEmptyState(false);
  video.classList.remove("is-fading");
}

async function advanceSlideshow(reason = "advance", { skipCurrent = false } = {}) {
  clearTimers();

  if (entries.length === 0) {
    const hasEntries = await refreshEntries(reason);
    if (!hasEntries) {
      return;
    }
  } else {
    const offset = skipCurrent ? 1 : 0;
    currentIndex = (currentIndex + offset) % entries.length;
    if (currentIndex === 0) {
      const hasEntries = await refreshEntries("wrap");
      if (!hasEntries) {
        return;
      }
    }
  }

  void logger.debug("Slideshow advancing to next entry.", {
    reason,
    currentIndex,
    entryCount: entries.length,
    filename: getCurrentEntry()?.filename || "",
    skipCurrent
  });
  void playCurrentEntry(reason);
}

async function loadSlideshow(reason = "initial-load") {
  playGeneration += 1;
  clearTimers();
  clearVideoSource();
  updateEmptyState(true, "Loading slideshow videos...");

  try {
    currentIndex = 0;
    entryFailureCounts.clear();
    const hasEntries = await refreshEntries(reason);
    if (!hasEntries) {
      void logger.warn("Slideshow found no playable entries.", {
        reason,
        saveDirectoryPath: getPersistedSaveDirectory()
      });
      return;
    }

    void logger.info("Slideshow initialization complete.", { reason, count: entries.length });
    void playCurrentEntry(reason);
  } catch (error) {
    void logger.exception("Slideshow failed while loading videos.", error, {
      reason,
      saveDirectoryPath: getPersistedSaveDirectory()
    });
    entries = [];
    updateEmptyState(true, "Photobooth could not load videos from the gallery folder.");
  }
}

async function syncSlideshowState() {
  try {
    await loadDesktopPersistedSettings();
    const nextSettingsSignature = getSettingsSignature();
    const currentEntryKey = getEntryKey(getCurrentEntry());
    const nextEntries = await loadEntries();
    const nextEntriesSignature = getEntriesSignature(nextEntries);

    const settingsChanged = nextSettingsSignature !== lastSettingsSignature;
    const entriesChanged = nextEntriesSignature !== lastEntriesSignature;
    if (!settingsChanged && !entriesChanged) {
      return;
    }

    lastSettingsSignature = nextSettingsSignature;
    entries = nextEntries;
    if (currentEntryKey) {
      const matchingIndex = entries.findIndex((entry) => getEntryKey(entry) === currentEntryKey);
      currentIndex = matchingIndex >= 0 ? matchingIndex : 0;
    } else {
      currentIndex = 0;
    }
    clampIndex();
    lastEntriesSignature = nextEntriesSignature;

    void logger.info("Slideshow external window detected shared-state changes.", {
      settingsChanged,
      entriesChanged,
      count: entries.length,
      currentIndex,
      saveDirectoryPath: getPersistedSaveDirectory()
    });

    if (!entries.length) {
      clearVideoSource();
      updateEmptyState(true, "No videos are available in the gallery folder yet.");
      return;
    }

    await playCurrentEntry(settingsChanged ? "settings-sync" : "entries-sync");
  } catch (error) {
    void logger.warn("Slideshow shared-state sync failed.", {
      error: error instanceof Error ? error.message : String(error || "")
    });
  }
}

window.addEventListener("error", (event) => {
  void logger.exception("Unhandled slideshow window error.", event.error || event.message, {
    message: event.message || ""
  });
  updateEmptyState(true, "Photobooth hit an error while opening the slideshow.");
  clearTimers();
  clearVideoSource();
});

window.addEventListener("beforeunload", () => {
  clearTimers();
  clearVideoSource();
  if (settingsSyncIntervalId !== null) {
    window.clearInterval(settingsSyncIntervalId);
    settingsSyncIntervalId = null;
  }
});

document.getElementById("slideshowCloseButton")?.addEventListener("click", () => {
  window.close();
});

document.getElementById("slideshowVideo")?.addEventListener("ended", () => {
  void logger.debug("Slideshow video ended. Advancing to next entry.", {
    filename: getCurrentEntry()?.filename || "",
    currentIndex
  });
  void advanceSlideshow("ended", { skipCurrent: true });
});

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

void (async () => {
  await loadDesktopPersistedSettings();
  lastSettingsSignature = getSettingsSignature();
  void logger.info("Slideshow window bootstrap started.", {
    saveDirectoryPath: getPersistedSaveDirectory()
  });
  void setFullscreenState(true);
  await loadSlideshow();
  settingsSyncIntervalId = window.setInterval(() => {
    void syncSlideshowState();
  }, SETTINGS_SYNC_INTERVAL_MS);
})();
