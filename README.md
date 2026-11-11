# Marketing Playbook

行銷內容的手把手手冊。依八個階段，告訴你（和 Claude）每一步要做什麼、有哪幾種做法、要注意什麼、怎麼做得更好；同時持續收錄新做法和新工具，再用實際成效修正手冊。

不綁任何產品。產品的受眾、語氣、定位和限制規則寫在各產品專案的 `.agents/product-marketing.md`（產品設定檔），這份檔案和製片手冊 [production-playbook](../production-playbook) 共用，內附的行銷技能也都讀它。

## 怎麼用這個智庫（先看這段）

接到需求時照這五步走，手冊裡收的做法、工具和配方才會真的被用上：

1. **接到需求**：`python3 pb.py plan "<需求一兩句話>"`（可加 `--type <類型>`；專案有規則檔就加 `--rules <檔案>`）。它會比對配方（`data/recipes.csv`）和所有條目、工具，列出最多 3 個方案，每個方案依階段列出代號和狀態。
2. **選方案**：把 2–3 個方案給使用者看，每個都寫適合什麼、用到哪些代號、還缺什麼、主要風險，推薦一個。選好後 `plan "<需求>" --pick <編號> --save`。
3. **逐階段做**：`card <階段> --brief` 會先列「方案項目」；回覆一律附代號。
4. **順便測**：`trials` 會在每階段排最多 3 個待試項目（實戰優先）；做到那一步就照它的測試方法測。
5. **收尾**：`done` 會列出方案裡還沒記結果的項目，用 `run-log` 記有效、無效或需調整；`review` 依結果建議升降級。

另外兩件事：

- **桌上試驗**：不需要真實作品就能判斷的待試項目（試法＝桌上），用 `bench` 一批一批拿樣本測，結果用 `run-log --bench` 記；同類工具在 `data/bench.json` 分成比較組，一次比完只留一個。
- **收錄新資料**時，每個新項目都要掛到一個配方（或寫明為什麼掛不上），並標試法（桌上或實戰）。`check` 會提醒沒被配方用到的項目，`plan --unused` 列出清單。

專案自己的規則永遠優先於手冊。

## 階段

| # | 階段 | 產出 |
|---|---|---|
| 0 | 開案 | brief：目標、指標、通路、核准人 |
| 1 | 品牌策略 | 產品設定檔：受眾、語言庫、語氣、定位、內容支柱、限制 |
| 2 | 研究與參考 | 參考拆解、證據清單 |
| 3 | 撰寫 | 初稿與備選版本 |
| 4 | 審核 | 審核紀錄、核准 |
| 5 | 發佈 | 發佈紀錄 |
| 6 | 量測 | 成效紀錄 |
| 7 | 回顧與收錄 | 實戰紀錄 |

內容類型：社群貼文、廣告、銷售頁、名單資源、郵件序列、活動、私訊、影片腳本。第 3 階段只顯示所選類型的步驟；影片腳本寫完交給製片手冊。

每一步可以列出幾種做法（內附技能、提示詞庫 `prompts/library.md`、方法包），實戰紀錄累積後由 `review` 建議預設做法。

每個階段的完整清單在 [`guide/`](guide/README.md)，由資料自動產生。

## 內附技能

71 個行銷技能，從原作者重新複製、不帶任何產品的規則（來源、commit 和授權見 [`skills/THIRD_PARTY.md`](skills/THIRD_PARTY.md)）：Corey Haines 的 52 個行銷技能、Instagram 的 13 個技能、ThinkWithBlack 的 6 個方法包、growth-funnel。

## 安裝（Claude Code 外掛）

```bash
python3 pb.py setup                                   # 記住 repo 位置，寫入一律回到這裡
claude plugin marketplace add "<這個 repo 的路徑>"
claude plugin install marketing-playbook@marketing-playbook-local
```

裝好後在任何專案都有：

- **技能 `marketing-playbook`**：說「寫貼文」「寫銷售頁」「做郵件序列」或丟來一個連結時自動載入。內附技能以 `marketing-playbook:<名稱>` 出現。
- **斜線指令**：`/mk-start`、`/mk-status`、`/mk-next`、`/mk-card`、`/mk-add`、`/mk-review`、`/mk-pause`、`/mk-done`。
- **hook**：專案裡有進行中的內容時，每則訊息附一行「目前／下一步／未過關」；沒有時完全不輸出。進度存在產品專案的 `.marketing/`，和製片手冊的 `.production/` 分開。

## 共用引擎

`pb.py` 和製片手冊是同一份程式（`playbook.json` 決定名稱、環境變數 `MARKETING_PLAYBOOK_HOME` 和進度資料夾）。改引擎時兩邊一起改，測試 `test_engine_matches_production_playbook` 會檢查兩份是否相同。

## 資料

| 檔案 | 內容 |
|---|---|
| `data/stages.json` | 階段、步驟、幾種做法、過關條件 |
| `data/entries.csv` | 做法條目 |
| `data/tools.csv` | 工具 |
| `data/sources.csv` | 來源 |
| `data/runs.csv` | 實戰紀錄 |
| `data/changelog.md` | 變更紀錄（`pb.py log` 寫入） |
| `prompts/library.md` | 54 段行銷提示詞的重點 |
