/**
 * @typedef {import("../types/app.js").AppState} AppState
 */

import { getDesktopAppDataDirectory, invokeDesktop, isDesktopApp } from "./desktopService.js";
import { logger } from "./logger.js";
import { createLogoOverlay, createTextOverlay, syncActiveOverlayState } from "../utils/overlayState.js";

const STORAGE_KEY = "photobooth.appData.v2";
const LEGACY_STORAGE_KEY = "photobooth.operatorSettings.v1";
const PROJECT_STORAGE_KEY_PREFIX = "photobooth.projectSettings";
const APP_DATA_FILENAME = "app-data.json";
const PROJECT_APP_DATA_FILENAME = ".photobooth-project-settings.json";
const APP_DATA_VERSION = 2;
let desktopAppDataDirectoryPromise = null;

async function getDesktopAppDataDirectoryPath() {
  if (!isDesktopApp()) {
    return "";
  }

  if (!desktopAppDataDirectoryPromise) {
    desktopAppDataDirectoryPromise = getDesktopAppDataDirectory().catch((error) => {
      desktopAppDataDirectoryPromise = null;
      throw error;
    });
  }

  return desktopAppDataDirectoryPromise;
}

async function getDesktopAppDataFilePath() {
  const directoryPath = await getDesktopAppDataDirectoryPath();
  return directoryPath ? `${directoryPath}\\${APP_DATA_FILENAME}` : "";
}

function getProjectSettingsStorageKey(projectPath) {
  return `${PROJECT_STORAGE_KEY_PREFIX}.${String(projectPath || "").trim().toLowerCase()}`;
}

