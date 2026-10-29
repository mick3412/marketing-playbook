# Marketing Playbook

行銷內容的手把手手冊。依八個階段，告訴你（和 Claude）每一步要做什麼、有哪幾種做法、要注意什麼、怎麼做得更好；同時持續收錄新做法和新工具，再用實際成效修正手冊。

不綁任何產品。產品的受眾、語氣、定位和限制規則寫在各產品專案的 `.agents/product-marketing.md`（產品設定檔），這份檔案和製片手冊 [production-playbook](../production-playbook) 共用，內附的行銷技能也都讀它。

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
