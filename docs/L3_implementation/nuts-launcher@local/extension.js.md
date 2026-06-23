# L3 Per-file: nuts-launcher@local/extension.js

## 目的・役割

GNOME Shell extension `nuts-launcher@local` のメイン実装。DBus サービス、ランチャー UI、アプリ一覧取得、インクリメンタル検索、キーボード操作、アプリ起動をすべてこのファイルに実装している。

## 動作の概要と主要フロー

### ライフサイクル

```
enable()
  └─ _buildUI()       → St.BoxLayout + St.Entry + St.BoxLayout (results)
  └─ _loadApps()      → Gio.AppInfo.get_all() でキャッシュ
  └─ _exportDBus()    → Gio.DBusExportedObject.wrapJSObject() + Gio.bus_own_name()

disable()
  └─ _unexportDBus()  → bus_unown_name() + dbusImpl.unexport()
  └─ _destroyUI()     → removeChrome() + destroy()
```

### Show() フロー

```
Show()
  └─ _show()
      ├─ entry テキストをクリア
      ├─ selectedIndex を 0 にリセット
      ├─ _updateResults('') → 先頭 MAX_RESULTS 件を表示
      ├─ mainBox.show()
      ├─ _positionWindow() → GLib.idle_add で primary monitor 中央に配置
      └─ global.stage.set_key_focus(entry.get_clutter_text())
```

### 検索フロー

```
entry の text-changed
  └─ _onSearchChanged()
      └─ _updateResults(query)
          ├─ query が空 → apps の先頭 MAX_RESULTS 件
          ├─ query あり → searchKey / desktopId への case-insensitive includes
          └─ _renderResults() → _resultsBox を再構築
              └─ _highlightSelected() → add/remove style_pseudo_class('selected')
```

### キー操作フロー

`mainBox` の `key-press-event` で一元処理する。

| キー | 動作 |
|------|------|
| `Esc` | `_hide()` |
| `Enter` / `KP_Enter` | `_launchSelected()` → `appInfo.launch([], null)` → `_hide()` |
| `Down` / `Ctrl+j` | `_moveSelection(+1)` |
| `Up` / `Ctrl+k` | `_moveSelection(-1)` |
| その他 | `Clutter.EVENT_PROPAGATE`（entry に通常文字が届く） |

## 重要な設計判断

### なぜ `mainBox` でキーイベントを受けるか

`entry.get_clutter_text()` にフォーカスを当てると、`Esc`/`Enter`/`Up`/`Down` が entry に吸収される場合がある。`mainBox` 側でキャプチャすることで、検索文字入力と UI 操作キーを確実に分離できる。

### なぜ `GLib.idle_add` で位置を設定するか

`mainBox.show()` 直後は `get_size()` が (0, 0) を返すことがある。idle_add でレイアウト計算が完了した次のアイドル時に位置を設定することで、正確に中央配置できる。

### アプリ一覧のキャッシュ

`enable()` 時に一度だけ `Gio.AppInfo.get_all()` を実行してキャッシュする（`_apps`）。`Show()` ごとに再取得しない。アプリのインストール/アンインストールへのリアルタイム追従は初期実装のスコープ外。

## 統合ポイント

- **呼び出し元**: DBus (`gdbus call`), wrapper script (`~/.local/bin/nuts-launcher-us`)
- **GNOME Shell API**: `Main.layoutManager.addTopChrome` / `removeChrome`, `global.stage.set_key_focus`
- **Gio**: `AppInfo.get_all()`, `DBusExportedObject`, `bus_own_name`
- **St**: `BoxLayout`, `Entry`, `Icon`, `Label`
- **Clutter**: `KEY_*` 定数, `ModifierType`, `EVENT_STOP` / `EVENT_PROPAGATE`

## 注意事項・既知の制限

- `shell-version: ["46"]` — GNOME Shell 46.0 で動作確認（`gnome-shell --version` で実測）
- マウスクリックによる起動も実装済み（`button-press-event`）
- multi-monitor 対応は未実装（primary monitor のみ）
- fuzzy search・使用頻度学習は未実装（case-insensitive 部分一致のみ）
- アプリのインストール/アンインストール後は `disable` → `enable` でリロードが必要

根拠コード: `nuts-launcher@local/extension.js`

## 変更履歴（git log より自動生成）

- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
