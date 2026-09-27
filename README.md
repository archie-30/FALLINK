# INKFALL

3D 手繪風射擊 × 牌組構築遊戲。整個世界像是用鋼筆和鉛筆畫在筆記本紙上，以 Three.js 製作，不需要任何建置步驟。

## 線上遊玩

https://archie-30.github.io/project-unknow-pB/

（需先在 GitHub 開啟 Pages，推送到 `main` 後會自動部署。）

## 操作方式

### 桌機

| 按鍵 | 功能 |
| --- | --- |
| W A S D／方向鍵 | 移動 |
| 滑鼠 | 瞄準 |
| 滑鼠左鍵（按住） | 射擊 |
| Space／滑鼠右鍵 | 衝刺 |
| F2 | 切換畫質（低／中／高） |
| F3 | 顯示除錯資訊（FPS、繪製呼叫、三角形數） |
| H | 隱藏／顯示左下角按鍵說明 |

### 平板（觸控）

| 操作 | 功能 |
| --- | --- |
| 左半螢幕拖曳 | 虛擬搖桿移動 |
| 右半螢幕拖曳 | 瞄準並自動射擊 |
| 右下角「衝刺」按鈕 | 衝刺 |
| 三指同時觸碰 | 顯示除錯資訊 |
| 點左下角「按鍵說明」標題 | 收合／展開按鍵說明 |

請橫向持握裝置。第一次觸碰時會嘗試進入全螢幕。

網址加上 `?quality=low`、`?quality=mid` 或 `?quality=high` 可以強制指定畫質。

## 本機執行

遊戲使用 ES modules，必須透過本機伺服器開啟，不能直接雙擊 `index.html`。

```
python -m http.server 8000
```

接著開啟 http://localhost:8000/

平板測試：電腦與平板連同一個 Wi-Fi，在平板瀏覽器開啟 `http://<電腦的區網 IP>:8000/`。

## 部署

`.github/workflows/pages.yml` 會在每次推送到 `main` 時，把整個 repository 根目錄部署到 GitHub Pages。
