import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
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

export default class NutsLauncherExtension extends Extension {
    enable() {
        this._visible = false;
        this._selectedIndex = 0;
        this._apps = [];
        this._filteredApps = [];
        this._rows = [];

        this._buildUI();
        this._loadApps();
        this._exportDBus();
    }

    disable() {
        this._unexportDBus();
        this._destroyUI();

        this._apps = null;
        this._filteredApps = null;
        this._rows = null;
    }

    // --- DBus methods ---

    Show() {
        this._show();
    }

    Hide() {
        this._hide();
    }

    Toggle() {
        if (this._visible)
            this._hide();
        else
            this._show();
    }

    // --- DBus lifecycle ---

    _exportDBus() {
        this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DBUS_IFACE, this);
        this._dbusImpl.export(Gio.DBus.session, OBJECT_PATH);
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
        if (this._dbusImpl) {
            this._dbusImpl.unexport();
            this._dbusImpl = null;
        }
    }

    // --- UI ---

    _buildUI() {
        this._mainBox = new St.BoxLayout({
            style_class: 'nuts-launcher-box',
            vertical: true,
            reactive: true,
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

        this._entry.get_clutter_text().connect('text-changed', () => {
            this._onSearchChanged();
        });

        this._mainBox.connect('key-press-event', (_, event) => {
            return this._onKeyPress(event);
        });

        Main.layoutManager.addTopChrome(this._mainBox);
        this._mainBox.hide();
    }

    _destroyUI() {
        if (this._mainBox) {
            Main.layoutManager.removeChrome(this._mainBox);
            this._mainBox.destroy();
            this._mainBox = null;
        }
        this._entry = null;
        this._resultsBox = null;
    }

    _show() {
        this._entry.set_text('');
        this._selectedIndex = 0;
        this._updateResults('');
        this._mainBox.show();
        this._visible = true;
        this._positionWindow();
        this._mainBox.grab_key_focus();
        global.stage.set_key_focus(this._entry.get_clutter_text());
    }

    _hide() {
        this._mainBox.hide();
        this._visible = false;
    }

    _positionWindow() {
        const monitor = Main.layoutManager.primaryMonitor;
        GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
            const [w, h] = this._mainBox.get_size();
            const x = monitor.x + Math.round((monitor.width - w) / 2);
            const y = monitor.y + Math.round((monitor.height - h) / 3);
            this._mainBox.set_position(x, y);
            return GLib.SOURCE_REMOVE;
        });
    }

    // --- App list ---

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
        const lq = query.toLowerCase();
        if (lq === '') {
            this._filteredApps = this._apps.slice(0, MAX_RESULTS);
        } else {
            this._filteredApps = this._apps
                .filter(a =>
                    a.searchKey.includes(lq) ||
                    a.desktopId.includes(lq)
                )
                .slice(0, MAX_RESULTS);
        }

        this._renderResults();

        this._selectedIndex = 0;
        this._highlightSelected();
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

        if (sym === Clutter.KEY_Return || sym === Clutter.KEY_KP_Enter) {
            this._launchSelected();
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

    _launchSelected() {
        const app = this._filteredApps[this._selectedIndex];
        if (!app)
            return;

        try {
            app.info.launch([], null);
        } catch (e) {
            console.error(`NutsLauncher: failed to launch ${app.displayName}:`, e);
        }

        this._hide();
    }
}
