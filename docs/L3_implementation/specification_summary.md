# L3 Specification Summary: Nuts Launcher

## 実装対象ファイル

根拠: `nuts-launcher-local-issue.md:175-178`

```
nuts-launcher@local/
├── metadata.json      # extension メタデータ
├── extension.js       # メイン実装（DBus, UI, アプリ検索）
└── stylesheet.css     # スタイル定義
```

## metadata.json

根拠: `nuts-launcher-local-issue.md:455-465`

```json
{
  "uuid": "nuts-launcher@local",
  "name": "Nuts Launcher",
  "description": "Minimal GNOME application launcher with DBus control",
  "shell-version": ["46"],
  "version": 1
}
```

`shell-version` は `gnome-shell --version` の出力で確定させること。

## extension.js: 構造

根拠: `nuts-launcher-local-issue.md:491-502`

```js
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

export default class NutsLauncherExtension extends Extension {
  enable() { ... }
  disable() { ... }
}
```

## DBus API

根拠: `nuts-launcher-local-issue.md:191-213`

| 項目 | 値 |
|------|-----|
| interface | `org.gnome.Shell.Extensions.NutsLauncher` |
| object path | `/org/gnome/Shell/Extensions/NutsLauncher` |
| method: Show() | launcher UI を表示する |
| method: Hide() | launcher UI を閉じる |
| method: Toggle() | 表示 / 非表示を切り替える |

`disable()` 時に必ず DBus object を unexport し、bus name を unown すること。

## UI 仕様

根拠: `nuts-launcher-local-issue.md:219-238`

```
+----------------------------------------+
|  Search applications...                |
+----------------------------------------+
|  [icon] Alacritty                      |
|  [icon] Google Chrome                  |
|  [icon] Files                          |
|  [icon] Settings                       |
+----------------------------------------+
```

- 画面中央（primary monitor）に表示
- 検索入力欄 + 検索結果一覧
- 各行にアプリアイコン（St.Icon）とアプリ名を表示
- 選択中の行が視覚的に区別できること
- テーマ・設定 UI は不要

## アプリ一覧取得

根拠: `nuts-launcher-local-issue.md:242-260`

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

## インクリメンタル検索

根拠: `nuts-launcher-local-issue.md:264-284`

- 入力変更ごとに即時更新
- case-insensitive 部分一致
- 検索対象: display name, app name, desktop id
- 入力が空の場合: 先頭 N 件（8〜10 件）を表示
- 入力がある場合: 部分一致するアプリのみ表示
- 最大表示件数: 8〜10 件

fuzzy search・使用頻度学習は後回し。

## キーボード操作

根拠: `nuts-launcher-local-issue.md:289-304`

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

## アプリ起動

根拠: `nuts-launcher-local-issue.md:309-316`

```js
appInfo.launch([], null);
```

- 起動成功後: launcher を閉じる
- 起動失敗時: GNOME Shell log に error を出して launcher を閉じる

## Show() 時の状態リセット

根拠: `nuts-launcher-local-issue.md:319-333`

- 検索文字列を空にする
- 選択 index を 0 に戻す
- アプリ一覧を refresh する（または enable 時キャッシュを使用）
- 検索欄に focus する

## フォーカス制御

根拠: `nuts-launcher-local-issue.md:517-524`

実装候補:
- `global.stage.set_key_focus(entry)`
- `entry.grab_key_focus()`

GNOME Shell version により使える API を確認すること。

## アイコン表示

根拠: `nuts-launcher-local-issue.md:533-540`

```js
const icon = appInfo.get_icon();
// fallback: 'application-x-executable'
```

`Gio.AppInfo.get_icon()` が null の場合は fallback icon (`application-x-executable`) を使う。

## disable() 時のクリーンアップ（必須）

根拠: `nuts-launcher-local-issue.md:506-513`

```
UI actor を destroy する
DBus object を unexport する
bus name を unown する
signal handler を disconnect する
```

## wrapper script

根拠: `nuts-launcher-local-issue.md:372-401`

ファイル: `~/.local/bin/nuts-launcher-us`

FepSwitcher.SwitchToUs() を呼んだ後、`sleep 0.05` を挟んで NutsLauncher.Show() を呼ぶ。GNOME custom shortcut にはこの script を絶対パスで指定する。

## やらないこと

根拠: `nuts-launcher-local-issue.md:542-556`

- Search Light 互換 API
- `ydotool` integration
- `org.gnome.Shell.Eval` 利用
- GNOME Search Provider integration
- Web 検索 / ファイル検索
- 設定画面 / テーマ切替
- fuzzy search / 使用頻度学習 / 最近使ったアプリ履歴
