# L3 Per-file: nuts-launcher@local/config.js

## 目的・役割

ランチャーの永続設定を読み書きし、検証済みの設定値を提供する。設定ファイルの場所は GLib のユーザー設定ディレクトリにある `nuts-launcher/config.json` で、XDG の設定に従う。根拠コード: `nuts-launcher@local/config.js:13-18`。

## 動作と設計

生成時に設定を読み込み、ファイルが存在しなければ既定値を作成する。読み込み・作成の失敗はログに記録し、既定値で動作する。不正な JSON やオブジェクト以外の値は採用しない。根拠コード: `nuts-launcher@local/config.js:20-95`。

`maxResults` は 8〜100 の整数で、既定値は 10。更新時には他の設定項目を保持して保存し、成功後にメモリ上の値を更新する。書き込み失敗は呼び出し元に伝える。根拠コード: `nuts-launcher@local/config.js:3-5`, `nuts-launcher@local/config.js:97-137`。

`general.shortcut` は GNOME アクセラレータ文字列（既定 `<Control><Shift>space`）、`general.switchInputOnLaunch` は FepSwitcher 連携の有無（既定 true）。既存設定には不足項目を追加する。根拠コード: `nuts-launcher@local/config.js:45-68`, `nuts-launcher@local/config.js:112-120`。

## 統合と制限

`extension.js` が有効化時に生成し、検索結果の上限として参照する。実行中の設定ファイル変更は自動監視しないため、反映には extension の再有効化が必要。根拠コード: `nuts-launcher@local/extension.js:90-92`, `nuts-launcher@local/extension.js:564-566`。

設定は `general.maxResults` と `customSearch` に分ける。Open URL と既存の Web・Amazon・YouTube・GitHub・Docker Hub 検索について有効化とアイコンを設定でき、検索項目には表示名、検索 URL テンプレート、キーワードを指定できる。既定の YouTube キーワードは `yt`。既存形式の設定は値を保って移行し、不足項目を補う。検索 URL の `{query}` は URL エンコードされた入力に置換される。根拠コード: `nuts-launcher@local/config.js:6-13`, `nuts-launcher@local/config.js:44-95`, `nuts-launcher@local/config.js:103-122`。

## 変更履歴（git log より自動生成）

- 08ba025 feat(#53): manage configurable shortcut in extension
- f0c6ba4 feat(#47): add persistent configuration foundation (#52)
