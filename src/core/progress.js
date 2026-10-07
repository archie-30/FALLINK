import {TUNING} from '../data/tuning.js';
import {UNLOCKS} from '../data/cards.js';
import {settings,storage} from './settings.js';

const MAX_LEVEL=TUNING.levels.max;

const KEY='inkfall.progress.v1';
const BAK='inkfall.progress.bak';

export const progress={
    xp:0,
    level:1,
    bestScore:0,
    bestStory:0,
    seen:[],
    beaten:[],
    bestAct:0
};

function readSaved(key) {
    try {
        const data=JSON.parse(localStorage.getItem(key));
        return data&&typeof data==='object'&&!Array.isArray(data)?data:null;
    }
    catch (e) {
        return null;
    }
}

export function loadProgress() {
    const saved=readSaved(KEY)||readSaved(BAK);
    if (saved) {
        Object.assign(progress,saved);
    }
    if (!Array.isArray(progress.seen)) {
        progress.seen=[];
    }
    if (!Array.isArray(progress.beaten)) {
        progress.beaten=[];
    }
    const q=new URLSearchParams(location.search);
    if (q.get('seen')==='all') {
        progress.seen=['doodle','blob','sprayer','stampSoldier','inkCloud','bird','compass','eraserMonster','inkBottle','scissors','book','exam','bookFinal'];
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

export function saveProgress() {
    if (storage.locked) {
        return;
    }
    try {
        const prev=localStorage.getItem(KEY);
        const next=JSON.stringify(progress);
        if (prev&&prev!==next&&readSaved(KEY)) {
            localStorage.setItem(BAK,prev);
        }
        localStorage.setItem(KEY,next);
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

export function markBeaten(type) {
    if (godMode()||progress.beaten.includes(type)) {
        return false;
    }
    progress.beaten.push(type);
    saveProgress();
    return true;
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
