/**
 * @typedef {"camera" | "editor"} AppMode
 */

/**
 * @typedef {"none" | "classic" | "polaroid" | "film" | "neon" | "floral" | "minimal"} FrameId
 */

/**
 * @typedef {{ x: number, y: number }} Vector2
 */

/**
 * @typedef {"text" | "logo" | null} OverlayTarget
 */

/**
 * @typedef {{
 *   mode: AppMode,
 *   operatorPanelOpen: boolean,
 *   stream: MediaStream | null,
 *   recorder: MediaRecorder | null,
 *   recordingBlob: Blob | null,
 *   recordingUrl: string,
 *   recordingChunks: Blob[],
 *   captureReady: boolean,
 *   captureInProgress: boolean,
 *   shutterAnimatingOut: boolean,
 *   countdownSeconds: number,
 *   recordingDurationSeconds: number,
 *   recordIntervalId: number | null,
 *   recordStopTimeoutId: number | null,
 *   recordStartedAt: number,
 *   activeFrameId: FrameId,
 *   activeOverlayTarget: OverlayTarget,
 *   draggingOverlayTarget: OverlayTarget,
 *   dragStartPointer: Vector2 | null,
 *   dragStartPosition: Vector2 | null,
 *   overlayText: string,
 *   overlayFont: string,
 *   overlayColor: string,
 *   overlaySize: number,
 *   overlayTextPosition: Vector2,
 *   overlayTextRotation: number,
 *   logoDataUrl: string,
 *   logoScale: number,
 *   logoRotation: number,
 *   logoPosition: Vector2
 * }} AppState
 */

/**
 * @typedef {{
 *   id: FrameId,
 *   name: string,
 *   accent: string
 * }} FrameDefinition
 */

export {};