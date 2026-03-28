/**
 * @typedef {import("../types/app.js").AppState} AppState
 * @typedef {import("../types/app.js").OverlayTarget} OverlayTarget
 */

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildToolbar(type) {
  return `
    <div class="overlay-toolbar">
      <button type="button" class="overlay-tool-button" data-overlay-action="delete" data-overlay-type="${type}" aria-label="Delete">
        <span class="material-symbols-outlined">close</span>
      </button>
      <button type="button" class="overlay-tool-button" data-overlay-action="shrink" data-overlay-type="${type}" aria-label="Smaller">
        <span class="material-symbols-outlined">remove</span>
      </button>
      <button type="button" class="overlay-tool-button" data-overlay-action="grow" data-overlay-type="${type}" aria-label="Larger">
        <span class="material-symbols-outlined">add</span>
      </button>
      <button type="button" class="overlay-tool-button" data-overlay-action="rotate-left" data-overlay-type="${type}" aria-label="Rotate left">
        <span class="material-symbols-outlined">rotate_left</span>
      </button>
      <button type="button" class="overlay-tool-button" data-overlay-action="rotate-right" data-overlay-type="${type}" aria-label="Rotate right">
        <span class="material-symbols-outlined">rotate_right</span>
      </button>
    </div>
  `;
}

/**
 * @param {OverlayTarget} type
 * @param {boolean} interactive
 * @param {boolean} selected
 * @returns {string}
 */
function getSelectedClass(type, interactive, selected) {
  if (!interactive) {
    return "";
  }

  return selected ? ` selected overlay-${type}-active` : "";
}

/**
 * @param {HTMLElement} target
 * @param {AppState} state
 * @param {{ interactive?: boolean }} [options]
 */
export function renderOverlayLayer(target, state, options = {}) {
  const interactive = options.interactive === true;
  const items = [];

  if (state.logoDataUrl) {
    const selected = state.activeOverlayTarget === "logo";
    items.push(`
      <div class="overlay-item overlay-item-logo${getSelectedClass("logo", interactive, selected)}" data-overlay-type="logo"
        style="left:${state.logoPosition.x}%; top:${state.logoPosition.y}%; transform: translate(-50%, -50%) rotate(${state.logoRotation}deg) scale(${state.logoScale});">
        ${interactive && selected ? buildToolbar("logo") : ""}
        <div class="overlay-item-body overlay-logo-body" data-overlay-type="logo">
          <img class="overlay-logo-image" src="${state.logoDataUrl}" alt="Logo overlay">
        </div>
      </div>
    `);
  }

  if (state.overlayText) {
    const selected = state.activeOverlayTarget === "text";
    items.push(`
      <div class="overlay-item overlay-item-text${getSelectedClass("text", interactive, selected)}" data-overlay-type="text"
        style="left:${state.overlayTextPosition.x}%; top:${state.overlayTextPosition.y}%; transform: translate(-50%, -50%) rotate(${state.overlayTextRotation}deg);">
        ${interactive && selected ? buildToolbar("text") : ""}
        <div class="overlay-item-body overlay-caption" data-overlay-type="text"
          style="color:${state.overlayColor}; font-family:&quot;${state.overlayFont}&quot;, sans-serif; font-size:${state.overlaySize}px;">
          ${escapeHtml(state.overlayText)}
        </div>
      </div>
    `);
  }

  target.innerHTML = items.join("");
}