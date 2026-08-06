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
7. `setup_shortcut()` で GNOME custom keyboard shortcut（既定: Ctrl+Shift+Space）を自動登録する
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

## `setup_shortcut()`: GNOME custom shortcut 自動登録

根拠: `install.sh:54-150`

`scripts/trigger-nuts-launcher` を `~/.local/bin/trigger-nuts-launcher` へ symlink し（`cp` ではなく `ln -sf`。repo 側の変更が再インストールなしで反映されるため）、`org.gnome.settings-daemon.plugins.media-keys` の `custom-keybindings` に `<Control><Shift>space` を割り当てる。

動作フロー:

```
1. gsettings コマンドの有無、および media-keys schema の有無を確認する
   （どちらか欠けている場合は警告を出して setup_shortcut() を早期 return する。
    install.sh 自体は失敗させない — 非 GNOME 環境でも install.sh 全体が壊れないようにするため）
2. ~/.local/bin/trigger-nuts-launcher を symlink する
3. custom-keybindings の既存 path 一覧をパースする
4. command が既に ~/.local/bin/trigger-nuts-launcher を指す既存 entry を探す
   - 見つかった場合: その entry の name/command/binding を上書き（再実行時の冪等性）
   - 見つからない場合:
     - 対象 binding（<Control><Shift>space）が既に別 command に割り当て済みなら、
       既存の他ショートカットを壊さないよう登録をスキップして警告を出す
     - 空いている customN path を採番し、custom-keybindings 配列に追記する
5. 対象 path に name/command/binding を gsettings set する
6. 新規 entry の場合のみ custom-keybindings 配列を書き戻す
```

## 既知の制限

- `custom-keybindings` のパース・再構築は `gsettings` の出力形式（`['/path1/', '/path2/']` 形式）に依存する簡易パーサーであり、GVariant の一般的な文字列配列表現を厳密にはサポートしない
- binding 衝突時は登録をスキップするのみで、ユーザーへの対話的な選択肢は提示しない

## 変更履歴（git log より自動生成）

- a226491 feat(#7): auto-register GNOME keyboard shortcut from install.sh
- 5419f6a fix(#1): stabilize launcher keyboard grab
- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
