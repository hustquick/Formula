#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ $(uname -s) == Darwin ]]
task_target="/Applications/Formula.app"
# Anchor the executable path; allow launch arguments, reject command-line substrings.
formula_process_status() {
  local task_status
  if pgrep -f -x '/Applications/Formula[.]app/Contents/MacOS/Formula([[:space:]].*)?' >/dev/null; then
    return 0
  else
    task_status=$?
  fi
  case "$task_status" in
    1) return 1 ;;
    *) echo "Formula 进程检测失败（pgrep: ${task_status}），停止部署" >&2; return 2 ;;
  esac
}
require_formula_stopped() {
  local task_status
  if formula_process_status; then
    echo '请保存并正常退出 Formula' >&2
    echo 'NEEDS_USER_ACTION: SAVE_AND_QUIT_FORMULA' >&2
    return 1
  else
    task_status=$?
  fi
  [[ "$task_status" == 1 ]]
}
require_formula_stopped || exit 1
task_stage=$(mktemp -d)
trap 'rm -rf "$task_stage"' EXIT
[[ -d /Applications/Formula.app ]] || { echo '需要已安装的正式版作为离线资源基线'; exit 1; }
# Reuse verified offline assets; compile the current native source and replace current UI.
ditto --noextattr --noqtn /Applications/Formula.app "$task_stage/Formula.app"
task_app="$task_stage/Formula.app"
python3 - "$task_stage" <<'PY'
from pathlib import Path
import sys,plistlib
stage=Path(sys.argv[1]);app=stage/'Formula.app'
s=Path('macos/Formula.swift').read_text()
extra=Path('macos/FormulaOCR.swift').read_text()+Path('macos/FormulaDocument.swift').read_text()
s=s.replace('let app=NSApplication.shared',extra+'\nlet app=NSApplication.shared')
(stage/'main.swift').write_text(s)
p=app/'Contents/Info.plist';p.write_bytes(Path('macos/Info.plist').read_bytes())
PY
xcrun swiftc -swift-version 5 -O -framework Cocoa -framework WebKit -framework PDFKit "$task_stage/main.swift" -o "$task_app/Contents/MacOS/Formula"
for task_file in index.html v1.1.css style.css ocr.js latexlive-exact.js latexlive-menus.js latexlive-menus.css; do cp "web/$task_file" "$task_app/Contents/Resources/web/$task_file"; done
npm run build:vendor
cp web/completion-data/LICENSE.txt "$task_app/Contents/Resources/LaTeX-Workshop-LICENSE.txt"
cp web/vendor/latexlive/catalog.js "$task_app/Contents/Resources/web/vendor/latexlive/catalog.js"
cp web/vendor/latexlive/map_input.json "$task_app/Contents/Resources/web/vendor/latexlive/map_input.json"
ditto --noextattr --noqtn web/vendor "$task_app/Contents/Resources/web/vendor"
for task_file in formula-ocr-runner.py formula-document-runner.py formula-latex-ooxml.py formula-wps-clipboard.py formula-wps-import.py ocr-requirements.txt unimernet-requirements.txt document-requirements.txt; do cp "macos/$task_file" "$task_app/Contents/Resources/$task_file"; done
python3 - "$task_app" <<'PYVERIFY'
import hashlib,sys
from pathlib import Path
source=Path('web');target=Path(sys.argv[1])/'Contents/Resources/web'
for path in source.rglob('*'):
 if not path.is_file() or path.name=='app.js' or path.suffix=='.mjs' or 'completion-data' in path.parts: continue
 dest=target/path.relative_to(source)
 if not dest.is_file() or hashlib.sha256(path.read_bytes()).digest()!=hashlib.sha256(dest.read_bytes()).digest():
  raise SystemExit('Resource verification failed: '+str(path))
print('Verified current offline web resource manifest')
PYVERIFY
codesign --force --deep --sign - "$task_app"
codesign --verify --deep --strict "$task_app"
require_formula_stopped || exit 1
[[ "$task_target" == /Applications/Formula.app ]]
[[ $(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$task_target/Contents/Info.plist") == org.mathforge.desktop ]]
task_backup="$HOME/Library/Application Support/Formula-Backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$task_backup"
ditto --noextattr --noqtn "$task_target" "$task_backup/Formula.app"
# Replace only application contents, never Application Support or OCR data.
task_next="/Applications/.Formula-local-$$.app"
task_previous="/Applications/.Formula-previous-$$.app"
ditto --noextattr --noqtn "$task_app" "$task_next"
codesign --verify --deep --strict "$task_next"
require_formula_stopped || exit 1
mv "$task_target" "$task_previous"
if ! mv "$task_next" "$task_target"; then mv "$task_previous" "$task_target"; exit 1; fi
if ! codesign --verify --deep --strict "$task_target"; then mv "$task_target" "$task_stage/failed.app"; mv "$task_previous" "$task_target"; exit 1; fi
open -n "$task_target" || true
for task_attempt in {1..10}; do
  if formula_process_status; then
    mv "$task_previous" "$task_stage/previous.app"
    echo "已安装并启动：${task_target}；备份：$task_backup"
    exit 0
  else
    task_status=$?
  fi
  if [[ "$task_status" != 1 ]]; then
    echo "无法确认启动状态，保留当前应用和原应用：${task_previous}；备份：$task_backup" >&2
    exit 1
  fi
  sleep 1
done
# Recheck immediately before rollback; never move an app with unknown/running status.
if formula_process_status; then
  echo "已确认新版本启动：${task_target}；备份：$task_backup"
  exit 0
else
  task_status=$?
fi
if [[ "$task_status" != 1 ]]; then
  echo "无法确认进程状态，未回滚；原应用：${task_previous}；备份：$task_backup" >&2
  exit 1
fi
mv "$task_target" "$task_stage/failed.app"
mv "$task_previous" "$task_target"
open "$task_target"
echo '未确认新版本启动，已回滚到原应用' >&2
exit 1
