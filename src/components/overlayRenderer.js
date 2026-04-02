import { TEXT_COLOR_SWATCHES } from "../constants/appConfig.js";
import { getOverlays } from "../utils/overlayState.js";

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildToolbar(overlay, showColorPalette) {
  const type = overlay.type;
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
        <button type="button" class="overlay-tool-button" data-overlay-action="delete" data-overlay-type="${type}" data-overlay-id="${overlay.id}" aria-label="Delete">
          <span class="material-symbols-outlined">close</span>
        </button>${colorButton}
        <button type="button" class="overlay-tool-button" data-overlay-handle="rotate" data-overlay-type="${type}" data-overlay-id="${overlay.id}" aria-label="Tilt">
          <span class="material-symbols-outlined">rotate_90_degrees_ccw</span>
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

  getOverlays(state).forEach((overlay) => {
    const selected = state.activeOverlayId === overlay.id;
    if (overlay.type === "logo" && overlay.dataUrl) {
      const scaleX = Number.isFinite(overlay.scaleX) ? overlay.scaleX : 1;
      const scaleY = Number.isFinite(overlay.scaleY) ? overlay.scaleY : 1;
    items.push(`
      <div class="overlay-item overlay-item-logo${getSelectedClass("logo", interactive, selected)}" data-overlay-id="${overlay.id}" data-overlay-type="logo"
        style="left:${overlay.position.x}%; top:${overlay.position.y}%; transform: translate(-50%, -50%);">
        ${interactive && selected ? buildToolbar(overlay, false) : ""}
        <div class="overlay-item-shell" style="transform: rotate(${overlay.rotation}deg);">
          <div class="overlay-item-body overlay-logo-body" data-overlay-id="${overlay.id}" data-overlay-type="logo">
            <img class="overlay-logo-image" src="${overlay.dataUrl}" alt="Logo overlay" style="transform: scale(${scaleX}, ${scaleY});">
          </div>
        </div>
        ${interactive && selected ? `<button type="button" class="overlay-resize-handle" data-overlay-handle="resize" data-overlay-id="${overlay.id}" data-overlay-type="logo" aria-label="Resize logo"><span class="material-symbols-outlined">open_in_full</span></button>` : ""}
      </div>
    `);
      return;
    }

    if (overlay.type === "text" && overlay.text) {
      const scaleX = Number.isFinite(overlay.scaleX) ? overlay.scaleX : 1;
      const scaleY = Number.isFinite(overlay.scaleY) ? overlay.scaleY : 1;
    items.push(`
      <div class="overlay-item overlay-item-text${getSelectedClass("text", interactive, selected)}" data-overlay-id="${overlay.id}" data-overlay-type="text"
        style="left:${overlay.position.x}%; top:${overlay.position.y}%; transform: translate(-50%, -50%);">
        ${interactive && selected ? buildToolbar(overlay, state.showTextColorPalette) : ""}
        <div class="overlay-item-shell" style="transform: rotate(${overlay.rotation}deg);">
          <div class="overlay-item-body overlay-caption" data-overlay-id="${overlay.id}" data-overlay-type="text"
            style="color:${overlay.color}; font-family:&quot;${overlay.font}&quot;, sans-serif; font-size:${overlay.size}px; transform: scale(${scaleX}, ${scaleY});">
            ${escapeHtml(overlay.text)}
          </div>
        </div>
        ${interactive && selected ? `<button type="button" class="overlay-resize-handle" data-overlay-handle="resize" data-overlay-id="${overlay.id}" data-overlay-type="text" aria-label="Resize text"><span class="material-symbols-outlined">open_in_full</span></button>` : ""}
      </div>
    `);
    }
  });

  target.innerHTML = items.join("");
}
