#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
trap 'printf "\n构建失败。请保留上面的错误信息。\n"; read -r -p "按回车关闭…"' ERR
if [[ "$(uname -s)" != "Darwin" ]]; then
  printf '这个入口需要在 Mac 上运行。\n'; exit 1
fi
if ! xcrun --find swiftc >/dev/null 2>&1; then
  printf '首次构建需要 Apple Command Line Tools；现在打开系统安装提示。\n安装完成后请再次双击本文件。\n'
  xcode-select --install || true
  read -r -p '按回车关闭…'; exit 0
fi
printf '正在构建 Formula Mac 应用，无需 Node.js、npm 或联网下载依赖…\n'
task_build_dir="$PWD/dist"
task_app_path="$task_build_dir/Formula.app"
mkdir -p "$task_app_path/Contents/MacOS" "$task_app_path/Contents/Resources"
cp macos/Info.plist "$task_app_path/Contents/Info.plist"
cp -R web "$task_app_path/Contents/Resources/"
cp THIRD-PARTY-NOTICES.txt "$task_app_path/Contents/Resources/"
task_sdk_path="$(xcrun --sdk macosx --show-sdk-path)"
task_arch="$(uname -m)"
xcrun swiftc -swift-version 5 -O -sdk "$task_sdk_path" -target "$task_arch-apple-macosx12.0" -framework Cocoa -framework WebKit -framework PDFKit macos/Formula.swift -o "$task_app_path/Contents/MacOS/Formula"
if [[ -d macos/Formula.iconset ]]; then
  iconutil -c icns macos/Formula.iconset -o "$task_app_path/Contents/Resources/Formula.icns"
fi
codesign --force --deep --sign - "$task_app_path"
ditto -c -k --sequesterRsrc --keepParent "$task_app_path" "$task_build_dir/Formula-macOS-$task_arch.zip"
printf '\n已生成：%s\n可将 Formula.app 拖到“应用程序”文件夹。\n' "$task_app_path"
open -R "$task_app_path"
open "$task_app_path"
read -r -p '按回车关闭构建窗口…'
