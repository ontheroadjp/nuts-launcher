# L3 Per-file: nuts-launcher@local/extension.js

## 目的・役割

GNOME Shell extension `nuts-launcher@local` のメイン実装。DBus サービス、ランチャー UI、アプリ一覧取得、システムアクション（suspend/logout/shutdown/restart）、外付けデバイスの eject、インクリメンタル検索、キーボード操作、アイテム起動をこのファイルにまとめている。

根拠コード: `nuts-launcher@local/extension.js:1-658`

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

根拠コード: `nuts-launcher@local/extension.js:26-65`, `nuts-launcher@local/extension.js:107-115`, `nuts-launcher@local/extension.js:174-198`

### DBus API

公開する DBus interface は `org.gnome.Shell.Extensions.NutsLauncher`。object path は `/org/gnome/Shell/Extensions/NutsLauncher`。

| method | 動作 |
| ------ | ---- |
| `Show()` | `_queueShow()` で短い遅延後に launcher を表示する |
| `Hide()` | idle callback で `_hide()` を実行する |
| `Toggle()` | 表示中なら `_hide()`、非表示なら `_queueShow()` |

根拠コード: `nuts-launcher@local/extension.js:11-21`, `nuts-launcher@local/extension.js:69-104`

### 表示・フォーカス

`Show()` は直接 `_show()` せず、`SHOW_GRAB_DELAY_MS` 後に `_show()` する。DBus 呼び出し元 terminal/tmux の起動キー release が GNOME Shell の keyboard grab に奪われると、呼び出し元 pane 側でキー repeat 状態が残ることがあるため。

`_show()` は eject アイテムを再構築（`_buildEjectItems()`）し、検索欄を空にし、選択 index を 0 に戻し、結果を再描画してから UI を表示する。その後 `Main.pushModal()` で modal grab を取得し、`_hasKeyboardGrab()` が keyboard grab の取得を確認できた場合だけ entry に `grab_key_focus()` する。取得できなかった場合は grab を pop して UI を隠す。

根拠コード: `nuts-launcher@local/extension.js:200-237`, `nuts-launcher@local/extension.js:249-280`

### UI と signal

UI は `St.BoxLayout` の root、`St.Entry`、結果一覧用 `St.BoxLayout` で構成する。検索入力の `text-changed` とキー操作の `key-press-event` は entry の `ClutterText` に接続する。

root の `captured-event` はボタン押下の座標を root の表示領域と比較する。外側なら `_hide()` で閉じて modal grab を解放し、内側ならイベントを通常どおり伝播する。handler は root の破棄時に解放される。

キー操作は entry の `key-press-event` に限定し、global stage の `captured-event` は使わない。global stage handler は cleanup 失敗時に Shell 全体へ残るリスクがあるため。

根拠コード: `nuts-launcher@local/extension.js:120-171`, `nuts-launcher@local/extension.js:174-198`

### アプリ一覧とシステムアクション

アプリ一覧は `enable()` 時に `Gio.AppInfo.get_all()` から取得し、`should_show()` と display name で絞り込む。

システムアクション（Suspend、Log Out、Shut Down、Restart）は `_buildSystemItems()` で静的に構築する。各アイテムは `displayName`、`searchKey`（複数キーワードを空白区切りで含む）、`icon`、`activate` を持つ。`activate` は `SystemActions.getDefault()` の各メソッドへの closure。Suspend は `suspend` または `sleep` で検索できる。

根拠コード: `nuts-launcher@local/extension.js:340-372`, `nuts-launcher@local/extension.js:426-437`

### 外付けデバイスの eject

`_buildEjectItems()` は `Gio.VolumeMonitor.get().get_mounts()` から mount を集め、drive ごとにまとめて `Eject <名前>` アイテムを 1 件ずつ作る。対象は `is_removable()`・`can_eject()`・`can_stop()` のいずれかを満たす drive の mount に限る。shadowed な mount と drive を持たない mount（ネットワーク、スマートフォン、gdrive 等）は除外する。1 台に複数の mount がある場合、表示名は mount 名を `, ` で連結する。デバイスがなければアイテムは作らない。`searchKey` は `eject unmount remove <名前>`。

`_ejectDrive(drive, mount, name)` は `drive.can_stop()` なら `drive.stop()`（コード上のコメントではアンマウント後の電源オフを意図）、そうでなければ `drive.eject_with_operation()` を呼ぶ。mount operation には `ShellMountOperation` を使い、使用中デバイスのダイアログを GNOME 標準のものにする。成功時は `Main.notify()`、失敗時は `Main.notifyError()` で通知する（`FAILED_HANDLED` は通知しない）。

根拠コード: `nuts-launcher@local/extension.js:374-424`

### 起動中アプリの強制終了

