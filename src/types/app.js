/**
 * @typedef {"camera" | "editor"} AppMode
 */

/**
 * @typedef {"none" | "zoom-in" | "zoom-out"} CameraEffect
 */

/**
 * @typedef {"none" | "classic" | "polaroid" | "film" | "neon" | "floral" | "minimal"} FrameId
 */

/**
 * @typedef {{ x: number, y: number }} Vector2
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
 *   cameraEffect: CameraEffect,
 *   cameraEffectSpeed: number,
 *   cameraEffectDirection: Vector2,
 *   settingEffectDirection: boolean,
 *   recordIntervalId: number | null,
 *   recordStopTimeoutId: number | null,
 *   recordStartedAt: number,
 *   activeFrameId: FrameId,
 *   overlayText: string,
 *   overlayFont: string,
 *   overlayColor: string,
 *   overlaySize: number
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
