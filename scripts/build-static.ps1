$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$buildDir = Join-Path $root 'build'
$buildNumberFile = Join-Path $buildDir 'build-number.txt'
$rootFilesToCopy = @(
  'index.html',
  'gallery.html',
  'slideshow.html',
  'styles.css',
  'build-info.json'
)
$directoriesToMirror = @(
  @{ Source = (Join-Path $root 'src'); Destination = (Join-Path $dist 'src') },
  @{ Source = (Join-Path $root 'styles'); Destination = (Join-Path $dist 'styles') }
)

function Ensure-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (!(Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

function Get-FileHashOrNull {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if (!(Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }

  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
}

function Copy-FileIfChanged {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  $sourceHash = Get-FileHashOrNull -Path $Source
  if ($null -eq $sourceHash) {
    throw "Missing source file: $Source"
  }

  $destinationHash = Get-FileHashOrNull -Path $Destination
  if ($sourceHash -eq $destinationHash) {
    return $false
  }

  Ensure-Directory -Path (Split-Path -Parent $Destination)
  Copy-Item -LiteralPath $Source -Destination $Destination -Force
  return $true
}

function Sync-Directory {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Source,
    [Parameter(Mandatory = $true)]
    [string]$Destination
  )

  if (!(Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Missing source directory: $Source"
  }

  Ensure-Directory -Path $Destination

  $copiedCount = 0
  $sourceItems = Get-ChildItem -LiteralPath $Source -Recurse -File
  $expectedPaths = New-Object 'System.Collections.Generic.HashSet[string]' ([System.StringComparer]::OrdinalIgnoreCase)

  foreach ($item in $sourceItems) {
    $relativePath = $item.FullName.Substring($Source.Length).TrimStart('\')
    $destinationPath = Join-Path $Destination $relativePath
    [void]$expectedPaths.Add($destinationPath)

    if (Copy-FileIfChanged -Source $item.FullName -Destination $destinationPath) {
      $copiedCount += 1
    }
  }

  $destinationItems = Get-ChildItem -LiteralPath $Destination -Recurse -File
  foreach ($item in $destinationItems) {
    if (!$expectedPaths.Contains($item.FullName)) {
      Remove-Item -LiteralPath $item.FullName -Force
    }
  }

  $destinationDirectories = Get-ChildItem -LiteralPath $Destination -Recurse -Directory | Sort-Object FullName -Descending
  foreach ($directory in $destinationDirectories) {
    if ((Get-ChildItem -LiteralPath $directory.FullName -Force | Measure-Object).Count -eq 0) {
      Remove-Item -LiteralPath $directory.FullName -Force
    }
  }

  return $copiedCount
}

Ensure-Directory -Path $buildDir

$buildNumber = 0
if (Test-Path -LiteralPath $buildNumberFile) {
  $parsedBuildNumber = 0
  if ([int]::TryParse((Get-Content -Raw $buildNumberFile).Trim(), [ref]$parsedBuildNumber)) {
    $buildNumber = $parsedBuildNumber
  }
}

$buildNumber += 1
Set-Content -LiteralPath $buildNumberFile -Value $buildNumber

$buildInfoJson = @{
  buildNumber = $buildNumber.ToString()
  version = '1.0.0'
  displayVersion = "1.0.0.0_$buildNumber"
} | ConvertTo-Json
Set-Content -LiteralPath (Join-Path $root 'build-info.json') -Value $buildInfoJson

Ensure-Directory -Path $dist

$copiedRootFiles = 0
foreach ($relativePath in $rootFilesToCopy) {
  $sourcePath = Join-Path $root $relativePath
  $destinationPath = Join-Path $dist $relativePath
  if (Copy-FileIfChanged -Source $sourcePath -Destination $destinationPath) {
    $copiedRootFiles += 1
  }
}

$copiedDirectoryFiles = 0
foreach ($directoryPair in $directoriesToMirror) {
  $copiedDirectoryFiles += Sync-Directory -Source $directoryPair.Source -Destination $directoryPair.Destination
}

$requiredDistFiles = @(
  (Join-Path $dist 'index.html'),
  (Join-Path $dist 'gallery.html'),
  (Join-Path $dist 'slideshow.html')
)

$missingFiles = @($requiredDistFiles | Where-Object { !(Test-Path -LiteralPath $_ -PathType Leaf) })
if ($missingFiles.Count -gt 0) {
  throw "Static build validation failed. Missing files: $($missingFiles -join ', ')"
}

Write-Host "Photobooth build number: $buildNumber"
Write-Host "Copied $copiedRootFiles root file(s) and $copiedDirectoryFiles mirrored file(s)."
