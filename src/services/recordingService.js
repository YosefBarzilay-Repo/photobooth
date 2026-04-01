import { DOWNLOAD_CONFIG } from "../constants/appConfig.js";
import { logger } from "./logger.js";

function getMimeBase(mimeType) {
  return String(mimeType || "").split(";")[0].trim().toLowerCase();
}

export function getSupportedRecordingMimeType(options = {}) {
  const preferStableCanvas = options.preferStableCanvas === true;
  const preferredMimeTypes = preferStableCanvas
    ? [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      ...DOWNLOAD_CONFIG.preferredMimeTypes
    ]
    : DOWNLOAD_CONFIG.preferredMimeTypes;

  return preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "video/webm";
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

export function createMediaRecorder(stream, options = {}) {
  const mimeType = getSupportedRecordingMimeType(options);
  void logger.debug("Creating media recorder.", { mimeType, preferStableCanvas: options.preferStableCanvas === true });
  return new MediaRecorder(stream, { mimeType });
}

export function createRecordingBlob(chunks, recorder) {
  const mimeType = recorder?.mimeType || getSupportedRecordingMimeType();
  void logger.debug("Creating recording blob.", { mimeType, chunkCount: chunks.length });
  return new Blob(chunks, { type: mimeType });
}
