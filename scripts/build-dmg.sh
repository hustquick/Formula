#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(uname -s)" == Darwin ]] || { echo 'DMG 构建需要 macOS。' >&2; exit 1; }
[[ -f web/vendor/app.bundle.js ]] || { echo '先运行 npm ci 和 node build-vendor.mjs。' >&2; exit 1; }
[[ -f web/vendor/latexlive/map_input.json ]] || { echo '缺少 LaTeXLive 离线目录；请运行 node scripts/sync-latexlive-catalog.mjs。' >&2; exit 1; }
[[ -f web/vendor/latexlive/catalog.js ]] || { echo '缺少 LaTeXLive file:// 目录脚本；请运行 node scripts/sync-latexlive-catalog.mjs。' >&2; exit 1; }
node -e "const fs=require('fs');const x=JSON.parse(fs.readFileSync('web/vendor/latexlive/map_input.json','utf8'));const s=x.shortcut||[];const t=n=>s.find(v=>v.name===n);if(t('toolbar')?.layer1?.cont?.length!==10||t('template')?.layer1?.cont?.length!==10)process.exit(1);const js=fs.readFileSync('web/vendor/latexlive/catalog.js','utf8');if(!js.startsWith('window.LaTeXLiveCatalog='))process.exit(1)"
task_version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' macos/Info.plist)
task_build_dir="$PWD/dist"
task_app="$task_build_dir/Formula.app"
task_stage=$(mktemp -d)
trap 'rm -rf "$task_stage"' EXIT
mkdir -p "$task_app/Contents/MacOS" "$task_app/Contents/Resources"
cp macos/Info.plist "$task_app/Contents/Info.plist"
cp -R web "$task_app/Contents/Resources/"
cp THIRD-PARTY-NOTICES.txt "$task_app/Contents/Resources/"
task_sdk=$(xcrun --sdk macosx --show-sdk-path)
for task_arch in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -O -sdk "$task_sdk" -target "$task_arch-apple-macosx12.0" \
    -framework Cocoa -framework WebKit -framework PDFKit macos/Formula.swift \
    -o "$task_stage/Formula-$task_arch"
done
lipo -create "$task_stage/Formula-arm64" "$task_stage/Formula-x86_64" -output "$task_app/Contents/MacOS/Formula"
lipo "$task_app/Contents/MacOS/Formula" -verify_arch arm64 x86_64
iconutil -c icns macos/Formula.iconset -o "$task_app/Contents/Resources/Formula.icns"
codesign --force --deep --sign - "$task_app"
codesign --verify --deep --strict "$task_app"
mkdir "$task_stage/image"
ditto "$task_app" "$task_stage/image/Formula.app"
ln -s /Applications "$task_stage/image/Applications"
task_dmg="$task_build_dir/Formula-$task_version.dmg"
hdiutil create -volname "Formula $task_version" -srcfolder "$task_stage/image" -format UDZO -ov "$task_dmg"
hdiutil verify "$task_dmg"
mkdir "$task_stage/mounted"
hdiutil attach -readonly -nobrowse -mountpoint "$task_stage/mounted" "$task_dmg"
[[ -x "$task_stage/mounted/Formula.app/Contents/MacOS/Formula" ]]
[[ -f "$task_stage/mounted/Formula.app/Contents/Resources/web/vendor/latexlive/map_input.json" ]]
[[ -f "$task_stage/mounted/Formula.app/Contents/Resources/web/vendor/latexlive/catalog.js" ]]
[[ "$(readlink "$task_stage/mounted/Applications")" == /Applications ]]
codesign --verify --deep --strict "$task_stage/mounted/Formula.app"
lipo "$task_stage/mounted/Formula.app/Contents/MacOS/Formula" -verify_arch arm64 x86_64
hdiutil detach "$task_stage/mounted"
(cd "$task_build_dir" && shasum -a 256 "Formula-$task_version.dmg" > "Formula-$task_version.dmg.sha256")
printf '已生成：%s\n' "$task_dmg"
