# L3 Per-file: install.sh

## 目的と動作

GNOME Shell のバージョンを metadata と照合し、extension とラッパーの symlink を作成して extension を有効化する。既存の実ディレクトリや別の symlink は上書きしない。有効化失敗時は手順を案内する。根拠: `install.sh:1-47`。

ショートカットは extension が登録するため、インストーラーは GNOME のカスタムショートカットを作成・削除しない。従来の登録が残っている場合は競合を避けるため手動で削除するよう案内する。根拠: `install.sh:49-55`。
