# 封閉測試上架指南（照順序做）

> 目標：Play 帳號一通過，就能直接發封測版。標示 ✅ 的是已經準備好的，☐ 是還要你做的。

## 0. 目前已準備好的
- ✅ App 套件名稱 `com.archie.inkrage`、版本號自動跟遊戲走（見 `ANDROID.md`）
- ✅ 圖示、啟動畫面、商店 512 圖示、1024×500 主圖、5 張手機截圖（`store/`）
- ✅ 繁中／英文商店文案（`store/listing.md`）
- ✅ 隱私權政策頁（`https://archie-30.github.io/INKRAGE/privacy.html`，聯絡信箱已填）
- ✅ Release 簽署設定（讀取本機 `android/keystore.properties`）

## 1. 產生上傳金鑰（只做一次，現在就能做）
1. Android Studio → **Build → Generate Signed App Bundle / APK…** → 選 **Android App Bundle** → **Next**。
2. **Key store path** 按 **Create new…**：
   - 檔案建議放在專案的 `android/keystore/inkrage-upload.jks`（這個資料夾已被 `.gitignore` 擋掉，不會進 GitHub）。
   - 設定 keystore 密碼、key alias（建議 `inkrage-upload`）、key 密碼；有效年限填 25 年以上。
   - 憑證欄位（姓名、單位等）至少填 First and Last Name。
3. **把 `.jks` 檔和密碼備份到至少兩個地方**（雲端硬碟＋隨身碟）。遺失就無法再用這把金鑰簽署更新（雖然 Play App Signing 可以申請重設上傳金鑰，但很麻煩）。
4. 想讓之後免輸入密碼：複製 `android/keystore.properties.example` 為 `android/keystore.properties`，填入你的值。**這個檔案不會被提交。**

## 2. 先在自己手機測試 Release 版（建議）
Debug 版和正式版偶爾行為不同，上傳前自己先驗證一次：
1. **Build → Generate Signed App Bundle / APK…** → 選 **APK** → 選剛剛的金鑰 → Build Variants 選 **release** → Finish。
2. 把 `app-release.apk` 安裝到 Pixel 6（先解除安裝舊的 debug 版，因為簽署不同）。
3. 檢查：
   - 啟動直接有選單音樂、圖示與啟動畫面正確。
   - 能玩筆記本模式、無盡模式、訓練場。
   - 返回鍵：戰鬥中叫出暫停、主選單連按兩次才離開。
   - 設定 → 隱私權政策能開彈窗；「開啟完整版」會跳到瀏覽器並打開網頁。
   - 關掉再開，存檔還在。

## 3. 建立 App（帳號通過後）
Play Console → **建立應用程式**：
- 應用程式名稱：`INKRAGE`
- 預設語言：繁體中文（台灣）
- 類型：**遊戲**；免費
- 勾選政策聲明與出口法規

## 4. 填寫「應用程式內容」（Policy → App content）
| 項目 | 填法 |
| --- | --- |
| 隱私權政策 | `https://archie-30.github.io/INKRAGE/privacy.html` |
| 應用程式存取權 | 所有功能無須登入即可使用 |
| 廣告 | **不含廣告** |
| 內容分級 | 填問卷（暴力：卡通風格幻想暴力、無血腥；其他全部「否」），詳見 `listing.md` |
| 目標對象 | 建議選 13 歲以上，**不要選「兒童」**（會觸發 Families 政策） |
| 資料安全 | 不蒐集也不分享任何資料 |
| 新聞應用程式、政府、金融、健康 | 全部「否」 |

## 5. 商店資訊（Grow → Store presence → Main store listing）
- 文案：從 `store/listing.md` 複製（簡短說明、完整說明，中英兩版）。
- 圖片：App 圖示 `store/icon-512.png`、主圖 `store/feature-graphic-1024x500.png`、手機截圖 `store/screenshots/*.png`。
- **開發者聯絡資訊**（帳號設定）：`passer0012@gmail.com`，和隱私權政策一致。

## 6. 先走「內部測試」確認安裝流程（建議）
內部測試**不用審核、不用 14 天**，幾分鐘內就能裝，用來確認 AAB 沒問題：
1. **Test and release → Testing → Internal testing → Create new release**。
2. 上傳簽署好的 `.aab`（Build → Generate Signed App Bundle，選 release）。
3. 加入你自己的 Gmail 當測試者，用 Play 商店的測試連結安裝。

## 7. 發封閉測試
1. **Testing → Closed testing → Create track**（名稱隨意，例如 `Alpha`）。
2. **Create new release** → 上傳 `.aab`（可直接沿用內部測試的版本，或重新打包）。
3. 版本資訊（Release notes）範例：
   - 繁中：`首次封閉測試版本。歡迎回報操作手感、效能與任何問題。`
   - English: `First closed-testing build. Please report controls, performance and any issues.`
4. **Testers** 分頁：建立電子郵件清單，**至少 12 位**測試者的 Gmail（越多越保險，建議 15～20 位，避免有人中途退出就不足 12 人）。
5. 選擇可用國家／地區。
6. 儲存 → **Send for review**（封閉測試也要審核，通常幾小時到幾天）。
7. 通過後，把 **opt-in 連結** 傳給測試者：他們必須點連結、按「成為測試人員」、再從 Play 商店安裝。
8. **從第一位到第十二位測試者都加入並維持測試的那一天起，連續 14 天**。期間不能讓人數掉到 12 人以下。

### 找測試者的小提醒
- 親友、同學、同事，請他們用 Gmail 帳號加入，並確認真的有安裝。
- 14 天內請他們每隔幾天開一次遊戲。
- 可以在期間更新遊戲：版本號會自動往上加，重新上傳到同一個封閉測試即可。

## 8. 14 天後申請正式版
Play Console 會出現 **Apply for production**，並詢問幾個問題。參考回答：
- **測試者如何招募？** 邀請親友與玩家社群中的朋友，共 N 位，透過 Gmail 加入封閉測試。
- **收到什麼回饋？** 操作手感（搖桿大小位置）、音量與爆音、手機效能卡頓、返回鍵行為。
- **根據回饋做了哪些改進？** 調整觸控預設、降低手機解析度並改預設畫質、修正音量與爆音、加入返回鍵支援與離開確認、加入設定內的隱私權政策。（以實際為準）
- 申請後審核約 7 天內（官方時程為準）。

## 9. 常見問題
- **上傳被拒：版本碼已使用** → 把 `package.json` 的 `androidBuild` 加 1，再 `npm run sync`。
- **找不到簽署金鑰** → 重做第 1 步；同一把金鑰必須一直用，不可隨意換。
- **審核被退件，原因寫 WebView／最低功能** → 這是離線遊戲，內容全在 App 內，可在申訴時說明。
- **隱私權政策頁打不開** → 確認 `main` 已部署成功（GitHub → Actions）。
