$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot

function Get-WindowsRcPath {
  $kitsRoot = 'C:\Program Files (x86)\Windows Kits\10\bin'
  if (!(Test-Path $kitsRoot)) {
    return $null
  }

  $candidates = Get-ChildItem -LiteralPath $kitsRoot -Recurse -Filter 'rc.exe' -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\x64\\rc\.exe$' } |
    Sort-Object FullName -Descending

  return $candidates | Select-Object -First 1
}

Push-Location $root
try {
  $rcExe = Get-WindowsRcPath
  if ($null -eq $rcExe) {
    throw "RC.EXE was not found under the Windows SDK path."
  }

  $rcDir = Split-Path -Parent $rcExe.FullName
  if (($env:Path -split ';') -notcontains $rcDir) {
    $env:Path = "$rcDir;$env:Path"
  }
  $env:RC = $rcExe.FullName

  Write-Host "Using RC.EXE at $($rcExe.FullName)"

  & npm.cmd run tauri build
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri build failed with exit code $LASTEXITCODE."
  }

  $buildInfoPath = Join-Path $root 'build-info.json'
  if (!(Test-Path $buildInfoPath)) {
    throw "Missing build info file at $buildInfoPath."
  }

  $buildInfo = Get-Content -LiteralPath $buildInfoPath -Raw | ConvertFrom-Json
  $displayVersion = [string]$buildInfo.displayVersion
  if ([string]::IsNullOrWhiteSpace($displayVersion)) {
    throw "Missing displayVersion in build-info.json."
  }

  $bundleDir = Join-Path $root 'src-tauri\target\release\bundle\nsis'
  if (!(Test-Path $bundleDir)) {
    throw "Bundle directory not found: $bundleDir"
  }

  $installer = Get-ChildItem -LiteralPath $bundleDir -Filter 'Photobooth_*_x64-setup.exe' |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

  if ($null -eq $installer) {
    throw "Installer not found in $bundleDir."
  }

  $targetName = "Photobooth_$displayVersion`_x64-setup.exe"
  $targetPath = Join-Path $bundleDir $targetName

  if ($installer.FullName -ne $targetPath) {
    if (Test-Path $targetPath) {
      Remove-Item -LiteralPath $targetPath -Force
    }

    Move-Item -LiteralPath $installer.FullName -Destination $targetPath
    Write-Host "Renamed installer to $targetName"
  } else {
    Write-Host "Installer already named $targetName"
  }
}
finally {
  Pop-Location
}
