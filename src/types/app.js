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
 * @typedef {{ url: string, blob: Blob, filename: string, saved: boolean }} RecordingEntry
 */

/**
 * @typedef {"videos" | "projects"} GalleryView
 */

/**
 * @typedef {"text" | "logo" | null} OverlayTarget
 */

/**
 * @typedef {"move" | "resize" | "rotate" | null} OverlayInteraction
 */

/**
 * @typedef {{
 *   id: string,
 *   type: "text" | "logo",
 *   text?: string,
 *   font?: string,
 *   color?: string,
 *   size?: number,
 *   dataUrl?: string,
 *   scaleX?: number,
 *   scaleY?: number,
 *   position: Vector2,
 *   rotation: number
 * }} OverlayEntry
 */

/**
 * @typedef {{
 *   mode: AppMode,
 *   operatorPanelOpen: boolean,
 *   galleryPanelOpen: boolean,
 *   galleryView: GalleryView,
 *   operatorReturnMode: AppMode,
 *   saveDirectoryHandle: FileSystemDirectoryHandle | null,
 *   saveDirectoryPath: string,
 *   saveDirectoryName: string,
 *   activeProjectPath: string,
 *   isDesktopApp: boolean,
 *   isFullscreen: boolean,
 *   stream: MediaStream | null,
 *   settingsCameraEnabled: boolean,
 *   recorder: MediaRecorder | null,
 *   recordingBlob: Blob | null,
 *   recordingUrl: string,
 *   recordingFilename: string,
 *   recordingPath: string,
 *   recordings: RecordingEntry[],
 *   recordingChunks: Blob[],
 *   captureReady: boolean,
 *   captureInProgress: boolean,
 *   isRecording: boolean,
 *   isSaving: boolean,
 *   shutterAnimatingOut: boolean,
 *   countdownSeconds: number,
 *   recordingTimeoutSeconds: number,
 *   countdownValue: number | null,
 *   recordIntervalId: number | null,
 *   recordingTimeoutId: number | null,
 *   recordStartedAt: number,
 *   captureOrientation: "landscape" | "portrait",
 *   overlays: OverlayEntry[],
 *   activeOverlayId: string | null,
 *   activeFrameId: FrameId,
 *   activeOverlayTarget: OverlayTarget,
 *   showTextColorPalette: boolean,
 *   draggingOverlayTarget: OverlayTarget,
 *   draggingOverlayId: string | null,
 *   overlayInteraction: OverlayInteraction,
 *   dragPointerId: number | null,
 *   dragStartPointer: Vector2 | null,
 *   dragSurfaceSize: Vector2 | null,
 *   dragStartPosition: Vector2 | null,
 *   dragStartOverlayRect: { left: number, top: number, width: number, height: number } | null,
 *   dragStartRotation: number,
 *   dragStartPointerAngle: number | null,
 *   dragRotationCenter: Vector2 | null,
 *   dragStartOverlayScale: Vector2,
 *   overlayText: string,
 *   overlayFont: string,
 *   overlayColor: string,
 *   overlaySize: number,
 *   overlayTextPosition: Vector2,
 *   overlayTextRotation: number,
 *   logoDataUrl: string,
 *   logoScale: number,
 *   logoRotation: number,
 *   logoPosition: Vector2,
 *   slideshowSoundEnabled: boolean,
 *   slideshowAudioOutputId: string,
 *   slideshowFadeDurationMs: number,
 *   mainWindowMonitorId: string,
 *   mainWindowFullscreen: boolean,
 *   slideshowMonitorId: string,
 *   slideshowFullscreen: boolean,
 *   videoInputId: string,
 *   audioInputId: string
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

