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
    dom.resultFrame.innerHTML = renderFrameMarkup(state.activeFrameId);
    dom.operatorFrame.innerHTML = renderFrameMarkup(state.activeFrameId);
    renderOverlayLayer(dom.resultText, state);
    renderOverlayLayer(dom.operatorText, state, { interactive: true });
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