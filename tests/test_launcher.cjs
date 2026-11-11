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
    launcher._webSearchItem = { displayName: 'Web Search...' };
    launcher._webSearchMode = false;
    launcher._rows = [];
    launcher._renderResults = () => {};
    launcher._highlightSelected = () => {};
    return { launcher, calls, Clutter, Gio, Main, appSystem, context };
}

test('entry activation launches after input processing and preserves control modifier', () => {
    const { launcher, Clutter, Main, context } = fixture();
    const handlers = {};
    const text = { set_activatable: value => assert.equal(value, true),
        connect: (name, handler) => { handlers[name] = handler; return 1; } };
    class Box { connect() {} add_child() {} hide() {} }
    class Entry { get_clutter_text() { return text; } }
    context.St.BoxLayout = Box;
    context.St.Entry = Entry;
    Main.layoutManager.addTopChrome = () => {};
    Clutter.get_current_event = () => ({ get_state: () => Clutter.ModifierType.CONTROL_MASK });
    const launches = [];
    launcher._launchSelected = ctrl => launches.push(ctrl);
    launcher._buildUI();
    assert.equal(handlers['key-press-event'](text, { get_key_symbol: () => Clutter.KEY_Return,
        get_state: () => 0 }), Clutter.EVENT_PROPAGATE);
    assert.deepEqual(launches, []);
    handlers.activate();
    assert.deepEqual(launches, [true]);
});

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
    assert.equal(launcher._filteredApps.length, 1);
    assert.equal(launcher._filteredApps[0].displayName, 'Web Search...');
});

test('empty search displays only web search', () => {
    const { launcher } = fixture();
    launcher._apps = Array.from({ length: 10 }, (_, i) => ({ displayName: `App ${i}` }));
    launcher._systemItems = Array.from({ length: 4 }, (_, i) => ({ displayName: `Action ${i}` }));
    launcher._updateResults('');
    assert.equal(launcher._filteredApps.length, 1);
    assert.equal(launcher._filteredApps[0].displayName, 'Web Search...');
    launcher._systemItems = Array.from({ length: 11 }, (_, i) => ({ displayName: `Action ${i}` }));
    launcher._updateResults('');
    assert.equal(launcher._filteredApps.length, 1);
    assert.equal(launcher._filteredApps[0].displayName, 'Web Search...');
});

test('web search stays selected after empty activation and opens an encoded query', () => {
    const { launcher, Gio } = fixture();
    const calls = [];
    let query = '';
    launcher._entry = { get_text: () => query, set_text: value => { query = value; launcher._onSearchChanged(); },
        grab_key_focus: () => calls.push('focus') };
    launcher._hide = () => calls.push('hide');
    Gio.AppInfo.launch_default_for_uri = uri => calls.push(uri);
    launcher._updateResults('');
    launcher._launchSelected();
    assert.deepEqual(calls, ['focus']);
    query = '日本語 & cats';
    launcher._apps = [{ searchKey: '日本語 & cats', desktopId: '' }];
    launcher._onSearchChanged();
    assert.equal(launcher._filteredApps[launcher._selectedIndex], launcher._webSearchItem);
    launcher._launchSelected();
    assert.deepEqual(calls, ['focus', 'hide', 'https://www.google.com/search?q=%E6%97%A5%E6%9C%AC%E8%AA%9E%20%26%20cats']);
});

test('matching the web search name enters web mode, while other queries search immediately', () => {
    const { launcher, Gio } = fixture();
    const calls = [];
    let query = 'web';
    launcher._entry = { get_text: () => query, set_text: value => { query = value; launcher._onSearchChanged(); },
        grab_key_focus: () => {} };
    launcher._hide = () => { launcher._webSearchMode = false; calls.push('hide'); };
    Gio.AppInfo.launch_default_for_uri = uri => calls.push(uri);
    launcher._updateResults(query);
    launcher._launchSelected();
    assert.equal(query, '');
    assert.equal(launcher._entry.hint_text, 'WEB 検索');
    query = 'web';
    launcher._onSearchChanged();
    launcher._launchSelected();
    assert.deepEqual(calls, ['hide', 'https://www.google.com/search?q=web']);
    query = 'あいみょん';
    launcher._updateResults(query);
    launcher._launchSelected();
    assert.equal(calls[3], 'https://www.google.com/search?q=%E3%81%82%E3%81%84%E3%81%BF%E3%82%87%E3%82%93');
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
    assert.equal(key(Clutter.KEY_Return, Clutter.ModifierType.CONTROL_MASK), Clutter.EVENT_PROPAGATE);
    key(Clutter.KEY_Escape);
    assert.deepEqual(calls, [['hide']]);
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
        _entryKeyPressId: 4, _entryActivateId: 6, _showTimeoutId: 5, _modalGrab: 'grab', _mainBox: box });
    launcher.disable();
    assert.deepEqual(calls, [['unown', 1], ['unregister', 2], ['disconnect', 3],
        ['disconnect', 4], ['disconnect', 6], ['cancel', 5], ['pop', 'grab'], ['remove', box], ['destroy']]);
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
