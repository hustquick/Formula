#!/usr/bin/env python3
"""Build the Mac source/bootstrap archive and verify executable permissions."""
from pathlib import Path
import plistlib
import shutil
import zipfile
from PIL import Image

source = Path(__file__).resolve().parent
root = source.parent / 'delivery' / 'Formula-Mac'
app = root / 'Formula.app'
resources = app / 'Contents' / 'Resources'
executables = app / 'Contents' / 'MacOS'
resources.mkdir(parents=True, exist_ok=True)
executables.mkdir(parents=True, exist_ok=True)
for name in ['web', 'macos', 'tests']:
    shutil.copytree(source / name, resources / name, dirs_exist_ok=True)
for name in ['README.md', 'VALIDATION.md', 'THIRD-PARTY-NOTICES.txt',
             'package.json', 'package-lock.json', 'build-vendor.mjs',
             'Build-Mac.command', 'package-mac.py']:
    shutil.copy2(source / name, resources / name)
for name in ['README.md', 'VALIDATION.md']:
    shutil.copy2(source / name, root / name)
shutil.copy2(source / 'macos' / 'FirstLaunch.sh', executables / 'Formula')
info = plistlib.loads((source / 'macos' / 'Info.plist').read_bytes())
info['CFBundleIdentifier'] = 'org.mathforge.bootstrap'
info.pop('CFBundleDocumentTypes', None)
(app / 'Contents' / 'Info.plist').write_bytes(plistlib.dumps(info))
Image.open(source / 'macos' / 'Formula.iconset' / 'icon_512x512@2x.png').save(
    resources / 'Formula.icns', format='ICNS')
(root / 'Build-Mac.command').write_text(
    '#!/bin/bash\nset -euo pipefail\n'
    'cd "$(dirname "$0")/Formula.app/Contents/Resources"\n'
    'exec /bin/bash Build-Mac.command\n')
# Set permissions AFTER every copy2 operation; copy2 preserves the source mode.
executable_paths = [executables / 'Formula', root / 'Build-Mac.command',
                    resources / 'Build-Mac.command', resources / 'macos' / 'FirstLaunch.sh']
for file in executable_paths:
    file.chmod(0o755)
archive = root.parent / 'Formula-Mac.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for file in root.rglob('*'):
        if file.is_file():
            z.write(file, file.relative_to(root.parent))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None, 'Archive has corrupt entries'
    for file in executable_paths:
        entry = z.getinfo(str(file.relative_to(root.parent)))
        mode = (entry.external_attr >> 16) & 0o777
        assert mode == 0o755, f'Executable permission lost: {entry.filename}: {mode:o}'
    launcher = z.read(str((executables / 'Formula').relative_to(root.parent)))
    assert launcher.startswith(b'#!/bin/bash\n'), 'Invalid launcher shebang'
print(f'Validated {archive}: {archive.stat().st_size} bytes, all launchers 755')
