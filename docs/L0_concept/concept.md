# L0 Concept: Nuts Launcher

## プロダクトの目的

Ubuntu 24.04 LTS / GNOME Wayland 環境において、アプリ起動に特化した最小 GNOME Shell extension を提供する。

根拠: `nuts-launcher-local-issue.md:133-138`

## 解決する問題

既存の Search Light をショートカットから起動する前に FEP/IME を US に切り替えたい要件があった。ラッパースクリプト経由でも Search Light の起動がうまくいかず、複数の代替案を検討した結果、最小ランチャーをフルスクラッチで実装する方針を選択した。

根拠: `nuts-launcher-local-issue.md:3-131`

### 検討・棄却した案
| 案 | 内容 | 棄却理由 |
|----|------|---------|
| 案1 | ラッパースクリプト + `org.gnome.Shell.Eval` | `Eval` は環境依存で無効化される可能性 |
| 案2 | FepSwitcher に SearchLight 起動 API を追加 | 責務混在・既存コードの変更が必要 |
| 案3 | `ydotool` でキー入力偽装 | Wayland 環境での挙動が脆い |
| 案4 | Search Light を fork して DBus API 追加 | 本家との差分管理コスト、オーバースペック |

根拠: `nuts-launcher-local-issue.md:22-131`

## 対象ユーザー

- Ubuntu 24.04 LTS + GNOME + Wayland 環境を使うユーザー
- 既存の `FepSwitcher` extension が稼働していることが前提

根拠: `nuts-launcher-local-issue.md:185-187`

## 設計上の制約

- **責務の分離**: FEP/IME 切替は `FepSwitcher` に委ねる。このランチャーはアプリ起動のみを担う
- **既存コードを修正しない**: `FepSwitcher` も Search Light も変更しない
- **最小実装**: テーマ設定、設定 UI、Web 検索、ファイル検索、プラグイン機構は実装しない
- **外部依存なし**: 外部コマンドや Node.js に依存せず、GJS / Gio / St / Clutter で完結させる
- **Wayland 前提**: `xdotool` など X11 前提ツールは使わない

根拠: `nuts-launcher-local-issue.md:336-369`

## 最終的な操作フロー

```
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
```

根拠: `nuts-launcher-local-issue.md:141-157`
