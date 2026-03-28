import { VIDEO_FILE_EXTENSIONS } from "../constants/appConfig.js";
import {
  convertDesktopFileSrc,
  invokeDesktop,
  isDesktopApp,
  pickDesktopSavePath
} from "./desktopService.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

function getFilenameFromPath(filePath) {
  const segments = String(filePath || "").split(/[\\/]/);
  return segments[segments.length - 1] || "";
}

async function blobToBytes(blob) {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
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

export async function saveRecording(blob, filename, saveDirectory = null) {
  if (isDesktopApp()) {
    const bytes = await blobToBytes(blob);

    if (saveDirectory) {
      return invokeDesktop("save_recording_to_directory", {
        directoryPath: saveDirectory,
        fileName: filename,
        bytes
      });
    }

    const selectedPath = await pickDesktopSavePath(filename);
    if (!selectedPath) {
      return "";
    }

    await invokeDesktop("write_binary_file", {
      filePath: selectedPath,
      bytes
    });
    return getFilenameFromPath(selectedPath);
  }

  if (saveDirectory && "getFileHandle" in saveDirectory) {
    try {
      const fileHandle = await saveDirectory.getFileHandle(filename, { create: true });
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
  if (isDesktopApp()) {
    if (!directoryHandle) {
      return [];
    }

    const entries = await invokeDesktop("list_saved_recordings", { directoryPath: directoryHandle });
    return entries.map((entry) => ({
      filename: entry.filename,
      url: convertDesktopFileSrc(entry.path)
    }));
  }

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
