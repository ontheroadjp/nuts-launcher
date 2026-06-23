# L3 Per-file: install.sh

## 目的・役割

`nuts-launcher@local/` を GNOME extensions ディレクトリへコピーし、`gnome-extensions enable` で有効化するまでを一括実行するインストールスクリプト。

## 動作フロー

```
1. スクリプトのディレクトリを基準に EXTENSION_DIR を解決
2. INSTALL_DIR (${HOME}/.local/share/gnome-shell/extensions/nuts-launcher@local) へ cp -r
3. gnome-extensions enable nuts-launcher@local
4. 動作確認コマンド（gdbus call Show）を標準出力に案内
```

## 使用方法

```bash
./install.sh
```

## 注意事項

- 既存インストールがある場合は上書きコピーされる
- `gnome-extensions enable` に失敗した場合は `set -euo pipefail` によりスクリプトが中断する
- GNOME Shell の再起動（再ログイン）が必要な場合がある（Wayland 環境）

根拠コード: `install.sh`
