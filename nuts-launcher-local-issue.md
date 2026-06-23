# Issue: GNOME Shell extension `nuts-launcher@local` を実装する

## 背景

Ubuntu / GNOME Wayland 環境で、Search Light をショートカットから起動する前に FEP/IME を US に切り替えたい。

既に自作 GNOME Shell extension `FepSwitcher` があり、DBus 経由で FEP を切り替えられる。

    org.gnome.Shell.Extensions.FepSwitcher
    /org/gnome/Shell/Extensions/FepSwitcher
    SwitchToUs()
    SwitchToJa()

当初は Search Light をそのまま使い、ラッパースクリプトで次の順番を実現しようとした。

    1. FepSwitcher.SwitchToUs()
    2. Search Light を起動

FEP の US 切替は成功したが、Search Light の起動がうまくいかなかった。

## これまで検討した案

### 案 1: ラッパースクリプト + `org.gnome.Shell.Eval`

ラッパースクリプトから `gdbus` で FEP を US に切り替え、その後 `org.gnome.Shell.Eval` で Search Light 内部の toggle 処理を呼び出す案。

概念的には以下。

    gdbus call --session \
      --dest org.gnome.Shell.Extensions.FepSwitcher \
      --object-path /org/gnome/Shell/Extensions/FepSwitcher \
      --method org.gnome.Shell.Extensions.FepSwitcher.SwitchToUs

    gdbus call --session \
      --dest org.gnome.Shell \
      --object-path /org/gnome/Shell \
      --method org.gnome.Shell.Eval \
      "...Search Light toggle..."

結果として、FEP は US に切り替わったが Search Light は起動しなかった。

この案の問題点:

- `org.gnome.Shell.Eval` は GNOME Shell / ディストリビューション / 設定によって無効化されることがある
- Search Light の private method に依存する
- 非同期 import や GNOME Shell 内部実装に依存し、安定性が低い
- 長期運用には向かない

結論: 採用しない。

### 案 2: `FepSwitcher` extension に Search Light 起動 API を追加

`FepSwitcher` 側に `SearchLightUs()` のような DBus method を追加し、その中で以下を実行する案。

    1. SwitchToUs()
    2. Search Light の toggle を呼ぶ

この案は技術的には素直だが、既存の `FepSwitcher` のコードはなるべく修正したくない。

この案の問題点:

- FEP 切替 extension が Search Light に依存してしまう
- 責務が混ざる
- 既存の安定している FEP 切替コードに余計な変更が入る

結論: 今回は採用しない。

### 案 3: `ydotool` で Search Light のショートカットを擬似入力

ラッパースクリプトで FEP を US に切り替えたあと、`ydotool` で Search Light に割り当てた別ショートカットを擬似入力する案。

例:

    1. ユーザーが Ctrl+Super+Space を押す
    2. GNOME custom shortcut が wrapper を起動
    3. wrapper が FEP を US にする
    4. wrapper が ydotool で Ctrl+Super+F12 を送る
    5. Search Light が Ctrl+Super+F12 で起動する

この案の問題点:

- キー入力偽装であり、本質的に脆い
- Wayland 環境での挙動や権限まわりに依存する
- ショートカットの二重管理が必要
- 根本解決ではなく暫定策

結論: 暫定策としてはありだが、本命にはしない。

### 案 4: Search Light を fork して DBus API を追加

Search Light を fork し、`Toggle()` / `Show()` / `Hide()` のような DBus API を追加する案。

この案の利点:

- Search Light の既存 UI / 検索機能を使える
- 外部から安定して起動できる
- `FepSwitcher` 側を触らずに済む

この案の問題点:

- Search Light 本家との差分を持ち続ける必要がある
- GNOME Shell version 変更に Search Light 本体ごと追従する必要がある
- 今回必要な機能に対して Search Light は多機能すぎる

結論: 悪くないが、今回は過剰。

### 案 5: アプリ起動専用 launcher をフルスクラッチで作る

Search Light 相当を作るのではなく、アプリ起動だけに絞った最小 GNOME Shell extension を作る案。

