#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_UUID="nuts-launcher@local"
EXTENSION_DIR="${REPO_ROOT}/${EXTENSION_UUID}"
INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"
WRAPPER_SRC="${REPO_ROOT}/scripts/trigger-nuts-launcher"
WRAPPER_DST="${HOME}/.local/bin/trigger-nuts-launcher"

fail() { echo "Error: $*" >&2; exit 1; }

# Check prerequisites before changing any files or settings.
for cmd in gnome-shell gnome-extensions gjs; do
    command -v "$cmd" >/dev/null 2>&1 || fail "Required command not found: ${cmd}"
done
[ -d "$EXTENSION_DIR" ] || fail "Extension directory not found: ${EXTENSION_DIR}"
if [ ! -f "$WRAPPER_SRC" ] || [ ! -x "$WRAPPER_SRC" ]; then
    fail "Wrapper missing or not executable: ${WRAPPER_SRC}"
fi
shell_version="$(gnome-shell --version)" || fail "Cannot determine GNOME Shell version."
if [[ ! "$shell_version" =~ ^GNOME\ Shell\ ([0-9]+)(\.|$) ]]; then
    fail "Cannot determine GNOME Shell version from: ${shell_version}"
fi
shell_major="${BASH_REMATCH[1]}"
# Parse the metadata itself so the supported versions have one source of truth.
if ! gjs -c 'const GLib = imports.gi.GLib; const [ok, data] = GLib.file_get_contents(ARGV[0]); if (!ok) throw new Error("Cannot read metadata"); const meta = JSON.parse(new TextDecoder().decode(data)); if (!Array.isArray(meta["shell-version"]) || !meta["shell-version"].includes(ARGV[1])) imports.system.exit(1);' "$EXTENSION_DIR/metadata.json" "$shell_major"; then
    fail "GNOME Shell ${shell_major} is unsupported or metadata could not be read; see ${EXTENSION_DIR}/metadata.json."
fi

# Never overwrite an existing copy or an unrelated symlink.
for pair in extension wrapper; do
    if [ "$pair" = extension ]; then dst="$INSTALL_DIR"; src="$EXTENSION_DIR"; else dst="$WRAPPER_DST"; src="$WRAPPER_SRC"; fi
    if [ -e "$dst" ] || [ -L "$dst" ]; then
        if [ ! -L "$dst" ] || [ "$(readlink "$dst")" != "$src" ]; then
            fail "Existing path is not the expected symlink: ${dst}. Move it aside and retry."
        fi
    fi
done
mkdir -p "$(dirname "$INSTALL_DIR")" "$(dirname "$WRAPPER_DST")"
[ -L "$INSTALL_DIR" ] || ln -s "$EXTENSION_DIR" "$INSTALL_DIR"
[ -L "$WRAPPER_DST" ] || ln -s "$WRAPPER_SRC" "$WRAPPER_DST"
echo "Extension and wrapper symlinks are in place."

if ! gnome-extensions enable "$EXTENSION_UUID"; then
    echo "Error: Could not enable ${EXTENSION_UUID}. If GNOME Shell has not discovered it, log out and back in, then run: gnome-extensions enable ${EXTENSION_UUID}" >&2
    exit 1
fi

echo "The extension manages its shortcut. Remove any old Nuts Launcher custom shortcut in GNOME Settings to avoid conflicts."
echo "Verify with: gdbus call --session --dest org.gnome.Shell.Extensions.NutsLauncher --object-path /org/gnome/Shell/Extensions/NutsLauncher --method org.gnome.Shell.Extensions.NutsLauncher.Show"
