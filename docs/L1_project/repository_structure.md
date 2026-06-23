# L1 Repository Structure: Nuts Launcher

## 現在のディレクトリ構成（2026-06-23 時点）

```
nuts-launcher/
├── .git/                          # git リポジトリ管理
├── .gitignore                     # DS_Store を除外 (確認済み)
├── nuts-launcher-local-issue.md   # 仕様・設計ドキュメント（実装仕様の source of truth）
├── README.md                      # プロジェクト概要
├── install.sh                     # インストールスクリプト（コピー + enable）
├── nuts-launcher@local/           # GNOME Shell extension 本体
│   ├── metadata.json              # extension メタデータ（uuid, shell-version: ["46"]）
│   ├── extension.js               # DBus, UI, 検索, キー操作, アプリ起動
│   └── stylesheet.css             # ランチャーの見た目（ハードコーディング）
├── docs/                          # AI 向けドキュメント（/init-docs で生成）
│   ├── .ai/
│   │   └── repo.profile.json
│   ├── L0_concept/
│   │   ├── concept.md
│   │   └── policy.md
│   ├── L1_project/
│   │   ├── project_overview.md
│   │   └── repository_structure.md   ← このファイル
│   ├── L2_development/
│   │   ├── operation_model.md
│   │   └── consistency_checks.md
│   └── L3_implementation/
│       ├── specification_summary.md
│       └── nuts-launcher@local/
│           ├── extension.js.md
│           ├── metadata.json.md
│           ├── stylesheet.css.md
│           └── install.sh.md
└── CLAUDE.md                      # AI 運用ガイド
```

根拠: `git diff main...HEAD --name-only`（feat/nuts-launcher-extension ブランチの変更から確認）

## 各ファイルの責務

### `nuts-launcher-local-issue.md`

実装仕様の source of truth。背景・検討案・機能要件・非機能要件・受け入れ条件・実装メモを含む。

根拠: ファイル内容全体を確認済み（`nuts-launcher-local-issue.md:1-594`）

### `README.md`

プロジェクト概要。Features / Installation / Usage / Design Principles を含む。

根拠: `README.md`

### `install.sh`

`nuts-launcher@local/` を GNOME extensions ディレクトリへコピーし、`gnome-extensions enable` で有効化するまでを一括実行するスクリプト。

根拠: `install.sh`

### `nuts-launcher@local/`

GNOME Shell extension 本体。インストール先は `~/.local/share/gnome-shell/extensions/nuts-launcher@local/`。

| ファイル | 役割 |
|---------|------|
| `metadata.json` | GNOME Shell が extension を識別するメタデータ。`shell-version: ["46"]`（GNOME Shell 46.0 実機確認） |
| `extension.js` | DBus, UI, 検索, キー操作, アプリ起動のメイン実装 |
| `stylesheet.css` | ランチャー UI のスタイル定義（ダークテーマ固定） |

根拠: `nuts-launcher@local/`（ブランチで実装済み）

### `.gitignore`

`DS_Store` のみ除外。macOS 環境からの作業痕跡として存在する。

根拠: `.gitignore:1`

## モノレポ構成

モノレポではない。単一の GNOME Shell extension を管理するシンプルなリポジトリ。

根拠: トップレベルに `apps/` / `packages/` 等のディレクトリは存在しない。
