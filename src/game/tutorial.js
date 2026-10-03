import {TUNING} from '../data/tuning.js';
import {TUTORIAL_ULT} from '../data/cards.js';
import {createCard} from './card.js';

export const TUTOR_STEPS=[
    {key:'move',goal:'pad',anim:'move',ctl:'move'},
    {key:'shoot',goal:'kill',anim:'shoot',ctl:'shoot',foes:'dummy'},
    {key:'dash',goal:'dodge',anim:'dodge',ctl:'dash',foes:'sprayer'},
    {key:'cards',goal:'card',anim:'cards',ctl:'cards',foes:'dummy',hand:true},
    {key:'ult',goal:'ult',anim:'ult',ctl:'ult',foes:'dummy',hand:true,ult:true},
    {key:'rules',info:true,draw:'goal'},
    {key:'warn',info:true,anim:'warn'},
    {key:'upgrade',info:true,draw:'merge',merge:true},
    {key:'unlock',info:true,draw:'unlock'},
    {key:'end',info:true,draw:'end'}
];

export class TutorialDirector {
    constructor(hooks,room) {
        this.hooks=hooks;
        this.enemies=hooks.enemies;
        this.room=room;
        this.cleared=false;
        this.boss=null;
        this.events=[];
        this.wave=0;
        this.queue=[];
        this.index=-1;
        this.phase='wait';
        this.timer=TUNING.tutorial.startDelay;
        this.count=0;
        this.pad=null;
        this.slots=[];
    }

    totalWaves() {
        return 1;
    }

    step() {
        return TUTOR_STEPS[this.index]||null;
    }

    need() {
        const s=this.step();
        return s&&!s.info?TUNING.tutorial.need[s.key]:0;
    }

    next() {
        if (this.index>=TUTOR_STEPS.length-1) {
            return;
        }
        this.index++;
        this.count=0;
        this.phase='intro';
        this.pad=null;
        this.hooks.intro(this.step(),this.index);
    }

    begin() {
        const s=this.step();
        const T=TUNING.tutorial;
        if (!s||s.info||this.phase!=='intro') {
            return;
        }
        this.phase='task';
        this.slots=[];
        if (s.goal==='pad') {
            this.placePad();
        }
        if (s.foes==='dummy') {
            for (const p of T.dummies) {
                this.slots.push({type:'doodle',x:p[0],z:p[1],dummy:true,immortal:false,t:T.firstSpawn,e:null,uid:-1});
            }
        }
        if (s.foes==='sprayer') {
            this.slots.push({type:'sprayer',x:T.sprayer[0],z:T.sprayer[1],dummy:false,immortal:true,t:T.firstSpawn,e:null,uid:-1});
        }
        if (s.hand) {
            this.hooks.showHand(!!s.ult);
        }
        this.hooks.task(s,this.need());
    }

    placePad() {
        const T=TUNING.tutorial;
        const p=T.pads[this.count%T.pads.length];
        this.pad={x:p[0],z:p[1],r:T.padR,t:0};
    }

    notify(kind) {
        const s=this.step();
        if (this.phase!=='task'||!s||s.goal!==kind) {
            return;
        }
        this.count++;
        this.hooks.progress(this.count,this.need(),this.pad);
        if (this.count>=this.need()) {
            this.complete();
        }
        else if (kind==='pad') {
            this.placePad();
        }
    }

    complete() {
        this.phase='done';
        this.timer=TUNING.tutorial.doneTime;
        this.pad=null;
        const list=this.slots;
        this.slots=[];
        for (const sl of list) {
            if (sl.e&&sl.e.alive) {
                sl.e.immortal=false;
                this.enemies.damage(sl.e,TUNING.tutorial.clearDamage,0,0,true);
            }
        }
        this.hooks.done(this.step());
    }

    update(dt,player) {
        this.events.length=0;
        if (this.phase==='wait'||this.phase==='done') {
            this.timer-=dt;
            if (this.timer<=0) {
                this.next();
            }
            return;
        }
        if (this.phase!=='task') {
            return;
        }
        if (this.pad) {
            this.pad.t+=dt;
            if (Math.hypot(player.pos.x-this.pad.x,player.pos.z-this.pad.z)<this.pad.r) {
                this.notify('pad');
            }
        }
        for (const sl of this.slots) {
            if (sl.e&&sl.e.alive&&sl.e.uid===sl.uid) {
                continue;
            }
            sl.t-=dt;
            if (sl.t<=0) {
                sl.e=this.enemies.spawn(sl.type,sl.x,sl.z,{hpMult:1,dummy:sl.dummy,immortal:sl.immortal});
                sl.uid=sl.e.uid;
                sl.t=TUNING.tutorial.respawn;
                this.events.push(sl.e);
            }
        }
    }

    provide(deck) {
        const s=this.step();
        if (s&&s.ult&&this.phase==='task'&&!deck.ultCard()) {
            return createCard(TUTORIAL_ULT);
        }
        return null;
    }
}
