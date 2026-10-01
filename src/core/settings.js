import {TUNING} from '../data/tuning.js';

const KEY='inkfall.settings.v1';

export const device={
    mobile:false,
    dpr:1
};

export const settings={
    quality:'high',
    reducedMotion:false,
    showFps:false,
    aimAssist:true,
    volume:0.8,
    stickSize:0.45,
    stickX:0.45,
    stickY:0.4,
    aimRing:0.7,
    skillSize:0.5,
    godMode:false,
    fullscreen:true,
    tutorialSeen:false,
    weapon:'pen',
    skin:{coat:'gray',limbs:'charcoal',hat:'charcoal',gear:'graphite',face:'paper',accent:'ink'},
    training:{map:'training',foes:{doodle:3},elites:{},attack:false,refill:'fixed',ammo:true,props:true,immortal:false,weapon:'pen',random:false,randCount:5,randElite:20,bosses:{}}
};

export const TRAINING_DEFAULTS=JSON.parse(JSON.stringify(settings.training));

export const STICK_DEFAULTS={stickSize:0.45,stickX:0.45,stickY:0.4,aimRing:0.7,skillSize:0.5};

export function detectDevice() {
    const coarse=window.matchMedia&&window.matchMedia('(pointer:coarse)').matches;
    const touch=navigator.maxTouchPoints>0;
    const ua=navigator.userAgent||'';
    device.mobile=coarse||(touch&&/Android|iPad|iPhone|Mobile|Tablet/i.test(ua));
    device.dpr=window.devicePixelRatio||1;
    return device;
}

export function loadSettings() {
    settings.quality='high';
    if (window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
        settings.reducedMotion=true;
    }
    try {
        const raw=localStorage.getItem(KEY);
        if (raw) {
            Object.assign(settings,JSON.parse(raw));
        }
        settings.training={...TRAINING_DEFAULTS,...settings.training};
        delete settings.shake;
    }
    catch (e) {
    }
    const q=new URLSearchParams(location.search).get('quality');
    if (q&&TUNING.quality[q]) {
        settings.quality=q;
    }
    return settings;
}

export function saveSettings() {
    try {
        localStorage.setItem(KEY,JSON.stringify(settings));
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
    return settings.reducedMotion?TUNING.reducedMotion.boil:1;
}

export function shakeScale() {
    return (settings.reducedMotion?TUNING.reducedMotion.shake:1);
}
