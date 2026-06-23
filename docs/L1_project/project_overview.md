# L1 Project Overview: Nuts Launcher

## プロジェクトの目的

Ubuntu 24.04 LTS / GNOME Wayland 環境で、FEP/IME が US に切り替わった直後にアプリ起動ランチャーを表示するための最小 GNOME Shell extension。

根拠: `nuts-launcher-local-issue.md:133-157`

## 状態（2026-06-23 時点）

**pre-implementation**: 仕様ドキュメント（`nuts-launcher-local-issue.md`）のみが存在し、extension のソースコード（`extension.js`, `metadata.json`, `stylesheet.css`）はまだ実装されていない。

根拠: リポジトリの実ファイル一覧（`.git/`, `.gitignore`, `nuts-launcher-local-issue.md`, `README.md` のみ存在）

## 技術スタック

| 要素 | 内容 | 根拠 |
|------|------|------|
| 実装言語 | GJS (GNOME JavaScript) | `nuts-launcher-local-issue.md:491-502` |
| ランタイム | GNOME Shell (Ubuntu 24.04 LTS, GNOME 46+) | `nuts-launcher-local-issue.md:185-187`, `:462-464` |
| UI フレームワーク | St (Shell Toolkit), Clutter | `nuts-launcher-local-issue.md:363-365` |
| システム API | Gio (アプリ一覧, DBus) | `nuts-launcher-local-issue.md:242-247` |
| 通信 | DBus (Session Bus) | `nuts-launcher-local-issue.md:191-213` |
| パッケージマネージャ | なし（GNOME extension は npm/pip 等不要） | リポジトリに package.json / go.mod 等なし |

## 主要機能

| 機能 | 説明 | 根拠 |
|------|------|------|
| DBus API | `Show()` / `Hide()` / `Toggle()` を提供 | `nuts-launcher-local-issue.md:191-213` |
| アプリ一覧取得 | `Gio.AppInfo.get_all()` で取得、`should_show()` で絞り込み | `nuts-launcher-local-issue.md:242-260` |
| インクリメンタル検索 | case-insensitive 部分一致、入力変更ごとに即時更新 | `nuts-launcher-local-issue.md:264-284` |
| キーボード操作 | `Esc`/`Enter`/`Up`/`Down` | `nuts-launcher-local-issue.md:289-304` |
| アプリ起動 | `appInfo.launch([], null)` | `nuts-launcher-local-issue.md:309-316` |
| 状態リセット | `Show()` 時に検索欄クリア + フォーカス | `nuts-launcher-local-issue.md:319-333` |

## UUID / 識別子

- UUID: `nuts-launcher@local`
- 表示名: `Nuts Launcher`
- DBus interface: `org.gnome.Shell.Extensions.NutsLauncher`
- DBus object path: `/org/gnome/Shell/Extensions/NutsLauncher`

根拠: `nuts-launcher-local-issue.md:160-162`, `:195-199`

## インストール先

```
~/.local/share/gnome-shell/extensions/nuts-launcher@local/
```

根拠: `nuts-launcher-local-issue.md:169`

## 連携コンポーネント

- `FepSwitcher` GNOME Shell extension: DBus `SwitchToUs()` で FEP を US に切り替える（修正しない）
- wrapper script (`~/.local/bin/nuts-launcher-us`): FepSwitcher → NutsLauncher.Show() の順序制御
- GNOME custom shortcut: wrapper script を呼び出すトリガー

根拠: `nuts-launcher-local-issue.md:372-396`
