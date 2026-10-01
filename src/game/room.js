import {circleVs} from '../core/collision.js';
import {TUNING} from '../data/tuning.js';

export class RoomDirector {
    constructor(plan,enemies,room,rng) {
        this.plan=plan;
        this.enemies=enemies;
        this.room=room;
        this.rng=rng;
        this.wave=-1;
        this.queue=[];
        this.spawnT=0;
        this.nextT=1.0;
        this.cleared=false;
        this.boss=null;
        this.events=[];
        this.eliteWave=-1;
    }

    pickPoint(player) {
        const pts=this.room.def.spawnPoints;
        const ok=pts.filter(p=>Math.hypot(p[0]-player.pos.x,p[1]-player.pos.z)>7);
        const list=ok.length>0?ok:pts;
        return list[Math.floor(this.rng.next()*list.length)];
    }

    totalWaves() {
        return this.plan.waves.length;
    }

    update(dt,player) {
        this.events.length=0;
        if (this.cleared) {
            return;
        }
        if (this.queue.length>0) {
            this.spawnT-=dt;
            if (this.spawnT<=0) {
                const s=this.queue.shift();
                let x;
                let z;
                if (s.boss) {
                    const b=this.room.def.bossSpawn||[0,-3];
                    x=b[0];
                    z=b[1];
                }
                else {
                    const p=this.pickPoint(player);
                    x=p[0]+this.rng.range(-0.8,0.8);
                    z=p[1]+this.rng.range(-0.8,0.8);
                }
                let elite=false;
                if (this.plan.mod==='elite'&&!s.boss&&this.eliteWave!==this.wave) {
                    this.eliteWave=this.wave;
                    elite=true;
                }
                const e=this.enemies.spawn(s.type,x,z,{hpMult:this.plan.hpMult*(s.boss?this.plan.bossHp:1)*(elite?TUNING.elite.hp:1),elite});
                if (s.boss) {
                    this.boss=e;
                }
                this.events.push(e);
                this.spawnT=0.35;
            }
            return;
        }
        const alive=this.enemies.aliveCount();
        if (this.boss&&!this.boss.alive) {
            this.cleared=true;
            return;
        }
        if (this.wave>=this.plan.waves.length-1) {
            if (alive===0) {
                this.cleared=true;
            }
            return;
        }
        if (alive<=2||this.wave<0) {
            this.nextT-=dt;
            if (this.nextT<=0) {
                this.wave++;
                this.queue=this.plan.waves[this.wave].slice();
                this.spawnT=0;
                this.nextT=1.2;
            }
        }
    }
}

const TRAIN_POOL=['doodle','blob','sprayer','inkCloud','bird','compass','eraserMonster'];

export class TrainingDirector {
    constructor(cfg,enemies,room,allow) {
        this.enemies=enemies;
        this.room=room;
        this.allow=allow;
        this.cleared=false;
        this.boss=null;
        this.events=[];
        this.wave=0;
        this.queue=[];
        this.configure(cfg);
    }

    totalWaves() {
        return 1;
    }

    spots(n) {
        const T=TUNING.training;
        const b=this.room.bounds;
        const tmp={x:0,z:0,depth:0};
        const out=[];
        for (const z of T.rows) {
            for (let x=Math.ceil(b.minX+2);x<=b.maxX-2;x+=T.colStep) {
                if (z<b.minZ+1.5||z>b.maxZ-1.5) {
                    continue;
                }
                let ok=true;
                for (const c of this.room.colliders) {
                    if (circleVs(x,z,T.clear,c,tmp)) {
                        ok=false;
                        break;
                    }
                }
                if (ok) {
                    out.push([x,z]);
                }
            }
        }
        out.sort((p,q)=>Math.hypot(p[0]*0.6,p[1]-T.center)-Math.hypot(q[0]*0.6,q[1]-T.center));
        return out.slice(0,n);
    }

    roll() {
        const c=this.cfg;
        const pool=TRAIN_POOL.filter(k=>this.allow(k));
        const type=pool[Math.floor(Math.random()*pool.length)]||'doodle';
        return {type,elite:Math.random()*100<c.randElite};
    }

    configure(cfg) {
        this.cfg=cfg;
        this.enemies.clear();
        const list=[];
        if (cfg.random) {
            for (let i=0;i<cfg.randCount;i++) {
                list.push(this.roll());
            }
        }
        else {
            for (const [map,elite] of [[cfg.foes,false],[cfg.elites||{},true]]) {
                for (const k in map) {
                    if (!this.allow(k)) {
                        continue;
                    }
                    for (let i=0;i<map[k];i++) {
                        list.push({type:k,elite});
                    }
                }
            }
        }
        const T=TUNING.training;
        const bosses=Object.keys(cfg.bosses||{}).filter(k=>cfg.bosses[k]>0&&this.allow(k));
        const bpts=T.bossSpots.slice(0,bosses.length);
        const pts=this.spots(list.length+bpts.length*6).filter(p=>bpts.every(b=>Math.hypot(p[0]-b[0],p[1]-b[1])>T.bossClear));
        this.slots=list.slice(0,pts.length).map((q,i)=>({type:q.type,elite:q.elite,x:pts[i][0],z:pts[i][1],e:null,uid:-1,t:0.3+i*0.12}));
        bosses.forEach((type,i)=>this.slots.push({type,elite:false,boss:true,x:bpts[i][0],z:bpts[i][1],e:null,uid:-1,t:0.4+i*0.3}));
    }

    setAttack(on) {
        this.cfg.attack=on;
        for (const s of this.slots) {
            if (s.e&&s.e.alive) {
                s.e.dummy=!on;
            }
        }
    }

    setImmortal(on) {
        this.cfg.immortal=on;
        for (const s of this.slots) {
            if (s.e&&s.e.alive) {
                s.e.immortal=on;
            }
        }
    }

    update(dt) {
        this.events.length=0;
        const T=TUNING.training;
        for (const s of this.slots) {
            if (s.e&&s.e.alive&&s.e.uid===s.uid) {
                continue;
            }
            s.t-=dt;
            if (s.t<=0) {
                const c=this.cfg;
                if (c.random&&s.e&&!s.boss) {
                    Object.assign(s,this.roll());
                }
                s.e=this.enemies.spawn(s.type,s.x,s.z,{hpMult:s.elite?TUNING.elite.hp:1,dummy:!c.attack,elite:s.elite,immortal:c.immortal});
                s.uid=s.e.uid;
                s.t=T.respawn;
                this.events.push(s.e);
            }
        }
    }
}
