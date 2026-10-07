import {TUNING} from '../data/tuning.js';

export const relic={id:'',guard:0};

export function startRelic(id) {
    relic.id=id||'';
    relic.guard=relic.id==='whiteout'?TUNING.relics.whiteout.guards:0;
}

export function magBonus(weaponId) {
    return relic.id==='refill'?(TUNING.relics.refill[weaponId]||0):0;
}

export function reloadMult() {
    return relic.id==='sharpener'?TUNING.relics.sharpener.reload:1;
}

export function takeGuard() {
    if (relic.guard<=0) {
        return false;
    }
    relic.guard--;
    return true;
}
