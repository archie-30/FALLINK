import {ACTS,ENDLESS,TRAINING,LAYOUTS} from '../data/levels.js';
import {settings} from '../core/settings.js';
import {STARTING_DECK,CARDS,unlockedCards,UNLOCKS} from '../data/cards.js';
import {TUNING} from '../data/tuning.js';
import {progress,effectiveLevel,trainable} from '../core/progress.js';
import {RNG} from '../core/rng.js';
import {planRoom,planEndless} from './level.js';
import {RoomDirector,TrainingDirector} from './room.js';
import {createCard} from './card.js';
import {NOTEBOOK} from '../data/notebook.js';

export class Run {
    constructor(hooks,seed) {
        this.hooks=hooks;
        this.seed=seed;
        this.state='idle';
        this.stats=null;
    }

    start(startDeck,mode='story') {
        this.mode=mode;
        this.rng=new RNG(this.seed++);
        this.act=0;
        this.index=0;
        this.lastLayout=null;
        this.overtime=false;
        this.otPage=0;
        this.node='battle';
        const ids=mode==='training'?unlockedCards(effectiveLevel()):(startDeck||STARTING_DECK);
        this.deckList=ids.map(id=>({id,upgraded:false}));
        this.stats={kills:0,cards:0,damage:0,rooms:0,time:0,bosses:0,act:0,xp:0,score:0};
        this.enter();
    }

    scoreMult() {
        return 1+(this.mode==='endless'?this.index*ENDLESS.scorePerPage:this.act*ENDLESS.scorePerAct);
    }

    addScore(n) {
        this.stats.score+=Math.round(n*this.scoreMult());
    }

    totalRooms() {
        return ACTS[this.act].rooms+1;
    }

    training() {
        return this.mode==='training';
    }

    notebook() {
        return this.mode==='story';
    }

    otIndex() {
        return NOTEBOOK.overtimeStart+this.otPage;
    }

    enter() {
        if (this.training()) {
            const T=TRAINING;
            const c=settings.training;
            const base=c.map==='training'?T.layout:(LAYOUTS[c.map]||T.layout);
            const layout=c.props?base:{...base,props:base.props.filter(q=>!T.solid.includes(q.type))};
            this.plan={act:0,index:0,training:true,boss:false,layoutKey:'training',layout,hpMult:1,waves:[],barrels:c.props?T.barrels:0,crates:c.props?T.crates:0};
            const room=this.hooks.enterRoom(this.plan,this.deckList);
            this.director=new TrainingDirector(c,this.hooks.enemies,room,trainable);
            this.state='combat';
            this.timer=0;
            this.hooks.banner('training',this);
            return room;
        }
        if (this.overtime) {
            this.plan=planEndless(this.otIndex(),this.rng,this.lastLayout);
            this.plan.overtime=true;
            this.plan.fresh=null;
            this.plan.otPage=this.otPage;
        }
        else {
            this.plan=this.mode==='endless'?planEndless(this.index,this.rng,this.lastLayout):planRoom(this.act,this.index,this.rng,this.lastLayout);
        }
        if (this.node==='elite'&&!this.plan.boss) {
            this.plan.mod='elite';
            this.plan.elite=true;
        }
        const forced=new URLSearchParams(location.search).get('mod');
        if (forced&&!this.plan.boss) {
            this.plan.mod=forced;
        }
        this.lastLayout=this.plan.layoutKey;
        const room=this.hooks.enterRoom(this.plan,this.deckList);
        this.director=new RoomDirector(this.plan,this.hooks.enemies,room,this.rng);
        this.state='combat';
        this.timer=0;
        this.hooks.banner(this.plan.boss?'boss':'room',this);
    }

    playerDown() {
        if (this.state==='dead'||this.state==='summary') {
            return;
        }
        this.state='dead';
        this.timer=1.6;
        this.hooks.onDeath();
    }

    quit() {
        if (this.training()) {
            this.state='idle';
            return false;
        }
        if (!this.stats||this.state==='summary'||this.state==='idle') {
            return false;
        }
        this.state='summary';
        this.hooks.showSummary(false,this.stats,true);
        return true;
    }

    rewardChoices(kind='mixed',up=null) {
        const R=TUNING.reward;
        const boss=this.plan.boss;
        const rareChance=kind==='rare'?1:(kind==='normal'?0:R.rareChance);
        const upChance=up??Math.min(0.6,this.act*0.2+(boss?0.3:0));
        const lv=effectiveLevel();
        const pool=unlockedCards(lv);
        const fresh=(UNLOCKS[lv]||[]).concat(UNLOCKS[lv-1]||[]).filter(id=>pool.includes(id));
        const owned=new Set(this.deckList.map(c=>c.id));
        const out=[];
        let guard=0;
        while (out.length<R.choices&&guard<200) {
            guard++;
            const rare=this.rng.next()<rareChance;
            let list=pool.filter(id=>(CARDS[id].rarity==='rare')===rare&&!out.some(c=>c.id===id));
            const newer=list.filter(id=>fresh.includes(id)||!owned.has(id));
            if (newer.length>0&&this.rng.next()<R.newChance) {
                list=newer;
            }
            if (list.length===0) {
                continue;
            }
            const id=list[Math.floor(this.rng.next()*list.length)];
            out.push(createCard(id,this.rng.next()<upChance));
        }
        return out;
    }

