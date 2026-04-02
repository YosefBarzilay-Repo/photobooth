# Echo Desktop App

Echo is packaged as a Windows desktop application using Tauri.

## Current local build

The repo is currently staged at build `21` via `build-info.json`.

## Build outputs

The main outputs are:

- Release exe: `src-tauri\target\release\echo.exe`
- Windows installer: `src-tauri\target\release\bundle\nsis\Echo_1.0.0_x64-setup.exe`
- Installed app: `C:\Users\Admin\AppData\Local\Echo\echo.exe`

## Upgrade the app yourself

From the project root:

```powershell
npm.cmd run build
```

What that does:

- increments `build\build-number.txt`
- regenerates `build-info.json`
- restages the frontend into `dist\`
- rebuilds the Tauri release exe
- creates a fresh NSIS installer

After the build finishes, install the new version with:

```powershell
Start-Process -FilePath .\src-tauri\target\release\bundle\nsis\Echo_1.0.0_x64-setup.exe -ArgumentList '/S' -Wait
```

Then launch the installed app:

```powershell
Start-Process -FilePath $env:LOCALAPPDATA\Echo\echo.exe
```

## Fast checks after upgrading

Use these to confirm you are running the new build:

- Open **Settings** and check the version label at the bottom.
- Confirm the settings order starts with **Video Editor**.
- Open **Gallery** and verify the new **Open Folder** button exists.
- Open the project dialog and confirm clicking outside does not close it.

## Frontend-only restage

If you only want to refresh `dist\` and bump the build number without rebuilding the exe, run:

```powershell
npm.cmd run build:static
```

That does not update the installed app by itself. You still need `npm.cmd run build` and reinstall if you want the desktop app to change.

## Desktop controls

- In the preview/result screen, use **Exit Full Screen** to leave fullscreen mode.
- In **Settings**, use **Close App** to exit the application.
- Returning to the live camera view restores fullscreen automatically.

## Local build requirements

Echo was built with:

- Node.js
- Rust via `rustup`
- Microsoft Visual C++ Build Tools
