# CLAUDE.md

@AGENTS.md

## Claude Code 補充規則

- 開始實作前，先說明預計修改的目錄與驗證指令。
- 測試失敗時，先判斷問題來自程式、測試或環境，不要立即修改測試。
- 需要修改斷言或 Snapshot 時，先說明需求依據與影響。
- 測試輸出過長時，只整理關鍵錯誤，不要將完整 Log 放入 Context。
- 綠界金流相關問題先查 `.claude/skills/ecpay/`（staging 測試帳號與 QueryTradeInfo 皆在其中）。
