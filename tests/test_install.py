#!/usr/bin/env python3
"""Exercise installer behavior with isolated HOME and stub GNOME commands."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class InstallTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(dir=os.environ.get("TEST_TMPDIR"))
        self.addCleanup(self.tmp.cleanup)
        root = Path(self.tmp.name)
        self.home = root / "home"
        self.home.mkdir()
        self.bin = root / "bin"
        self.bin.mkdir()
        self.env = dict(os.environ, HOME=str(self.home), PATH=f"{self.bin}:{os.environ['PATH']}")
        self.stub("gnome-shell", 'echo "GNOME Shell ${TEST_VERSION:-46.0}"')
        self.stub("gjs", '[ "$4" = 46 ] || [ "$4" = 50 ]')
        self.stub("gnome-extensions", 'exit "${ENABLE_STATUS:-0}"')
        self.stub("gdbus", "echo '(true,)'")
        self.stub("gsettings", '''
case "$1" in
list-schemas) echo org.gnome.settings-daemon.plugins.media-keys ;;
get) case "$3" in
custom-keybindings) echo "${TEST_PATHS:-@as []}" ;;
command) echo "'${TEST_COMMAND:-other}'" ;;
binding) echo "'${TEST_BINDING:-<Control><Shift>space}'" ;;
esac ;;
set) printf '%s\\n' "$*" >> "$HOME/settings.log"; exit "${SET_STATUS:-0}" ;;
esac''')

    def stub(self, name, body):
        path = self.bin / name
        path.write_text("#!/bin/bash\n" + body + "\n")
        path.chmod(0o755)

    def run_install(self, **env):
        return subprocess.run([str(ROOT / "install.sh")], env=self.env | env,
                              text=True, capture_output=True, check=False)

    def test_unsupported_version_changes_nothing(self):
        result = self.run_install(TEST_VERSION="47.0")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("unsupported", result.stderr)
        self.assertEqual(list(self.home.iterdir()), [])

    def test_existing_directory_is_preserved(self):
        path = self.home / ".local/share/gnome-shell/extensions/nuts-launcher@local"
        path.mkdir(parents=True)
        (path / "data").write_text("keep")
        result = self.run_install()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual((path / "data").read_text(), "keep")

    def test_enable_failure_is_reported(self):
        result = self.run_install(ENABLE_STATUS="1")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Could not enable", result.stderr)
        self.assertFalse((self.home / "settings.log").exists())

    def test_existing_shortcut_is_not_modified(self):
        path = "/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom0/"
        command = str(self.home / ".local/bin/trigger-nuts-launcher")
        result = self.run_install(TEST_PATHS=f"['{path}']", TEST_COMMAND=command)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.home / "settings.log").exists())

    def test_no_shortcut_is_registered(self):
        result = self.run_install()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse((self.home / "settings.log").exists())
        self.assertIn("Remove any old Nuts Launcher custom shortcut", result.stdout)
        self.assertTrue((self.home / ".local/bin/trigger-nuts-launcher").is_symlink())

    def test_success_and_repeat(self):
        self.assertEqual(self.run_install().returncode, 0)
        self.assertEqual(self.run_install().returncode, 0)
        self.assertFalse((self.home / "settings.log").exists())


if __name__ == "__main__":
    unittest.main()