今回必要なのは以下のみ。

- アプリ起動
- アプリアイコン + アプリ名の表示
- インクリメンタル検索 UI
- Enter で起動
- Esc で閉じる
- DBus から Show / Hide / Toggle できること

不要なもの:

- テーマ変更
- 設定画面
- 背景ぼかし
- Web 検索
- ファイル検索
- GNOME Search Provider 統合
- プラグイン機構
- Search Light 互換

結論: 今回の本命。実装する。

## 目的

GNOME Shell extension `nuts-launcher@local` を作成する。

この extension は、アプリ起動だけに特化した最小ランチャーである。

FEP 切替はこの extension 内では行わない。既存の `FepSwitcher` と外部 wrapper script で順番制御する。

最終的な操作フロー:

    ユーザーがショートカットを押す
      ↓
    GNOME custom shortcut が wrapper script を起動
      ↓
    wrapper script が FepSwitcher.SwitchToUs() を呼ぶ
      ↓
    wrapper script が NutsLauncher.Show() を呼ぶ
      ↓
    launcher UI が表示される
      ↓
    ユーザーがアプリ名を入力
      ↓
    インクリメンタル検索結果が表示される
      ↓
    Enter で選択中のアプリを起動

## naming

UUID は `nuts-launcher@local` とする。

表示名は `Nuts Launcher` とする。

## 実装対象

GNOME Shell extension として実装する。

想定ディレクトリ:

    ~/.local/share/gnome-shell/extensions/nuts-launcher@local/

最低限の構成:

    nuts-launcher@local/
      metadata.json
      extension.js
      stylesheet.css

必要なら後で分割するが、初期実装では `extension.js` にまとめてよい。

## 対象環境

- Ubuntu 24.04 LTS
- GNOME Shell
- Wayland
- 既存の `FepSwitcher` extension が稼働している前提

## 機能要件

### 1. DBus API

以下の DBus interface を提供する。

    org.gnome.Shell.Extensions.NutsLauncher

object path:

    /org/gnome/Shell/Extensions/NutsLauncher

methods:

    Show()
    Hide()
    Toggle()

要件:

- `Show()` でランチャー UI を表示する
- `Hide()` でランチャー UI を閉じる
- `Toggle()` で表示 / 非表示を切り替える
- disable 時に DBus export / bus name owner を必ず解放する

### 2. UI

画面中央付近にランチャーを表示する。

必須 UI:

- 検索入力欄
- 検索結果一覧
- 各検索結果にアプリアイコンとアプリ名を表示
- 選択中の行が分かる表示

見た目はハードコーディングでよい。

例:

    +----------------------------------------+
    |  Search applications...                |
    +----------------------------------------+
    |  [icon] Alacritty                      |
    |  [icon] Google Chrome                  |
    |  [icon] Files                          |
    |  [icon] Settings                       |
    +----------------------------------------+

テーマ変更や設定 UI は不要。

### 3. アプリ一覧取得

GNOME / GLib の標準 API を使ってインストール済みアプリを取得する。

想定:

    Gio.AppInfo.get_all()

表示対象:

- `should_show()` が true のものを優先
- 表示名が取れるもの
- 起動可能なもの

各アプリについて保持する情報:

- `Gio.AppInfo` object
- 表示名
- lower-case の検索用文字列
- icon
- desktop id が取れるなら検索補助に使う

### 4. インクリメンタル検索

検索入力の変更ごとに結果を更新する。

初期実装では fuzzy search ではなく、単純な case-insensitive 部分一致でよい。

検索対象:

- app display name
- app name
- desktop id, 取得できる場合

要件:

- 入力が空の場合は先頭 N 件を表示する
- 入力がある場合は部分一致するアプリのみ表示する
- 最大表示件数は 8〜10 件程度でよい
- 検索結果が 0 件なら空表示でよい

後回し:

- fuzzy scoring
- 最近使ったアプリ優先
- 使用頻度による並べ替え

### 5. キーボード操作

必須:

