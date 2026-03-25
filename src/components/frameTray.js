import { FRAME_DEFINITIONS } from "../constants/frameDefinitions.js";

/**
 * @typedef {import("../types/app.js").FrameId} FrameId
 */

/**
 * @param {HTMLElement} target
 * @param {FrameId} activeFrameId
 * @param {(frameId: FrameId) => void} onSelect
 */
export default function renderFrameTray(target, activeFrameId, onSelect) {
  target.replaceChildren();

  FRAME_DEFINITIONS.forEach((frame) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "frame-card";
    button.dataset.frameId = frame.id;

    if (frame.id === activeFrameId) {
      button.classList.add("active");
    }

    button.innerHTML = `
      <div class="frame-preview frame-preview-${frame.id}"></div>
      <strong>${frame.name}</strong>
      <span>${frame.accent}</span>
    `;

    button.addEventListener("click", () => {
      onSelect(frame.id);
    });

    target.appendChild(button);
  });
}
