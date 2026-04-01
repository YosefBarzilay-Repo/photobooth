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

export async function getDesktopAppDataDirectory() {
  if (!isDesktopApp()) {
    return "";
  }

  return invokeDesktop("get_app_data_directory");
}

export async function listDesktopMonitors() {
  if (!isDesktopApp()) {
    return [];
  }

  return invokeDesktop("list_available_monitors");
}

export async function applyCurrentWindowDisplaySettings({ monitorId = "", fullscreen = true } = {}) {
  if (!isDesktopApp()) {
    return false;
  }

  await invokeDesktop("apply_current_window_settings", {
    monitorId: typeof monitorId === "string" && monitorId.trim() ? monitorId : null,
    fullscreen: Boolean(fullscreen)
  });
  return Boolean(fullscreen);
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

export async function openDesktopSlideshowWindow(projectPath) {
  if (!isDesktopApp()) {
    throw new Error("Desktop APIs are not available.");
  }

  return invokeDesktop("open_slideshow_process", { projectPath });
}

export async function listActiveDesktopSlideshows() {
  if (!isDesktopApp()) {
    return [];
  }

  return invokeDesktop("list_active_slideshows");
}

export async function closeExternalDesktopSlideshows(projectPath = "") {
  if (!isDesktopApp()) {
    return;
  }

  await invokeDesktop("close_external_slideshows", {
    projectPath: typeof projectPath === "string" && projectPath.trim() ? projectPath : null
  });
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

export async function readDesktopTextFile(filePath) {
  if (!isDesktopApp()) {
    throw new Error("Desktop APIs are not available.");
  }

  return invokeDesktop("read_text_file", { filePath });
}

export async function writeDesktopTextFile(filePath, text) {
  if (!isDesktopApp()) {
    throw new Error("Desktop APIs are not available.");
  }

  return invokeDesktop("write_text_file", { filePath, text });
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
