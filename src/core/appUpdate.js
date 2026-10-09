// Google Play in-app update (flexible): checks once after launch in the Android app only.
// Play shows its own prompt; the download runs in the background and installs on the next launch,
// so a run in progress is never interrupted. Does nothing on the web version.
const CHECK_DELAY=4000;
const AVAILABLE=2;
const DOWNLOADED=11;

export function checkForUpdate(notify) {
    const cap=window.Capacitor;
    if (!cap||!cap.isNativePlatform||!cap.isNativePlatform()||!cap.registerPlugin) {
        return;
    }
    setTimeout(async()=>{
        try {
            const plugin=cap.registerPlugin('AppUpdate');
            const info=await plugin.getAppUpdateInfo();
            if (info.updateAvailability!==AVAILABLE||!info.flexibleUpdateAllowed) {
                return;
            }
            await plugin.addListener('onFlexibleUpdateStateChange',state=>{
                if (state&&state.installStatus===DOWNLOADED) {
                    notify('update.ready');
                }
            });
            await plugin.startFlexibleUpdate();
        }
        catch (e) {
            // not installed from Google Play, offline, or the player declined: ignore
        }
    },CHECK_DELAY);
}
