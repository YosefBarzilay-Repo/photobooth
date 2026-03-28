# Photobooth Desktop App

Photobooth is now packaged as a Windows desktop application using Tauri.

## Built installer

The generated Windows installer is:

`src-tauri\target\release\bundle\nsis\Photobooth_1.0.0_x64-setup.exe`

## Install and run

1. Run `Photobooth_1.0.0_x64-setup.exe`.
2. Complete the installer.
3. Launch **Photobooth** from the Start menu or desktop shortcut.
4. The app opens in fullscreen by default.

## Desktop controls

- In the preview/result screen, use **Exit Full Screen** to leave fullscreen mode.
- In **Settings**, use **Close App** to exit the application.
- Returning to the live camera view restores fullscreen automatically.

## Local build requirements

Photobooth was built with:

- Node.js
- Rust via `rustup`
- Microsoft Visual C++ Build Tools

## Rebuild the installer

From `C:\Projects\photobooth`:

```powershell
npm.cmd run tauri build
```

That command:

- stages the static frontend into `dist\`
- builds the Tauri desktop app
- creates the NSIS installer in `src-tauri\target\release\bundle\nsis\`

## Project structure for desktop packaging

- `src-tauri\` contains the Tauri Rust project and Windows bundle configuration.
- `scripts\build-static.ps1` copies the static frontend into `dist\` before packaging.
- `src\services\desktopService.js` contains the Tauri desktop integration.

## Verified on this machine

- Installer built successfully.
- Silent install completed successfully.
- Installed executable launched successfully from:

`C:\Users\Admin\AppData\Local\Photobooth\photobooth.exe`
