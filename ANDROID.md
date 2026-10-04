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
- 每次上傳新版，`android/app/build.gradle` 的 `versionCode` 要加 1。
- Build → Generate Signed App Bundle，產出 AAB。
- 簽署金鑰（.jks）請另外備份，不要放進 GitHub。
