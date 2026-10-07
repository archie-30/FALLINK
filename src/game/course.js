import {TUNING} from '../data/tuning.js';

export class CourseRun {
    constructor(id,plan,hooks) {
        this.id=id;
        this.cfg=TUNING.courses[id];
        this.hooks=hooks;
        this.total=plan.waves.reduce((a,w)=>a+w.length,0);
        this.goal=id==='math'?Math.min(this.total,this.cfg.goal):this.total;
        this.count=0;
        this.streak=0;
        this.counter=0;
        this.done=false;
        this.failed=false;
        this.elapsed=0;
        this.alert=0;
        this.woke=false;
        this.copyT=this.cfg.every||0;
        this.pulse=0;
    }

    progress() {
        if (this.done) {
            return 1;
        }
        return Math.min(1,(this.id==='math'?this.streak:this.count)/Math.max(1,this.goal));
    }

    complete() {
        if (this.done||this.failed) {
            return;
        }
        this.done=true;
        this.pulse=1;
        this.hooks.reward(this);
    }

    fail(key) {
        if (this.done||this.failed) {
            return;
        }
        this.failed=true;
        this.hooks.note(key);
    }

    enemyRate() {
        return this.id==='pe'?this.cfg.foe:1;
    }

    playerSpeed() {
        return this.id==='pe'?this.cfg.speed:1;
    }

    scoreMult() {
        return this.id==='cram'?this.cfg.score:1;
    }

    onSpawn(e) {
        e.courseOrig=true;
        if (this.id==='math') {
            e.courseNum=++this.counter;
        }
        else if (this.id==='quiet'&&!this.woke) {
            e.sleep=true;
            e.dummy=true;
        }
    }

    nextNum(except=null) {
        let best=0;
        for (const e of this.hooks.enemies.list) {
            if (e!==except&&e.alive&&e.courseNum>0&&(best===0||e.courseNum<best)) {
                best=e.courseNum;
            }
        }
        return best;
    }

    damage(e,dmg) {
        if (this.id==='math'&&e.courseNum>0&&e.courseNum>this.nextNum()) {
            return dmg*this.cfg.off;
        }
        if (this.id==='quiet'&&e.sleep) {
            this.wake(e);
            return dmg*this.cfg.sleep;
        }
        return dmg;
    }

    wake(e) {
        e.sleep=false;
        e.dummy=false;
    }

    wakeAll() {
        if (this.woke) {
            return;
        }
        this.woke=true;
        this.alert=1;
        for (const e of this.hooks.enemies.list) {
            if (e.sleep) {
                this.wake(e);
            }
        }
        this.fail('course.quiet.woke');
    }

    noise() {
        if (this.id==='quiet'&&!this.woke&&!this.done) {
            this.alert=Math.min(1,this.alert+this.cfg.shot);
            if (this.alert>=1) {
                this.wakeAll();
            }
        }
    }

    hurt() {
        if (this.id==='cram') {
            this.fail('course.cram.hit');
        }
    }

    onKill(e) {
        if (e.copyOf&&this.id==='copy') {
            return;
        }
        if (this.id==='copy'&&e.courseOrig) {
            for (const o of this.hooks.enemies.list.slice()) {
                if (o.copyOf===e.uid&&o.alive) {
                    o.noReward=true;
                    this.hooks.enemies.slay(o);
                }
            }
        }
        if (!e.courseOrig||e.def.boss) {
            return;
        }
        this.count++;
        if (this.id==='math'&&e.courseNum>0) {
            const m=this.nextNum();
            if (m===0||e.courseNum<m) {
                this.streak++;
            }
            else {
                this.streak=0;
            }
            if (this.streak>=this.goal) {
                this.complete();
            }
        }
    }

    update(dt,player) {
        this.pulse=Math.max(0,this.pulse-dt*2);
        if (this.done||this.failed) {
            return;
        }
        this.elapsed+=dt;
        const list=this.hooks.enemies.list;
        if (this.id==='pe'&&this.elapsed>this.cfg.time) {
            this.fail('course.pe.late');
        }
        if (this.id==='copy') {
            this.copyT-=dt;
            if (this.copyT<=0) {
                this.copyT=this.cfg.every;
                this.copyOne(list);
            }
        }
        if (this.id==='quiet'&&!this.woke) {
            let near=false;
            for (const e of list) {
                if (e.sleep&&Math.hypot(e.pos.x-player.pos.x,e.pos.z-player.pos.z)<this.cfg.radius) {
                    near=true;
                    break;
                }
            }
            this.alert=Math.max(0,Math.min(1,this.alert+(near?this.cfg.near:-this.cfg.decay)*dt));
            if (this.alert>=1) {
                this.wakeAll();
            }
        }
    }

    copyOne(list) {
        let copies=0;
        const pool=[];
        for (const e of list) {
            if (!e.alive||e.def.boss||e.state==='spawn') {
                continue;
            }
            if (e.copyOf) {
                copies++;
            }
            else if (e.courseOrig&&!list.some(o=>o.copyOf===e.uid)) {
                pool.push(e);
            }
        }
        if (copies>=this.cfg.max||pool.length===0) {
            return;
        }
        const src=pool[Math.floor(Math.random()*pool.length)];
        const a=Math.random()*Math.PI*2;
        const c=this.hooks.enemies.spawn(src.type,src.pos.x+Math.cos(a)*1.4,src.pos.z+Math.sin(a)*1.4,{hpMult:this.hooks.hpMult()*this.cfg.hp,quick:true});
        c.copyOf=src.uid;
        c.noReward=true;
        this.hooks.copied(src,c);
    }

    finish() {
        if (this.id==='pe'&&this.elapsed>this.cfg.time) {
            this.fail('course.pe.late');
        }
        if (!this.failed&&this.id!=='math') {
            this.count=this.goal;
            this.complete();
        }
    }
}
