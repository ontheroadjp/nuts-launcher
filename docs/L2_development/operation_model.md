# L2 Operation Model: Nuts Launcher

## 前提

- Ubuntu 24.04 LTS + GNOME Wayland 環境
- `FepSwitcher` GNOME extension が稼働済み
- CI/CD パイプラインなし（個人用ローカル extension）

根拠: `nuts-launcher-local-issue.md:185-187`

## GNOME Shell バージョン確認

```bash
gnome-shell --version
```

`metadata.json` の `shell-version` フィールドと一致させること。

根拠: `nuts-launcher-local-issue.md:463-468`

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

根拠: `install.sh`（実装済み）、`nuts-launcher-local-issue.md:472-474`

## 無効化

```bash
gnome-extensions disable nuts-launcher@local
```

根拠: `nuts-launcher-local-issue.md:476-478`

## リロード（変更後の反映）

GNOME Shell extension の変更は、disable → enable で反映される。

```bash
gnome-extensions disable nuts-launcher@local
gnome-extensions enable nuts-launcher@local
```

または Wayland 環境では、GNOME Shell 自体の再ログインが必要になる場合がある（未確認）。

根拠: `nuts-launcher-local-issue.md:472-478`

## ログ確認

```bash
journalctl --user -f /usr/bin/gnome-shell
```

根拠: `nuts-launcher-local-issue.md:480-483`

## DBus 動作確認

extension が有効な状態で以下を実行する。

### Show（表示）

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Show
```

根拠: `nuts-launcher-local-issue.md:411-415`

### Hide（非表示）

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Hide
```

根拠: `nuts-launcher-local-issue.md:419-423`

### Toggle（切り替え）

```bash
gdbus call --session \
  --dest org.gnome.Shell.Extensions.NutsLauncher \
  --object-path /org/gnome/Shell/Extensions/NutsLauncher \
  --method org.gnome.Shell.Extensions.NutsLauncher.Toggle
```

根拠: `nuts-launcher-local-issue.md:427-431`

## wrapper script

FepSwitcher → NutsLauncher.Show() の順番制御は wrapper script で行う。

ファイル: `~/.local/bin/nuts-launcher-us`

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

根拠: `nuts-launcher-local-issue.md:377-401`

## GNOME custom shortcut への割り当て（残作業）

wrapper script を GNOME custom shortcut に登録する。

1. `~/.local/bin/nuts-launcher-us` に wrapper script を作成・配置する（内容は README.md 参照）
2. GNOME Settings → Keyboard → Custom Shortcuts に絶対パスで登録する
3. Search Light のショートカットと別管理にする

根拠: `nuts-launcher-local-issue.md:396-401`
