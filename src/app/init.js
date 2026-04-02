import createAppStore from "../store/appStore.js";
import createCameraScreen from "../screens/cameraScreen.js";
import createEditorScreen from "../screens/editorScreen.js";
import createOperatorScreen from "../screens/operatorScreen.js";
import { APP_DEFAULTS, APP_STRINGS } from "../constants/appConfig.js";
import createDomRefs from "./dom.js";
import createAppRuntime from "./runtime.js";
import { logger } from "../services/logger.js";
import { applyPersistedSettings, loadPersistedSettings, persistSettings } from "../services/settingsPersistence.js";
import { isDesktopApp } from "../services/desktopService.js";
import { syncActiveOverlayState } from "../utils/overlayState.js";

function createAppDependencies() {
  const state = createAppStore();
  state.isDesktopApp = isDesktopApp();

  if (!state.isDesktopApp) {
    applyPersistedSettings(
      state,
      { ...APP_DEFAULTS, saveFolderDefault: APP_STRINGS.saveFolderDefault },
      loadPersistedSettings()
    );
  }
  syncActiveOverlayState(state);

  const dom = createDomRefs();
  const cameraScreen = createCameraScreen(dom, state);
  const editorScreen = createEditorScreen(dom, state);
  const operatorScreen = createOperatorScreen(dom, state, editorScreen, persistSettings);

  return {
    state,
    dom,
    cameraScreen,
    editorScreen,
    operatorScreen
  };
}

/**
 * Initializes the Echo application.
 *
 * @returns {void}
 */
export default function initApp() {
  // PHASE 1: create state and restore persisted settings
  const dependencies = createAppDependencies();

  void logger.info("Echo app initialization started.", {
    isDesktopApp: dependencies.state.isDesktopApp,
    saveDirectoryPath: dependencies.state.saveDirectoryPath,
    saveDirectoryName: dependencies.state.saveDirectoryName
  });

  // PHASE 2: build the runtime and bootstrap the UI lifecycle
  createAppRuntime(dependencies);
}
