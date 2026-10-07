import {storage} from './settings.js';

const KEY='inkfall.run.v1';

export const RUN_SAVE_VERSION=1;

export function saveRunSnap(data) {
    if (storage.locked) {
        return;
    }
    try {
        localStorage.setItem(KEY,JSON.stringify({...data,v:RUN_SAVE_VERSION}));
    }
    catch (e) {
    }
}

export function loadRunSnap() {
    try {
        const s=JSON.parse(localStorage.getItem(KEY));
        if (s&&s.v===RUN_SAVE_VERSION&&(s.mode==='story'||s.mode==='endless')&&Array.isArray(s.deck)&&s.stats&&s.plan&&s.plan.layout) {
            return s;
        }
    }
    catch (e) {
    }
    clearRunSnap();
    return null;
}

export function clearRunSnap() {
    if (storage.locked) {
        return;
    }
    try {
        localStorage.removeItem(KEY);
    }
    catch (e) {
    }
}
