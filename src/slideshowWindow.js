import { loadSavedRecordingsFromDirectory } from "./services/downloadService.js";
import {
  applyCurrentWindowDisplaySettings,
  convertDesktopFileSrc,
  invokeDesktop
} from "./services/desktopService.js";
import { logger } from "./services/logger.js";
import { loadDesktopPersistedSettings, loadPersistedSettings } from "./services/settingsPersistence.js";

const REFRESH_INTERVAL_MS = 3000;
const PLAYBACK_RETRY_DELAY_MS = 350;
const PLAYBACK_FATAL_RETRY_LIMIT = 4;

let slideshowEntries = [];
let slideshowIndex = 0;
let slideshowRefreshIntervalId = null;
let lastDirectoryPath = "";
let lastEntriesSignature = "";
let isTransitioning = false;
let hasAppliedWindowSettings = false;
let consecutivePlaybackFailures = 0;

function getVideoElement() {
  const video = document.getElementById("slideshowVideo");
  return video instanceof HTMLVideoElement ? video : null;
}

function getEmptyStateElements() {
  return {
    emptyState: document.getElementById("slideshowEmptyState"),
    emptyMessage: document.getElementById("slideshowEmptyState")?.querySelector("p")
  };
}

function getPersistedSettingsSnapshot() {
  const settings = loadPersistedSettings();
  return settings && typeof settings === "object" ? settings : {};
}

function getProjectDirectoryPath() {
  const argumentMatch = window.location.search.match(/[?&]project=([^&]+)/);
  if (argumentMatch?.[1]) {
    return decodeURIComponent(argumentMatch[1]).trim();
  }

  const settings = getPersistedSettingsSnapshot();
  return typeof settings.saveDirectoryPath === "string" ? settings.saveDirectoryPath.trim() : "";
}

function getFadeSettings() {
  const settings = getPersistedSettingsSnapshot();
  return {
    enabled: settings.slideshowFadeEnabled !== false,
    durationMs: Number.isFinite(settings.slideshowFadeDurationMs) ? Math.max(0, settings.slideshowFadeDurationMs) : 600
  };
}

function getSlideshowWindowSettings() {
  const settings = getPersistedSettingsSnapshot();
  return {
    fullscreen: settings.slideshowFullscreen !== false,
    monitorId: typeof settings.slideshowMonitorId === "string" ? settings.slideshowMonitorId.trim() : ""
  };
}

function getEntriesSignature(entries) {
  return entries
    .map((entry) => `${entry.path || ""}:${entry.modifiedAt || 0}`)
    .join("|");
}

function updateEmptyState(isEmpty, message = "No saved videos yet in this project.") {
  const video = getVideoElement();
  const { emptyState, emptyMessage } = getEmptyStateElements();
  emptyState?.classList.toggle("hidden", !isEmpty);
  video?.classList.toggle("hidden", isEmpty);
  if (emptyMessage) {
    emptyMessage.textContent = message;
  }
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

function stopRefreshLoop() {
  if (slideshowRefreshIntervalId !== null) {
    window.clearInterval(slideshowRefreshIntervalId);
    slideshowRefreshIntervalId = null;
  }
}

async function buildBlobSource(entry) {
  if (!entry?.path) {
    return "";
  }

  const bytes = await invokeDesktop("read_recording_file", { filePath: entry.path });
  const extension = String(entry.filename || "").toLowerCase();
  const mimeType = extension.endsWith(".mov")
    ? "video/quicktime"
    : extension.endsWith(".ogg")
      ? "video/ogg"
      : "video/mp4";
  const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType });
  return URL.createObjectURL(blob);
}

async function resolveEntrySource(entry) {
  const assetSource = entry?.path ? convertDesktopFileSrc(entry.path) : "";
  if (assetSource) {
    return assetSource;
  }

  return buildBlobSource(entry);
}

function normalizeIndex(index, length) {
  if (length <= 0) {
    return 0;
  }

  return ((index % length) + length) % length;
}

async function transitionVideo(video, callback) {
  const fade = getFadeSettings();
  video.style.transitionDuration = `${fade.enabled ? fade.durationMs : 0}ms`;

  if (fade.enabled && fade.durationMs > 0) {
    video.classList.add("is-fading");
    await new Promise((resolve) => window.setTimeout(resolve, fade.durationMs));
  }

  await callback();
  video.classList.remove("is-fading");
}

