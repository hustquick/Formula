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
if [[ ! -f web/vendor/app.bundle.js ]]; then
  npm ci
  npm run build:vendor
fi
if [[ ! -f web/vendor/latexlive/catalog.js ]]; then
  npm run sync:latexlive
fi
[[ -f web/v1.1.css ]]
task_version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' macos/Info.plist)
printf '正在构建 Formula %s Mac 应用…\n' "$task_version"
# The local entry point and CI share the native bridge, runner and DMG packaging.
bash scripts/build-dmg.sh
printf '\n已生成：%s/dist/Formula-%s.dmg\n' "$PWD" "$task_version"
open -R "$PWD/dist/Formula-$task_version.dmg"
read -r -p '按回车关闭构建窗口…'
