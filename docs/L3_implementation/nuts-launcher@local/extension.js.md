# L3 Per-file: nuts-launcher@local/extension.js

## 目的・役割

GNOME Shell extension `nuts-launcher@local` のメイン実装。DBus サービス、ランチャー UI、アプリ一覧取得、システムアクション（logout/shutdown/restart）、外付けデバイスの eject、インクリメンタル検索、キーボード操作、アイテム起動をこのファイルにまとめている。

根拠コード: `nuts-launcher@local/extension.js:1-492`

## 動作の概要

### ライフサイクル

`enable()` は内部状態を初期化し、UI 作成、アプリ一覧キャッシュ、システムアクション構築、DBus export を行う。

```
enable()
  -> _buildUI()
  -> _loadApps()
  -> _buildSystemItems()
  -> _exportDBus()
```

`disable()` は DBus を解放してから UI を破棄する。UI 破棄では entry の signal disconnect、queued show の cancel、modal grab の release、chrome removal、actor destroy を行う。

```
disable()
  -> _unexportDBus()
  -> _destroyUI()
```

根拠コード: `nuts-launcher@local/extension.js:26-52`, `nuts-launcher@local/extension.js:93-102`, `nuts-launcher@local/extension.js:140-160`

### DBus API

公開する DBus interface は `org.gnome.Shell.Extensions.NutsLauncher`。object path は `/org/gnome/Shell/Extensions/NutsLauncher`。

| method | 動作 |
| ------ | ---- |
| `Show()` | `_queueShow()` で短い遅延後に launcher を表示する |
| `Hide()` | idle callback で `_hide()` を実行する |
| `Toggle()` | 表示中なら `_hide()`、非表示なら `_queueShow()` |

根拠コード: `nuts-launcher@local/extension.js:11-21`, `nuts-launcher@local/extension.js:56-91`

### 表示・フォーカス

`Show()` は直接 `_show()` せず、`SHOW_GRAB_DELAY_MS` 後に `_show()` する。DBus 呼び出し元 terminal/tmux の起動キー release が GNOME Shell の keyboard grab に奪われると、呼び出し元 pane 側でキー repeat 状態が残ることがあるため。

`_show()` は eject アイテムを再構築（`_buildEjectItems()`）し、検索欄を空にし、選択 index を 0 に戻し、結果を再描画してから UI を表示する。その後 `Main.pushModal()` で modal grab を取得し、`_hasKeyboardGrab()` が keyboard grab の取得を確認できた場合だけ entry に `grab_key_focus()` する。取得できなかった場合は grab を pop して UI を隠す。

根拠コード: `nuts-launcher@local/extension.js:162-196`, `nuts-launcher@local/extension.js:205-236`

### UI と signal

UI は `St.BoxLayout` の root、`St.Entry`、結果一覧用 `St.BoxLayout` で構成する。検索入力の `text-changed` とキー操作の `key-press-event` は entry の `ClutterText` に接続する。

キー操作は entry の `key-press-event` に限定し、global stage の `captured-event` は使わない。global stage handler は cleanup 失敗時に Shell 全体へ残るリスクがあるため。

根拠コード: `nuts-launcher@local/extension.js:106-138`

### アプリ一覧とシステムアクション

アプリ一覧は `enable()` 時に `Gio.AppInfo.get_all()` から取得し、`should_show()` と display name で絞り込む。

システムアクション（Log Out、Shut Down、Restart）は `_buildSystemItems()` で静的に構築する。各アイテムは `displayName`、`searchKey`（複数キーワードを空白区切りで含む）、`icon`、`activate` を持つ。`activate` は `SystemActions.getDefault()` の各メソッドへの closure。

根拠コード: `nuts-launcher@local/extension.js:263-288`, `nuts-launcher@local/extension.js:342-353`

### 外付けデバイスの eject

`_buildEjectItems()` は `Gio.VolumeMonitor.get().get_mounts()` から mount を集め、drive ごとにまとめて `Eject <名前>` アイテムを 1 件ずつ作る。対象は `is_removable()`・`can_eject()`・`can_stop()` のいずれかを満たす drive の mount に限る。shadowed な mount と drive を持たない mount（ネットワーク、スマートフォン、gdrive 等）は除外する。1 台に複数の mount がある場合、表示名は mount 名を `, ` で連結する。デバイスがなければアイテムは作らない。`searchKey` は `eject unmount remove <名前>`。

