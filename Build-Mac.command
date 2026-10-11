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
if [[ ! -f web/vendor/latexlive/map_input.json ]]; then
  printf '正在同步 LaTeX Live 完整快捷工具与公式模板目录…\n'
  mkdir -p web/vendor/latexlive
  /usr/bin/curl --fail --location --silent --show-error \
    https://raw.githubusercontent.com/ubnm/LaTeXLive/master/json/map_input.json \
    -o web/vendor/latexlive/map_input.json
fi
/usr/bin/python3 - <<'PY'
import json, pathlib, re
p=pathlib.Path('web/vendor/latexlive/map_input.json')
data=json.loads(p.read_text(encoding='utf-8'))
sections={x.get('name'):x for x in data.get('shortcut',[])}
assert len(sections['toolbar']['layer1']['cont'])==10
assert len(sections['template']['layer1']['cont'])==10
expected_short=['常用符号','希腊字母','分数微分','根式角标','极限对数','三角函数','积分运算','大型运算','括号取整','数组矩阵']
expected_tpl=['代数','几何','不等式','积分','矩阵','三角','统计','数列','物理','化学']
assert [x['descript'] for x in sections['toolbar']['layer1']['cont']]==expected_short
assert [x['descript'] for x in sections['template']['layer1']['cont']]==expected_tpl
pathlib.Path('web/vendor/latexlive/catalog.js').write_text('window.LaTeXLiveCatalog='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
assert pathlib.Path('web/v1.1.css').stat().st_size>4000
plist=pathlib.Path('macos/Info.plist').read_text(encoding='utf-8')
assert '<string>1.1.0</string>' in plist
exact=pathlib.Path('web/latexlive-exact.js').read_text(encoding='utf-8')
assert "dataset.formulaVersion='1.1.0'" in exact
PY
printf '正在构建 Formula 1.1.0 Mac 应用；完整公式目录已离线打包…\n'
task_build_dir="$PWD/dist"
task_app_path="$task_build_dir/Formula.app"
task_tmp=$(mktemp -d)
trap 'rm -rf "$task_tmp"' EXIT
mkdir -p "$task_app_path/Contents/MacOS" "$task_app_path/Contents/Resources"
cp macos/Info.plist "$task_app_path/Contents/Info.plist"
cp -R web "$task_app_path/Contents/Resources/"
cp THIRD-PARTY-NOTICES.txt "$task_app_path/Contents/Resources/"
task_version=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' macos/Info.plist)
task_swift="$task_tmp/Formula.swift"
sed -E "s/Formula [0-9]+\.[0-9]+\.[0-9]+/Formula $task_version/g" macos/Formula.swift > "$task_swift"
task_sdk_path="$(xcrun --sdk macosx --show-sdk-path)"
task_arch="$(uname -m)"
xcrun swiftc -swift-version 5 -O -sdk "$task_sdk_path" -target "$task_arch-apple-macosx12.0" -framework Cocoa -framework WebKit -framework PDFKit "$task_swift" -o "$task_app_path/Contents/MacOS/Formula"
if [[ -d macos/Formula.iconset ]]; then
  iconutil -c icns macos/Formula.iconset -o "$task_app_path/Contents/Resources/Formula.icns"
fi
codesign --force --deep --sign - "$task_app_path"
codesign --verify --deep --strict "$task_app_path"
[[ -f "$task_app_path/Contents/Resources/web/vendor/latexlive/map_input.json" ]]
[[ -f "$task_app_path/Contents/Resources/web/vendor/latexlive/catalog.js" ]]
[[ -f "$task_app_path/Contents/Resources/web/v1.1.css" ]]
ditto -c -k --sequesterRsrc --keepParent "$task_app_path" "$task_build_dir/Formula-macOS-$task_arch.zip"
printf '\n已生成：%s\n可将 Formula.app 拖到“应用程序”文件夹。\n' "$task_app_path"
open -R "$task_app_path"
open "$task_app_path"
read -r -p '按回车关闭构建窗口…'
