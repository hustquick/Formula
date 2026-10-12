#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ "$(uname -s)" == Darwin ]] || { echo 'DMG 构建需要 macOS。' >&2; exit 1; }
[[ -f web/vendor/app.bundle.js ]] || { echo '先运行 npm ci 和 node build-vendor.mjs。' >&2; exit 1; }
[[ -f web/vendor/latexlive/map_input.json ]] || { echo '缺少 LaTeXLive 离线目录；请运行 node scripts/sync-latexlive-catalog.mjs。' >&2; exit 1; }
[[ -f web/vendor/latexlive/catalog.js ]] || { echo '缺少 LaTeXLive file:// 目录脚本；请运行 node scripts/sync-latexlive-catalog.mjs。' >&2; exit 1; }
[[ -f web/v1.1.css ]] || { echo '缺少 v1.1 视觉层。' >&2; exit 1; }
[[ -f web/ocr.js ]] || { echo '缺少图片公式识别前端。' >&2; exit 1; }
[[ -f macos/FormulaOCR.swift ]] || { echo '缺少图片公式识别原生桥接。' >&2; exit 1; }
[[ -f macos/formula-ocr-runner.py ]] || { echo '缺少 Pix2Text 启动脚本。' >&2; exit 1; }
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
cp macos/formula-ocr-runner.py "$task_app/Contents/Resources/formula-ocr-runner.py"
# Keep the native About panel in lock-step with Info.plist without duplicating release metadata.
task_swift="$task_stage/Formula.swift"
sed -E "s/Formula [0-9]+\.[0-9]+\.[0-9]+/Formula $task_version/g" macos/Formula.swift > "$task_swift"
# Swift only permits top-level executable statements in the main source file when multiple files are compiled.
# Build one staged main.swift by inserting the OCR extension before the existing app startup block.
task_main="$task_stage/main.swift"
task_ocr_body="$task_stage/FormulaOCR.body.swift"
sed '/^import Cocoa$/d;/^import WebKit$/d' macos/FormulaOCR.swift > "$task_ocr_body"
awk -v extra="$task_ocr_body" '
  /^let app=NSApplication\.shared$/ && !inserted {
    while ((getline line < extra) > 0) print line
    close(extra)
    inserted=1
  }
  { print }
' "$task_swift" > "$task_main"
grep -q 'extension AppDelegate' "$task_main" || { echo 'OCR Swift 扩展合并失败。' >&2; exit 1; }
task_sdk=$(xcrun --sdk macosx --show-sdk-path)
for task_arch in arm64 x86_64; do
  xcrun swiftc -swift-version 5 -O -sdk "$task_sdk" -target "$task_arch-apple-macosx12.0" \
    -framework Cocoa -framework WebKit -framework PDFKit "$task_main" \
    -o "$task_stage/Formula-$task_arch"
done
lipo -create "$task_stage/Formula-arm64" "$task_stage/Formula-x86_64" -output "$task_app/Contents/MacOS/Formula"
[[ "$(lipo -archs "$task_app/Contents/MacOS/Formula")" == "x86_64 arm64" || "$(lipo -archs "$task_app/Contents/MacOS/Formula")" == "arm64 x86_64" ]]
iconutil -c icns macos/Formula.iconset -o "$task_app/Contents/Resources/Formula.icns"
xattr -cr "$task_app"
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
[[ -f "$task_stage/mounted/Formula.app/Contents/Resources/web/v1.1.css" ]]
[[ -f "$task_stage/mounted/Formula.app/Contents/Resources/web/ocr.js" ]]
[[ -f "$task_stage/mounted/Formula.app/Contents/Resources/formula-ocr-runner.py" ]]
[[ "$(readlink "$task_stage/mounted/Applications")" == /Applications ]]
codesign --verify --deep --strict "$task_stage/mounted/Formula.app"
[[ "$(lipo -archs "$task_stage/mounted/Formula.app/Contents/MacOS/Formula")" == "x86_64 arm64" || "$(lipo -archs "$task_stage/mounted/Formula.app/Contents/MacOS/Formula")" == "arm64 x86_64" ]]
hdiutil detach "$task_stage/mounted"
(cd "$task_build_dir" && shasum -a 256 "Formula-$task_version.dmg" > "Formula-$task_version.dmg.sha256")
printf '已生成：%s\n' "$task_dmg"
