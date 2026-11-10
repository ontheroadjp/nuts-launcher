#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_UUID="nuts-launcher@local"
EXTENSION_DIR="${REPO_ROOT}/${EXTENSION_UUID}"
INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"
WRAPPER_SRC="${REPO_ROOT}/scripts/trigger-nuts-launcher"
WRAPPER_DST="${HOME}/.local/bin/trigger-nuts-launcher"
SHORTCUT_BINDING="<Control><Shift>space"
MEDIA_KEYS_SCHEMA="org.gnome.settings-daemon.plugins.media-keys"
CUSTOM_KEYBINDING_SCHEMA="org.gnome.settings-daemon.plugins.media-keys.custom-keybinding"
CUSTOM_KEYBINDING_BASE="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"

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

setup_shortcut() {
    if ! command -v gsettings >/dev/null 2>&1 || ! gsettings list-schemas | grep -Fxq "$MEDIA_KEYS_SCHEMA"; then
        echo "Warning: gsettings or the GNOME media-keys schema is unavailable. Assign ${WRAPPER_DST} to a shortcut manually." >&2
        return 1
    fi
    local raw part p cmd binding candidate n found target_path array_literal first
    local -a parts=() paths=()
    raw="$(gsettings get "$MEDIA_KEYS_SCHEMA" custom-keybindings)" || return 1
    if [ "$raw" != "@as []" ] && [ "$raw" != "[]" ]; then
        raw="${raw#\[}"; raw="${raw%\]}"
        IFS=',' read -ra parts <<< "$raw"
        for part in "${parts[@]}"; do
            part="${part// /}"; part="${part//\'/}"
            [ -n "$part" ] && paths+=("$part")
        done
    fi
    for p in "${paths[@]}"; do
        cmd="$(gsettings get "${CUSTOM_KEYBINDING_SCHEMA}:${p}" command)" || return 1
        cmd="${cmd#\'}"; cmd="${cmd%\'}"
        if [ "$cmd" = "$WRAPPER_DST" ]; then
            echo "Existing launcher shortcut preserved: ${p}"
            return 0
        fi
    done
    for p in "${paths[@]}"; do
        binding="$(gsettings get "${CUSTOM_KEYBINDING_SCHEMA}:${p}" binding)" || return 1
        binding="${binding#\'}"; binding="${binding%\'}"
        if [ "$binding" = "$SHORTCUT_BINDING" ]; then
            echo "Warning: ${SHORTCUT_BINDING} is already used by ${p}; assign ${WRAPPER_DST} manually." >&2
            return 1
        fi
    done
    n=0
    while :; do
        candidate="${CUSTOM_KEYBINDING_BASE}/custom${n}/"; found=0
        for p in "${paths[@]}"; do [ "$p" = "$candidate" ] && found=1 && break; done
        [ "$found" -eq 0 ] && break
        n=$((n + 1))
    done
    target_path="$candidate"; paths+=("$target_path")
    # The new entry is made visible only after all its fields are configured.
    gsettings set "${CUSTOM_KEYBINDING_SCHEMA}:${target_path}" name "Nuts Launcher" || return 1
    gsettings set "${CUSTOM_KEYBINDING_SCHEMA}:${target_path}" command "$WRAPPER_DST" || return 1
    gsettings set "${CUSTOM_KEYBINDING_SCHEMA}:${target_path}" binding "$SHORTCUT_BINDING" || return 1
    array_literal="["; first=1
    for p in "${paths[@]}"; do
        if [ "$first" -eq 1 ]; then first=0; else array_literal+=", "; fi
        array_literal+="'${p}'"
    done
    array_literal+="]"
    gsettings set "$MEDIA_KEYS_SCHEMA" custom-keybindings "$array_literal" || return 1
    echo "Keyboard shortcut registered: ${SHORTCUT_BINDING} -> ${WRAPPER_DST}"
    echo "Note: conflicts with GNOME built-in shortcuts are not checked."
}

if ! setup_shortcut; then
    echo "Error: Shortcut setup incomplete. Check GNOME keyboard settings and retry; the extension and wrapper remain installed." >&2
    exit 1
fi
if ! command -v gdbus >/dev/null 2>&1 || ! gdbus call --session --dest org.freedesktop.DBus --object-path /org/freedesktop/DBus --method org.freedesktop.DBus.NameHasOwner org.gnome.Shell.Extensions.FepSwitcher 2>/dev/null | grep -Fq true; then
    echo "Warning: FepSwitcher DBus service is not available; input switching may not work." >&2
fi
echo "Verify with: gdbus call --session --dest org.gnome.Shell.Extensions.NutsLauncher --object-path /org/gnome/Shell/Extensions/NutsLauncher --method org.gnome.Shell.Extensions.NutsLauncher.Show"
