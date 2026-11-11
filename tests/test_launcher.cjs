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
    const GLib = { source_remove: id => calls.push(['cancel', id]), UriFlags: { NONE: 0 },
        Uri: { parse: value => {
            if (/%(?![\da-f]{2})/i.test(value)) throw new Error('Invalid escape');
            const uri = new URL(value);
            return { get_host: () => uri.hostname };
        } } };
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
    launcher._openUrlItem = { displayName: 'Open URL...' };
    launcher._webSearchMode = false;
    launcher._urlMode = false;
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

test('calculator respects precedence, parentheses, signs and decimals', () => {
    const { launcher } = fixture();
    for (const [query, expected] of [['1+2*3', '7'], ['(1+2)*3', '9'],
        ['-2.5 + .5', '-2'], ['8/2/2', '2']]) {
        launcher._updateResults(query);
        assert.equal(launcher._filteredApps[0].displayName, `= ${expected}`);
    }
});

test('calculator rejects malformed, non-finite and unsafe expressions', () => {
    const { launcher } = fixture();
    for (const query of ['1+', '1/0', '0/0', '1e309+1', '2(3+4)',
        '1+alert(1)', '('.repeat(101) + '1+2' + ')'.repeat(101)]) {
        launcher._updateResults(query);
        assert.equal(launcher._filteredApps[0], launcher._webSearchItem, query);
    }
});

test('calculator adds a selectable comma-separated result for four or more integer digits', () => {
    const { launcher, context } = fixture();
    const copies = [];
    context.St.ClipboardType = { CLIPBOARD: 'clipboard' };
    context.St.Clipboard = { get_default: () => ({ set_text: (_type, value) => copies.push(value) }) };
    launcher._hide = () => {};
    for (const [query, plain, grouped] of [
        ['999+1', '1000', '1,000'], ['-1234.5*1', '-1234.5', '-1,234.5'],
        ['1234567+0', '1234567', '1,234,567'],
    ]) {
        launcher._updateResults(query);
        assert.equal(launcher._filteredApps[0].displayName, `= ${plain}`);
        assert.equal(launcher._filteredApps[1].displayName, `= ${grouped}`);
        launcher._selectedIndex = 1;
        launcher._launchSelected();
        assert.equal(copies.at(-1), grouped);
    }
    launcher._updateResults('999+0');
    assert.equal(launcher._filteredApps[1].displayName, '999+0=999');
    assert.equal(launcher._filteredApps[2], launcher._webSearchItem);
});

test('calculator displays and copies plain and grouped equations', () => {
    const { launcher, context } = fixture();
    const copies = [];
    context.St.ClipboardType = { CLIPBOARD: 'clipboard' };
    context.St.Clipboard = { get_default: () => ({ set_text: (_type, value) => copies.push(value) }) };
    launcher._hide = () => {};
    launcher._updateResults('1234+456');
    assert.deepEqual(Array.from(launcher._filteredApps.slice(0, 4), item => item.displayName),
        ['= 1690', '= 1,690', '1234+456=1690', '1,234+456=1,690']);
    launcher._selectedIndex = 3;
    launcher._launchSelected();
    assert.equal(copies[0], '1,234+456=1,690');
    launcher._updateResults('1234-1234');
    assert.equal(launcher._filteredApps[1].displayName, '1234-1234=0');
    assert.equal(launcher._filteredApps[2].displayName, '1,234-1,234=0');
    launcher._updateResults('123+456');
    assert.equal(launcher._filteredApps[1].displayName, '123+456=579');
    assert.equal(launcher._filteredApps[2], launcher._webSearchItem);
    launcher._updateResults('1234*2/4');
    assert.equal(launcher._filteredApps[1].displayName, '1234×2÷4=617');
    assert.equal(launcher._filteredApps[2].displayName, '1,234×2÷4=617');
    launcher._selectedIndex = 2;
    launcher._launchSelected();
    assert.equal(copies.at(-1), '1,234×2÷4=617');
});

test('calculator copies the result and preserves search modes and result limit', () => {
    const { launcher, context } = fixture();
    const calls = [];
    context.St.ClipboardType = { CLIPBOARD: 'clipboard' };
    context.St.Clipboard = { get_default: () => ({ set_text: (...args) => calls.push(args) }) };
    launcher._hide = () => calls.push('hide');
    launcher._apps = Array.from({ length: 12 }, (_, i) => ({
        displayName: `1+2 ${i}`, searchKey: `1+2 ${i}`, desktopId: '',
    }));
    launcher._updateResults('1+2');
    assert.equal(launcher._filteredApps.length, 10);
    assert.equal(launcher._filteredApps.at(-1), launcher._webSearchItem);
    launcher._launchSelected();
    assert.deepEqual(calls, ['hide', ['clipboard', '3']]);
    launcher._apps = launcher._apps.map(app => ({ ...app, searchKey: '1000+0' }));
    launcher._updateResults('1000+0');
    assert.equal(launcher._filteredApps.length, 10);
    assert.equal(launcher._filteredApps[1].displayName, '= 1,000');
    assert.equal(launcher._filteredApps.at(-1), launcher._webSearchItem);
    launcher._webSearchMode = true;
    launcher._updateResults('1+2');
    assert.equal(launcher._filteredApps[0], launcher._webSearchItem);
    launcher._webSearchMode = false;
    launcher._urlMode = true;
    launcher._updateResults('1+2');
    assert.equal(launcher._filteredApps[0].url, 'https://1+2');
});

