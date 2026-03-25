import { DOWNLOAD_CONFIG } from "../constants/appConfig.js";

/**
 * @param {MediaStream} stream
 * @returns {MediaRecorder}
 */
export function createMediaRecorder(stream) {
  const mimeType = MediaRecorder.isTypeSupported(DOWNLOAD_CONFIG.preferredMimeType)
    ? DOWNLOAD_CONFIG.preferredMimeType
    : DOWNLOAD_CONFIG.fallbackMimeType;

  return new MediaRecorder(stream, { mimeType });
}

/**
 * @param {Blob[]} chunks
 * @param {MediaRecorder | null} recorder
 * @returns {Blob}
 */
export function createRecordingBlob(chunks, recorder) {
  const mimeType = recorder?.mimeType || DOWNLOAD_CONFIG.fallbackMimeType;
  return new Blob(chunks, { type: mimeType });
}