- `Esc`: 閉じる
- `Enter`: 選択中のアプリを起動して閉じる
- `Up`: 選択を上へ移動
- `Down`: 選択を下へ移動

できれば対応:

- `Ctrl+j`: 下へ移動
- `Ctrl+k`: 上へ移動

注意:

- 表示直後に検索入力欄へフォーカスを当てる
- 入力中に通常文字キーが検索欄へ入ること
- アプリ起動後は UI を閉じる

### 6. アプリ起動

選択中の `Gio.AppInfo` を起動する。

想定:

    appInfo.launch([], null)

起動に成功したら launcher を閉じる。

失敗時:

- GNOME Shell log に error を出す
- UI は閉じても閉じなくてもよいが、初期実装では閉じる方針でよい

### 7. 表示時の状態リセット

`Show()` するたびに以下を行う。

- 検索文字列を空にする
- 選択 index を 0 に戻す
- アプリ一覧を必要なら refresh する
- 検索欄に focus する

アプリ一覧取得は毎回でもよいが、重ければ enable 時に cache し、`Show()` 時に軽く更新する設計でもよい。

初期実装ではシンプルさ優先。

## 非機能要件

### 1. 既存 extension を修正しない

`FepSwitcher` のコードは修正しない。

Search Light のコードも修正しない。

### 2. FEP 切替を内包しない

`nuts-launcher@local` は FEP/IME 切替を担当しない。

FEP 切替は wrapper script で行う。

理由:

- 責務を分ける
- `FepSwitcher` の安定運用を壊さない
- launcher はアプリ起動専用に保つ

### 3. 設定 UI は作らない

テーマ、色、サイズ、ショートカット設定 UI は不要。

必要な値は `extension.js` または `stylesheet.css` にハードコーディングする。

### 4. 依存を増やさない

外部コマンドや Node.js には依存しない。

GNOME Shell extension 内の GJS / Gio / St / Clutter などで完結させる。

### 5. Wayland 前提

`xdotool` などの X11 前提ツールには依存しない。

## wrapper script

extension 実装後、以下のような wrapper script で使う想定。

ファイル例:

    ~/.local/bin/nuts-launcher-us

内容例:

    #!/usr/bin/env bash
    set -euo pipefail

    gdbus call --session \
      --dest org.gnome.Shell.Extensions.FepSwitcher \
      --object-path /org/gnome/Shell/Extensions/FepSwitcher \
      --method org.gnome.Shell.Extensions.FepSwitcher.SwitchToUs >/dev/null

    sleep 0.05

    gdbus call --session \
      --dest org.gnome.Shell.Extensions.NutsLauncher \
      --object-path /org/gnome/Shell/Extensions/NutsLauncher \
      --method org.gnome.Shell.Extensions.NutsLauncher.Show >/dev/null

GNOME custom shortcut にはこの wrapper script を割り当てる。

注意:

- GUI で command を指定する場合、`$HOME` が展開されない可能性があるので絶対パスを使う
- Search Light のショートカットとは別管理にする
- Search Light は最終的に無効化してよい

## 受け入れ条件

### DBus

以下が成功すること。

    gdbus call --session \
      --dest org.gnome.Shell.Extensions.NutsLauncher \
      --object-path /org/gnome/Shell/Extensions/NutsLauncher \
      --method org.gnome.Shell.Extensions.NutsLauncher.Show

実行すると launcher UI が表示される。

以下が成功すること。

    gdbus call --session \
      --dest org.gnome.Shell.Extensions.NutsLauncher \
      --object-path /org/gnome/Shell/Extensions/NutsLauncher \
      --method org.gnome.Shell.Extensions.NutsLauncher.Hide

実行すると launcher UI が閉じる。

以下が成功すること。

    gdbus call --session \
      --dest org.gnome.Shell.Extensions.NutsLauncher \
      --object-path /org/gnome/Shell/Extensions/NutsLauncher \
      --method org.gnome.Shell.Extensions.NutsLauncher.Toggle

実行すると表示 / 非表示が切り替わる。

### UI

