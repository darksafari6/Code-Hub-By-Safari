#!/usr/bin/env bash
# Build a self-contained Linux application bundle:
#
#   dist-linux/SafariAIDevStudio-<version>-x86_64/
#       safari-ai-dev-studio   launcher (Bash)
#       install.sh            desktop entry + icon + ~/.local/bin symlink
#       python/safari/        the application
#       vendor/               FastAPI, uvicorn, httpx, python-dotenv
#       dist/                 the built client bundle
#       share/icons/...       icons
#       share/*.desktop       desktop entry
#   dist-linux/SafariAIDevStudio-<version>-x86_64.tar.gz
#
# Runtime requirement: python3 >= 3.11 (present on every Linux development
# machine). No Node, no npm, no pip, no network at run time.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

VERSION="$(python3 -c 'import json;print(json.load(open("package.json"))["version"])')"
ARCH="$(uname -m)"
NAME="SafariAIDevStudio-${VERSION}-${ARCH}"
OUT="dist-linux/${NAME}"
APPDIR="dist-linux/SafariAIDevStudio.AppDir"
PYTHON="${PACKAGING_PYTHON:-$ROOT/.venv/bin/python}"
APP_ID="safari-ai-dev-studio"

[ -x "$PYTHON" ] || PYTHON="$(command -v python3)"

if ! "$PYTHON" -m pip --version >/dev/null 2>&1; then
  echo "error: $PYTHON has no pip, which is needed to vendor the dependencies." >&2
  echo "       Run ./scripts/install.sh first, or set PACKAGING_PYTHON=/path/to/python." >&2
  exit 1
fi

echo "==> packaging ${NAME} with $($PYTHON --version)"

if [ ! -f dist/index.html ]; then
  echo "==> building the client bundle"
  npm run build
fi

rm -rf "$OUT" "$APPDIR"
mkdir -p "$OUT"/{python,vendor,share/icons} "$APPDIR"

echo "==> vendoring Python dependencies"
"$PYTHON" -m pip install --quiet --target "$OUT/vendor" --no-compile -r python/requirements.txt

echo "==> copying the application"
cp -r python/safari "$OUT/python/"
find "$OUT/python" -name '*.pyc' -delete
cp -r dist "$OUT/dist"
cp package.json "$OUT/"
cp README.md LICENSE "$OUT/" 2>/dev/null || true

echo "==> installing icons and the desktop entry"
for size in 48 128 256 512; do
  mkdir -p "$OUT/share/icons/hicolor/${size}x${size}/apps"
  cp "packaging/icons/${APP_ID}-${size}.png" "$OUT/share/icons/hicolor/${size}x${size}/apps/${APP_ID}.png"
done
mkdir -p "$OUT/share/icons/hicolor/scalable/apps"
cp "packaging/icons/${APP_ID}.svg" "$OUT/share/icons/hicolor/scalable/apps/${APP_ID}.svg"

cat > "$OUT/share/${APP_ID}.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Version=1.0
Name=Safari AI Dev Studio
GenericName=AI Development Environment
Comment=Open-source, AI-assisted development environment with a real terminal and git
Exec=SHARE_DIR/${APP_ID}
Icon=${APP_ID}
Terminal=false
Categories=Development;IDE;TextEditor;Utility;
Keywords=code;editor;ide;git;terminal;ai;python;
StartupNotify=true
StartupWMClass=com.safariaidevstudio.app
DESKTOP

cat > "$OUT/safari-ai-dev-studio" <<'LAUNCHER'
#!/usr/bin/env bash
# Portable launcher: uses the system Python (3.11+) and the bundled packages.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
PYTHON="${SAFARI_PYTHON:-python3}"

if ! command -v "$PYTHON" >/dev/null 2>&1; then
  echo "error: python3 (3.11 or newer) is required but was not found." >&2
  echo "       Install it with your package manager, e.g. 'sudo apt install python3'." >&2
  exit 1
fi

if ! "$PYTHON" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 11) else 1)'; then
  echo "error: Safari AI Dev Studio needs Python 3.11 or newer (found $("$PYTHON" -V 2>&1))." >&2
  exit 1
fi

export SAFARI_PACKAGED=1
export SAFARI_ROOT="$HERE"
export PYTHONPATH="$HERE/python:$HERE/vendor${PYTHONPATH:+:$PYTHONPATH}"

exec "$PYTHON" -m safari.desktop "$@"
LAUNCHER
chmod +x "$OUT/safari-ai-dev-studio"

cat > "$OUT/install.sh" <<'INSTALL'
#!/usr/bin/env bash
# Install the desktop entry, icons and a launcher symlink for the current user.
set -euo pipefail
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
BIN="$HOME/.local/bin"
APP_ID="safari-ai-dev-studio"

mkdir -p "$DATA/applications" "$DATA/icons" "$BIN"

for size in 48 128 256 512; do
  mkdir -p "$DATA/icons/hicolor/${size}x${size}/apps"
  cp "$HERE/share/icons/hicolor/${size}x${size}/apps/${APP_ID}.png" \
     "$DATA/icons/hicolor/${size}x${size}/apps/${APP_ID}.png"
done
mkdir -p "$DATA/icons/hicolor/scalable/apps"
cp "$HERE/share/icons/hicolor/scalable/apps/${APP_ID}.svg" \
   "$DATA/icons/hicolor/scalable/apps/${APP_ID}.svg"

sed "s|SHARE_DIR|$HERE|g" "$HERE/share/${APP_ID}.desktop" > "$DATA/applications/${APP_ID}.desktop"
chmod +x "$DATA/applications/${APP_ID}.desktop"

ln -sf "$HERE/safari-ai-dev-studio" "$BIN/${APP_ID}"

command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database "$DATA/applications" || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -f -t "$DATA/icons/hicolor" >/dev/null 2>&1 || true

echo "Installed Safari AI Dev Studio."
echo "  Application menu: Safari AI Dev Studio"
echo "  Terminal command: ${APP_ID}"
INSTALL
chmod +x "$OUT/install.sh"

echo "==> assembling the AppDir"
cp -r "$OUT/." "$APPDIR/"
cat > "$APPDIR/AppRun" <<'APPRUN'
#!/usr/bin/env bash
HERE="$(cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")" && pwd)"
exec "$HERE/safari-ai-dev-studio" "$@"
APPRUN
chmod +x "$APPDIR/AppRun"
cp "$OUT/share/icons/hicolor/512x512/apps/${APP_ID}.png" "$APPDIR/${APP_ID}.png"
cp "$OUT/share/${APP_ID}.desktop" "$APPDIR/${APP_ID}.desktop"

echo "==> creating the tarball"
tar -C dist-linux -czf "dist-linux/${NAME}.tar.gz" "${NAME}"
sha256sum "dist-linux/${NAME}.tar.gz" | tee "dist-linux/${NAME}.tar.gz.sha256"

echo
echo "Bundle:   dist-linux/${NAME}.tar.gz ($(du -h "dist-linux/${NAME}.tar.gz" | cut -f1))"
echo "AppDir:   ${APPDIR}"
echo "Try it:   ${OUT}/safari-ai-dev-studio --server-only --port 8899"