`_show()` ごとに `Shell.AppSystem.get_running()` から `Force Quit <名前>` 項目を作る。GNOME Shell が返す起動中アプリが対象で、`force quit` とアプリ名で検索できる。選択時はその時点の `app.get_windows()` を取得し、各ウィンドウに `kill()` を呼ぶ。終了済みでウィンドウがなければ何もしない。例外はログと通知で報告し、残りのウィンドウの処理を続ける。未保存データは失われ得る。

根拠コード: `nuts-launcher@local/extension.js:218-223`, `nuts-launcher@local/extension.js:316-338`

### 検索・結果表示

検索は display name と desktop id の case-insensitive 部分一致。表示件数は `MAX_RESULTS`（10）に制限する。

強制終了、eject、システムアクションの順に連結し（以下 `systemItems`）、まとめて扱う。

通常検索でクエリが空の場合は結果を表示しない。クエリがある場合はアプリと `systemItems` の一致に加え、Web Search、Amazon Search、YouTube Search、Open URL を表示する。一致する候補は完全一致、先頭一致、部分一致の順に並び、同順位は元の順序を保つ。一致しない検索項目と Open URL も表示枠を確保する。専用検索モードでは選択した項目のみ表示する。

通常検索では、有効な四則演算式の結果を先頭に表示し、選択するとクリップボードにコピーする。整数部分が 4 桁以上の結果は、その下にカンマ区切りの候補も表示する。続いて入力式と結果を連結した候補を表示し、式または結果に 4 桁以上の整数部分があればカンマ区切り版も表示する。式付き候補では `*` と `/` を `×` と `÷` で表示する。各候補は選択した形式でコピーする。小数、符号、括弧と演算子の優先順位に対応する。式は専用パーサーで処理し、任意の JavaScript は実行しない。不完全な式、ゼロ除算、非有限の結果は通常の検索として扱う。入力長は 512 文字、入れ子は 100 段階までに制限する。

根拠コード: `nuts-launcher@local/extension.js:26-89`, `nuts-launcher@local/extension.js:535-585`

Amazon Search は Font Awesome の Amazon SVG を白色で表示する。アイコンの出典とライセンスは同梱の `amazon-icon-license.txt` に記載する。

YouTube Search も Font Awesome の SVG を白色で表示し、出典とライセンスは `youtube-icon-license.txt` に記載する。

根拠コード: `nuts-launcher@local/extension.js:105-113`, `nuts-launcher@local/extension.js:542-599`

HTTP / HTTPS URL は検証後に先頭の Open URL 項目として表示する。Open URL を項目名や `http`、`https` に一致する検索文字列で選ぶと入力モードに切り替え、それ以外の入力ではその文字列を URL として開く。スキームがなければ `https://` を補う。空欄・無効な URL・他のスキームは開かない。検索結果は最大 10 件とする。

検索結果は入力変更ごとに作り直す。各行は icon、label、button press handler を持ち、クリック時は選択 index を更新して起動する。

根拠コード: `nuts-launcher@local/extension.js:441-537`

### キーボード操作・起動

| キー | 動作 |
| ---- | ---- |
| `Esc` | `_hide()` |
| `Enter` / `KP_Enter` | `_launchSelected()` |
| `Ctrl+Enter` / `Ctrl+KP_Enter` | アプリに新しいウィンドウを要求 |
| `Down` / `Ctrl+j` | 選択を下へ移動 |
| `Up` / `Ctrl+k` | 選択を上へ移動 |

`_launchSelected()` は Web Search を空欄または項目名の部分一致で選ぶと、入力欄を消去して Web 検索モードに切り替える。それ以外の検索語では launcher を閉じ、エンコードした検索語を含む Google 検索 URI を既定のブラウザで開く。Web 検索モードでは入力後の Enter で検索する。アプリやアクションの起動時も先に launcher を閉じて modal grab を解放する。アプリは desktop ID で `Shell.AppSystem` から検索し、通常は `Shell.App.activate()`、Ctrl+Enter では `open_new_window(-1)` を呼ぶ。アプリが見つからない場合は `item.info.launch([], null)` を使う。

Open URL を名前に一致する入力から選ぶと入力欄を消去して URL 入力モードに切り替え、それ以外の有効な入力は直接開く。有効な URL 項目を選ぶと launcher を閉じて既定のブラウザで開き、失敗時はログと通知で報告する。Web Search と Open URL は GNOME Shell の起動コンテキストを渡してブラウザのアクティブ化を要求する。表示・非表示時にモードをリセットする。

Amazon Search は項目名に一致する検索語で選ぶと入力欄を消去し Amazon 検索モードに切り替える。それ以外の検索語では URL エンコードして Amazon.co.jp の検索結果を既定のブラウザで開く。専用モードでも入力後の Enter で検索する。

YouTube Search も同様に専用モードへ切り替え、または URL エンコードした検索語で YouTube の検索結果を既定のブラウザで開く。

根拠コード: `nuts-launcher@local/extension.js:770-786`

根拠コード: `nuts-launcher@local/extension.js:727-756`

