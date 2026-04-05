function createOverlayId() {
  return `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createTextOverlay(partial = {}) {
  const legacyScaleY = Number.isFinite(partial.scaleY) ? partial.scaleY : 1;
  return {
    id: partial.id || createOverlayId(),
    type: "text",
    text: typeof partial.text === "string" ? partial.text : "",
    font: typeof partial.font === "string" ? partial.font : "Space Grotesk",
    color: typeof partial.color === "string" ? partial.color : "var(--color-accent)",
    size: Number.isFinite(partial.size) ? partial.size : 44,
    scaleX: Number.isFinite(partial.scaleX) ? partial.scaleX : 1,
    scaleY: legacyScaleY,
    position: partial.position && Number.isFinite(partial.position.x) && Number.isFinite(partial.position.y)
      ? { x: partial.position.x, y: partial.position.y }
      : { x: 50, y: 84 },
    rotation: Number.isFinite(partial.rotation) ? partial.rotation : 0
  };
}

export function createLogoOverlay(partial = {}) {
  const legacyScale = Number.isFinite(partial.scale) ? partial.scale : 1;
  return {
    id: partial.id || createOverlayId(),
    type: "logo",
    dataUrl: typeof partial.dataUrl === "string" ? partial.dataUrl : "",
    scaleX: Number.isFinite(partial.scaleX) ? partial.scaleX : legacyScale,
    scaleY: Number.isFinite(partial.scaleY) ? partial.scaleY : legacyScale,
    position: partial.position && Number.isFinite(partial.position.x) && Number.isFinite(partial.position.y)
      ? { x: partial.position.x, y: partial.position.y }
      : { x: 50, y: 20 },
    rotation: Number.isFinite(partial.rotation) ? partial.rotation : 0
  };
}

export function getOverlays(state) {
  return Array.isArray(state.overlays) ? state.overlays : [];
}

export function getOverlayById(state, overlayId) {
  return getOverlays(state).find((overlay) => overlay.id === overlayId) || null;
}

export function getActiveOverlay(state) {
  return getOverlayById(state, state.activeOverlayId) || null;
}

export function getOverlayType(overlay) {
  return overlay?.type === "logo" ? "logo" : overlay?.type === "text" ? "text" : null;
}

export function syncActiveOverlayState(state) {
  const overlays = getOverlays(state);
  const activeOverlay = getActiveOverlay(state) || overlays[overlays.length - 1] || null;
  state.activeOverlayId = activeOverlay?.id || null;
  state.activeOverlayTarget = getOverlayType(activeOverlay);
  return activeOverlay;
}

export function removeOverlayById(state, overlayId) {
  state.overlays = getOverlays(state).filter((overlay) => overlay.id !== overlayId);
  return syncActiveOverlayState(state);
}
