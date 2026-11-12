import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import * as ShellMountOperation from 'resource:///org/gnome/shell/ui/shellMountOperation.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const DBUS_IFACE = `
<node>
  <interface name="org.gnome.Shell.Extensions.NutsLauncher">
    <method name="Show"/>
    <method name="Hide"/>
    <method name="Toggle"/>
  </interface>
</node>`;

const BUS_NAME = 'org.gnome.Shell.Extensions.NutsLauncher';
const OBJECT_PATH = '/org/gnome/Shell/Extensions/NutsLauncher';
const MAX_RESULTS = 10;
const SHOW_GRAB_DELAY_MS = 120;

// Parse only arithmetic, without evaluating the input as JavaScript.
function calculate(query) {
    if (query.length > 512 || !/[+*/-]/.test(query))
        return null;
    const tokens = query.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+*/-]|\s+|./g) ?? [];
    const parts = tokens.filter(token => !/^\s+$/.test(token));
    let index = 0;
    let depth = 0;

    function primary() {
        if (++depth > 100)
            throw new Error('Expression too deeply nested');
        let value;
        const token = parts[index++];
        if (token === '+' || token === '-') {
            value = primary();
            if (token === '-') value = -value;
        } else if (token === '(') {
            value = expression();
            if (parts[index++] !== ')') throw new Error('Missing parenthesis');
        } else if (token && /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) {
            value = Number(token);
        } else {
            throw new Error('Invalid expression');
        }
        depth--;
        return value;
    }

    function term() {
        let value = primary();
        while (parts[index] === '*' || parts[index] === '/') {
            const operator = parts[index++];
            const right = primary();
            if (operator === '/' && right === 0) throw new Error('Division by zero');
            value = operator === '*' ? value * right : value / right;
        }
        return value;
    }

    function expression() {
        let value = term();
        while (parts[index] === '+' || parts[index] === '-') {
            const operator = parts[index++];
            const right = term();
            value = operator === '+' ? value + right : value - right;
        }
        return value;
    }

    try {
        const result = expression();
        return index === parts.length && Number.isFinite(result) ? String(result) : null;
    } catch (e) {
        // Invalid or incomplete input remains an ordinary search query.
        return null;
    }
}

function groupDigits(value) {
    return value.replace(/\d+(?:\.\d*)?|\.\d+/g, number =>
        number.replace(/^\d+/, integer => integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',')));
}

export default class NutsLauncherExtension extends Extension {
    enable() {
        this._visible = false;
        this._modalGrab = null;
        this._entryTextChangedId = null;
        this._entryKeyPressId = null;
        this._entryActivateId = null;
        this._showTimeoutId = null;
        this._positionIdleId = null;
        this._selectedIndex = 0;
        this._webSearchMode = false;
        this._amazonSearchMode = false;
        this._youtubeSearchMode = false;
        this._urlMode = false;
        this._openUrlItem = {
            displayName: 'Open URL...',
            icon: Gio.ThemedIcon.new('web-browser-symbolic'),
        };
        this._webSearchItem = {
            displayName: 'Web Search...',
            icon: Gio.ThemedIcon.new('web-browser-symbolic'),
        };
        this._amazonSearchItem = {
            displayName: 'Amazon Search...',
            icon: Gio.FileIcon.new(Gio.File.new_for_path(`${this.path}/amazon.svg`)),
        };
        this._youtubeSearchItem = {
            displayName: 'YouTube Search...',
            icon: Gio.FileIcon.new(Gio.File.new_for_path(`${this.path}/youtube.svg`)),
        };
        this._apps = [];
        this._filteredApps = [];
        this._rows = [];
        this._ejectItems = [];
        this._forceQuitItems = [];

        this._buildUI();
        this._loadApps();
        this._buildSystemItems();
        this._exportDBus();
    }

    disable() {
        this._unexportDBus();
        this._destroyUI();

        this._apps = null;
        this._filteredApps = null;
        this._rows = null;
        this._ejectItems = null;
        this._forceQuitItems = null;
    }

    // --- DBus lifecycle ---

    _exportDBus() {
        const nodeInfo = Gio.DBusNodeInfo.new_for_xml(DBUS_IFACE);
        this._dbusRegistrationId = Gio.DBus.session.register_object(
            OBJECT_PATH,
            nodeInfo.interfaces[0],
            (connection, sender, objectPath, interfaceName, methodName, parameters, invocation) => {
                if (methodName === 'Show') {
                    this._queueShow();
                } else if (methodName === 'Hide') {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        if (this._mainBox) this._hide();
                        return GLib.SOURCE_REMOVE;
                    });
                } else if (methodName === 'Toggle') {
                    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
                        if (!this._mainBox) return GLib.SOURCE_REMOVE;
                        if (this._visible) this._hide();
                        else this._queueShow();
                        return GLib.SOURCE_REMOVE;
                    });
                }
                invocation.return_value(null);
            },
            null,
            null
        );

        this._busNameId = Gio.bus_own_name(
            Gio.BusType.SESSION,
            BUS_NAME,
            Gio.BusNameOwnerFlags.NONE,
            null,
            null,
            null
        );
    }

    _unexportDBus() {
        if (this._busNameId) {
            Gio.bus_unown_name(this._busNameId);
            this._busNameId = null;
        }
        if (this._dbusRegistrationId) {
            Gio.DBus.session.unregister_object(this._dbusRegistrationId);
            this._dbusRegistrationId = null;
        }
    }

    // --- UI ---

    _buildUI() {
        this._mainBox = new St.BoxLayout({
            style_class: 'nuts-launcher-box',
            vertical: true,
            reactive: true,
        });

        this._mainBox.connect('captured-event', (_, event) => {
            if (event.type() !== Clutter.EventType.BUTTON_PRESS)
                return Clutter.EVENT_PROPAGATE;

            const [x, y] = event.get_coords();
            const [boxX, boxY] = this._mainBox.get_transformed_position();
            const [width, height] = this._mainBox.get_transformed_size();
            if (x >= boxX && x < boxX + width && y >= boxY && y < boxY + height)
                return Clutter.EVENT_PROPAGATE;

            this._hide();
            return Clutter.EVENT_STOP;
        });

        this._entry = new St.Entry({
            style_class: 'nuts-launcher-entry',
            hint_text: 'Search applications...',
            can_focus: true,
        });
        this._mainBox.add_child(this._entry);

        this._resultsBox = new St.BoxLayout({
            style_class: 'nuts-launcher-results',
            vertical: true,
        });
        this._mainBox.add_child(this._resultsBox);

        const entryText = this._entry.get_clutter_text();
        entryText.set_activatable(true);

        this._entryTextChangedId = entryText.connect('text-changed', () => {
            this._onSearchChanged();
        });

        this._entryKeyPressId = entryText.connect('key-press-event', (_, event) => {
            return this._onKeyPress(event);
        });
        this._entryActivateId = entryText.connect('activate', () => {
            const event = Clutter.get_current_event();
            const ctrl = !!(event && (event.get_state() & Clutter.ModifierType.CONTROL_MASK));
            this._launchSelected(ctrl);
        });

        Main.layoutManager.addTopChrome(this._mainBox);
        this._mainBox.hide();
    }

    _destroyUI() {
        if (this._entry) {
            const entryText = this._entry.get_clutter_text();
            if (this._entryTextChangedId)
                entryText.disconnect(this._entryTextChangedId);
            if (this._entryKeyPressId)
                entryText.disconnect(this._entryKeyPressId);
            if (this._entryActivateId)
                entryText.disconnect(this._entryActivateId);
            this._entryTextChangedId = null;
            this._entryKeyPressId = null;
            this._entryActivateId = null;
        }
        this._cancelQueuedShow();
        this._cancelPosition();
        this._releaseModalGrab();

        if (this._mainBox) {
            Main.layoutManager.removeChrome(this._mainBox);
            this._mainBox.destroy();
            this._mainBox = null;
        }
        this._entry = null;
        this._resultsBox = null;
    }

    _queueShow() {
        this._cancelQueuedShow();
        this._showTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, SHOW_GRAB_DELAY_MS, () => {
            this._showTimeoutId = null;
            if (this._mainBox)
                this._show();
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelQueuedShow() {
        if (!this._showTimeoutId)
            return;

        GLib.source_remove(this._showTimeoutId);
        this._showTimeoutId = null;
    }

    _show() {
        this._webSearchMode = false;
        this._amazonSearchMode = false;
        this._youtubeSearchMode = false;
        this._urlMode = false;
        this._entry.hint_text = 'Search applications...';
        this._buildEjectItems();
        this._buildForceQuitItems();
        this._entry.set_text('');
        this._selectedIndex = 0;
        this._updateResults('');
        this._mainBox.show();
        this._visible = true;
        this._positionWindow();

        if (!this._acquireModalGrab()) {
            this._mainBox.hide();
            this._visible = false;
            return;
        }

        this._entry.grab_key_focus();
    }

    _hide() {
        this._webSearchMode = false;
        this._amazonSearchMode = false;
        this._youtubeSearchMode = false;
        this._urlMode = false;
        this._cancelQueuedShow();
        this._mainBox.hide();
        this._visible = false;
        this._releaseModalGrab();
    }

    _acquireModalGrab() {
        if (this._modalGrab)
            return true;

        // actionMode: NORMAL keeps GNOME's own global accelerators (e.g. the
        // gsettings custom-keybinding that toggles this launcher) dispatchable
        // while the grab is held; the default action mode blocks them entirely,
        // which is what prevented Ctrl+Shift+Space from closing the launcher.
        const grab = Main.pushModal(this._mainBox, { actionMode: Shell.ActionMode.NORMAL });

        if (!this._hasKeyboardGrab(grab)) {
            try {
                Main.popModal(grab);
            } catch (e) {
                console.error('NutsLauncher: failed to release incomplete modal grab:', e);
            }
            console.error('NutsLauncher: failed to acquire keyboard grab');
            return false;
        }

        this._modalGrab = grab;
        return true;
    }

    _hasKeyboardGrab(grab) {
        // GNOME 46 exposes the grabbed seat state. GNOME 50 (mutter 18)
        // removed get_seat_state(); Clutter.Grab only offers is_revoked().
        if (typeof grab.get_seat_state === 'function')
            return (grab.get_seat_state() & Clutter.GrabState.KEYBOARD) !== 0;

        return !grab.is_revoked();
    }

    _releaseModalGrab() {
        if (!this._modalGrab)
            return;

        try {
            Main.popModal(this._modalGrab);
        } catch (e) {
            console.error('NutsLauncher: failed to release modal grab:', e);
        }
        this._modalGrab = null;
    }

    _positionWindow() {
        this._cancelPosition();
        const monitor = Main.layoutManager.primaryMonitor;
        this._positionIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            this._positionIdleId = null;
            const [w, h] = this._mainBox.get_size();
            const x = monitor.x + Math.round((monitor.width - w) / 2);
            const y = monitor.y + Math.round((monitor.height - h) / 3);
            this._mainBox.set_position(x, y);
            return GLib.SOURCE_REMOVE;
        });
    }

    _cancelPosition() {
        if (this._positionIdleId) {
            GLib.source_remove(this._positionIdleId);
            this._positionIdleId = null;
        }
    }

    // --- App list ---

    _buildForceQuitItems() {
        this._forceQuitItems = Shell.AppSystem.get_default().get_running().map(app => {
            const name = app.get_name();
            return {
                displayName: `Force Quit ${name}`,
                searchKey: `force quit ${name}`.toLowerCase(),
                desktopId: '',
                icon: app.get_app_info()?.get_icon() ?? null,
                activate: () => this._forceQuitApp(app, name),
            };
        });
    }

    _forceQuitApp(app, name) {
        for (const window of app.get_windows()) {
            try {
                window.kill();
            } catch (e) {
                console.error(`NutsLauncher: failed to force quit ${name}:`, e);
                Main.notifyError(`Failed to force quit ${name}`, e.message);
            }
        }
    }

    _buildSystemItems() {
        const sa = SystemActions.getDefault();
        this._systemItems = [
            {
                displayName: 'Suspend',
                searchKey: 'suspend sleep',
                desktopId: '',
                icon: Gio.ThemedIcon.new('media-playback-pause-symbolic'),
                activate: () => sa.activateSuspend(),
            },
            {
                displayName: 'Log Out',
                searchKey: 'log out logout',
                desktopId: '',
                icon: Gio.ThemedIcon.new('system-log-out-symbolic'),
                activate: () => sa.activateLogout(),
            },
            {
                displayName: 'Shut Down',
                searchKey: 'shut down shutdown power off',
                desktopId: '',
                icon: Gio.ThemedIcon.new('system-shutdown-symbolic'),
                activate: () => sa.activatePowerOff(),
            },
            {
                displayName: 'Restart',
                searchKey: 'restart reboot',
                desktopId: '',
                icon: Gio.ThemedIcon.new('system-reboot-symbolic'),
                activate: () => sa.activateRestart(),
            },
        ];
    }

    _buildEjectItems() {
        // One item per removable drive that currently has a visible mount.
        // Rebuilt on every Show() so hot-plugged devices are picked up
        // without holding VolumeMonitor signal connections.
        const drives = new Map();
        for (const mount of Gio.VolumeMonitor.get().get_mounts()) {
            if (mount.is_shadowed())
                continue;
            const drive = mount.get_drive();
            if (!drive || !(drive.is_removable() || drive.can_eject() || drive.can_stop()))
                continue;
            if (!drives.has(drive))
                drives.set(drive, []);
            drives.get(drive).push(mount);
        }

        this._ejectItems = [...drives].map(([drive, mounts]) => {
            const name = mounts.map(m => m.get_name()).join(', ');
            return {
                displayName: `Eject ${name}`,
                searchKey: `eject unmount remove ${name}`.toLowerCase(),
                desktopId: '',
                icon: Gio.ThemedIcon.new('media-eject-symbolic'),
                activate: () => this._ejectDrive(drive, mounts[0], name),
            };
        });
    }

    _ejectDrive(drive, mount, name) {
        // stop() powers the drive down after unmounting (safe for USB HDDs);
        // eject() is the fallback for media drives such as optical drives.
        const [start, finish] = drive.can_stop()
            ? ['stop', 'stop_finish']
            : ['eject_with_operation', 'eject_with_operation_finish'];

        // ShellMountOperation shows GNOME's "device is busy" dialog when needed.
        // It expects a mount or volume (it calls source.get_drive()), not a drive.
        const op = new ShellMountOperation.ShellMountOperation(mount);
        drive[start](Gio.MountUnmountFlags.NONE, op.mountOp, null, (source, res) => {
            op.close();
            try {
                source[finish](res);
                Main.notify(`${name} can be safely removed`);
            } catch (e) {
                if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.FAILED_HANDLED)) {
                    console.error(`NutsLauncher: failed to eject ${name}:`, e);
                    Main.notifyError(`Failed to eject ${name}`, e.message);
                }
            }
        });
    }

    _loadApps() {
        this._apps = Gio.AppInfo.get_all()
            .filter(app => app.should_show())
            .filter(app => !!app.get_display_name())
            .map(app => ({
                info: app,
                displayName: app.get_display_name(),
                searchKey: app.get_display_name().toLowerCase(),
                desktopId: (app.get_id() ?? '').toLowerCase(),
                icon: app.get_icon(),
            }));
    }

    // --- Search ---

    _onSearchChanged() {
        const query = this._entry.get_text().trim();
        this._updateResults(query);
    }

    _updateResults(query) {
        const urlItem = this._makeUrlItem(query);
        this._filteredApps = this._buildSearchResults(query, urlItem);
        this._renderResults();
        this._selectedIndex = this._webSearchMode && !urlItem
            ? this._filteredApps.indexOf(this._webSearchItem) : 0;
        this._highlightSelected();
    }

    _makeUrlItem(query, assumeHttps = this._urlMode) {
        const candidate = assumeHttps && query && !/^[a-z][a-z\d+.-]*:\/\//i.test(query)
            ? `https://${query}` : query;
        if (/^https?:\/\//i.test(candidate) && !/\s/.test(candidate)) {
            try {
                const uri = GLib.Uri.parse(candidate, GLib.UriFlags.NONE);
                if (uri.get_host())
                    return { displayName: `Open URL: ${query}`, url: candidate,
                        icon: Gio.ThemedIcon.new('web-browser-symbolic') };
            } catch (e) {
                // Invalid URI input remains available as a web search.
            }
        }
        return null;
    }

    _buildSearchResults(query, urlItem) {
        const lq = query.toLowerCase();
        const systemItems = [...this._forceQuitItems, ...this._ejectItems, ...this._systemItems];
        let results;
        if (this._urlMode) {
            results = [this._openUrlItem];
        } else if (this._youtubeSearchMode) {
            results = [this._youtubeSearchItem];
        } else if (this._amazonSearchMode) {
            results = [this._amazonSearchItem];
        } else if (this._webSearchMode) {
            results = [this._webSearchItem];
        } else if (lq === '') {
            results = [];
        } else {
            const searchItems = [this._webSearchItem, this._amazonSearchItem, this._youtubeSearchItem];
            const fallbackItems = [...searchItems, this._openUrlItem];
            const candidates = [...searchItems, ...this._apps, ...systemItems, this._openUrlItem];
            const matchRank = item => {
                const keys = [(item.displayName ?? '').toLowerCase().replace(/\.\.\.$/, ''),
                    item.searchKey ?? '', item.desktopId ?? ''];
                if (item === this._openUrlItem)
                    keys.push('http', 'https');
                if (keys.some(key => key === lq)) return 0;
                if (keys.some(key => key.startsWith(lq))) return 1;
                if (keys.some(key => key.includes(lq))) return 2;
                return 3;
            };
            const matches = candidates.filter(item => matchRank(item) < 3)
                .sort((a, b) => matchRank(a) - matchRank(b));
            const otherFallbackItems = fallbackItems.filter(item => !matches.includes(item));
            let ordinaryCount = 0;
            results = matches.filter(item => fallbackItems.includes(item) ||
                ordinaryCount++ < MAX_RESULTS - fallbackItems.length);
            results.push(...otherFallbackItems);
        }

        if (urlItem) {
            if (results.length === MAX_RESULTS)
                results.splice(results.findLastIndex(item => ![this._webSearchItem, this._amazonSearchItem, this._youtubeSearchItem, this._openUrlItem].includes(item)), 1);
            results.unshift(urlItem);
        }
        if (!this._urlMode && !this._webSearchMode && !this._amazonSearchMode && !this._youtubeSearchMode) {
            const result = calculate(query);
            if (result !== null) {
                const grouped = /e/i.test(result) ? result : groupDigits(result);
                const values = grouped === result ? [result] : [result, grouped];
                const displayQuery = query.replace(/\*/g, '×').replace(/\//g, '÷');
                const equation = `${displayQuery}=${result}`;
                const groupedEquation = `${groupDigits(displayQuery)}=${grouped}`;
                values.push(equation);
                if (groupedEquation !== equation)
                    values.push(groupedEquation);
                for (const value of values.reverse()) {
                    if (results.length === MAX_RESULTS)
                        results.splice(results.findLastIndex(item => ![this._webSearchItem, this._amazonSearchItem, this._youtubeSearchItem, this._openUrlItem].includes(item)), 1);
                    results.unshift({ displayName: value.includes('=') ? value : `= ${value}`, icon: Gio.ThemedIcon.new('accessories-calculator-symbolic'),
                        activate: () => St.Clipboard.get_default().set_text(St.ClipboardType.CLIPBOARD, value) });
                }
            }
        }
        return results;
    }

    _renderResults() {
        this._resultsBox.remove_all_children();
        this._rows = [];

        for (const app of this._filteredApps) {
            const row = new St.BoxLayout({
                style_class: 'nuts-launcher-row',
                reactive: true,
                track_hover: true,
            });

            const icon = new St.Icon({
                style_class: 'nuts-launcher-icon',
                gicon: app.icon ?? Gio.ThemedIcon.new('application-x-executable'),
                fallback_icon_name: 'application-x-executable',
            });
            row.add_child(icon);

            const label = new St.Label({
                style_class: 'nuts-launcher-label',
                text: app.displayName,
                y_align: Clutter.ActorAlign.CENTER,
            });
            row.add_child(label);

            const index = this._rows.length;
            row.connect('button-press-event', () => {
                this._selectedIndex = index;
                this._launchSelected();
                return Clutter.EVENT_STOP;
            });

            this._resultsBox.add_child(row);
            this._rows.push(row);
        }
    }

    _highlightSelected() {
        for (let i = 0; i < this._rows.length; i++) {
            if (i === this._selectedIndex)
                this._rows[i].add_style_pseudo_class('selected');
            else
                this._rows[i].remove_style_pseudo_class('selected');
        }
    }

    // --- Keyboard ---

    _onKeyPress(event) {
        const sym = event.get_key_symbol();
        const mods = event.get_state();
        const ctrl = !!(mods & Clutter.ModifierType.CONTROL_MASK);

        if (sym === Clutter.KEY_Escape) {
            this._hide();
            return Clutter.EVENT_STOP;
        }

        if (sym === Clutter.KEY_Down || (ctrl && sym === Clutter.KEY_j)) {
            this._moveSelection(1);
            return Clutter.EVENT_STOP;
        }

        if (sym === Clutter.KEY_Up || (ctrl && sym === Clutter.KEY_k)) {
            this._moveSelection(-1);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _moveSelection(delta) {
        if (this._rows.length === 0)
            return;
        this._selectedIndex = Math.max(
            0,
            Math.min(this._rows.length - 1, this._selectedIndex + delta)
        );
        this._highlightSelected();
    }

    // --- Launch ---

    _launchSelected(newWindow = false) {
        const item = this._filteredApps[this._selectedIndex];
        if (!item)
            return;

        if (item.url) {
            this._openUri(item.url, 'Open URL');
            return;
        }

        if (item === this._openUrlItem) {
            const query = this._entry.get_text().trim();
            const lowerQuery = query.toLowerCase();
            if (!this._urlMode && (!query || item.displayName.toLowerCase().includes(lowerQuery) ||
                'http'.includes(lowerQuery) || 'https'.includes(lowerQuery))) {
                this._enterInputMode(true);
            } else {
                const urlItem = this._makeUrlItem(query, true);
                if (urlItem)
                    this._openUri(urlItem.url, 'Open URL');
            }
            return;
        }

        if (item === this._webSearchItem) {
            this._launchWebSearch(item);
            return;
        }

        if (item === this._amazonSearchItem) {
            this._launchAmazonSearch(item);
            return;
        }

        if (item === this._youtubeSearchItem) {
            this._launchYouTubeSearch(item);
            return;
        }

        this._hide();
        if (item.activate)
            item.activate();
        else
            this._launchApp(item, newWindow);
    }

    _enterInputMode(urlMode) {
        this._urlMode = urlMode;
        this._webSearchMode = !urlMode;
        this._amazonSearchMode = false;
        this._youtubeSearchMode = false;
        this._entry.hint_text = urlMode ? 'URL 入力' : 'WEB 検索';
        this._entry.set_text('');
        this._entry.grab_key_focus();
    }

    _launchWebSearch(item) {
        const query = this._entry.get_text().trim();
        if (!this._webSearchMode &&
            (!query || item.displayName.toLowerCase().includes(query.toLowerCase()))) {
            this._enterInputMode(false);
            return;
        }
        if (query)
            this._openUri(`https://www.google.com/search?q=${encodeURIComponent(query)}`, 'Web Search');
    }

    _launchAmazonSearch(item) {
        const query = this._entry.get_text().trim();
        if (!this._amazonSearchMode &&
            (!query || item.displayName.toLowerCase().includes(query.toLowerCase()))) {
            this._urlMode = false;
            this._webSearchMode = false;
            this._amazonSearchMode = true;
            this._youtubeSearchMode = false;
            this._entry.hint_text = 'Amazon 検索';
            this._entry.set_text('');
            this._entry.grab_key_focus();
            return;
        }
        if (query)
            this._openUri(`https://www.amazon.co.jp/s?k=${encodeURIComponent(query)}`, 'Amazon Search');
    }

    _launchYouTubeSearch(item) {
        const query = this._entry.get_text().trim();
        if (!this._youtubeSearchMode &&
            (!query || item.displayName.toLowerCase().includes(query.toLowerCase()))) {
            this._urlMode = false;
            this._webSearchMode = false;
            this._amazonSearchMode = false;
            this._youtubeSearchMode = true;
            this._entry.hint_text = 'YouTube 検索';
            this._entry.set_text('');
            this._entry.grab_key_focus();
            return;
        }
        if (query)
            this._openUri(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, 'YouTube Search');
    }

    _openUri(uri, label) {
        this._hide();
        try {
            const context = global.create_app_launch_context(0, -1);
            Gio.AppInfo.launch_default_for_uri(uri, context);
        } catch (e) {
            console.error(`NutsLauncher: failed to open ${label}:`, e);
            Main.notifyError(label, 'Could not open the default browser');
        }
    }

    _launchApp(item, newWindow) {
        try {
            const id = item.info.get_id();
            const app = id ? Shell.AppSystem.get_default().lookup_app(id) : null;
            if (app) {
                if (newWindow)
                    app.open_new_window(-1);
                else
                    app.activate();
            } else
                item.info.launch([], null);
        } catch (e) {
            console.error(`NutsLauncher: failed to launch ${item.displayName}:`, e);
        }
    }
}
