# Android 打包說明

套件名稱（appId）：`com.archie.inkrage`（上架前可改，上架後不可改。要改請同時改 `capacitor.config.json` 與 `android/app/build.gradle`）。

## 需要安裝
- Node.js 22 以上
- Android Studio（內含 JDK 與 Android SDK）

## 第一次
```
git clone https://github.com/archie-30/INKRAGE.git
cd INKRAGE
git checkout claude/google-play-feasibility-ia3rgl
npm install
npm run sync
npm run open
```
`npm run open` 會用 Android Studio 開啟 `android/`。第一次開啟會自動下載 Gradle，等它跑完。
按上方綠色三角形執行（模擬器或 USB 偵錯的實體手機）。

## 之後每次更新
```
git pull
npm run sync
```
再回 Android Studio 重新執行。

## 上架前
- 版本號會自動跟著遊戲內的版本（`src/data/version.js`）：`npm run sync` 會把 `versionName`、`versionCode` 寫進 `android/app/build.gradle`。
  例如遊戲 `v0.9.21` → `versionName "0.9.21"`、`versionCode 9210`。遊戲每升一版，`versionCode` 自然變大，Play 就接受上傳。
- 若要**重複上傳同一個遊戲版本**（例如只是重新打包），把 `package.json` 的 `androidBuild` 加 1（0～9），再執行 `npm run sync`。
- Build → Generate Signed App Bundle，產出 AAB。
- 簽署金鑰（.jks）請另外備份，不要放進 GitHub。

## 上架 / 封閉測試
完整步驟（金鑰、Release 測試、Play Console 表單、封閉測試與申請正式版）見 [`store/closed-testing-guide.md`](store/closed-testing-guide.md)。
Release 簽署設定：複製 `android/keystore.properties.example` 為 `android/keystore.properties` 並填入你的金鑰資訊（該檔案已被 git 忽略）。
