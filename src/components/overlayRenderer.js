import { TEXT_COLOR_SWATCHES } from "../constants/appConfig.js";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildToolbar(type, showColorPalette) {
  const colorButton = type === "text"
    ? `
      <button type="button" class="overlay-tool-button" data-overlay-action="color" data-overlay-type="text" aria-label="Color">
        <span class="material-symbols-outlined">palette</span>
      </button>`
    : "";

  const colorPalette = type === "text" && showColorPalette
    ? `
      <div class="overlay-color-palette">
        ${TEXT_COLOR_SWATCHES.map((color) => `
          <button type="button" class="overlay-color-swatch" data-overlay-color="${color}" aria-label="${color}" style="--swatch:${color}"></button>
        `).join("")}
      </div>`
    : "";

  return `
    <div class="overlay-toolbar-wrap">
      <div class="overlay-toolbar">
        <button type="button" class="overlay-tool-button" data-overlay-action="delete" data-overlay-type="${type}" aria-label="Delete">
          <span class="material-symbols-outlined">close</span>
        </button>${colorButton}
        <button type="button" class="overlay-tool-button" data-overlay-action="rotate-left" data-overlay-type="${type}" aria-label="Rotate left">
          <span class="material-symbols-outlined">rotate_left</span>
        </button>
        <button type="button" class="overlay-tool-button" data-overlay-action="rotate-right" data-overlay-type="${type}" aria-label="Rotate right">
          <span class="material-symbols-outlined">rotate_right</span>
        </button>
      </div>
      ${colorPalette}
    </div>
  `;
}

function getSelectedClass(type, interactive, selected) {
  if (!interactive) {
    return "";
  }

  return selected ? ` selected overlay-${type}-active` : "";
}

export function renderOverlayLayer(target, state, options = {}) {
  const interactive = options.interactive === true;
  const items = [];

  if (state.logoDataUrl) {
    const selected = state.activeOverlayTarget === "logo";
    items.push(`
      <div class="overlay-item overlay-item-logo${getSelectedClass("logo", interactive, selected)}" data-overlay-type="logo"
        style="left:${state.logoPosition.x}%; top:${state.logoPosition.y}%; transform: translate(-50%, -50%) rotate(${state.logoRotation}deg) scale(${state.logoScale});">
        ${interactive && selected ? buildToolbar("logo", false) : ""}
        <div class="overlay-item-body overlay-logo-body" data-overlay-type="logo">
          <img class="overlay-logo-image" src="${state.logoDataUrl}" alt="Logo overlay">
        </div>
        ${interactive && selected ? '<button type="button" class="overlay-resize-handle" data-overlay-handle="resize" data-overlay-type="logo" aria-label="Resize logo"><span class="material-symbols-outlined">open_in_full</span></button>' : ''}
      </div>
    `);
  }

  if (state.overlayText) {
    const selected = state.activeOverlayTarget === "text";
    items.push(`
      <div class="overlay-item overlay-item-text${getSelectedClass("text", interactive, selected)}" data-overlay-type="text"
        style="left:${state.overlayTextPosition.x}%; top:${state.overlayTextPosition.y}%; transform: translate(-50%, -50%) rotate(${state.overlayTextRotation}deg);">
        ${interactive && selected ? buildToolbar("text", state.showTextColorPalette) : ""}
        <div class="overlay-item-body overlay-caption" data-overlay-type="text"
          style="color:${state.overlayColor}; font-family:&quot;${state.overlayFont}&quot;, sans-serif; font-size:${state.overlaySize}px;">
          ${escapeHtml(state.overlayText)}
        </div>
        ${interactive && selected ? '<button type="button" class="overlay-resize-handle" data-overlay-handle="resize" data-overlay-type="text" aria-label="Resize text"><span class="material-symbols-outlined">open_in_full</span></button>' : ''}
      </div>
    `);
  }

  target.innerHTML = items.join("");
}