    rewardPage() {
        const R=TUNING.reward;
        return this.notebook()||this.plan.boss||this.plan.index%R.every===0;
    }

    deckCounts() {
        const out={};
        for (const c of this.deckList) {
            const k=c.id;
            out[k]=out[k]||{all:0,base:0};
            out[k].all++;
            if (!c.upgraded) {
                out[k].base++;
            }
        }
        return out;
    }

    takeCards(cards,then=()=>this.next()) {
        const merged=[];
        for (const c of cards) {
            const m=this.addCard(c);
            if (m) {
                merged.push(m);
            }
        }
        const step=()=>{
            if (merged.length===0||!this.hooks.onMerge) {
                then();
                return;
            }
            this.state='upgrade';
            this.hooks.onMerge(merged.shift(),step);
        };
        step();
    }

    addCard(card) {
        this.deckList.push({id:card.id,upgraded:card.upgraded});
        if (card.upgraded) {
            return null;
        }
        const n=TUNING.cards.mergeCount;
        const same=this.deckList.filter(c=>c.id===card.id&&!c.upgraded);
        if (same.length<n) {
            return null;
        }
        for (const c of same.slice(0,n)) {
            this.deckList.splice(this.deckList.indexOf(c),1);
        }
        this.deckList.push({id:card.id,upgraded:true});
        this.stats.merges=(this.stats.merges||0)+1;
        return card.id;
    }

    go() {
        this.state='transition';
        this.hooks.transition(()=>this.enter());
    }

    next() {
        if (this.overtime) {
            this.otPage++;
            this.route(this.otIndex()%ENDLESS.bossEvery===ENDLESS.bossEvery-1);
            return;
        }
        this.index++;
        if (this.mode==='endless') {
            this.act=this.plan.act;
            this.stats.act=this.act;
            this.state='transition';
            this.hooks.transition(()=>this.enter());
            return;
        }
        if (this.index>ACTS[this.act].rooms) {
            this.act++;
            this.index=0;
            this.stats.act=this.act;
            this.stats.xp+=TUNING.levels.xpAct;
            if (this.act>=ACTS.length) {
                this.act=ACTS.length-1;
                this.stats.xp+=TUNING.levels.xpVictory;
                this.stats.score+=ENDLESS.scoreVictory;
                this.stats.cleared=true;
                this.finale();
                return;
            }
        }
        this.route(this.index===ACTS[this.act].rooms||this.index===0);
    }

    route(forced) {
        if (forced) {
            this.node='battle';
            this.go();
            return;
        }
        this.state='route';
        this.hooks.openRoute(this.routeOptions(),this.routeHeader(),type=>this.pickNode(type));
    }

    routeHeader() {
        if (this.overtime) {
            return {kind:'overtime',page:this.otPage+1,every:ENDLESS.bossEvery};
        }
        return {kind:'act',act:this.act+1,page:this.index+1,pages:this.totalRooms()};
    }

    routeOptions() {
        const N=NOTEBOOK.nodes;
        const act=this.overtime?ACTS.length-1:this.act;
        const pool=Object.keys(N).filter(k=>N[k].minAct<=act);
        const out=['battle'];
        let guard=0;
        while (out.length<NOTEBOOK.routeChoices&&guard<50) {
            guard++;
            const left=pool.filter(k=>!out.includes(k));
            let total=0;
            for (const k of left) {
                total+=N[k].weight;
            }
            let r=this.rng.next()*total;
            for (const k of left) {
                r-=N[k].weight;
                if (r<=0) {
                    out.push(k);
                    break;
                }
            }
        }
        return out.sort((a,b)=>Object.keys(N).indexOf(a)-Object.keys(N).indexOf(b));
    }