`_ejectDrive(drive, mount, name)` は `drive.can_stop()` なら `drive.stop()`（アンマウント後に電源オフ。Files の「ドライブを安全に取り外す」と同じ）、そうでなければ `drive.eject_with_operation()` を呼ぶ。mount operation には `ShellMountOperation` を使い、使用中デバイスのダイアログを GNOME 標準のものにする。成功時は `Main.notify()`、失敗時は `Main.notifyError()` で通知する（`FAILED_HANDLED` は通知しない）。

根拠コード: `nuts-launcher@local/extension.js:290-340`

### 検索・結果表示

検索は display name と desktop id の case-insensitive 部分一致。表示件数は `MAX_RESULTS`（10）に制限する。

eject アイテムとシステムアクションは eject → システムアクションの順に連結し（以下 `systemItems`）、まとめて扱う。

クエリが空の場合: 先頭 `Math.max(0, MAX_RESULTS - systemItems.length)` 件のアプリ + 全 `systemItems` を末尾に配置する。
クエリがある場合: マッチしたアプリ + マッチした `systemItems` を結合し、最大 `MAX_RESULTS` 件に切り詰める。システムアクションの `searchKey` には "logout"、"shutdown"、"power off"、"reboot" 等の複数キーワードを含んでいる。

検索結果は入力変更ごとに作り直す。各行は icon、label、button press handler を持ち、クリック時は選択 index を更新して起動する。

根拠コード: `nuts-launcher@local/extension.js:357-422`

### キーボード操作・起動

| キー | 動作 |
| ---- | ---- |
| `Esc` | `_hide()` |
| `Enter` / `KP_Enter` | `_launchSelected()` |
| `Down` / `Ctrl+j` | 選択を下へ移動 |
| `Up` / `Ctrl+k` | 選択を上へ移動 |

`_launchSelected()` はアイテムの種類を判別する。`activate` 関数を持つ場合（システムアクション、eject）はそれを呼ぶ。持たない場合（アプリ）は `item.info.launch([], null)` で起動する。起動成功・失敗にかかわらず launcher は閉じる。

根拠コード: `nuts-launcher@local/extension.js:435-491`

## 重要な設計判断

### modal grab は grab object で管理する

`Main.pushModal()` の戻り値を `_modalGrab` に保存し、解放時は同じ object を `Main.popModal()` に渡す。actor を渡して pop すると `incorrect pop` で extension が error state になる可能性がある。

根拠コード: `nuts-launcher@local/extension.js:205-248`

### keyboard grab の判定は GNOME version 差を吸収する

GNOME 46 では `grab.get_seat_state()` の `Clutter.GrabState.KEYBOARD` ビットで判定する。GNOME 50（mutter 18）では `Clutter.Grab` から `get_seat_state()` が削除され、`activate` / `dismiss` / `is_revoked` しか残っていないため、`!grab.is_revoked()` で判定する。`get_seat_state` の有無で分岐し、両 version を同じコードで扱う。

`get_seat_state()` を無条件に呼ぶと GNOME 50 では `TypeError` になり、`_show()` が `grab_key_focus()` 前に中断して launcher にフォーカスが当たらず、`pushModal()` 済みの grab も `_modalGrab` に保存されないままリークする。

根拠コード: `nuts-launcher@local/extension.js:229-236`

### 表示を短く遅延する

DBus `Show()` 直後に keyboard grab を取ると、呼び出し元 terminal/tmux のキー release が失われ、prompt が Enter repeat のような状態になることがある。`SHOW_GRAB_DELAY_MS` で短く遅延し、呼び出し元が入力状態を正常に閉じる余地を作る。

根拠コード: `nuts-launcher@local/extension.js:23`, `nuts-launcher@local/extension.js:162-170`

### key handler は entry に限定する

