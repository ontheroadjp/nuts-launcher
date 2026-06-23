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

extension ディレクトリをコピーし、有効化する。

```bash
cp -r nuts-launcher@local ~/.local/share/gnome-shell/extensions/
gnome-extensions enable nuts-launcher@local
```

根拠: `nuts-launcher-local-issue.md:472-474`

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

## 実装作業ステップ（未実施）

根拠: `nuts-launcher-local-issue.md:559-574`

1. extension skeleton (`nuts-launcher@local/` ディレクトリ) を作る
2. `metadata.json` を作る
3. `extension.js` で enable / disable の基本構造を作る
4. DBus `Show()` / `Hide()` / `Toggle()` を実装する
5. 空の launcher UI を表示できるようにする
6. 検索 entry に focus できるようにする
7. `Gio.AppInfo.get_all()` でアプリ一覧を取得する
8. アプリアイコン + アプリ名の行を表示する
9. 入力ごとの部分一致 filtering を実装する
10. 選択 index と Up / Down を実装する
11. Enter で起動する
12. Esc で閉じる
13. wrapper script から FepSwitcher.SwitchToUs() → NutsLauncher.Show() を確認する
14. GNOME custom shortcut に wrapper script を割り当てる
15. Search Light なしで日常利用できるか確認する
