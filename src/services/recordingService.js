import { DOWNLOAD_CONFIG } from "../constants/appConfig.js";

export function getSupportedRecordingMimeType() {
  return DOWNLOAD_CONFIG.preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "video/webm";
}

export function getRecordingExtension(mimeType) {
  return mimeType.includes("mp4") ? DOWNLOAD_CONFIG.defaultFileExtension : DOWNLOAD_CONFIG.fallbackFileExtension;
}

export function createMediaRecorder(stream) {
  const mimeType = getSupportedRecordingMimeType();
  return new MediaRecorder(stream, { mimeType });
}

export function createRecordingBlob(chunks, recorder) {
  const mimeType = recorder?.mimeType || getSupportedRecordingMimeType();
  return new Blob(chunks, { type: mimeType });
}