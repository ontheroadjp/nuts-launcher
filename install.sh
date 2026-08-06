#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
EXTENSION_UUID="nuts-launcher@local"
EXTENSION_DIR="${REPO_ROOT}/${EXTENSION_UUID}"
INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"

WRAPPER_SRC="${REPO_ROOT}/scripts/trigger-nuts-launcher"
WRAPPER_DST="${HOME}/.local/bin/trigger-nuts-launcher"
SHORTCUT_NAME="Nuts Launcher"
SHORTCUT_BINDING="<Control><Shift>space"
MEDIA_KEYS_SCHEMA="org.gnome.settings-daemon.plugins.media-keys"
CUSTOM_KEYBINDING_SCHEMA="org.gnome.settings-daemon.plugins.media-keys.custom-keybinding"
CUSTOM_KEYBINDING_BASE="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings"

echo "Installing ${EXTENSION_UUID}..."

if [ ! -d "$EXTENSION_DIR" ]; then
    echo "Error: ${EXTENSION_DIR} not found." >&2
    exit 1
fi

mkdir -p "${HOME}/.local/share/gnome-shell/extensions"

# Remove existing installation to avoid nested copy
rm -rf "$INSTALL_DIR"
cp -r "$EXTENSION_DIR" "$INSTALL_DIR"

echo "Files copied to: ${INSTALL_DIR}"

echo "Enabling extension..."
if gnome-extensions enable "$EXTENSION_UUID" 2>/dev/null; then
    echo ""
    echo "Done. Verify with:"
    echo "  gdbus call --session \\"
    echo "    --dest org.gnome.Shell.Extensions.NutsLauncher \\"
    echo "    --object-path /org/gnome/Shell/Extensions/NutsLauncher \\"
    echo "    --method org.gnome.Shell.Extensions.NutsLauncher.Show"
    echo ""
    echo "Logs: journalctl --user -f /usr/bin/gnome-shell"
else
    echo ""
    echo "Note: GNOME Shell has not picked up the extension yet (common on Wayland)."
    echo ""
    echo "  1. Log out and log back in."
    echo "  2. Then run:"
    echo "       gnome-extensions enable ${EXTENSION_UUID}"
    echo ""
    echo "  Or, if gnome-shell --replace is available (X11 only):"
    echo "       gnome-shell --replace &"
fi

setup_shortcut() {
    if ! command -v gsettings >/dev/null 2>&1; then
        echo ""
        echo "Note: gsettings not found. Skipping keyboard shortcut setup."
        echo "  Assign ${WRAPPER_DST} to a shortcut manually via GNOME Settings > Keyboard > Custom Shortcuts."
        return
    fi

    if ! gsettings list-schemas | grep -qx "$MEDIA_KEYS_SCHEMA"; then
        echo ""
        echo "Note: ${MEDIA_KEYS_SCHEMA} schema not found (not a GNOME session?). Skipping keyboard shortcut setup."
        echo "  Assign ${WRAPPER_DST} to a shortcut manually via your desktop's keyboard settings."
        return
    fi

    mkdir -p "${HOME}/.local/bin"
    ln -sf "$WRAPPER_SRC" "$WRAPPER_DST"

    local raw part
    local -a parts=() paths=()
    raw="$(gsettings get "$MEDIA_KEYS_SCHEMA" custom-keybindings)"
    if [ "$raw" != "@as []" ] && [ "$raw" != "[]" ]; then
        raw="${raw#\[}"
        raw="${raw%\]}"
        IFS=',' read -ra parts <<< "$raw"
        for part in "${parts[@]}"; do
            part="${part// /}"
            part="${part//\'/}"
            [ -n "$part" ] && paths+=("$part")
        done
    fi

    local existing_path="" p cmd
    for p in "${paths[@]}"; do
        cmd="$(gsettings get "${CUSTOM_KEYBINDING_SCHEMA}:${p}" command)"
        cmd="${cmd#\'}"
        cmd="${cmd%\'}"
        if [ "$cmd" = "$WRAPPER_DST" ]; then
            existing_path="$p"
            break
        fi
    done

    local target_path
    if [ -n "$existing_path" ]; then
        target_path="$existing_path"
    else
        local binding
        for p in "${paths[@]}"; do
            binding="$(gsettings get "${CUSTOM_KEYBINDING_SCHEMA}:${p}" binding)"
            binding="${binding#\'}"
            binding="${binding%\'}"
            if [ "$binding" = "$SHORTCUT_BINDING" ]; then
                echo ""
                echo "Note: ${SHORTCUT_BINDING} is already bound to a different command (${p})."
                echo "  Skipping automatic shortcut registration; assign ${WRAPPER_DST} manually if desired."
                return
            fi
        done

        local n=0 candidate found
        while :; do
            candidate="${CUSTOM_KEYBINDING_BASE}/custom${n}/"
            found=0
            for p in "${paths[@]}"; do
                [ "$p" = "$candidate" ] && found=1 && break
            done
            [ "$found" -eq 0 ] && break
            n=$((n + 1))
        done
        target_path="$candidate"
        paths+=("$target_path")
    fi

    gsettings set "${CUSTOM_KEYBINDING_SCHEMA}:${target_path}" name "$SHORTCUT_NAME"
    gsettings set "${CUSTOM_KEYBINDING_SCHEMA}:${target_path}" command "$WRAPPER_DST"
    gsettings set "${CUSTOM_KEYBINDING_SCHEMA}:${target_path}" binding "$SHORTCUT_BINDING"

    if [ -z "$existing_path" ]; then
        local array_literal="[" first=1
        for p in "${paths[@]}"; do
            if [ "$first" -eq 1 ]; then
                first=0
            else
                array_literal+=", "
            fi
            array_literal+="'${p}'"
        done
        array_literal+="]"
        gsettings set "$MEDIA_KEYS_SCHEMA" custom-keybindings "$array_literal"
    fi

    echo ""
    echo "Keyboard shortcut registered: ${SHORTCUT_BINDING} -> ${WRAPPER_DST}"
}

setup_shortcut
