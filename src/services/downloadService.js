import { VIDEO_FILE_EXTENSIONS } from "../constants/appConfig.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

export function revokeObjectUrl(url) {
  if (url) {
    URL.revokeObjectURL(url);
  }
}

export function createObjectUrl(blob) {
  return URL.createObjectURL(blob);
}

export function isVideoFilename(filename) {
  const lowerCaseName = String(filename || "").toLowerCase();
  return VIDEO_FILE_EXTENSIONS.some((extension) => lowerCaseName.endsWith(extension));
}

export function buildTimestampFilename(extension) {
  const now = new Date();
  return `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.${extension}`;
}

export async function saveRecording(blob, filename, directoryHandle = null) {
  if (directoryHandle && "getFileHandle" in directoryHandle) {
    try {
      const fileHandle = await directoryHandle.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      return filename;
    } catch {
      // Fall back to browser download if folder write is denied or unsupported.
    }
  }

  const url = createObjectUrl(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => revokeObjectUrl(url), 1000);
  return filename;
}

export async function loadSavedRecordingsFromDirectory(directoryHandle) {
  if (!directoryHandle || !("values" in directoryHandle)) {
    return [];
  }

  const entries = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind !== "file" || !isVideoFilename(entry.name)) {
      continue;
    }

    try {
      const file = await entry.getFile();
      entries.push({
        filename: entry.name,
        blob: file,
        url: createObjectUrl(file)
      });
    } catch {
      // Ignore files that cannot be read.
    }
  }

  entries.sort((left, right) => left.filename.localeCompare(right.filename, undefined, { numeric: true }));
  return entries;
}
