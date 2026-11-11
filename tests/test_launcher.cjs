// Exercise the real extension class with GNOME Shell dependencies replaced by stubs.
// Run with: node --test tests/test_launcher.cjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture() {
    const calls = [];
    const Clutter = { KEY_Escape: 1, KEY_Return: 2, KEY_KP_Enter: 3, KEY_Down: 4,
        KEY_Up: 5, KEY_j: 6, KEY_k: 7, ModifierType: { CONTROL_MASK: 8 },
        GrabState: { KEYBOARD: 1 }, EVENT_STOP: 'stop', EVENT_PROPAGATE: 'propagate' };
    const appSystem = { lookup_app: () => null, get_running: () => [] };
    const Gio = { AppInfo: { get_all: () => [] }, ThemedIcon: { new: name => name },
        DBus: { session: { unregister_object: id => calls.push(['unregister', id]) } },
        bus_unown_name: id => calls.push(['unown', id]) };
    const Main = { popModal: grab => calls.push(['pop', grab]),
        layoutManager: { removeChrome: box => calls.push(['remove', box]) } };
    const GLib = { source_remove: id => calls.push(['cancel', id]) };
    const Shell = { AppSystem: { get_default: () => appSystem } };
    const source = fs.readFileSync(path.join(__dirname, '../nuts-launcher@local/extension.js'), 'utf8')
        .replace(/^import .*;\s*$/gm, '')
        .replace('export default class NutsLauncherExtension', 'class NutsLauncherExtension');
    const context = { Clutter, Gio, Main, GLib, Shell, St: {}, SystemActions: {},
        ShellMountOperation: {}, Extension: class {}, console };
    const Launcher = vm.runInNewContext(`${source}\nNutsLauncherExtension`, context);
    const launcher = new Launcher();
    launcher._apps = [];
    launcher._forceQuitItems = [];
    launcher._ejectItems = [];
    launcher._systemItems = [];
    launcher._rows = [];
    launcher._renderResults = () => {};
    launcher._highlightSelected = () => {};
    return { launcher, calls, Clutter, Gio, Main, appSystem };
}

test('search matches names and desktop IDs without case sensitivity and limits results', () => {
    const { launcher } = fixture();
    launcher._apps = Array.from({ length: 12 }, (_, i) => ({
        displayName: `Editor ${i}`, searchKey: `editor ${i}`, desktopId: `app-${i}.desktop`,
    }));
    launcher._systemItems = [{ displayName: 'Restart', searchKey: 'restart reboot' }];
    launcher._selectedIndex = 4;
    launcher._updateResults('EDITOR');
    assert.equal(launcher._filteredApps.length, 10);
    assert.equal(launcher._selectedIndex, 0);
    launcher._updateResults('APP-11');
    assert.equal(launcher._filteredApps[0].displayName, 'Editor 11');
    launcher._updateResults('REBOOT');
    assert.equal(launcher._filteredApps[0].displayName, 'Restart');
    launcher._updateResults('absent');
    assert.equal(launcher._filteredApps.length, 0);
});

test('empty search reserves space for actions and keeps all actions when they exceed the limit', () => {
    const { launcher } = fixture();
    launcher._apps = Array.from({ length: 10 }, (_, i) => ({ displayName: `App ${i}` }));
    launcher._systemItems = Array.from({ length: 4 }, (_, i) => ({ displayName: `Action ${i}` }));
    launcher._updateResults('');
    assert.equal(launcher._filteredApps.length, 10);
    assert.equal(launcher._filteredApps[6].displayName, 'Action 0');
    launcher._systemItems = Array.from({ length: 11 }, (_, i) => ({ displayName: `Action ${i}` }));
    launcher._updateResults('');
    assert.equal(launcher._filteredApps.length, 11);
    assert.equal(launcher._filteredApps[0].displayName, 'Action 0');
});

test('keyboard navigation clamps selection and dispatches launch and escape', () => {
    const { launcher, Clutter } = fixture();
    const calls = [];
    launcher._rows = [{}, {}];
    launcher._selectedIndex = 0;
    launcher._launchSelected = ctrl => calls.push(['launch', ctrl]);
    launcher._hide = () => calls.push(['hide']);
    const key = (sym, mods = 0) => launcher._onKeyPress({ get_key_symbol: () => sym, get_state: () => mods });
    key(Clutter.KEY_Up);
    assert.equal(launcher._selectedIndex, 0);
    key(Clutter.KEY_j, Clutter.ModifierType.CONTROL_MASK);
    key(Clutter.KEY_Down);
    assert.equal(launcher._selectedIndex, 1);
    key(Clutter.KEY_Return, Clutter.ModifierType.CONTROL_MASK);
    key(Clutter.KEY_Escape);
    assert.deepEqual(calls, [['launch', true], ['hide']]);
    assert.equal(key(999), Clutter.EVENT_PROPAGATE);
});

test('launch closes first and uses shell activation, new window, or Gio fallback', () => {
    const { launcher, appSystem } = fixture();
    const calls = [];
    launcher._hide = () => calls.push('hide');
    launcher._selectedIndex = 0;
    launcher._filteredApps = [{ info: { get_id: () => 'app.desktop', launch: () => calls.push('fallback') } }];
    appSystem.lookup_app = () => ({ activate: () => calls.push('activate'),
        open_new_window: n => calls.push(`window ${n}`) });
    launcher._launchSelected();
    launcher._launchSelected(true);
    appSystem.lookup_app = () => null;
    launcher._launchSelected();
    assert.deepEqual(calls, ['hide', 'activate', 'hide', 'window -1', 'hide', 'fallback']);
});

test('disable releases DBus, pending show, grab, signals and UI', () => {
    const { launcher, calls } = fixture();
    const text = { disconnect: id => calls.push(['disconnect', id]) };
    const box = { destroy: () => calls.push(['destroy']) };
    Object.assign(launcher, { _busNameId: 1, _dbusRegistrationId: 2,
        _entry: { get_clutter_text: () => text }, _entryTextChangedId: 3,
        _entryKeyPressId: 4, _showTimeoutId: 5, _modalGrab: 'grab', _mainBox: box });
    launcher.disable();
    assert.deepEqual(calls, [['unown', 1], ['unregister', 2], ['disconnect', 3],
        ['disconnect', 4], ['cancel', 5], ['pop', 'grab'], ['remove', box], ['destroy']]);
    assert.equal(launcher._mainBox, null);
    assert.equal(launcher._apps, null);
});

test('keyboard grab checks both supported GNOME API variants', () => {
    const { launcher } = fixture();
    assert.equal(launcher._hasKeyboardGrab({ get_seat_state: () => 1 }), true);
    assert.equal(launcher._hasKeyboardGrab({ get_seat_state: () => 0 }), false);
    assert.equal(launcher._hasKeyboardGrab({ is_revoked: () => false }), true);
    assert.equal(launcher._hasKeyboardGrab({ is_revoked: () => true }), false);
});
