# 測試

用 Playwright 開真正的瀏覽器測遊戲，Firebase 用 `firebase-mock.js`（記憶體內的替身，從跑吧複製來，多了子集合）取代，**不會碰到真的資料庫**。

## 執行

```
npm i -D playwright && npx playwright install chromium   # 第一次
node tests/run.js
```

`run.js` 會自己開靜態伺服器，依序跑 `tests/test_*.js`，有任何一項失敗就以非 0 結束。

## 內容（`test_game.js`，40 項）

1. 公開頁主選單：「老師管理中心」按鈕有出現、連到 `https://wangchiapin.github.io/profesor/#/home`、雙行文字、位置在「開始飛」下面、只有 3 個公開主題
2. 設定：沒存過就用預設值；改簡體會寫進共用 `hanziGames.settings` 且不動語速與其他欄位；簡體＋英文、只有中文的按鈕文字
3. 練習連結 `?th=`：看不到老師按鈕、只列指定主題
4. 練習範圍連結 `?d=`：讀老師的範圍，內建＋自訂主題都出現
5. 失效連結：顯示「這個連結已失效」
6. 班級連結 `?class=`：看不到老師按鈕、沒填名字不能開始、玩完成績寫進 `class_scores`、班級排行榜
7. 公開頁玩一局：結算畫面、個人最高分、分數寫進公開排行榜 `inkdragon_boards/{主題}/entries`
8. 小螢幕 360×640：按鈕放得下

測試用的輔助指令是遊戲裡的 `window.__dragon`（`setScore`、`endNow`、`state`）。
