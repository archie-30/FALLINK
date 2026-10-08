import {progress,saveProgress,godMode,effectiveLevel} from './progress.js';
import {SKIN_PARTS,DEFAULT_SKIN} from '../data/skins.js';
import {ACC_SLOTS,ACC_DEFAULT,BASIC_TONES,BASIC_ACC} from '../data/cosmetics.js';
import {ACHIEVEMENTS,ACH_LEGACY,achKey,achUnits} from '../data/achievements.js';
import {TUNING} from '../data/tuning.js';
import {EARLY_WEAPONS,WEAPONS} from '../data/weapons.js';
import {RELIC_ORDER,RELIC_STARTERS} from '../data/relics.js';

const M=TUNING.meta;

let gate=()=>false;
let hold=()=>false;
let dirty=false;
let revived=0;

export const achQueue=[];

export function initMeta() {
    const P=progress;
    P.dots=Math.max(0,Math.floor(Number(P.dots)||0));
    for (const k of ['colors','accs','stats','kinds']) {
        if (!P[k]||typeof P[k]!=='object'||Array.isArray(P[k])) {
            P[k]={};
        }
    }
    for (const k of ['weapons','outfits','ach','relics']) {
        if (!Array.isArray(P[k])) {
            P[k]=[];
        }
    }
    while (P.outfits.length<M.customSlots) {
        P.outfits.push(null);
    }
    const keys=new Set();
    for (const a of ACHIEVEMENTS) {
        a.goals.forEach((g,k)=>keys.add(achKey(a,k)));
    }
    P.ach=[...new Set(P.ach.map(id=>ACH_LEGACY[id]||id))].filter(id=>keys.has(id));
    P.achChests=Math.max(0,Math.min(Math.floor(achUnits()/M.chestEvery),Math.floor(Number(P.achChests)||0)));
    if (P.relicV!==M.relicV) {
        P.relics=[];
        P.relicV=M.relicV;
    }
    P.relics=P.relics.filter(id=>RELIC_ORDER.includes(id)&&!RELIC_STARTERS.includes(id));
    delete P.relic;
    if (!P.modeSeen||typeof P.modeSeen!=='object'||Array.isArray(P.modeSeen)) {
        P.modeSeen={};
    }
    EARLY_WEAPONS.length=0;
    EARLY_WEAPONS.push(...P.weapons.filter(id=>WEAPONS[id]),...(P.keptWeapons||[]).filter(id=>WEAPONS[id]&&!P.weapons.includes(id)));
}

export function setGate(fn) {
    gate=fn;
}

export function setAchHold(fn) {
    hold=fn;
}

export function dots() {
    return progress.dots;
}

export function ownsTone(part,v) {
    return godMode()||(BASIC_TONES[part]||[]).includes(v)||(progress.colors[part]||[]).includes(v);
}

export function ownsAcc(slot,v) {
    return godMode()||(BASIC_ACC[slot]||[]).includes(v)||(progress.accs[slot]||[]).includes(v);
}

export function owns(item) {
    return item.kind==='color'?ownsTone(item.part,item.value):ownsAcc(item.part,item.value);
}

export function presetItems(pr) {
    const out=SKIN_PARTS.map(q=>({kind:'color',part:q.key,value:pr[q.key]}));
    for (const q of ACC_SLOTS) {
        if (pr[q.key]) {
            out.push({kind:'acc',part:q.key,value:pr[q.key]});
        }
    }
    return out;
}

export function presetMissing(pr) {
    return presetItems(pr).filter(q=>!owns(q));
}

export function presetOwned(pr) {
    return presetMissing(pr).length===0;
}

export function bundlePrice(items) {
    return items.reduce((a,q)=>a+price(q),0);
}

export function buyAll(items) {
    const p=bundlePrice(items);
    if (progress.dots<p||items.length===0) {
        return false;
    }
    progress.dots-=p;
    for (const q of items) {
        unlock(q);
    }
    checkAch(true);
    saveProgress();
    return true;
}

export function randomSkin(cur) {
    const pick=list=>list[Math.floor(Math.random()*list.length)];
    const out={...cur};
    for (const q of SKIN_PARTS) {
        const list=(q.tones||q.accents).filter(v=>ownsTone(q.key,v));
        out[q.key]=pick(list.length>1?list.filter(v=>v!==cur[q.key]):list);
    }
    for (const q of ACC_SLOTS) {
        const list=q.items.filter(v=>ownsAcc(q.key,v));
        const some=list.filter(v=>v!=='none');
        out[q.key]=some.length>0&&Math.random()<0.8?pick(some):pick(list);
    }
    return out;
}

