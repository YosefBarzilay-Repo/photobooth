function getTauriGlobal() {
  return window.__TAURI__ ?? null;
}

function getCurrentWindow() {
  return getTauriGlobal()?.window?.getCurrentWindow?.() ?? null;
}

export function isDesktopApp() {
  const tauri = getTauriGlobal();
  return Boolean(tauri?.core?.invoke && getCurrentWindow());
}

export async function getFullscreenState() {
  if (isDesktopApp()) {
    return getCurrentWindow().isFullscreen();
  }

  return Boolean(document.fullscreenElement);
}

export async function setFullscreenState(value) {
  if (isDesktopApp()) {
    await getCurrentWindow().setFullscreen(Boolean(value));
    return Boolean(value);
  }

  if (value) {
    if (!document.fullscreenElement && document.fullscreenEnabled) {
      await document.documentElement.requestFullscreen?.();
    }
    return Boolean(document.fullscreenElement);
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen?.();
  }

  return Boolean(document.fullscreenElement);
}

export async function invokeDesktop(command, args = {}) {
  if (!isDesktopApp()) {
    throw new Error("Desktop APIs are not available.");
  }

  return getTauriGlobal().core.invoke(command, args);
}

export async function getDesktopAppVersion() {
  if (!isDesktopApp()) {
    return {
      version: "1.0.0",
      buildNumber: "0",
      displayVersion: "1.0.0.0_0"
    };
  }

  return invokeDesktop("get_app_version");
}

export async function closeDesktopApp() {
  if (isDesktopApp()) {
    await invokeDesktop("exit_app");
    return;
  }

  window.close();
}

export async function pickDesktopDirectory() {
  if (!isDesktopApp()) {
    return null;
  }

  return getTauriGlobal().dialog.open({
    title: "Choose save folder",
    directory: true,
    multiple: false
  });
}

export async function pickDesktopSavePath(defaultPath) {
  if (!isDesktopApp()) {
    return null;
  }

  return getTauriGlobal().dialog.save({
    title: "Save recording",
    defaultPath
  });
}

export function convertDesktopFileSrc(filePath) {
  if (!isDesktopApp()) {
    return "";
  }

  return getTauriGlobal().core.convertFileSrc(filePath);
}
