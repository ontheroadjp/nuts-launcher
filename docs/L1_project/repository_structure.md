# L1 Repository Structure: Nuts Launcher

## 構成

- `nuts-launcher@local/`: GNOME Shell が読み込む extension。`metadata.json` は UUID と対応バージョン、`extension.js` は動作、`config.js` は設定の読み書き、`stylesheet.css` は表示を定義する（根拠: `nuts-launcher@local/metadata.json:1-7`, `nuts-launcher@local/extension.js:1-26`, `nuts-launcher@local/stylesheet.css:1`）。
- `install.sh`: extension と wrapper の配置と有効化を行う（根拠: `install.sh`）。
- `scripts/trigger-nuts-launcher`: FepSwitcher と launcher を順に呼び出す（根拠: `scripts/trigger-nuts-launcher`）。
- `tests/`: installer と launcher の自動テスト（根拠: `tests/test_install.py:1-10`, `tests/test_launcher.cjs:1-8`）。
- `docs/`: 設計・開発・実装の記録。`.ai/repo.profile.json` はコマンドと主要 docs を示す。
- `README.md`: インストールと利用手順。`CLAUDE.md`: AI 作業指示。`AGENTS.md` はその symlink。

トップレベルに `apps/` や `packages/` はなく、単一 extension の構成である。
