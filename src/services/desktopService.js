import { APP_THRESHOLDS } from "../constants/appConfig.js";

const DESKTOP_API_TIMEOUT_MS = APP_THRESHOLDS.desktopApiTimeoutMs || 4000;

function getTauriGlobal() {
  return window.__TAURI__ ?? null;
}

function getCurrentWindow() {
  return getTauriGlobal()?.window?.getCurrentWindow?.() ?? null;
}

function createTimeoutError(command, timeoutMs) {
  return new Error(`Desktop command "${command}" timed out after ${timeoutMs}ms.`);
}

function withTimeout(promise, command, timeoutMs = DESKTOP_API_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(createTimeoutError(command, timeoutMs));
    }, timeoutMs);

    Promise.resolve(promise).then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timer);
        reject(error);
      }
    );
  });
}

function resolveMonitorId(monitorId = "") {
  return typeof monitorId === "string" && monitorId.trim() ? monitorId : null;
}

/**
 * Returns whether the app is running with Tauri desktop APIs.
 *
 * @returns {boolean}
 */
export function isDesktopApp() {
  const tauri = getTauriGlobal();
  return Boolean(tauri?.core?.invoke && getCurrentWindow());
}

/**
 * Reads the current fullscreen state from desktop or browser mode.
 *
 * @returns {Promise<boolean>}
 */
export async function getFullscreenState() {
  if (isDesktopApp()) {
    try {
      return await withTimeout(getCurrentWindow().isFullscreen(), "window.isFullscreen");
    } catch {
      return false;
    }
  }

  return Boolean(document.fullscreenElement);
}

/**
 * Sets fullscreen mode in desktop or browser mode.
 *
 * @param {boolean} value
 * @returns {Promise<boolean>}
 */
