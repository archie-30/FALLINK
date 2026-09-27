# INKFALL

3D 手繪風射擊 × 牌組構築（Three.js，無建置步驟）。

## 執行

任何靜態伺服器皆可，例如：

```
npx http-server -p 8080 -c-1
```

開啟 `http://localhost:8080/`，或直接部署至 GitHub Pages。

## 操作（Phase 1）

- 桌機：WASD 移動、滑鼠瞄準、Space 或右鍵衝刺、F2 切換畫質、F3 除錯資訊
- 平板：左半螢幕虛擬搖桿移動、右半螢幕瞄準搖桿、右下角衝刺鍵、三指觸碰切換除錯資訊
- 網址參數 `?quality=low|mid|high` 可強制畫質
