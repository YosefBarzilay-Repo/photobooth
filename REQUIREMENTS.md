# SnapBooth Requirements

This file is the implementation guide for the app. It converts the PRD into a practical build checklist and acceptance criteria.

## Product Summary

SnapBooth is a client-side web photo booth built with HTML, CSS, and vanilla JavaScript.

Constraints:
- No backend
- No uploads
- No accounts
- Everything runs locally in the browser

Experience goals:
- Nostalgic, tactile, retro photo booth feel
- Simple one-session workflow from camera to edited image to download
- Works on modern desktop and mobile browsers that support camera access

## Tech Stack

- HTML
- CSS
- Vanilla JavaScript
- Browser APIs:
  - `navigator.mediaDevices.getUserMedia`
  - `HTMLCanvasElement`
  - `canvas.toDataURL()` or equivalent canvas export flow
  - anchor `download`

## Core User Flow

1. User opens the app.
2. User grants camera access.
3. User sees a live camera preview.
4. User presses `Snap`.
5. App shows a `3, 2, 1` countdown.
6. App shows a flash effect and captures the frame.
7. User enters edit mode.
8. User optionally selects a decorative frame.
9. User optionally adds one or more text overlays.
10. User drags text overlays into place.
11. User downloads the final composition as a PNG.

## Implementation Checklist

### Foundation

- [x] Create app shell in `index.html`
- [x] Create styling in `styles.css`
- [x] Create behavior in `app.js`
- [x] Keep the app fully client-side with no server dependencies
- [x] Ensure the app loads with no build step required

### Camera Capture

- [x] Request camera access with `getUserMedia`
- [x] Render live camera preview in the main viewport
- [x] Show a clear error state if camera access fails or is denied
- [x] Add a single primary `Snap` button
- [x] Trigger a visible `3, 2, 1` countdown before capture
- [x] Add a flash animation when the capture happens
- [x] Capture the current frame from the live stream into a canvas
- [x] Transition from camera mode to edit mode after capture

Acceptance criteria:
- User can see a live camera feed before capture
- Pressing `Snap` never captures instantly; countdown runs first
- Captured image matches the visible frame orientation expected by the UI

### Editing Canvas

- [x] Display the captured photo inside an editable composition area
- [x] Use canvas-based rendering for the final exported image
- [x] Re-render composition when frame or text changes
- [x] Preserve image quality reasonably for downloaded output

Acceptance criteria:
- The editing view always reflects what will be downloaded
- Frame and text changes update without reloading the page

### Frame Gallery

- [x] Add a horizontal scrollable frame tray
- [x] Include `No frame` as the default option
- [x] Support one active frame at a time
- [x] Swap frames instantly when a new frame is selected
- [x] Load frame assets as PNG overlays
- [x] Prepare initial frame set:
- [x] Classic white border
- [x] Polaroid
- [x] Film strip
- [x] Neon
- [x] Floral
- [x] Minimal black

Acceptance criteria:
- User can switch frames repeatedly without breaking the canvas
- Only one frame is active at a time
- `No frame` removes the overlay completely

### Text Overlay Tool

- [x] Add text input control
- [x] Add font selector
- [x] Add color picker
- [x] Add text size control
- [x] Allow user to place text by clicking or tapping the canvas
- [x] Support multiple text elements
- [x] Allow selecting an existing text element
- [x] Allow dragging selected text elements
- [x] Show a delete control for the selected text element
- [x] Remove only the selected text element when delete is used

Acceptance criteria:
- User can place more than one text element
- Text remains editable in position after placement
- Dragging feels stable on both mouse and touch input
- Deleting one text element does not affect the others

### Download

- [x] Add a `Download` button
- [x] Export the final composition as a PNG
- [x] Generate filename as `snapbooth-[timestamp].png`
- [x] Use a fully local browser download flow

Acceptance criteria:
- Downloaded file includes photo, selected frame, and all placed text
- No network request is required to save the image

### UI and UX

- [x] Create a retro / tactile visual direction
- [x] Make primary actions obvious: `Snap`, frame select, text add, download
- [x] Provide visible mode change between camera and editor
- [x] Make horizontal frame tray easy to use on touch devices
- [x] Ensure layout works on desktop and mobile screen sizes
- [x] Keep interactions responsive and lightweight

Acceptance criteria:
- App remains usable on a narrow mobile viewport
- Main actions are accessible without confusion

### State and Architecture

- [x] Keep app state in browser memory only
- [x] Track current mode: camera or editor
- [x] Track active frame selection
- [x] Track placed text items with position and style data
- [x] Centralize canvas redraw logic
- [x] Separate capture logic, render logic, and interaction logic clearly

### Non-Goals

- [x] No backend API
- [x] No authentication
- [x] No cloud storage
- [x] No photo uploads
- [x] No image filters unless added later as a separate feature

## Suggested Asset Structure

```text
/
  index.html
  styles.css
  app.js
  assets/
    frames/
      classic-white.png
      polaroid.png
      film-strip.png
      neon.png
      floral.png
      minimal-black.png
```

Current implementation note:
- Frame overlays are generated as local PNG data URLs at runtime so the app stays self-contained while still rendering image-based overlays on the composition canvas.

## Build Order

1. Foundation layout and styling
2. Camera preview and capture
3. Editing canvas
4. Frame tray and frame rendering
5. Text placement and dragging
6. PNG export
7. Mobile polish and UX refinement

## Definition of Done

The app is done when:
- A user can open the page and grant camera access
- A user can take a photo with countdown and flash feedback
- A user can apply one frame or no frame
- A user can add, move, and delete multiple text overlays
- A user can download the finished image as a PNG
- The full flow works locally with only HTML, CSS, and vanilla JavaScript
