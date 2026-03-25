/**
 * @typedef {import("../types/app.js").AppState} AppState
 */

/**
 * @param {HTMLElement} target
 * @param {AppState} state
 */
export function renderOverlayText(target, state) {
  target.replaceChildren();

  if (!state.overlayText) {
    return;
  }

  const text = document.createElement("div");
  text.className = "overlay-caption";
  text.textContent = state.overlayText;
  text.style.color = state.overlayColor;
  text.style.fontFamily = `"${state.overlayFont}", sans-serif`;
  text.style.fontSize = `${state.overlaySize}px`;
  target.appendChild(text);
}
