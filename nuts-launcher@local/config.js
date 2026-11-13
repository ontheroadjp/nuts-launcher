import GLib from 'gi://GLib';

const DEFAULT_MAX_RESULTS = 10;
const MIN_MAX_RESULTS = 8;
const MAX_MAX_RESULTS = 100;
const DEFAULT_SHORTCUT = '<Control><Shift>space';
const DEFAULT_SEARCHES = {
    openUrl: { enabled: true, icon: 'web-browser-symbolic' },
    web: { enabled: true, displayName: 'Web Search...', icon: 'web-browser-symbolic', url: 'https://www.google.com/search?q={query}', keywords: [] },
    amazon: { enabled: true, displayName: 'Amazon Search...', icon: 'amazon.svg', url: 'https://www.amazon.co.jp/s?k={query}', keywords: [] },
    youtube: { enabled: true, displayName: 'YouTube Search...', icon: 'youtube.svg', url: 'https://www.youtube.com/results?search_query={query}', keywords: ['yt'] },
    github: { enabled: true, displayName: 'GitHub Search...', icon: 'github.svg', url: 'https://github.com/search?q={query}', keywords: [] },
    docker: { enabled: true, displayName: 'Docker Hub Search...', icon: 'docker.svg', url: 'https://hub.docker.com/search?q={query}', keywords: [] },
};

export class Config {
    constructor(path = GLib.build_filenamev([GLib.get_user_config_dir(), 'nuts-launcher', 'config.json'])) {
        this._path = path;
        this._values = {};
        this.reload();
    }

    reload() {
        this._values = {};
        if (!GLib.file_test(this._path, GLib.FileTest.EXISTS)) {
            try {
                this._write({ general: { maxResults: DEFAULT_MAX_RESULTS, shortcut: DEFAULT_SHORTCUT, switchInputOnLaunch: true }, customSearch: DEFAULT_SEARCHES });
            } catch (error) {
                console.error('NutsLauncher: could not initialize configuration:', error);
            }
            return;
        }
        try {
            const [success, contents] = GLib.file_get_contents(this._path);
            if (!success)
                throw new Error('Could not read configuration');
            const values = JSON.parse(new TextDecoder().decode(contents));
            if (!values || typeof values !== 'object' || Array.isArray(values))
                throw new Error('Configuration must be an object');
            this._values = values;
            this._addMissingDefaults();
        } catch (error) {
            console.error('NutsLauncher: could not load configuration:', error);
        }
    }

    _addMissingDefaults() {
        const values = { ...this._values };
        let changed = false;
        if (!Object.hasOwn(values, 'general')) {
            values.general = { maxResults: values.maxResults ?? DEFAULT_MAX_RESULTS };
            changed = true;
        } else if (values.general && typeof values.general === 'object' && !Array.isArray(values.general) &&
            !Object.hasOwn(values.general, 'maxResults')) {
            values.general = { ...values.general, maxResults: values.maxResults ?? DEFAULT_MAX_RESULTS };
            changed = true;
        }
        if (Object.hasOwn(values, 'maxResults') && values.general &&
            typeof values.general === 'object' && !Array.isArray(values.general)) {
            delete values.maxResults;
            changed = true;
        }
        if (values.general && typeof values.general === 'object' && !Array.isArray(values.general)) {
            for (const [key, value] of Object.entries({ shortcut: DEFAULT_SHORTCUT, switchInputOnLaunch: true })) {
                if (!Object.hasOwn(values.general, key)) {
                    values.general = { ...values.general, [key]: value };
                    changed = true;
                }
            }
        }
        if (!Object.hasOwn(values, 'customSearch') && Object.hasOwn(values, 'searches')) {
            values.customSearch = values.searches;
            delete values.searches;
            changed = true;
        }
        if (!Object.hasOwn(values, 'customSearch')) {
            values.customSearch = DEFAULT_SEARCHES;
            changed = true;
        } else if (values.customSearch && typeof values.customSearch === 'object' && !Array.isArray(values.customSearch)) {
            values.customSearch = { ...values.customSearch };
            for (const [key, defaults] of Object.entries(DEFAULT_SEARCHES)) {
                if (!Object.hasOwn(values.customSearch, key)) {
                    values.customSearch[key] = defaults;
                    changed = true;
                } else if (values.customSearch[key] && typeof values.customSearch[key] === 'object' &&
                    !Array.isArray(values.customSearch[key])) {
                    const entry = { ...values.customSearch[key] };
                    for (const [field, defaultValue] of Object.entries(defaults)) {
                        if (!Object.hasOwn(entry, field)) {
                            entry[field] = defaultValue;
                            changed = true;
                        }
                    }
                    values.customSearch[key] = entry;
                }
            }
        }
        if (changed) {
            this._values = values;
            try {
                this._write(values);
            } catch (error) {
                console.error('NutsLauncher: could not update configuration defaults:', error);
            }
        }
    }

    get maxResults() {
        const value = this._values.general?.maxResults;
        return Number.isInteger(value) && value >= MIN_MAX_RESULTS && value <= MAX_MAX_RESULTS
            ? value : DEFAULT_MAX_RESULTS;
    }

    get shortcut() {
        const value = this._values.general?.shortcut;
        return typeof value === 'string' && value.trim() ? value : DEFAULT_SHORTCUT;
    }

    get switchInputOnLaunch() {
        const value = this._values.general?.switchInputOnLaunch;
        return typeof value === 'boolean' ? value : true;
    }

    get searches() {
        const stored = this._values.customSearch;
        const searches = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
        return Object.fromEntries(Object.entries(DEFAULT_SEARCHES).map(([key, defaults]) => {
            const entry = searches[key] && typeof searches[key] === 'object' && !Array.isArray(searches[key])
                ? searches[key] : {};
            const result = { enabled: typeof entry.enabled === 'boolean' ? entry.enabled : defaults.enabled };
            result.icon = typeof entry.icon === 'string' && entry.icon.trim()
                ? entry.icon : defaults.icon;
            if (key !== 'openUrl') {
                result.displayName = typeof entry.displayName === 'string' && entry.displayName.trim()
                    ? entry.displayName : defaults.displayName;
                result.url = typeof entry.url === 'string' && /^https?:\/\//i.test(entry.url) &&
                    entry.url.includes('{query}') && !/\s/.test(entry.url) ? entry.url : defaults.url;
                result.keywords = Array.isArray(entry.keywords) && entry.keywords.every(word =>
                    typeof word === 'string' && word.trim()) ? entry.keywords : defaults.keywords;
            }
            return [key, result];
        }));
    }

    setMaxResults(value) {
        if (!Number.isInteger(value) || value < MIN_MAX_RESULTS || value > MAX_MAX_RESULTS)
            throw new RangeError('maxResults must be an integer between 8 and 100');
        this._write({ ...this._values, general: { ...this._values.general, maxResults: value } });
    }

    _write(values) {
        if (GLib.mkdir_with_parents(GLib.path_get_dirname(this._path), 0o700) !== 0)
            throw new Error('Could not create configuration directory');
        if (!GLib.file_set_contents(this._path, `${JSON.stringify(values, null, 2)}\n`))
            throw new Error('Could not write configuration');
        this._values = values;
    }
}