    pickNode(type) {
        this.node=type;
        if (type==='battle'||type==='elite') {
            this.go();
            return;
        }
        this.state='node';
        this.stats.nodes=(this.stats.nodes||0)+1;
        if (type==='rest') {
            const opts=[{id:'heal',n:NOTEBOOK.restHeal},{id:'upgrade',disabled:this.upgradable().length===0}];
            this.hooks.openChoice({kind:'rest',options:opts},i=>{
                if (i===0) {
                    this.hooks.heal(NOTEBOOK.restHeal);
                    this.next();
                    return;
                }
                this.pickUpgrade(()=>this.next());
            });
            return;
        }
        if (type==='shop') {
            const opts=[{id:'buy'},{id:'remove',disabled:this.deckList.length<=NOTEBOOK.minDeck},{id:'leave'}];
            this.hooks.openChoice({kind:'shop',options:opts},i=>{
                if (i===0) {
                    this.state='reward';
                    this.hooks.openReward([{kind:'mixed',cards:this.rewardChoices('mixed')}],this.deckCounts(),cards=>this.takeCards(cards));
                    return;
                }
                if (i===1) {
                    this.pickRemove(()=>this.next());
                    return;
                }
                this.next();
            });
            return;
        }
        const ev=NOTEBOOK.events[Math.floor(this.rng.next()*NOTEBOOK.events.length)];
        const opts=ev.options.map(o=>({id:o.id,disabled:o.effects.some(e=>e[0]==='remove')&&this.deckList.length<=NOTEBOOK.minDeck}));
        this.hooks.openChoice({kind:'event',id:ev.id,options:opts},i=>this.applyEffects(ev.options[i].effects.slice(),()=>this.next()));
    }

    upgradable() {
        return this.deckList.map((c,i)=>i).filter(i=>!this.deckList[i].upgraded);
    }

    pickUpgrade(done) {
        this.hooks.openDeckPick('upgrade',this.deckList,i=>{
            this.deckList[i].upgraded=true;
            this.hooks.notify('upgraded',this.deckList[i].id);
            done();
        });
    }

    pickRemove(done) {
        this.hooks.openDeckPick('remove',this.deckList,i=>{
            const id=this.deckList[i].id;
            this.deckList.splice(i,1);
            this.hooks.notify('removed',id);
            done();
        });
    }

    applyEffects(list,done) {
        if (list.length===0) {
            done();
            return;
        }
        const [kind,arg]=list.shift();
        const cont=()=>this.applyEffects(list,done);
        if (kind==='heal') {
            this.hooks.heal(arg);
            cont();
        }
        else if (kind==='hurt') {
            this.hooks.hurt(arg);
            cont();
        }
        else if (kind==='ink') {
            this.hooks.addInk(arg);
            cont();
        }
        else if (kind==='upgradeRandom') {
            const ups=this.upgradable();
            if (ups.length>0) {
                const i=ups[Math.floor(this.rng.next()*ups.length)];
                this.deckList[i].upgraded=true;
                this.hooks.notify('upgraded',this.deckList[i].id);
            }
            cont();
        }
        else if (kind==='remove') {
            this.pickRemove(cont);
        }
        else if (kind==='card') {
            const pool=unlockedCards(effectiveLevel()).filter(id=>(CARDS[id].rarity==='rare')===(arg==='rare'));
            const id=pool[Math.floor(this.rng.next()*pool.length)];
            this.hooks.notify('gained',id);
            this.takeCards([createCard(id)],cont);
        }
        else {
            cont();
        }
    }

    finale() {
        this.state='finale';
        this.hooks.openChoice({kind:'finale',options:[{id:'finish'},{id:'continue'}]},i=>{
            if (i===0) {
                this.state='summary';
                this.hooks.showSummary(true,this.stats);
                return;
            }
            this.overtime=true;
            this.otPage=0;
            this.node='battle';
            this.go();
        });
    }

    update(dt,player) {
        if (this.state==='combat'||this.state==='cleared'||this.state==='dead') {
            this.stats.time+=dt;
        }
        if (this.state==='combat') {
            this.director.update(dt,player);
            for (const e of this.director.events) {
                this.hooks.onSpawn(e);
            }
            if (this.training()) {
                return;
            }
            if (this.director.cleared) {
                this.state='cleared';
                this.timer=1.4;
                this.stats.rooms++;
                this.stats.xp+=TUNING.levels.xpRoom;
                this.addScore(ENDLESS.scoreRoom);
                if (this.plan.elite) {
                    this.addScore(NOTEBOOK.eliteScore);
                }
                if (this.plan.boss) {
                    this.stats.bosses++;
                }
                this.hooks.onCleared(this.plan);
            }
            return;
        }
        if (this.state==='cleared') {
            this.timer-=dt;
            if (this.timer<=0) {
                if (!this.rewardPage()) {
                    this.next();
                    return;
                }
                this.state='reward';
                const groups=this.plan.boss?[{kind:'normal',cards:this.rewardChoices('normal')},{kind:'rare',cards:this.rewardChoices('rare')}]:[{kind:'mixed',cards:this.rewardChoices('mixed',this.plan.elite?NOTEBOOK.eliteUpChance:null)}];
                this.hooks.openReward(groups,this.deckCounts(),cards=>this.takeCards(cards));
            }
            return;
        }
        if (this.state==='dead') {
            this.timer-=dt;
            if (this.timer<=0) {
                this.state='summary';
                this.hooks.showSummary(!!this.stats.cleared,this.stats);
            }
        }
    }
}
