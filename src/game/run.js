import {ACTS,ENDLESS,TRAINING,LAYOUTS,PEACE_LAYOUTS,PEACE_VARY,LIBRARY} from '../data/levels.js';
import {settings} from '../core/settings.js';
import {STARTING_DECK,CARDS,unlockedCards,UNLOCKS,TUTORIAL_DECK} from '../data/cards.js';
import {TUNING} from '../data/tuning.js';
import {effectiveLevel,trainable} from '../core/progress.js';
import {RNG} from '../core/rng.js';
import {planRoom,planEndless} from './level.js';
import {RoomDirector,TrainingDirector} from './room.js';
import {TutorialDirector} from './tutorial.js';
import {createCard} from './card.js';
import {NOTEBOOK} from '../data/notebook.js';
import {MINIGAMES} from '../data/minigames.js';
import {WEAPON_ORDER} from '../data/weapons.js';
import {t} from '../data/strings.js';
import {bump,setMax,resetRevive,reviveCount,setRevive,relicPool} from '../core/meta.js';
import {COURSE_ORDER} from '../data/courses.js';
import {CourseRun} from './course.js';
import {gamblerMult,flashRelic,shopMult,hasRelic} from './relic.js';

export class Run {
    constructor(hooks,seed) {
        this.hooks=hooks;
        this.seed=seed;
        this.state='idle';
        this.stats=null;
    }

    start(startDeck,mode='story') {
        this.mode=mode;
        resetRevive();
        this.rng=new RNG(this.seed++);
        this.act=0;
        this.index=0;
        this.lastLayout=null;
        this.lastTypes=[];
        this.usedBosses=[];
        this.lastEvent=null;
        this.lastGames=[];
        this.lastPrize=null;
        this.trainGame=null;
        this.course=null;
        this.courseBag=[];
        this.courseSeen=new Set();
        this.overtime=false;
        this.otPage=0;
        this.node='battle';
        this.eliteNext=false;
        this.exitsOpen=false;
        this.ambushAfter=null;
        this.report=null;
        const ids=mode==='training'?unlockedCards(effectiveLevel()):(mode==='tutorial'?TUTORIAL_DECK:(startDeck||STARTING_DECK));
        this.deckList=ids.map(id=>({id,upgraded:false}));
        this.stats={kills:0,cards:0,damage:0,taken:0,dealt:0,rooms:0,time:0,bosses:0,act:0,xp:0,score:0,log:[]};
        this.hooks.clearRun();
        this.enter();
    }

    saveable() {
        return (this.mode==='story'||this.mode==='endless')&&!!this.stats&&!!this.plan&&this.state!=='dead'&&this.state!=='summary';
    }

    snapshot() {
        if (!this.saveable()) {
            return;
        }
        const p=this.plan;
        const plan={};
        for (const k of ['act','index','peace','node','boss','bossType','layoutKey','layout','hpMult','exits','overtime','otPage','endless']) {
            if (p[k]!==undefined) {
                plan[k]=p[k];
            }
        }
        this.hooks.saveRun({mode:this.mode,rng:this.rng.s,seed:this.seed,act:this.act,index:this.index,lastLayout:this.lastLayout,lastTypes:this.lastTypes,usedBosses:this.usedBosses,lastEvent:this.lastEvent,lastGames:this.lastGames,lastPrize:this.lastPrize,courseBag:this.courseBag,courseIdx:this.courseIdx||0,courseSeen:[...this.courseSeen],overtime:this.overtime,otPage:this.otPage,node:this.node,eliteNext:this.eliteNext,revived:reviveCount(),deck:this.deckList,stats:this.stats,plan});
    }

