import { DOWNLOAD_CONFIG } from "../constants/appConfig.js";
import { logger } from "./logger.js";

function getMimeBase(mimeType) {
  return String(mimeType || "").split(";")[0].trim().toLowerCase();
}

export function getSupportedRecordingMimeType() {
  return DOWNLOAD_CONFIG.preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "video/webm";
}

export function getRecordingExtension(mimeType = "") {
  const mimeBase = getMimeBase(mimeType);

  if (mimeBase === "video/mp4") {
    return "mp4";
  }

  if (mimeBase === "video/quicktime") {
    return "mov";
  }

  if (mimeBase === "video/webm") {
    return "webm";
  }

  return DOWNLOAD_CONFIG.defaultFileExtension;
}

export function createMediaRecorder(stream) {
  const mimeType = getSupportedRecordingMimeType();
  void logger.debug("Creating media recorder.", { mimeType });
  return new MediaRecorder(stream, { mimeType });
}

export function createRecordingBlob(chunks, recorder) {
  const mimeType = recorder?.mimeType || getSupportedRecordingMimeType();
  void logger.debug("Creating recording blob.", { mimeType, chunkCount: chunks.length });
  return new Blob(chunks, { type: mimeType });
}
