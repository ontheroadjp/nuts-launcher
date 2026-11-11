# L1 Project Overview: Nuts Launcher

## プロジェクトの目的

GNOME Shell でアプリ起動・検索・システム操作を行うランチャー。別途利用可能な FepSwitcher と wrapper を組み合わせて入力切替後に表示できる。

根拠: `README.md`, `nuts-launcher@local/extension.js`

## 実装状態

**implemented**: `nuts-launcher@local/` に GNOME Shell extension 本体が実装済み。DBus API、launcher UI、検索、キーボード操作、アプリ起動、install script、L3 per-file docs が存在する。

根拠: `nuts-launcher@local/extension.js:11-25`, `install.sh`

## 技術スタック

| 要素 | 内容 | 根拠 |
|------|------|------|
| 実装言語 | GJS (GNOME JavaScript) | `nuts-launcher@local/extension.js` |
| ランタイム | GNOME Shell 46 / 50（metadata に記載） | `nuts-launcher@local/metadata.json` |
| UI フレームワーク | St (Shell Toolkit), Clutter | `nuts-launcher@local/extension.js` |
| システム API | Gio (アプリ一覧, DBus) | `nuts-launcher@local/extension.js` |
| 通信 | DBus (Session Bus) | `nuts-launcher@local/extension.js` |
| パッケージマネージャ | なし（GNOME extension は npm/pip 等不要） | リポジトリに package.json / go.mod 等なし |

## 主要機能

| 機能 | 説明 | 根拠 |
|------|------|------|
| DBus API | `Show()` / `Hide()` / `Toggle()` を提供 | `nuts-launcher@local/extension.js` |
| アプリ一覧取得 | `Gio.AppInfo.get_all()` で取得、`should_show()` で絞り込み | `nuts-launcher@local/extension.js` |
| インクリメンタル検索 | case-insensitive 部分一致、入力変更ごとに即時更新 | `nuts-launcher@local/extension.js` |
| キーボード操作 | `Esc`/`Enter`/`Ctrl+Enter`/`Up`/`Down` | `nuts-launcher@local/extension.js` |
| アプリ起動 | 起動済みなら既存ウィンドウをアクティブ化し、未起動なら起動 | `nuts-launcher@local/extension.js` |
| Web 検索・URL | Google 検索と HTTP / HTTPS URL の起動 | `nuts-launcher@local/extension.js:446-471`, `nuts-launcher@local/extension.js:586-643` |
| システム操作 | 強制終了、電源操作、外部ドライブ取り外し | `nuts-launcher@local/extension.js:316-402` |
| 状態リセット | `Show()` 時に検索欄クリア + フォーカス | `nuts-launcher@local/extension.js` |

## UUID / 識別子

- UUID: `nuts-launcher@local`
- 表示名: `Nuts Launcher`
- DBus interface: `org.gnome.Shell.Extensions.NutsLauncher`
- DBus object path: `/org/gnome/Shell/Extensions/NutsLauncher`

根拠: `nuts-launcher@local/metadata.json`, `nuts-launcher@local/extension.js`

## インストール先

```
~/.local/share/gnome-shell/extensions/nuts-launcher@local/
```

根拠: `README.md`, `install.sh`

## 連携コンポーネント

- `FepSwitcher` GNOME Shell extension: DBus `SwitchToUs()` で FEP を US に切り替える（修正しない）
- wrapper script (`~/.local/bin/trigger-nuts-launcher`): FepSwitcher → NutsLauncher.Toggle() の順序制御
- GNOME custom shortcut: wrapper script を呼び出すトリガー（`install.sh` が条件付きで登録する）

根拠: `README.md`, `install.sh`
