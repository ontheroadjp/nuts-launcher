# Nuts Launcher

Minimal GNOME application launcher with DBus control for Ubuntu 24.04 LTS / GNOME Wayland.

## Features

- DBus API (`Show()` / `Hide()` / `Toggle()`) for external control
- Incremental search (case-insensitive substring match)
- App icon + name display using `Gio.AppInfo`
- Force Quit commands: one `Force Quit <name>` item per running application with a window; searchable by `force quit` or application name. Unsaved work may be lost.
- System actions: Suspend, Log Out, Shut Down, Restart (always shown at the bottom; searchable)
- Eject commands: one `Eject <name>` item per connected external drive (e.g. USB HDD), shown above the system actions; hidden when no device is connected; searchable by `eject` / `unmount` / `remove` / device name
- Keyboard navigation: `Enter` to launch, `Ctrl+Enter` to request a new window, `Esc` to close, `Up`/`Down` to select
- State reset on every `Show()` call (clears input, resets selection, focuses entry)
- Clean `disable()` with full DBus and signal cleanup

## Installation

```bash
./install.sh
```

This symlinks `~/.local/share/gnome-shell/extensions/nuts-launcher@local` to the repo's `nuts-launcher@local/` and enables the extension. Code changes in the repo take effect after the next GNOME Shell reload (log out and back in on Wayland) without reinstalling.

The installer checks the installed GNOME Shell against `metadata.json` before making changes and stops if its version is unsupported or cannot be determined. It requires `gnome-shell`, `gnome-extensions`, and `gjs`.

Existing files or unrelated symlinks at the extension and wrapper destinations are preserved; move them aside before retrying. Re-running preserves an existing shortcut for the wrapper. If enabling fails, check the displayed error; if Shell has not discovered the extension, log out and back in, then run `gnome-extensions enable nuts-launcher@local` and rerun the installer to finish shortcut setup. Shortcut setup failures are reported and can be retried. Conflicts with GNOME built-in shortcuts are not checked. FepSwitcher is a separate extension; if its DBus service is unavailable, the installer warns that input switching may not work.

**Manual steps (alternative):**

```bash
ln -s "$PWD/nuts-launcher@local" ~/.local/share/gnome-shell/extensions/nuts-launcher@local
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

`./install.sh` automatically symlinks this script to `~/.local/bin/trigger-nuts-launcher` and registers it as a GNOME custom shortcut (`Ctrl+Shift+Space`). The script calls `FepSwitcher.SwitchToUs`, waits briefly, and then calls `NutsLauncher.Toggle`. If FepSwitcher is unavailable, the script still attempts to toggle the launcher. See [`scripts/trigger-nuts-launcher`](scripts/trigger-nuts-launcher) for the actual commands.

## Design Principles

- **Single responsibility**: FEP/IME switching is handled by `FepSwitcher`; this extension only launches apps.
- **No external dependencies**: Uses GJS / Gio / St / Clutter only — no npm, no shell commands.
- **Wayland native**: No X11-specific tools (`xdotool` etc.).
- **Minimal scope**: No settings UI, no theme switching, no web/file search, no plugin system.
- **Clean lifecycle**: `disable()` always unexports DBus, releases bus name, disconnects signals, and destroys UI actors.

See `docs/L0_concept/` and `docs/L3_implementation/` for design rationale and implementation notes.
