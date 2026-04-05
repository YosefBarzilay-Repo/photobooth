import { TEXT_COLOR_SWATCHES } from "../constants/appConfig.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getInstructionHint(page, remainingSeconds = null) {
  if (!page) {
    return "";
  }

  switch (page.navigation) {
    case "auto":
      return `Continuing automatically in ${remainingSeconds ?? page.autoAdvanceSeconds}s. Tap anywhere to skip`;
    case "tap":
    default:
      return "Tap anywhere to continue";
  }
}

function buildToolbar(element, showColorPalette) {
  const colorButton = element.type === "text"
    ? `
      <button type="button" class="overlay-tool-button" data-instruction-action="color" data-instruction-id="${element.id}" aria-label="Color">
        <span class="material-symbols-outlined">palette</span>
      </button>`
    : "";

  const colorPalette = element.type === "text" && showColorPalette
    ? `
      <div class="overlay-color-palette">
        ${TEXT_COLOR_SWATCHES.map((color) => `
          <button type="button" class="overlay-color-swatch" data-instruction-color="${color}" data-instruction-id="${element.id}" aria-label="${color}" style="--swatch:${color}"></button>
        `).join("")}
      </div>`
    : "";

  return `
    <div class="overlay-toolbar-wrap">
      <div class="overlay-toolbar">
        <button type="button" class="overlay-tool-button" data-instruction-action="delete" data-instruction-id="${element.id}" aria-label="Delete">
          <span class="material-symbols-outlined">close</span>
        </button>${colorButton}
        <button type="button" class="overlay-tool-button" data-instruction-handle="rotate" data-instruction-id="${element.id}" aria-label="Tilt">
          <span class="material-symbols-outlined">rotate_90_degrees_ccw</span>
        </button>
      </div>
      ${colorPalette}
    </div>
  `;
}

export function renderInstructionPage(container, page, options = {}) {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  if (!page) {
    container.innerHTML = `<div class="instruction-preview-empty">${escapeHtml(options.emptyText || "Add a page to preview it here.")}</div>`;
    return;
  }

  const interactive = options.interactive === true;
  const selectedId = options.selectedId || "";
  const showColorPalette = options.showColorPalette === true;

  container.innerHTML = page.elements.map((element) => {
    const selected = interactive && selectedId === element.id;
    const scaleX = Number.isFinite(element.scaleX) ? element.scaleX : 1;
    const scaleY = Number.isFinite(element.scaleY) ? element.scaleY : 1;
    const shellStyle = `transform: rotate(${element.rotation || 0}deg) scale(${scaleX}, ${scaleY});`;
    const itemClass = `overlay-item instruction-preview-element instruction-preview-element-${element.type} instruction-size-${element.size || "medium"}${selected ? " selected is-selected" : ""}`;
    const itemStyle = `left:${element.position?.x ?? 50}%; top:${element.position?.y ?? 50}%; transform: translate(-50%, -50%);`;

    if (element.type === "image" && element.dataUrl) {
      return `
        <div class="${itemClass}" data-instruction-id="${element.id}" data-instruction-type="image" style="${itemStyle}">
          ${selected ? buildToolbar(element, false) : ""}
          <div class="overlay-item-shell" style="${shellStyle}">
            <div class="overlay-item-body overlay-logo-body" data-instruction-id="${element.id}" data-instruction-type="image">
              <img class="overlay-logo-image instruction-preview-image" src="${element.dataUrl}" alt="${escapeHtml(element.content || page.name || "Instruction media")}">
            </div>
            ${selected ? `<button type="button" class="overlay-resize-handle" data-instruction-handle="resize" data-instruction-id="${element.id}" aria-label="Resize media"><span class="material-symbols-outlined">open_in_full</span></button>` : ""}
          </div>
        </div>
      `;
    }

    return `
      <div class="${itemClass}" data-instruction-id="${element.id}" data-instruction-type="text" style="${itemStyle}">
        ${selected ? buildToolbar(element, showColorPalette) : ""}
        <div class="overlay-item-shell" style="${shellStyle}">
          <div class="overlay-item-body overlay-caption instruction-preview-text instruction-size-${element.size || "medium"}" data-instruction-id="${element.id}" data-instruction-type="text"
            style="color:${escapeHtml(element.color || "var(--color-accent)")}; font-family:&quot;${escapeHtml(element.font || "Space Grotesk")}&quot;, sans-serif;">
            ${escapeHtml(element.content || "Instruction text")}
          </div>
          ${selected ? `<button type="button" class="overlay-resize-handle" data-instruction-handle="resize" data-instruction-id="${element.id}" aria-label="Resize text"><span class="material-symbols-outlined">open_in_full</span></button>` : ""}
        </div>
      </div>
    `;
  }).join("");
}

export function getInstructionPageHint(page, remainingSeconds = null) {
  return getInstructionHint(page, remainingSeconds);
}
