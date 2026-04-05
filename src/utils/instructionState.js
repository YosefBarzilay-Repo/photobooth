function createInstructionId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function clampPosition(value) {
  return Math.max(6, Math.min(94, Number(value) || 50));
}

function clampAutoAdvanceSeconds(value) {
  return Math.max(1, Math.min(30, Math.round(Number(value) || 4)));
}

export function createInstructionElement(partial = {}) {
  const type = partial.type === "image" ? "image" : "text";
  return {
    id: partial.id || createInstructionId("instruction-element"),
    type,
    content: typeof partial.content === "string" ? partial.content : (type === "text" ? "New instruction" : ""),
    dataUrl: typeof partial.dataUrl === "string" ? partial.dataUrl : "",
    size: ["small", "medium", "large"].includes(partial.size) ? partial.size : (type === "text" ? "medium" : "large"),
    font: typeof partial.font === "string" ? partial.font : "Space Grotesk",
    color: typeof partial.color === "string" ? partial.color : "var(--color-accent)",
    scaleX: Number.isFinite(partial.scaleX) ? partial.scaleX : 1,
    scaleY: Number.isFinite(partial.scaleY) ? partial.scaleY : 1,
    rotation: Number.isFinite(partial.rotation) ? partial.rotation : 0,
    position: {
      x: clampPosition(partial.position?.x),
      y: clampPosition(partial.position?.y ?? (type === "text" ? 34 : 62))
    }
  };
}

export function createInstructionPage(partial = {}) {
  return {
    id: partial.id || createInstructionId("instruction-page"),
    name: typeof partial.name === "string" && partial.name.trim() ? partial.name : "Instruction Page",
    phase: partial.phase === "after" ? "after" : "before",
    navigation: ["tap", "auto"].includes(partial.navigation) ? partial.navigation : "tap",
    autoAdvanceSeconds: clampAutoAdvanceSeconds(partial.autoAdvanceSeconds),
    elements: Array.isArray(partial.elements)
      ? partial.elements.map((element) => createInstructionElement(element)).filter(Boolean)
      : []
  };
}

export function normalizeInstructionPages(pages) {
  if (!Array.isArray(pages)) {
    return [];
  }

  return pages
    .map((page) => createInstructionPage(page))
    .filter(Boolean);
}

export function getInstructionPagesByPhase(pages, phase) {
  return normalizeInstructionPages(pages).filter((page) => page.phase === phase);
}
