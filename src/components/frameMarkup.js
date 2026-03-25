// TODO(refactor): Drive frame markup from a shared render contract so JS selection and CSS presentation cannot drift.

/**
 * @typedef {import("../types/app.js").FrameId} FrameId
 */

function drawFlowerMarkup() {
  return `
    <span class="flower a"></span>
    <span class="flower b"></span>
    <span class="flower c"></span>
    <span class="flower d"></span>
  `;
}

/**
 * @param {FrameId} frameId
 * @returns {string}
 */
export default function renderFrameMarkup(frameId) {
  switch (frameId) {
    case "classic":
      return `<div class="frame-overlay frame-classic"></div>`;
    case "polaroid":
      return `<div class="frame-overlay frame-polaroid"></div>`;
    case "film":
      return `<div class="frame-overlay frame-film"></div>`;
    case "neon":
      return `<div class="frame-overlay frame-neon"></div>`;
    case "floral":
      return `<div class="frame-overlay frame-floral">${drawFlowerMarkup()}</div>`;
    case "minimal":
      return `<div class="frame-overlay frame-minimal"></div>`;
    case "none":
    default:
      return "";
  }
}


