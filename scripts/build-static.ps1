$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$buildDir = Join-Path $root 'build'
$buildNumberFile = Join-Path $buildDir 'build-number.txt'

if (!(Test-Path $buildDir)) {
  New-Item -ItemType Directory -Path $buildDir | Out-Null
}

$buildNumber = 0
if (Test-Path $buildNumberFile) {
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

if (Test-Path $dist) {
  Remove-Item -LiteralPath $dist -Recurse -Force
}

New-Item -ItemType Directory -Path $dist | Out-Null
Copy-Item -LiteralPath (Join-Path $root 'index.html') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'gallery.html') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'slideshow.html') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'styles.css') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'build-info.json') -Destination $dist
Copy-Item -LiteralPath (Join-Path $root 'src') -Destination (Join-Path $dist 'src') -Recurse
Copy-Item -LiteralPath (Join-Path $root 'styles') -Destination (Join-Path $dist 'styles') -Recurse
Write-Host "Photobooth build number: $buildNumber"
