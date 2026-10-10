import {TUNING} from '../data/tuning.js';
import {circleVs} from '../core/collision.js';

const _t={x:0,z:0,depth:0};

export class CourseRun {
    constructor(id,plan,hooks) {
        this.id=id;
        this.cfg=TUNING.courses[id];
        this.hooks=hooks;
        this.total=plan.waves.reduce((a,w)=>a+w.length,0);
        this.goal=this.cfg.goal||this.total;
        this.count=0;
        this.step=1;
        this.done=false;
        this.failed=false;
        this.elapsed=0;
        this.copyT=this.cfg.every||0;
        this.pulse=0;
        this.rings=[];
        this.ringT=id==='music'?this.cfg.first:0;
        this.chalkT=id==='dodge'?this.cfg.first:0;
        this.throws=[];
    }

    progress() {
        if (this.done) {
            return 1;
        }
        return Math.min(1,this.count/Math.max(1,this.goal));
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

    dashRate() {
        return this.id==='dodge'?1/this.cfg.dashCd:1;
    }

    onSpawn(e) {
        e.courseOrig=true;
    }

    holding() {
        return this.id==='math'&&!this.done&&!this.failed;
    }

    nextNum() {
        return this.holding()?this.step:0;
    }

    damage(e,dmg) {
        if (this.holding()&&e.courseNum!==this.step) {
            return dmg*this.cfg.off;
        }
        return dmg;
    }

    tagMath(list) {
        let live=0;
        const pool=[];
        for (const e of list) {
            if (!e.alive||e.def.boss||e.def.part) {
                continue;
            }
            if (e.courseNum===this.step) {
                live++;
            }
            else {
                pool.push(e);
            }
        }
        while (live<this.cfg.tags&&pool.length>0) {
            const e=pool.splice(Math.floor(Math.random()*pool.length),1)[0];
            e.courseNum=this.step;
            live++;
        }
    }

    clearTags() {
        for (const e of this.hooks.enemies.list) {
            e.courseNum=0;
        }
    }

    dodged() {
        if (this.id!=='dodge'||this.done) {
            return;
        }
        this.count++;
        this.pulse=0.6;
        if (this.count>=this.goal) {
            this.complete();
        }
    }

    onKill(e) {
        if (this.holding()&&e.courseNum===this.step) {
            e.courseNum=0;
            this.clearTags();
            this.count++;
            this.pulse=0.6;
            this.hooks.counted(e);
            if (this.count>=this.goal) {
                this.complete();
                return;
            }
            this.step++;
            this.tagMath(this.hooks.enemies.list);
            return;
        }
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
        if (!e.courseOrig||e.def.boss||e.def.part) {
            return;
        }
        if (this.id==='pe'||this.id==='copy') {
            this.count++;
        }
    }

    update(dt,player) {
        this.pulse=Math.max(0,this.pulse-dt*2);
        if (this.done||this.failed) {
            if (this.id==='math') {
                this.clearTags();
            }
            this.rings.length=0;
            this.throws.length=0;
            return;
        }
        this.elapsed+=dt;
        const list=this.hooks.enemies.list;
        if (this.id==='pe'&&this.elapsed>this.cfg.time) {
            this.fail('course.pe.late');
        }
        if (this.id==='math') {
            this.tagMath(list);
        }
        if (this.id==='copy') {
            this.copyT-=dt;
            if (this.copyT<=0) {
                this.copyT=this.cfg.every;
                this.copyOne(list);
            }
        }
        if (this.id==='dodge') {
            this.chalkT-=dt;
            if (this.chalkT<=0) {
                this.chalkT=this.cfg.every;
                this.chalk(player);
            }
            this.tickThrows(dt,player);
        }
        if (this.id==='music') {
            this.updateRings(dt,player);
        }
    }

    chalk(player) {
        const room=this.hooks.room();
        if (!room) {
            return;
        }
        const C=this.cfg;
        const b=room.walkBounds||room.bounds;
        for (let i=0;i<24;i++) {
            const a=Math.random()*Math.PI*2;
            const d=0.85+Math.random()*0.3;
            const x=player.pos.x+Math.cos(a)*C.distX*d;
            const z=player.pos.z+Math.sin(a)*C.distZ*d;
            if (x<b.minX+1||x>b.maxX-1||z<b.minZ+1||z>b.maxZ-1) {
                continue;
            }
            this.throws.push({x,z,t:C.warn});
            this.hooks.chalked(x,z,C.warn);
            return;
        }
    }

    tickThrows(dt,player) {
        const C=this.cfg;
        for (let i=this.throws.length-1;i>=0;i--) {
            const q=this.throws[i];
            q.t-=dt;
            if (q.t>0) {
                continue;
            }
            this.throws.splice(i,1);
            const a=Math.atan2(player.pos.z-q.z,player.pos.x-q.x)+(Math.random()-0.5)*2*C.spread;
            this.hooks.bullets.spawn(q.x,q.z,Math.cos(a),Math.sin(a),C.speed,1,C.life);
            this.hooks.thrown(q.x,q.z);
        }
    }

    ringSpot(player) {
        const room=this.hooks.room();
        if (!room) {
            return null;
        }
        const C=this.cfg;
        const b=room.walkBounds||room.bounds;
        for (let i=0;i<40;i++) {
            const x=player.pos.x+(Math.random()*2-1)*C.rangeX;
            const z=player.pos.z+(Math.random()*2-1)*C.rangeZ;
            const d=Math.hypot(x-player.pos.x,z-player.pos.z);
            if (x<b.minX+2||x>b.maxX-2||z<b.minZ+2||z>b.maxZ-2||d<C.minFar||this.rings.some(q=>Math.hypot(q.x-x,q.z-z)<C.radius*3)) {
                continue;
            }
            if (i<C.tries&&this.hooks.enemies.list.some(e=>e.alive&&Math.hypot(e.pos.x-x,e.pos.z-z)<C.foeGap+(e.def.radius||0.5))) {
                continue;
            }
            let ok=true;
            for (const c of room.colliders) {
                if (circleVs(x,z,C.radius+0.4,c,_t)) {
                    ok=false;
                    break;
                }
            }
            if (ok) {
                return {x,z};
            }
        }
        return null;
    }

    updateRings(dt,player) {
        const C=this.cfg;
        for (let i=this.rings.length-1;i>=0;i--) {
            const q=this.rings[i];
            q.age+=dt;
            if (Math.hypot(player.pos.x-q.x,player.pos.z-q.z)<C.radius+0.3) {
                this.rings.splice(i,1);
                this.count++;
                this.pulse=0.6;
                this.hooks.stepped(q.x,q.z);
                if (this.count>=this.goal) {
                    this.complete();
                    return;
                }
            }
            else if (q.age>=C.life) {
                this.rings.splice(i,1);
                this.hooks.missed(q.x,q.z);
            }
        }
        this.ringT-=dt;
        if (this.ringT<=0&&this.rings.length<C.max) {
            this.ringT=C.every;
            const p=this.ringSpot(player);
            if (p) {
                this.rings.push({x:p.x,z:p.z,age:0});
            }
        }
    }

    copyOne(list) {
        let copies=0;
        const pool=[];
        for (const e of list) {
            if (!e.alive||e.def.boss||e.def.part||e.state==='spawn') {
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
        this.rings.length=0;
        this.throws.length=0;
        if (!this.failed&&(this.id==='pe'||this.id==='copy')) {
            this.count=this.goal;
            this.complete();
        }
    }
}