function rawOwned(item) {
    const list=item.kind==='color'?(BASIC_TONES[item.part]||[]).concat(progress.colors[item.part]||[]):(BASIC_ACC[item.part]||[]).concat(progress.accs[item.part]||[]);
    return list.includes(item.value);
}

function pool(kind) {
    const out=[];
    if (kind==='color') {
        for (const q of SKIN_PARTS) {
            for (const v of q.tones||q.accents) {
                out.push({kind,part:q.key,value:v});
            }
        }
    }
    else {
        for (const q of ACC_SLOTS) {
            for (const v of q.items) {
                out.push({kind,part:q.key,value:v});
            }
        }
    }
    return out.filter(q=>!rawOwned(q));
}

export function ownedCount() {
    let n=0;
    for (const k in progress.colors) {
        n+=progress.colors[k].length;
    }
    for (const k in progress.accs) {
        n+=progress.accs[k].length;
    }
    return n;
}

export function lockedCount() {
    return pool('color').length+pool('acc').length;
}

function unlock(item) {
    const box=item.kind==='color'?progress.colors:progress.accs;
    box[item.part]=box[item.part]||[];
    if (!box[item.part].includes(item.value)) {
        box[item.part].push(item.value);
    }
}

export function gradeOf(score,mode) {
    const G=TUNING.summaryUi.grade[mode==='endless'?'endless':'story'];
    for (const [g,min] of G) {
        if (score>=min) {
            return g;
        }
    }
    return G[G.length-1][0];
}

export function grantCoins(n) {
    if (n<=0) {
        return [];
    }
    progress.dots+=n;
    saveProgress();
    return [{kind:'dots',n}];
}

export function grant(n,accFirst=0,noDots=false) {
    const out=[];
    for (let i=0;i<n;i++) {
        if (!noDots&&i>=accFirst&&Math.random()<M.dotChance) {
            const q=M.dotRange[0]+Math.floor(Math.random()*(M.dotRange[1]-M.dotRange[0]+1));
            progress.dots+=q;
            out.push({kind:'dots',n:q});
            continue;
        }
        const cols=pool('color');
        const accs=pool('acc');
        let list=i<accFirst?accs:(Math.random()<M.accChance?accs:cols);
        if (list.length===0) {
            list=list===accs?cols:accs;
        }
        if (list.length===0) {
            progress.dots+=M.dotRange[0];
            out.push({kind:'dots',n:M.dotRange[0]});
            continue;
        }
        const item=list[Math.floor(Math.random()*list.length)];
        unlock(item);
        out.push(item);
    }
    if (n>0) {
        checkAch(true);
        saveProgress();
    }
    return out;
}

export function levelChestsReady() {
    const L=TUNING.levels;
    let n=0;
    for (let lv=L.chestEvery;lv<=progress.level;lv+=L.chestEvery) {
        if (!progress.lvChests.includes(lv)) {
            n++;
        }
    }
    return n;
}

export function grantLevelChest(only) {
    const P=progress;
    const L=TUNING.levels;
    const out=[];
    for (let lv=L.chestEvery;lv<=P.level;lv+=L.chestEvery) {
        if (P.lvChests.includes(lv)||lv!==only) {
            continue;
        }
        P.lvChests.push(lv);
        P.dots+=L.chest.dots;
        out.push({kind:'dots',n:L.chest.dots});
        for (const [kind,n] of [['color',L.chest.colors],['acc',L.chest.accs]]) {
            for (let i=0;i<n;i++) {
                const list=pool(kind);
                if (list.length===0) {
                    P.dots+=M.dotRange[0];
                    out.push({kind:'dots',n:M.dotRange[0]});
                    continue;
                }
                const item=list[Math.floor(Math.random()*list.length)];
                unlock(item);
                out.push(item);
            }
        }
    }
    if (out.length>0) {
        checkAch(true);
        saveProgress();
    }
    return out;
}

export function price(item) {
    return item.kind==='color'?M.price.color:(item.kind==='acc'?M.price.acc:M.price.weapon);
}

export function buy(item) {
    const p=price(item);
    if (progress.dots<p) {
        return false;
    }
    progress.dots-=p;
    if (item.kind==='weapon') {
        if (!progress.weapons.includes(item.value)) {
            progress.weapons.push(item.value);
            EARLY_WEAPONS.push(item.value);
        }
    }
    else {
        unlock(item);
    }
    checkAch(true);
    saveProgress();
    return true;
}

export function relicPrice() {
    return TUNING.relics.price;
}

export function relicOwned(id) {
    return godMode()||RELIC_STARTERS.includes(id)||progress.relics.includes(id);
}

export function relicPool() {
    return RELIC_ORDER.filter(relicOwned);
}

export function relicLocked() {
    return RELIC_ORDER.filter(id=>!relicOwned(id));
}

