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
  "shell-version": ["46", "50"],
  "version": 1
}
```

`shell-version` は `["46", "50"]`（GNOME Shell 46 / 50）。

## extension.js: 構造

根拠: `nuts-launcher@local/extension.js`

```js
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import * as ShellMountOperation from 'resource:///org/gnome/shell/ui/shellMountOperation.js';
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
|  [icon] Web Search...                  |
+----------------------------------------+
```

- primary monitor の水平方向中央、垂直方向は上から約 1/3 の位置に表示（`nuts-launcher@local/extension.js:294-304`）
- 検索入力欄 + 検索結果一覧
- 各行にアイコン（St.Icon）とアイテム名を表示
- 選択中の行が視覚的に区別できること
- ランチャーの外側をクリックすると閉じる
- テーマ・設定 UI は不要
- システムアクションと接続中デバイスの eject は検索文字列に一致した場合に表示する
- 通常の検索モードでは Web Search を表示する。URL 入力モードでは Open URL を表示する
- HTTP / HTTPS URL は Open URL として先頭に表示する。Open URL 入力モードへの入口は `open url`、`http`、`https` に一致する検索で表示する

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

システムアクション（Suspend / Log Out / Shut Down / Restart）は `_buildSystemItems()` で静的に構築する。各アイテムは `displayName`・`searchKey`・`icon`・`activate` を持ち、`activate` は `SystemActions.getDefault()` の各メソッドへの closure。Suspend は `suspend` または `sleep` で検索できる。

eject アイテムは `_buildEjectItems()` で `Show()` ごとに再構築する。`Gio.VolumeMonitor` の mount を drive 単位でまとめ、removable / ejectable / stoppable な drive だけを対象にする。

強制終了アイテムは `Show()` ごとに `Shell.AppSystem.get_running()` から作る。GNOME Shell が返す起動中アプリごとに `Force Quit <名前>` を表示する。

## インクリメンタル検索

根拠: `nuts-launcher@local/extension.js`

- 入力変更ごとに即時更新
- case-insensitive 部分一致
- 検索対象: display name、desktop id、および各アクションの検索語
- 入力が空の場合: Web Search のみ表示
- 入力がある場合: 部分一致するアプリ、強制終了、eject、システムアクションを最大 9 件表示し、Web Search を追加する。強制終了は `force quit` / アプリ名で検索可
- 通常検索では四則演算と括弧を含む有効な式の結果と式付き結果を先頭に表示し、選択した形式をクリップボードにコピーする。整数部分が 4 桁以上の場合はカンマ区切りの候補も表示し、式付き候補では `*` と `/` を `×` と `÷` で表示する。不正な式やゼロ除算は計算候補を表示しない
- 空欄または Web Search の項目名に一致する文字列で Web Search を選ぶと入力を消去し、Web 検索モードに切り替える。それ以外の文字列から選ぶと、その文字列で Google 検索を開く。Web 検索モードでは入力後の Enter で検索する
- Open URL を選ぶと URL 入力モードへ切り替え、スキームを省略した入力には `https://` を補う。有効な URL を選択すると既定のブラウザで開く。空欄、無効な URL、HTTP / HTTPS 以外のスキームは開かない
- Enter は入力メソッドによる変換確定を優先する

fuzzy search・使用頻度学習は実装されていない。

## キーボード操作

根拠: `nuts-launcher@local/extension.js`

| キー | 動作 |
|------|------|
| `Esc` | 閉じる（必須） |
| `Enter` | 入力メソッドが処理しない場合、選択中の項目を実行する |
| `Ctrl+Enter` | 選択中のアプリに新しいウィンドウを要求する |
| `Up` | 選択を上へ移動（必須） |
| `Down` | 選択を下へ移動（必須） |
| `Ctrl+j` | 下へ移動（できれば対応） |
| `Ctrl+k` | 上へ移動（できれば対応） |

- 表示直後に検索入力欄へフォーカス
- 通常文字キーが検索欄へ入ること

## アイテム起動

根拠: `nuts-launcher@local/extension.js`

launcher を閉じて modal grab を解放した後、アプリの場合は desktop ID で `Shell.AppSystem` から取得したアプリを通常は `activate()` する。起動済みなら既存ウィンドウをアクティブ化し、未起動なら起動する。Ctrl+Enter では `open_new_window(-1)` を呼ぶ。取得できない場合は `item.info.launch([], null)` を使う。

システムアクションの場合:
```js
item.activate(); // SystemActions.getDefault().activateLogout()、_ejectDrive() 等
```

- アプリ起動失敗時: GNOME Shell log に error を出す
- システムアクションは GNOME Shell の `SystemActions` に委ねる。確認ダイアログや可用性は実機で確認する
- eject は `drive.stop()`（不可なら `drive.eject_with_operation()`）を `ShellMountOperation` 付きで実行し、結果を通知する
- 強制終了は選択時に対象アプリの現在のウィンドウごとに `kill()` を呼び、例外はログと通知で報告する。未保存データは失われ得る

## Show() 時の状態リセット

根拠: `nuts-launcher@local/extension.js`

- 検索文字列を空にする
- 選択 index を 0 に戻す
- アプリ一覧は enable 時のキャッシュを使用する
- 検索欄に focus する

## フォーカス制御

根拠: `nuts-launcher@local/extension.js`

現行実装は `entry.grab_key_focus()` を使用する。DBus 呼び出し元の key release を奪わないよう、`Show()` は短い timeout 後に modal grab と focus を取得する。

keyboard grab の取得確認は GNOME 46 では `grab.get_seat_state()` の `Clutter.GrabState.KEYBOARD`、`get_seat_state()` が削除された GNOME 50 では `!grab.is_revoked()` で行う。

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

ファイル: `~/.local/bin/trigger-nuts-launcher`

FepSwitcher.SwitchToUs() を呼んだ後、`sleep 0.05` を挟んで NutsLauncher.Toggle() を呼ぶ。FepSwitcher の呼び出しが失敗しても Toggle を試みる。GNOME custom shortcut にはこの script を絶対パスで指定する。

## 現在の対象外

根拠: `README.md`、`nuts-launcher@local/extension.js`

以下は現在の実装に含まれない機能・連携であり、L0 による一律の禁止を意味しない。

- Search Light 互換 API
- `ydotool` integration
- `org.gnome.Shell.Eval` 利用
- GNOME Search Provider integration
- ファイル検索
- 設定画面 / テーマ切替
- fuzzy search / 使用頻度学習 / 最近使ったアプリ履歴
