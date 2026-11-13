# Nuts Launcher

Nuts Launcher is a GNOME Shell extension for launching applications, searching the web, and performing system actions from the keyboard. Open the launcher with a shortcut, type a name, and select an item.

## Features

- **Launch applications:** Search by part of an application name or desktop ID. Already-running applications are activated.
- **Search the web:** Search Google, Amazon.co.jp, or YouTube from the launcher, or enter a dedicated search mode.
- **Calculate:** Enter an arithmetic expression to see results and copy a selected result or equation.
- **Open URLs:** Open HTTP and HTTPS addresses in your browser. In Open URL mode, HTTPS is assumed when the scheme is omitted.
- **Control the system:** Search for Suspend, Log Out, Shut Down, or Restart.
- **Eject drives:** Search for removable, ejectable, or stoppable drives with visible mounts and safely remove them.
- **Force quit applications:** Search for a running application by name or `Force Quit`. Unsaved work may be lost.

## Installation

GNOME Shell 46 or 50 is required; supported versions are listed in [metadata.json](nuts-launcher@local/metadata.json). The installer uses `gnome-shell`, `gnome-extensions`, and `gjs`.

Clone the repository and run the installer:

```bash
git clone https://github.com/ontheroadjp/nuts-launcher.git
cd nuts-launcher
./install.sh
```

The installer creates symbolic links for the extension and its launcher script and enables the extension. The extension registers `Ctrl+Shift+Space` by default. If upgrading from an earlier installation, remove the old Nuts Launcher custom shortcut in GNOME Settings → Keyboard → Keyboard Shortcuts → Custom Shortcuts to avoid a conflict. The installer does not delete existing shortcuts.

If GNOME Shell has not discovered the extension, log out and back in, enable it as instructed by the installer, and rerun the installer. Existing files or unrelated symbolic links at the destination paths are preserved; move them aside before retrying.

Switching the input method to US requires the separate FepSwitcher extension. The launcher script still attempts to open Nuts Launcher if FepSwitcher is unavailable.

## Usage

1. Press `Ctrl+Shift+Space` to open the launcher, or use the configured shortcut.
2. Type an application name, action, search query, or URL. The result list is empty until you type.
3. Select an item with `Up` / `Down` or `Ctrl+K` / `Ctrl+J`, then press `Enter` to run it. Press `Ctrl+Enter` to request a new application window, or `Esc` to close the launcher.

Select Web Search, Amazon Search, or YouTube Search after typing a query to search for it. Select Open URL to open the input as an address; HTTPS is assumed when the scheme is omitted. Selecting an item with a query matching its name or configured keyword opens its dedicated input mode. Matching results are ranked by exact match, prefix match, then substring match.

Enter an expression such as `1234*2` to calculate it. Select a result or equation to copy it; comma-separated variants appear when applicable.

## Developer information

### Installation and reloading

`./install.sh` links the repository's `nuts-launcher@local/` directory to `~/.local/share/gnome-shell/extensions/nuts-launcher@local`. Reinstallation is unnecessary after code changes, but on Wayland you must log out and back in to reload GNOME Shell.

To install only the extension manually, create the destination's parent directory first if necessary, then run the following. These steps do not install the optional wrapper; the extension registers its own shortcut.

```bash
ln -s "$PWD/nuts-launcher@local" ~/.local/share/gnome-shell/extensions/nuts-launcher@local
gnome-extensions enable nuts-launcher@local
```

### Configuration

On first enable, the extension creates `nuts-launcher/config.json` under `XDG_CONFIG_HOME` (or `~/.config` when unset). Edit `general.maxResults` to set the result limit (8–100, default 10). Under `customSearch`, the existing Open URL and search actions have an `enabled` flag and `icon`; the three search actions also support `displayName`, `url` with a `{query}` placeholder, and a `keywords` array. The default YouTube keyword is `yt`. Icon values are GNOME icon names or image paths; relative paths are resolved against the extension directory. Arbitrary new search actions are not supported yet.

Set `general.shortcut` to a GNOME accelerator such as `<Control><Shift>space` (the default), and set `general.switchInputOnLaunch` to `false` to skip the optional FepSwitcher call (default `true`). If FepSwitcher is unavailable, the launcher still opens. A shortcut that is invalid or already in use cannot be registered; check the GNOME notification and choose a different key. Disable and enable the extension to reload configuration changes. Invalid values use defaults; existing values are preserved when missing defaults are added.

### DBus control

The session bus service `org.gnome.Shell.Extensions.NutsLauncher` provides `Show`, `Hide`, and `Toggle`.

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Show
```

Replace `Show` with `Hide` or `Toggle` to hide or toggle the launcher. The [wrapper script](scripts/trigger-nuts-launcher) calls FepSwitcher's `SwitchToUs` before calling `Toggle`.

### Logs and tests

```bash
journalctl --user -f /usr/bin/gnome-shell
python3 -m unittest discover -s tests -p test_install.py
node --test tests/test_launcher.cjs
```

The tests stub GNOME APIs and other dependencies; testing in a GNOME Shell session is also needed. Node.js is used for the launcher tests and is not required by the extension itself.

## Design Principles

- **Separation of responsibilities:** FepSwitcher handles FEP / IME switching; the extension provides launcher actions.
- **Runs inside GNOME Shell:** The extension uses GJS and GNOME Shell APIs without external commands or npm. The installer and wrapper are shell scripts.
- **Wayland support:** No X11-specific tools are used.
- **Minimal scope:** No settings UI, theme switching, file search, or plugin system.
- **Clean lifecycle:** `disable()` releases the DBus registration and bus name, disconnects signals, and destroys the UI.

See [docs/L0_concept](docs/L0_concept/) and [docs/L3_implementation](docs/L3_implementation/) for design and implementation details.