async function playSlideshowEntry(index, reason = "play") {
  if (isTransitioning) {
    return;
  }

  const video = getVideoElement();
  if (!video) {
    return;
  }

  if (slideshowEntries.length === 0) {
    clearVideoSource();
    updateEmptyState(true, "No saved videos yet in this project.");
    return;
  }

  slideshowIndex = normalizeIndex(index, slideshowEntries.length);
  const entry = slideshowEntries[slideshowIndex];
  let source = entry?.url || "";
  if (!source) {
    try {
      source = await resolveEntrySource(entry);
      entry.url = source;
    } catch (error) {
      void logger.warn("External slideshow failed to resolve a playable source.", {
        filename: entry?.filename || "",
        reason,
        error: error instanceof Error ? error.message : String(error || "")
      });
    }
  }

  if (!source) {
    void logger.warn("External slideshow skipped entry because no playable source was available.", {
      filename: entry?.filename || "",
      reason
    });
    if (slideshowEntries.length > 1) {
      window.setTimeout(() => {
        void playSlideshowEntry(slideshowIndex + 1, "missing-source");
      }, PLAYBACK_RETRY_DELAY_MS);
    }
    return;
  }

  isTransitioning = true;
  try {
    await transitionVideo(video, async () => {
      video.pause();
      video.src = source;
      video.currentTime = 0;
      video.loop = false;
      video.muted = true;
      video.defaultMuted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.preload = "auto";
      video.load();
      updateEmptyState(false);
      await video.play();
    });
    consecutivePlaybackFailures = 0;
    document.body.classList.remove("slideshow-booting");
    document.body.classList.add("slideshow-ready");

    if (!hasAppliedWindowSettings) {
      hasAppliedWindowSettings = true;
      const windowSettings = getSlideshowWindowSettings();
      void applyCurrentWindowDisplaySettings(windowSettings).catch((error) => {
        void logger.warn("External slideshow fullscreen activation failed.", {
          error: error instanceof Error ? error.message : String(error || "")
        });
      });
    }

    void logger.info("External slideshow started playback.", {
      filename: entry.filename,
      filePath: entry.path,
      index: slideshowIndex,
      totalEntries: slideshowEntries.length,
      reason
    });
  } catch (error) {
    consecutivePlaybackFailures += 1;
    void logger.warn("External slideshow playback failed. Advancing to next video.", {
      filename: entry?.filename || "",
      reason,
      error: error instanceof Error ? error.message : String(error || ""),
      consecutivePlaybackFailures
    });

    if (consecutivePlaybackFailures >= PLAYBACK_FATAL_RETRY_LIMIT) {
      updateEmptyState(true, "Photobooth could not play the external slideshow.");
      window.setTimeout(() => {
        window.close();
      }, 1200);
    } else {
      window.setTimeout(() => {
        void playSlideshowEntry(slideshowIndex + 1, "play-error");
      }, PLAYBACK_RETRY_DELAY_MS);
    }
  } finally {
    isTransitioning = false;
  }
}

async function refreshSlideshowEntries(reason = "refresh") {
  await loadDesktopPersistedSettings();
  const projectDirectoryPath = getProjectDirectoryPath();
  if (!projectDirectoryPath) {
    slideshowEntries = [];
    slideshowIndex = 0;
    lastDirectoryPath = "";
    lastEntriesSignature = "";
    clearVideoSource();
    updateEmptyState(true, "Choose a project to start the external slideshow.");
    return;
  }

  const nextEntries = await loadSavedRecordingsFromDirectory(projectDirectoryPath);
  const nextEntriesSignature = getEntriesSignature(nextEntries);
  const directoryChanged = projectDirectoryPath !== lastDirectoryPath;
  const entriesChanged = nextEntriesSignature !== lastEntriesSignature;
  if (!directoryChanged && !entriesChanged) {
    return;
  }

  const currentEntryPath = slideshowEntries[slideshowIndex]?.path || "";
  slideshowEntries = nextEntries;
  lastDirectoryPath = projectDirectoryPath;
  lastEntriesSignature = nextEntriesSignature;

  if (slideshowEntries.length === 0) {
    slideshowIndex = 0;
    clearVideoSource();
    updateEmptyState(true, "No saved videos yet in this project.");
    void logger.info("External slideshow found no project videos.", { reason, projectDirectoryPath });
    return;
  }

  const matchingIndex = currentEntryPath
    ? slideshowEntries.findIndex((entry) => entry.path === currentEntryPath)
    : -1;
  slideshowIndex = matchingIndex >= 0 ? matchingIndex : 0;

  void logger.info("External slideshow refreshed project videos.", {
    reason,
    projectDirectoryPath,
    count: slideshowEntries.length,
    directoryChanged,
    entriesChanged
  });

  await playSlideshowEntry(slideshowIndex, directoryChanged ? "project-change" : "entries-change");
}

async function bootstrapExternalSlideshow() {
  updateEmptyState(true, "Loading project videos...");

  try {
    await loadDesktopPersistedSettings();
    await applyCurrentWindowDisplaySettings(getSlideshowWindowSettings());
    hasAppliedWindowSettings = true;
  } catch (error) {
    void logger.warn("External slideshow settings preload failed.", {
      error: error instanceof Error ? error.message : String(error || "")
    });
  }

  try {
    await refreshSlideshowEntries("initial-load");
  } catch (error) {
    void logger.exception("External slideshow failed during bootstrap.", error, {
      projectDirectoryPath: getProjectDirectoryPath()
    });
    clearVideoSource();
    updateEmptyState(true, "Photobooth could not open the external slideshow.");
  }

  stopRefreshLoop();
  slideshowRefreshIntervalId = window.setInterval(() => {
    void refreshSlideshowEntries("interval-refresh");
  }, REFRESH_INTERVAL_MS);
}

window.addEventListener("beforeunload", () => {
  stopRefreshLoop();
  clearVideoSource();
});

window.addEventListener("error", (event) => {
  void logger.exception("Unhandled external slideshow error.", event.error || event.message, {
    message: event.message || ""
  });
  clearVideoSource();
  updateEmptyState(true, "Photobooth hit an error while opening the external slideshow.");
});

document.addEventListener("contextmenu", (event) => {
  event.preventDefault();
});

document.getElementById("slideshowVideo")?.addEventListener("ended", () => {
  void playSlideshowEntry(slideshowIndex + 1, "ended");
});

document.getElementById("slideshowVideo")?.addEventListener("error", () => {
  void playSlideshowEntry(slideshowIndex + 1, "video-error");
});

document.body.classList.add("slideshow-booting");
void bootstrapExternalSlideshow();
