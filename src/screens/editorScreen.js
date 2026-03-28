import renderFrameMarkup from "../components/frameMarkup.js";
import { renderOverlayLayer } from "../components/overlayRenderer.js";

/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/dom.js").DomRefs} DomRefs
 */

/**
 * @param {DomRefs} dom
 * @param {AppState} state
 */
export default function createEditorScreen(dom, state) {
  function renderOverlayPreview() {
    dom.cameraFrame.innerHTML = renderFrameMarkup(state.activeFrameId);
    dom.resultFrame.innerHTML = renderFrameMarkup(state.activeFrameId);
    renderOverlayLayer(dom.cameraText, state, { interactive: state.operatorPanelOpen && state.mode === "camera" });
    renderOverlayLayer(dom.resultText, state);
  }

  function showResult() {
    if (state.recordingUrl) {
      dom.resultVideo.src = state.recordingUrl;
      dom.resultVideo.currentTime = 0;
      dom.resultVideo.style.transform = "none";
      dom.resultVideo.play().catch((error) => {
        console.warn("Result video playback did not auto-start.", error);
      });
    }

    state.mode = "editor";
    renderOverlayPreview();
  }

  function resetResultVideo() {
    dom.resultVideo.removeAttribute("src");
    dom.resultVideo.load();
  }

  return {
    renderOverlayPreview,
    showResult,
    resetResultVideo
  };
}