function getProjectAppDataFilePath(projectPath) {
  const normalizedProjectPath = String(projectPath || "").trim().replace(/[\\/]+$/, "");
  return normalizedProjectPath ? `${normalizedProjectPath}\\${PROJECT_APP_DATA_FILENAME}` : "";
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneVector(value, fallback) {
  if (!isObject(value)) {
    return { ...fallback };
  }

  const x = Number(value.x);
  const y = Number(value.y);
  return {
    x: Number.isFinite(x) ? x : fallback.x,
    y: Number.isFinite(y) ? y : fallback.y
  };
}

function normalizeOverlayList(overlays) {
  if (!Array.isArray(overlays)) {
    return [];
  }

  return overlays
    .map((overlay) => {
      if (!isObject(overlay)) {
        return null;
      }

      if (overlay.type === "logo") {
        return createLogoOverlay({
          id: overlay.id,
          dataUrl: overlay.dataUrl,
          scale: overlay.scale,
          position: overlay.position,
          rotation: overlay.rotation
        });
      }

      if (overlay.type === "text") {
        return createTextOverlay({
          id: overlay.id,
          text: overlay.text,
          font: overlay.font,
          color: overlay.color,
          size: overlay.size,
          position: overlay.position,
          rotation: overlay.rotation
        });
      }

      return null;
    })
    .filter(Boolean);
}

function normalizePersistedSettings(savedSettings, defaults) {
  if (!isObject(savedSettings)) {
    return null;
  }

  return {
    countdownSeconds: Number.isFinite(savedSettings.countdownSeconds) ? savedSettings.countdownSeconds : defaults.countdownSeconds,
    recordingTimeoutSeconds: Number.isFinite(savedSettings.recordingTimeoutSeconds)
      ? savedSettings.recordingTimeoutSeconds
      : defaults.recordingTimeoutSeconds,
    captureOrientation: savedSettings.captureOrientation === "portrait" ? "portrait" : defaults.captureOrientation,
    activeFrameId: typeof savedSettings.activeFrameId === "string" ? savedSettings.activeFrameId : defaults.activeFrameId,
    overlays: normalizeOverlayList(savedSettings.overlays),
    overlayText: typeof savedSettings.overlayText === "string" ? savedSettings.overlayText : defaults.overlayText,
    overlayFont: typeof savedSettings.overlayFont === "string" ? savedSettings.overlayFont : defaults.overlayFont,
    overlayColor: typeof savedSettings.overlayColor === "string" ? savedSettings.overlayColor : defaults.overlayColor,
    overlaySize: Number.isFinite(savedSettings.overlaySize) ? savedSettings.overlaySize : defaults.overlaySize,
    overlayTextPosition: cloneVector(savedSettings.overlayTextPosition, defaults.overlayTextPosition),
    overlayTextRotation: Number.isFinite(savedSettings.overlayTextRotation) ? savedSettings.overlayTextRotation : defaults.overlayTextRotation,
    logoDataUrl: typeof savedSettings.logoDataUrl === "string" ? savedSettings.logoDataUrl : defaults.logoDataUrl,
    logoScale: Number.isFinite(savedSettings.logoScale) ? savedSettings.logoScale : defaults.logoScale,
    logoRotation: Number.isFinite(savedSettings.logoRotation) ? savedSettings.logoRotation : defaults.logoRotation,
    logoPosition: cloneVector(savedSettings.logoPosition, defaults.logoPosition),
    slideshowMode: savedSettings.slideshowMode === "external" ? "external" : defaults.slideshowMode,
    slideshowSoundEnabled: typeof savedSettings.slideshowSoundEnabled === "boolean"
      ? savedSettings.slideshowSoundEnabled
      : defaults.slideshowSoundEnabled,
    slideshowAudioOutputId: typeof savedSettings.slideshowAudioOutputId === "string"
      ? savedSettings.slideshowAudioOutputId
      : defaults.slideshowAudioOutputId,
    slideshowFadeEnabled: typeof savedSettings.slideshowFadeEnabled === "boolean"
      ? savedSettings.slideshowFadeEnabled
      : defaults.slideshowFadeEnabled,
    slideshowFadeDurationMs: Number.isFinite(savedSettings.slideshowFadeDurationMs)
      ? Math.max(0, savedSettings.slideshowFadeDurationMs)
      : defaults.slideshowFadeDurationMs,
    mainWindowMonitorId: typeof savedSettings.mainWindowMonitorId === "string"
      ? savedSettings.mainWindowMonitorId
      : defaults.mainWindowMonitorId,
    mainWindowFullscreen: typeof savedSettings.mainWindowFullscreen === "boolean"
      ? savedSettings.mainWindowFullscreen
      : defaults.mainWindowFullscreen,
    slideshowMonitorId: typeof savedSettings.slideshowMonitorId === "string"
      ? savedSettings.slideshowMonitorId
      : defaults.slideshowMonitorId,
    slideshowFullscreen: typeof savedSettings.slideshowFullscreen === "boolean"
      ? savedSettings.slideshowFullscreen
      : defaults.slideshowFullscreen,
    saveDirectoryPath: typeof savedSettings.saveDirectoryPath === "string" ? savedSettings.saveDirectoryPath : "",
    saveDirectoryName: typeof savedSettings.saveDirectoryName === "string" && savedSettings.saveDirectoryName.trim()
      ? savedSettings.saveDirectoryName
      : defaults.saveFolderDefault,
    activeProjectPath: typeof savedSettings.activeProjectPath === "string" ? savedSettings.activeProjectPath : "",
    videoInputId: typeof savedSettings.videoInputId === "string" ? savedSettings.videoInputId : defaults.videoInputId,
    audioInputId: typeof savedSettings.audioInputId === "string" ? savedSettings.audioInputId : defaults.audioInputId
  };
}

function parsePayload(raw) {
  const parsed = JSON.parse(raw);
  if (!isObject(parsed)) {
    return null;
  }

  const settings = isObject(parsed.settings) ? parsed.settings : parsed;
  if (!isObject(settings)) {
    return null;
  }

  return {
    version: parsed.version,
    settings,
    activeProjectPath: typeof parsed.activeProjectPath === "string" ? parsed.activeProjectPath : settings.activeProjectPath,
    saveDirectoryPath: typeof parsed.saveDirectoryPath === "string" ? parsed.saveDirectoryPath : settings.saveDirectoryPath,
    saveDirectoryName: typeof parsed.saveDirectoryName === "string" ? parsed.saveDirectoryName : settings.saveDirectoryName,
    projectPath: typeof parsed.projectPath === "string" ? parsed.projectPath : ""
  };
}

function serializeStateSettings(state) {
  return {
    countdownSeconds: state.countdownSeconds,
    recordingTimeoutSeconds: state.recordingTimeoutSeconds,
    captureOrientation: state.captureOrientation,
    activeFrameId: state.activeFrameId,
    overlays: state.overlays,
    overlayText: state.overlayText,
    overlayFont: state.overlayFont,
    overlayColor: state.overlayColor,
    overlaySize: state.overlaySize,
    overlayTextPosition: state.overlayTextPosition,
    overlayTextRotation: state.overlayTextRotation,
    logoDataUrl: state.logoDataUrl,
    logoScale: state.logoScale,
    logoRotation: state.logoRotation,
    logoPosition: state.logoPosition,
    slideshowMode: state.slideshowMode,
    slideshowSoundEnabled: state.slideshowSoundEnabled,
    slideshowAudioOutputId: state.slideshowAudioOutputId,
    slideshowFadeEnabled: state.slideshowFadeEnabled,
    slideshowFadeDurationMs: state.slideshowFadeDurationMs,
    mainWindowMonitorId: state.mainWindowMonitorId,
    mainWindowFullscreen: state.mainWindowFullscreen,
    slideshowMonitorId: state.slideshowMonitorId,
    slideshowFullscreen: state.slideshowFullscreen,
    saveDirectoryPath: state.saveDirectoryPath,
    saveDirectoryName: state.saveDirectoryName,
    activeProjectPath: state.activeProjectPath,
    videoInputId: state.videoInputId,
    audioInputId: state.audioInputId
  };
}

function buildSnapshot(settings, extras = {}) {
  return {
    version: APP_DATA_VERSION,
    settings,
    ...extras
  };
}

function applyLoadedSelection(loadedSettings, parsedPayload) {
  if (!loadedSettings || !parsedPayload) {
    return loadedSettings;
  }

  return {
    ...loadedSettings,
    activeProjectPath: typeof parsedPayload.activeProjectPath === "string" ? parsedPayload.activeProjectPath : loadedSettings.activeProjectPath,
    saveDirectoryPath: typeof parsedPayload.saveDirectoryPath === "string" ? parsedPayload.saveDirectoryPath : loadedSettings.saveDirectoryPath,
    saveDirectoryName: typeof parsedPayload.saveDirectoryName === "string" ? parsedPayload.saveDirectoryName : loadedSettings.saveDirectoryName
  };
}

function readLocalPayload(storageKey) {
  const raw = window.localStorage.getItem(storageKey);
  return raw ? parsePayload(raw) : null;
}

function writeLocalPayload(storageKey, payload) {
  window.localStorage.setItem(storageKey, JSON.stringify(payload));
}

async function readDesktopPayload(filePath) {
  if (!filePath) {
    return null;
  }

  const raw = await invokeDesktop("read_text_file", { filePath });
  if (!raw.trim()) {
    return null;
  }

  return parsePayload(raw);
}

async function writeDesktopPayload(filePath, payload) {
  if (!filePath) {
    return;
  }

  await invokeDesktop("write_text_file", {
    filePath,
    text: JSON.stringify(payload, null, 2)
  });
}

export function loadPersistedSettings(projectPath = "") {
  try {
    const normalizedProjectPath = String(projectPath || "").trim();
    const parsedPayload = normalizedProjectPath
      ? readLocalPayload(getProjectSettingsStorageKey(normalizedProjectPath))
      : readLocalPayload(STORAGE_KEY) || readLocalPayload(LEGACY_STORAGE_KEY);

    if (!parsedPayload) {
      void logger.debug("No persisted operator settings found.", { projectPath: normalizedProjectPath });
      return null;
    }

    const loadedSettings = applyLoadedSelection(parsedPayload.settings, parsedPayload);
    void logger.info("Loaded persisted operator settings.", {
      projectPath: normalizedProjectPath,
      hasSaveDirectoryPath: typeof loadedSettings.saveDirectoryPath === "string" && loadedSettings.saveDirectoryPath.length > 0
    });
    return loadedSettings;
  } catch (error) {
    void logger.exception("Failed to load persisted operator settings.", error, { projectPath });
    return null;
  }
}

export async function loadDesktopPersistedSettings(projectPath = "") {
  const normalizedProjectPath = String(projectPath || "").trim();

  if (!isDesktopApp()) {
    return loadPersistedSettings(normalizedProjectPath);
  }

  try {
    const filePath = normalizedProjectPath
      ? getProjectAppDataFilePath(normalizedProjectPath)
      : await getDesktopAppDataFilePath();
    const parsedPayload = await readDesktopPayload(filePath);
    if (!parsedPayload) {
      return null;
    }

    const loadedSettings = applyLoadedSelection(parsedPayload.settings, parsedPayload);
    const localStorageKey = normalizedProjectPath ? getProjectSettingsStorageKey(normalizedProjectPath) : STORAGE_KEY;
    writeLocalPayload(localStorageKey, buildSnapshot(parsedPayload.settings, {
      activeProjectPath: parsedPayload.activeProjectPath,
      saveDirectoryPath: parsedPayload.saveDirectoryPath,
      saveDirectoryName: parsedPayload.saveDirectoryName,
      projectPath: parsedPayload.projectPath
    }));
    return loadedSettings;
  } catch (error) {
    void logger.warn("Desktop persisted settings load failed.", {
      projectPath: normalizedProjectPath,
      error: error instanceof Error ? error.message : String(error || "")
    });
    return null;
  }
}

export function applyPersistedSettings(state, defaults, savedSettings) {
  const normalizedSettings = normalizePersistedSettings(savedSettings, defaults);
  if (!normalizedSettings) {
    return;
  }

  state.countdownSeconds = normalizedSettings.countdownSeconds;
  state.recordingTimeoutSeconds = normalizedSettings.recordingTimeoutSeconds;
  state.captureOrientation = normalizedSettings.captureOrientation;
  state.activeFrameId = normalizedSettings.activeFrameId;
  state.overlays = normalizedSettings.overlays;
  state.overlayText = normalizedSettings.overlayText;
  state.overlayFont = normalizedSettings.overlayFont;
  state.overlayColor = normalizedSettings.overlayColor;
  state.overlaySize = normalizedSettings.overlaySize;
  state.overlayTextPosition = normalizedSettings.overlayTextPosition;
  state.overlayTextRotation = normalizedSettings.overlayTextRotation;
  state.logoDataUrl = normalizedSettings.logoDataUrl;
  state.logoScale = normalizedSettings.logoScale;
  state.logoRotation = normalizedSettings.logoRotation;
  state.logoPosition = normalizedSettings.logoPosition;
  state.slideshowMode = normalizedSettings.slideshowMode;
  state.slideshowSoundEnabled = normalizedSettings.slideshowSoundEnabled;
  state.slideshowAudioOutputId = normalizedSettings.slideshowAudioOutputId;
  state.slideshowFadeEnabled = normalizedSettings.slideshowFadeEnabled;
  state.slideshowFadeDurationMs = normalizedSettings.slideshowFadeDurationMs;
  state.mainWindowMonitorId = normalizedSettings.mainWindowMonitorId;
  state.mainWindowFullscreen = normalizedSettings.mainWindowFullscreen;
  state.slideshowMonitorId = normalizedSettings.slideshowMonitorId;
  state.slideshowFullscreen = normalizedSettings.slideshowFullscreen;
  state.saveDirectoryPath = normalizedSettings.saveDirectoryPath;
  state.saveDirectoryName = normalizedSettings.saveDirectoryName;
  state.activeProjectPath = normalizedSettings.activeProjectPath;
  state.videoInputId = normalizedSettings.videoInputId;
  state.audioInputId = normalizedSettings.audioInputId;

  if (state.overlays.length === 0) {
    if (state.logoDataUrl) {
      state.overlays.push(createLogoOverlay({
        dataUrl: state.logoDataUrl,
        scale: state.logoScale,
        position: state.logoPosition,
        rotation: state.logoRotation
      }));
    }

    if (state.overlayText) {
      state.overlays.push(createTextOverlay({
        text: state.overlayText,
        font: state.overlayFont,
        color: state.overlayColor,
        size: state.overlaySize,
        position: state.overlayTextPosition,
        rotation: state.overlayTextRotation
      }));
    }
  }

  syncActiveOverlayState(state);
}

export function persistSettings(state) {
  const settings = serializeStateSettings(state);
  const globalExtras = {
    activeProjectPath: state.activeProjectPath,
    saveDirectoryPath: state.saveDirectoryPath,
    saveDirectoryName: state.saveDirectoryName
  };

  try {
    const globalPayload = (() => {
      if (!state.activeProjectPath) {
        return buildSnapshot(settings, globalExtras);
      }

      const existingPayload = readLocalPayload(STORAGE_KEY) || readLocalPayload(LEGACY_STORAGE_KEY);
      return buildSnapshot(existingPayload?.settings || settings, globalExtras);
    })();

    writeLocalPayload(STORAGE_KEY, globalPayload);

    if (state.activeProjectPath) {
      const projectPayload = buildSnapshot(settings, {
        projectPath: state.activeProjectPath,
        activeProjectPath: state.activeProjectPath,
        saveDirectoryPath: state.saveDirectoryPath,
        saveDirectoryName: state.saveDirectoryName
      });
      writeLocalPayload(getProjectSettingsStorageKey(state.activeProjectPath), projectPayload);
    }

    if (isDesktopApp()) {
      void (async () => {
        const globalFilePath = await getDesktopAppDataFilePath();
        await writeDesktopPayload(globalFilePath, globalPayload);

        if (state.activeProjectPath) {
          await writeDesktopPayload(
            getProjectAppDataFilePath(state.activeProjectPath),
            buildSnapshot(settings, {
              projectPath: state.activeProjectPath,
              activeProjectPath: state.activeProjectPath,
              saveDirectoryPath: state.saveDirectoryPath,
              saveDirectoryName: state.saveDirectoryName
            })
          );
        }
      })().catch((error) => {
        void logger.warn("Desktop persisted settings save failed.", {
          activeProjectPath: state.activeProjectPath,
          error: error instanceof Error ? error.message : String(error || "")
        });
      });
    }

    void logger.debug("Persisted operator settings.", {
      saveDirectoryPath: state.saveDirectoryPath,
      saveDirectoryName: state.saveDirectoryName,
      activeProjectPath: state.activeProjectPath
    });
  } catch (error) {
    void logger.exception("Failed to persist operator settings.", error);
  }
}

function normalizeProjectMetadata(payload = {}) {
  return {
    orderId: typeof payload.orderId === "string" ? payload.orderId.trim() : "",
    clientName: typeof payload.clientName === "string" ? payload.clientName.trim() : "",
    projectDate: typeof payload.projectDate === "string" ? payload.projectDate.trim() : "",
    projectStatus: typeof payload.projectStatus === "string" ? payload.projectStatus.trim() : "New",
    phone: typeof payload.phone === "string" ? payload.phone.trim() : "",
    email: typeof payload.email === "string" ? payload.email.trim() : "",
    address: typeof payload.address === "string" ? payload.address.trim() : "",
    notes: typeof payload.notes === "string" ? payload.notes.trim() : ""
  };
}

function getProjectMetadataStorageKey(projectPath) {
  return `photobooth.projectMetadata.${String(projectPath || "").trim().toLowerCase()}`;
}

export async function loadProjectMetadata(projectPath) {
  if (!String(projectPath || "").trim()) {
    return normalizeProjectMetadata();
  }

  try {
    if (isDesktopApp()) {
      return normalizeProjectMetadata(await invokeDesktop("get_project_metadata", { projectPath }));
    }

    const raw = window.localStorage.getItem(getProjectMetadataStorageKey(projectPath));
    return raw ? normalizeProjectMetadata(JSON.parse(raw)) : normalizeProjectMetadata();
  } catch (error) {
    void logger.warn("Project metadata load failed. Falling back to defaults.", {
      projectPath,
      error: error instanceof Error ? error.message : String(error || "")
    });
    return normalizeProjectMetadata();
  }
}

export async function saveProjectMetadata(projectPath, metadata) {
  const normalizedMetadata = normalizeProjectMetadata(metadata);
  if (!String(projectPath || "").trim()) {
    throw new Error("Photobooth could not find the selected project folder.");
  }

  const payload = JSON.stringify(normalizedMetadata, null, 2);

  if (isDesktopApp()) {
    await invokeDesktop("save_project_metadata", { projectPath, metadata: normalizedMetadata });
  } else {
    window.localStorage.setItem(getProjectMetadataStorageKey(projectPath), payload);
  }

  void logger.info("Project metadata saved.", {
    projectPath,
    hasOrderId: Boolean(normalizedMetadata.orderId),
    hasClientName: Boolean(normalizedMetadata.clientName)
  });
}
