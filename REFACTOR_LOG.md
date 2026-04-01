# Refactor Log

## Baseline

Date: 2026-04-01

- Read `scripts/test-external-slideshow.mjs` before starting changes.
- Read `scripts/test-external-slideshow-cdp.mjs` before starting changes.
- Ran `node scripts/test-external-slideshow.mjs`: PASS
- Ran `node scripts/test-external-slideshow-cdp.mjs`: FAIL
  Failure detail: the script exits before app launch because `Get-Process photobooth -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue` returns a non-zero exit code in its PowerShell helper.

## Stage 1: Build Pipeline

- Updated `scripts/build-static.ps1` to use incremental file copy for root assets plus mirrored `src/` and `styles/` directories.
- Added validation that `dist/index.html`, `dist/gallery.html`, and `dist/slideshow.html` exist after the build.
- Ran `powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1`: PASS
- Ran `node scripts/test-external-slideshow.mjs`: PASS
- Ran `node scripts/test-external-slideshow-cdp.mjs`: FAIL
  Failure detail: unchanged from baseline. The script still exits in its PowerShell helper before app launch.

## Stage 2: Dead Code Cleanup (initial pass)

- Removed a debug-only inline `console.log` bootstrap script from `slideshow.html`.
- Routed editor playback warning logs through `src/services/logger.js` instead of direct `console.warn`.
- Ran `powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1`: PASS
- Ran `node scripts/test-external-slideshow.mjs`: PASS
- Ran `node scripts/test-external-slideshow-cdp.mjs`: FAIL
  Failure detail: unchanged from baseline. The script still exits in its PowerShell helper before app launch.

## Stage 3: Test Harness Hardening

- Updated `scripts/test-external-slideshow-cdp.mjs` so cleanup tolerates a missing `photobooth` process.
- Updated `scripts/test-external-slideshow-cdp.mjs` so log-tail collection tolerates a missing desktop log file.
- Ran `node scripts/test-external-slideshow.mjs`: PASS
- Ran `node scripts/test-external-slideshow-cdp.mjs`: PASS

## Stage 4: Core Runtime and Service Refactor

- Decomposed `src/app/init.js` into a thin orchestrator and moved the main runtime implementation into `src/app/runtime.js`.
- Added centralized desktop IPC timeout and fallback handling in `src/services/desktopService.js`.
- Added camera error normalization and stream interruption logging in `src/services/cameraService.js`.
- Consolidated persisted-settings validation into a single normalization path in `src/services/settingsPersistence.js`.
- Added `desktopApiTimeoutMs` to `src/constants/appConfig.js`.
- Ran `node --input-type=module -e "await import('./src/app/init.js'); await import('./src/app/runtime.js'); await import('./src/services/desktopService.js'); await import('./src/services/cameraService.js'); await import('./src/services/settingsPersistence.js'); console.log('module-import-pass');"`: PASS
- Ran `powershell -ExecutionPolicy Bypass -File scripts/build-static.ps1`: PASS
- Ran `node scripts/test-external-slideshow.mjs`: PASS
- Ran `node scripts/test-external-slideshow-cdp.mjs`: PASS
