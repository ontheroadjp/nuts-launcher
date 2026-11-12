import GLib from 'gi://GLib';

const DEFAULT_MAX_RESULTS = 10;
const MIN_MAX_RESULTS = 8;
const MAX_MAX_RESULTS = 100;

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
                this.setMaxResults(DEFAULT_MAX_RESULTS);
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
        } catch (error) {
            console.error('NutsLauncher: could not load configuration:', error);
        }
    }

    get maxResults() {
        const value = this._values.maxResults;
        return Number.isInteger(value) && value >= MIN_MAX_RESULTS && value <= MAX_MAX_RESULTS
            ? value : DEFAULT_MAX_RESULTS;
    }

    setMaxResults(value) {
        if (!Number.isInteger(value) || value < MIN_MAX_RESULTS || value > MAX_MAX_RESULTS)
            throw new RangeError('maxResults must be an integer between 8 and 100');
        const values = { ...this._values, maxResults: value };
        if (GLib.mkdir_with_parents(GLib.path_get_dirname(this._path), 0o700) !== 0)
            throw new Error('Could not create configuration directory');
        if (!GLib.file_set_contents(this._path, `${JSON.stringify(values, null, 2)}\n`))
            throw new Error('Could not write configuration');
        this._values = values;
    }
}
