# Nuts Launcher

Minimal GNOME application launcher with DBus control for Ubuntu 24.04 LTS / GNOME Wayland.

## Features

- DBus API (`Show()` / `Hide()` / `Toggle()`) for external control
- Incremental search (case-insensitive substring match)
- App icon + name display using `Gio.AppInfo`
- Keyboard navigation: `Enter` to launch, `Esc` to close, `Up`/`Down` to select
- State reset on every `Show()` call (clears input, resets selection, focuses entry)
- Clean `disable()` with full DBus and signal cleanup

## Installation

```bash
./install.sh
```

This copies `nuts-launcher@local/` to `~/.local/share/gnome-shell/extensions/` and enables the extension.

> **Note:** The extension targets GNOME Shell 46 (`shell-version: ["46"]`). Confirm with `gnome-shell --version` before installing on a different version.

**Manual steps (alternative):**

```bash
cp -r nuts-launcher@local ~/.local/share/gnome-shell/extensions/
gnome-extensions enable nuts-launcher@local
```

## Usage

### DBus control

```bash
# Show launcher
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Show

# Hide launcher
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Hide

# Toggle launcher
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Toggle
```

### View logs

```bash
journalctl --user -f /usr/bin/gnome-shell
```

### FEP integration (wrapper script)

Place the following at `~/.local/bin/nuts-launcher-us` and assign it to a GNOME custom shortcut using the absolute path:

```bash
#!/usr/bin/env bash
set -euo pipefail

gdbus call --session \
  --dest org.gnome.Shell.Extensions.FepSwitcher \
  --object-path /org/gnome/Shell/Extensions/FepSwitcher \
  --method org.gnome.Shell.Extensions.FepSwitcher.SwitchToUs >/dev/null

sleep 0.05

gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Show >/dev/null
```

## Design Principles

- **Single responsibility**: FEP/IME switching is handled by `FepSwitcher`; this extension only launches apps.
- **No external dependencies**: Uses GJS / Gio / St / Clutter only — no npm, no shell commands.
- **Wayland native**: No X11-specific tools (`xdotool` etc.).
- **Minimal scope**: No settings UI, no theme switching, no web/file search, no plugin system.
- **Clean lifecycle**: `disable()` always unexports DBus, releases bus name, disconnects signals, and destroys UI actors.

See `docs/L0_concept/` for full design rationale and `nuts-launcher-local-issue.md` for the original specification.