export async function setFullscreenState(value) {
  if (isDesktopApp()) {
    await withTimeout(getCurrentWindow().setFullscreen(Boolean(value)), "window.setFullscreen");
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

/**
 * Invokes a Tauri command with timeout protection.
 *
 * @template T
 * @param {string} command
 * @param {Record<string, unknown>} [args={}]
 * @param {{ timeoutMs?: number, fallbackValue?: T }} [options]
 * @returns {Promise<T>}
 */
export async function invokeDesktop(command, args = {}, options = {}) {
  if (!isDesktopApp()) {
    if ("fallbackValue" in options) {
      return /** @type {T} */ (options.fallbackValue);
    }

    throw new Error("Desktop APIs are not available.");
  }

  try {
    return await withTimeout(
      getTauriGlobal().core.invoke(command, args),
      command,
      options.timeoutMs ?? DESKTOP_API_TIMEOUT_MS
    );
  } catch (error) {
    if ("fallbackValue" in options) {
      return /** @type {T} */ (options.fallbackValue);
    }

    throw error;
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

/**
 * Loads the desktop app version, falling back to static build info in web mode.
 *
 * @returns {Promise<{ version: string, buildNumber: string, displayVersion: string }>}
 */
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

/**
 * Gets the default recordings directory in desktop mode.
 *
 * @returns {Promise<string>}
 */
export async function getDefaultRecordingsDirectory() {
  return invokeDesktop("get_default_recordings_directory", {}, { fallbackValue: "" });
}

/**
 * Gets the desktop app data directory.
 *
 * @returns {Promise<string>}
 */
export async function getDesktopAppDataDirectory() {
  return invokeDesktop("get_app_data_directory", {}, { fallbackValue: "" });
}

/**
 * Lists available monitors for desktop window placement.
 *
 * @returns {Promise<Array<unknown>>}
 */
export async function listDesktopMonitors() {
  return invokeDesktop("list_available_monitors", {}, { fallbackValue: [] });
}

/**
 * Applies display settings to the current desktop window.
 *
 * @param {{ monitorId?: string, fullscreen?: boolean }} [options]
 * @returns {Promise<boolean>}
 */
export async function applyCurrentWindowDisplaySettings({ monitorId = "", fullscreen = true } = {}) {
  if (!isDesktopApp()) {
    return false;
  }

  try {
    await invokeDesktop("apply_current_window_settings", {
      monitorId: resolveMonitorId(monitorId),
      fullscreen: Boolean(fullscreen)
    });
    return Boolean(fullscreen);
  } catch {
    return false;
  }
}

/**
 * Creates a desktop project directory.
 *
 * @param {string} projectName
 * @param {string} [parentDirectory=""]
 * @returns {Promise<string>}
 */
export async function createDesktopProjectDirectory(projectName, parentDirectory = "") {
  return invokeDesktop("create_project_directory", {
    projectName,
    parentDirectory
  });
}

/**
 * Lists saved desktop projects.
 *
 * @returns {Promise<Array<unknown>>}
 */
export async function listDesktopProjects() {
  return invokeDesktop("list_saved_projects", {}, { fallbackValue: [] });
}

/**
 * Renames a desktop project directory.
 *
 * @param {string} projectPath
 * @param {string} projectName
 * @returns {Promise<string>}
 */
export async function renameDesktopProjectDirectory(projectPath, projectName) {
  return invokeDesktop("rename_project_directory", {
    projectPath,
    projectName
  });
}

/**
 * Deletes a desktop project directory.
 *
 * @param {string} projectPath
 * @returns {Promise<void>}
 */
export async function deleteDesktopProjectDirectory(projectPath) {
  await invokeDesktop("delete_project_directory", { projectPath });
}

/**
 * Closes the desktop app or browser window.
 *
 * @returns {Promise<void>}
 */
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

/**
 * Opens an external slideshow window for the current project.
 *
 * @param {string} projectPath
 * @returns {Promise<unknown>}
 */
export async function openDesktopSlideshowWindow(projectPath) {
  return invokeDesktop("open_slideshow_process", { projectPath });
}

/**
 * Lists active external slideshow windows.
 *
 * @returns {Promise<Array<unknown>>}
 */
export async function listActiveDesktopSlideshows() {
  return invokeDesktop("list_active_slideshows", {}, { fallbackValue: [] });
}

/**
 * Closes external slideshow windows, optionally filtered to a single project.
 *
 * @param {string} [projectPath=""]
 * @returns {Promise<void>}
 */
export async function closeExternalDesktopSlideshows(projectPath = "") {
  await invokeDesktop("close_external_slideshows", {
    projectPath: resolveMonitorId(projectPath)
  }, { fallbackValue: undefined });
}

/**
 * Opens a directory in the system file manager.
 *
 * @param {string} [directoryPath=""]
 * @returns {Promise<unknown>}
 */
export async function openDesktopDirectory(directoryPath = "") {
  const targetPath = typeof directoryPath === "string" && directoryPath.trim()
    ? directoryPath
    : await getDefaultRecordingsDirectory();

  return invokeDesktop("open_directory_in_file_manager", { directoryPath: targetPath });
}

/**
 * Reads a UTF-8 text file through the desktop backend.
 *
 * @param {string} filePath
 * @returns {Promise<string>}
 */
export async function readDesktopTextFile(filePath) {
  return invokeDesktop("read_text_file", { filePath });
}

/**
 * Writes a UTF-8 text file through the desktop backend.
 *
 * @param {string} filePath
 * @param {string} text
 * @returns {Promise<void>}
 */
export async function writeDesktopTextFile(filePath, text) {
  await invokeDesktop("write_text_file", { filePath, text });
}

/**
 * Opens the desktop directory picker.
 *
 * @param {string} [defaultPath=""]
 * @returns {Promise<string | string[] | null>}
 */
export async function pickDesktopDirectory(defaultPath = "") {
  if (!isDesktopApp()) {
    return null;
  }

  return withTimeout(getTauriGlobal().dialog.open({
    title: "Choose save folder",
    directory: true,
    multiple: false,
    defaultPath: typeof defaultPath === "string" && defaultPath.trim() ? defaultPath : undefined
  }), "dialog.open");
}

/**
 * Converts a desktop file path to a browser-safe resource URL.
 *
 * @param {string} filePath
 * @returns {string}
 */
export function convertDesktopFileSrc(filePath) {
  if (!isDesktopApp()) {
    return "";
  }

  return getTauriGlobal().core.convertFileSrc(filePath);
}
