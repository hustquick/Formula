#!/bin/bash
set -euo pipefail
task_resources="$(cd "$(dirname "$0")/../Resources" && pwd)"
task_support="$HOME/Library/Application Support/MathForge"
mkdir -p "$task_support"
task_log="$task_support/build.log"
task_notice() { /usr/bin/osascript -e 'display notification "正在准备 Formula 原生应用，首次启动约需几十秒。" with title "Formula"' >/dev/null 2>&1 || true; }
task_fail() {
  /usr/bin/osascript -e 'display dialog "Formula 构建失败。即将打开编译日志，请保留错误信息以便排查。" with title "Formula" buttons {"打开日志"} default button 1' >/dev/null 2>&1 || true
  /usr/bin/open -t "$task_log"
}
trap task_fail ERR
if ! /usr/bin/xcrun --find swiftc >/dev/null 2>&1; then
  /usr/bin/osascript -e 'display dialog "首次启动需要 Apple Command Line Tools。系统将显示安装窗口；安装完成后，再次打开 Formula 即可。无需安装 Node.js 或 npm。" with title "Formula" buttons {"安装"} default button 1' >/dev/null 2>&1 || true
  /usr/bin/xcode-select --install >> "$task_log" 2>&1 || true
  exit 0
fi
task_arch="$(uname -m)"
task_hash="$(/usr/bin/shasum -a 256 "$task_resources/macos/Formula.swift" "$task_resources/macos/Info.plist" "$task_resources/web/index.html" "$task_resources/web/style.css" "$task_resources/web/vendor/app.bundle.js" "$task_resources/THIRD-PARTY-NOTICES.txt" | /usr/bin/shasum -a 256 | /usr/bin/cut -d ' ' -f 1)"
task_runtime="$task_support/Builds/$task_hash-$task_arch/Formula.app"
if [[ ! -x "$task_runtime/Contents/MacOS/Formula" ]]; then
  task_notice
  task_stage="$(mktemp -d "$task_support/Builds-stage.XXXXXX")"
  task_staged_app="$task_stage/Formula.app"
  mkdir -p "$task_staged_app/Contents/MacOS" "$task_staged_app/Contents/Resources"
  cp "$task_resources/macos/Info.plist" "$task_staged_app/Contents/Info.plist"
  cp -R "$task_resources/web" "$task_staged_app/Contents/Resources/"
  cp "$task_resources/THIRD-PARTY-NOTICES.txt" "$task_staged_app/Contents/Resources/"
  task_sdk="$(/usr/bin/xcrun --sdk macosx --show-sdk-path)"
  /usr/bin/xcrun swiftc -swift-version 5 -O -sdk "$task_sdk" -target "$task_arch-apple-macosx12.0" -framework Cocoa -framework WebKit -framework PDFKit "$task_resources/macos/Formula.swift" -o "$task_staged_app/Contents/MacOS/Formula" > "$task_log" 2>&1
  /usr/bin/iconutil -c icns "$task_resources/macos/Formula.iconset" -o "$task_staged_app/Contents/Resources/Formula.icns" >> "$task_log" 2>&1
  /usr/bin/codesign --force --deep --sign - "$task_staged_app" >> "$task_log" 2>&1
  mkdir -p "$(dirname "$task_runtime")"
  mv "$task_staged_app" "$task_runtime"
  rmdir "$task_stage"
fi
/usr/bin/open -n "$task_runtime"
