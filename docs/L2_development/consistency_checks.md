# L2 Consistency Checks: Nuts Launcher

## 整合性確認の観点

このプロジェクトは実装済みの GNOME Shell extension であり、主な確認対象は metadata、DBus API、UI 操作、disable 時 cleanup、Wayland セッションでの reload 挙動である。

## 仕様書チェック項目

### metadata.json との整合性（実装後に確認）

- `uuid` が `nuts-launcher@local` であること
- `shell-version` が実機の `gnome-shell --version` 出力と一致すること
- `name` が `Nuts Launcher` であること

根拠: `nuts-launcher@local/metadata.json`

### DBus interface 名の整合性

コード中の DBus interface 名が仕様と一致していること。

| 項目 | 期待値 |
|------|--------|
| interface | `org.gnome.Shell.Extensions.NutsLauncher` |
| object path | `/org/gnome/Shell/Extensions/NutsLauncher` |
| methods | `Show`, `Hide`, `Toggle` |

根拠: `nuts-launcher@local/extension.js`

### disable 時のクリーンアップ確認

`disable()` で以下がすべて実行されることを確認する。

- UI actor が destroy されていること
- DBus object が unexport されていること
- bus name が unown されていること
- signal handler が disconnect されていること

確認方法: `gnome-extensions disable nuts-launcher@local` 後に再度 `enable` しても正常動作すること。

根拠: `nuts-launcher@local/extension.js`

## 受け入れ条件チェックリスト（実装後）

根拠: `README.md`, `nuts-launcher@local/extension.js`

### DBus

- [x] `NutsLauncher.Show` 実行で launcher UI が表示される
- [ ] `NutsLauncher.Hide` 実行で launcher UI が閉じる
- [ ] `NutsLauncher.Toggle` 実行で表示/非表示が切り替わる

### UI

- [x] 表示時に検索入力欄へ focus される
- [x] 入力すると即時に結果が絞り込まれる
- [x] 結果にアプリアイコンとアプリ名が表示される
- [x] `Down` / `Up` で選択行が移動する
- [x] `Enter` で選択中のアプリが起動する
- [x] `Esc` で launcher が閉じる

### FEP 連携

- [ ] wrapper script 経由で FEP が US に切り替わる
- [ ] その後 launcher が表示される
- [ ] 検索欄に英字入力できる

## CI/CD

CI/CD パイプラインは存在しない（個人用ローカル extension のため）。

根拠: リポジトリに `.github/workflows/` 等のディレクトリなし。

## 未確認事項

| 事項 | 理由 | 確認方法 |
|------|------|---------|
| GNOME Shell のバージョン | 実機でのみ確認可能 | `gnome-shell --version` を実行 |
| extension reload の方法 | Wayland では GNOME Shell 再起動が必要な場合あり | 実機で `disable`→`enable` を試行 |
