import {TUNING} from '../data/tuning.js';
import {UNLOCKS} from '../data/cards.js';

const KEY='inkfall.progress.v1';

export const progress={
    xp:0,
    level:1,
    bestScore:0,
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
    const lv=Number(new URLSearchParams(location.search).get('level'));
    if (lv>0) {
        progress.level=lv;
        progress.xp=0;
    }
}

export function saveProgress() {
    try {
        localStorage.setItem(KEY,JSON.stringify(progress));
    }
    catch (e) {
    }
}

export function xpToNext(level) {
    const L=TUNING.levels;
    return L.base+L.step*(level-1);
}

export function addXp(amount) {
    const before=progress.level;
    progress.xp+=Math.round(amount);
    while (progress.xp>=xpToNext(progress.level)) {
        progress.xp-=xpToNext(progress.level);
        progress.level++;
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
