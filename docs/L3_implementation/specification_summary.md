# L3 Specification Summary: Nuts Launcher

## 実装対象ファイル

根拠: `nuts-launcher@local/`

```
nuts-launcher@local/
├── metadata.json      # extension メタデータ
├── extension.js       # メイン実装（DBus, UI, アプリ検索）
└── stylesheet.css     # スタイル定義
```

## metadata.json

根拠: `nuts-launcher@local/metadata.json`

```json
{
  "uuid": "nuts-launcher@local",
  "name": "Nuts Launcher",
  "description": "Minimal GNOME application launcher with DBus control",
  "shell-version": ["46"],
  "version": 1
}
```

`shell-version` は `["46"]`。

## extension.js: 構造

根拠: `nuts-launcher@local/extension.js`

```js
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class NutsLauncherExtension extends Extension {
  enable() { ... }
  disable() { ... }
}
```

## DBus API

根拠: `nuts-launcher@local/extension.js`

| 項目 | 値 |
|------|-----|
| interface | `org.gnome.Shell.Extensions.NutsLauncher` |
| object path | `/org/gnome/Shell/Extensions/NutsLauncher` |
| method: Show() | launcher UI を表示する |
| method: Hide() | launcher UI を閉じる |
| method: Toggle() | 表示 / 非表示を切り替える |

`disable()` 時に必ず DBus object を unexport し、bus name を unown すること。

## UI 仕様

根拠: `nuts-launcher@local/extension.js`, `nuts-launcher@local/stylesheet.css`

```
+----------------------------------------+
|  Search applications...                |
+----------------------------------------+
|  [icon] Alacritty                      |
|  [icon] Google Chrome                  |
|  [icon] Files                          |
|  [icon] Settings                       |
|  [icon] Log Out                        |
|  [icon] Shut Down                      |
|  [icon] Restart                        |
+----------------------------------------+
```

- 画面中央（primary monitor）に表示
- 検索入力欄 + 検索結果一覧
- 各行にアイコン（St.Icon）とアイテム名を表示
- 選択中の行が視覚的に区別できること
- テーマ・設定 UI は不要
- システムアクション（Log Out / Shut Down / Restart）はリスト末尾に常時表示

## アプリ一覧取得とシステムアクション

根拠: `nuts-launcher@local/extension.js`

```js
const apps = Gio.AppInfo.get_all()
  .filter(app => app.should_show())
  .filter(app => app.get_display_name());
```

各アプリについて保持する情報:
- `Gio.AppInfo` object
- 表示名 (`get_display_name()`)
- lower-case の検索用文字列
- icon (`get_icon()`)
- desktop id（取得できる場合: `get_id()`）

システムアクション（Log Out / Shut Down / Restart）は `_buildSystemItems()` で静的に構築する。各アイテムは `displayName`・`searchKey`・`icon`・`activate` を持ち、`activate` は `SystemActions.getDefault()` の各メソッドへの closure。

## インクリメンタル検索

根拠: `nuts-launcher@local/extension.js`

- 入力変更ごとに即時更新
- case-insensitive 部分一致
- 検索対象: display name, app name, desktop id
- 入力が空の場合: 先頭 N 件のアプリ + 全システムアクションを末尾に表示（合計 MAX_RESULTS = 10）
- 入力がある場合: 部分一致するアプリ + 部分一致するシステムアクションを表示
- 最大表示件数: 10 件

fuzzy search・使用頻度学習は後回し。

## キーボード操作

根拠: `nuts-launcher@local/extension.js`

| キー | 動作 |
|------|------|
| `Esc` | 閉じる（必須） |
| `Enter` | 選択中のアプリを起動して閉じる（必須） |
| `Up` | 選択を上へ移動（必須） |
| `Down` | 選択を下へ移動（必須） |
| `Ctrl+j` | 下へ移動（できれば対応） |
| `Ctrl+k` | 上へ移動（できれば対応） |

- 表示直後に検索入力欄へフォーカス
- 通常文字キーが検索欄へ入ること

## アイテム起動

根拠: `nuts-launcher@local/extension.js`

アプリの場合:
```js
item.info.launch([], null);
```

システムアクションの場合:
```js
item.activate(); // SystemActions.getDefault().activateLogout() 等
```

- 起動後: launcher を閉じる
- アプリ起動失敗時: GNOME Shell log に error を出して launcher を閉じる
- システムアクションは GNOME Shell の確認ダイアログを経由する

## Show() 時の状態リセット

根拠: `nuts-launcher@local/extension.js`

- 検索文字列を空にする
- 選択 index を 0 に戻す
- アプリ一覧を refresh する（または enable 時キャッシュを使用）
- 検索欄に focus する

## フォーカス制御

根拠: `nuts-launcher@local/extension.js`

現行実装は `entry.grab_key_focus()` を使用する。DBus 呼び出し元の key release を奪わないよう、`Show()` は短い timeout 後に modal grab と focus を取得する。

## アイコン表示

根拠: `nuts-launcher@local/extension.js`

```js
const icon = appInfo.get_icon();
// fallback: 'application-x-executable'
```

`Gio.AppInfo.get_icon()` が null の場合は fallback icon (`application-x-executable`) を使う。

## disable() 時のクリーンアップ（必須）

根拠: `nuts-launcher@local/extension.js`

```
UI actor を destroy する
DBus object を unexport する
bus name を unown する
signal handler を disconnect する
```

## wrapper script

根拠: `README.md`

ファイル: `~/.local/bin/nuts-launcher-us`

FepSwitcher.SwitchToUs() を呼んだ後、`sleep 0.05` を挟んで NutsLauncher.Show() を呼ぶ。GNOME custom shortcut にはこの script を絶対パスで指定する。

## やらないこと

根拠: `docs/L0_concept/policy.md`

- Search Light 互換 API
- `ydotool` integration
- `org.gnome.Shell.Eval` 利用
- GNOME Search Provider integration
- Web 検索 / ファイル検索
- 設定画面 / テーマ切替
- fuzzy search / 使用頻度学習 / 最近使ったアプリ履歴
