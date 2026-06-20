# 幸福通勤導航

這是一個可直接用瀏覽器開啟的靜態前端 Demo，展示北科大校園與周邊 YouBike、天氣、AQI、遮蔽、曝曬與無障礙需求下的路線規劃。

## 使用方式

直接開啟 `index.html` 即可，不需要後端、資料庫、登入、API Key 或額外安裝套件。

## Demo 流程

1. 首頁選擇起點與終點，地圖上的起終點會亮起。
2. 一開始選擇的是建築中心點；實際規劃時會自動改用最合適的門口。
3. 切換最快、最舒適、少淋雨、空氣品質最佳或無障礙路線。
4. 按下「計算路線」，查看路線結果與幸福指數。
5. 在結果頁使用「上一段／下一段」查看逐段高亮路線與轉彎提醒。
6. 到「校園點位」頁點選定位點，可查看目前保留的無障礙設施資訊。

## 地圖與門口規則

- 網站使用 `地圖.png` 作為校園地圖底圖，並依 `地圖細節.jpg` 的紫色可行走區、紅色出入口、黃色過馬路點與黑色分棟界線調整路線節點。
- 地圖容器固定比例，圖片使用等比例顯示，避免因為視窗大小改變而變形。
- 紅色出入口被整理成門口節點，路線規劃會以門口作為實際定位點。
- 有兩個以上門口且有可穿越室內通道的建築，才能被路線穿越。
- 少雨遮陽模式會優先選擇室內、遮雨棚或黑框遮蔽區域。
- 無障礙模式會排除樓梯、坡度不適合或不建議輪椅通行的路段。

## 資料結構

- `Graph`：用節點與邊表示校園建築、YouBike 站與道路。
- `Hash Map`：用地點 ID 快速查詢 AQI、無障礙設施、蔭蔽與曝曬資料。
- `Dijkstra`：依照不同模式權重計算推薦路線。
- `A*`：用地圖座標估計方向，作為展示用的搜尋策略比較。

## 瀏覽器測試

本專案已補上 Playwright 瀏覽器測試腳本：

```powershell
$env:NODE_PATH='C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules\.pnpm\playwright-core@1.60.0\node_modules'
& 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' 'tmp\browser-test.mjs'
```

測試會使用本機 Chrome 開啟 `index.html`，檢查路線計算、導航下一段、路線比較、Dijkstra 資料頁、地圖圖片載入與 Console 錯誤。
