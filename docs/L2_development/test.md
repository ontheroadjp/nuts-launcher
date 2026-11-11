# L2 Tests: Nuts Launcher

## 自動テスト

- `python3 -m unittest discover -s tests -p test_install.py`: 一時 HOME と GNOME コマンドのスタブで installer を検証する（根拠: `tests/test_install.py:1-44`）。
- `node --test tests/test_launcher.cjs`: GNOME API をスタブに置き換えた extension クラスを検証する（根拠: `tests/test_launcher.cjs:1-45`）。Node.js はテスト用であり extension のランタイムではない。

これらは実際の GNOME Shell や Wayland の統合動作を保証しない。実機確認は `docs/L2_development/consistency_checks.md` を参照する。カバレッジ目標はリポジトリ内で未確認。
