import {LAYOUTS,NORMAL_LAYOUTS,ACTS,ENEMY_COST} from '../data/levels.js';

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
        return {act,index,boss:true,layoutKey:'bossArena',layout:LAYOUTS.bossArena,hpMult:A.hpMult,bossHp:A.bossHp,waves:[[{type:'inkBottle',boss:true}]]};
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
    return {act,index,boss:false,layoutKey:key,layout:LAYOUTS[key],hpMult:A.hpMult,waves};
}
