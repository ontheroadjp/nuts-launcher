# CLAUDE.md — Nuts Launcher

AI 運用の single source of truth。

## プロジェクト概要

Ubuntu 24.04 LTS / GNOME Wayland 向けの最小アプリ起動 GNOME Shell extension。
DBus API (`Show`/`Hide`/`Toggle`) で外部から制御する。FEP/IME 切替は担当しない。

仕様の source of truth: `nuts-launcher-local-issue.md`

## Custom / Command の使い分け（AI向けルール）

- `/task`: ドキュメント変更を伴う実装に特化。issue 自動生成〜実装〜ドラフト PR 作成まで。docs/* は変更しない。
- `/patch`: ドキュメント変更を伴わない軽微な修正に特化。issue/PR 不要。branch + commit → ユーザーが main へマージ。スコープが広がった場合は /task へエスカレーション。
- `/docs-sync`: git diff を事実として docs を最小更新し、ドラフト PR を公開する。HARD STOP 時は /init-docs を要求して終了する。
- `/init-docs`: repo の実態把握と設計ドキュメント再構築。重い初期化。docs-sync が説明不能になった時点でここに戻る。

## 重要な実装上の制約

コード変更前に必ず `docs/L0_concept/policy.md` を参照すること。

- `FepSwitcher` のコードは**修正しない**
- FEP/IME 切替は`この extension 内では行わない`
- 外部コマンド・Node.js に依存するコードを追加しない
- `org.gnome.Shell.Eval` を使うコードを追加しない
- `disable()` 時のクリーンアップ（DBus unexport, bus name unown, signal disconnect, UI destroy）を必ず実装する

根拠: `nuts-launcher-local-issue.md:336-369`, `docs/L0_concept/policy.md`

## 技術スタック

- 言語: GJS (GNOME JavaScript)
- ランタイム: GNOME Shell (Ubuntu 24.04 LTS, 想定 GNOME 46+)
- UI: St (Shell Toolkit), Clutter
- API: Gio (アプリ一覧, DBus)
- Import 形式: GNOME 45+ ESM (`import Gio from 'gi://Gio'` 等)

## Local Tooling Environment

Observed by /init-docs on 2026-06-23:
- gh: 2.95.0
- gh auth: Logged in to github.com as `ontheroadjp` (keyring, SSH protocol)
- node: v24.16.0 (managed by mise)
- npm: 11.13.0 (managed by mise)
- Node runtime manager: mise (confirmed via `mise current`)

Notes:
- If `gh` operations fail with API schema or compatibility errors, check `gh --version` first. Prefer upgrading `gh` when possible; if upgrading is impossible, use an equivalent `gh api` REST call or GitHub Web UI for the affected operation.
- Before npm operations, run `node --version` and `npm --version` to confirm Node.js and npm are available in the current shell. This also initializes Node.js in lazy-loaded runtime manager environments such as mise.
- Do not install or upgrade `gh`, Node.js, or npm automatically without explicit user confirmation.
- Node.js is not used in this project directly — the extension runs in GJS inside GNOME Shell.

## 未実装状態について（2026-06-23 時点）

`nuts-launcher@local/` ディレクトリ（`metadata.json`, `extension.js`, `stylesheet.css`）はまだ作成されていない。
実装は `nuts-launcher-local-issue.md:559-574` の作業ステップに従って進める。
