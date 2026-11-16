# ig-comment-dm：IG 留言關鍵字 → 私訊 → 追蹤確認 → 送連結

狀態：待試（2026-11-16，程式與單元測試完成，尚未接上真實帳號）｜對應條目：行銷手冊 S3-14

用官方 Instagram API 自己做的留言換私訊，部署在 Cloudflare Workers 免費方案。不需要 ManyChat、InstantDM 這類付費服務。

## 流程

1. 有人在貼文留言，內容含關鍵字（例如「攻略」）。
2. Worker 對這則留言送一則私人回覆（Private Reply），附一個快速回覆按鈕「已追蹤，傳給我」。每則留言只能私人回覆一次，而且要在 7 天內。
3. 對方按下按鈕，等於傳了一則訊息給你；這時才查得到他有沒有追蹤（`is_user_follow_business`）。
4. 有追蹤就送連結；沒追蹤就請他追蹤後再按一次。
5. 同一個人、同一條規則只送一次連結；Meta 重送同一則通知也不會重複回覆（用 KV 記 90 天）。

## 費用（花錢前先看）

| 服務 | 免費額度 | 超過時 |
|---|---|---|
| Cloudflare Workers 免費方案 | 每天 10 萬次請求 | 回傳錯誤，不會自動轉付費 |
| Workers KV | 每天 10 萬次讀、1,000 次寫 | 同上；每位領取者約 1–2 次寫入 |
| Meta Graph API | 免費 | — |

每天超過約 500 人領取，KV 寫入額度可能不夠，再考慮改用 D1（也有免費額度）。

## 設定（依順序）

需要：Cloudflare 帳號（免費）、已連結 Facebook 粉專的 IG 專業帳號、一個 Meta App，以及有 `instagram_manage_comments`、`instagram_manage_messages`、`pages_manage_metadata` 的粉專權杖。

1. 規則：複製 `rules.example.json` 改成自己的（關鍵字、開場訊息、按鈕字樣 20 字內、連結），再壓成一行貼進 `wrangler.toml` 的 `RULES`。
2. 填 `wrangler.toml` 的 `IG_USER_ID`、`PAGE_ID`。
3. 部署（第一次會開瀏覽器登入 Cloudflare）：
   ```
   npx wrangler@4 kv namespace create SEEN      # 把印出的 id 貼進 wrangler.toml
   npx wrangler@4 secret put VERIFY_TOKEN       # 自己訂的一串字，等一下 Meta 後台要填同一串
   npx wrangler@4 secret put APP_SECRET         # Meta App → 設定 → 基本資料 → 應用程式密鑰
   npx wrangler@4 secret put PAGE_ACCESS_TOKEN  # 粉專權杖
   npm run deploy                               # 印出 https://ig-comment-dm.<你的子網域>.workers.dev
   ```
4. Meta App 後台 → Webhooks → 物件選 Instagram → Callback URL 填上一步的網址、Verify token 填同一串 → 驗證並儲存 → 訂閱 `comments`、`messages`。
5. 粉專訂閱 App（一次就好）：`POST https://graph.facebook.com/v24.0/{PAGE_ID}/subscribed_apps?subscribed_fields=messages&access_token={粉專權杖}`
6. IG App → 設定 → 訊息 → 已連結的工具 → 打開「允許存取訊息」。

## 測試

- 本機：`npm test`（9 項，假的 Graph 和 KV，不連網）。
- 開發模式：只有在 Meta App 裡有角色的帳號（管理員、開發者、測試者）的留言會觸發。用自己的另一個帳號加成測試者來試：留言 → 收到私訊 → 不追蹤先按 → 追蹤後再按 → 收到連結 → 再按一次不會重送。
- 看紀錄：`npx wrangler@4 tail`，每個動作印一行 JSON（opener、not-following、send-link、skip、error）。

## 對所有人開放之前

- 收一般網友的留言通知需要 `instagram_manage_comments` 的進階存取：要通過 App 審查與企業驗證，App 切成 Live。開發模式下只收得到有角色的人。
- 送審要準備：操作錄影（留言到收到連結的完整流程）、隱私權政策網址。
- 「要先追蹤才給資源」是否符合 Meta 的規範，送審前再查一次官方政策。

## 還沒在真實環境確認的地方

- 私人回覆能不能帶快速回覆按鈕：依文件應可以；不行的話改成請對方回覆按鈕上的字（程式已支援：直接打出按鈕字樣也算領取）。
- Facebook 登入路線的私訊端點用 `me/messages`＋粉專權杖；若改用 Instagram 登入，要改成 `{IG_USER_ID}/messages`＋IG 權杖。
