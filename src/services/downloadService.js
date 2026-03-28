import { VIDEO_FILE_EXTENSIONS } from "../constants/appConfig.js";
import {
  convertDesktopFileSrc,
  invokeDesktop,
  isDesktopApp
} from "./desktopService.js";
import { logger } from "./logger.js";

function pad(value) {
  return String(value).padStart(2, "0");
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
  void logger.audit("Saving recording requested.", {
    filename,
    isDesktopApp: isDesktopApp(),
    saveDirectory: typeof saveDirectory === "string" ? saveDirectory : saveDirectory?.name || ""
  });

  if (isDesktopApp()) {
    const bytes = await blobToBytes(blob);

    if (saveDirectory) {
      const savedPath = await invokeDesktop("save_recording_to_directory", {
        directoryPath: saveDirectory,
        fileName: filename,
        bytes
      });
      void logger.info("Recording saved to selected directory.", { filename, savedPath });
      return savedPath;
    }

    const savedPath = await invokeDesktop("save_recording_to_default_directory", {
      fileName: filename,
      bytes
    });
    void logger.info("Recording saved to default directory.", { filename, savedPath });
    return savedPath;
  }

  if (saveDirectory && "getFileHandle" in saveDirectory) {
    try {
      const fileHandle = await saveDirectory.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(blob);
      await writable.close();
      void logger.info("Recording saved with browser directory handle.", { filename, directoryName: saveDirectory.name || "" });
      return filename;
    } catch (error) {
      void logger.exception("Browser directory save failed. Falling back to browser download.", error, { filename });
    }
  }

  const url = createObjectUrl(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => revokeObjectUrl(url), 1000);
  void logger.warn("Recording saved through browser download fallback.", { filename });
  return filename;
}

export async function deleteSavedRecording(entry, saveDirectory = null) {
  void logger.audit("Delete recording requested.", {
    filename: entry?.filename || "",
    filePath: entry?.path || ""
  });

  if (isDesktopApp()) {
    if (!entry?.path) {
      void logger.error("Delete recording failed because no file path was available.", { filename: entry?.filename || "" });
      throw new Error("Photobooth could not find the file to delete.");
    }

    await invokeDesktop("delete_recording_file", {
      filePath: entry.path
    });
    void logger.info("Recording deleted from desktop directory.", { filename: entry.filename, filePath: entry.path });
    return;
  }

  if (saveDirectory && "removeEntry" in saveDirectory) {
    await saveDirectory.removeEntry(entry.filename);
    void logger.info("Recording deleted from browser directory handle.", { filename: entry.filename });
    return;
  }

  void logger.error("Delete recording failed because the environment does not support directory deletion.", {
    filename: entry?.filename || ""
  });
  throw new Error("Photobooth could not delete the selected recording.");
}

export async function loadSavedRecordingsFromDirectory(directoryHandle) {
  if (isDesktopApp()) {
    const directoryPath = directoryHandle || await invokeDesktop("get_default_recordings_directory");
    void logger.debug("Loading saved recordings from desktop directory.", { directoryPath });
    const entries = await invokeDesktop("list_saved_recordings", { directoryPath });
    void logger.info("Loaded saved recordings from desktop directory.", {
      directoryPath,
      count: entries.length
    });
    return entries.map((entry) => ({
      filename: entry.filename,
      path: entry.path,
      modifiedAt: entry.modifiedAt,
      url: convertDesktopFileSrc(entry.path)
    }));
  }

  if (!directoryHandle || !("values" in directoryHandle)) {
    void logger.warn("Skipped loading recordings because no browser directory handle is available.");
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
        modifiedAt: file.lastModified,
        url: createObjectUrl(file)
      });
    } catch (error) {
      void logger.exception("Skipped unreadable browser recording entry.", error, { filename: entry.name });
    }
  }

  entries.sort((left, right) => (right.modifiedAt || 0) - (left.modifiedAt || 0) || right.filename.localeCompare(left.filename, undefined, { numeric: true }));
  void logger.info("Loaded saved recordings from browser directory handle.", {
    directoryName: directoryHandle.name || "",
    count: entries.length
  });
  return entries;
}
