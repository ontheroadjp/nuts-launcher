# L3 Per-file: install.sh

## 目的と動作

GNOME Shell のバージョンを metadata と照合し、extension とラッパーの symlink を作成して extension を有効化する。既存の実ディレクトリや別の symlink は上書きしない。有効化失敗時は手順を案内する。根拠: `install.sh:1-47`。

ショートカットは extension が登録するため、インストーラーは GNOME のカスタムショートカットを作成・削除しない。従来の登録が残っている場合は競合を避けるため手動で削除するよう案内する。根拠: `install.sh:49-55`。

## 変更履歴（git log より自動生成）

- 08ba025 feat(#53): manage configurable shortcut in extension
- 8164e94 fix(#24): harden installer setup and error handling (#25)
- ca4e986 fix(#9): restore launcher focus on GNOME 50 and install via symlink (#10)
- a226491 feat(#7): auto-register GNOME keyboard shortcut from install.sh
- 5419f6a fix(#1): stabilize launcher keyboard grab
- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
