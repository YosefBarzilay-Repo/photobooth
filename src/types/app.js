/**
 * @typedef {"camera" | "editor" | "slideshow"} AppMode
 */

/**
 * @typedef {"none" | "classic" | "polaroid" | "film" | "neon" | "floral" | "minimal"} FrameId
 */

/**
 * @typedef {{ x: number, y: number }} Vector2
 */

/**
 * @typedef {{ url: string, blob: Blob, filename: string }} RecordingEntry
 */

/**
 * @typedef {"text" | "logo" | null} OverlayTarget
 */

/**
 * @typedef {"move" | "resize" | null} OverlayInteraction
 */

/**
 * @typedef {{
 *   mode: AppMode,
 *   operatorPanelOpen: boolean,
 *   saveDirectoryHandle: FileSystemDirectoryHandle | null,
 *   saveDirectoryName: string,
 *   stream: MediaStream | null,
 *   recorder: MediaRecorder | null,
 *   recordingBlob: Blob | null,
 *   recordingUrl: string,
 *   recordingFilename: string,
 *   recordings: RecordingEntry[],
 *   recordingChunks: Blob[],
 *   captureReady: boolean,
 *   captureInProgress: boolean,
 *   isRecording: boolean,
 *   shutterAnimatingOut: boolean,
 *   countdownSeconds: number,
 *   countdownValue: number | null,
 *   slideshowIdleSeconds: number,
 *   idleTimeoutId: number | null,
 *   slideshowIndex: number,
 *   recordIntervalId: number | null,
 *   recordStartedAt: number,
 *   activeFrameId: FrameId,
 *   activeOverlayTarget: OverlayTarget,
 *   showTextColorPalette: boolean,
 *   draggingOverlayTarget: OverlayTarget,
 *   overlayInteraction: OverlayInteraction,
 *   dragPointerId: number | null,
 *   dragStartPointer: Vector2 | null,
 *   dragSurfaceSize: Vector2 | null,
 *   dragStartPosition: Vector2 | null,
 *   dragStartScale: number,
 *   dragStartTextSize: number,
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
