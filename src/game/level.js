import {LAYOUTS,NORMAL_LAYOUTS,ACTS,ENEMY_COST,ENEMY_ORDER,STORY_INTRO,ENDLESS} from '../data/levels.js';

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

function limitPool(pool,count) {
    const out={};
    for (let i=0;i<count;i++) {
        const k=ENEMY_ORDER[i];
        out[k]=pool[k]||1;
    }
    return out;
}

function buildWaves(pool,budget,nw,rng,fresh) {
    const waves=[];
    let left=budget;
    for (let w=0;w<nw;w++) {
        let b=w===nw-1?left:Math.max(1,Math.round(budget/nw));
        left-=b;
        const wave=[];
        if (w===0&&fresh) {
            wave.push({type:fresh});
            b-=ENEMY_COST[fresh];
        }
        while (b>0) {
            const t=weightedPick(pool,rng,b);
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
    return waves;
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
    const count=storyTypes(act,index);
    const fresh=count>1&&(index>0||act>0)&&count>storyTypes(act,index-1)?ENEMY_ORDER[count-1]:null;
    const waves=buildWaves(limitPool(A.pool,count),A.budget[index],A.waves[index],rng,fresh);
    let mod=null;
    const chance=act===0?(index<2?0:0.4):0.6;
    if (rng.next()<chance) {
        mod=MODS[Math.floor(rng.next()*MODS.length)];
    }
    return {act,index,boss:false,layoutKey:key,layout:LAYOUTS[key],hpMult:A.hpMult,waves,mod,fresh,barrels:1+Math.floor(rng.next()*2),crates:1+Math.floor(rng.next()*2)};
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
    const count=endlessTypes(page);
    let q=page-1;
    while (q>=0&&q%E.bossEvery===E.bossEvery-1) {
        q--;
    }
    const fresh=q>=0&&count>endlessTypes(q)?ENEMY_ORDER[count-1]:null;
    const waves=buildWaves(limitPool(A.pool,count),budget,nw,rng,fresh);
    let mod=null;
    if (page>=2&&rng.next()<0.5) {
        mod=MODS[Math.floor(rng.next()*MODS.length)];
    }
    return {act,index:page,endless:true,boss:false,layoutKey:key,layout:LAYOUTS[key],hpMult,waves,mod,fresh,barrels:1+Math.floor(rng.next()*2),crates:1+Math.floor(rng.next()*2)};
}