test('valid web URLs are first and open directly while web search remains available', () => {
    const { launcher, Gio } = fixture();
    const calls = [];
    let query = 'https://example.com/path?q=hello';
    launcher._entry = { get_text: () => query };
    launcher._hide = () => calls.push('hide');
    Gio.AppInfo.launch_default_for_uri = uri => calls.push(uri);
    launcher._updateResults(query);
    assert.equal(launcher._filteredApps[0].displayName, `Open URL: ${query}`);
    assert.equal(launcher._filteredApps.at(-1), launcher._webSearchItem);
    launcher._launchSelected();
    assert.deepEqual(calls, ['hide', query]);
    query = 'http://example.com';
    launcher._webSearchMode = true;
    launcher._updateResults(query);
    assert.equal(launcher._selectedIndex, 0);
    assert.equal(launcher._filteredApps[0].url, query);
    launcher._selectedIndex = 1;
    launcher._launchSelected();
    assert.equal(calls.at(-1), 'https://www.google.com/search?q=http%3A%2F%2Fexample.com');
});

test('invalid URLs and other schemes remain ordinary searches', () => {
    const { launcher } = fixture();
    for (const query of ['https://', 'https://example.com/%zz', 'https://a b', 'file:///etc/passwd', 'example.com']) {
        launcher._updateResults(query);
        assert.equal(launcher._filteredApps[0], launcher._webSearchItem, query);
    }
});

test('h finds Open URL and URL mode opens addresses with or without a scheme', () => {
    const { launcher, Gio } = fixture();
    const calls = [];
    let query = 'h';
    launcher._entry = { get_text: () => query, set_text: value => { query = value; launcher._onSearchChanged(); },
        grab_key_focus: () => calls.push('focus') };
    launcher._hide = () => { launcher._urlMode = false; calls.push('hide'); };
    Gio.AppInfo.launch_default_for_uri = uri => calls.push(uri);
    launcher._updateResults(query);
    launcher._selectedIndex = launcher._filteredApps.indexOf(launcher._openUrlItem);
    assert.notEqual(launcher._selectedIndex, -1);
    launcher._launchSelected();
    assert.equal(query, '');
    assert.equal(launcher._entry.hint_text, 'URL 入力');
    query = 'example.com/path';
    launcher._onSearchChanged();
    launcher._launchSelected();
    assert.deepEqual(calls, ['focus', 'hide', 'https://example.com/path']);
    launcher._urlMode = true;
    query = 'http://example.com';
    launcher._onSearchChanged();
    launcher._launchSelected();
    assert.equal(calls.at(-1), query);
});

test('URL mode does not launch invalid input or unsupported schemes', () => {
    const { launcher } = fixture();
    launcher._urlMode = true;
    for (const query of ['', 'https://', 'example.com/%zz', 'a b', 'file:///etc/passwd']) {
        launcher._updateResults(query);
        assert.equal(launcher._filteredApps[0], launcher._openUrlItem, query);
    }
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
        _entryKeyPressId: 4, _entryActivateId: 6, _showTimeoutId: 5, _positionIdleId: 7,
        _modalGrab: 'grab', _mainBox: box });
    launcher.disable();
    assert.deepEqual(calls, [['unown', 1], ['unregister', 2], ['disconnect', 3],
        ['disconnect', 4], ['disconnect', 6], ['cancel', 5], ['cancel', 7],
        ['pop', 'grab'], ['remove', box], ['destroy']]);
    assert.equal(launcher._mainBox, null);
    assert.equal(launcher._apps, null);
});

test('positioning replaces pending work and clears its id after execution', () => {
    const { launcher, calls, Main, context } = fixture();
    const callbacks = [];
    context.GLib.idle_add = (_, callback) => { callbacks.push(callback); return callbacks.length; };
    Main.layoutManager.primaryMonitor = { x: 0, y: 0, width: 1200, height: 900 };
    launcher._mainBox = { get_size: () => [300, 300],
        set_position: (x, y) => calls.push(['position', x, y]) };
    launcher._positionWindow();
    launcher._positionWindow();
    assert.deepEqual(calls, [['cancel', 1]]);
    callbacks[1]();
    assert.deepEqual(calls, [['cancel', 1], ['position', 450, 200]]);
    assert.equal(launcher._positionIdleId, null);
    launcher._cancelPosition();
    assert.equal(calls.length, 2);
});

test('keyboard grab checks both supported GNOME API variants', () => {
    const { launcher } = fixture();
    assert.equal(launcher._hasKeyboardGrab({ get_seat_state: () => 1 }), true);
    assert.equal(launcher._hasKeyboardGrab({ get_seat_state: () => 0 }), false);
    assert.equal(launcher._hasKeyboardGrab({ is_revoked: () => false }), true);
    assert.equal(launcher._hasKeyboardGrab({ is_revoked: () => true }), false);
});