export function pullRelic() {
    if (godMode()) {
        return RELIC_ORDER[Math.floor(Math.random()*RELIC_ORDER.length)];
    }
    const left=relicLocked();
    const p=relicPrice();
    if (left.length===0||progress.dots<p) {
        return '';
    }
    const id=left[Math.floor(Math.random()*left.length)];
    progress.dots-=p;
    progress.relics.push(id);
    checkAch(true);
    saveProgress();
    return id;
}

export function earnDots(n) {
    if (!gate()||n<1) {
        return 0;
    }
    progress.dots+=n;
    dirty=true;
    return n;
}

export function modeSeen(mode) {
    return !!progress.modeSeen[mode];
}

export function markModeSeen(mode) {
    if (progress.modeSeen[mode]) {
        return;
    }
    progress.modeSeen[mode]=true;
    saveProgress();
}

export function spendRevive(n) {
    if (progress.dots<n||n<1) {
        return false;
    }
    progress.dots-=n;
    revived++;
    bump('revives');
    flushMeta();
    return true;
}

export function reviveReady() {
    return progress.dots>=TUNING.meta.revive.min&&!(TUNING.meta.revive.once&&revived>0);
}

export function resetRevive() {
    revived=0;
}

export function reviveCount() {
    return revived;
}

export function setRevive(n) {
    revived=n||0;
}

export function clampSkin(skin) {
    const out={...DEFAULT_SKIN,...ACC_DEFAULT,...skin};
    for (const q of SKIN_PARTS) {
        if (!ownsTone(q.key,out[q.key])) {
            out[q.key]=DEFAULT_SKIN[q.key];
        }
    }
    for (const q of ACC_SLOTS) {
        if (!q.items.includes(out[q.key])||!ownsAcc(q.key,out[q.key])) {
            out[q.key]=ACC_DEFAULT[q.key];
        }
    }
    return out;
}

export function saveOutfit(i,skin) {
    progress.outfits[i]={...skin};
    bump('outfits',1,true);
    flushMeta();
}

export function statValue(stat) {
    const P=progress;
    if (stat==='level') {
        return P.level;
    }
    if (stat==='seen') {
        return P.seen.length;
    }
    if (stat==='owned') {
        return ownedCount();
    }
    if (stat==='bossKinds') {
        return (P.kinds.boss||[]).length;
    }
    if (stat==='weaponKinds') {
        return (P.kinds.weapon||[]).length;
    }
    return P.stats[stat]||0;
}

export function bump(stat,n=1,always=false) {
    if (!always&&!gate()) {
        return;
    }
    progress.stats[stat]=(progress.stats[stat]||0)+n;
    dirty=true;
    checkAch();
}

export function setMax(stat,v) {
    if (!gate()||v<=(progress.stats[stat]||0)) {
        return;
    }
    progress.stats[stat]=v;
    dirty=true;
    checkAch();
}

export function addKind(kind,id) {
    if (!gate()) {
        return;
    }
    const list=progress.kinds[kind]=progress.kinds[kind]||[];
    if (!list.includes(id)) {
        list.push(id);
        dirty=true;
        checkAch();
    }
}

export function checkAch(quiet=false) {
    if (godMode()||hold()) {
        return;
    }
    const P=progress;
    let got=false;
    for (const a of ACHIEVEMENTS) {
        const v=statValue(a.stat);
        for (let k=0;k<a.goals.length;k++) {
            const key=achKey(a,k);
            if (!P.ach.includes(key)&&v>=a.goals[k]) {
                P.ach.push(key);
                P.dots++;
                achQueue.push({...a,tier:k});
                got=true;
            }
        }
    }
    if (got&&!quiet) {
        saveProgress();
        dirty=false;
    }
}

export function flushMeta() {
    checkAch(true);
    saveProgress();
    dirty=false;
}

export function metaDirty() {
    return dirty;
}

export function achTier(a) {
    let k=0;
    while (k<a.goals.length&&progress.ach.includes(achKey(a,k))) {
        k++;
    }
    return k;
}

export function chestsReady() {
    return Math.max(0,Math.floor(progress.ach.length/M.chestEvery)-progress.achChests);
}

export function claimAchChest() {
    if (chestsReady()<=0) {
        return null;
    }
    progress.achChests++;
    return grant(M.chestItems);
}

export function runChestCount(stats,mode) {
    let n=0;
    if (mode==='endless') {
        for (const q of M.endless) {
            if (stats.rooms>=q) {
                n++;
            }
        }
        return n;
    }
    if (stats.rooms>=M.story.rooms) {
        n++;
    }
    if (stats.bosses>=M.story.boss) {
        n++;
    }
    if (stats.cleared) {
        n++;
    }
    return n;
}
