import {ACTS} from '../data/levels.js';
import {STARTING_DECK,CARDS,ALL_CARDS} from '../data/cards.js';
import {RNG} from '../core/rng.js';
import {planRoom} from './level.js';
import {RoomDirector} from './room.js';
import {createCard} from './card.js';

export class Run {
    constructor(hooks,seed) {
        this.hooks=hooks;
        this.seed=seed;
        this.state='idle';
        this.stats=null;
    }

    start(startDeck) {
        this.rng=new RNG(this.seed++);
        this.act=0;
        this.index=0;
        this.lastLayout=null;
        this.deckList=(startDeck||STARTING_DECK).map(id=>({id,upgraded:false}));
        this.stats={kills:0,cards:0,damage:0,rooms:0,time:0,bosses:0,act:0};
        this.enter();
    }

    totalRooms() {
        return ACTS[this.act].rooms+1;
    }

    enter() {
        this.plan=planRoom(this.act,this.index,this.rng,this.lastLayout);
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

    rewardChoices() {
        const boss=this.plan.boss;
        const rareChance=boss?0.4:0.12;
        const upChance=Math.min(0.6,this.act*0.2+(boss?0.3:0));
        const out=[];
        let guard=0;
        while (out.length<3&&guard<100) {
            guard++;
            const rare=this.rng.next()<rareChance;
            const pool=ALL_CARDS.filter(id=>(CARDS[id].rarity==='rare')===rare);
            const id=pool[Math.floor(this.rng.next()*pool.length)];
            if (out.some(c=>c.id===id)) {
                continue;
            }
            out.push(createCard(id,this.rng.next()<upChance));
        }
        return out;
    }

    addCard(card) {
        this.deckList.push({id:card.id,upgraded:card.upgraded});
    }

    next() {
        this.index++;
        if (this.index>ACTS[this.act].rooms) {
            this.act++;
            this.index=0;
            this.stats.act=this.act;
            if (this.act>=ACTS.length) {
                this.state='summary';
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
                    if (card) {
                        this.addCard(card);
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
