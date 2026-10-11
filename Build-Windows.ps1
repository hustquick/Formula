$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

Write-Host 'Building shared Formula web resources...'
npm ci
node build-vendor.mjs
node scripts/sync-latexlive-catalog.mjs
node scripts/validate-v1.1.mjs

Write-Host 'Installing Windows desktop runtime...'
Push-Location windows
npm install --no-audit --no-fund
Pop-Location

$version = (Get-Content windows/package.json -Raw | ConvertFrom-Json).version
$electron = Join-Path $PSScriptRoot 'windows/node_modules/electron/dist'
if (-not (Test-Path (Join-Path $electron 'electron.exe'))) { throw 'Electron runtime was not installed correctly.' }

$outRoot = Join-Path $PSScriptRoot 'dist'
$stage = Join-Path $outRoot 'Formula-Windows-x64'
$appDir = Join-Path $stage 'resources/app'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item $stage -ItemType Directory -Force | Out-Null
Copy-Item (Join-Path $electron '*') $stage -Recurse -Force
Rename-Item (Join-Path $stage 'electron.exe') 'Formula.exe'
New-Item $appDir -ItemType Directory -Force | Out-Null

Copy-Item windows/main.cjs $appDir
Copy-Item windows/preload.cjs $appDir
Copy-Item web (Join-Path $appDir 'web') -Recurse -Force
Copy-Item THIRD-PARTY-NOTICES.txt $appDir
Copy-Item macos/Formula.iconset/icon_256x256.png (Join-Path $appDir 'Formula.png')
Copy-Item windows/node_modules (Join-Path $appDir 'node_modules') -Recurse -Force

@"
{
  "name": "formula",
  "productName": "Formula",
  "version": "$version",
  "main": "main.cjs"
}
"@ | Set-Content (Join-Path $appDir 'package.json') -Encoding UTF8

if (-not (Test-Path (Join-Path $appDir 'web/vendor/latexlive/catalog.js'))) { throw 'Offline LaTeX Live catalog missing from Windows package.' }
if (-not (Test-Path (Join-Path $appDir 'web/vendor/app.bundle.js'))) { throw 'Formula web bundle missing from Windows package.' }

$zip = Join-Path $outRoot "Formula-$version-Windows-x64.zip"
Remove-Item $zip -Force -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal
$hash = (Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant()
"$hash  $(Split-Path $zip -Leaf)" | Set-Content "$zip.sha256" -Encoding ascii
Write-Host "Built: $zip"
