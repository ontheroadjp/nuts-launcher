# L2 Operation Model: Nuts Launcher

## 前提

- Ubuntu 24.04 LTS + GNOME Wayland 環境
- FEP 切替を使う場合は `FepSwitcher` GNOME extension が必要。利用できなくても extension のショートカットは launcher を開く
- CI/CD パイプラインなし（個人用ローカル extension）

根拠: `README.md`

## GNOME Shell バージョン確認

```bash
gnome-shell --version
```

`install.sh` は `metadata.json` の `shell-version` フィールドと照合し、未対応または判定不能の場合は変更前に停止する。

根拠: `nuts-launcher@local/metadata.json`, `README.md`

## インストール手順

リポジトリルートの `install.sh` を実行する（推奨）。

```bash
./install.sh
```

手動で行う場合:

```bash
ln -s "$PWD/nuts-launcher@local" ~/.local/share/gnome-shell/extensions/nuts-launcher@local
gnome-extensions enable nuts-launcher@local
```

根拠: `install.sh`, `README.md`

## 無効化

```bash
gnome-extensions disable nuts-launcher@local
```

根拠: `docs/.ai/repo.profile.json` の `commands.disable`

## リロード（変更後の反映）

Wayland では変更後にログアウトして再ログインし、GNOME Shell を再読み込みする。根拠: `README.md` の Installation。

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

根拠: `nuts-launcher@local/extension.js:11-18`, `docs/.ai/repo.profile.json` の `commands.dbus_hide`

### Toggle（切り替え）

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Toggle
```

根拠: `nuts-launcher@local/extension.js:11-18`, `docs/.ai/repo.profile.json` の `commands.dbus_toggle`

## wrapper script

手動利用可能な wrapper script は FepSwitcher → NutsLauncher.Toggle() の順番制御を行う。FepSwitcher の呼び出しが失敗しても Toggle を試みる。

ファイル: `~/.local/bin/trigger-nuts-launcher`（`install.sh` 実行時に `scripts/trigger-nuts-launcher` への symlink として配置される）。実際のコマンドは `scripts/trigger-nuts-launcher` を参照する。

注意: GNOME custom shortcut で command を指定する場合、`$HOME` が展開されない可能性があるため絶対パスを使う。

根拠: `README.md`

## 起動ショートカット

extension は `general.shortcut` のキーを登録する。既定値は `<Control><Shift>space`。`general.switchInputOnLaunch` を false にすると FepSwitcher を呼ばない。設定変更後は extension を再有効化する。古い Nuts Launcher カスタムショートカットが同じキーを使う場合は GNOME の設定から手動で削除する。

根拠: `nuts-launcher@local/config.js`, `nuts-launcher@local/extension.js`, `install.sh`