    restore(s) {
        this.mode=s.mode;
        setRevive(s.revived);
        this.seed=s.seed||this.seed;
        this.rng=new RNG(1);
        this.rng.s=s.rng>>>0;
        this.act=s.act;
        this.index=s.index;
        this.lastLayout=s.lastLayout||null;
        this.lastTypes=s.lastTypes||[];
        this.usedBosses=s.usedBosses||[];
        this.lastEvent=s.lastEvent||null;
        this.lastGames=s.lastGames||[];
        this.lastPrize=s.lastPrize||null;
        this.trainGame=null;
        this.course=null;
        this.courseBag=s.courseBag||[];
        this.courseIdx=s.courseIdx||0;
        this.courseSeen=new Set(s.courseSeen||[]);
        this.overtime=!!s.overtime;
        this.otPage=s.otPage||0;
        this.node=s.node||'battle';
        this.eliteNext=!!s.eliteNext;
        this.ambushAfter=null;
        this.report=null;
        this.deckList=s.deck.map(c=>({id:c.id,upgraded:!!c.upgraded})).filter(c=>CARDS[c.id]);
        this.stats=s.stats;
        this.stats.log=this.stats.log||[];
        const plan={...s.plan,npcs:[],waves:[],barrels:0,crates:0,restored:true};
        this.plan=plan;
        this.director=null;
        this.timer=0;
        this.npcUsed=[];
        this.room=this.hooks.enterRoom(plan,this.deckList);
        this.state=plan.peace?'peace':'exit';
        this.exitsOpen=true;
        this.hooks.openDoors(true);
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

    tutorial() {
        return this.mode==='tutorial';
    }

    notebook() {
        return this.mode==='story';
    }

    pickCourse(page) {
        const E=ENDLESS;
        const k=page%E.bossEvery;
        if (k===0||this.courseBag.length===0) {
            const last=this.courseBag.length>0?this.courseBag[this.courseBag.length-1]:null;
            const bag=COURSE_ORDER.slice();
            for (let i=bag.length-1;i>0;i--) {
                const j=Math.floor(this.rng.next()*(i+1));
                [bag[i],bag[j]]=[bag[j],bag[i]];
            }
            if (bag[0]===last) {
                bag.push(bag.shift());
            }
            this.courseBag=bag.slice(0,TUNING.courses.perAct);
            this.courseIdx=0;
        }
        const id=this.courseBag[Math.min(this.courseIdx,this.courseBag.length-1)];
        this.courseIdx++;
        return id;
    }

    otIndex() {
        return NOTEBOOK.overtimeStart+this.otPage;
    }

    peaceNode() {
        return this.notebook()&&!this.overtime&&!(NOTEBOOK.nodes[this.node]||{combat:true}).combat;
    }

    testGame(id) {
        this.trainGame=id;
        this.go();
    }

    enter() {
        if (this.training()&&this.trainGame) {
            const list=PEACE_LAYOUTS.event;
            const plan=this.planGame(list[Math.floor(this.rng.next()*list.length)],'test',this.trainGame);
            plan.exits=[{kind:'back'},{kind:'games'},{kind:'home'}];
            plan.trainGame=true;
            this.plan=plan;
            this.director=null;
            this.timer=0;
            this.room=this.hooks.enterRoom(plan,this.deckList);
            this.state='peace';
            this.exitsOpen=true;
            this.hooks.openDoors(true);
            this.npcUsed=plan.npcs.map(()=>false);
            this.hooks.banner('peace',this);
            return this.room;
        }
        if (this.tutorial()) {
            const T=TRAINING;
            const layout={...T.layout,props:T.layout.props.filter(q=>!T.solid.includes(q.type))};
            this.plan={act:0,index:0,training:true,tutorial:true,boss:false,layoutKey:'training',layout,hpMult:1,waves:[],exits:[{kind:'home'}],barrels:0,crates:0};
            const room=this.hooks.enterRoom(this.plan,this.deckList);
            this.director=new TutorialDirector(this.hooks.tutorial,room);
            this.state='combat';
            this.exitsOpen=false;
            this.timer=0;
            this.hooks.tutorial.enter(this.director);
            return room;
        }
        if (this.training()) {
            const T=TRAINING;
            const c=settings.training;
            const base=c.map==='training'?T.layout:(LAYOUTS[c.map]||T.layout);
            const layout=c.props?base:{...base,props:base.props.filter(q=>!T.solid.includes(q.type))};
            this.plan={act:0,index:0,training:true,boss:false,layoutKey:'training',layout,hpMult:1,waves:[],exits:[{kind:'games'}],barrels:c.props?T.barrels:0,crates:c.props?T.crates:0};
            const room=this.hooks.enterRoom(this.plan,this.deckList);
            this.director=new TrainingDirector(c,this.hooks.enemies,room,trainable);
            this.state='combat';
            this.exitsOpen=true;
            this.hooks.openDoors(true);
            this.timer=0;
            this.hooks.banner('training',this);
            return room;
        }
        let plan;
        if (this.library) {
            plan=this.planLibrary();
        }
        else if (this.overtime) {
            plan=planEndless(this.otIndex(),this.rng,this.lastLayout,this.planOpts());
            plan.overtime=true;
            plan.fresh=null;
            plan.otPage=this.otPage;
        }
        else if (this.mode==='endless') {
            const bossPage=this.index%ENDLESS.bossEvery===ENDLESS.bossEvery-1;
            plan=planEndless(this.index,this.rng,this.lastLayout,{...this.planOpts(),course:bossPage?null:this.pickCourse(this.index)});
        }
        else if (this.peaceNode()) {
            plan=this.planPeace(this.node);
        }
        else {
            plan=planRoom(this.act,this.index,this.rng,this.lastLayout,this.planOpts());
        }
        if (!plan.peace&&!plan.boss&&this.notebook()) {
            if (this.node==='elite'||(this.node==='battle'&&this.eliteNext)) {
                plan.mod='elite';
                plan.elite=true;
                if (this.node==='battle') {
                    this.eliteNext=false;
                }
            }
            if (this.node==='challenge') {
                const C=NOTEBOOK.challenges;
                plan.challenge=C[Math.floor(this.rng.next()*C.length)];
                plan.mod=null;
            }
        }
        const forced=new URLSearchParams(location.search).get('mod');
        if (forced&&!plan.boss&&!plan.peace) {
            plan.mod=forced;
        }
        plan.node=plan.node==='library'?'library':(this.notebook()&&!this.overtime?this.node:'battle');
        plan.exits=plan.boss?[{kind:'library'}]:this.makeExits();
        if (plan.node==='library'&&plan.exits.length===1) {
            plan.exits[0].label='exit.nextAct';
        }
        this.library=false;
        this.plan=plan;
        this.course=plan.course?new CourseRun(plan.course,plan,this.hooks.course):null;
        this.lastLayout=plan.layoutKey;
        if (plan.types) {
            this.lastTypes=plan.types;
        }
        if (plan.boss&&plan.bossType) {
            this.usedBosses.push(plan.bossType);
        }
        this.exitsOpen=false;
        this.ambushAfter=null;
        this.timer=0;
        this.director=null;
        this.room=this.hooks.enterRoom(plan,this.deckList);
        this.logPage(plan);
        if (this.hooks.pageStart) {
            this.hooks.pageStart(plan);
        }
        if (plan.peace) {
            this.state='peace';
            this.npcUsed=plan.npcs.map(()=>false);
            if (plan.node==='library') {
                this.lib={cards:false,ults:false,relic:plan.relics.length===0};
                this.hooks.npcSay(2,t('library.greet'));
            }
            this.stats.nodes=(this.stats.nodes||0)+1;
            this.hooks.banner('peace',this);
            return;
        }
        this.director=new RoomDirector(plan,this.hooks.enemies,this.room,this.rng);
        this.director.hold=()=>!!this.course&&this.course.holding();
        this.state='combat';
        this.chFail=false;
        this.chHp=-1;
        this.chT=0;
        this.chCards=this.stats.cards;
        this.roomTaken=this.stats.taken;
        this.hooks.banner(plan.boss?'boss':'room',this);
        if (plan.course) {
            const first=!this.courseSeen.has(plan.course);
            this.courseSeen.add(plan.course);
            this.hooks.courseIntro(plan.course,first);
        }
    }

    logPage(plan) {
        const S=this.stats;
        S.log.push({act:plan.act,index:plan.index,node:plan.boss?'boss':plan.overtime?'overtime':(this.mode==='endless'?'endless':(plan.node||'battle')),game:plan.game||plan.event||null,hp:this.hooks.hp(),s:{kills:S.kills,damage:S.damage,taken:S.taken,dealt:S.dealt,cards:S.cards,time:S.time,score:S.score}});
    }

    planPeace(node) {
        const list=PEACE_LAYOUTS[node];
        let k=Math.floor(this.rng.next()*list.length);
        if (node+k===this.lastLayout&&list.length>1) {
            k=(k+1)%list.length;
        }
        if (node==='event') {
            return this.planGame(list[k],node+k);
        }
        const pool=node==='encounter'?NOTEBOOK.events.filter(e=>e.id!==this.lastEvent):null;
        const ev=pool?pool[Math.floor(this.rng.next()*pool.length)]:null;
        const layout=this.arrangePeace(list[k],node==='treasure'?3:1);
        const plan={act:this.act,index:this.index,peace:true,node,boss:false,layoutKey:node+k,layout,hpMult:ACTS[this.act].hpMult,waves:[],barrels:0,crates:0};
        const spot=i=>({x:layout.npcs[i][0],z:layout.npcs[i][1]});
        if (ev) {
            this.lastEvent=ev.id;
            plan.event=ev.id;
            plan.block=!!ev.block;
            plan.npcs=[{model:ev.model,...spot(0)}];
        }
        else if (node==='treasure') {
            const out=NOTEBOOK.chests.slice();
            for (let i=out.length-1;i>0;i--) {
                const j=Math.floor(this.rng.next()*(i+1));
                [out[i],out[j]]=[out[j],out[i]];
            }
            plan.chests=out;
            plan.npcs=out.map((c,i)=>({model:'chest',...spot(i)}));
        }
        else {
            plan.npcs=[{model:node,...spot(0)}];
        }
        if (node==='shop') {
            plan.bought={};
            this.stockShop(plan);
        }
        return plan;
    }

    planLibrary() {
        const L=LIBRARY;
        const plan={act:this.act,index:this.index,peace:true,node:'library',boss:false,layoutKey:'library',layout:L,hpMult:ACTS[this.act].hpMult,waves:[],barrels:0,crates:0};
        const pool=relicPool().filter(id=>!hasRelic(id));
        for (let i=pool.length-1;i>0;i--) {
            const j=Math.floor(this.rng.next()*(i+1));
            [pool[i],pool[j]]=[pool[j],pool[i]];
        }
        plan.relics=pool.slice(0,TUNING.relics.offer);
        plan.npcs=[
            {model:'cardKeeper',x:L.keepers[0][0],z:L.keepers[0][1]},
            {model:'ultKeeper',x:L.keepers[1][0],z:L.keepers[1][1]},
            {model:'librarian',x:L.librarian[0],z:L.librarian[1]}
        ];
        const spots=plan.relics.length===2?[L.relics[0],L.relics[2]]:(plan.relics.length===1?[L.relics[1]]:L.relics);
        plan.relics.forEach((id,i)=>{
            plan.npcs.push({model:'relic',relic:id,label:t('relic.'+id+'.name'),x:spots[i][0],z:spots[i][1]});
        });
        return plan;
    }

    libraryUse(i) {
        const p=this.plan;
        const n=p.npcs[i];
        const L=this.lib;
        const back=()=>this.libraryBack();
        if (n.model==='cardKeeper'||n.model==='ultKeeper') {
            const rare=n.model==='ultKeeper';
            this.npcUsed[i]=true;
            this.hooks.npcUsed(i);
            this.hooks.npcSay(i,t(rare?'library.ultSay':'library.cardSay'));
            this.state='reward';
            const kind=rare?'rare':'normal';
            this.hooks.openReward([{kind,cards:this.rewardChoices(kind)}],this.deckCounts(),cards=>{
                L[rare?'ults':'cards']=true;
                this.takeCards(cards,back);
            },false,t(rare?'library.ultTitle':'library.cardTitle'));
            return true;
        }
        if (n.model==='librarian') {
            this.hooks.npcSay(i,t(L.relic?'library.thanks':(p.relics.length>0?'library.pick':'library.empty')));
            if (L.relic) {
                this.npcUsed[i]=true;
                this.hooks.npcUsed(i);
            }
            back();
            return true;
        }
        if (L.relic) {
            this.hooks.npcSay(2,t('library.onlyOne'));
            back();
            return true;
        }
        L.relic=true;
        this.npcUsed[i]=true;
        this.hooks.npcUsed(i);
        this.npcUsed[2]=true;
        this.hooks.npcUsed(2);
        this.hooks.npcSay(2,t('library.thanks'));
        this.hooks.takeRelic(n.relic,back);
        return true;
    }

    libraryBack() {
        this.state='peace';
        this.hooks.resume();
        const L=this.lib;
        if (L&&L.cards&&L.ults&&L.relic&&!this.exitsOpen) {
            this.openExits();
        }
    }

    planGame(base,key,forced=null) {
        const M=MINIGAMES;
        const pool=M.order.filter(id=>!this.lastGames.includes(id));
        const id=forced||pool[Math.floor(this.rng.next()*pool.length)];
        this.lastGames.push(id);
        while (this.lastGames.length>M.order.length-4) {
            this.lastGames.shift();
        }
        const def=M.games[id];
        const flip=this.rng.next()<0.5?-1:1;
        const host=def.host||M.host;
        const layout={...base,props:base.decor,npcs:[[host[0]*flip,host[1]]]};
        return {act:this.act,index:this.index,peace:true,node:'event',boss:false,layoutKey:key,layout,hpMult:ACTS[this.act].hpMult,waves:[],barrels:0,crates:0,game:id,gameFlip:flip,npcs:[{model:def.model,x:host[0]*flip,z:host[1]}]};
    }

    prize(ok) {
        const list=ok?MINIGAMES.rewards:MINIGAMES.penalties;
        const pool=list.filter(q=>JSON.stringify(q[1])!==this.lastPrize);
        let total=0;
        for (const q of pool) {
            total+=q[0];
        }
        let r=this.rng.next()*total;
        let pick=pool[pool.length-1];
        for (const q of pool) {
            r-=q[0];
            if (r<=0) {
                pick=q;
                break;
            }
        }
        this.lastPrize=JSON.stringify(pick[1]);
        return pick[1].map(e=>e.slice());
    }

    gameDone(ok,bonus=false) {
        const p=this.plan;
        if (ok&&!p.trainGame) {
            bump('games');
        }
        const lines=ok?MINIGAMES.winLines:MINIGAMES.loseLines;
        this.hooks.npcSay(0,t(lines[Math.floor(this.rng.next()*lines.length)]));
        this.state='node';
        const effects=p.trainGame?[]:this.prize(ok).concat(ok&&bonus?this.prize(true):[]);
        this.withReport({key:ok?(bonus?'report.gamePerfect':'report.gameWin'):'report.gameLose',params:{name:'event.'+p.game+'.title'}},fin=>{
            if (p.trainGame) {
                this.note(ok?(bonus?'mg.perfect':'mg.win'):'mg.lose');
            }
            this.applyEffects(effects,fin);
        },()=>this.backToPeace());
    }

    arrangePeace(base,count) {
        const V=PEACE_VARY;
        const r=()=>this.rng.next();
        const pick=a=>a[Math.floor(r()*a.length)];
        const flip=r()<V.mirror?-1:1;
        const near=(x,z,px,pz,d)=>Math.hypot(x-px,z-pz)<d;
        let npcs;
        if (count>1) {
            npcs=pick(V.trios.concat([base.npcs])).map(q=>[q[0]*flip,q[1]]);
        }
        else {
            const q=pick(V.spots.concat(base.npcs));
            npcs=[[q[0]*flip+(r()-0.5)*V.npcJitter,q[1]+(r()-0.5)*V.npcJitter]];
        }
        const sp=base.spawn;
        const free=V.slots.filter(q=>!near(q[0],q[1],sp[0],sp[1],V.spawnClear)&&!npcs.some(n=>near(q[0],q[1],n[0],n[1],V.npcClear)));
        for (let i=free.length-1;i>0;i--) {
            const j=Math.floor(r()*(i+1));
            [free[i],free[j]]=[free[j],free[i]];
        }
        const props=[];
        base.base.forEach((p,i)=>{
            const q=free[i];
            if (!q) {
                return;
            }
            props.push({...p,x:q[0]+(r()-0.5)*V.jitter,z:q[1]+(r()-0.5)*V.jitter,rot:(p.rot||0)*flip+(r()-0.5)*V.spin});
        });
        return {...base,props:props.concat(base.decor),npcs};
    }

    makeExits() {
        if (this.overtime) {
            const n=this.otIndex()+1;
            return [{kind:n%ENDLESS.bossEvery===ENDLESS.bossEvery-1?'boss':'next'}];
        }
        if (this.mode==='endless') {
            const n=this.index+1;
            return [{kind:n%ENDLESS.bossEvery===ENDLESS.bossEvery-1?'boss':'next'}];
        }
        const rooms=ACTS[this.act].rooms;
        if (this.index>=rooms) {
            if (this.act>=ACTS.length-1) {
                return [{kind:'finish'},{kind:'continue'}];
            }
            return [{kind:'act',act:this.act+2}];
        }
        if (this.index+1>=rooms) {
            return [{kind:'boss'}];
        }
        return this.routeOptions().map(node=>({kind:'node',node}));
    }

    routeOptions() {
        const N=NOTEBOOK.nodes;
        const keys=Object.keys(N);
        const pool=keys.filter(k=>N[k].minAct<=this.act&&(N[k].combat||k!==this.node));
        const out=[];
        let guard=0;
        const want=this.rng.next()<NOTEBOOK.threeChance?NOTEBOOK.doorsMax:NOTEBOOK.doorsMin;
        while (out.length<want&&guard<50) {
            guard++;
            const left=pool.filter(k=>!out.includes(k));
            if (left.length===0) {
                break;
            }
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
        if (!out.some(k=>N[k].combat)) {
            out[Math.floor(this.rng.next()*out.length)]='battle';
        }
        return out;
    }

    openExits() {
        this.exitsOpen=true;
        if (!this.plan.peace) {
            this.state='exit';
        }
        this.hooks.openDoors();
        this.snapshot();
    }

    canExit() {
        return this.exitsOpen&&(this.state==='exit'||this.state==='peace'||((this.training()||this.tutorial())&&this.state==='combat'));
    }

    useExit(i) {
        const ex=this.plan.exits[i];
        if (!ex||!this.canExit()) {
            return false;
        }
        if (ex.kind==='games') {
            this.hooks.openGames();
            return true;
        }
        if (ex.kind!=='home'&&ex.kind!=='back') {
            this.snapshot();
        }
        this.exitsOpen=false;
        if (ex.kind==='home') {
            this.state='idle';
            this.hooks.doorTransition(()=>this.hooks.leaveToMenu(),i);
            return true;
        }
        if (ex.kind==='back') {
            this.trainGame=null;
            this.go(i);
            return true;
        }
        if (ex.kind==='finish') {
            this.state='summary';
            this.hooks.showSummary(true,this.stats);
            return true;
        }
        if (ex.kind==='continue') {
            this.overtime=true;
            this.otPage=0;
            this.node='battle';
            this.go(i);
            return true;
        }
        if (ex.kind==='library') {
            this.library=true;
            this.go(i);
            return true;
        }
        this.node=ex.kind==='node'?ex.node:'battle';
        this.advance(i);
        return true;
    }

    advance(via) {
        if (this.overtime) {
            this.otPage++;
            this.go(via);
            return;
        }
        this.index++;
        if (this.mode==='endless') {
            this.act=this.plan.act;
            this.stats.act=this.act;
            this.go(via);
            return;
        }
        if (this.index>ACTS[this.act].rooms) {
            this.act++;
            this.index=0;
            this.stats.act=this.act;
            this.stats.xp+=TUNING.levels.xpAct;
        }
        this.go(via);
    }

    go(via=-1) {
        this.state='transition';
        if (via>=0) {
            this.hooks.doorTransition(()=>this.enter(),via);
            return;
        }
        this.hooks.transition(()=>this.enter());
    }

    trackPage(player) {
        bump('pages');
        if (this.stats.taken<=(this.roomTaken??0)) {
            bump('cleanPages');
            if (this.plan.boss) {
                bump('cleanBoss');
            }
        }
        if (player.hp===1) {
            bump('clutch');
        }
        if (this.mode==='endless') {
            setMax('endlessPage',this.index+1);
        }
    }

    playerDown() {
        if (this.state==='dead'||this.state==='summary') {
            return;
        }
        this.preDead=this.state;
        this.reviving=false;
        this.state='dead';
        this.hooks.clearRun();
        this.timer=1.6;
        this.hooks.onDeath();
    }

    quit() {
        if (this.training()||this.tutorial()) {
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

    rewardChoices(kind='mixed',rareBoost=null,count=TUNING.reward.choices) {
        const R=TUNING.reward;
        const rareChance=kind==='rare'?1:(kind==='normal'?0:(rareBoost??R.rareChance));
        const upChance=this.plan.boss?R.bossUpChance:0;
        const lv=effectiveLevel();
        const pool=unlockedCards(lv);
        const fresh=(UNLOCKS[lv]||[]).concat(UNLOCKS[lv-1]||[]).filter(id=>pool.includes(id));
        const owned=new Set(this.deckList.map(c=>c.id));
        const out=[];
        let guard=0;
        while (out.length<count&&guard<200) {
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
            out.push(createCard(id,!rare&&this.rng.next()<upChance));
        }
        return out;
    }

    planOpts() {
        return {used:this.usedBosses,lastTypes:this.lastTypes};
    }

    rewardPage() {
        const R=TUNING.reward;
        if (this.mode==='endless'&&!this.overtime) {
            const k=this.plan.index%ENDLESS.bossEvery;
            return this.plan.boss||R.endlessPages.includes(k);
        }
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

    takeCards(cards,then=()=>this.openExits()) {
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
        bump('merges');
        return card.id;
    }

    canInteract(i) {
        const p=this.plan;
        if (this.state!=='peace'||!p||!p.peace||i<0||i>=p.npcs.length) {
            return false;
        }
        return !this.npcUsed[i];
    }

    puzzleInfo() {
        return this.hooks.gameInfo();
    }

    backToPeace() {
        this.state='peace';
        this.hooks.resume();
        if (!this.exitsOpen) {
            this.openExits();
        }
    }

    note(key,params={},card=null) {
        if (this.report) {
            this.report.push({key,params,card,bad:NOTEBOOK.badNotes.includes(key)});
            return;
        }
        if (NOTEBOOK.fxNotes.includes(key)) {
            return;
        }
        this.hooks.toast(key,params,card);
    }

    withReport(title,run,done) {
        this.report=[];
        run(()=>{
            const r=this.report;
            this.report=null;
            if (!r||r.length===0) {
                done();
                return;
            }
            this.state='node';
            this.hooks.showReport(title,r,done);
        });
    }

    restHeal() {
        const R=NOTEBOOK.rest;
        if (this.hooks.hp()<=R.lowHp) {
            return R.low;
        }
        return R.min+Math.floor(this.rng.next()*(R.max-R.min+1));
    }

    interact(i) {
        if (!this.canInteract(i)) {
            return false;
        }
        const p=this.plan;
        this.state='node';
        const done=()=>this.backToPeace();
        if (p.node==='rest') {
            this.npcUsed[i]=true;
            this.hooks.npcUsed(i);
            const n=this.restHeal();
            const opts=[{id:'heal',n},{id:'upgrade',disabled:this.upgradable().length===0}];
            this.hooks.openChoice({kind:'rest',options:opts},k=>{
                if (k===0) {
                    this.note('note.healed',{n:this.hooks.heal(this.gamble(n))});
                    done();
                    return;
                }
                this.pickUpgrade(done);
            });
            return true;
        }
        if (p.node==='library') {
            return this.libraryUse(i);
        }
        if (p.node==='shop') {
            if (i>0) {
                this.buyItem(i);
                return true;
            }
            this.npcUsed[0]=true;
            this.hooks.npcUsed(0);
            this.hooks.npcSay(0,t('shop.greet'));
            done();
            return true;
        }
        if (p.node==='treasure') {
            for (let k=0;k<this.npcUsed.length;k++) {
                this.npcUsed[k]=true;
                this.hooks.npcUsed(k,k!==i);
            }
            const kind=p.chests[i];
            const eff=kind==='rare'?[['reward','rare']]:(kind==='supply'?NOTEBOOK.supply.slice():[['ambush',false],['reward','mixed']]);
            this.withReport({key:'report.chest'},fin=>{
                this.note('chest.'+kind);
                this.applyEffects(eff,fin);
            },done);
            return true;
        }
        if (p.game) {
            this.npcUsed[i]=true;
            this.hooks.npcUsed(i);
            this.hooks.openChoice({kind:'event',id:p.game,options:[{id:'start'}]},()=>{
                this.state='peace';
                this.hooks.resume();
                this.hooks.startGame();
            });
            return true;
        }
        const ev=NOTEBOOK.events.find(e=>e.id===p.event);
        this.npcUsed[i]=true;
        this.hooks.npcUsed(i);
        const opts=ev.options.map(o=>({id:o.id}));
        this.hooks.openChoice({kind:'event',id:ev.id,options:opts},k=>{
            this.withReport({key:'report.event',params:{name:'event.'+ev.id+'.title'}},fin=>this.applyEffects(ev.options[k].effects.slice(),fin),done);
        });
        return true;
    }

    shopOffer() {
        const S=NOTEBOOK.shop;
        const keys=Object.keys(S.items);
        let pick=null;
        for (let k=0;k<20;k++) {
            const list=keys.slice();
            for (let i=list.length-1;i>0;i--) {
                const j=Math.floor(this.rng.next()*(i+1));
                [list[i],list[j]]=[list[j],list[i]];
            }
            pick=list.slice(0,S.offer);
            const same=pick.filter(id=>(this.lastShop||[]).includes(id)).length;
            if (same<S.offer-1) {
                break;
            }
        }
        this.lastShop=pick;
        return pick;
    }

    stockShop(plan) {
        const S=NOTEBOOK.shop;
        const k=plan.npcs[0];
        const side=Math.abs(k.x)>=S.shelfSideMin;
        const dir=k.x>0?-1:1;
        const cx=Math.max(-S.shelfClampX,Math.min(S.shelfClampX,k.x));
        const z=side?Math.min(S.shelfMaxZ,k.z+S.shelfSideZ):Math.min(S.shelfMaxZ,k.z+S.shelfZ);
        plan.shopItems=this.shopOffer();
        plan.shopItems.forEach((id,i)=>{
            const it=S.items[id];
            const x=side?k.x+dir*(S.shelfStart+i*S.shelfGap):cx+(i-(plan.shopItems.length-1)/2)*S.shelfGap;
            plan.npcs.push({model:'item',item:id,label:t('shop.'+id),price:Math.round(it.price*shopMult()),x,z});
        });
        const L=plan.layout;
        const own=L.props.filter(q=>!L.decor.includes(q));
        const front=q=>Math.abs(q.x-k.x)<S.frontW&&q.z>k.z-S.frontBack&&q.z<k.z+S.frontDepth;
        plan.layout={...L,props:own.filter(q=>!front(q)&&plan.npcs.slice(1).every(n=>Math.hypot(q.x-n.x,q.z-n.z)>S.shelfClear)).concat(L.decor)};
    }

    shopBlocked(id) {
        if (id==='upgrade'||id==='upgrade2') {
            return this.upgradable().length===0;
        }
        return id==='remove'&&this.deckList.length<=NOTEBOOK.minDeck;
    }

    buyItem(i) {
        const S=NOTEBOOK.shop;
        const p=this.plan;
        const id=p.npcs[i].item;
        const it={...S.items[id],price:p.npcs[i].price};
        if (this.stats.score<it.price) {
            this.hooks.npcSay(0,t('shop.poor'));
            this.state='peace';
            return;
        }
        if (this.shopBlocked(id)) {
            this.hooks.npcSay(0,t('shop.cant'));
            this.state='peace';
            return;
        }
        p.bought[id]=true;
        this.npcUsed[i]=true;
        this.hooks.npcUsed(i,true);
        this.hooks.npcSay(0,t('shop.thanks'));
        this.stats.score-=it.price;
        bump('buys');
        this.note('note.paid',{n:it.price});
        const back=()=>this.backToPeace();
        if (id==='buy'||id==='rare') {
            const kind=id==='rare'?'rare':'mixed';
            this.state='reward';
            this.hooks.openReward([{kind,cards:this.rewardChoices(kind,null,S.cards)}],this.deckCounts(),cards=>this.takeCards(cards,back),true);
        }
        else if (id==='upgrade') {
            this.pickUpgrade(back);
        }
        else if (id==='remove') {
            const refund=Math.floor(it.price*S.refund);
            this.hooks.openDeckPick('remove',this.deckList,k=>{
                const cid=this.deckList[k].id;
                this.deckList.splice(k,1);
                this.note('note.removed',{},cid);
                this.hooks.cardFx('remove',cid,back);
            },{n:refund,cb:()=>{
                this.stats.score+=refund;
                this.note('note.refund',{n:refund});
                back();
            }});
        }
        else if (id==='patch'||id==='bigPatch') {
            this.note('note.healed',{n:this.hooks.heal(it.n)});
            back();
        }
        else {
            this.applyEffects([[it.effect,it.n]],back);
        }
    }

    gamble(n) {
        const p=this.plan;
        if (!p||!p.peace||p.node==='shop'||p.node==='library'||gamblerMult()===1) {
            return n;
        }
        flashRelic('gambler',1.2);
        return n*gamblerMult();
    }

    upgradable() {
        return this.deckList.map((c,i)=>i).filter(i=>!this.deckList[i].upgraded);
    }

    pickUpgrade(done) {
        this.hooks.openDeckPick('upgrade',this.deckList,i=>{
            this.deckList[i].upgraded=true;
            this.note('note.upgraded',{},this.deckList[i].id);
            this.hooks.cardFx('upgrade',this.deckList[i].id,done);
        });
    }

    randomCard(rarity) {
        const pool=unlockedCards(effectiveLevel()).filter(id=>(CARDS[id].rarity==='rare')===(rarity==='rare'));
        return createCard(pool[Math.floor(this.rng.next()*pool.length)],false);
    }

    applyEffects(list,done) {
        if (list.length===0) {
            done();
            return;
        }
        const [kind,arg]=list.shift();
        const cont=()=>this.applyEffects(list,done);
        if (kind==='heal') {
            this.note('note.healed',{n:this.hooks.heal(this.gamble(arg))});
            cont();
        }
        else if (kind==='hurt') {
            const n=this.gamble(arg);
            const lost=this.hooks.hurt(n);
            this.note(lost>0?'note.hurt':'note.guarded',{n});
            cont();
        }
        else if (kind==='ink') {
            const got=this.hooks.addInk(arg);
            this.note(got>0?'note.ink':'note.inkFull',{n:arg});
            cont();
        }
        else if (kind==='score') {
            const n=this.gamble(arg);
            this.stats.score=Math.max(0,this.stats.score+n);
            this.note(n>=0?'note.score':'note.scoreLoss',{n:Math.abs(n)});
            cont();
        }
        else if (kind==='upgradeRandom') {
            const ids=[];
            for (let k=0;k<arg;k++) {
                const ups=this.upgradable();
                if (ups.length>0) {
                    const i=ups[Math.floor(this.rng.next()*ups.length)];
                    this.deckList[i].upgraded=true;
                    this.note('note.upgraded',{},this.deckList[i].id);
                    ids.push(this.deckList[i].id);
                }
            }
            if (ids.length===0) {
                cont();
                return;
            }
            this.hooks.cardFx('upgrade',ids,cont);
        }
        else if (kind==='downgrade') {
            const ups=this.deckList.filter(c=>c.upgraded);
            if (ups.length>0) {
                const c=ups[Math.floor(this.rng.next()*ups.length)];
                c.upgraded=false;
                this.note('note.downgraded',{},c.id);
                this.hooks.cardFx('downgrade',c.id,cont);
                return;
            }
            this.hooks.hurt(1);
            this.note('note.hurt',{n:1});
            cont();
        }
        else if (kind==='removeRandom') {
            if (this.deckList.length>NOTEBOOK.minDeck) {
                const i=Math.floor(this.rng.next()*this.deckList.length);
                const id=this.deckList[i].id;
                this.deckList.splice(i,1);
                this.note('note.removed',{},id);
                this.hooks.cardFx('remove',id,cont);
                return;
            }
            this.note('note.removeSafe');
            cont();
        }
        else if (kind==='card') {
            const card=this.randomCard(arg);
            this.note('note.gained',{},card.id);
            this.hooks.cardFx('gain',card.id,()=>this.takeCards([card],cont));
        }
        else if (kind==='reward') {
            this.state='reward';
            this.hooks.openReward([{kind:arg,cards:this.rewardChoices(arg)}],this.deckCounts(),cards=>this.takeCards(cards,cont));
        }
        else if (kind==='weapon') {
            const cur=this.hooks.weaponId();
            const ids=WEAPON_ORDER.filter(id=>id!==cur);
            for (let i=ids.length-1;i>0;i--) {
                const j=Math.floor(this.rng.next()*(i+1));
                [ids[i],ids[j]]=[ids[j],ids[i]];
            }
            const opts=ids.slice(0,MINIGAMES.swapChoices);
            this.state='node';
            this.hooks.openChoice({kind:'swap',options:opts.map(id=>({id}))},k=>{
                this.hooks.setWeapon(opts[k]);
                this.note('note.swapped',{w:t('weapon.'+opts[k]+'.name')});
                cont();
            });
        }
        else if (kind==='eliteNext') {
            this.eliteNext=true;
            this.note('note.eliteNext');
            cont();
        }
        else if (kind==='roll') {
            let total=0;
            for (const o of arg) {
                total+=o[0];
            }
            let r=this.rng.next()*total;
            let pick=arg[arg.length-1];
            for (const o of arg) {
                r-=o[0];
                if (r<=0) {
                    pick=o;
                    break;
                }
            }
            this.note(pick[1]);
            this.applyEffects(pick[2].concat(list),done);
        }
        else if (kind==='ambush') {
            this.ambush(arg,list.slice(),done);
        }
        else {
            cont();
        }
    }

    ambush(elite,after,done) {
        const p=this.plan;
        const base=planRoom(this.act,Math.min(this.index,ACTS[this.act].rooms-1),this.rng,null);
        p.waves=base.waves.slice(0,2);
        p.hpMult=base.hpMult;
        p.mod=elite?'elite':null;
        p.ambush=true;
        this.ambushAfter={after,done};
        this.exitsOpen=false;
        this.hooks.closeDoors();
        this.hooks.dealDeck(this.deckList);
        this.director=new RoomDirector(p,this.hooks.enemies,this.room,this.rng);
        this.state='combat';
        this.chFail=false;
        this.chHp=-1;
        this.chT=0;
        this.hooks.banner('ambush',this);
    }

    challengeDone() {
        return !this.chFail;
    }

    trackChallenge(dt,player) {
        const ch=this.plan.challenge;
        if (!ch||this.chFail) {
            return;
        }
        this.chT+=dt;
        let fail=false;
        if (ch.id==='nohit'&&this.chHp>=0&&player.hp<this.chHp) {
            fail=true;
        }
        if (ch.id==='timed'&&this.chT>ch.time) {
            fail=true;
        }
        if (ch.id==='nocard'&&this.stats.cards>this.chCards) {
            fail=true;
        }
        this.chHp=player.hp;
        if (fail) {
            this.chFail=true;
            this.note('challenge.failed');
        }
    }

    update(dt,player) {
        if (this.state==='combat'||this.state==='cleared'||this.state==='dead') {
            this.stats.time+=dt;
        }
        if (this.state==='combat') {
            this.director.update(dt,player);
            for (const e of this.director.events) {
                if (this.course) {
                    this.course.onSpawn(e);
                }
                this.hooks.onSpawn(e);
            }
            if (this.course&&!this.training()) {
                this.course.update(dt,player);
            }
            if (this.training()||this.tutorial()) {
                return;
            }
            this.trackChallenge(dt,player);
            if (this.director.cleared) {
                if (this.course) {
                    this.course.finish();
                }
                this.state='cleared';
                this.timer=1.4;
                this.stats.rooms++;
                this.stats.xp+=TUNING.levels.xpRoom;
                this.trackPage(player);
                this.addScore(ENDLESS.scoreRoom);
                if (this.plan.elite) {
                    this.addScore(NOTEBOOK.eliteScore);
                }
                if (this.plan.boss) {
                    this.stats.bosses++;
                    if (this.notebook()&&!this.overtime&&this.act>=ACTS.length-1) {
                        this.stats.act=ACTS.length;
                        this.stats.xp+=TUNING.levels.xpAct+TUNING.levels.xpVictory;
                        this.stats.score+=ENDLESS.scoreVictory;
                        this.stats.cleared=true;
                    }
                }
                this.hooks.onCleared(this.plan);
            }
            return;
        }
        if (this.state==='cleared') {
            this.timer-=dt;
            if (this.timer<=0) {
                if (this.ambushAfter) {
                    const a=this.ambushAfter;
                    this.ambushAfter=null;
                    this.plan.ambush=false;
                    this.state='node';
                    this.applyEffects(a.after,a.done);
                    return;
                }
                const ch=this.plan.challenge;
                if (ch) {
                    const ok=this.challengeDone();
                    this.note(ok?'challenge.success':'challenge.missed',{n:NOTEBOOK.challengeScore});
                    if (ok) {
                        this.addScore(NOTEBOOK.challengeScore);
                    }
                    this.state='reward';
                    const kind=ok?'rare':'mixed';
                    this.hooks.openReward([{kind,cards:this.rewardChoices(kind)}],this.deckCounts(),cards=>this.takeCards(cards));
                    return;
                }
                if (!this.rewardPage()) {
                    this.openExits();
                    return;
                }
                if (this.plan.boss) {
                    this.openExits();
                    return;
                }
                this.state='reward';
                this.hooks.openReward([{kind:'mixed',cards:this.rewardChoices('mixed',this.plan.elite?NOTEBOOK.eliteRareChance:null)}],this.deckCounts(),cards=>this.takeCards(cards));
            }
            return;
        }
        if (this.state==='dead') {
            if (this.reviving) {
                return;
            }
            this.timer-=dt;
            if (this.timer<=0) {
                if (!this.training()&&!this.tutorial()&&this.hooks.phoenix&&this.hooks.phoenix()) {
                    this.state=this.preDead||'combat';
                    return;
                }
                if (!this.training()&&!this.tutorial()&&this.hooks.canRevive()) {
                    this.reviving=true;
                    this.hooks.openRevive(ok=>{
                        this.reviving=false;
                        if (ok) {
                            this.state=this.preDead||'combat';
                            return;
                        }
                        this.state='summary';
                        this.hooks.showSummary(!!this.stats.cleared,this.stats);
                    });
                    return;
                }
                this.state='summary';
                this.hooks.showSummary(!!this.stats.cleared,this.stats);
            }
        }
    }
}
