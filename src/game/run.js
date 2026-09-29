import {ACTS,ENDLESS} from '../data/levels.js';
import {STARTING_DECK,CARDS,unlockedCards,UNLOCKS} from '../data/cards.js';
import {TUNING} from '../data/tuning.js';
import {progress} from '../core/progress.js';
import {RNG} from '../core/rng.js';
import {planRoom,planEndless} from './level.js';
import {RoomDirector} from './room.js';
import {createCard} from './card.js';

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
        this.deckList=(startDeck||STARTING_DECK).map(id=>({id,upgraded:false}));
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

    enter() {
        this.plan=this.mode==='endless'?planEndless(this.index,this.rng,this.lastLayout):planRoom(this.act,this.index,this.rng,this.lastLayout);
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
        if (!this.stats||this.state==='summary'||this.state==='idle') {
            return false;
        }
        this.state='summary';
        this.hooks.showSummary(false,this.stats,true);
        return true;
    }

    rewardChoices() {
        const R=TUNING.reward;
        const boss=this.plan.boss;
        const rareChance=boss?R.bossRareChance:R.rareChance;
        const upChance=Math.min(0.6,this.act*0.2+(boss?0.3:0));
        const pool=unlockedCards(progress.level);
        const fresh=(UNLOCKS[progress.level]||[]).concat(UNLOCKS[progress.level-1]||[]).filter(id=>pool.includes(id));
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

    next() {
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
                this.state='summary';
                this.stats.xp+=TUNING.levels.xpVictory;
                this.stats.score+=ENDLESS.scoreVictory;
                this.hooks.showSummary(true,this.stats);
                return;
            }
        }
        this.state='transition';
        this.hooks.transition(()=>this.enter());
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
            if (this.director.cleared) {
                this.state='cleared';
                this.timer=1.4;
                this.stats.rooms++;
                this.stats.xp+=TUNING.levels.xpRoom;
                this.addScore(ENDLESS.scoreRoom);
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
                this.state='reward';
                this.hooks.openReward(this.rewardChoices(),card=>{
                    const merged=card?this.addCard(card):null;
                    if (merged&&this.hooks.onMerge) {
                        this.state='upgrade';
                        this.hooks.onMerge(merged,()=>this.next());
                        return;
                    }
                    this.next();
                });
            }
            return;
        }
        if (this.state==='dead') {
            this.timer-=dt;
            if (this.timer<=0) {
                this.state='summary';
                this.hooks.showSummary(false,this.stats);
            }
        }
    }
}
