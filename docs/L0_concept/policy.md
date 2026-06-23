# L0 Policy: Nuts Launcher

## 技術選定ポリシー

### GNOME Shell extension として実装する理由

GNOME Shell extension は GNOME Shell プロセス内で動作するため、Shell の内部 API（St, Clutter, Main 等）に直接アクセスでき、DBus サービスの登録も安定して行える。

根拠: `nuts-launcher-local-issue.md:165-178`

### GJS / Gio / St / Clutter のみ使用する

外部コマンドや Node.js に依存しない。GNOME Shell extension 内で利用可能な標準ライブラリのみで完結させる。

根拠: `nuts-launcher-local-issue.md:362-366`

### GNOME 45+ ESM import 形式を使用する

Ubuntu 24.04 LTS の GNOME Shell version に合わせる。古い `imports.ui.main` 形式ではなく ESM import 形式を使用する。

```js
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
```

根拠: `nuts-launcher-local-issue.md:491-502`

## セキュリティ方針

### DBus API の公開範囲

提供する DBus interface は `Show()` / `Hide()` / `Toggle()` のみ。任意コード実行 API（`Eval` 相当）は提供しない。

根拠: `nuts-launcher-local-issue.md:191-213`

### disable 時のリソース解放

`disable()` で必ず UI actor の destroy、DBus object の unexport、bus name の unown、signal handler の disconnect を行う。cleanup 漏れは extension reload 時の破損を招く。

根拠: `nuts-launcher-local-issue.md:506-513`

## パフォーマンス要件

- 検索はインクリメンタルに更新されること（入力変更ごとに即時更新）
- アプリ一覧取得は `enable` 時にキャッシュし、`Show()` 時に必要なら軽く更新する設計でもよい
- 初期実装ではシンプルさを優先する

根拠: `nuts-launcher-local-issue.md:264-284`, `nuts-launcher-local-issue.md:327-333`

## 禁止事項

- `org.gnome.Shell.Eval` の利用（環境依存で動作不安定）
- X11 前提ツール（`xdotool` 等）の利用
- `FepSwitcher` への変更
- Search Light の fork またはコード変更
- 設定 UI の実装
- 外部コマンド依存

根拠: `nuts-launcher-local-issue.md:542-556`

## スコープ外（将来実装候補）

以下はこの実装では対象外だが、将来の拡張として検討可能。

- fuzzy search（現状は case-insensitive 部分一致）
- 最近使ったアプリ優先表示
- 使用頻度学習
- multi-monitor 対応（現状は primary monitor のみ）
- `Ctrl+j` / `Ctrl+k` キーバインド

根拠: `nuts-launcher-local-issue.md:281-285`, `nuts-launcher-local-issue.md:297-299`
