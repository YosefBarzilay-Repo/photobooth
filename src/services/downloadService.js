import { DOWNLOAD_CONFIG } from "../constants/appConfig.js";

/**
 * @param {string} url
 */
export function revokeObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

/**
 * @param {Blob} blob
 * @returns {string}
 */
export function createObjectUrl(blob) {
  return URL.createObjectURL(blob);
}

/**
 * @param {string} url
 */
export function downloadRecording(url) {
  const link = document.createElement("a");
  link.href = url;
  link.download = `${DOWNLOAD_CONFIG.filePrefix}-${Date.now()}.${DOWNLOAD_CONFIG.fileExtension}`;
  link.click();
}
