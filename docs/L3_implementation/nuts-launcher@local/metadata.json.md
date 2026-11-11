# L3 Per-file: nuts-launcher@local/metadata.json

## 目的・役割

GNOME Shell が extension を識別・ロードするためのメタデータ。`gnome-extensions enable nuts-launcher@local` で参照される。

## 内容

| フィールド | 値 | 根拠 |
|-----------|-----|------|
| `uuid` | `nuts-launcher@local` | `nuts-launcher@local/metadata.json:2` |
| `name` | `Nuts Launcher` | `nuts-launcher@local/metadata.json:3` |
| `shell-version` | `["46", "50"]` | `nuts-launcher@local/metadata.json:5`。実機互換性はこのファイルだけでは確認できない |
| `version` | `1` | `nuts-launcher@local/metadata.json:6` |

根拠コード: `nuts-launcher@local/metadata.json`

## 変更履歴（git log より自動生成）

- ca4e986 fix(#9): restore launcher focus on GNOME 50 and install via symlink (#10)
- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
