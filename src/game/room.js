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

export class TrainingDirector {
    constructor(spots,enemies,respawn,allow) {
        this.enemies=enemies;
        this.respawn=respawn;
        this.slots=spots.map(([type,x,z])=>({type:allow(type)?type:'doodle',x,z,e:null,t:0.4}));
        this.cleared=false;
        this.boss=null;
        this.events=[];
        this.wave=0;
        this.queue=[];
    }

    totalWaves() {
        return 1;
    }

    update(dt) {
        this.events.length=0;
        for (const s of this.slots) {
            if (s.e&&s.e.alive&&s.e.uid===s.uid) {
                continue;
            }
            s.e=null;
            s.t-=dt;
            if (s.t<=0) {
                s.e=this.enemies.spawn(s.type,s.x,s.z,{hpMult:1,dummy:true});
                s.uid=s.e.uid;
                s.t=this.respawn;
                this.events.push(s.e);
            }
        }
    }
}
