# L1 Repository Structure: Nuts Launcher

## 現在のディレクトリ構成（2026-06-23 時点）

```
nuts-launcher/
├── .git/                          # git リポジトリ管理
├── .gitignore                     # DS_Store を除外 (確認済み)
├── nuts-launcher-local-issue.md   # 仕様・設計ドキュメント（実装仕様の source of truth）
├── README.md                      # プロジェクト概要（scaffold 済み）
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
│       └── specification_summary.md
└── CLAUDE.md                      # AI 運用ガイド
```

根拠: `ls -la` 実行結果（2026-06-23 時点）

## 未実装（今後追加予定）

仕様書に記載された実装対象ファイル（`nuts-launcher-local-issue.md:175-178`）はまだ存在しない。

```
nuts-launcher@local/               # GNOME extension ディレクトリ（未作成）
├── metadata.json
├── extension.js
└── stylesheet.css
```

これらはリポジトリ内に作成後、インストール先（`~/.local/share/gnome-shell/extensions/nuts-launcher@local/`）にコピーする想定。

根拠: `nuts-launcher-local-issue.md:169-178`

## 各ファイルの責務

### `nuts-launcher-local-issue.md`

実装仕様の source of truth。背景・検討案・機能要件・非機能要件・受け入れ条件・実装メモを含む。

根拠: ファイル内容全体を確認済み（`nuts-launcher-local-issue.md:1-594`）

### `README.md`

プロジェクト概要。現時点では "# Nuts Launcher" のみ。`/init-docs` で scaffold する。

根拠: ファイル内容確認済み（`README.md:1`）

### `.gitignore`

`DS_Store` のみ除外。macOS 環境からの作業痕跡として存在する。

根拠: `.gitignore:1`

## モノレポ構成

モノレポではない。単一の GNOME Shell extension を管理するシンプルなリポジトリ。

根拠: トップレベルに `apps/` / `packages/` 等のディレクトリは存在しない。
