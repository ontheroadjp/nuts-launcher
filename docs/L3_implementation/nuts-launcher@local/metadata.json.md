# L3 Per-file: nuts-launcher@local/metadata.json

## 目的・役割

GNOME Shell が extension を識別・ロードするためのメタデータ。`gnome-extensions enable nuts-launcher@local` で参照される。

## 内容

| フィールド | 値 | 根拠 |
|-----------|-----|------|
| `uuid` | `nuts-launcher@local` | 仕様 `nuts-launcher-local-issue.md:160` |
| `name` | `Nuts Launcher` | 仕様 `nuts-launcher-local-issue.md:162` |
| `shell-version` | `["46"]` | `gnome-shell --version` で GNOME Shell 46.0 を実機確認 |
| `version` | `1` | 初期バージョン |

根拠コード: `nuts-launcher@local/metadata.json`

## 変更履歴（git log より自動生成）

- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
