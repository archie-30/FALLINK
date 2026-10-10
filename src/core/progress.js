import {TUNING} from '../data/tuning.js';
import {UNLOCKS,LEGACY_UNLOCKS,KEPT_CARDS} from '../data/cards.js';
import {LEGACY_WEAPON_UNLOCKS} from '../data/weapons.js';
import {ENEMIES} from '../data/enemies.js';
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
    bossIntro:[],
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
    if (progress.unlockVer!==TUNING.levels.unlockVer) {
        const lv=Math.max(1,Math.floor(Number(progress.level)||1));
        const kc=[];
        const kw=[];
        if (saved) {
            for (const n in LEGACY_UNLOCKS) {
                if (Number(n)<=lv) {
                    kc.push(...LEGACY_UNLOCKS[n]);
                }
            }
            for (const id in LEGACY_WEAPON_UNLOCKS) {
                if (LEGACY_WEAPON_UNLOCKS[id]<=lv) {
                    kw.push(id);
                }
            }
        }
        progress.keptCards=kc.filter(id=>!UNLOCKS[1].includes(id));
        progress.keptWeapons=kw.filter(id=>id!=='pen');
        progress.unlockVer=TUNING.levels.unlockVer;
    }
    if (!Array.isArray(progress.keptCards)) {
        progress.keptCards=[];
    }
    if (!Array.isArray(progress.keptWeapons)) {
        progress.keptWeapons=[];
    }
    if (!Array.isArray(progress.lvChests)) {
        progress.lvChests=[];
    }
    KEPT_CARDS.length=0;
    KEPT_CARDS.push(...progress.keptCards);
    if (!Array.isArray(progress.seen)) {
        progress.seen=[];
    }
    if (!Array.isArray(progress.beaten)) {
        progress.beaten=[];
    }
    if (!Array.isArray(progress.bossIntro)) {
        progress.bossIntro=[];
    }
    for (const id of progress.seen.concat(progress.beaten)) {
        if (ENEMIES[id]&&ENEMIES[id].boss&&!progress.bossIntro.includes(id)) {
            progress.bossIntro.push(id);
        }
    }
    const q=new URLSearchParams(location.search);
    if (q.get('seen')==='all') {
        progress.seen=['doodle','blob','sprayer','stampSoldier','inkCloud','bird','compass','eraserMonster','inkBottle','scissors','book','exam','bookFinal','alarm'];
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

export function markBossIntro(id) {
    if (progress.bossIntro.includes(id)) {
        return false;
    }
    progress.bossIntro.push(id);
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
            unlocked.push(...UNLOCKS[lv].filter(id=>!KEPT_CARDS.includes(id)));
        }
    }
    saveProgress();
    return {levels:progress.level-before,unlocked};
}
