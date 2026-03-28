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

async function invokeDesktopWithTimeout(command, args = {}, timeoutMs = 4000) {
  let timeoutId = null;
  try {
    return await Promise.race([
      invokeDesktop(command, args),
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
          reject(new Error(`Desktop command timed out: ${command}`));
        }, timeoutMs);
      })
    ]);
  } finally {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
    }
  }
}

async function fetchBuildInfo() {
  try {
    const response = await fetch("./build-info.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return typeof payload === "object" && payload !== null ? payload : null;
  } catch {
    return null;
  }
}

export async function getDesktopAppVersion() {
  const buildInfo = await fetchBuildInfo();

  if (!isDesktopApp()) {
    return {
      version: typeof buildInfo?.version === "string" ? buildInfo.version : "1.0.0",
      buildNumber: typeof buildInfo?.buildNumber === "string" ? buildInfo.buildNumber : "0",
      displayVersion: typeof buildInfo?.displayVersion === "string" ? buildInfo.displayVersion : "1.0.0.0_0"
    };
  }

  const runtimeVersion = await invokeDesktop("get_app_version");
  if (!buildInfo) {
    return runtimeVersion;
  }

  return {
    ...runtimeVersion,
    version: typeof buildInfo.version === "string" ? buildInfo.version : runtimeVersion.version,
    buildNumber: typeof buildInfo.buildNumber === "string" ? buildInfo.buildNumber : runtimeVersion.buildNumber,
    displayVersion: typeof buildInfo.displayVersion === "string" ? buildInfo.displayVersion : runtimeVersion.displayVersion
  };
}

export async function getDefaultRecordingsDirectory() {
  if (!isDesktopApp()) {
    return "";
  }

  return invokeDesktop("get_default_recordings_directory");
}

export async function createDesktopProjectDirectory(projectName, parentDirectory = "") {
  if (!isDesktopApp()) {
    throw new Error("Desktop APIs are not available.");
  }

  return invokeDesktop("create_project_directory", {
    projectName,
    parentDirectory
  });
}

export async function listDesktopProjects() {
  if (!isDesktopApp()) {
    return [];
  }

  return invokeDesktop("list_saved_projects");
}

export async function renameDesktopProjectDirectory(projectPath, projectName) {
  if (!isDesktopApp()) {
    throw new Error("Desktop APIs are not available.");
  }

  return invokeDesktop("rename_project_directory", {
    projectPath,
    projectName
  });
}

export async function deleteDesktopProjectDirectory(projectPath) {
  if (!isDesktopApp()) {
    throw new Error("Desktop APIs are not available.");
  }

  return invokeDesktop("delete_project_directory", {
    projectPath
  });
}

export async function closeDesktopApp() {
  if (isDesktopApp()) {
    try {
      await invokeDesktop("exit_app");
      return;
    } catch {
      const currentWindow = getCurrentWindow();
      await currentWindow?.close?.();
      return;
    }
  }

  window.close();
}

export async function openDesktopSlideshowWindow() {
  if (isDesktopApp()) {
    await invokeDesktopWithTimeout("open_slideshow_window", {}, 12000);
  }
}

export async function openDesktopDirectory(directoryPath = "") {
  if (!isDesktopApp()) {
    throw new Error("Desktop APIs are not available.");
  }

  const targetPath = typeof directoryPath === "string" && directoryPath.trim()
    ? directoryPath
    : await getDefaultRecordingsDirectory();

  return invokeDesktop("open_directory_in_file_manager", { directoryPath: targetPath });
}

export async function pickDesktopDirectory(defaultPath = "") {
  if (!isDesktopApp()) {
    return null;
  }

  return getTauriGlobal().dialog.open({
    title: "Choose save folder",
    directory: true,
    multiple: false,
    defaultPath: typeof defaultPath === "string" && defaultPath.trim() ? defaultPath : undefined
  });
}

export function convertDesktopFileSrc(filePath) {
  if (!isDesktopApp()) {
    return "";
  }

  return getTauriGlobal().core.convertFileSrc(filePath);
}
