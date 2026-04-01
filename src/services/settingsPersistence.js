/**
 * @typedef {import("../types/app.js").AppState} AppState
 */

import { invokeDesktop, isDesktopApp } from "./desktopService.js";
import { logger } from "./logger.js";

const STORAGE_KEY = "photobooth.appData.v2";
const LEGACY_STORAGE_KEY = "photobooth.operatorSettings.v1";
const PROJECT_METADATA_FILENAME = "booking.json";
const APP_DATA_VERSION = 2;

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

export function loadPersistedSettings() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      void logger.debug("No persisted operator settings found.");
      return null;
    }

    const parsed = JSON.parse(raw);
    const settings = isObject(parsed?.settings) ? parsed.settings : parsed;
    void logger.info("Loaded persisted operator settings.", {
      hasSaveDirectoryPath: typeof settings?.saveDirectoryPath === "string" && settings.saveDirectoryPath.length > 0
    });
    return isObject(settings) ? settings : null;
  } catch (error) {
    void logger.exception("Failed to load persisted operator settings.", error);
    return null;
  }
}

export function applyPersistedSettings(state, defaults, savedSettings) {
  if (!isObject(savedSettings)) {
    return;
  }

  state.countdownSeconds = Number.isFinite(savedSettings.countdownSeconds) ? savedSettings.countdownSeconds : defaults.countdownSeconds;
  state.recordingTimeoutSeconds = Number.isFinite(savedSettings.recordingTimeoutSeconds)
    ? savedSettings.recordingTimeoutSeconds
    : defaults.recordingTimeoutSeconds;
  state.captureOrientation = savedSettings.captureOrientation === "portrait" ? "portrait" : defaults.captureOrientation;
  state.activeFrameId = typeof savedSettings.activeFrameId === "string" ? savedSettings.activeFrameId : defaults.activeFrameId;
  state.overlayText = typeof savedSettings.overlayText === "string" ? savedSettings.overlayText : defaults.overlayText;
  state.overlayFont = typeof savedSettings.overlayFont === "string" ? savedSettings.overlayFont : defaults.overlayFont;
  state.overlayColor = typeof savedSettings.overlayColor === "string" ? savedSettings.overlayColor : defaults.overlayColor;
  state.overlaySize = Number.isFinite(savedSettings.overlaySize) ? savedSettings.overlaySize : defaults.overlaySize;
  state.overlayTextPosition = cloneVector(savedSettings.overlayTextPosition, defaults.overlayTextPosition);
  state.overlayTextRotation = Number.isFinite(savedSettings.overlayTextRotation) ? savedSettings.overlayTextRotation : defaults.overlayTextRotation;
  state.logoDataUrl = typeof savedSettings.logoDataUrl === "string" ? savedSettings.logoDataUrl : defaults.logoDataUrl;
  state.logoScale = Number.isFinite(savedSettings.logoScale) ? savedSettings.logoScale : defaults.logoScale;
  state.logoRotation = Number.isFinite(savedSettings.logoRotation) ? savedSettings.logoRotation : defaults.logoRotation;
  state.logoPosition = cloneVector(savedSettings.logoPosition, defaults.logoPosition);
  state.saveDirectoryPath = typeof savedSettings.saveDirectoryPath === "string" ? savedSettings.saveDirectoryPath : "";
  state.saveDirectoryName = typeof savedSettings.saveDirectoryName === "string" && savedSettings.saveDirectoryName.trim()
    ? savedSettings.saveDirectoryName
    : defaults.saveFolderDefault;
  state.videoInputId = typeof savedSettings.videoInputId === "string" ? savedSettings.videoInputId : defaults.videoInputId;
  state.audioInputId = typeof savedSettings.audioInputId === "string" ? savedSettings.audioInputId : defaults.audioInputId;

  if (state.overlayText) {
    state.activeOverlayTarget = "text";
  } else if (state.logoDataUrl) {
    state.activeOverlayTarget = "logo";
  } else {
    state.activeOverlayTarget = defaults.activeOverlayTarget;
  }
}

export function persistSettings(state) {
  const snapshot = {
    version: APP_DATA_VERSION,
    settings: {
      countdownSeconds: state.countdownSeconds,
      recordingTimeoutSeconds: state.recordingTimeoutSeconds,
      captureOrientation: state.captureOrientation,
      activeFrameId: state.activeFrameId,
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
      saveDirectoryPath: state.saveDirectoryPath,
      saveDirectoryName: state.saveDirectoryName,
      videoInputId: state.videoInputId,
      audioInputId: state.audioInputId
    }
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    void logger.debug("Persisted operator settings.", {
      saveDirectoryPath: snapshot.settings.saveDirectoryPath,
      saveDirectoryName: snapshot.settings.saveDirectoryName
    });
  } catch (error) {
    void logger.exception("Failed to persist operator settings.", error);
  }
}

function normalizeProjectMetadata(payload = {}) {
  return {
    orderId: typeof payload.orderId === "string" ? payload.orderId.trim() : "",
    clientName: typeof payload.clientName === "string" ? payload.clientName.trim() : "",
    phone: typeof payload.phone === "string" ? payload.phone.trim() : "",
    email: typeof payload.email === "string" ? payload.email.trim() : "",
    address: typeof payload.address === "string" ? payload.address.trim() : "",
    notes: typeof payload.notes === "string" ? payload.notes.trim() : ""
  };
}

function getProjectMetadataPath(projectPath) {
  const normalizedProjectPath = String(projectPath || "").trim().replace(/[\\/]+$/, "");
  if (!normalizedProjectPath) {
    return "";
  }

  return `${normalizedProjectPath}\\${PROJECT_METADATA_FILENAME}`;
}

function getProjectMetadataStorageKey(projectPath) {
  return `photobooth.projectMetadata.${String(projectPath || "").trim().toLowerCase()}`;
}

export async function loadProjectMetadata(projectPath) {
  const metadataPath = getProjectMetadataPath(projectPath);
  if (!metadataPath) {
    return normalizeProjectMetadata();
  }

  try {
    if (isDesktopApp()) {
      const raw = await invokeDesktop("read_text_file", { filePath: metadataPath });
      if (!raw.trim()) {
        return normalizeProjectMetadata();
      }

      return normalizeProjectMetadata(JSON.parse(raw));
    }

    const raw = window.localStorage.getItem(getProjectMetadataStorageKey(projectPath));
    return raw ? normalizeProjectMetadata(JSON.parse(raw)) : normalizeProjectMetadata();
  } catch (error) {
    void logger.warn("Project metadata load failed. Falling back to defaults.", {
      projectPath,
      metadataPath,
      error: error instanceof Error ? error.message : String(error || "")
    });
    return normalizeProjectMetadata();
  }
}

export async function saveProjectMetadata(projectPath, metadata) {
  const normalizedMetadata = normalizeProjectMetadata(metadata);
  const metadataPath = getProjectMetadataPath(projectPath);
  if (!metadataPath) {
    throw new Error("Photobooth could not find the selected project folder.");
  }

  const payload = JSON.stringify(normalizedMetadata, null, 2);

  if (isDesktopApp()) {
    await invokeDesktop("write_text_file", { filePath: metadataPath, text: payload });
  } else {
    window.localStorage.setItem(getProjectMetadataStorageKey(projectPath), payload);
  }

  void logger.info("Project metadata saved.", {
    projectPath,
    metadataPath,
    hasOrderId: Boolean(normalizedMetadata.orderId),
    hasClientName: Boolean(normalizedMetadata.clientName)
  });
}
