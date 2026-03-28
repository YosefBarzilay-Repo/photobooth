import { APP_DEFAULTS } from "../constants/appConfig.js";

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
    stream: null,
    recorder: null,
    recordingBlob: null,
    recordingUrl: "",
    recordingChunks: [],
    captureReady: false,
    captureInProgress: false,
    shutterAnimatingOut: false,
    countdownSeconds: APP_DEFAULTS.countdownSeconds,
    recordingDurationSeconds: APP_DEFAULTS.recordingDurationSeconds,
    recordIntervalId: null,
    recordStopTimeoutId: null,
    recordStartedAt: 0,
    activeFrameId: APP_DEFAULTS.activeFrameId,
    activeOverlayTarget: APP_DEFAULTS.activeOverlayTarget,
    draggingOverlayTarget: null,
    dragStartPointer: null,
    dragStartPosition: null,
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