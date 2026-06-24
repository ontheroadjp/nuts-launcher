# L3 Per-file: nuts-launcher@local/stylesheet.css

## 目的・役割

ランチャー UI の見た目をハードコーディングで定義する。テーマ切替・設定 UI は仕様上スコープ外のため、すべての値をここに直書きする。

## クラス一覧

| クラス | 対象要素 | 役割 |
|--------|---------|------|
| `.nuts-launcher-box` | メインコンテナ (`St.BoxLayout`) | 背景・角丸・幅・ボーダー |
| `.nuts-launcher-entry` | 検索入力欄 (`St.Entry`) | テキスト入力欄のスタイル |
| `.nuts-launcher-entry:focus` | フォーカス時の入力欄 | ボーダーを明るくしてフォーカスを視覚化 |
| `.nuts-launcher-results` | 結果コンテナ (`St.BoxLayout`) | 結果リストの外枠 |
| `.nuts-launcher-row` | 各アプリ行 (`St.BoxLayout`) | 行のパディング・角丸 |
| `.nuts-launcher-row:selected` | 選択中の行 | 背景色でハイライト。`add_style_pseudo_class('selected')` で付与される |
| `.nuts-launcher-icon` | アプリ・システムアクションアイコン (`St.Icon`) | アイコンサイズ 24px、symbolic アイコン色: white |
| `.nuts-launcher-label` | アプリ名 (`St.Label`) | テキストサイズ・色 |

## 設計ポリシー

- ダークテーマ固定（`rgba(30, 30, 30, 0.92)` ベース）
- 設定 UI なし。変更が必要な場合はこのファイルを直接編集する

根拠コード: `nuts-launcher@local/stylesheet.css`

## 変更履歴（git log より自動生成）

- f2d2058 style(#5): set icon color to white for system action visibility
- fd357fc feat(#1): implement nuts-launcher@local GNOME Shell extension