通常文字入力は entry に流し、launcher 操作用キーだけを `key-press-event` で止める。global stage の `captured-event` は使わない。

根拠コード: `nuts-launcher@local/extension.js:126-134`, `nuts-launcher@local/extension.js:435-461`

### システムアクションは静的リストとして構築する

システムアクションは runtime に変化しないため、`enable()` 時に一度だけ構築する。`SystemActions.getDefault()` の参照を closure に閉じ込め、呼び出しタイミングまで singleton の生存を保証する。

根拠コード: `nuts-launcher@local/extension.js:263-288`

### eject アイテムは Show() ごとに再構築する

接続中のデバイスは runtime に変わるため、eject アイテムは `_show()` のたびに `_buildEjectItems()` で作り直す。`Gio.VolumeMonitor` の signal を接続しないので、`disable()` で追加の cleanup は不要。launcher を開いた後に接続したデバイスは、次に開いたときに表示される。

根拠コード: `nuts-launcher@local/extension.js:180-181`, `nuts-launcher@local/extension.js:290-316`

### ShellMountOperation には mount を渡す

`ShellMountOperation` のコンストラクタは `source.get_drive()` を呼ぶため、mount か volume を渡す必要がある。drive を渡すと `TypeError` になり eject が始まらない。実際の stop / eject は drive に対して行う。

根拠コード: `nuts-launcher@local/extension.js:318-340`

### 空クエリ時はシステムアクションを末尾固定で表示する

空クエリ時のアプリ表示枠を `Math.max(0, MAX_RESULTS - systemItems.length)` に縮め、残り枠に eject アイテムとシステムアクションを必ず表示する。検索時はアプリと `systemItems` を混在させ、検索キーワードでフィルタリングする。

根拠コード: `nuts-launcher@local/extension.js:362-385`

## 統合ポイント

- DBus 呼び出し元: `gdbus call`, wrapper script (`~/.local/bin/nuts-launcher-us`)
- GNOME Shell UI: `Main.layoutManager.addTopChrome()` / `removeChrome()`, `Main.pushModal()` / `popModal()`
- GNOME app list: `Gio.AppInfo.get_all()`
- GNOME system actions: `SystemActions.getDefault()` from `resource:///org/gnome/shell/misc/systemActions.js`
- Removable devices: `Gio.VolumeMonitor`, `Gio.Drive.stop()` / `eject_with_operation()`, `ShellMountOperation` from `resource:///org/gnome/shell/ui/shellMountOperation.js`, `Main.notify()` / `Main.notifyError()`
- UI toolkit: `St.BoxLayout`, `St.Entry`, `St.Icon`, `St.Label`
- Event handling: `Clutter.KEY_*`, `Clutter.GrabState.KEYBOARD`（GNOME 46）, `Clutter.Grab.is_revoked()`（GNOME 50）

## 注意事項・既知の制限

- `shell-version: ["46", "50"]` を対象にしている
- GNOME 50 の `is_revoked()` 判定は、gnome-shell 本体が grab 結果を検査しなくなったため代替として採用したもの。keyboard を取得できなかった grab を確実に検出できるかは未検証
- アプリ一覧は `enable()` 時にキャッシュするため、インストール/アンインストール後は extension reload が必要
- multi-monitor 対応は primary monitor のみ
- fuzzy search、最近使ったアプリ、使用頻度学習は未実装
- システムアクションはアイテムとして表示されるが、実行時には GNOME Shell の確認ダイアログが出る（`SystemActions` の仕様）
- USB ハブ経由で接続した HDD は、`drive.stop()` の成功後にハブが再接続し、自動で再マウントされて回転が止まらないことがある（Files でも同じ挙動）。issue #12 で対応を検討中

## 変更履歴（git log より自動生成）

- f12a1c0 feat: add per-device eject commands to the launcher (#11)
- ca4e986 fix(#9): restore launcher focus on GNOME 50 and install via symlink (#10)
- 918734f fix: allow global shortcuts through the launcher's modal keyboard grab
- 96db5d2 feat(#5): add logout, shutdown, and restart options to the launcher
- 5419f6a fix(#1): stabilize launcher keyboard grab
- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
