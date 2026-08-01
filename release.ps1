param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [string]$Notes = ""
)

$ErrorActionPreference = "Stop"

# Use GH_TOKEN or GITHUB_TOKEN from environment
# NEVER store tokens in files — set via:
#   $env:GH_TOKEN="ghp_xxx"  (PowerShell)
$token = $env:GH_TOKEN
if (-not $token) { $token = $env:GITHUB_TOKEN }
if (-not $token) {
  Write-Error "Missing GitHub token. Set env var GH_TOKEN or GITHUB_TOKEN."
  exit 1
}

# Abort early if the tag or release already exists
$env:GH_TOKEN = $token
$env:Path = "C:\Program Files\GitHub CLI;$env:Path"
gh release view "v$Version" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Error "Release v$Version already exists. Pick a new version."
  exit 1
}

# Update version in package.json (regex replace to preserve file formatting/encoding)
$raw = Get-Content "package.json" -Raw -Encoding UTF8
$newRaw = [regex]::Replace($raw, '"version"\s*:\s*"[^"]+"', ('"version": "' + $Version + '"'), 1)
if ($newRaw -eq $raw) { Write-Error "Could not find version field in package.json"; exit 1 }
[System.IO.File]::WriteAllText((Resolve-Path "package.json"), $newRaw, (New-Object System.Text.UTF8Encoding $false))

# Build
# CSC_IDENTITY_AUTO_DISCOVERY=false skips code-signing discovery (no cert configured),
# which avoids electron-builder downloading winCodeSign and failing on macOS symlinks.
# npm.cmd is used explicitly because npm.ps1 is blocked by the PowerShell execution policy.
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
npm.cmd run dist
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

# Artifacts are already named IPTV-Player-Setup-<version>.exe/.blockmap by electron-builder.

# Create GitHub release
$exeName = "IPTV-Player-Setup-$Version.exe"
$blockName = "IPTV-Player-Setup-$Version.exe.blockmap"
$releaseArgs = @(
  "release", "create", "v$Version",
  "release\$exeName", "release\$blockName", "release\latest.yml",
  "--title", "IPTV Player v$Version"
)
if ($Notes -and $Notes.Trim().Length -gt 0) {
  $releaseArgs += @("--notes", $Notes)
} else {
  $releaseArgs += @("--notes", "IPTV Player v$Version")
}
& gh @releaseArgs
if ($LASTEXITCODE -ne 0) { throw "gh release create failed" }

Write-Output "Release v$Version published!"
