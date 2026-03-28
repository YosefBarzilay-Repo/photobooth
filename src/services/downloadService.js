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
