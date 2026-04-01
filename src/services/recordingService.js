import { DOWNLOAD_CONFIG } from "../constants/appConfig.js";
import { logger } from "./logger.js";

function getMimeBase(mimeType) {
  return String(mimeType || "").split(";")[0].trim().toLowerCase();
}

export function getSupportedRecordingMimeType(options = {}) {
  const preferredMimeTypes = DOWNLOAD_CONFIG.preferredMimeTypes.filter((mimeType) => getMimeBase(mimeType) === "video/mp4");
  return preferredMimeTypes.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
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
  if (!mimeType) {
    throw new Error("Photobooth requires MP4 recording support, but this runtime only exposed non-MP4 encoders.");
  }
  void logger.debug("Creating media recorder.", { mimeType, preferStableCanvas: options.preferStableCanvas === true });
  return new MediaRecorder(stream, { mimeType });
}

export function createRecordingBlob(chunks, recorder) {
  const mimeType = recorder?.mimeType || getSupportedRecordingMimeType();
  if (getMimeBase(mimeType) !== "video/mp4") {
    throw new Error(`Photobooth blocked a non-MP4 recording blob (${mimeType || "unknown"}).`);
  }
  void logger.debug("Creating recording blob.", { mimeType, chunkCount: chunks.length });
  return new Blob(chunks, { type: mimeType });
}
