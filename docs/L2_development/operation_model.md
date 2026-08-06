# L2 Operation Model: Nuts Launcher

## 前提

- Ubuntu 24.04 LTS + GNOME Wayland 環境
- `FepSwitcher` GNOME extension が稼働済み
- CI/CD パイプラインなし（個人用ローカル extension）

根拠: `README.md`

## GNOME Shell バージョン確認

```bash
gnome-shell --version
```

`metadata.json` の `shell-version` フィールドと一致させること。

根拠: `nuts-launcher@local/metadata.json`, `README.md`

## インストール手順

リポジトリルートの `install.sh` を実行する（推奨）。

```bash
./install.sh
```

手動で行う場合:

```bash
cp -r nuts-launcher@local ~/.local/share/gnome-shell/extensions/
gnome-extensions enable nuts-launcher@local
```

根拠: `install.sh`, `README.md`

## 無効化

```bash
gnome-extensions disable nuts-launcher@local
```

根拠: `README.md`

## リロード（変更後の反映）

GNOME Shell extension の変更は、disable → enable で反映される。

```bash
gnome-extensions disable nuts-launcher@local
gnome-extensions enable nuts-launcher@local
```

または Wayland 環境では、GNOME Shell 自体の再ログインが必要になる場合がある（未確認）。

根拠: `README.md`

## ログ確認

```bash
journalctl --user -f /usr/bin/gnome-shell
```

根拠: `README.md`

## DBus 動作確認

extension が有効な状態で以下を実行する。

### Show（表示）

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Show
```

根拠: `README.md`

### Hide（非表示）

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Hide
```

根拠: `README.md`

### Toggle（切り替え）

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Toggle
```

根拠: `README.md`

## wrapper script

FepSwitcher → NutsLauncher.Show() の順番制御は wrapper script で行う。

ファイル: `~/.local/bin/trigger-nuts-launcher`（`install.sh` 実行時に `scripts/trigger-nuts-launcher` への symlink として自動配置される）

```bash
#!/usr/bin/env bash
set -euo pipefail

gdbus call --session \
  --dest org.gnome.Shell.Extensions.FepSwitcher \
  --object-path /org/gnome/Shell/Extensions/FepSwitcher \
  --method org.gnome.Shell.Extensions.FepSwitcher.SwitchToUs >/dev/null

sleep 0.05

gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Show >/dev/null
```

注意: GNOME custom shortcut で command を指定する場合、`$HOME` が展開されない可能性があるため絶対パスを使う。

根拠: `README.md`

## GNOME custom shortcut への割り当て

`./install.sh` 実行時に `setup_shortcut()` が自動で行う（`<Control><Shift>space` を `~/.local/bin/trigger-nuts-launcher` に割り当て）。再実行しても重複登録されない。既存の他 custom shortcut と binding が衝突する場合は自動登録をスキップし、手動での割り当てを促す。

根拠: `install.sh`, `docs/L3_implementation/nuts-launcher@local/install.sh.md`
