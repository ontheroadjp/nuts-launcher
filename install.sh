#!/usr/bin/env bash
set -euo pipefail

EXTENSION_UUID="nuts-launcher@local"
EXTENSION_DIR="$(cd "$(dirname "$0")" && pwd)/${EXTENSION_UUID}"
INSTALL_DIR="${HOME}/.local/share/gnome-shell/extensions/${EXTENSION_UUID}"

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
