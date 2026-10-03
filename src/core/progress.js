import {TUNING} from '../data/tuning.js';
import {UNLOCKS} from '../data/cards.js';
import {settings} from './settings.js';

const MAX_LEVEL=TUNING.levels.max;

const KEY='inkfall.progress.v1';

export const progress={
    xp:0,
    level:1,
    bestScore:0,
    bestStory:0,
    seen:[],
    bestAct:0
};

export function loadProgress() {
    try {
        const raw=localStorage.getItem(KEY);
        if (raw) {
            Object.assign(progress,JSON.parse(raw));
        }
    }
    catch (e) {
    }
    if (!Array.isArray(progress.seen)) {
        progress.seen=[];
    }
    const q=new URLSearchParams(location.search);
    if (q.get('seen')==='all') {
        progress.seen=['doodle','blob','sprayer','inkCloud','bird','compass','eraserMonster','inkBottle','scissors','book'];
    }
    const lv=Number(q.get('level'));
    if (lv>0) {
        progress.level=lv;
        progress.xp=0;
    }
    if (progress.level>=MAX_LEVEL) {
        progress.level=MAX_LEVEL;
        progress.xp=Math.min(progress.xp,xpToNext(MAX_LEVEL));
    }
}

export function resetLevel() {
    progress.level=1;
    progress.xp=0;
    saveProgress();
}

export function saveProgress() {
    try {
        localStorage.setItem(KEY,JSON.stringify(progress));
    }
    catch (e) {
    }
}

export function godMode() {
    return !!settings.godMode;
}

export function effectiveLevel() {
    return godMode()?Math.max(MAX_LEVEL,progress.level):progress.level;
}

export function hasSeen(type) {
    return godMode()||progress.seen.includes(type);
}

export function trainable(type) {
    return type==='doodle'||hasSeen(type);
}

export function markSeen(type) {
    const id=type==='blobSmall'?'blob':type;
    if (godMode()||progress.seen.includes(id)) {
        return false;
    }
    progress.seen.push(id);
    saveProgress();
    return true;
}

export function xpToNext(level) {
    const L=TUNING.levels;
    return L.base+L.step*(level-1);
}

export function addXp(amount) {
    const before=progress.level;
    progress.xp+=Math.round(amount);
    while (progress.level<MAX_LEVEL&&progress.xp>=xpToNext(progress.level)) {
        progress.xp-=xpToNext(progress.level);
        progress.level++;
    }
    if (progress.level>=MAX_LEVEL) {
        progress.xp=Math.min(progress.xp,xpToNext(MAX_LEVEL));
    }
    const unlocked=[];
    for (let lv=before+1;lv<=progress.level;lv++) {
        if (UNLOCKS[lv]) {
            unlocked.push(...UNLOCKS[lv]);
        }
    }
    saveProgress();
    return {levels:progress.level-before,unlocked};
}
