import {LAYOUTS,NORMAL_LAYOUTS,ACTS,ENEMY_COST,ENDLESS} from '../data/levels.js';

export const BOSSES=['inkBottle','scissors','book'];

export const MODS=['inkRain','dark','elite','hurry'];

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

export function planRoom(act,index,rng,lastLayout) {
    const A=ACTS[act];
    if (index>=A.rooms) {
        const type=BOSSES[act%BOSSES.length];
        return {act,index,boss:true,bossType:type,layoutKey:'bossArena',layout:LAYOUTS.bossArena,hpMult:A.hpMult,bossHp:A.bossHp,waves:[[{type,boss:true}]]};
    }
    let key=NORMAL_LAYOUTS[Math.floor(rng.next()*NORMAL_LAYOUTS.length)];
    if (key===lastLayout) {
        key=NORMAL_LAYOUTS[(NORMAL_LAYOUTS.indexOf(key)+1)%NORMAL_LAYOUTS.length];
    }
    const budget=A.budget[index];
    const nw=A.waves[index];
    const waves=[];
    let left=budget;
    for (let w=0;w<nw;w++) {
        let b=w===nw-1?left:Math.max(1,Math.round(budget/nw));
        left-=b;
        const wave=[];
        while (b>0) {
            const t=weightedPick(A.pool,rng,b);
            if (!t) {
                break;
            }
            wave.push({type:t});
            b-=ENEMY_COST[t];
        }
        if (wave.length===0) {
            wave.push({type:'doodle'});
        }
        waves.push(wave);
    }
    let mod=null;
    const chance=act===0?(index===0?0:0.4):0.6;
    if (rng.next()<chance) {
        mod=MODS[Math.floor(rng.next()*MODS.length)];
    }
    return {act,index,boss:false,layoutKey:key,layout:LAYOUTS[key],hpMult:A.hpMult,waves,mod,barrels:1+Math.floor(rng.next()*2),crates:1+Math.floor(rng.next()*2)};
}

export function planEndless(page,rng,lastLayout) {
    const E=ENDLESS;
    const tier=Math.floor(page/E.bossEvery);
    const act=Math.min(ACTS.length-1,tier);
    const A=ACTS[act];
    const hpMult=1+page*E.hpPerPage;
    if (page%E.bossEvery===E.bossEvery-1) {
        const type=BOSSES[tier%BOSSES.length];
        return {act,index:page,endless:true,boss:true,bossType:type,layoutKey:'bossArena',layout:LAYOUTS.bossArena,hpMult,bossHp:0.75,waves:[[{type,boss:true}]]};
    }
    let key=NORMAL_LAYOUTS[Math.floor(rng.next()*NORMAL_LAYOUTS.length)];
    if (key===lastLayout) {
        key=NORMAL_LAYOUTS[(NORMAL_LAYOUTS.indexOf(key)+1)%NORMAL_LAYOUTS.length];
    }
    const budget=Math.round(E.budgetBase+page*E.budgetPerPage);
    const nw=Math.min(4,2+Math.floor(page/4));
    const waves=[];
    let left=budget;
    for (let w=0;w<nw;w++) {
        let b=w===nw-1?left:Math.max(1,Math.round(budget/nw));
        left-=b;
        const wave=[];
        while (b>0) {
            const t=weightedPick(A.pool,rng,b);
            if (!t) {
                break;
            }
            wave.push({type:t});
            b-=ENEMY_COST[t];
        }
        if (wave.length===0) {
            wave.push({type:'doodle'});
        }
        waves.push(wave);
    }
    let mod=null;
    if (page>=2&&rng.next()<0.5) {
        mod=MODS[Math.floor(rng.next()*MODS.length)];
    }
    return {act,index:page,endless:true,boss:false,layoutKey:key,layout:LAYOUTS[key],hpMult,waves,mod,barrels:1+Math.floor(rng.next()*2),crates:1+Math.floor(rng.next()*2)};
}
