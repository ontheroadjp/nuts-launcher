# L0 Policy: Nuts Launcher

## 技術方針

- Ubuntu 24.04 LTS / GNOME Wayland 環境に適した仕組みを選ぶ。
- GNOME Shell extension として、利用可能な標準の仕組みを優先する。
- extension 内で外部コマンドや Node.js に依存しない。
- 複数の GNOME Shell version に対応する際は、可能な限り API の有無に基づいて差異を扱う。

## 責務と安全性

- FEP/IME 切替はこの extension で行わず、`FepSwitcher` に委ねる。`FepSwitcher` のコードは変更しない。
- `org.gnome.Shell.Eval` を利用せず、任意コード実行 API を提供しない。
- extension の無効化時は、登録した DBus object、bus name、signal、UI などのリソースを解放する。
- X11 を前提とする操作ツールに依存しない。

## 変更の判断

- 機能や実装の追加は、軽量さ、応答性、シンプルさ、責務の分離を損なわないかを考慮する。
- 具体的な対応機能、操作方法、対象 version、実装詳細は、変更可能な仕様として L1〜L3 で扱う。
