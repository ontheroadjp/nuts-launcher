# L3 Per-file: tests/test_launcher.cjs

## 目的・役割

GNOME Shell の依存 API をスタブ化し、extension の検索、起動、設定、ライフサイクルを Node.js のテストランナーで検証する。

## 動作と統合ポイント

実際の `extension.js` と `config.js` を読み込み、VM 内で GNOME API のスタブと組み合わせる。検索モードのテストは Amazon、YouTube、GitHub、Docker Hub の空欄時のトップページ起動、および検索語の URL エンコードを確認する。

根拠コード: `tests/test_launcher.cjs:1-54`, `tests/test_launcher.cjs:400-455`

## 注意事項

スタブを用いたテストであり、GNOME Shell 上の UI やブラウザの実際の起動は実機での確認が必要。

## 変更履歴（git log より自動生成）

- fad84ac feat(#57): add GitHub and Docker Hub search
- 8f5264b feat(#55): open search home pages from modes (#56)
- 63073b4 feat(#53): manage configurable shortcut in extension (#54)
- f0c6ba4 feat(#47): add persistent configuration foundation (#52)
- f4f87cc fix(#50): rank results and improve open URL action (#51)
- 63fedb0 feat(#41): add YouTube search (#42)
- ffbd738 feat(#39): add Amazon search (#40)
- 6d07b24 fix(#37): request browser activation for web links (#38)
- 1af9bdc feat(#35): add calculator search results (#36)
- f727afd refactor: simplify launcher actions and cleanup