Enter は `ClutterText::activate` で処理し、入力メソッドによる変換確定を優先する。Ctrl の状態は現在のイベントから取得する。

根拠コード: `nuts-launcher@local/extension.js:228-236`, `nuts-launcher@local/extension.js:669-741`

## 重要な設計判断

### modal grab は grab object で管理する

`Main.pushModal()` の戻り値を `_modalGrab` に保存し、解放時は同じ object を `Main.popModal()` に渡す。actor を渡して pop すると `incorrect pop` で extension が error state になる可能性がある。

根拠コード: `nuts-launcher@local/extension.js:249-291`

### keyboard grab の判定は GNOME version 差を吸収する

GNOME 46 では `grab.get_seat_state()` の `Clutter.GrabState.KEYBOARD` ビットで判定する。GNOME 50（mutter 18）では `Clutter.Grab` から `get_seat_state()` が削除され、`activate` / `dismiss` / `is_revoked` しか残っていないため、`!grab.is_revoked()` で判定する。`get_seat_state` の有無で分岐し、両 version を同じコードで扱う。

`get_seat_state()` を無条件に呼ぶと GNOME 50 では `TypeError` になり、`_show()` が `grab_key_focus()` 前に中断して launcher にフォーカスが当たらず、`pushModal()` 済みの grab も `_modalGrab` に保存されないままリークする。

根拠コード: `nuts-launcher@local/extension.js:249-280`

### 表示を短く遅延する

DBus `Show()` 直後に keyboard grab を取ると、呼び出し元 terminal/tmux のキー release が失われ、prompt が Enter repeat のような状態になることがある。`SHOW_GRAB_DELAY_MS` で短く遅延し、呼び出し元が入力状態を正常に閉じる余地を作る。

根拠コード: `nuts-launcher@local/extension.js:23`, `nuts-launcher@local/extension.js:200-207`

### key handler は entry に限定する

通常文字入力は entry に流し、launcher 操作用キーだけを `key-press-event` で止める。global stage の `captured-event` は使わない。

根拠コード: `nuts-launcher@local/extension.js:154-168`, `nuts-launcher@local/extension.js:551-572`

### システムアクションは静的リストとして構築する

システムアクションの項目は `enable()` 時に一度だけ構築する。`SystemActions.getDefault()` の参照を各 action の closure から使う。

根拠コード: `nuts-launcher@local/extension.js:340-372`

### eject アイテムは Show() ごとに再構築する

接続中のデバイスは runtime に変わるため、eject アイテムは `_show()` のたびに `_buildEjectItems()` で作り直す。`Gio.VolumeMonitor` の signal を接続しないので、`disable()` で追加の cleanup は不要。launcher を開いた後に接続したデバイスは、次に開いたときに表示される。

根拠コード: `nuts-launcher@local/extension.js:218-223`, `nuts-launcher@local/extension.js:374-400`

### ShellMountOperation には mount を渡す

コードは `ShellMountOperation` に mount を渡し、stop / eject は drive に対して行う。コメントには mount operation が `source.get_drive()` を呼ぶためと記載されている。

根拠コード: `nuts-launcher@local/extension.js:402-424`

### 通常の検索では Web Search を表示する

通常モードでは空クエリ時に結果を表示しない。入力時はアプリと `systemItems` を絞り込み、Web Search、Amazon Search、YouTube Search、Open URL を表示する。URL 入力モードでは Open URL を表示する。

根拠コード: `nuts-launcher@local/extension.js:471-500`

## 統合ポイント

- DBus 呼び出し元: `gdbus call`, wrapper script (`~/.local/bin/trigger-nuts-launcher`)
- GNOME Shell UI: `Main.layoutManager.addTopChrome()` / `removeChrome()`, `Main.pushModal()` / `popModal()`
- GNOME app list: `Gio.AppInfo.get_all()`
- GNOME app activation: `Shell.AppSystem.get_default().lookup_app()` / `Shell.App.activate()` / `Shell.App.open_new_window()`
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
- システムアクションの実行時の確認や可用性は GNOME Shell の `SystemActions` に従う
- USB ハブ経由の HDD の再マウント・停止挙動は環境依存であり、実機確認が必要（関連 issue #12）。

## 変更履歴（git log より自動生成）

- 4b80551 fix(#50): rank results and improve open URL action
- d9eaade feat(#41): add YouTube search
- ffbd738 feat(#39): add Amazon search (#40)
- 6d07b24 fix(#37): request browser activation for web links (#38)
- 1af9bdc feat(#35): add calculator search results (#36)
- f727afd refactor: simplify launcher actions and cleanup
- 3328e4f feat(#32): open web addresses from launcher (#33)
- aeb411b feat(#28): add web search to launcher (#29)
- 46ec9c0 feat(#26): add force quit actions for running apps (#27)
- d134e11 feat(#20): close launcher on outside click (#21)
- c62eadf feat(#18): add suspend action to launcher (#19)