- 表示時に検索入力欄へ focus される
- 入力すると即時に結果が絞り込まれる
- 結果にアプリアイコンとアプリ名が表示される
- `Down` / `Up` で選択行が移動する
- `Enter` で選択中のアプリが起動する
- `Esc` で launcher が閉じる

### FEP 連携

wrapper script 経由で以下の順番が実現できること。

    1. FEP が US に切り替わる
    2. launcher が表示される
    3. 検索欄に英字入力できる

## 実装メモ

### metadata.json 例

    {
      "uuid": "nuts-launcher@local",
      "name": "Nuts Launcher",
      "description": "Minimal GNOME application launcher with DBus control",
      "shell-version": ["46"],
      "version": 1
    }

`shell-version` は実機の GNOME Shell version に合わせること。

確認コマンド:

    gnome-shell --version

### extension enable / disable

インストール後:

    gnome-extensions enable nuts-launcher@local

無効化:

    gnome-extensions disable nuts-launcher@local

ログ確認:

    journalctl --user -f /usr/bin/gnome-shell

または環境に応じて GNOME Shell のログを確認する。

## 実装上の注意

### GNOME Shell extension の API 互換

Ubuntu 24.04 LTS の GNOME Shell version に合わせること。

古い GNOME Shell extension の `imports.ui.main` 形式ではなく、GNOME 45+ 系の ESM import 形式が必要な可能性がある。

既存の `FepSwitcher` extension が動いているので、その import style を参考にする。

例:

    import Gio from 'gi://Gio';
    import St from 'gi://St';
    import Clutter from 'gi://Clutter';
    import * as Main from 'resource:///org/gnome/shell/ui/main.js';
    import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

### DBus cleanup

`disable()` で必ず以下を行う。

- UI actor を destroy する
- DBus object を unexport する
- bus name を unown する
- signal handler を disconnect する

cleanup 漏れがあると、extension の reload 時に壊れやすい。

### フォーカス

表示後に検索欄へ focus を当てる処理は重要。

実装候補:

- `global.stage.set_key_focus(entry)`
- `entry.grab_key_focus()` 相当

GNOME Shell version により使える API を確認すること。

### UI placement

最初は primary monitor の中央でよい。

細かい multi-monitor 対応は後回し。

### アイコン

`Gio.AppInfo.get_icon()` で取得した icon を `St.Icon` に渡す。

icon がない場合は fallback icon を使う。

例:

    application-x-executable

## やらないこと

この issue では以下を実装しない。

- Search Light 互換 API
- Search Light fork
- `ydotool` integration
- `org.gnome.Shell.Eval` 利用
- GNOME Search Provider integration
- Web 検索
- ファイル検索
- 設定画面
- テーマ切替
- fuzzy search
- 使用頻度学習
- 最近使ったアプリ履歴

## 作業ステップ

1. `nuts-launcher@local` の extension skeleton を作る
2. `metadata.json` を作る
3. `extension.js` で enable / disable の基本構造を作る
4. DBus `Show()` / `Hide()` / `Toggle()` を実装する
5. 空の launcher UI を表示できるようにする
6. 検索 entry に focus できるようにする
7. `Gio.AppInfo.get_all()` でアプリ一覧を取得する
8. アプリアイコン + アプリ名の行を表示する
9. 入力ごとの部分一致 filtering を実装する
10. 選択 index と Up / Down を実装する
11. Enter で起動する
12. Esc で閉じる
13. wrapper script から `FepSwitcher.SwitchToUs()` → `NutsLauncher.Show()` を確認する
14. GNOME custom shortcut に wrapper script を割り当てる
15. Search Light なしで日常利用できるか確認する

## 成功条件

最終的に、以下のユーザー体験が実現できること。

    Ctrl+Super+Space などの任意ショートカットを押す
      ↓
    FEP が US に切り替わる
      ↓
    画面中央にランチャーが開く
      ↓
    すぐ英字でアプリ名を入力できる
      ↓
    アプリアイコン + アプリ名の候補が絞り込まれる
      ↓
    Enter でアプリが起動する
      ↓
    ランチャーは閉じる

