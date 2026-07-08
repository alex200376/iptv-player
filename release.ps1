param(
  [Parameter(Mandatory = $true)]
  [string]$Version,
  [string]$Notes = ""
)

$ErrorActionPreference = "Stop"

# Read token from .env.local
$envContent = Get-Content ".env.local" -ErrorAction Stop | Where-Object { $_ -match '^GITHUB_TOKEN=' }
if (-not $envContent) {
  Write-Error ".env.local missing GITHUB_TOKEN"
  exit 1
}
$token = $envContent -replace '^GITHUB_TOKEN='

# Update version in package.json
$pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$pkg.version = $Version
$pkg | ConvertTo-Json -Depth 10 | Set-Content "package.json"

# Build
npm run dist
if ($LASTEXITCODE -ne 0) { throw "Build failed" }

# Rename files to match latest.yml naming
$exeName = "IPTV-Player-Setup-$Version.exe"
$blockName = "IPTV-Player-Setup-$Version.exe.blockmap"
Rename-Item -Path "release\IPTV Player Setup $Version.exe" -NewName $exeName -ErrorAction SilentlyContinue
Rename-Item -Path "release\IPTV Player Setup $Version.exe.blockmap" -NewName $blockName -ErrorAction SilentlyContinue

# Create GitHub release
$env:GH_TOKEN = $token
$env:Path = "C:\Program Files\GitHub CLI;$env:Path"
gh release create "v$Version" "release\$exeName" "release\$blockName" "release\latest.yml" `
  --title "IPTV Player v$Version" `
  --notes $Notes

Write-Output "Release v$Version published!"
