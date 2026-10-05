import {TUNING} from '../data/tuning.js';

const KEY='inkfall.settings.v1';

export const storage={locked:false,prefix:'inkfall.'};

export const device={
    mobile:false,
    native:false,
    dpr:1,
    fullscreen:true
};

export const settings={
    quality:'high',
    reducedMotion:false,
    showFps:false,
    aimAssist:true,
    aimGuide:true,
    resumeCount:true,
    volume:0.8,
    fpsCap:60,
    fpsAuto:true,
    musicVol:0.55,
    sfxVol:0.8,
    jitter:1,
    jitterPrev:1,
    mute:{volume:false,music:false,sfx:false,jitter:false},
    stickSize:0.45,
    stickX:0.45,
    stickY:0.4,
    aimRing:0.7,
    skillSize:0.5,
    godMode:false,
    fullscreen:true,
    tutorialSeen:false,
    lang:'zh',
    langChosen:false,
    weapon:'pen',
    lastWeapon:'',
    skin:{coat:'gray',limbs:'charcoal',hat:'charcoal',gear:'graphite',face:'paper',accent:'ink'},
    training:{map:'training',foes:{doodle:3},elites:{},attack:false,refill:'fixed',ammo:true,props:true,immortal:false,weapon:'pen',random:false,randCount:5,randElite:20,bosses:{}}
};

export const TRAINING_DEFAULTS=JSON.parse(JSON.stringify(settings.training));

export const TRAINING_SPAWN=['foes','elites','bosses','random','randCount','randElite'];

export const STICK_DEFAULTS={stickSize:0.45,stickX:0.45,stickY:0.4,aimRing:0.7,skillSize:0.5};

export function detectDevice() {
    const coarse=window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
    const touch=navigator.maxTouchPoints>0;
    const ua=navigator.userAgent||'';
    device.mobile=coarse||(touch&&/Android|iPad|iPhone|Mobile|Tablet/i.test(ua));
    device.dpr=window.devicePixelRatio||1;
    device.native=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
    const el=document.documentElement;
    device.fullscreen=!device.native&&!!((document.fullscreenEnabled&&el.requestFullscreen)||(document.webkitFullscreenEnabled&&el.webkitRequestFullscreen));
    return device;
}

export function loadSettings() {
    settings.quality=device.mobile?'mid':'high';
    if (window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
        settings.reducedMotion=true;
    }
    try {
        const raw=localStorage.getItem(KEY);
        if (raw) {
            Object.assign(settings,JSON.parse(raw));
        }
        settings.training=JSON.parse(JSON.stringify(TRAINING_DEFAULTS));
        delete settings.shake;
    }
    catch (e) {
    }
    if (!device.fullscreen) {
        settings.fullscreen=false;
    }
    const q=new URLSearchParams(location.search).get('quality');
    if (q&&TUNING.quality[q]) {
        settings.quality=q;
    }
    return settings;
}

export function saveSettings() {
    if (storage.locked) {
        return;
    }
    try {
        const {training,...rest}=settings;
        localStorage.setItem(KEY,JSON.stringify(rest));
    }
    catch (e) {
    }
}

export function wipeStorage() {
    storage.locked=true;
    try {
        const keys=[];
        for (let i=0;i<localStorage.length;i++) {
            const k=localStorage.key(i);
            if (k&&k.startsWith(storage.prefix)) {
                keys.push(k);
            }
        }
        for (const k of keys) {
            localStorage.removeItem(k);
        }
    }
    catch (e) {
    }
}

export function qualityConfig() {
    return TUNING.quality[settings.quality]||TUNING.quality.mid;
}

export function pixelRatio() {
    const cap=device.mobile?TUNING.pixelRatioCap.mobile:TUNING.pixelRatioCap.desktop;
    return Math.min(device.dpr,cap,qualityConfig().pixelRatio);
}

export function boilScale() {
    const j=settings.mute&&settings.mute.jitter?0:(settings.jitter??1);
    return (settings.reducedMotion?TUNING.reducedMotion.boil:1)*j;
}

export function shakeScale() {
    return (settings.reducedMotion?TUNING.reducedMotion.shake:1);
}
