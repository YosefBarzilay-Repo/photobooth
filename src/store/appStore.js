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
    saveDirectoryHandle: null,
    saveDirectoryName: APP_STRINGS.saveFolderDefault,
    stream: null,
    recorder: null,
    recordingBlob: null,
    recordingUrl: "",
    recordingFilename: "",
    recordings: [],
    recordingChunks: [],
    captureReady: false,
    captureInProgress: false,
    isRecording: false,
    shutterAnimatingOut: false,
    countdownSeconds: APP_DEFAULTS.countdownSeconds,
    countdownValue: null,
    slideshowIdleSeconds: APP_DEFAULTS.slideshowIdleSeconds,
    idleTimeoutId: null,
    slideshowIndex: 0,
    recordIntervalId: null,
    recordStartedAt: 0,
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
    logoPosition: { ...APP_DEFAULTS.logoPosition }
  };
}
