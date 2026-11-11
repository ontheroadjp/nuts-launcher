# L3 Per-file: install.sh

## 目的と動作

GNOME Shell の version と `metadata.json` の `shell-version` を照合してから、extension とラッパーの symlink を作成し、extension の有効化とカスタムショートカットの登録を行う。必要なコマンド・ソースがない場合、version が判定できないか未対応の場合、また既存のインストール先が期待する symlink ではない場合は、設定を変更する前に停止する。

有効化に失敗した場合はエラーと再ログイン後の手順を表示し、失敗終了する。ショートカットの既存 command がラッパーを指していれば設定を維持する。新規登録時は他のカスタムショートカットとのキー衝突を検査する。設定できなかった場合は失敗を報告し、既に作成された symlink は残す。

FepSwitcher の DBus 名が存在しなければ警告する。動作確認用 DBus コマンドを表示するが、自動実行はしない。

## 設計と制限

- 実ディレクトリや別の symlink を削除せず、移動してから再実行するよう案内する。repo を移動すると symlink の修復が必要。
- custom-keybindings の一覧に新しい path を追加する前に、その path の各値を設定する。途中失敗時は一覧に未登録の値が残ることがある。
- 競合検査は既存のカスタムショートカットが対象であり、GNOME 組み込みショートカットや同時実行との競合は検査しない。
- バージョン照合には GJS を使い、対応リストの重複を避ける。

根拠: `install.sh`, `nuts-launcher@local/metadata.json`, `scripts/trigger-nuts-launcher`

## 変更履歴（git log より自動生成）

- 8164e94 fix(#24): harden installer setup and error handling (#25)
- ca4e986 fix(#9): restore launcher focus on GNOME 50 and install via symlink (#10)
- a226491 feat(#7): auto-register GNOME keyboard shortcut from install.sh
- 5419f6a fix(#1): stabilize launcher keyboard grab
- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
