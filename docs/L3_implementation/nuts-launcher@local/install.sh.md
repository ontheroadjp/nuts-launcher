# L3 Per-file: install.sh

## 目的・役割

`nuts-launcher@local/` を GNOME extensions ディレクトリへコピーし、`gnome-extensions enable` で有効化するまでを一括実行するインストールスクリプト。

## 動作フロー

```
1. スクリプトのディレクトリを基準に EXTENSION_DIR を解決
2. 既存の INSTALL_DIR (${HOME}/.local/share/gnome-shell/extensions/nuts-launcher@local) を削除
3. INSTALL_DIR へ `nuts-launcher@local/` を `cp -r`
4. `gnome-extensions enable nuts-launcher@local` を実行
5. 成功時は動作確認コマンド（gdbus call Show）を標準出力に案内
6. 失敗時は Wayland で GNOME Shell が extension をまだ認識していない可能性と、再ログイン後の enable 手順を案内
```

## 使用方法

```bash
./install.sh
```

## 注意事項

- 既存インストールがある場合は削除してからコピーするため、ネストしたコピーを避けられる
- `gnome-extensions enable` に失敗しても案内を表示し、スクリプト自体は異常終了しない
- GNOME Shell の再起動（再ログイン）が必要な場合がある（Wayland 環境）

根拠コード: `install.sh`

## 変更履歴（git log より自動生成）

- 5419f6a fix(#1): stabilize launcher keyboard grab
- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
