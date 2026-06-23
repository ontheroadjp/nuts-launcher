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
cp -r "$EXTENSION_DIR" "$INSTALL_DIR"

echo "Enabling extension..."
gnome-extensions enable "$EXTENSION_UUID"

echo ""
echo "Done. Verify with:"
echo "  gdbus call --session \\"
echo "    --dest org.gnome.Shell.Extensions.NutsLauncher \\"
echo "    --object-path /org/gnome/Shell/Extensions/NutsLauncher \\"
echo "    --method org.gnome.Shell.Extensions.NutsLauncher.Show"
echo ""
echo "Logs: journalctl --user -f /usr/bin/gnome-shell"
