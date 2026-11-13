# L3 Per-file: tests/test_launcher.cjs

## 目的・役割

GNOME Shell の依存 API をスタブ化し、extension の検索、起動、設定、ライフサイクルを Node.js のテストランナーで検証する。

## 動作と統合ポイント

実際の `extension.js` と `config.js` を読み込み、VM 内で GNOME API のスタブと組み合わせる。検索モードのテストは Amazon と YouTube の空欄時のトップページ起動、および検索語の URL エンコードを確認する。

根拠コード: `tests/test_launcher.cjs:1-54`, `tests/test_launcher.cjs:400-455`

## 注意事項

スタブを用いたテストであり、GNOME Shell 上の UI やブラウザの実際の起動は実機での確認が必要。
