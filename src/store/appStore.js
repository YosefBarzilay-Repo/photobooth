import { APP_DEFAULTS, APP_STRINGS } from "../constants/appConfig.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 */

/**
 * @returns {AppState}
 */
export default function createAppStore() {
  return {
    mode: APP_DEFAULTS.mode,
    operatorPanelOpen: false,
    galleryPanelOpen: false,
    galleryView: "videos",
    operatorReturnMode: APP_DEFAULTS.mode,
    saveDirectoryHandle: null,
    saveDirectoryPath: "",
    saveDirectoryName: APP_STRINGS.saveFolderDefault,
    isDesktopApp: false,
    isFullscreen: false,
    stream: null,
    recorder: null,
    recordingBlob: null,
    recordingUrl: "",
    recordingFilename: "",
    recordingPath: "",
    recordings: [],
    recordingChunks: [],
    captureReady: false,
    captureInProgress: false,
    isRecording: false,
    isSaving: false,
    shutterAnimatingOut: false,
    countdownSeconds: APP_DEFAULTS.countdownSeconds,
    recordingTimeoutSeconds: APP_DEFAULTS.recordingTimeoutSeconds,
    countdownValue: null,
    recordIntervalId: null,
    recordingTimeoutId: null,
    recordStartedAt: 0,
    captureOrientation: APP_DEFAULTS.captureOrientation,
    activeFrameId: APP_DEFAULTS.activeFrameId,
    activeOverlayTarget: APP_DEFAULTS.activeOverlayTarget,
    showTextColorPalette: APP_DEFAULTS.showTextColorPalette,
    draggingOverlayTarget: null,
    overlayInteraction: null,
    dragPointerId: null,
    dragStartPointer: null,
    dragSurfaceSize: null,
    dragStartPosition: null,
    dragStartScale: APP_DEFAULTS.logoScale,
    dragStartTextSize: APP_DEFAULTS.overlaySize,
    overlayText: APP_DEFAULTS.overlayText,
    overlayFont: APP_DEFAULTS.overlayFont,
    overlayColor: APP_DEFAULTS.overlayColor,
    overlaySize: APP_DEFAULTS.overlaySize,
    overlayTextPosition: { ...APP_DEFAULTS.overlayTextPosition },
    overlayTextRotation: APP_DEFAULTS.overlayTextRotation,
    logoDataUrl: APP_DEFAULTS.logoDataUrl,
    logoScale: APP_DEFAULTS.logoScale,
    logoRotation: APP_DEFAULTS.logoRotation,
    logoPosition: { ...APP_DEFAULTS.logoPosition },
    videoInputId: APP_DEFAULTS.videoInputId,
    audioInputId: APP_DEFAULTS.audioInputId
  };
}
