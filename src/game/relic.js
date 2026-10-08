import {TUNING} from '../data/tuning.js';

const R=TUNING.relics;

export const relic={list:[],guard:0,kills:0,pages:0,cards:0,free:0,drip:0,phoenix:false,metro:0,glow:{},hold:{},gain:0};

export function hasRelic(id) {
    return relic.list.includes(id);
}

function arm(id) {
    if (id==='whiteout') {
        relic.guard=R.whiteout.guards;
    }
    if (id==='phoenix') {
        relic.phoenix=true;
    }
}

export function startRelic(list) {
    relic.list=Array.isArray(list)?list.slice(0,R.max):[];
    relic.guard=0;
    relic.kills=0;
    relic.pages=0;
    relic.cards=0;
    relic.free=0;
    relic.drip=0;
    relic.metro=0;
    relic.phoenix=false;
    relic.glow={};
    relic.hold={};
    for (const id of relic.list) {
        arm(id);
    }
}

export function addRelic(id) {
    if (!id||hasRelic(id)) {
        return;
    }
    relic.list.push(id);
    arm(id);
    flashRelic(id,R.flash*1.5);
}

export function removeRelic(id) {
    relic.list=relic.list.filter(q=>q!==id);
    if (id==='whiteout') {
        relic.guard=0;
    }
    if (id==='phoenix') {
        relic.phoenix=false;
    }
}

export function relicState() {
    return {list:relic.list.slice(),guard:relic.guard,kills:relic.kills,pages:relic.pages,cards:relic.cards,free:relic.free,phoenix:relic.phoenix};
}

export function restoreRelic(s) {
    startRelic(s&&s.list?s.list:[]);
    if (s&&s.list) {
        relic.guard=s.guard||0;
        relic.kills=s.kills||0;
        relic.pages=s.pages||0;
        relic.cards=s.cards||0;
        relic.free=s.free||0;
        relic.phoenix=!!s.phoenix;
    }
}

export function flashRelic(id,dur=R.flash) {
    if (hasRelic(id)) {
        relic.glow[id]=Math.max(relic.glow[id]||0,dur);
    }
}

export function holdRelic(id,on) {
    relic.hold[id]=!!on&&hasRelic(id);
}

export function tickRelics(dt) {
    for (const k in relic.glow) {
        relic.glow[k]=Math.max(0,relic.glow[k]-dt);
    }
    relic.metro=Math.max(0,relic.metro-dt);
    holdRelic('metronome',relic.metro>0);
}

export function relicLit(id) {
    return relic.hold[id]?1:Math.min(1,(relic.glow[id]||0)/0.25);
}

export function magBonus(weaponId) {
    return hasRelic('refill')?(R.refill[weaponId]||0):0;
}

export function reloadMult() {
    return hasRelic('sharpener')?R.sharpener.reload:1;
}

export function takeGuard() {
    if (relic.guard<=0) {
        return false;
    }
    relic.guard--;
    flashRelic('whiteout');
    return true;
}

export function maxHpBonus() {
    return hasRelic('redPact')?R.redPact.hp:0;
}

export function inkMaxBonus() {
    return hasRelic('bigInk')?R.bigInk.ink:0;
}

export function dmgMult() {
    return hasRelic('redPact')?R.redPact.mult:1;
}

export function lowHp(hp) {
    return hasRelic('lastStand')&&hp>0&&hp<=R.lastStand.hp;
}

export function speedMult(hp) {
    return (hasRelic('feather')?R.feather.speed:1)*(lowHp(hp)?R.lastStand.speed:1);
}

export function fireMult(hp) {
    return (relic.metro>0?R.metronome.rate:1)*(lowHp(hp)?R.lastStand.rate:1);
}

export function hurtInvulnBonus() {
    return hasRelic('styptic')?R.styptic.invuln:0;
}

export function dashIframeBonus() {
    return hasRelic('sneakers')?R.sneakers.iframe:0;
}

export function teleSlow() {
    return hasRelic('glasses')?R.glasses.slow:1;
}

export function shopMult() {
    return hasRelic('coupon')?R.coupon.mult:1;
}

export function gamblerMult() {
    return hasRelic('gambler')?R.gambler.mult:1;
}

export function perfectRelic() {
    if (hasRelic('metronome')) {
        relic.metro=R.metronome.time;
    }
}

export function killRelic(small) {
    if (!hasRelic('eraserBits')||small) {
        return 0;
    }
    relic.kills++;
    if (relic.kills>=R.eraserBits.every) {
        relic.kills=0;
        flashRelic('eraserBits');
        return R.eraserBits.ink;
    }
    return 0;
}

export function pageRelic() {
    if (!hasRelic('bandage')) {
        return 0;
    }
    relic.pages++;
    if (relic.pages>=R.bandage.every) {
        relic.pages=0;
        flashRelic('bandage');
        return R.bandage.heal;
    }
    return 0;
}

export function cardRelic(rare) {
    if (!hasRelic('carbon')||rare) {
        return;
    }
    if (relic.free>0) {
        relic.free=0;
        holdRelic('carbon',false);
        return;
    }
    relic.cards++;
    if (relic.cards>=R.carbon.every) {
        relic.cards=0;
        relic.free=1;
        holdRelic('carbon',true);
        flashRelic('carbon');
    }
}

export function carbonFree() {
    return hasRelic('carbon')&&relic.free>0;
}

export function dripRelic(dt) {
    if (!hasRelic('inkDrip')) {
        return 0;
    }
    relic.drip+=dt;
    if (relic.drip>=R.inkDrip.every) {
        relic.drip=0;
        flashRelic('inkDrip');
        return R.inkDrip.ink;
    }
    return 0;
}

export function usePhoenix() {
    if (!hasRelic('phoenix')||!relic.phoenix) {
        return false;
    }
    relic.phoenix=false;
    flashRelic('phoenix',R.phoenix.invuln);
    return true;
}
