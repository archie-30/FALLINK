import {LAYOUTS,NORMAL_LAYOUTS,ACTS,ENEMY_COST,ENEMY_ORDER,STORY_INTRO,ENDLESS,ROOM_TYPES,BOSS_POOL,FINAL_BOSS,FINAL_MIN_TIER,PAIRED} from '../data/levels.js';

export const MODS=['dark','elite','hurry'];

function weightedPick(pool,rng,maxCost) {
    let total=0;
    for (const k in pool) {
        if (ENEMY_COST[k]<=maxCost) {
            total+=pool[k];
        }
    }
    if (total<=0) {
        return null;
    }
    let r=rng.next()*total;
    for (const k in pool) {
        if (ENEMY_COST[k]>maxCost) {
            continue;
        }
        r-=pool[k];
        if (r<=0) {
            return k;
        }
    }
    return null;
}

function storyTypes(act,index) {
    let g=index;
    for (let a=0;a<act;a++) {
        g+=ACTS[a].rooms;
    }
    return Math.max(1,STORY_INTRO.filter(r=>r<=g).length);
}

function endlessTypes(page) {
    return Math.min(ENEMY_ORDER.length,1+Math.floor(page/ENDLESS.pagesPerType));
}

export function bossPool(beaten=[],tier=FINAL_MIN_TIER) {
    return tier>=FINAL_MIN_TIER&&BOSS_POOL.every(b=>beaten.includes(b))?BOSS_POOL.concat([FINAL_BOSS]):BOSS_POOL.slice();
}

export function pickBoss(rng,used=[],beaten=[],tier=0) {
    const all=bossPool(beaten,tier);
    const left=all.filter(b=>!used.includes(b));
    const list=left.length>0?left:all;
    return list[Math.floor(rng.next()*list.length)];
}

function pickTypes(count,fresh,rng,last=[]) {
    const rest=ENEMY_ORDER.slice(0,count).filter(k=>k!==fresh);
    for (let i=rest.length-1;i>0;i--) {
        const j=Math.floor(rng.next()*(i+1));
        const q=rest[i];
        rest[i]=rest[j];
        rest[j]=q;
    }
    rest.sort((a,b)=>(last.includes(a)?1:0)-(last.includes(b)?1:0));
    const out=fresh?[fresh]:[];
    while (out.length<ROOM_TYPES&&rest.length>0) {
        out.push(rest.shift());
    }
    return out;
}

function limitPool(pool,types) {
    const out={};
    for (const k of types) {
        out[k]=pool[k]||1;
    }
    return out;
}

function addFoe(wave,type) {
    wave.push({type});
    if (PAIRED.includes(type)) {
        wave.push({type});
    }
}

function buildWaves(pool,budget,nw,rng,fresh) {
    const waves=[];
    let left=budget;
    for (let w=0;w<nw;w++) {
        let b=w===nw-1?left:Math.max(1,Math.round(budget/nw));
        left-=b;
        const wave=[];
        if (w===0&&fresh) {
            addFoe(wave,fresh);
            b-=ENEMY_COST[fresh];
        }
        while (b>0) {
            const t=weightedPick(pool,rng,b);
            if (!t) {
                break;
            }
            addFoe(wave,t);
            b-=ENEMY_COST[t];
        }
        if (wave.length===0) {
            wave.push({type:'doodle'});
        }
        waves.push(wave);
    }
    return waves;
}

export function planRoom(act,index,rng,lastLayout,o={}) {
    const A=ACTS[act];
    if (index>=A.rooms) {
        const type=pickBoss(rng,o.used,o.beaten,act);
        return {act,index,boss:true,bossType:type,tier:act,layoutKey:'bossArena',layout:LAYOUTS.bossArena,hpMult:A.bossMult,bossHp:A.bossHp,waves:[[{type,boss:true}]]};
    }
    let key=NORMAL_LAYOUTS[Math.floor(rng.next()*NORMAL_LAYOUTS.length)];
    if (key===lastLayout) {
        key=NORMAL_LAYOUTS[(NORMAL_LAYOUTS.indexOf(key)+1)%NORMAL_LAYOUTS.length];
    }
    const count=storyTypes(act,index);
    const fresh=count>1&&(index>0||act>0)&&count>storyTypes(act,index-1)?ENEMY_ORDER[count-1]:null;
    const types=pickTypes(count,fresh,rng,o.lastTypes);
    const waves=buildWaves(limitPool(A.pool,types),A.budget[index],A.waves[index],rng,fresh);
    let mod=null;
    if (rng.next()<A.modChance[index]) {
        const mods=A.elite?MODS:MODS.filter(m=>m!=='elite');
        mod=mods[Math.floor(rng.next()*mods.length)];
    }
    return {act,index,boss:false,layoutKey:key,layout:LAYOUTS[key],hpMult:A.hpMult,waves,mod,fresh,types,barrels:1+Math.floor(rng.next()*2),crates:1+Math.floor(rng.next()*2)};
}

export function planEndless(page,rng,lastLayout,o={}) {
    const E=ENDLESS;
    const tier=Math.floor(page/E.bossEvery);
    const act=Math.min(ACTS.length-1,tier);
    const A=ACTS[act];
    const hpMult=1+page*E.hpPerPage;
    if (page%E.bossEvery===E.bossEvery-1) {
        const type=pickBoss(rng,o.used,o.beaten,tier);
        return {act,index:page,endless:true,boss:true,bossType:type,tier,layoutKey:'bossArena',layout:LAYOUTS.bossArena,hpMult:1+page*E.bossHpPerPage,bossHp:0.75,waves:[[{type,boss:true}]]};
    }
    let key=NORMAL_LAYOUTS[Math.floor(rng.next()*NORMAL_LAYOUTS.length)];
    if (key===lastLayout) {
        key=NORMAL_LAYOUTS[(NORMAL_LAYOUTS.indexOf(key)+1)%NORMAL_LAYOUTS.length];
    }
    const budget=Math.min(E.budgetMax,Math.round(E.budgetBase+page*E.budgetPerPage));
    const nw=Math.min(4,2+Math.floor(page/4));
    const count=endlessTypes(page);
    let q=page-1;
    while (q>=0&&q%E.bossEvery===E.bossEvery-1) {
        q--;
    }
    const fresh=q>=0&&count>endlessTypes(q)?ENEMY_ORDER[count-1]:null;
    const types=pickTypes(count,fresh,rng,o.lastTypes);
    const waves=buildWaves(limitPool(A.pool,types),budget,nw,rng,fresh);
    let mod=null;
    if (page>=E.modFrom&&rng.next()<E.modChance) {
        const mods=page>=E.eliteFrom?MODS:MODS.filter(m=>m!=='elite');
        mod=mods[Math.floor(rng.next()*mods.length)];
    }
    return {act,index:page,endless:true,boss:false,layoutKey:key,layout:LAYOUTS[key],hpMult,waves,mod,fresh,types,barrels:1+Math.floor(rng.next()*2),crates:1+Math.floor(rng.next()*2)};
}
