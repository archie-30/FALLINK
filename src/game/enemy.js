import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {ENEMIES} from '../data/enemies.js';
import {toonMaterial,hullMaterial,unlitMaterial,lineMaterial,trapMaterial,inkMaterial,ringMaterial,registerShadow,pal,renderFlags} from '../render/materials.js';
import {resolveCircle,clampToBounds,circleVs} from '../core/collision.js';
import {EASE} from '../core/easing.js';
import {RNG} from '../core/rng.js';
import {time} from '../core/loop.js';
import {t} from '../data/strings.js';
import {teleSlow,flashRelic} from './relic.js';

const rng=new RNG(1234);
const hitTmp={x:0,z:0,depth:0};
let uidCounter=0;

function capsule(r,len) {
    return new THREE.CapsuleGeometry(r,len,3,8);
}

const geos={};

function geo(key,make) {
    if (!geos[key]) {
        geos[key]=make();
    }
    return geos[key];
}

function wrap(a) {
    while (a>Math.PI) {
        a-=Math.PI*2;
    }
    while (a<-Math.PI) {
        a+=Math.PI*2;
    }
    return a;
}

function fireRing(ctx,x,z,count,offset,speed,dmg,life) {
    for (let i=0;i<count;i++) {
        const a=offset+i/count*Math.PI*2;
        ctx.enemyBullets.spawn(x,z,Math.cos(a),Math.sin(a),speed,dmg,life);
    }
}

export class Enemy {
    constructor(type,def,parent,fxScene) {
        this.type=type;
        this.def=def;
        this.fxScene=fxScene;
        this.pos=new THREE.Vector3();
        this.prev=new THREE.Vector3();
        this.vel=new THREE.Vector3();
        this.renderPos=new THREE.Vector3();
        this.alive=false;
        this.state='spawn';
        this.mats=[];
        this.hulls=[];
        this.lines=[];
        this.strips=[];
        this.ring=null;
        this.tele=null;
        this.hull=hullMaterial({jitter:TUNING.boil.vertexJitter,unique:true});
        this.root=new THREE.Group();
        this.root.visible=false;
        const sr=def.radius*3.2;
        this.shadow=new THREE.Mesh(geo('shadow',()=>new THREE.PlaneGeometry(1,1)),null);
        this.shadow.scale.set(sr,sr,1);
        this.shadow.rotation.x=-Math.PI/2;
        this.shadow.position.y=0.03;
        registerShadow(this.shadow);
        this.root.add(this.shadow);
        this.yawGroup=new THREE.Group();
        this.squash=new THREE.Group();
        this.body=new THREE.Group();
        this.yawGroup.scale.setScalar(def.scale);
        this.root.add(this.yawGroup);
        this.yawGroup.add(this.squash);
        this.squash.add(this.body);
        this.buildBody();
        this.buildAccent();
        parent.add(this.root);
    }

    buildAccent() {
        const A=TUNING.accent;
        const red=toonMaterial({light:'red',mid:'red',dark:'darkRed',jitter:TUNING.boil.vertexJitter});
        this.accent=new THREE.Group();
        const ring=new THREE.Mesh(geo('accentRing',()=>new THREE.TorusGeometry(A.ring,A.tube,5,14)),red);
        ring.rotation.x=Math.PI/2;
        this.accent.add(ring);
        const spike=geo('accentSpike',()=>new THREE.ConeGeometry(A.spikeR,A.spikeH,5));
        for (let i=0;i<A.spikes;i++) {
            const a=i/A.spikes*Math.PI*2;
            const m=new THREE.Mesh(spike,red);
            m.position.set(Math.cos(a)*A.ring,A.spikeH*0.45,Math.sin(a)*A.ring);
            m.rotation.set(Math.sin(a)*0.35,0,-Math.cos(a)*0.35);
            this.accent.add(m);
        }
        this.accent.visible=false;
        this.root.add(this.accent);
    }

    mat(k) {
        const m=toonMaterial({...this.def.tones[k],jitter:TUNING.boil.vertexJitter,unique:true,yreveal:true});
        this.mats.push(m);
        return m;
    }

    inkMat() {
        if (!this._ink) {
            this._ink=toonMaterial({light:'ink',mid:'ink',dark:'ink',unique:true,yreveal:true});
            this.mats.push(this._ink);
        }
        return this._ink;
    }

    hullify(mesh) {
        const h=new THREE.Mesh(mesh.geometry,this.hull);
        mesh.add(h);
        this.hulls.push(h);
        return mesh;
    }

    line(i) {
        while (this.lines.length<=i) {
            const g=geo('line',()=>{
                const q=new THREE.PlaneGeometry(1,1);
                q.rotateX(-Math.PI/2);
                q.translate(0.5,0,0);
                return q;
            });
            const m=new THREE.Mesh(g,lineMaterial('red'));
            m.visible=false;
            m.frustumCulled=false;
            this.fxScene.add(m);
            this.lines.push(m);
        }
        return this.lines[i];
    }

    ringMesh() {
        if (!this.ring) {
            const g=geo('ring',()=>{
                const q=new THREE.PlaneGeometry(2,2);
                q.rotateX(-Math.PI/2);
                return q;
            });
            this.ring=new THREE.Mesh(g,trapMaterial('red',true));
            this.ring.visible=false;
            this.ring.frustumCulled=false;
            this.fxScene.add(this.ring);
        }
        return this.ring;
    }

    buildBody() {
    }

    onReset() {
    }

    firstT(r) {
        return rng.range(r[0],r[1])+rng.range(0,TUNING.enemyPace.firstSpread);
    }

    paced(key,r) {
        const J=TUNING.enemyPace;
        if (this.paceC[key]===undefined) {
            this.paceC[key]=rng.range(r[0],r[1])*rng.range(J.scale[0],J.scale[1]);
        }
        const c=this.paceC[key];
        return rng.range(c*(1-J.width),c*(1+J.width));
    }

    think() {
    }

    pose() {
    }

    reset(x,z,o={}) {
        const d=this.def;
        this.pos.set(x,0,z);
        this.prev.copy(this.pos);
        this.renderPos.copy(this.pos);
        this.vel.set(0,0,0);
        this.hp=d.hp*(o.hpMult||1);
        this.act=o.act||0;
        this.tier=o.tier||0;
        this.minionT=TUNING.bossScale.summonFirst;
        this.minionWaves=[];
        this.elite=!!o.elite;
        this.dummy=!!o.dummy;
        this.immortal=!!o.immortal;
        this.tutor=!!o.tutor;
        this.courseNum=0;
        this.paceC={};
        this.courseOrig=false;
        this.copyOf=0;
        this.sleep=false;
        this.noReward=false;
        this.yawGroup.scale.setScalar(d.scale*(this.elite?TUNING.elite.scale:1));
        const A=TUNING.accent;
        this.accentOn=this.elite||!!d.boss;
        this.accent.scale.setScalar(d.boss?A.bossScale:A.eliteScale);
        this.accent.position.y=d.height*(this.elite?TUNING.elite.scale:1)*(d.boss?A.bossLift:A.eliteLift);
        this.maxHp=this.hp;
        this.uid=++uidCounter;
        this.alive=true;
        this.hpShown=1;
        this.state='spawn';
        this.stateT=0;
        this.t=0;
        this.spawnTime=o.quick?0.25:d.spawnTime;
        this.quick=!!o.quick;
        this.yaw=rng.range(-Math.PI,Math.PI);
        this.aimX=0;
        this.aimZ=1;
        this.sq=o.quick?-0.3:0;
        this.sqv=0;
        this.flashT=0;
        this.kick=0;
        this.spin=0;
        this.phase=rng.range(0,6);
        this.poseStep=-1;
        this.speedFrac=0;
        this.tele=null;
        this.stunT=0;
        this.lockT=0;
        this.vulnT=0;
        this.vulnMult=1;
        this.slowT=0;
        this.slowMult=1;
        this.evolved=false;
        this.evolving=false;
        this.evoT=0;
        this.shielded=false;
        this.baseScale=d.scale*(this.elite?TUNING.elite.scale:1);
        this.root.visible=true;
        this.root.position.copy(this.pos);
        for (const l of this.lines) {
            l.visible=false;
        }
        if (this.ring) {
            this.ring.visible=false;
        }
        this.onReset(o);
    }

    hide() {
        this.alive=false;
        this.root.visible=false;
        this.tele=null;
        this.hideStrips();
        for (const l of this.lines) {
            l.visible=false;
        }
        if (this.ring) {
            this.ring.visible=false;
        }
    }

    stun(t,full) {
        const k=this.def.boss?(full?TUNING.bossTempo:0.3):1;
        this.stunT=Math.max(this.stunT,t*k);
        if (full) {
            this.lockT=Math.max(this.lockT,t*k);
        }
        this.tele=null;
        this.sqv+=2;
    }

    setState(s) {
        this.state=s;
        this.stateT=0;
    }

    teleLine(dx,dz,len,dur,count=1,spread=0) {
        this.tele={type:'line',dx,dz,len,dur,count,spread,t:0};
        this.teleSeen();
    }

    teleRing(r,dur) {
        this.tele={type:'ring',r,dur,t:0};
        this.teleSeen();
    }

    teleSeen() {
        if (this.def.boss||this.elite) {
            flashRelic('glasses',0.5);
        }
    }

    hurt(dmg,dx,dz) {
        const F=TUNING.feel;
        const km=(this.def.knockMult??1)*(this.elite?TUNING.elite.knock:1);
        this.hp-=dmg;
        const E=this.def.evolve;
        if (E&&!this.evolved&&!this.evolving&&this.hp<this.maxHp*E.at) {
            this.hp=this.maxHp*E.at;
            this.evolving=true;
            this.evoT=0;
            this.shielded=true;
        }
        this.flashT=F.flashTime;
        this.vel.x+=dx*F.knockback*km;
        this.vel.z+=dz*F.knockback*km;
        this.sqv+=F.hurtSquash*(km>0?1:0.4);
        return this.hp<=0;
    }

    damageMult() {
        return 1;
    }

    onEvolveStart() {
    }

    onEvolved() {
    }

    evolveTick(dt,ctx) {
        const E=this.def.evolve;
        const V=TUNING.evolve;
        this.manual=true;
        this.vel.multiplyScalar(Math.exp(-10*dt));
        this.tele=null;
        if (this.evoT===0) {
            this.onEvolveStart(ctx);
            this.say={text:t('evolve.'+this.type),t:0,dur:E.time,keep:true};
            ctx.fx.cameraShake(V.shake);
        }
        const before=this.evoT;
        this.evoT+=dt;
        this.spinning=true;
        const k=Math.min(1,this.evoT/E.time);
        this.yawGroup.scale.setScalar(this.baseScale*(1+V.grow*EASE.easeOutBack(k)));
        if (Math.floor(this.evoT*V.pulse)!==Math.floor(before*V.pulse)) {
            this.sqv+=3;
            this.flashT=0.08;
            ctx.particles.burst(this.pos.x,1.5,this.pos.z,10,{color:'red',speed:[3,8],up:[2,6]});
        }
        if (this.evoT>=E.time) {
            this.evolving=false;
            this.evolved=true;
            this.shielded=false;
            this.spinning=false;
            this.sqv+=6;
            ctx.fx.cameraShake(V.shake*1.5);
            ctx.particles.burst(this.pos.x,1,this.pos.z,40,{color:'red',speed:[6,14],up:[2,8]});
            this.onEvolved(ctx);
            this.setState('move');
            this.patternT=V.restart;
        }
    }

    strip(i) {
        while (this.strips.length<=i) {
            const g=geo('line',()=>{
                const q=new THREE.PlaneGeometry(1,1);
                q.rotateX(-Math.PI/2);
                q.translate(0.5,0,0);
                return q;
            });
            const m=new THREE.Mesh(g,inkMaterial('ink'));
            m.visible=false;
            m.frustumCulled=false;
            this.fxScene.add(m);
            this.strips.push(m);
        }
        return this.strips[i];
    }

    putLine(m,ax,az,bx,bz,w) {
        const dx=bx-ax;
        const dz=bz-az;
        const len=Math.hypot(dx,dz);
        m.visible=true;
        m.position.set(ax,0.05,az);
        m.rotation.y=Math.atan2(-dz,dx);
        m.scale.set(Math.max(0.01,len),1,w);
        m.material.uniforms.uLength.value=len;
    }

    hideStrips(from=0) {
        for (let i=from;i<this.strips.length;i++) {
            this.strips[i].visible=false;
        }
    }

    summonTick(dt,ctx) {
        const B=TUNING.bossScale;
        if (this.tutor) {
            return;
        }
        this.minionT-=dt;
        if (this.minionT>0) {
            return;
        }
        const k=Math.min(this.tier,B.summonEvery.length)-1;
        this.minionT=B.summonEvery[k]*(this.def.summonMult||1);
        if (ctx.enemyMgr.list.length>=B.summonCap) {
            return;
        }
        const list=B.minions[k].map(type=>{
            const a=rng.range(0,Math.PI*2);
            return [type,this.pos.x+Math.cos(a)*3.5,this.pos.z+Math.sin(a)*3.5];
        });
        for (const e of this.summonWave(ctx,list)) {
            ctx.particles.burst(e.pos.x,0.4,e.pos.z,8,{color:'midGray',speed:[1,4],up:[1,4]});
            this.sqv+=0.7;
        }
    }

    canSummon() {
        this.minionWaves=(this.minionWaves||[]).filter(w=>w.some(q=>q.e.alive&&q.e.uid===q.uid));
        return this.minionWaves.length<TUNING.bossScale.waveCap;
    }

    summonWave(ctx,list) {
        if (!this.canSummon()) {
            return [];
        }
        const w=[];
        for (const [type,x,z,o] of list) {
            const e=ctx.enemyMgr.spawn(type,x,z,o||{});
            w.push({e,uid:e.uid});
        }
        this.minionWaves.push(w);
        return w.map(q=>q.e);
    }

    colliders(ctx) {
        return ctx.room.colliders;
    }

    canContact() {
        return true;
    }

    update(dt,ctx) {
        if (this.tele&&!this.dummy) {
            dt/=teleSlow();
        }
        const d=this.def;
        const p=ctx.player;
        this.prev.copy(this.pos);
        this.t+=dt;
        this.stateT+=dt;
        if (this.tele) {
            this.tele.t+=dt;
        }
        const tx=p.pos.x-this.pos.x;
        const tz=p.pos.z-this.pos.z;
        this.dist=Math.hypot(tx,tz)||1;
        this.nx=tx/this.dist;
        this.nz=tz/this.dist;
        this.wx=0;
        this.wz=0;
        this.manual=false;
        this.spinning=false;
        this.vulnT=Math.max(0,this.vulnT-dt);
        if (this.state==='spawn') {
            if (this.t>=this.spawnTime) {
                this.setState('move');
                this.sqv+=2;
            }
            this.vel.multiplyScalar(Math.exp(-8*dt));
        }
        else if (this.evolving) {
            this.evolveTick(dt,ctx);
        }
        else if (this.stunT>0) {
            this.stunT-=dt;
            this.lockT=Math.max(0,this.lockT-dt);
            this.manual=true;
            this.tele=null;
            if (this.lockT>0) {
                this.vel.set(0,0,0);
            }
            else {
                this.vel.multiplyScalar(Math.exp(-10*dt));
            }
            if (this.stunT<=0&&this.state!=='move') {
                this.setState('move');
            }
        }
        else if (this.dummy) {
            this.manual=true;
            this.tele=null;
            this.aimX=this.nx;
            this.aimZ=this.nz;
            this.vel.multiplyScalar(Math.exp(-8*dt));
        }
        else {
            this.think(dt,ctx);
            if (d.boss&&this.tier>0&&ctx.enemyMgr) {
                this.summonTick(dt,ctx);
            }
        }
        this.slowT=Math.max(0,(this.slowT||0)-dt);
        const slow=(d.flying?1:ctx.room.zones.slowAt(this.pos.x,this.pos.z))*(this.slowT>0?this.slowMult:1);
        if (!this.manual) {
            if (!d.boss) {
                for (const o of ctx.enemies) {
                    if (o===this||!o.alive) {
                        continue;
                    }
                    const ex=this.pos.x-o.pos.x;
                    const ez=this.pos.z-o.pos.z;
                    const e2=ex*ex+ez*ez;
                    const rr=(d.radius+o.def.radius)*1.2;
                    if (e2<rr*rr&&e2>1e-6) {
                        const e=Math.sqrt(e2);
                        this.wx+=ex/e*(1-e/rr)*1.5;
                        this.wz+=ez/e*(1-e/rr)*1.5;
                    }
                }
            }
            const wl=Math.hypot(this.wx,this.wz);
            if (wl>1) {
                this.wx/=wl;
                this.wz/=wl;
            }
            const k=Math.min(1,d.accel*dt);
            const sp=d.speed*slow;
            this.vel.x+=(this.wx*sp-this.vel.x)*k;
            this.vel.z+=(this.wz*sp-this.vel.z)*k;
        }
        const f=this.manual?slow:1;
        this.pos.x+=this.vel.x*dt*f;
        this.pos.z+=this.vel.z*dt*f;
        this.preX=this.pos.x;
        this.preZ=this.pos.z;
        if (!d.flying) {
            resolveCircle(this.pos,d.radius,this.colliders(ctx),2);
        }
        clampToBounds(this.pos,d.radius,ctx.room.bounds);
        const sp=Math.hypot(this.pos.x-this.prev.x,this.pos.z-this.prev.z)/dt;
        this.speedFrac=Math.min(1,sp/Math.max(0.1,d.speed));
        this.phase+=dt*9*this.speedFrac;
        if (this.spinning) {
            this.yaw=wrap(this.yaw+(d.spinSpeed||6)*dt);
        }
        else {
            this.yaw+=wrap(Math.atan2(this.aimX,this.aimZ)-this.yaw)*Math.min(1,10*dt);
        }
        this.sqv+=(-300*this.sq-12*this.sqv)*dt;
        this.sq+=this.sqv*dt;
        this.sq=Math.max(-0.45,Math.min(0.45,this.sq));
        this.kick*=Math.exp(-14*dt);
        if (this.state!=='spawn'&&this.stunT<=0&&!this.dummy&&this.canContact()&&this.dist<d.radius+TUNING.player.radius) {
            p.hurt(d.contactDamage,this.nx,this.nz);
        }
    }

    sync(alpha,dt) {
        const d=this.def;
        this.renderPos.lerpVectors(this.prev,this.pos,alpha);
        this.root.position.copy(this.renderPos);
        this.yawGroup.rotation.y=this.yaw+this.spin;
        if (this.flashT>0) {
            this.flashT-=dt;
        }
        const fl=this.flashT>0?1:0;
        const spawning=this.state==='spawn'&&!this.quick;
        const ry=spawning?Math.min(1,this.t/this.spawnTime)*d.height*1.05:100;
        for (const m of this.mats) {
            m.uniforms.uFlash.value=fl;
            m.uniforms.uRevealY.value=ry;
        }
        this.hull.uniforms.uColor.value.copy(pal(fl?'paper':(this.rage||this.evolved?'red':(this.elite?'darkRed':'ink'))));
        this.accent.visible=this.accentOn&&!spawning;
        if (this.accentOn) {
            this.accent.rotation.y=time.real*TUNING.accent.spin;
        }
        const hs=!spawning&&renderFlags.hulls;
        if (this.hullShown!==hs) {
            this.hullShown=hs;
            for (const h of this.hulls) {
                h.visible=this.hullShown;
            }
        }
        const tg=this.tele;
        for (const l of this.lines) {
            l.visible=false;
        }
        if (this.ring) {
            this.ring.visible=false;
        }
        if (tg) {
            const k=EASE.easeOutCubic(Math.min(1,tg.t/(tg.dur*0.7)));
            if (tg.type==='line') {
                const base=Math.atan2(tg.dz,tg.dx);
                for (let i=0;i<tg.count;i++) {
                    const a=tg.count>1?base+(i/(tg.count-1)-0.5)*tg.spread:base;
                    const ln=this.line(i);
                    const len=tg.len*k;
                    const cx=Math.cos(a);
                    const cz=Math.sin(a);
                    ln.visible=true;
                    ln.position.set(this.renderPos.x+cx*(d.radius+0.1),0.04,this.renderPos.z+cz*(d.radius+0.1));
                    ln.rotation.y=Math.atan2(-cz,cx);
                    ln.scale.set(Math.max(0.01,len),1,0.16);
                    ln.material.uniforms.uLength.value=len;
                }
            }
            else {
                const r=this.ringMesh();
                r.visible=true;
                r.position.set(tg.x??this.renderPos.x,0.05,tg.z??this.renderPos.z);
                r.scale.set(tg.r,1,tg.r);
                r.material.uniforms.uProgress.value=k;
                r.material.uniforms.uAlpha.value=1;
            }
        }
        const step=Math.floor(time.real*TUNING.player.poseFps);
        if (step!==this.poseStep) {
            this.poseStep=step;
            const ks=1-this.sq;
            const w=1/Math.sqrt(Math.max(0.3,ks));
            this.squash.scale.set(w,ks,w);
            this.pose(step);
        }
    }
}

class Doodle extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        this.legs=[];
        for (const sx of [-1,1]) {
            const p=new THREE.Group();
            p.position.set(sx*0.17,0.45,0);
            const leg=this.hullify(new THREE.Mesh(geo('leg',()=>capsule(0.11,0.22)),limb));
            leg.position.y=-0.22;
            p.add(leg);
            this.body.add(p);
            this.legs.push(p);
        }
        this.torso=this.hullify(new THREE.Mesh(geo('torso',()=>new THREE.BoxGeometry(0.62,0.62,0.44)),body));
        this.torso.position.y=0.8;
        this.body.add(this.torso);
        this.head=new THREE.Group();
        this.head.position.y=1.38;
        this.head.add(this.hullify(new THREE.Mesh(geo('skull',()=>new THREE.SphereGeometry(0.3,9,6)),head)));
        const helmet=this.hullify(new THREE.Mesh(geo('helmet',()=>new THREE.SphereGeometry(0.34,9,5,0,Math.PI*2,0,Math.PI*0.45)),body));
        helmet.position.y=0.04;
        this.head.add(helmet);
        const eg=geo('eye',()=>new THREE.BoxGeometry(0.16,0.035,0.04));
        for (const sx of [-1,1]) {
            for (const r of [0.8,-0.8]) {
                const e=new THREE.Mesh(eg,ink);
                e.position.set(sx*0.11,-0.02,0.28);
                e.rotation.z=r;
                this.head.add(e);
            }
        }
        this.body.add(this.head);
        this.arm=new THREE.Group();
        this.arm.position.set(0.38,0.95,0);
        const armMesh=this.hullify(new THREE.Mesh(geo('arm',()=>capsule(0.08,0.26)),limb));
        armMesh.position.y=-0.18;
        this.arm.add(armMesh);
        const gun=this.hullify(new THREE.Mesh(geo('gun',()=>new THREE.CylinderGeometry(0.07,0.07,0.42,6)),limb));
        gun.position.set(0,-0.4,0.12);
        gun.rotation.x=Math.PI/2;
        this.arm.add(gun);
        this.body.add(this.arm);
    }

    onReset() {
        const d=this.def;
        this.fireT=this.firstT(d.firstShot);
        this.strafeSign=rng.sign();
        this.strafeT=rng.range(1,3);
    }

    think(dt,ctx) {
        const d=this.def;
        if (this.state==='move') {
            let push=0;
            if (this.dist>d.range[1]) {
                push=1;
            }
            else if (this.dist<d.range[0]) {
                push=-1;
            }
            this.strafeT-=dt;
            if (this.strafeT<=0) {
                this.strafeT=rng.range(1.2,3);
                this.strafeSign=-this.strafeSign;
            }
            this.wx=this.nx*push-this.nz*this.strafeSign*d.strafe;
            this.wz=this.nz*push+this.nx*this.strafeSign*d.strafe;
            this.aimX=this.nx;
            this.aimZ=this.nz;
            this.fireT-=dt;
            if (this.fireT<=0) {
                this.setState('telegraph');
                const multi=(d.pellets||1)>1;
                this.teleLine(this.nx,this.nz,d.telegraphLength,d.telegraph,multi?3:1,multi?d.spread/2:0);
            }
        }
        else if (this.state==='telegraph') {
            const p=ctx.player;
            const tt=this.dist/d.bulletSpeed*d.lead;
            const lx=p.pos.x+p.vel.x*tt-this.pos.x;
            const lz=p.pos.z+p.vel.z*tt-this.pos.z;
            const ll=Math.hypot(lx,lz)||1;
            if (this.stateT<d.telegraph*0.6) {
                this.tele.dx=lx/ll;
                this.tele.dz=lz/ll;
            }
            this.aimX=this.tele.dx;
            this.aimZ=this.tele.dz;
            if (this.stateT>=d.telegraph) {
                this.fire(ctx);
                this.setState('move');
                this.fireT=this.paced('fire',d.fireInterval);
                this.tele=null;
            }
        }
    }

    fire(ctx) {
        const d=this.def;
        const s=d.scale;
        const c=Math.cos(this.yaw);
        const sn=Math.sin(this.yaw);
        const mx=this.pos.x+0.38*s*c+0.55*s*sn;
        const mz=this.pos.z-0.38*s*sn+0.55*s*c;
        const n=d.pellets||1;
        const base=Math.atan2(this.aimZ,this.aimX);
        const sp=d.bulletSpeed*(1+this.act*0.1);
        for (let i=0;i<n;i++) {
            const a=n>1?base+(i/(n-1)-0.5)*d.spread:base;
            ctx.enemyBullets.spawn(mx,mz,Math.cos(a),Math.sin(a),sp,d.bulletDamage,d.bulletLife);
        }
        ctx.muzzle.show(mx,TUNING.weapon.height,mz,'red',0.8);
        this.kick=1;
        this.sqv-=1.5;
    }

    pose() {
        const s=this.speedFrac||0;
        const sw=Math.sin(this.phase)*0.7*s;
        this.legs[0].rotation.x=sw;
        this.legs[1].rotation.x=-sw;
        this.body.position.y=Math.abs(Math.sin(this.phase))*0.06*s;
        const aiming=this.state==='telegraph'?1:0;
        this.arm.rotation.x=-0.5-aiming*0.95+this.kick*0.5;
        this.torso.rotation.z=Math.sin(this.phase*0.5)*0.08*s;
        this.head.rotation.x=aiming*-0.12;
    }
}

class Sprayer extends Doodle {
    buildBody() {
        super.buildBody();
        const limb=this.mat('limb');
        const body=this.mat('body');
        const mouth=this.hullify(new THREE.Mesh(geo('sprayMouth',()=>new THREE.CylinderGeometry(0.2,0.08,0.26,8,1,true)),limb));
        mouth.rotation.x=Math.PI/2;
        mouth.position.set(0,-0.4,0.44);
        this.arm.add(mouth);
        const brim=this.hullify(new THREE.Mesh(geo('sprayBrim',()=>new THREE.CylinderGeometry(0.46,0.46,0.05,10)),body));
        brim.position.y=0.14;
        this.head.add(brim);
        const top=this.hullify(new THREE.Mesh(geo('sprayTop',()=>new THREE.CylinderGeometry(0.24,0.28,0.24,10)),body));
        top.position.y=0.28;
        this.head.add(top);
    }
}

class Blob extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const ink=this.inkMat();
        this.blob=this.hullify(new THREE.Mesh(geo('blob',()=>new THREE.SphereGeometry(0.62,12,9)),body));
        this.blob.position.y=0.6;
        this.body.add(this.blob);
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('blobEye',()=>new THREE.SphereGeometry(0.13,8,6)),head);
            e.position.set(sx*0.22,0.78,0.5);
            this.body.add(e);
            const pu=new THREE.Mesh(geo('blobPupil',()=>new THREE.SphereGeometry(0.06,6,4)),ink);
            pu.position.set(sx*0.22,0.78,0.62);
            this.body.add(pu);
        }
        const drip=new THREE.Mesh(geo('blobDrip',()=>new THREE.SphereGeometry(0.16,8,6)),body);
        drip.position.set(0.3,0.9,-0.4);
        drip.scale.set(1,1.6,1);
        this.body.add(drip);
    }

    onReset() {
        const d=this.def;
        this.hopT=rng.range(d.hopWait[0],d.hopWait[1])+(this.quick?0.2:0);
        this.hopK=-1;
        this.lands=0;
        this.willShoot=false;
        this.hx=0;
        this.hz=1;
    }

    think(dt,ctx) {
        const d=this.def;
        this.manual=true;
        this.aimX=this.nx;
        this.aimZ=this.nz;
        if (this.hopK>=0) {
            this.hopK+=dt/d.hopTime;
            const v=d.hopDist/d.hopTime;
            this.vel.set(this.hx*v,0,this.hz*v);
            if (this.hopK>=1) {
                this.hopK=-1;
                this.vel.set(0,0,0);
                this.sqv+=3.5;
                this.lands++;
                this.hopT=rng.range(d.hopWait[0],d.hopWait[1]);
                if (this.willShoot) {
                    this.willShoot=false;
                    this.tele=null;
                    fireRing(ctx,this.pos.x,this.pos.z,d.ringCount,rng.range(0,1),d.bulletSpeed,d.bulletDamage,d.bulletLife);
                    ctx.particles.burst(this.pos.x,0.3,this.pos.z,8,{color:'ink',speed:[2,4],up:[1,3]});
                }
            }
            return;
        }
        this.vel.multiplyScalar(Math.exp(-10*dt));
        this.hopT-=dt;
        if (this.hopT<=0) {
            const a=Math.atan2(this.nz,this.nx)+rng.range(-0.45,0.45);
            this.hx=Math.cos(a);
            this.hz=Math.sin(a);
            this.hopK=0;
            this.sqv-=2.5;
            if (d.shootEvery&&(this.lands+1)%d.shootEvery===0) {
                this.willShoot=true;
                this.teleRing(1.9,d.hopTime);
            }
        }
    }

    pose() {
        const d=this.def;
        const k=this.hopK>=0?this.hopK:0;
        this.body.position.y=Math.sin(k*Math.PI)*d.hopHeight;
        const j=Math.sin(time.real*17)*0.05*Math.max(0,1-this.speedFrac);
        this.blob.scale.set(1+j,1-j,1+j);
    }
}

class Compass extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        this.hinge=new THREE.Group();
        this.hinge.position.y=2.05;
        const hc=this.hullify(new THREE.Mesh(geo('cHinge',()=>new THREE.CylinderGeometry(0.2,0.2,0.46,10)),head));
        hc.rotation.z=Math.PI/2;
        this.hinge.add(hc);
        const handle=this.hullify(new THREE.Mesh(geo('cHandle',()=>new THREE.CylinderGeometry(0.07,0.09,0.4,6)),limb));
        handle.position.y=0.36;
        this.hinge.add(handle);
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('cEye',()=>new THREE.BoxGeometry(0.1,0.03,0.03)),ink);
            e.position.set(sx*0.09,0.04,0.2);
            e.rotation.z=sx*0.5;
            this.hinge.add(e);
        }
        this.body.add(this.hinge);
        this.legs=[];
        for (const sx of [-1,1]) {
            const pv=new THREE.Group();
            pv.position.y=2.05;
            const leg=this.hullify(new THREE.Mesh(geo('cLeg',()=>new THREE.ConeGeometry(0.1,1.95,6)),body));
            leg.rotation.x=Math.PI;
            leg.position.y=-1.0;
            pv.add(leg);
            const tip=new THREE.Mesh(geo('cTip',()=>new THREE.ConeGeometry(0.05,0.2,6)),sx<0?ink:limb);
            tip.rotation.x=Math.PI;
            tip.position.y=-2.02;
            pv.add(tip);
            pv.rotation.z=sx*0.3;
            this.body.add(pv);
            this.legs.push(pv);
        }
    }

    onReset() {
        const d=this.def;
        this.fireT=this.firstT(d.firstShot);
        this.strafeSign=rng.sign();
        this.strafeT=rng.range(1,3);
        this.offset=rng.range(0,1);
        this.spinT=0;
    }

    think(dt,ctx) {
        const d=this.def;
        this.aimX=this.nx;
        this.aimZ=this.nz;
        this.spinT=Math.max(0,this.spinT-dt);
        if (this.spinT>0) {
            this.spinning=true;
        }
        if (this.state==='move') {
            let push=0;
            if (this.dist>d.range[1]) {
                push=1;
            }
            else if (this.dist<d.range[0]) {
                push=-1;
            }
            this.strafeT-=dt;
            if (this.strafeT<=0) {
                this.strafeT=rng.range(1.5,3.5);
                this.strafeSign=-this.strafeSign;
            }
            this.wx=this.nx*push-this.nz*this.strafeSign*d.strafe;
            this.wz=this.nz*push+this.nx*this.strafeSign*d.strafe;
            this.fireT-=dt;
            if (this.fireT<=0) {
                this.setState('telegraph');
                this.teleRing(d.ringRadius,d.telegraph);
            }
        }
        else if (this.state==='telegraph') {
            if (this.stateT>=d.telegraph) {
                this.offset+=0.13;
                fireRing(ctx,this.pos.x,this.pos.z,d.ringCount,this.offset,d.bulletSpeed,d.bulletDamage,d.bulletLife);
                ctx.muzzle.show(this.pos.x,TUNING.weapon.height,this.pos.z,'red',1.2);
                this.tele=null;
                this.spinT=0.6;
                this.sqv+=2;
                this.setState('move');
                this.fireT=this.paced('fire',d.fireInterval);
            }
        }
    }

    pose() {
        const s=this.speedFrac||0;
        const sw=Math.sin(this.phase*0.7)*0.35*s;
        this.legs[0].rotation.x=sw;
        this.legs[1].rotation.x=-sw;
        const open=this.state==='telegraph'?0.45:0.3;
        this.legs[0].rotation.z=-open;
        this.legs[1].rotation.z=open;
        this.hinge.rotation.x=this.state==='telegraph'?0.2:0;
    }
}

class EraserMonster extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        this.block=new THREE.Group();
        const a=this.hullify(new THREE.Mesh(geo('eBlock',()=>new THREE.BoxGeometry(1.1,0.8,1.0)),head));
        a.position.z=0.2;
        const b=this.hullify(new THREE.Mesh(geo('eSleeve',()=>new THREE.BoxGeometry(1.16,0.86,0.6)),body));
        b.position.z=-0.5;
        this.block.add(a,b);
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('eEye',()=>new THREE.BoxGeometry(0.26,0.06,0.04)),ink);
            e.position.set(sx*0.22,0.16,0.72);
            e.rotation.z=-sx*0.45;
            this.block.add(e);
        }
        const mouth=new THREE.Mesh(geo('eMouth',()=>new THREE.BoxGeometry(0.4,0.05,0.04)),ink);
        mouth.position.set(0,-0.12,0.72);
        this.block.add(mouth);
        this.block.position.y=0.78;
        this.body.add(this.block);
        this.legs=[];
        for (const [sx,sz] of [[-1,1],[1,1],[-1,-1],[1,-1]]) {
            const p=new THREE.Group();
            p.position.set(sx*0.36,0.4,sz*0.32);
            const l=this.hullify(new THREE.Mesh(geo('eLeg',()=>capsule(0.09,0.18)),limb));
            l.position.y=-0.18;
            p.add(l);
            this.body.add(p);
            this.legs.push(p);
        }
    }

    onReset() {
        const d=this.def;
        this.chargeCd=rng.range(d.chargeCd[0],d.chargeCd[1]);
        this.cx=0;
        this.cz=1;
        this.target=null;
    }

    colliders(ctx) {
        if (this.state!=='charge') {
            return ctx.room.colliders;
        }
        if (!this._cols) {
            this._cols=[];
        }
        this._cols.length=0;
        for (const c of ctx.room.colliders) {
            if (!(c.piece&&c.piece.kind==='pencilWall')) {
                this._cols.push(c);
            }
        }
        return this._cols;
    }

    pickTarget(ctx) {
        let best=null;
        let bd=14;
        for (const p of ctx.room.pieces) {
            if (p.kind!=='pencilWall'||p.state==='erasing') {
                continue;
            }
            for (const q of p.pts) {
                const d=Math.hypot(q.x-this.pos.x,q.z-this.pos.z);
                if (d<bd) {
                    bd=d;
                    best=q;
                }
            }
        }
        return best||ctx.player.pos;
    }

    think(dt,ctx) {
        const d=this.def;
        if (this.state==='move') {
            const tg=this.pickTarget(ctx);
            const dx=tg.x-this.pos.x;
            const dz=tg.z-this.pos.z;
            const l=Math.hypot(dx,dz)||1;
            this.wx=dx/l;
            this.wz=dz/l;
            this.aimX=this.wx;
            this.aimZ=this.wz;
            this.chargeCd-=dt;
            if (l<d.chargeRange&&this.chargeCd<=0) {
                this.cx=dx/l;
                this.cz=dz/l;
                this.setState('telegraph');
                this.teleLine(this.cx,this.cz,d.telegraphLength,d.telegraph);
            }
        }
        else if (this.state==='telegraph') {
            this.aimX=this.cx;
            this.aimZ=this.cz;
            this.sq=Math.min(0.3,this.sq+dt*0.6);
            if (this.stateT>=d.telegraph) {
                this.tele=null;
                this.setState('charge');
                this.stv=0;
                this.sqv-=4;
            }
        }
        else if (this.state==='charge') {
            this.manual=true;
            this.vel.set(this.cx*d.chargeSpeed,0,this.cz*d.chargeSpeed);
            for (const c of ctx.room.colliders) {
                if (c.piece&&c.piece.kind==='pencilWall'&&c.piece.state!=='erasing'&&circleVs(this.pos.x,this.pos.z,d.radius,c,hitTmp)) {
                    ctx.room.erasePiece(c.piece,this.pos.x,this.pos.z,0.35);
                    ctx.particles.burst(this.pos.x,0.8,this.pos.z,10,{color:'farGray',speed:[2,5],up:[2,4]});
                    ctx.fx.cameraShake(0.15);
                }
            }
            if (this.dist<d.radius+TUNING.player.radius+0.1) {
                ctx.player.hurt(d.chargeDamage,this.cx,this.cz);
                this.endCharge();
                return;
            }
            if (this.stateT>0.05&&this.speedFrac<0.5&&this.stateT>0.15) {
                this.setState('stun');
                this.vel.set(0,0,0);
                this.sqv+=4;
                ctx.fx.cameraShake(0.2);
                ctx.particles.burst(this.pos.x+this.cx*0.8,0.8,this.pos.z+this.cz*0.8,8,{color:'midGray',speed:[2,4],up:[2,4]});
                return;
            }
            if (this.stateT>=d.chargeTime) {
                this.endCharge();
            }
        }
        else if (this.state==='stun') {
            this.vel.multiplyScalar(Math.exp(-8*dt));
            if (this.stateT>=d.stunTime) {
                this.endCharge();
            }
        }
    }

    endCharge() {
        const d=this.def;
        this.setState('move');
        this.chargeCd=rng.range(d.chargeCd[0],d.chargeCd[1]);
    }

    pose() {
        const s=this.state==='charge'?1:(this.speedFrac||0);
        const f=this.state==='charge'?2:1;
        for (let i=0;i<4;i++) {
            this.legs[i].rotation.x=Math.sin(this.phase*f+(i%2?Math.PI:0))*0.8*s;
        }
        this.block.rotation.x=this.state==='charge'?0.25:(this.state==='telegraph'?-0.15:0);
        this.block.rotation.z=this.state==='stun'?Math.sin(time.real*20)*0.2:0;
        this.block.position.y=0.78+Math.abs(Math.sin(this.phase))*0.05*s;
    }
}

function triGeo(pts) {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
    g.computeVertexNormals();
    return g;
}

class Bird extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        body.side=THREE.DoubleSide;
        head.side=THREE.DoubleSide;
        this.fly=new THREE.Group();
        this.fly.position.y=this.def.flyHeight;
        const coreGeo=()=>{
            const g=new THREE.ConeGeometry(0.28,1.3,4);
            g.rotateX(Math.PI/2);
            g.scale(1,0.55,1);
            return g;
        };
        const core=this.hullify(new THREE.Mesh(geo('bCore',coreGeo),body));
        this.fly.add(core);
        const neck=new THREE.Mesh(geo('bNeck',()=>new THREE.ConeGeometry(0.08,0.8,4)),head);
        neck.position.set(0,0.3,0.6);
        neck.rotation.x=0.6;
        this.fly.add(neck);
        const tail=new THREE.Mesh(geo('bTail',()=>new THREE.ConeGeometry(0.08,0.7,4)),head);
        tail.position.set(0,0.25,-0.6);
        tail.rotation.x=-0.7;
        this.fly.add(tail);
        this.wings=[];
        for (const sx of [-1,1]) {
            const pv=new THREE.Group();
            pv.position.set(sx*0.12,0.05,0);
            const w=new THREE.Mesh(geo('bWing'+sx,()=>triGeo([0,0,0.45,sx*1.3,0,-0.1,0,0,-0.45])),head);
            pv.add(w);
            this.fly.add(pv);
            this.wings.push(pv);
        }
        this.body.add(this.fly);
    }

    onReset() {
        const d=this.def;
        this.swoopT=this.paced('swoop',d.swoopEvery);
        this.orbitA=rng.range(0,Math.PI*2);
        this.orbitDir=rng.sign();
        this.sx=0;
        this.sz=1;
    }

    canContact() {
        return this.state==='swoop';
    }

    think(dt,ctx) {
        const d=this.def;
        const p=ctx.player.pos;
        if (this.state==='move') {
            this.orbitA+=dt*0.7*this.orbitDir;
            const wob=Math.sin(this.t*d.wobbleFreq)*d.wobble;
            const tx=p.x+Math.cos(this.orbitA)*(d.orbit+wob);
            const tz=p.z+Math.sin(this.orbitA)*(d.orbit+wob);
            const dx=tx-this.pos.x;
            const dz=tz-this.pos.z;
            const l=Math.hypot(dx,dz)||1;
            this.wx=dx/l*Math.min(1,l/2);
            this.wz=dz/l*Math.min(1,l/2);
            const vl=Math.hypot(this.vel.x,this.vel.z);
            if (vl>0.5) {
                this.aimX=this.vel.x/vl;
                this.aimZ=this.vel.z/vl;
            }
            this.swoopT-=dt;
            if (this.swoopT<=0) {
                this.sx=this.nx;
                this.sz=this.nz;
                this.setState('telegraph');
                this.teleLine(this.sx,this.sz,d.telegraphLength,d.telegraph);
            }
        }
        else if (this.state==='telegraph') {
            this.aimX=this.sx;
            this.aimZ=this.sz;
            this.vel.multiplyScalar(Math.exp(-6*dt));
            this.manual=true;
            if (this.stateT>=d.telegraph) {
                this.tele=null;
                this.setState('swoop');
            }
        }
        else if (this.state==='swoop') {
            this.manual=true;
            this.vel.set(this.sx*d.swoopSpeed,0,this.sz*d.swoopSpeed);
            if (this.stateT>=d.swoopTime) {
                this.setState('move');
                this.swoopT=this.paced('swoop',d.swoopEvery);
                this.orbitA=Math.atan2(this.pos.z-p.z,this.pos.x-p.x);
            }
        }
    }

    pose(step) {
        const flap=(step%2===0?1:-1)*(this.state==='swoop'?0.25:0.85);
        this.wings[0].rotation.z=flap;
        this.wings[1].rotation.z=-flap;
        const dive=this.state==='swoop'?-1.0:(this.state==='telegraph'?0.3:0);
        this.fly.position.y=this.def.flyHeight+Math.sin(time.real*3+this.phase)*0.2+dive;
        this.fly.rotation.x=this.state==='swoop'?0.35:0;
    }
}

function dripGeo() {
    const g=new THREE.ConeGeometry(0.09,0.3,6);
    g.rotateX(Math.PI);
    return g;
}

class InkCloud extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const ink=this.inkMat();
        this.fly=new THREE.Group();
        this.fly.position.y=this.def.flyHeight;
        this.puffs=[];
        for (const [x,y,z,r] of [[0,0.1,0,0.62],[-0.55,-0.05,0.05,0.45],[0.55,-0.02,-0.05,0.48],[0.2,0.4,-0.1,0.42],[-0.25,0.3,0.2,0.36]]) {
            const m=this.hullify(new THREE.Mesh(geo('cloudPuff',()=>new THREE.SphereGeometry(1,10,7)),body));
            m.position.set(x,y,z);
            m.scale.setScalar(r);
            this.fly.add(m);
            this.puffs.push({m,r});
        }
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('cloudEye',()=>new THREE.SphereGeometry(0.1,7,5)),head);
            e.position.set(sx*0.2,0.12,0.58);
            this.fly.add(e);
            const pu=new THREE.Mesh(geo('cloudPupil',()=>new THREE.SphereGeometry(0.05,6,4)),ink);
            pu.position.set(sx*0.2,0.1,0.66);
            this.fly.add(pu);
        }
        this.dripMeshes=[];
        for (const [x,z] of [[-0.35,0.1],[0.1,-0.15],[0.45,0.15]]) {
            const dr=new THREE.Mesh(geo('cloudDrip',dripGeo),ink);
            dr.position.set(x,-0.5,z);
            this.fly.add(dr);
            this.dripMeshes.push(dr);
        }
        this.body.add(this.fly);
    }

    onReset() {
        const d=this.def;
        this.castT=this.firstT(d.firstCast);
        this.driftSign=rng.sign();
        this.driftT=rng.range(1.5,3);
        this.drops=[];
    }

    canContact() {
        return false;
    }

    hide() {
        super.hide();
        this.drops=[];
    }

    cast(ctx) {
        const d=this.def;
        const p=ctx.player;
        const n=d.drops+(this.elite?d.eliteDrops:0);
        for (let i=0;i<n;i++) {
            const x=p.pos.x+(i===0?p.vel.x*d.dropLead:rng.range(-d.dropSpread,d.dropSpread));
            const z=p.pos.z+(i===0?p.vel.z*d.dropLead:rng.range(-d.dropSpread,d.dropSpread)*0.8);
            const t=d.dropDelay+i*d.dropStagger;
            this.drops.push({x,z,t});
            ctx.dangerRings.spawn(x,z,d.ringRadius,'red',t);
        }
        this.sqv-=2.5;
    }

    think(dt,ctx) {
        const d=this.def;
        this.aimX=this.nx;
        this.aimZ=this.nz;
        for (let i=this.drops.length-1;i>=0;i--) {
            const q=this.drops[i];
            q.t-=dt;
            if (q.t<=0) {
                this.drops.splice(i,1);
                if (Math.hypot(ctx.player.pos.x-q.x,ctx.player.pos.z-q.z)<d.hitRadius) {
                    ctx.player.hurt(d.dropDamage,0,1);
                }
                if (ctx.onInkDrop) {
                    ctx.onInkDrop(q.x,q.z,d.puddleRadius,d.puddleTime,d.puddleSlow);
                }
            }
        }
        if (this.state==='move') {
            let push=0;
            if (this.dist>d.range[1]) {
                push=1;
            }
            else if (this.dist<d.range[0]) {
                push=-1;
            }
            this.driftT-=dt;
            if (this.driftT<=0) {
                this.driftT=rng.range(1.5,3);
                this.driftSign=-this.driftSign;
            }
            this.wx=this.nx*push-this.nz*this.driftSign*d.drift;
            this.wz=this.nz*push+this.nx*this.driftSign*d.drift;
            this.castT-=dt;
            if (this.castT<=0) {
                this.setState('telegraph');
            }
        }
        else if (this.state==='telegraph') {
            this.vel.multiplyScalar(Math.exp(-6*dt));
            this.manual=true;
            if (this.stateT>=d.telegraph) {
                this.cast(ctx);
                this.setState('move');
                this.castT=this.paced('cast',d.castEvery);
            }
        }
    }

    pose() {
        const d=this.def;
        const tg=this.state==='telegraph'?Math.min(1,this.stateT/d.telegraph):0;
        this.fly.position.y=d.flyHeight+Math.sin(time.real*2.2+this.phase)*0.18+tg*0.25;
        for (let i=0;i<this.puffs.length;i++) {
            const q=this.puffs[i];
            q.m.scale.setScalar(q.r*(1+tg*0.18+Math.sin(time.real*3+i*1.7)*0.04));
        }
        for (let i=0;i<this.dripMeshes.length;i++) {
            const dr=this.dripMeshes[i];
            dr.position.y=-0.5-((time.real*0.9+i*0.33)%1)*0.4*(1+tg);
        }
    }
}

class InkBottle extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        const main=this.hullify(new THREE.Mesh(geo('ibBody',()=>new THREE.CylinderGeometry(1.5,1.62,3.0,10)),body));
        main.position.y=1.5;
        this.body.add(main);
        const shoulder=this.hullify(new THREE.Mesh(geo('ibShoulder',()=>new THREE.CylinderGeometry(0.7,1.5,0.7,10)),body));
        shoulder.position.y=3.35;
        this.body.add(shoulder);
        const neck=this.hullify(new THREE.Mesh(geo('ibNeck',()=>new THREE.CylinderGeometry(0.62,0.66,0.6,10)),body));
        neck.position.y=3.95;
        this.body.add(neck);
        this.cap=this.hullify(new THREE.Mesh(geo('ibCap',()=>new THREE.CylinderGeometry(0.78,0.78,0.55,10)),limb));
        this.cap.position.y=4.5;
        this.body.add(this.cap);
        const label=new THREE.Mesh(geo('ibLabel',()=>new THREE.CylinderGeometry(1.55,1.64,1.3,10,1,true)),head);
        label.position.y=1.6;
        this.body.add(label);
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('ibEye',()=>new THREE.BoxGeometry(0.5,0.1,0.06)),ink);
            e.position.set(sx*0.38,1.85,1.63);
            e.rotation.z=-sx*0.35;
            this.body.add(e);
            const p=new THREE.Mesh(geo('ibPupil',()=>new THREE.SphereGeometry(0.1,6,4)),ink);
            p.position.set(sx*0.36,1.62,1.63);
            this.body.add(p);
        }
        for (let i=0;i<4;i++) {
            const a=0.6+i*1.3;
            const d=new THREE.Mesh(geo('ibDrip',()=>new THREE.SphereGeometry(0.16,8,6)),limb);
            d.position.set(Math.sin(a)*1.52,2.6-i*0.35,Math.cos(a)*1.52);
            d.scale.set(1,2.4,1);
            this.body.add(d);
        }
        const crack=new THREE.Shape();
        const r=new RNG(5);
        for (let i=0;i<14;i++) {
            const a=i/14*Math.PI*2;
            const rr=i%2?0.22:r.range(0.45,0.7);
            if (i===0) {
                crack.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);
            }
            else {
                crack.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);
            }
        }
        this.weak=new THREE.Mesh(new THREE.ShapeGeometry(crack),unlitMaterial({color:'red'}));
        this.weak.position.set(0,1.6,-1.66);
        this.weak.rotation.y=Math.PI;
        this.body.add(this.weak);
    }

    onReset(o) {
        this.act=o.act||0;
        this.patternT=1.6;
        this.pattern=null;
        this.spiralA=0;
        this.volley=0;
        this.fireAcc=0;
        this.summonT=10;
        this.weak.visible=false;
    }

    phaseIndex() {
        return this.evolved?2:(this.hp/this.maxHp>0.75?0:1);
    }

    teleRoll(first) {
        const R=this.def.roll;
        this.setState('telegraph');
        this.teleLine(this.nx,this.nz,14,first?R.tele:R.tele2);
        this.rx=this.nx;
        this.rz=this.nz;
    }

    damageMult(x,z) {
        const d=this.def;
        const dx=x-this.pos.x;
        const dz=z-this.pos.z;
        const l=Math.hypot(dx,dz)||1;
        const wx=-Math.sin(this.yaw);
        const wz=-Math.cos(this.yaw);
        return (dx*wx+dz*wz)/l>Math.cos(d.weakAngle)?d.weakMult:1;
    }

    canContact() {
        return true;
    }

    choose() {
        const ph=this.phaseIndex();
        const list=ph===0?['spiral','fan','spill']:(ph===1?['spiral','fan','ring','spill','summon']:['spiral','ring','fan','spill','roll','roll']);
        let p=list[Math.floor(rng.next()*list.length)];
        if (p===this.last&&list.length>1) {
            p=list[(list.indexOf(p)+1)%list.length];
        }
        this.last=p;
        return p;
    }

    think(dt,ctx) {
        const d=this.def;
        const ph=this.phaseIndex();
        this.spinning=true;
        this.weak.visible=true;
        if (this.pattern==='roll'&&this.state!=='move') {
            this.thinkRoll(dt,ctx);
            return;
        }
        const cx=-this.pos.x;
        const cz=-this.pos.z;
        const cl=Math.hypot(cx,cz);
        if (cl>2) {
            this.wx=cx/cl*0.5;
            this.wz=cz/cl*0.5;
        }
        if (this.state==='move') {
            this.patternT-=dt*(1+ph*d.phaseRush);
            if (this.patternT<=0) {
                this.pattern=this.choose();
                this.setState('telegraph');
                if (this.pattern==='roll') {
                    this.rolls=0;
                    this.teleRoll(true);
                }
                else if (this.pattern==='fan') {
                    this.teleLine(this.nx,this.nz,10,0.55,3,0.9);
                }
                else if (this.pattern==='spill') {
                    this.teleRing(2.6,0.35);
                }
                else {
                    this.teleRing(3.0,0.65);
                }
            }
            return;
        }
        if (this.state==='telegraph') {
            if (this.stateT>=this.tele.dur) {
                this.tele=null;
                this.setState('attack');
                this.volley=0;
                this.fireAcc=0;
                this.sqv+=2;
            }
            return;
        }
        if (this.state==='attack') {
            const sp=d.bulletSpeed*(1+ph*0.12);
            const px=this.pos.x;
            const pz=this.pos.z;
            if (this.pattern==='spiral') {
                this.fireAcc+=dt;
                const arms=ph>=2?3:2;
                while (this.fireAcc>=d.spiralRate) {
                    this.fireAcc-=d.spiralRate;
                    for (let i=0;i<arms;i++) {
                        const a=this.spiralA+i/arms*Math.PI*2;
                        ctx.enemyBullets.spawn(px+Math.cos(a)*1.8,pz+Math.sin(a)*1.8,Math.cos(a),Math.sin(a),sp,d.bulletDamage,d.bulletLife);
                    }
                    this.spiralA+=0.22;
                }
                if (this.stateT>=d.spiralTime) {
                    this.finish();
                }
            }
            else if (this.pattern==='fan') {
                this.fireAcc+=dt;
                if (this.fireAcc>=d.fanRate||this.volley===0) {
                    this.fireAcc=0;
                    const base=Math.atan2(this.nz,this.nx);
                    const n=ph>=1?9:7;
                    for (let i=0;i<n;i++) {
                        const a=base+(i/(n-1)-0.5)*0.9;
                        ctx.enemyBullets.spawn(px+Math.cos(a)*1.8,pz+Math.sin(a)*1.8,Math.cos(a),Math.sin(a),sp*1.2,d.bulletDamage,d.bulletLife);
                    }
                    ctx.muzzle.show(px+this.nx*1.8,1.6,pz+this.nz*1.8,'red',1.6);
                    this.volley++;
                    this.kick=1;
                    if (this.volley>=3) {
                        this.finish();
                    }
                }
            }
            else if (this.pattern==='ring') {
                this.fireAcc+=dt;
                if (this.fireAcc>=0.35||this.volley===0) {
                    this.fireAcc=0;
                    fireRing(ctx,px,pz,22,this.volley*0.14,sp*0.85,d.bulletDamage,d.bulletLife);
                    this.volley++;
                    this.sqv+=1.5;
                    if (this.volley>=(ph>=2?3:2)) {
                        this.finish();
                    }
                }
            }
            else if (this.pattern==='spill') {
                const pp=ctx.player.pos;
                const n=ph>=1?4:3;
                for (let i=0;i<n;i++) {
                    const tx=pp.x+(i===0?0:rng.range(-3.5,3.5));
                    const tz=pp.z+(i===0?0:rng.range(-3.5,3.5));
                    ctx.lobs.launch(px,pz,tx,tz,0.8+i*0.12,4.5,(lx,lz)=>ctx.onPuddle(lx,lz,d.puddleRadius,d.puddleTime,d.puddleSlow));
                }
                this.cap.position.y=4.9;
                this.finish();
            }
            else if (this.pattern==='summon') {
                this.summonWave(ctx,[-1,1].map(sx=>['blob',px+sx*2.6,pz+1.5,{hpMult:1,quick:false}]));
                this.finish();
            }
        }
    }

    thinkRoll(dt,ctx) {
        const R=this.def.roll;
        const p=ctx.player;
        this.spinning=false;
        this.manual=true;
        if (this.state==='telegraph') {
            this.vel.multiplyScalar(Math.exp(-8*dt));
            if (this.stateT<this.tele.dur*0.6) {
                this.rx=this.nx;
                this.rz=this.nz;
                this.tele.dx=this.rx;
                this.tele.dz=this.rz;
            }
            this.aimX=this.rx;
            this.aimZ=this.rz;
            if (this.stateT>=this.tele.dur) {
                this.tele=null;
                this.setState('attack');
                this.dropT=0;
                this.rollHit=false;
            }
            return;
        }
        if (this.state==='attack') {
            this.aimX=this.rx;
            this.aimZ=this.rz;
            this.vel.set(this.rx*R.speed,0,this.rz*R.speed);
            this.dropT-=dt;
            if (this.dropT<=0) {
                this.dropT=R.drop;
                ctx.onPuddle(this.pos.x-this.rx*1.6,this.pos.z-this.rz*1.6,R.dropR,R.dropTime,this.def.puddleSlow);
            }
            const blocked=this.stateT>0.2&&this.speedFrac<0.3;
            if (blocked||this.stateT>=R.time) {
                this.rolls++;
                ctx.fx.cameraShake(blocked?0.4:0.15);
                if (this.rolls<R.count) {
                    this.teleRoll(false);
                }
                else {
                    this.vel.set(0,0,0);
                    this.setState('dizzy');
                }
            }
            return;
        }
        if (this.state==='dizzy') {
            this.vel.multiplyScalar(Math.exp(-10*dt));
            if (this.stateT>=R.dizzy) {
                this.finish();
            }
        }
    }

    finish() {
        this.setState('move');
        this.patternT=rng.range(this.def.patternGap[0],this.def.patternGap[1]);
    }

    pose() {
        const roll=this.pattern==='roll'&&(this.state==='attack'||this.state==='dizzy');
        this.tilt=(this.tilt||0)+((roll?1:0)-(this.tilt||0))*0.35;
        this.rollSpin=(this.rollSpin||0)+(this.state==='attack'&&roll?0.5:0);
        this.body.rotation.set(0,this.rollSpin,this.tilt*Math.PI/2,'ZYX');
        this.body.position.x=this.tilt*2.2;
        this.body.position.y=Math.sin(time.real*2)*0.05+this.tilt*1.6;
        const pulse=1+Math.sin(time.real*7)*0.15;
        this.weak.scale.set(pulse,pulse,1);
        this.cap.position.y+=(4.5-this.cap.position.y)*0.4;
    }
}

function bladeGeo() {
    const q=new THREE.CylinderGeometry(0.02,0.42,3.4,4);
    q.rotateX(Math.PI/2);
    q.scale(1,0.28,1);
    return q;
}

class Scissors extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        this.hover=new THREE.Group();
        this.hover.position.y=1.5;
        this.blades=[];
        for (const side of [-1,1]) {
            const g=new THREE.Group();
            const blade=this.hullify(new THREE.Mesh(geo('scBlade',bladeGeo),side<0?head:body));
            blade.position.z=1.55;
            g.add(blade);
            const handle=this.hullify(new THREE.Mesh(geo('scHandle',()=>new THREE.TorusGeometry(0.55,0.15,6,12)),limb));
            handle.rotation.x=Math.PI/2;
            handle.position.set(side*0.25,0,-1.05);
            g.add(handle);
            this.hover.add(g);
            this.blades.push(g);
        }
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('scEye',()=>new THREE.BoxGeometry(0.3,0.06,0.05)),ink);
            e.position.set(sx*0.28,0.28,0.35);
            e.rotation.z=-sx*0.4;
            this.hover.add(e);
        }
        this.screw=new THREE.Mesh(geo('scScrew',()=>new THREE.CylinderGeometry(0.3,0.3,0.36,10)),unlitMaterial({color:'red'}));
        this.screw.position.y=0.2;
        this.hover.add(this.screw);
        this.body.add(this.hover);
    }

    onReset() {
        this.patternT=1.8;
        this.pattern=null;
        this.dashes=0;
        this.dx=0;
        this.dz=1;
        this.trailT=0;
        this.volley=0;
        this.fireAcc=0;
        this.spiralA=0;
    }

    damageMult() {
        return this.state==='stuck'?this.def.weakMult:1;
    }

    phase2() {
        return this.evolved;
    }

    choose() {
        const list=this.phase2()?['dash','snip','orbit','dash','orbit']:['dash','snip','spin'];
        let p=list[Math.floor(rng.next()*list.length)];
        if (p===this.last) {
            p=list[(list.indexOf(p)+1)%list.length];
        }
        this.last=p;
        return p;
    }

    teleDash() {
        this.trailN=0;
        this.dx=this.nx;
        this.dz=this.nz;
        this.setState('telegraph');
        this.teleLine(this.dx,this.dz,16,this.dashes>0?0.45:0.75);
    }

    think(dt,ctx) {
        const d=this.def;
        const p=ctx.player;
        if (this.state==='move') {
            this.aimX=this.nx;
            this.aimZ=this.nz;
            const want=this.dist>7?1:(this.dist<4?-1:0);
            this.wx=this.nx*want-this.nz*0.5;
            this.wz=this.nz*want+this.nx*0.5;
            this.patternT-=dt*(this.phase2()?1.35:1);
            if (this.patternT<=0) {
                this.pattern=this.choose();
                this.dashes=0;
                if (this.pattern==='dash') {
                    this.teleDash();
                }
                else {
                    this.setState('telegraph');
                    this.teleRing(this.pattern==='spin'?3.4:2.6,this.pattern==='orbit'?d.orbit.tele:0.6);
                    this.orbA=Math.atan2(this.pos.z-p.pos.z,this.pos.x-p.pos.x);
                    this.orbDir=rng.sign();
                }
            }
            return;
        }
        if (this.state==='telegraph') {
            this.manual=true;
            this.vel.multiplyScalar(Math.exp(-6*dt));
            if (this.pattern==='dash') {
                if (this.stateT<this.tele.dur*0.55) {
                    const tt=this.dist/d.dashSpeed*0.5;
                    const lx=p.pos.x+p.vel.x*tt-this.pos.x;
                    const lz=p.pos.z+p.vel.z*tt-this.pos.z;
                    const ll=Math.hypot(lx,lz)||1;
                    this.dx=lx/ll;
                    this.dz=lz/ll;
                    this.tele.dx=this.dx;
                    this.tele.dz=this.dz;
                }
                this.aimX=this.dx;
                this.aimZ=this.dz;
            }
            if (this.stateT>=this.tele.dur) {
                this.tele=null;
                this.setState('attack');
                this.volley=0;
                this.fireAcc=0;
                this.trailT=0;
            }
            return;
        }
        if (this.state==='attack') {
            const sp=d.bulletSpeed*(this.phase2()?1.15:1);
            if (this.pattern==='dash') {
                this.manual=true;
                this.vel.set(this.dx*d.dashSpeed,0,this.dz*d.dashSpeed);
                this.trailT-=dt;
                if (this.trailT<=0) {
                    const T=d.trail;
                    this.trailT=T.every;
                    this.trailN=(this.trailN||0)+1;
                    const side=this.trailN%2?1:-1;
                    const i=ctx.enemyBullets.spawn(this.pos.x,this.pos.z,0,0,0,d.bulletDamage,T.linger+T.life);
                    ctx.enemyBullets.delay(i,T.linger+this.trailN*T.stagger,-this.dz*side*T.speed,this.dx*side*T.speed);
                }
                if (this.dist<d.radius+TUNING.player.radius+0.2) {
                    p.hurt(2,this.dx,this.dz);
                }
                const blocked=this.stateT>0.18&&this.speedFrac<0.35;
                if (blocked||this.stateT>=d.dashTime) {
                    if (blocked) {
                        ctx.fx.cameraShake(0.4);
                        ctx.particles.burst(this.pos.x+this.dx,1,this.pos.z+this.dz,12,{color:'midGray',speed:[2,6],up:[2,5]});
                    }
                    if (this.phase2()&&this.dashes<2) {
                        this.dashes++;
                        this.teleDash();
                    }
                    else {
                        this.vel.set(0,0,0);
                        this.setState('stuck');
                        this.sqv+=4;
                    }
                }
            }
            else if (this.pattern==='snip') {
                this.aimX=this.nx;
                this.aimZ=this.nz;
                this.fireAcc+=dt;
                if (this.fireAcc>=0.38||this.volley===0) {
                    this.fireAcc=0;
                    const base=Math.atan2(this.nz,this.nx)+Math.PI/4+this.volley*0.22;
                    for (let q=0;q<4;q++) {
                        for (let k=-1;k<=1;k++) {
                            const a=base+q*Math.PI/2+k*0.12;
                            ctx.enemyBullets.spawn(this.pos.x,this.pos.z,Math.cos(a),Math.sin(a),sp,d.bulletDamage,d.bulletLife);
                        }
                    }
                    this.kick=1;
                    this.volley++;
                    if (this.volley>=(this.phase2()?5:4)) {
                        this.finish();
                    }
                }
            }
            else if (this.pattern==='orbit') {
                const O=d.orbit;
                this.manual=true;
                this.orbA+=this.orbDir*O.turn*dt;
                const tx=p.pos.x+Math.cos(this.orbA)*O.r-this.pos.x;
                const tz=p.pos.z+Math.sin(this.orbA)*O.r-this.pos.z;
                const tl=Math.hypot(tx,tz)||1;
                const v=Math.min(O.speed,tl*6);
                this.vel.set(tx/tl*v,0,tz/tl*v);
                this.aimX=this.nx;
                this.aimZ=this.nz;
                this.fireAcc+=dt;
                if (this.fireAcc>=O.every) {
                    this.fireAcc=0;
                    const base=Math.atan2(this.nz,this.nx);
                    for (let i=0;i<O.count;i++) {
                        const a=base+(i/(O.count-1)-0.5)*O.spread;
                        ctx.enemyBullets.spawn(this.pos.x,this.pos.z,Math.cos(a),Math.sin(a),sp,d.bulletDamage,d.bulletLife);
                    }
                    this.kick=1;
                }
                if (this.stateT>=O.time) {
                    this.finish();
                }
            }
            else if (this.pattern==='spin') {
                this.spinning=true;
                this.manual=true;
                this.vel.set(this.nx*2.5,0,this.nz*2.5);
                this.fireAcc+=dt;
                while (this.fireAcc>=0.09) {
                    this.fireAcc-=0.09;
                    for (let k=0;k<2;k++) {
                        const a=this.spiralA+k*Math.PI;
                        ctx.enemyBullets.spawn(this.pos.x,this.pos.z,Math.cos(a),Math.sin(a),sp*0.9,d.bulletDamage,d.bulletLife);
                    }
                    this.spiralA+=0.31;
                }
                if (this.stateT>=2.4) {
                    this.finish();
                }
            }
            return;
        }
        if (this.state==='stuck') {
            this.manual=true;
            this.vel.multiplyScalar(Math.exp(-10*dt));
            if (this.stateT>=d.stuckTime) {
                this.finish();
            }
        }
    }

    finish() {
        this.setState('move');
        this.patternT=rng.range(0.6,1.1);
    }

    pose() {
        let open=0.3;
        if (this.state==='telegraph') {
            open=this.pattern==='dash'?0.08:0.6;
        }
        else if (this.state==='attack') {
            open=this.pattern==='dash'?0.02:(this.pattern==='snip'?0.35+Math.sin(time.real*25)*0.3:0.5);
        }
        else if (this.state==='stuck') {
            open=0.7;
        }
        this.blades[0].rotation.y=open;
        this.blades[1].rotation.y=-open;
        this.hover.position.y=1.5+Math.sin(time.real*2.5)*0.12;
        this.hover.rotation.z=this.state==='stuck'?Math.sin(time.real*18)*0.25:0;
        this.hover.rotation.x=this.state==='stuck'?0.35:0;
        const pulse=this.state==='stuck'?1.3+Math.sin(time.real*16)*0.25:1;
        this.screw.scale.set(pulse,1,pulse);
    }
}

const NO_COLS=[];

class StampSoldier extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        this.lift=new THREE.Group();
        this.body.add(this.lift);
        this.legs=[];
        for (const sx of [-1,1]) {
            const p=new THREE.Group();
            p.position.set(sx*0.26,0.42,0);
            const leg=this.hullify(new THREE.Mesh(geo('stLeg',()=>capsule(0.1,0.2)),limb));
            leg.position.y=-0.2;
            p.add(leg);
            this.lift.add(p);
            this.legs.push(p);
        }
        const pad=new THREE.Mesh(geo('stPad',()=>new THREE.BoxGeometry(1.08,0.12,0.84)),ink);
        pad.position.y=0.5;
        this.lift.add(pad);
        this.block=this.hullify(new THREE.Mesh(geo('stBlock',()=>new THREE.BoxGeometry(1.12,0.5,0.88)),head));
        this.block.position.y=0.8;
        this.lift.add(this.block);
        const handle=this.hullify(new THREE.Mesh(geo('stHandle',()=>new THREE.CylinderGeometry(0.18,0.26,0.62,8)),body));
        handle.position.y=1.36;
        this.lift.add(handle);
        const knob=this.hullify(new THREE.Mesh(geo('stKnob',()=>new THREE.SphereGeometry(0.34,9,6)),body));
        knob.position.y=1.8;
        this.lift.add(knob);
        const eg=geo('stEye',()=>new THREE.BoxGeometry(0.24,0.06,0.04));
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(eg,ink);
            e.position.set(sx*0.22,0.86,0.45);
            e.rotation.z=-sx*0.35;
            this.lift.add(e);
        }
        this.hopY=0;
    }

    onReset() {
        const d=this.def;
        this.stampT=this.firstT(d.firstStamp);
        this.strafeSign=rng.sign();
        this.hops=0;
        this.hopY=0;
        this.sx=0;
        this.sz=0;
        this.tx=0;
        this.tz=0;
    }

    colliders(ctx) {
        return this.state==='attack'?NO_COLS:ctx.room.colliders;
    }

    canContact() {
        return this.state!=='attack';
    }

    startStamp(ctx) {
        const d=this.def;
        const p=ctx.player;
        let tx=p.pos.x+p.vel.x*d.lead;
        let tz=p.pos.z+p.vel.z*d.lead;
        let dx=tx-this.pos.x;
        let dz=tz-this.pos.z;
        const l=Math.hypot(dx,dz)||1;
        if (l>d.jumpRange) {
            tx=this.pos.x+dx/l*d.jumpRange;
            tz=this.pos.z+dz/l*d.jumpRange;
        }
        const b=ctx.room.bounds;
        this.tx=Math.max(b.minX+d.radius,Math.min(b.maxX-d.radius,tx));
        this.tz=Math.max(b.minZ+d.radius,Math.min(b.maxZ-d.radius,tz));
        this.hops++;
        this.setState('telegraph');
        this.tele={type:'ring',r:d.stampRadius,dur:d.crouch+d.jumpTime,t:0,x:this.tx,z:this.tz};
        this.sqv-=3;
    }

    land(ctx) {
        const d=this.def;
        const p=ctx.player;
        this.hopY=0;
        this.tele=null;
        this.vel.set(0,0,0);
        this.sqv+=5;
        ctx.fx.cameraShake(0.22);
        if (ctx.onStampPrint) {
            ctx.onStampPrint(this.pos.x,this.pos.z,d.stampRadius,d.puddleTime,d.puddleFade,d.puddleSlow);
        }
        const px=p.pos.x-this.pos.x;
        const pz=p.pos.z-this.pos.z;
        const pl=Math.hypot(px,pz)||1;
        if (pl<d.stampRadius+TUNING.player.radius) {
            p.hurt(d.stampDamage,px/pl,pz/pl);
        }
        if (this.elite) {
            fireRing(ctx,this.pos.x,this.pos.z,d.eliteRing,rng.range(0,1),d.bulletSpeed,d.bulletDamage,d.bulletLife);
        }
        this.setState('land');
    }

    think(dt,ctx) {
        const d=this.def;
        if (this.state==='move') {
            let push=0;
            if (this.dist>d.range[1]) {
                push=1;
            }
            else if (this.dist<d.range[0]) {
                push=-1;
            }
            this.wx=this.nx*push-this.nz*this.strafeSign*d.strafe;
            this.wz=this.nz*push+this.nx*this.strafeSign*d.strafe;
            this.aimX=this.nx;
            this.aimZ=this.nz;
            this.stampT-=dt;
            if (this.stampT<=0) {
                this.hops=0;
                this.startStamp(ctx);
            }
            return;
        }
        if (this.state==='telegraph') {
            this.manual=true;
            this.vel.multiplyScalar(Math.exp(-10*dt));
            this.aimX=this.tx-this.pos.x;
            this.aimZ=this.tz-this.pos.z;
            if (this.stateT>=d.crouch) {
                this.sx=this.pos.x;
                this.sz=this.pos.z;
                this.setState('attack');
            }
            return;
        }
        if (this.state==='attack') {
            this.manual=true;
            const f=Math.min(1,this.stateT/d.jumpTime);
            this.vel.set((this.tx-this.sx)/d.jumpTime,0,(this.tz-this.sz)/d.jumpTime);
            this.hopY=Math.sin(f*Math.PI)*d.jumpHeight;
            if (f>=1) {
                this.pos.x=this.tx;
                this.pos.z=this.tz;
                this.land(ctx);
            }
            return;
        }
        if (this.state==='land') {
            this.manual=true;
            this.vel.set(0,0,0);
            const wait=this.elite?d.eliteLandStun:d.landStun;
            if (this.stateT>=wait) {
                if (this.elite&&this.hops<d.eliteHops) {
                    this.startStamp(ctx);
                    return;
                }
                this.setState('move');
                this.stampT=this.paced('stamp',d.stampEvery);
            }
        }
    }

    sync(alpha,dt) {
        super.sync(alpha,dt);
        this.lift.position.y=this.hopY;
    }

    pose() {
        const s=this.speedFrac||0;
        const air=this.state==='attack';
        const sw=air?0.6:Math.sin(this.phase)*0.6*s;
        this.legs[0].rotation.x=sw;
        this.legs[1].rotation.x=air?-0.6:-sw;
        this.block.rotation.z=this.state==='land'?Math.sin(time.real*30)*0.05:0;
    }
}

class ScissorMinion extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        this.hover=new THREE.Group();
        this.hover.position.y=0.95;
        this.blades=[];
        for (const side of [-1,1]) {
            const g=new THREE.Group();
            const blade=this.hullify(new THREE.Mesh(geo('scBlade',bladeGeo),side<0?head:body));
            blade.scale.setScalar(0.42);
            blade.position.z=0.66;
            g.add(blade);
            const handle=this.hullify(new THREE.Mesh(geo('smHandle',()=>new THREE.TorusGeometry(0.24,0.07,6,10)),limb));
            handle.rotation.x=Math.PI/2;
            handle.position.set(side*0.12,0,-0.44);
            g.add(handle);
            this.hover.add(g);
            this.blades.push(g);
        }
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('smEye',()=>new THREE.BoxGeometry(0.14,0.04,0.04)),ink);
            e.position.set(sx*0.13,0.14,0.16);
            e.rotation.z=-sx*0.4;
            this.hover.add(e);
        }
        this.screw=new THREE.Mesh(geo('smScrew',()=>new THREE.CylinderGeometry(0.13,0.13,0.18,8)),unlitMaterial({color:'red'}));
        this.screw.position.y=0.09;
        this.hover.add(this.screw);
        this.body.add(this.hover);
    }

    onReset() {
        const d=this.def;
        this.snipT=this.firstT(d.firstSnip);
        this.strafeSign=rng.sign();
        this.rage=false;
        this.cut=null;
        this.sides=[];
        this.si=0;
    }

    enrage() {
        if (this.rage||!this.alive) {
            return;
        }
        this.rage=true;
        this.sqv+=4;
        this.flashT=0.3;
    }

    hide() {
        super.hide();
        this.drop();
    }

    colliders(ctx) {
        return this.state==='cut'||this.state==='mark'?NO_COLS:ctx.room.colliders;
    }

    drop() {
        const c=this.cut;
        this.cut=null;
        if (c&&c.owner===this) {
            c.dead=true;
        }
    }

    corner(c,i) {
        const k=((i%4)+4)%4;
        return [[c.x0,c.z0],[c.x1,c.z0],[c.x1,c.z1],[c.x0,c.z1]][k];
    }

    startCut(ctx) {
        const d=this.def;
        const p=ctx.player;
        const b=ctx.room.bounds;
        const hw=this.elite?d.eliteRect[0]:d.rect[0];
        const hh=this.elite?d.eliteRect[1]:d.rect[1];
        const cx=Math.max(b.minX+hw+0.3,Math.min(b.maxX-hw-0.3,p.pos.x));
        const cz=Math.max(b.minZ+hh+0.3,Math.min(b.maxZ-hh-0.3,p.pos.z));
        const c={x0:cx-hw,x1:cx+hw,z0:cz-hh,z1:cz+hh,prog:[0,0,0,0],owner:this,dead:false,done:false,t:0,elite:this.elite};
        let best=0;
        let bd=1e9;
        for (let i=0;i<4;i++) {
            const q=this.corner(c,i);
            const dd=Math.hypot(q[0]-this.pos.x,q[1]-this.pos.z);
            if (dd<bd) {
                bd=dd;
                best=i;
            }
        }
        let mate=null;
        for (const o of ctx.enemies) {
            if (o!==this&&o.alive&&o.type==='scissorMinion'&&o.state==='move'&&!o.cut&&o.stunT<=0&&!o.dummy&&Math.hypot(o.pos.x-this.pos.x,o.pos.z-this.pos.z)<d.pairRange) {
                mate=o;
                break;
            }
        }
        if (mate) {
            this.assign(c,[best,best+1]);
            mate.assign(c,[best+2,best+3]);
        }
        else {
            this.assign(c,[best,best+1,best+2,best+3]);
        }
    }

    assign(c,sides) {
        this.cut=c;
        this.sides=sides.map(i=>((i%4)+4)%4);
        this.si=0;
        this.setState('mark');
        this.sqv+=2;
    }

    cutSpeed() {
        const d=this.def;
        return d.cutSpeed*(this.rage?d.rage.speed:1);
    }

    think(dt,ctx) {
        const d=this.def;
        const R=this.rage?d.rage:null;
        const p=ctx.player;
        const c=this.cut;
        if (c&&c.dead&&c.owner!==this) {
            this.cut=null;
            if (this.state==='mark'||this.state==='cut') {
                this.setState('recover');
            }
        }
        if (this.state==='move') {
            if (c&&!ctx.enemies.some(o=>o!==this&&o.alive&&o.cut===c&&(o.state==='cut'||o.state==='mark'))) {
                this.drop();
            }
            let push=0;
            if (this.dist>d.range[1]) {
                push=1;
            }
            else if (this.dist<d.range[0]) {
                push=-1;
            }
            const sp=R?R.speed:1;
            this.wx=(this.nx*push-this.nz*this.strafeSign*d.strafe)*sp;
            this.wz=(this.nz*push+this.nx*this.strafeSign*d.strafe)*sp;
            this.aimX=this.nx;
            this.aimZ=this.nz;
            this.snipT-=dt/(R?R.every:1);
            if (this.snipT<=0&&!this.cut) {
                this.startCut(ctx);
            }
            return;
        }
        this.manual=true;
        if (!c&&(this.state==='mark'||this.state==='cut')) {
            this.setState('recover');
            return;
        }
        if (this.state==='mark') {
            const s0=this.sides[0];
            const ca=this.corner(c,s0);
            const ce=this.corner(c,s0+1);
            const q=[ca[0]+(ce[0]-ca[0])*c.prog[s0],ca[1]+(ce[1]-ca[1])*c.prog[s0]];
            const tx=q[0]-this.pos.x;
            const tz=q[1]-this.pos.z;
            const tl=Math.hypot(tx,tz);
            const v=Math.min(d.runSpeed,tl/Math.max(dt,0.001));
            this.vel.set(tx/(tl||1)*v,0,tz/(tl||1)*v);
            this.aimX=tx;
            this.aimZ=tz;
            if ((tl<0.15&&this.stateT>=d.markMin)||this.stateT>=d.markMax) {
                this.pos.x=q[0];
                this.pos.z=q[1];
                this.vel.set(0,0,0);
                this.setState('cut');
            }
            return;
        }
        if (this.state==='cut') {
            const side=this.sides[this.si];
            const a=this.corner(c,side);
            const e=this.corner(c,side+1);
            const len=Math.hypot(e[0]-a[0],e[1]-a[1]);
            c.prog[side]=Math.min(1,c.prog[side]+this.cutSpeed()*dt/len);
            const f=c.prog[side];
            const nx=a[0]+(e[0]-a[0])*f;
            const nz=a[1]+(e[1]-a[1])*f;
            this.vel.set((nx-this.pos.x)/Math.max(dt,0.001),0,(nz-this.pos.z)/Math.max(dt,0.001));
            this.aimX=e[0]-a[0];
            this.aimZ=e[1]-a[1];
            if (f>=1) {
                this.si++;
                if (this.si>=this.sides.length) {
                    this.vel.set(0,0,0);
                    if (c.prog.every(q=>q>=1)) {
                        this.setState('recover');
                        if (!c.done) {
                            this.snap(ctx,c);
                        }
                    }
                    else if (ctx.enemies.some(o=>o!==this&&o.alive&&o.cut===c&&(o.state==='cut'||o.state==='mark'))) {
                        this.setState('recover');
                    }
                    else {
                        const left=[0,1,2,3].map(k=>(side+1+k)%4).filter(k=>c.prog[k]<1);
                        this.sides=left;
                        this.si=0;
                        this.setState('mark');
                    }
                }
            }
            return;
        }
        if (this.state==='recover') {
            this.vel.multiplyScalar(Math.exp(-10*dt));
            if (this.stateT>=d.recover) {
                this.setState('move');
                this.snipT=this.paced('snip',d.snipEvery);
            }
        }
    }

    snap(ctx,c) {
        const d=this.def;
        const p=ctx.player;
        c.done=true;
        c.t=0;
        const cx=(c.x0+c.x1)/2;
        const cz=(c.z0+c.z1)/2;
        ctx.fx.cameraShake(0.25);
        for (let i=0;i<4;i++) {
            const q=this.corner(c,i);
            ctx.particles.burst(q[0],0.3,q[1],5,{color:'midGray',speed:[2,5],up:[2,5]});
        }
        ctx.particles.burst(cx,0.5,cz,16,{color:'farGray',speed:[1,4],up:[4,8],size:[0.12,0.24]});
        if (p.pos.x>c.x0&&p.pos.x<c.x1&&p.pos.z>c.z0&&p.pos.z<c.z1) {
            p.hurt(d.cutDamage,0,1);
        }
        if (c.elite) {
            for (let i=0;i<4;i++) {
                const q=this.corner(c,i);
                const base=Math.atan2(q[1]-cz,q[0]-cx)+Math.PI;
                for (let k=-1;k<=1;k++) {
                    const a=base+k*d.eliteSpread;
                    ctx.enemyBullets.spawn(q[0],q[1],Math.cos(a),Math.sin(a),d.bulletSpeed,d.bulletDamage,d.bulletLife);
                }
            }
        }
        c.owner.cutFx=c;
    }

    sync(alpha,dt) {
        super.sync(alpha,dt);
        const d=this.def;
        let li=4;
        let si=0;
        const c=this.cut&&this.cut.owner===this?this.cut:null;
        if (c&&!c.done) {
            for (let s=0;s<4;s++) {
                const a=this.corner(c,s);
                const e=this.corner(c,s+1);
                const len=Math.hypot(e[0]-a[0],e[1]-a[1]);
                const f=c.prog[s];
                const n=Math.max(2,Math.floor(len/d.dash));
                for (let k=0;k<n;k++) {
                    const u0=k/n;
                    const u1=(k+0.55)/n;
                    if (u1<=f) {
                        continue;
                    }
                    const s0=Math.max(u0,f);
                    this.putLine(this.line(li++),a[0]+(e[0]-a[0])*s0,a[1]+(e[1]-a[1])*s0,a[0]+(e[0]-a[0])*u1,a[1]+(e[1]-a[1])*u1,0.18);
                }
                if (f>0) {
                    const m=this.strip(si++);
                    this.putLine(m,a[0],a[1],a[0]+(e[0]-a[0])*f,a[1]+(e[1]-a[1])*f,0.32);
                    m.material.uniforms.uAlpha.value=1;
                }
            }
        }
        const fx=this.cutFx;
        if (fx) {
            fx.t+=dt;
            const k=fx.t/d.pieceTime;
            if (k>=1) {
                this.cutFx=null;
            }
            else {
                const m=this.strip(si++);
                const cz=(fx.z0+fx.z1)/2;
                this.putLine(m,fx.x0,cz,fx.x1,cz,(fx.z1-fx.z0)*(1-k*0.3));
                m.material.uniforms.uAlpha.value=1-k;
            }
        }
        this.hideStrips(si);
    }

    pose() {
        let open=0.35+Math.sin(time.real*(this.rage?16:6))*0.12;
        if (this.state==='mark') {
            open=0.75;
        }
        else if (this.state==='cut') {
            open=0.25+Math.sin(time.real*30)*0.25;
        }
        this.blades[0].rotation.y=open;
        this.blades[1].rotation.y=-open;
        this.hover.position.y=0.95+Math.sin(time.real*4+this.phase)*0.08;
        this.hover.rotation.z=this.rage?Math.sin(time.real*22)*0.12:0;
    }
}

class Book extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        this.stand=new THREE.Group();
        this.stand.position.y=0.6;
        this.covers=[];
        for (const side of [-1,1]) {
            const pv=new THREE.Group();
            const cover=this.hullify(new THREE.Mesh(geo('bkCover',()=>new THREE.BoxGeometry(2.3,0.16,3.1)),body));
            cover.position.x=side*1.15;
            pv.add(cover);
            const pages=this.hullify(new THREE.Mesh(geo('bkPages',()=>new THREE.BoxGeometry(2.1,0.34,2.9)),head));
            pages.position.set(side*1.1,0.24,0);
            pv.add(pages);
            for (let k=0;k<3;k++) {
                const line=new THREE.Mesh(geo('bkLine',()=>new THREE.BoxGeometry(1.4,0.02,0.06)),limb);
                line.position.set(side*1.1,0.42,-0.8+k*0.5);
                pv.add(line);
            }
            this.stand.add(pv);
            this.covers.push(pv);
        }
        const spine=this.hullify(new THREE.Mesh(geo('bkSpine',()=>new THREE.CylinderGeometry(0.22,0.22,3.1,8)),body));
        spine.rotation.x=Math.PI/2;
        this.stand.add(spine);
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('bkEye',()=>new THREE.BoxGeometry(0.55,0.05,0.12)),ink);
            e.position.set(sx*1.0,0.45,0.9);
            e.rotation.y=sx*0.3;
            this.covers[sx<0?0:1].add(e);
        }
        this.mark=new THREE.Mesh(geo('bkMark',()=>new THREE.BoxGeometry(0.28,0.04,1.6)),unlitMaterial({color:'red'}));
        this.mark.position.set(0.2,0.5,1.9);
        this.stand.add(this.mark);
        this.body.add(this.stand);
    }

    onReset() {
        this.patternT=2.0;
        this.pattern=null;
        this.volley=0;
        this.fireAcc=0;
        this.drops=[];
        this.yaw=0;
        this.hopY=0;
    }

    damageMult() {
        return this.state==='rest'?this.def.weakMult:1;
    }

    phase2() {
        return this.evolved;
    }

    colliders(ctx) {
        return this.pattern==='glide'&&this.state==='attack'?NO_COLS:ctx.room.colliders;
    }

    canContact() {
        return !(this.pattern==='glide'&&this.state==='attack');
    }

    glideTarget(ctx) {
        const p=ctx.player;
        const b=ctx.room.bounds;
        const r=this.def.radius;
        this.gx=Math.max(b.minX+r,Math.min(b.maxX-r,p.pos.x+p.vel.x*0.3));
        this.gz=Math.max(b.minZ+r,Math.min(b.maxZ-r,p.pos.z+p.vel.z*0.3));
        this.tele={type:'ring',r:this.def.glide.r,dur:this.def.glide.tele,t:0,x:this.gx,z:this.gz};
    }

    choose(ctx) {
        const list=['wall','rain','slam','wall'];
        if (ctx.enemyMgr.list.length<5) {
            list.push('summon');
        }
        if (this.phase2()) {
            list.push('glide','glide','rain');
        }
        let p=list[Math.floor(rng.next()*list.length)];
        if (p===this.last) {
            p=list[(list.indexOf(p)+1)%list.length];
        }
        this.last=p;
        return p;
    }

    think(dt,ctx) {
        const d=this.def;
        const p=ctx.player;
        this.manual=true;
        this.vel.set(0,0,0);
        this.aimX=this.nx;
        this.aimZ=this.nz;
        if (this.state==='move') {
            this.patternT-=dt*(this.phase2()?1.3:1);
            if (this.patternT<=0) {
                this.pattern=this.choose(ctx);
                this.setState('telegraph');
                if (this.pattern==='wall') {
                    this.teleLine(this.nx,this.nz,14,0.7,3,0.9);
                }
                else if (this.pattern==='slam') {
                    this.teleRing(4,0.7);
                }
                else if (this.pattern==='glide') {
                    this.hops=0;
                    this.glideTarget(ctx);
                }
                else {
                    this.teleRing(2.6,0.5);
                }
            }
            return;
        }
        if (this.state==='telegraph') {
            if (this.pattern==='glide'&&this.stateT<this.tele.dur*0.5) {
                this.glideTarget(ctx);
                this.tele.t=this.stateT;
            }
            if (this.stateT>=this.tele.dur) {
                this.tele=null;
                this.setState('attack');
                this.volley=0;
                this.fireAcc=0;
                this.sx=this.pos.x;
                this.sz=this.pos.z;
                if (this.pattern==='rain') {
                    const n=this.phase2()?9:6;
                    this.drops=[];
                    for (let i=0;i<n;i++) {
                        const x=p.pos.x+(i===0?0:rng.range(-6,6));
                        const z=p.pos.z+(i===0?0:rng.range(-5,5));
                        this.drops.push({x,z,t:0.75+i*0.18});
                        ctx.dangerRings.spawn(x,z,1.6,'red',0.75+i*0.18);
                    }
                }
            }
            return;
        }
        if (this.state==='attack') {
            const sp=d.bulletSpeed*(this.phase2()?1.12:1);
            if (this.pattern==='wall') {
                this.fireAcc+=dt;
                if (this.fireAcc>=0.95||this.volley===0) {
                    this.fireAcc=0;
                    const fx=this.nx;
                    const fz=this.nz;
                    const px=-fz;
                    const pz=fx;
                    const lat=(p.pos.x-this.pos.x)*px+(p.pos.z-this.pos.z)*pz;
                    const gap=lat+rng.range(-3.5,3.5);
                    for (let o=-15;o<=15;o+=0.85) {
                        if (Math.abs(o-gap)<1.7) {
                            continue;
                        }
                        ctx.enemyBullets.spawn(this.pos.x+fx*2.2+px*o,this.pos.z+fz*2.2+pz*o,fx,fz,sp,d.bulletDamage,d.bulletLife);
                    }
                    this.volley++;
                    this.sqv+=1.5;
                    if (this.volley>=(this.phase2()?4:3)) {
                        this.rest();
                    }
                }
            }
            else if (this.pattern==='rain') {
                for (let i=this.drops.length-1;i>=0;i--) {
                    const q=this.drops[i];
                    if (this.stateT>=q.t) {
                        fireRing(ctx,q.x,q.z,8,rng.range(0,1),4.5,d.bulletDamage,2.5);
                        ctx.particles.burst(q.x,0.3,q.z,6,{color:'ink',speed:[2,4],up:[2,4]});
                        if (Math.hypot(p.pos.x-q.x,p.pos.z-q.z)<1.4) {
                            p.hurt(1,0,1);
                        }
                        this.drops.splice(i,1);
                    }
                }
                if (this.drops.length===0) {
                    this.rest();
                }
            }
            else if (this.pattern==='slam') {
                this.fireAcc+=dt;
                if (this.fireAcc>=0.45||this.volley===0) {
                    this.fireAcc=0;
                    fireRing(ctx,this.pos.x,this.pos.z,30,this.volley*0.1,sp*0.85,d.bulletDamage,d.bulletLife);
                    ctx.fx.cameraShake(0.35);
                    this.volley++;
                    if (this.volley>=(this.phase2()?3:2)) {
                        this.rest();
                    }
                }
            }
            else if (this.pattern==='glide') {
                const G=d.glide;
                const f=Math.min(1,this.stateT/G.time);
                this.vel.set((this.gx-this.sx)/G.time,0,(this.gz-this.sz)/G.time);
                this.hopY=Math.sin(f*Math.PI)*G.height;
                if (f>=1) {
                    this.pos.x=this.gx;
                    this.pos.z=this.gz;
                    this.vel.set(0,0,0);
                    this.hopY=0;
                    this.hops++;
                    ctx.fx.cameraShake(0.4);
                    ctx.particles.burst(this.pos.x,0.4,this.pos.z,18,{color:'ink',speed:[3,8],up:[2,5]});
                    fireRing(ctx,this.pos.x,this.pos.z,G.ring,rng.range(0,1),G.speed,d.bulletDamage,d.bulletLife);
                    if (Math.hypot(p.pos.x-this.pos.x,p.pos.z-this.pos.z)<G.r+TUNING.player.radius) {
                        p.hurt(1,this.nx,this.nz);
                    }
                    if (this.hops<G.hops) {
                        this.setState('telegraph');
                        this.glideTarget(ctx);
                    }
                    else {
                        this.rest();
                    }
                }
            }
            else if (this.pattern==='summon') {
                const types=['doodle','doodle','bird'];
                this.summonWave(ctx,types.map((type,i)=>{
                    const a=Math.atan2(this.nz,this.nx)+(i-1)*0.9;
                    return [type,this.pos.x+Math.cos(a)*3.2,this.pos.z+Math.sin(a)*3.2];
                }));
                this.rest();
            }
            return;
        }
        if (this.state==='rest') {
            if (this.stateT>=d.restTime) {
                this.setState('move');
                this.patternT=rng.range(0.4,0.8);
            }
        }
    }

    rest() {
        this.setState('rest');
    }

    pose() {
        let ang=0.35;
        if (this.state==='attack'&&this.pattern==='slam') {
            ang=1.35;
        }
        else if (this.state==='telegraph'&&this.pattern==='slam') {
            ang=0.9;
        }
        else if (this.state==='rest') {
            ang=0.05;
        }
        this.covers[0].rotation.z=ang;
        this.covers[1].rotation.z=-ang;
        this.stand.position.y=0.6+Math.sin(time.real*1.8)*0.08+(this.hopY||0);
        const pulse=this.state==='rest'?1.25+Math.sin(time.real*14)*0.2:1;
        this.mark.scale.set(pulse,1,1);
    }
}

class Exam extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        this.sheet=new THREE.Group();
        this.sheet.position.y=2.3;
        const paper=this.hullify(new THREE.Mesh(geo('exPaper',()=>new THREE.BoxGeometry(2.8,3.6,0.14)),head));
        this.sheet.add(paper);
        const lg=geo('exLine',()=>new THREE.BoxGeometry(1.9,0.07,0.04));
        for (let i=0;i<5;i++) {
            const l=new THREE.Mesh(lg,limb);
            l.position.set(-0.2,0.7-i*0.45,0.09);
            this.sheet.add(l);
        }
        const bg=geo('exBox',()=>new THREE.BoxGeometry(0.22,0.22,0.04));
        for (let i=0;i<5;i++) {
            const b=new THREE.Mesh(bg,body);
            b.position.set(-1.1,0.7-i*0.45,0.09);
            this.sheet.add(b);
        }
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('exEye',()=>new THREE.BoxGeometry(0.42,0.08,0.05)),ink);
            e.position.set(sx*0.5,1.3,0.1);
            e.rotation.z=sx*0.3;
            this.sheet.add(e);
        }
        this.grade=new THREE.Mesh(geo('exGrade',()=>new THREE.TorusGeometry(0.42,0.07,6,16)),unlitMaterial({color:'red'}));
        this.grade.position.set(0.9,1.25,0.12);
        this.sheet.add(this.grade);
        this.pen=new THREE.Group();
        const shaft=this.hullify(new THREE.Mesh(geo('exPen',()=>new THREE.CylinderGeometry(0.12,0.12,1.6,8)),body));
        this.pen.add(shaft);
        const tip=new THREE.Mesh(geo('exTip',()=>new THREE.ConeGeometry(0.12,0.4,8)),unlitMaterial({color:'red'}));
        tip.position.y=-1.0;
        tip.rotation.x=Math.PI;
        this.pen.add(tip);
        this.pen.position.set(2.0,2.4,0.3);
        this.pen.rotation.z=0.5;
        this.body.add(this.sheet);
        this.body.add(this.pen);
    }

    onReset() {
        this.patternT=2.2;
        this.pattern=null;
        this.last=null;
        this.volley=0;
        this.fireAcc=0;
        this.drops=[];
        this.gradeA=[];
        this.hpAsk=0;
        this.shotsAsk=0;
        this.coolT=0;
        this.say=null;
        this.tf=null;
        this.blank=null;
        this.trail=[];
        this.askDur=0;
    }

    onEvolveStart() {
        this.tf=null;
        this.blank=null;
        this.drops=[];
    }

    hide() {
        super.hide();
        this.trail=[];
        this.tf=null;
        this.blank=null;
    }

    damageMult() {
        return this.state==='rest'?this.def.weakMult:1;
    }

    phase2() {
        return this.evolved;
    }

    speak(key,dur) {
        this.say={text:t(key),t:0,dur,keep:true};
    }

    choose() {
        const list=['zone','quiet','grade','toss','tf','blank'];
        if (this.phase2()) {
            list.push('essay','essay','tf','blank');
        }
        let p=list[Math.floor(rng.next()*list.length)];
        if (p===this.last) {
            p=list[(list.indexOf(p)+1)%list.length];
        }
        this.last=p;
        return p;
    }

    think(dt,ctx) {
        const d=this.def;
        const p=ctx.player;
        this.aimX=this.nx;
        this.aimZ=this.nz;
        const P2=this.phase2();
        this.trailTick(dt,ctx);
        if (this.state==='move') {
            const want=this.dist>d.keep+2?1:(this.dist<d.keep-2?-1:0);
            this.wx=this.nx*want-this.nz*0.4;
            this.wz=this.nz*want+this.nx*0.4;
            this.patternT-=dt*(P2?1.3:1);
            if (this.patternT<=0) {
                this.pattern=this.choose();
                this.setState('ask');
                this.speak('exam.q.'+this.pattern,d.askTime+1.4);
                this.hpAsk=p.hp;
                this.shotsAsk=p.shots||0;
                this.askDur=d.askTime;
                if (this.pattern==='tf') {
                    this.startTf(ctx,P2);
                }
                else if (this.pattern==='blank') {
                    this.startBlank(ctx,P2);
                }
                else if (this.pattern==='grade') {
                    const n=P2?d.grade.lines2:d.grade.lines;
                    this.teleLine(this.nx,this.nz,18,d.askTime,n,d.grade.spread);
                }
                else {
                    this.teleRing(this.pattern==='quiet'?3.2:2.4,d.askTime);
                }
            }
            return;
        }
        if (this.state==='attack'&&this.pattern==='essay') {
            this.essayTick(dt,ctx);
            return;
        }
        this.manual=true;
        this.vel.multiplyScalar(Math.exp(-6*dt));
        if (this.state==='ask') {
            if (this.pattern==='grade'&&this.tele) {
                this.gradeA=[];
                const base=Math.atan2(this.tele.dz,this.tele.dx);
                for (let i=0;i<this.tele.count;i++) {
                    this.gradeA.push(base+(i/(this.tele.count-1)-0.5)*this.tele.spread);
                }
            }
            if (this.pattern==='tf'&&this.tf.trick&&!this.tf.swapped&&this.stateT>=this.askDur*d.tf.swapAt) {
                this.tf.swapped=true;
                this.tf.wrong=-this.tf.wrong;
                this.speak('exam.trick',1.2);
                ctx.fx.cameraShake(0.3);
                this.sqv+=3;
            }
            if (this.stateT>=this.askDur) {
                this.tele=null;
                this.setState('attack');
                this.volley=0;
                this.fireAcc=0;
                this.coolT=0;
                this.shotsAsk=p.shots||0;
                if (this.pattern==='zone') {
                    const Z=d.zone;
                    const n=P2?Z.count2:Z.count;
                    this.drops=[];
                    for (let i=0;i<n;i++) {
                        const x=p.pos.x+(i===0?0:rng.range(-Z.spread,Z.spread));
                        const z=p.pos.z+(i===0?0:rng.range(-Z.spread,Z.spread));
                        const tt=Z.delay+i*Z.stagger;
                        this.drops.push({x,z,t:tt});
                        ctx.dangerRings.spawn(x,z,Z.r,'red',tt);
                    }
                }
            }
            return;
        }
        if ((this.state!=='attack'||this.pattern!=='quiet')&&this.spin!==0) {
            this.spin=0;
            this.cheatT=0;
        }
        if (this.state==='attack') {
            const sp=d.bulletSpeed*(P2?1.12:1);
            let done=false;
            if (this.pattern==='zone') {
                const Z=d.zone;
                for (let i=this.drops.length-1;i>=0;i--) {
                    const q=this.drops[i];
                    if (this.stateT>=q.t) {
                        fireRing(ctx,q.x,q.z,Z.ring,rng.range(0,1),Z.speed,d.bulletDamage,Z.life);
                        ctx.particles.burst(q.x,0.3,q.z,6,{color:'red',speed:[2,4],up:[2,4]});
                        if (Math.hypot(p.pos.x-q.x,p.pos.z-q.z)<Z.r) {
                            p.hurt(1,0,1);
                        }
                        this.drops.splice(i,1);
                    }
                }
                done=this.drops.length===0;
            }
            else if (this.pattern==='quiet') {
                const Q=d.quiet;
                this.coolT-=dt;
                if ((this.cheatT||0)>0) {
                    const k0=1-this.cheatT/Q.spinTime;
                    this.cheatT=Math.max(0,this.cheatT-dt);
                    const k1=1-this.cheatT/Q.spinTime;
                    this.spin=-EASE.easeInOutQuad(k1)*Math.PI*2;
                    const n=P2?Q.ring2:Q.ring;
                    for (let i=Math.floor(k0*n);i<Math.floor(k1*n);i++) {
                        const a=this.cheatBase+i/n*Math.PI*2;
                        ctx.enemyBullets.spawn(this.pos.x+Math.cos(a)*1.2,this.pos.z+Math.sin(a)*1.2,Math.cos(a),Math.sin(a),sp*Q.speed,d.bulletDamage,d.bulletLife);
                    }
                    if (this.cheatT<=0) {
                        this.spin=0;
                        this.coolT=Q.cool;
                    }
                }
                else if ((p.shots||0)>this.shotsAsk&&this.coolT<=0) {
                    this.shotsAsk=p.shots;
                    this.cheatT=Q.spinTime;
                    this.cheatBase=Math.atan2(this.nz,this.nx);
                    this.speak('exam.cheat',0.9);
                    this.kick=1;
                    ctx.fx.cameraShake(0.25);
                }
                this.shotsAsk=Math.max(this.shotsAsk,p.shots||0);
                done=this.stateT>=Q.time&&!(this.cheatT>0);
            }
            else if (this.pattern==='grade') {
                const G=d.grade;
                this.fireAcc+=dt;
                while (this.fireAcc>=G.every) {
                    this.fireAcc-=G.every;
                    for (const a of this.gradeA) {
                        ctx.enemyBullets.spawn(this.pos.x+Math.cos(a)*1.6,this.pos.z+Math.sin(a)*1.6,Math.cos(a),Math.sin(a),sp*1.4,d.bulletDamage,d.bulletLife*0.5);
                    }
                }
                done=this.stateT>=G.time;
            }
            else if (this.pattern==='tf') {
                const T=this.tf;
                if (!T.hit) {
                    T.hit=true;
                    ctx.fx.cameraShake(0.3);
                    if (this.inWrong(p.pos.x,p.pos.z)) {
                        p.hurt(d.tf.damage,T.axis==='x'?-T.wrong:0,T.axis==='z'?-T.wrong:0);
                    }
                }
                done=this.stateT>=d.tf.live;
            }
            else if (this.pattern==='blank') {
                const B=this.blank;
                this.fireAcc+=dt;
                if (B.queue.length&&this.fireAcc>=d.blank.every) {
                    this.fireAcc=0;
                    const c=B.queue.shift();
                    B.filled.push({c,t:0});
                    const r=this.cellRect(c);
                    ctx.particles.burst(r.x+B.cw/2,0.3,r.z+B.ch/2,8,{color:'ink',speed:[1,5],up:[1,3]});
                    if (p.pos.x>r.x&&p.pos.x<r.x+B.cw&&p.pos.z>r.z&&p.pos.z<r.z+B.ch) {
                        p.hurt(1,0,1);
                    }
                }
                for (const f of B.filled) {
                    f.t+=dt;
                }
                done=B.queue.length===0&&B.filled.every(f=>f.t>=d.blank.fill);
                if (done) {
                    this.blank=null;
                }
            }
            else if (this.pattern==='toss') {
                const T=d.toss;
                this.fireAcc+=dt;
                if (this.fireAcc>=T.every||this.volley===0) {
                    this.fireAcc=0;
                    const base=Math.atan2(this.nz,this.nx);
                    for (let i=0;i<T.count;i++) {
                        const a=base+(i/(T.count-1)-0.5)*T.spread;
                        ctx.enemyBullets.spawn(this.pos.x,this.pos.z,Math.cos(a),Math.sin(a),T.speed,d.bulletDamage,d.bulletLife);
                    }
                    this.volley++;
                    this.kick=1;
                }
                done=this.volley>=(P2?T.volleys2:T.volleys);
            }
            if (done&&d.plain.includes(this.pattern)) {
                this.setState('move');
                this.patternT=rng.range(d.questionGap[0],d.questionGap[1]);
                return;
            }
            if (done) {
                if (this.pattern==='tf') {
                    this.tf=null;
                }
                const ok=p.hp>=this.hpAsk;
                this.setState(ok?'rest':'wrong');
                this.speak(ok?'exam.right':'exam.wrong',ok?d.restTime:d.wrongTime+0.6);
                this.sqv+=3;
            }
            return;
        }
        if (this.state==='rest'&&this.stateT>=d.restTime) {
            this.setState('move');
            this.patternT=rng.range(d.questionGap[0],d.questionGap[1]);
        }
        if (this.state==='wrong'&&this.stateT>=d.wrongTime) {
            this.setState('move');
            this.patternT=rng.range(d.questionGap[0],d.questionGap[1])*0.6;
        }
    }

    startTf(ctx,P2) {
        const d=this.def;
        const b=ctx.room.bounds;
        const axis=rng.next()<0.5?'x':'z';
        const c=axis==='x'?(b.minX+b.maxX)/2:(b.minZ+b.maxZ)/2;
        this.tf={axis,c,wrong:rng.sign(),b:{minX:b.minX,maxX:b.maxX,minZ:b.minZ,maxZ:b.maxZ},trick:P2&&rng.next()<d.tf.swapChance,swapped:false,hit:false};
        this.askDur=P2?d.tf.ask2:d.tf.ask;
        this.tele=null;
    }

    inWrong(x,z) {
        const T=this.tf;
        const v=(T.axis==='x'?x:z)-T.c;
        return v*T.wrong>0;
    }

    halfRect() {
        const T=this.tf;
        const b=T.b;
        if (T.axis==='x') {
            return T.wrong>0?{x0:T.c,x1:b.maxX,z0:b.minZ,z1:b.maxZ}:{x0:b.minX,x1:T.c,z0:b.minZ,z1:b.maxZ};
        }
        return T.wrong>0?{x0:b.minX,x1:b.maxX,z0:T.c,z1:b.maxZ}:{x0:b.minX,x1:b.maxX,z0:b.minZ,z1:T.c};
    }

    startBlank(ctx,P2) {
        const d=this.def;
        const B=d.blank;
        const b=ctx.room.bounds;
        const cols=B.cols;
        const rows=B.rows;
        const cw=(b.maxX-b.minX-0.4)/cols;
        const ch=(b.maxZ-b.minZ-0.4)/rows;
        const all=[];
        for (let i=0;i<cols*rows;i++) {
            all.push(i);
        }
        for (let i=all.length-1;i>0;i--) {
            const j=Math.floor(rng.next()*(i+1));
            const q=all[i];
            all[i]=all[j];
            all[j]=q;
        }
        const n=P2?B.safe2:B.safe;
        const fill=all.slice(n);
        for (let i=fill.length-1;i>0;i--) {
            const j=Math.floor(rng.next()*(i+1));
            const q=fill[i];
            fill[i]=fill[j];
            fill[j]=q;
        }
        this.blank={x0:b.minX+0.2,z0:b.minZ+0.2,cw,ch,cols,rows,safe:all.slice(0,n),queue:fill,filled:[]};
        this.askDur=P2?B.ask2:B.ask;
        this.tele=null;
    }

    cellRect(c) {
        const B=this.blank;
        return {x:B.x0+(c%B.cols)*B.cw,z:B.z0+Math.floor(c/B.cols)*B.ch};
    }

    essayTick(dt,ctx) {
        const d=this.def;
        const E=d.essay;
        const p=ctx.player;
        this.manual=true;
        this.vel.set(this.nx*E.speed,0,this.nz*E.speed);
        this.dropT=(this.dropT||0)-dt;
        if (this.dropT<=0) {
            this.dropT=E.drop;
            const last=this.trail[this.trail.length-1];
            const pt={x:this.pos.x,z:this.pos.z,t:0,prev:last&&last.live?last:null,live:true};
            this.trail.push(pt);
        }
        if (this.stateT>=E.time) {
            const last=this.trail[this.trail.length-1];
            if (last) {
                last.live=false;
            }
            const ok=p.hp>=this.hpAsk;
            this.setState(ok?'rest':'wrong');
            this.speak(ok?'exam.right':'exam.wrong',ok?d.restTime:d.wrongTime+0.6);
            this.sqv+=3;
        }
    }

    trailTick(dt,ctx) {
        const E=this.def.essay;
        const p=ctx.player;
        for (let i=this.trail.length-1;i>=0;i--) {
            const q=this.trail[i];
            q.t+=dt;
            if (q.prev&&q.t>=E.arm&&q.t<E.arm+E.live) {
                const sx=q.x-q.prev.x;
                const sz=q.z-q.prev.z;
                const l2=sx*sx+sz*sz||1;
                const u=Math.max(0,Math.min(1,((p.pos.x-q.prev.x)*sx+(p.pos.z-q.prev.z)*sz)/l2));
                if (Math.hypot(p.pos.x-(q.prev.x+sx*u),p.pos.z-(q.prev.z+sz*u))<E.width+TUNING.player.radius) {
                    p.hurt(1,0,1);
                }
            }
            if (q.t>=E.arm+E.live+0.4) {
                this.trail.splice(i,1);
                for (const o of this.trail) {
                    if (o.prev===q) {
                        o.prev=null;
                    }
                }
            }
        }
    }

    sync(alpha,dt) {
        super.sync(alpha,dt);
        const d=this.def;
        let li=8;
        let si=0;
        const red=(ax,az,bx,bz,w)=>this.putLine(this.line(li++),ax,az,bx,bz,w);
        const ink=(ax,az,bx,bz,w,a)=>{
            const m=this.strip(si++);
            this.putLine(m,ax,az,bx,bz,w);
            m.material.uniforms.uAlpha.value=a;
        };
        const circ=(cx,cz,r,w,a)=>{
            const n=12;
            for (let i=0;i<n;i++) {
                const a0=i/n*Math.PI*2;
                const a1=(i+1.15)/n*Math.PI*2;
                ink(cx+Math.cos(a0)*r,cz+Math.sin(a0)*r,cx+Math.cos(a1)*r,cz+Math.sin(a1)*r,w,a);
            }
        };
        const T=this.tf;
        if (T&&this.pattern==='tf'&&(this.state==='ask'||this.state==='attack')) {
            const h=this.halfRect();
            const b=T.b;
            if (T.axis==='x') {
                red(T.c,b.minZ,T.c,b.maxZ,0.18);
            }
            else {
                red(b.minX,T.c,b.maxX,T.c,0.18);
            }
            if (this.state==='ask') {
                red(h.x0+0.6,h.z0+0.6,h.x1-0.6,h.z1-0.6,0.35);
                red(h.x0+0.6,h.z1-0.6,h.x1-0.6,h.z0+0.6,0.35);
                const ox=T.axis==='x'?T.c-T.wrong*(b.maxX-b.minX)/4:(b.minX+b.maxX)/2;
                const oz=T.axis==='z'?T.c-T.wrong*(b.maxZ-b.minZ)/4:(b.minZ+b.maxZ)/2;
                circ(ox,oz,2.6,0.4,1);
            }
            else {
                const a=Math.max(0,1-this.stateT/d.tf.live);
                const n=d.tf.hatch;
                for (let i=0;i<n;i++) {
                    const f=(i+0.5)/n;
                    if (T.axis==='x') {
                        const x=h.x0+(h.x1-h.x0)*f;
                        ink(x,h.z0,x,h.z1,(h.x1-h.x0)/n*0.9,a);
                    }
                    else {
                        const z=h.z0+(h.z1-h.z0)*f;
                        ink(h.x0,z,h.x1,z,(h.z1-h.z0)/n*0.9,a);
                    }
                }
            }
        }
        const B=this.blank;
        if (B&&this.pattern==='blank'&&(this.state==='ask'||this.state==='attack')) {
            for (let i=0;i<=B.cols;i++) {
                red(B.x0+i*B.cw,B.z0,B.x0+i*B.cw,B.z0+B.ch*B.rows,0.14);
            }
            for (let i=0;i<=B.rows;i++) {
                red(B.x0,B.z0+i*B.ch,B.x0+B.cw*B.cols,B.z0+i*B.ch,0.14);
            }
            for (const c of B.safe) {
                const r=this.cellRect(c);
                circ(r.x+B.cw/2,r.z+B.ch/2,Math.min(B.cw,B.ch)*0.3,0.3,1);
            }
            for (const f of B.filled) {
                const r=this.cellRect(f.c);
                ink(r.x+0.1,r.z+B.ch/2,r.x+B.cw-0.1,r.z+B.ch/2,B.ch-0.2,Math.max(0,1-Math.max(0,f.t-d.blank.fill*0.6)/(d.blank.fill*0.4)));
            }
        }
        const E=d.essay;
        for (const q of this.trail) {
            if (!q.prev) {
                continue;
            }
            if (q.t<E.arm) {
                red(q.prev.x,q.prev.z,q.x,q.z,0.14);
            }
            else {
                ink(q.prev.x,q.prev.z,q.x,q.z,E.width*2,Math.max(0,Math.min(1,(E.arm+E.live+0.4-q.t)/0.4)));
            }
        }
        this.hideStrips(si);
    }

    pose() {
        const rest=this.state==='rest';
        this.sheet.position.y=2.3+Math.sin(time.real*1.6)*0.12;
        this.sheet.rotation.x=rest?0.45:(this.state==='ask'?-0.1:0);
        this.sheet.rotation.z=this.state==='wrong'?Math.sin(time.real*24)*0.06:0;
        const pulse=rest?1.3+Math.sin(time.real*14)*0.2:1;
        this.grade.scale.set(pulse,pulse,1);
        this.pen.rotation.z=0.5+(this.state==='attack'?Math.sin(time.real*20)*0.4:0)-this.kick*0.3;
    }
}

class Bookmark extends Enemy {
    buildBody() {
        const shell=this.mat('head');
        const ink=this.mat('body');
        this.float=new THREE.Group();
        this.float.position.y=0.5;
        const tube=this.hullify(new THREE.Mesh(geo('ctTube',()=>new THREE.CylinderGeometry(0.38,0.38,1.7,10)),shell));
        tube.position.y=1.1;
        this.float.add(tube);
        const fill=new THREE.Mesh(geo('ctFill',()=>new THREE.CylinderGeometry(0.3,0.3,1.2,10)),ink);
        fill.position.set(0,0.95,0.1);
        this.float.add(fill);
        const cap=this.hullify(new THREE.Mesh(geo('ctCap',()=>new THREE.SphereGeometry(0.38,10,6)),shell));
        cap.position.y=1.95;
        this.float.add(cap);
        const neck=this.hullify(new THREE.Mesh(geo('ctNeck',()=>new THREE.CylinderGeometry(0.22,0.3,0.4,8)),ink));
        neck.position.y=0.1;
        this.float.add(neck);
        const band=new THREE.Mesh(geo('ctBand',()=>new THREE.TorusGeometry(0.4,0.06,6,12)),unlitMaterial({color:'red'}));
        band.rotation.x=Math.PI/2;
        band.position.y=1.5;
        this.float.add(band);
        this.body.add(this.float);
    }

    onReset() {
        this.host=null;
    }

    canContact() {
        return false;
    }

    think(dt,ctx) {
        this.manual=true;
        this.vel.set(0,0,0);
        const h=this.host;
        if (!h||!h.alive) {
            ctx.enemyMgr.slay(this);
            return;
        }
        if (!h.guarded) {
            this.tele=null;
            return;
        }
        const dx=h.pos.x-this.pos.x;
        const dz=h.pos.z-this.pos.z;
        const l=Math.hypot(dx,dz)||1;
        if (!this.tele) {
            this.teleLine(dx/l,dz/l,0,0.4);
        }
        this.tele.dx=dx/l;
        this.tele.dz=dz/l;
        this.tele.len=Math.max(0,l-h.def.radius-this.def.radius-0.2);
        this.aimX=dx;
        this.aimZ=dz;
    }

    pose() {
        this.float.position.y=0.4+Math.sin(time.real*2.4+this.phase)*0.15;
        this.float.rotation.y=time.real*0.8;
    }
}

class BookFinal extends Book {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        const red=unlitMaterial({color:'red'});
        this.pen=new THREE.Group();
        const nib=this.hullify(new THREE.Mesh(geo('qtNib',()=>new THREE.ConeGeometry(0.46,1.05,4)),head));
        nib.rotation.x=Math.PI;
        nib.rotation.y=Math.PI/4;
        nib.position.y=0.52;
        this.pen.add(nib);
        const slit=new THREE.Mesh(geo('qtSlit',()=>new THREE.BoxGeometry(0.04,0.62,0.5)),ink);
        slit.position.y=0.42;
        this.pen.add(slit);
        const hole=new THREE.Mesh(geo('qtHole',()=>new THREE.SphereGeometry(0.09,8,6)),red);
        hole.position.set(0,0.78,0.3);
        this.pen.add(hole);
        const grip=this.hullify(new THREE.Mesh(geo('qtGrip',()=>new THREE.CylinderGeometry(0.5,0.42,0.55,12)),limb));
        grip.position.y=1.32;
        this.pen.add(grip);
        const barrel=this.hullify(new THREE.Mesh(geo('qtBarrel',()=>new THREE.CylinderGeometry(0.6,0.56,1.55,12)),body));
        barrel.position.y=2.35;
        this.pen.add(barrel);
        const ringG=geo('qtRing',()=>new THREE.TorusGeometry(0.6,0.05,6,16));
        for (const y of [1.62,3.05]) {
            const r=new THREE.Mesh(ringG,ink);
            r.rotation.x=Math.PI/2;
            r.position.y=y;
            this.pen.add(r);
        }
        const band=new THREE.Mesh(geo('qtBand',()=>new THREE.TorusGeometry(0.62,0.08,6,16)),red);
        band.rotation.x=Math.PI/2;
        band.position.y=2.85;
        this.pen.add(band);
        const gauge=new THREE.Mesh(geo('qtWindow',()=>new THREE.BoxGeometry(0.22,0.7,0.06)),ink);
        gauge.position.set(0.5,2.2,0.3);
        gauge.rotation.y=1.0;
        this.pen.add(gauge);
        const top=this.hullify(new THREE.Mesh(geo('qtTop',()=>new THREE.SphereGeometry(0.58,12,8,0,Math.PI*2,0,Math.PI/2)),limb));
        top.position.y=3.12;
        top.scale.y=0.6;
        this.pen.add(top);
        const clip=this.hullify(new THREE.Mesh(geo('qtClip',()=>new THREE.BoxGeometry(0.14,1.3,0.12)),head));
        clip.position.set(0,2.55,-0.66);
        this.pen.add(clip);
        const clipEnd=new THREE.Mesh(geo('qtClipEnd',()=>new THREE.SphereGeometry(0.11,8,6)),head);
        clipEnd.position.set(0,1.9,-0.66);
        this.pen.add(clipEnd);
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('qtEye',()=>new THREE.BoxGeometry(0.3,0.07,0.05)),ink);
            e.position.set(sx*0.22,2.55,0.58);
            e.rotation.z=sx*0.4;
            this.pen.add(e);
            const pu=new THREE.Mesh(geo('qtPupil',()=>new THREE.SphereGeometry(0.06,6,4)),ink);
            pu.position.set(sx*0.2,2.4,0.58);
            this.pen.add(pu);
        }
        const mouth=new THREE.Mesh(geo('qtMouth',()=>new THREE.BoxGeometry(0.3,0.05,0.05)),ink);
        mouth.position.set(0,2.12,0.6);
        this.pen.add(mouth);
        this.crown=new THREE.Group();
        const sp=geo('qtSpike',()=>new THREE.ConeGeometry(0.13,0.42,5));
        for (let i=0;i<5;i++) {
            const an=i/5*Math.PI*2;
            const m=new THREE.Mesh(sp,red);
            m.position.set(Math.cos(an)*0.36,3.62,Math.sin(an)*0.36);
            this.crown.add(m);
        }
        this.pen.add(this.crown);
        this.orbs=new THREE.Group();
        for (let i=0;i<3;i++) {
            const an=i/3*Math.PI*2;
            const d=new THREE.Mesh(geo('qtDrop',()=>new THREE.SphereGeometry(0.15,8,6)),ink);
            d.position.set(Math.cos(an)*1.05,1.1,Math.sin(an)*1.05);
            d.scale.y=1.5;
            this.orbs.add(d);
        }
        this.pen.add(this.orbs);
        this.mark=new THREE.Mesh(geo('qtMark',()=>new THREE.TorusGeometry(0.55,0.07,6,16)),red);
        this.mark.rotation.x=Math.PI/2;
        this.mark.position.y=1.0;
        this.pen.add(this.mark);
        this.pen.position.y=0.5;
        this.body.add(this.pen);
    }

    onReset() {
        super.onReset();
        this.page=0;
        this.bombs=[];
        this.hz=[];
        this.sweep=null;
        this.guarded=false;
        this.pending=0;
        this.marks=[];
        this.restN=0;
    }

    hide() {
        super.hide();
        this.hz=[];
        this.sweep=null;
        for (const m of this.strips) {
            m.visible=false;
        }
        for (const q of this.marks||[]) {
            if (q.alive) {
                q.tele=null;
            }
        }
    }

    pageOf() {
        return this.evolved?2:(this.hp<this.maxHp*2/3?1:0);
    }

    onEvolveStart() {
        this.hz=[];
        this.sweep=null;
        this.bombs=[];
        this.page=2;
    }

    onEvolved(ctx) {
        this.seal(ctx);
    }

    damageMult() {
        return this.state==='rest'?this.def.weakMult:1;
    }

    choose() {
        if (this.tutor) {
            return 'sweep';
        }
        const list=['lines','sweep','mimicBomb','mimicScatter'];
        if (this.page>=1) {
            list.push('wall','sweep');
        }
        if (this.page>=2) {
            list.push('scribble','scribble','lines');
        }
        let p=list[Math.floor(rng.next()*list.length)];
        if (p===this.last) {
            p=list[(list.indexOf(p)+1)%list.length];
        }
        this.last=p;
        return p;
    }

    addLines(ctx,n,warn) {
        const L=this.def.lines;
        const b=ctx.room.bounds;
        const p=ctx.player;
        const flip=rng.next()<0.5;
        for (let j=0;j<n;j++) {
            const horiz=(j%2===0)!==flip;
            const off=j<2?0:rng.range(-L.spread,L.spread);
            if (horiz) {
                const z=Math.max(b.minZ+1,Math.min(b.maxZ-1,p.pos.z+off));
                this.hz.push({ax:b.minX,az:z,bx:b.maxX,bz:z,t:-j*L.stagger,warn,hit:false,boom:false});
            }
            else {
                const x=Math.max(b.minX+1,Math.min(b.maxX-1,p.pos.x+off));
                this.hz.push({ax:x,az:b.minZ,bx:x,bz:b.maxZ,t:-j*L.stagger,warn,hit:false,boom:false});
            }
        }
    }

    segHit(p,ax,az,bx,bz,w) {
        const sx=bx-ax;
        const sz=bz-az;
        const l2=sx*sx+sz*sz||1;
        const u=Math.max(0,Math.min(1,((p.pos.x-ax)*sx+(p.pos.z-az)*sz)/l2));
        const qx=p.pos.x-(ax+sx*u);
        const qz=p.pos.z-(az+sz*u);
        return Math.hypot(qx,qz)<w+TUNING.player.radius;
    }

    sweepSeg() {
        const S=this.def.sweep;
        const w=this.sweep;
        const f=Math.max(0,Math.min(1,(w.t-w.warn)/w.dur));
        const a=w.a0+w.dir*S.arc*EASE.easeInOutQuad(f);
        const cx=Math.cos(a);
        const cz=Math.sin(a);
        return {ax:this.pos.x+cx*S.inner,az:this.pos.z+cz*S.inner,bx:this.pos.x+cx*S.outer,bz:this.pos.z+cz*S.outer,f};
    }

    tickHazards(dt,ctx) {
        const L=this.def.lines;
        const p=ctx.player;
        for (let i=this.hz.length-1;i>=0;i--) {
            const h=this.hz[i];
            h.t+=dt;
            if (h.t>=h.warn&&!h.boom) {
                h.boom=true;
                ctx.fx.cameraShake(0.18);
                const n=6;
                for (let k=0;k<n;k++) {
                    const u=(k+0.5)/n;
                    ctx.particles.burst(h.ax+(h.bx-h.ax)*u,0.3,h.az+(h.bz-h.az)*u,3,{color:'ink',speed:[1,4],up:[2,4]});
                }
            }
            const live=h.live||L.live;
            if (h.t>=h.warn&&h.t<h.warn+live&&!h.hit&&this.segHit(p,h.ax,h.az,h.bx,h.bz,L.width)) {
                h.hit=true;
                p.noteDodge();
                p.hurt(1,h.bx===h.ax?Math.sign(p.pos.x-h.ax)||1:0,h.bz===h.az?Math.sign(p.pos.z-h.az)||1:0);
            }
            if (h.t>=h.warn+live+L.fade) {
                this.hz.splice(i,1);
            }
        }
        const w=this.sweep;
        if (w) {
            const S=this.def.sweep;
            w.t+=dt;
            const sg=this.sweepSeg();
            if (w.t>=w.warn&&w.t<w.warn+w.dur&&!w.hit&&this.segHit(p,sg.ax,sg.az,sg.bx,sg.bz,S.width)) {
                w.hit=true;
                p.noteDodge();
                p.hurt(1,-Math.sin(Math.atan2(sg.bz-sg.az,sg.bx-sg.ax))*w.dir,Math.cos(Math.atan2(sg.bz-sg.az,sg.bx-sg.ax))*w.dir);
            }
            if (w.t>=w.warn&&w.t<w.warn+w.dur&&rng.next()<0.5) {
                ctx.particles.burst(sg.bx,0.4,sg.bz,1,{color:'ink',speed:[1,3],up:[1,3]});
            }
            if (w.t>=w.warn+w.dur+S.fade) {
                this.sweep=null;
            }
        }
    }

    guardMult() {
        return this.guarded?this.def.seal.guard:1;
    }

    seal(ctx) {
        const S=this.def.seal;
        this.guarded=true;
        this.marks=[];
        this.pending=S.marks;
        const b=ctx.room.bounds;
        const a0=rng.range(0,Math.PI*2);
        for (let i=0;i<S.marks;i++) {
            const a=a0+i/S.marks*Math.PI*2;
            const x=Math.max(b.minX+1.5,Math.min(b.maxX-1.5,this.pos.x+Math.cos(a)*S.radius));
            const z=Math.max(b.minZ+1.5,Math.min(b.maxZ-1.5,this.pos.z+Math.sin(a)*S.radius));
            ctx.lobs.launch(this.pos.x,this.pos.z,x,z,S.flight,S.arc,(lx,lz)=>{
                this.pending--;
                if (!this.alive) {
                    return;
                }
                const m=ctx.enemyMgr.spawn('bookmark',lx,lz,{hpMult:1,quick:true});
                m.host=this;
                this.marks.push(m);
                ctx.fx.cameraShake(0.15);
                ctx.particles.burst(lx,0.3,lz,8,{color:'ink',speed:[1,4],up:[2,4]});
            });
        }
        this.say={text:t('bookFinal.seal'),t:0,dur:2.2,keep:true};
        this.sqv+=3;
    }

    checkGuard() {
        if (this.guarded&&this.pending<=0&&this.marks.every(m=>!m.alive)) {
            this.guarded=false;
            this.marks=[];
            this.say={text:t('bookFinal.broken'),t:0,dur:2,keep:true};
            this.sqv+=4;
            this.flashT=0.2;
        }
    }

    rest() {
        this.restN=(this.restN||0)+1;
        this.setState(this.restN%this.def.restEvery===0?'rest':'pause');
    }

    think(dt,ctx) {
        const d=this.def;
        const p=ctx.player;
        this.tickHazards(dt,ctx);
        const pg=Math.max(this.page,this.pageOf());
        if (pg!==this.page) {
            this.page=pg;
            if (pg===1) {
                this.seal(ctx);
            }
        }
        this.manual=true;
        this.vel.set(0,0,0);
        this.aimX=this.nx;
        this.aimZ=this.nz;
        this.checkGuard();
        if (this.state==='pause') {
            if (this.stateT>=d.pauseTime) {
                this.setState('move');
                this.patternT=rng.range(0.3,0.6);
            }
            return;
        }
        if (this.state==='move') {
            this.patternT-=dt*(1+this.page*0.15);
            if (this.patternT<=0) {
                this.pattern=this.choose();
                this.setState('telegraph');
                if (this.pattern==='wall') {
                    this.teleLine(this.nx,this.nz,14,0.8,3,0.9);
                }
                else if (this.pattern==='sweep') {
                    this.teleRing(d.sweep.inner,0.5);
                }
                else if (this.pattern==='scribble') {
                    this.scribbles=0;
                    this.teleLine(this.nx,this.nz,13,d.scribble.tele);
                    this.dx=this.nx;
                    this.dz=this.nz;
                }
                else {
                    this.teleRing(2.6,0.5);
                }
            }
            return;
        }
        if (this.state==='telegraph') {
            if (this.pattern==='scribble'&&this.stateT<this.tele.dur*0.55) {
                this.dx=this.nx;
                this.dz=this.nz;
                this.tele.dx=this.dx;
                this.tele.dz=this.dz;
            }
            if (this.pattern==='scribble') {
                this.aimX=this.dx;
                this.aimZ=this.dz;
            }
            if (this.stateT>=this.tele.dur) {
                this.tele=null;
                this.setState('attack');
                this.volley=0;
                this.fireAcc=0;
                this.sx=this.pos.x;
                this.sz=this.pos.z;
                if (this.pattern==='lines') {
                    this.addLines(ctx,d.lines.count[this.page],d.lines.warn);
                }
                else if (this.pattern==='sweep') {
                    const S=d.sweep;
                    const dir=rng.sign();
                    this.sweep={a0:Math.atan2(this.nz,this.nx)-dir*S.arc/2,dir,t:0,warn:S.warn,dur:S.dur*(1-this.page*0.12),hit:false};
                }
            }
            return;
        }
        if (this.state==='attack') {
            const sp=1+this.page*0.08;
            if (this.pattern==='lines') {
                if (this.hz.length===0) {
                    this.rest();
                }
            }
            else if (this.pattern==='sweep') {
                if (!this.sweep) {
                    this.rest();
                }
            }
            else if (this.pattern==='scribble') {
                const S=d.scribble;
                this.aimX=this.dx;
                this.aimZ=this.dz;
                this.vel.set(this.dx*S.speed,0,this.dz*S.speed);
                if (rng.next()<0.6) {
                    ctx.particles.burst(this.pos.x,0.3,this.pos.z,1,{color:'ink',speed:[0.5,2],up:[0.5,2]});
                }
                const blocked=this.stateT>0.15&&this.speedFrac<0.3;
                if (blocked||this.stateT>=S.time) {
                    this.vel.set(0,0,0);
                    this.hz.push({ax:this.sx,az:this.sz,bx:this.pos.x,bz:this.pos.z,t:0,warn:0.12,hit:false,boom:false,live:S.live});
                    this.scribbles++;
                    ctx.fx.cameraShake(blocked?0.35:0.15);
                    if (this.scribbles<S.count) {
                        this.setState('telegraph');
                        this.teleLine(this.nx,this.nz,13,S.tele2);
                        this.dx=this.nx;
                        this.dz=this.nz;
                    }
                    else {
                        this.rest();
                    }
                }
            }
            else if (this.pattern==='mimicScatter') {
                const M=d.mimicScatter;
                this.fireAcc+=dt;
                if (this.fireAcc>=M.every||this.volley===0) {
                    this.fireAcc=0;
                    const base=Math.atan2(this.nz,this.nx);
                    for (let i=0;i<M.count;i++) {
                        const a=base+(i/(M.count-1)-0.5)*M.spread;
                        ctx.enemyBullets.spawn(this.pos.x+Math.cos(a)*2,this.pos.z+Math.sin(a)*2,Math.cos(a),Math.sin(a),M.speed*sp,d.bulletDamage,d.bulletLife);
                    }
                    this.volley++;
                    if (this.volley>=M.volleys+(this.page>=2?1:0)) {
                        this.rest();
                    }
                }
            }
            else if (this.pattern==='mimicBomb') {
                const B=d.mimicBomb;
                if (this.volley===0) {
                    this.volley=1;
                    const n=B.count[this.page];
                    this.bombs=[];
                    for (let i=0;i<n;i++) {
                        const x=p.pos.x+(i===0?0:rng.range(-5,5));
                        const z=p.pos.z+(i===0?0:rng.range(-4,4));
                        const tt=B.delay+i*B.stagger;
                        this.bombs.push({x,z,t:tt});
                        ctx.dangerRings.spawn(x,z,B.r,'red',tt);
                    }
                }
                for (let i=this.bombs.length-1;i>=0;i--) {
                    const q=this.bombs[i];
                    if (this.stateT>=q.t) {
                        if (this.page>=2) {
                            fireRing(ctx,q.x,q.z,B.ring,rng.range(0,1),B.speed,d.bulletDamage,B.life);
                        }
                        ctx.particles.burst(q.x,0.4,q.z,14,{color:'ink',speed:[3,7],up:[2,6],size:[0.1,0.22]});
                        if (Math.hypot(p.pos.x-q.x,p.pos.z-q.z)<B.r) {
                            p.hurt(1,0,1);
                        }
                        this.bombs.splice(i,1);
                    }
                }
                if (this.bombs.length===0) {
                    this.rest();
                }
            }
            else {
                super.think(dt,ctx);
            }
            return;
        }
        if (this.state==='rest') {
            if (this.stateT>=d.restTime) {
                this.setState('move');
                this.patternT=rng.range(0.5,0.9);
            }
        }
    }

    sync(alpha,dt) {
        super.sync(alpha,dt);
        const L=this.def.lines;
        let si=0;
        let li=8;
        const put=(m,ax,az,bx,bz,w)=>{
            const dx=bx-ax;
            const dz=bz-az;
            const len=Math.hypot(dx,dz);
            m.visible=true;
            m.position.set(ax,0.05,az);
            m.rotation.y=Math.atan2(-dz,dx);
            m.scale.set(Math.max(0.01,len),1,w);
            m.material.uniforms.uLength.value=len;
        };
        for (const h of this.hz) {
            if (h.t<0) {
                continue;
            }
            if (h.t<h.warn) {
                const k=Math.min(1,h.t/(h.warn*0.6));
                const mx=(h.ax+h.bx)/2;
                const mz=(h.az+h.bz)/2;
                const m=this.line(li++);
                put(m,mx+(h.ax-mx)*k,mz+(h.az-mz)*k,mx+(h.bx-mx)*k,mz+(h.bz-mz)*k,0.22);
            }
            else {
                const m=this.strip(si++);
                put(m,h.ax,h.az,h.bx,h.bz,L.width*2.2);
                m.material.uniforms.uAlpha.value=Math.max(0,Math.min(1,1-(h.t-h.warn-(h.live||L.live))/L.fade));
            }
        }
        const w=this.sweep;
        if (w) {
            const sg=this.sweepSeg();
            if (w.t<w.warn) {
                const m=this.line(li++);
                put(m,sg.ax,sg.az,sg.bx,sg.bz,0.3);
                const a=w.a0+w.dir*this.def.sweep.arc;
                const m2=this.line(li++);
                put(m2,this.pos.x+Math.cos(a)*this.def.sweep.inner,this.pos.z+Math.sin(a)*this.def.sweep.inner,this.pos.x+Math.cos(a)*this.def.sweep.outer,this.pos.z+Math.sin(a)*this.def.sweep.outer,0.12);
            }
            else {
                const m=this.strip(si++);
                put(m,sg.ax,sg.az,sg.bx,sg.bz,this.def.sweep.width*2.4);
                m.material.uniforms.uAlpha.value=Math.max(0,Math.min(1,1-(w.t-w.warn-w.dur)/this.def.sweep.fade));
            }
        }
        for (let i=si;i<this.strips.length;i++) {
            this.strips[i].visible=false;
        }
    }

    colliders(ctx) {
        return ctx.room.colliders;
    }

    canContact() {
        return true;
    }

    pose() {
        const tm=time.real;
        const rest=this.state==='rest';
        const dash=this.pattern==='scribble'&&this.state==='attack';
        const lean=dash?0.55:(rest?0.4:Math.sin(tm*1.3)*0.08);
        this.pen.rotation.x+=(lean-this.pen.rotation.x)*0.4;
        this.pen.position.y=(rest?0.1:0.5)+Math.sin(tm*1.8)*0.1;
        this.orbs.rotation.y=tm*(this.guarded?3:1.2);
        this.orbs.position.y=Math.sin(tm*2.4)*0.15;
        this.crown.rotation.y=tm*(this.guarded?2.4:0.6);
        const pulse=rest?1.3+Math.sin(tm*14)*0.2:1;
        this.mark.scale.set(pulse,pulse,pulse);
    }
}

function rayHit(p,ox,oz,a,r0,r1,w) {
    const cx=Math.cos(a);
    const cz=Math.sin(a);
    const qx=p.pos.x-ox;
    const qz=p.pos.z-oz;
    const u=Math.max(r0,Math.min(r1,qx*cx+qz*cz));
    return Math.hypot(qx-cx*u,qz-cz*u)<w+TUNING.player.radius;
}

function handAngle(a) {
    return Math.atan2(-Math.cos(a),-Math.sin(a));
}

class Alarm extends Enemy {
    buildBody() {
        const body=this.mat('body');
        const head=this.mat('head');
        const limb=this.mat('limb');
        const ink=this.inkMat();
        const red=unlitMaterial({color:'red'});
        this.clock=new THREE.Group();
        this.clock.position.y=2.05;
        this.clock.add(this.hullify(new THREE.Mesh(geo('alCase',()=>new THREE.CylinderGeometry(1.55,1.55,1.0,24).rotateX(Math.PI/2)),body)));
        const rim=new THREE.Mesh(geo('alRim',()=>new THREE.TorusGeometry(1.42,0.1,6,28)),ink);
        rim.position.z=0.5;
        this.clock.add(rim);
        const face=new THREE.Mesh(geo('alFace',()=>new THREE.CircleGeometry(1.36,28)),head);
        face.position.z=0.505;
        this.clock.add(face);
        this.blush=new THREE.Mesh(geo('alBlush',()=>new THREE.CircleGeometry(1.34,28)),red);
        this.blush.position.z=0.512;
        this.clock.add(this.blush);
        for (let i=0;i<12;i++) {
            const big=i%3===0;
            const m=new THREE.Mesh(geo(big?'alTickB':'alTick',()=>new THREE.BoxGeometry(big?0.1:0.06,big?0.28:0.15,0.02)),ink);
            const a=i/12*Math.PI*2;
            m.position.set(Math.sin(a)*1.14,Math.cos(a)*1.14,0.52);
            m.rotation.z=-a;
            this.clock.add(m);
        }
        const hand=(key,w,len,m)=>{
            const g=new THREE.Group();
            g.position.z=0.53;
            const h=new THREE.Mesh(geo(key,()=>new THREE.BoxGeometry(w,len,0.03).translate(0,len/2-0.12,0)),m);
            g.add(h);
            this.clock.add(g);
            return g;
        };
        this.hHand=hand('alHour',0.14,0.78,ink);
        this.mHand=hand('alMin',0.09,1.12,ink);
        this.sHand=hand('alSec',0.04,1.22,red);
        this.sHand.position.z=0.545;
        const cap=new THREE.Mesh(geo('alCap',()=>new THREE.CylinderGeometry(0.1,0.1,0.06,10).rotateX(Math.PI/2)),ink);
        cap.position.z=0.56;
        this.clock.add(cap);
        for (const sx of [-1,1]) {
            const e=new THREE.Mesh(geo('alEye',()=>new THREE.SphereGeometry(0.11,8,6)),ink);
            e.position.set(sx*0.48,0.3,0.54);
            e.scale.set(1,1.3,0.4);
            this.clock.add(e);
            const br=new THREE.Mesh(geo('alBrow',()=>new THREE.BoxGeometry(0.36,0.07,0.03)),ink);
            br.position.set(sx*0.46,0.55,0.55);
            br.rotation.z=-sx*0.45;
            this.clock.add(br);
        }
        const mouth=new THREE.Mesh(geo('alMouth',()=>new THREE.BoxGeometry(0.42,0.06,0.03)),ink);
        mouth.position.set(0,-0.55,0.55);
        this.clock.add(mouth);
        this.bells=[];
        for (const sx of [-1,1]) {
            const g=new THREE.Group();
            g.position.set(sx*0.95,1.3,0);
            g.userData.base=-sx*0.5;
            g.rotation.z=g.userData.base;
            const dome=this.hullify(new THREE.Mesh(geo('alBell',()=>new THREE.SphereGeometry(0.62,14,8,0,Math.PI*2,0,Math.PI/2)),limb));
            dome.position.y=0.05;
            g.add(dome);
            const knob=new THREE.Mesh(geo('alKnob',()=>new THREE.SphereGeometry(0.12,8,6)),ink);
            knob.position.y=0.7;
            g.add(knob);
            this.clock.add(g);
            this.bells.push(g);
        }
        this.hammer=new THREE.Group();
        this.hammer.position.y=1.45;
        const stick=new THREE.Mesh(geo('alStick',()=>new THREE.BoxGeometry(0.07,0.5,0.07).translate(0,0.25,0)),ink);
        this.hammer.add(stick);
        const ball=new THREE.Mesh(geo('alBall',()=>new THREE.SphereGeometry(0.13,8,6)),red);
        ball.position.y=0.52;
        this.hammer.add(ball);
        this.clock.add(this.hammer);
        for (const sx of [-1,1]) {
            const f=this.hullify(new THREE.Mesh(geo('alFoot',()=>new THREE.ConeGeometry(0.22,0.6,6)),limb));
            f.position.set(sx*0.95,-1.55,0);
            f.rotation.z=sx*0.5;
            this.clock.add(f);
        }
        this.body.add(this.clock);
    }

    onReset() {
        this.bar=0;
        this.beams=[];
        this.waves=[];
        this.pads=[];
        this.lastPad=-1;
        this.relight=false;
        this.tickT=0;
        this.patternT=this.def.first;
        this.last=null;
        this.kicks=[0,0];
        this.faceT=0;
        this.lastDing=-9;
        this.burstDmg=0;
        this.snoozeT=0;
        this.homeX=this.pos.x;
        this.homeZ=this.pos.z;
        this.hop=null;
        this.hopQ=[];
        this.hopY=0;
        this.airborne=false;
        this.warnMeshes=this.warnMeshes||[];
        this.waveMeshes=this.waveMeshes||[];
        this.padMeshes=this.padMeshes||[];
    }

    get alarmBar() {
        return this.bar;
    }

    sfx(ctx,n,p=1) {
        if (ctx.sfx) {
            ctx.sfx(n,p);
        }
    }

    waveMesh(i) {
        while (this.waveMeshes.length<=i) {
            const m=new THREE.Mesh(geo('ring',()=>new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2)),ringMaterial('ink'));
            m.visible=false;
            m.frustumCulled=false;
            m.position.y=0.06;
            this.fxScene.add(m);
            this.waveMeshes.push(m);
        }
        return this.waveMeshes[i];
    }

    warnMesh(i) {
        while (this.warnMeshes.length<=i) {
            const m=new THREE.Mesh(geo('ring',()=>new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2)),ringMaterial('red'));
            m.visible=false;
            m.frustumCulled=false;
            m.position.y=0.05;
            this.fxScene.add(m);
            this.warnMeshes.push(m);
        }
        return this.warnMeshes[i];
    }

    padMesh(i) {
        while (this.padMeshes.length<=i) {
            const g=geo('ring',()=>new THREE.PlaneGeometry(2,2).rotateX(-Math.PI/2));
            const mk=(m,y)=>{
                const q=new THREE.Mesh(g,m);
                q.visible=false;
                q.frustumCulled=false;
                q.position.y=y;
                this.fxScene.add(q);
                return q;
            };
            const fill=mk(ringMaterial('red'),0.04);
            fill.material.uniforms.uWidth.value=2;
            const edge=mk(ringMaterial('red'),0.05);
            edge.material.uniforms.uWidth.value=0.1;
            edge.material.uniforms.uDash.value=12;
            const prog=mk(trapMaterial('red',true),0.06);
            this.padMeshes.push({fill,edge,prog});
        }
        return this.padMeshes[i];
    }

    hideFx() {
        for (const m of this.warnMeshes||[]) {
            m.visible=false;
        }
        for (const m of this.waveMeshes||[]) {
            m.visible=false;
        }
        for (const q of this.padMeshes||[]) {
            q.fill.visible=false;
            q.edge.visible=false;
            q.prog.visible=false;
        }
    }

    hide() {
        super.hide();
        this.beams=[];
        this.waves=[];
        this.pads=[];
        this.hideFx();
    }

    clearHazards() {
        this.beams=[];
        this.waves=[];
        this.tele=null;
        if (this.hop) {
            this.pos.x=this.hop.tx;
            this.pos.z=this.hop.tz;
        }
        this.hop=null;
        this.hopQ=[];
        this.hopY=0;
        this.airborne=false;
    }

    canContact() {
        return !this.airborne;
    }

    nextHop(ctx) {
        const H=this.def.hop;
        const q=this.hopQ.shift();
        const b=ctx.room.bounds;
        const p=ctx.player.pos;
        const home=q==='home';
        const tx=home?this.homeX:Math.max(b.minX+H.margin,Math.min(b.maxX-H.margin,p.x));
        const tz=home?this.homeZ:Math.max(b.minZ+H.margin,Math.min(b.maxZ-H.margin,p.z));
        this.hop={sx:this.pos.x,sz:this.pos.z,tx,tz,t:0,tele:H.tele*(home?H.homeTele:1)};
        ctx.dangerRings.spawn(tx,tz,H.r,'red',this.hop.tele+H.air);
        this.kicks[0]=0.8;
        this.kicks[1]=0.8;
        this.sfx(ctx,'alarmTick',0.7);
    }

    hopTick(dt,ctx) {
        const H=this.def.hop;
        const h=this.hop;
        h.t+=dt;
        if (h.t<h.tele) {
            this.sq=Math.max(this.sq,-0.25*Math.min(1,h.t/h.tele));
            return;
        }
        const f=Math.min(1,(h.t-h.tele)/H.air);
        this.pos.x=h.sx+(h.tx-h.sx)*f;
        this.pos.z=h.sz+(h.tz-h.sz)*f;
        this.hopY=Math.sin(f*Math.PI)*H.height;
        this.airborne=f<1;
        if (f<1) {
            return;
        }
        this.hopY=0;
        this.sqv+=5;
        ctx.fx.cameraShake(0.4);
        ctx.particles.burst(h.tx,0.4,h.tz,18,{color:'ink',speed:[3,8],up:[2,5]});
        this.sfx(ctx,'alarmBell',0.7);
        const p=ctx.player;
        const dx=p.pos.x-h.tx;
        const dz=p.pos.z-h.tz;
        const l=Math.hypot(dx,dz);
        if (l<H.r+TUNING.player.radius) {
            this.harm(ctx,dx/(l||1),dz/(l||1),false);
        }
        this.waves.push({x:h.tx,z:h.tz,r:H.r*0.6,speed:H.wave.speed,max:H.wave.max,width:H.wave.width,hit:false,delay:0});
        this.hop=null;
        if (this.hopQ.length) {
            this.nextHop(ctx);
        }
    }

    onEvolveStart() {
        this.clearHazards();
        this.pads=[];
        this.relight=false;
    }

    damageMult() {
        return this.state==='snooze'?this.def.weakMult:1;
    }

    stun(t,full) {
        if (this.state==='snooze'||this.state==='burst'||this.airborne) {
            return;
        }
        super.stun(t,full);
    }

    edgePulse() {
        const B=this.def.bar;
        if (!this.alive||this.state==='spawn') {
            return 0;
        }
        if (this.state==='burst') {
            return 0.3+0.12*Math.sin(time.real*18);
        }
        if (this.bar<B.show) {
            return 0;
        }
        const k=(this.bar-B.show)/(B.max-B.show);
        return (0.06+0.22*k)*Math.pow(Math.max(0,Math.sin(time.real*(3+k*6)*Math.PI)),2);
    }

    ding(ctx,p=1) {
        if (this.t-this.lastDing<0.3) {
            return;
        }
        this.lastDing=this.t;
        this.kicks[0]=1;
        this.kicks[1]=1;
        this.sfx(ctx,'alarmBell',p);
    }

    beam(o) {
        const b={a:0,speed:0,warn:1,dur:1,width:0.4,thin:false,gap:null,len:24,inner:1.9,flip:false,flipped:false,rang:false,role:null,burst:false,boom:false,t:0,cd:0,...o};
        this.beams.push(b);
        return b;
    }

    segs(b) {
        return b.gap?[[b.inner,b.gap[0]],[b.gap[1],b.len]]:[[b.inner,b.len]];
    }

    harm(ctx,dx,dz,burst) {
        if (burst&&this.burstDmg>=this.def.burst.cap) {
            return false;
        }
        const p=ctx.player;
        p.noteDodge();
        const ok=p.hurt(1,dx,dz);
        if (ok&&burst) {
            this.burstDmg++;
        }
        return ok;
    }

    tickHazards(dt,ctx) {
        const d=this.def;
        const p=ctx.player;
        const ox=this.pos.x;
        const oz=this.pos.z;
        for (let i=this.beams.length-1;i>=0;i--) {
            const b=this.beams[i];
            b.t+=dt;
            b.cd=Math.max(0,b.cd-dt);
            if (b.t>=b.warn&&b.t<b.warn+b.dur) {
                if (!b.boom) {
                    b.boom=true;
                    if (b.loud) {
                        this.ding(ctx,1.2);
                        ctx.fx.cameraShake(0.25);
                    }
                }
                if (b.flip&&!b.flipped) {
                    const half=b.warn+b.dur/2;
                    if (!b.rang&&b.t>=half-d.p2.flipWarn) {
                        b.rang=true;
                        this.ding(ctx,0.9);
                    }
                    if (b.t>=half) {
                        b.flipped=true;
                        b.speed=-b.speed;
                    }
                }
                b.a+=b.speed*dt;
                if (b.cd<=0) {
                    for (const [r0,r1] of this.segs(b)) {
                        if (rayHit(p,ox,oz,b.a,r0,r1,b.width)) {
                            const s=Math.sign(b.speed)||(((p.pos.x-ox)*-Math.sin(b.a)+(p.pos.z-oz)*Math.cos(b.a))>0?1:-1);
                            if (this.harm(ctx,-Math.sin(b.a)*s,Math.cos(b.a)*s,b.burst)) {
                                b.cd=d.hitCool;
                            }
                            break;
                        }
                    }
                }
            }
            if (b.t>=b.warn+b.dur+0.25) {
                this.beams.splice(i,1);
            }
        }
        for (let i=this.waves.length-1;i>=0;i--) {
            const w=this.waves[i];
            if (w.delay>0) {
                w.delay-=dt;
                if (w.delay<=0) {
                    if (w.bell) {
                        this.kicks[0]=1;
                        this.kicks[1]=1;
                    }
                    this.sfx(ctx,'alarmBell',1);
                    ctx.fx.cameraShake(w.burst?0.45:0.15);
                }
                continue;
            }
            w.r+=w.speed*dt;
            const dist=Math.hypot(p.pos.x-w.x,p.pos.z-w.z);
            if (!w.hit&&Math.abs(dist-w.r)<w.width+TUNING.player.radius) {
                const l=dist||1;
                if (this.harm(ctx,(p.pos.x-w.x)/l,(p.pos.z-w.z)/l,w.burst)) {
                    w.hit=true;
                }
            }
            if (w.r>=w.max) {
                this.waves.splice(i,1);
            }
        }
    }

    beamBlocks(x,z) {
        const a=Math.atan2(z-this.pos.z,x-this.pos.x);
        return this.beams.some(b=>Math.abs(wrap(b.a-a))<this.def.pad.avoid||(b.speed!==0&&Math.abs(wrap(b.a+b.speed*0.8-a))<this.def.pad.avoid));
    }

    corners(ctx) {
        const P=this.def.pad;
        const b=ctx.room.bounds;
        const out=[];
        for (const [sx,sz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) {
            const v=new THREE.Vector3(sx<0?b.minX+P.inset:b.maxX-P.inset,0,sz<0?b.minZ+P.inset:b.maxZ-P.inset);
            resolveCircle(v,P.r*0.6,ctx.room.colliders,3);
            clampToBounds(v,P.inset-0.4,b);
            out.push(v);
        }
        return out;
    }

    spawnPads(ctx) {
        const P=this.def.pad;
        const p=ctx.player;
        const cs=this.corners(ctx);
        const far=i=>Math.hypot(cs[i].x-p.pos.x,cs[i].z-p.pos.z)>=P.minDist;
        const free=i=>!this.beamBlocks(cs[i].x,cs[i].z);
        let pick=[];
        {
            const all=[0,1,2,3].filter(i=>i!==this.lastPad);
            const tries=[i=>far(i)&&free(i),far,free,()=>true];
            let c=[];
            for (const f of tries) {
                c=all.filter(f);
                if (c.length) {
                    break;
                }
            }
            const i=c[Math.floor(rng.next()*c.length)];
            this.lastPad=i;
            pick=[i];
        }
        const need=this.evolved?P.hold2:P.hold;
        this.pads=pick.map(i=>({x:cs[i].x,z:cs[i].z,hold:0,need,done:false,t:0}));
        this.relight=false;
        this.tickT=0;
        for (const q of this.pads) {
            ctx.particles.burst(q.x,0.3,q.z,10,{color:'red',speed:[2,5],up:[2,5]});
        }
        if (ctx.notice) {
            ctx.notice(t('alarm.padHint'));
        }
    }

    tickBar(dt,ctx) {
        const B=this.def.bar;
        if (this.state==='snooze'||this.state==='burst') {
            return;
        }
        this.bar=Math.min(B.max,this.bar+(this.evolved?B.rate2:B.rate)*dt);
        if (this.bar>=B.max) {
            this.startBurst(ctx);
            return;
        }
        if (!this.pads.length&&(this.bar>=B.show||this.relight)) {
            this.spawnPads(ctx);
        }
        if (this.pads.length) {
            const k=Math.max(0,Math.min(1,(this.bar-B.show)/(B.max-B.show)));
            this.tickT-=dt;
            if (this.tickT<=0) {
                this.tickT=B.tick[0]+(B.tick[1]-B.tick[0])*k;
                this.sfx(ctx,'alarmTick',B.pitch[0]+(B.pitch[1]-B.pitch[0])*k);
            }
        }
    }

    guardPads(ctx) {
        const P=this.def.pad;
        const p=ctx.player;
        if (this.state==='snooze'||this.state==='burst') {
            return;
        }
        for (const q of this.pads) {
            if (!q.done&&Math.hypot(p.pos.x-q.x,p.pos.z-q.z)<P.r) {
                p.safeT=Math.max(p.safeT||0,P.safe);
            }
        }
    }

    tickPads(dt,ctx) {
        if (!this.pads.length||this.state==='snooze'||this.state==='burst') {
            return;
        }
        const P=this.def.pad;
        const p=ctx.player;
        let done=0;
        for (const q of this.pads) {
            q.t+=dt;
            if (!q.done) {
                const inside=Math.hypot(p.pos.x-q.x,p.pos.z-q.z)<P.r;
                q.hold=inside?q.hold+dt:Math.max(0,q.hold-dt*P.decay);
                if (q.hold>=q.need) {
                    q.done=true;
                    q.hold=q.need;
                    this.sfx(ctx,'alarmPress',1+done*0.15);
                    ctx.particles.burst(q.x,0.4,q.z,16,{color:'red',speed:[3,7],up:[2,6]});
                }
            }
            if (q.done) {
                done++;
            }
        }
        if (done>=this.pads.length) {
            this.snooze(ctx);
        }
    }

    snooze(ctx) {
        const S=this.def.snooze;
        this.clearHazards();
        this.pads=[];
        this.stunT=0;
        this.lockT=0;
        this.bar=0;
        this.snoozeT=this.evolved?S.time2:S.time;
        if (ctx.addInk) {
            ctx.addInk(S.ink);
        }
        this.setState('snooze');
        this.say={text:t('alarm.snooze'),t:0,dur:this.snoozeT,keep:true};
        this.sqv-=4;
        this.flashT=0.15;
        ctx.fx.cameraShake(0.2);
        ctx.particles.burst(this.pos.x,3,this.pos.z,14,{color:'paper',speed:[1,3],up:[2,4]});
    }

    startBurst(ctx) {
        const B=this.def.burst;
        this.clearHazards();
        this.pads=[];
        this.burstDmg=0;
        this.burstOn=false;
        this.burstBell=0;
        this.setState('burst');
        this.teleRing(3.4,B.warn);
        this.say={text:t('alarm.burst'),t:0,dur:B.warn+B.time,keep:true};
        this.sfx(ctx,'alarmBurst');
        ctx.fx.cameraShake(0.35);
        this.sqv+=5;
    }

    burstTick(dt,ctx) {
        const d=this.def;
        const B=d.burst;
        if (!this.burstOn&&this.stateT>=B.warn) {
            this.burstOn=true;
            this.tele=null;
            this.waves.push({x:this.pos.x,z:this.pos.z,r:d.radius,speed:B.speed,max:B.max,width:B.width,hit:false,burst:true,delay:0.001});
            const n=(this.evolved?d.p2.beams:2)*B.mult;
            const a0=rng.range(0,Math.PI*2);
            const dir=rng.sign();
            for (let i=0;i<n;i++) {
                this.beam({a:a0+i/n*Math.PI*2,speed:dir*B.spin,warn:B.warn,dur:B.time,width:B.width2,len:B.len,inner:B.inner,burst:true,t:-B.beamDelay});
            }
            ctx.particles.burst(this.pos.x,2,this.pos.z,30,{color:'red',speed:[5,12],up:[2,8]});
        }
        if (this.burstOn) {
            this.burstBell-=dt;
            if (this.burstBell<=0&&this.beams.length) {
                this.burstBell=0.5;
                this.kicks[0]=1;
                this.kicks[1]=1;
                this.sfx(ctx,'alarmBell',1.25);
            }
            if (!this.beams.length&&!this.waves.length) {
                this.bar=d.bar.after;
                this.relight=true;
                this.say=null;
                this.setState('move');
                this.patternT=d.gap[1];
            }
        }
    }

    startPattern(ctx) {
        const d=this.def;
        const ev=this.evolved;
        const sp=ev?d.p2.speed:1;
        const away=Math.hypot(this.pos.x-this.homeX,this.pos.z-this.homeZ)>1.5;
        const list=['second','hands','chime','bells','hop'];
        let k=away?'hop':list[Math.floor(rng.next()*list.length)];
        if (k===this.last&&!away) {
            k=list[(list.indexOf(k)+1)%list.length];
        }
        this.last=k;
        this.pattern=k;
        this.setState('attack');
        if (k==='second') {
            const S=d.second;
            const dir=rng.sign();
            this.beam({a:Math.atan2(this.nz,this.nx)-dir*0.9,speed:dir*Math.PI*2/S.period*sp,warn:S.warn,dur:S.period*S.turns/sp,width:S.width,thin:true,len:S.len,inner:S.inner,flip:ev,role:'s'});
            this.sfx(ctx,'alarmTick',0.8);
        }
        else if (k==='hop') {
            const H=d.hop;
            this.hopQ=[];
            if (!away) {
                for (let i=0;i<(ev?H.count2:H.count);i++) {
                    this.hopQ.push('player');
                }
            }
            this.hopQ.push('home');
            this.nextHop(ctx);
        }
        else if (k==='hands') {
            const H=d.hands;
            const n=ev?d.p2.beams:2;
            const g=rng.range(H.gap[0],H.gap[1]);
            const a0=rng.range(0,Math.PI*2);
            const step=n===2?Math.PI/2:Math.PI*2/n;
            for (let i=0;i<n;i++) {
                this.beam({a:a0+i*step,speed:H.speeds[i]*sp,warn:H.warn,dur:H.dur,width:H.width,gap:[g-H.gapW/2,g+H.gapW/2],len:H.len,inner:H.inner,flip:ev,role:['h','m',null][i]});
            }
        }
        else if (k==='chime') {
            const C=d.chime;
            const h=C.hours[0]+Math.floor(rng.next()*(C.hours[1]-C.hours[0]+1));
            const ang=[[-Math.PI/2+h/12*Math.PI*2,'h'],[-Math.PI/2,'m']];
            let text=h+':00';
            if (ev) {
                const ok=[];
                for (let s=0;s<60;s+=5) {
                    const a=-Math.PI/2+s/60*Math.PI*2;
                    if (ang.every(([b])=>Math.abs(wrap(a-b))>0.7)) {
                        ok.push([s,a]);
                    }
                }
                const [s,a]=ok[Math.floor(rng.next()*ok.length)];
                ang.push([a,'s']);
                text+=':'+String(s).padStart(2,'0');
            }
            for (const [a,role] of ang) {
                this.beam({a,warn:C.show,dur:C.live,width:role==='s'?d.second.width*2:C.width,thin:role==='s',len:C.len,inner:C.inner,role,loud:true});
            }
            this.say={text,t:0,dur:C.show+C.live,keep:true};
            this.sfx(ctx,'alarmTick',1.3);
        }
        else {
            const B=d.bells;
            this.waves.push({x:this.pos.x,z:this.pos.z,r:0.8,speed:B.speed*(ev?d.p2.speed:1),max:B.max,width:B.width,hit:false,delay:B.tele,warn:B.tele,bell:true});
            this.kicks[0]=0.6;
            this.kicks[1]=0.6;
            this.sfx(ctx,'alarmTick',1.1);
        }
    }

    update(dt,ctx) {
        this.thought=false;
        super.update(dt,ctx);
        if (!this.thought&&this.alive&&this.state!=='spawn'&&!this.evolving&&!this.dummy) {
            this.guardPads(ctx);
            this.tickPads(dt,ctx);
        }
    }

    think(dt,ctx) {
        const d=this.def;
        this.thought=true;
        this.manual=true;
        this.vel.set(0,0,0);
        this.aimX=0;
        this.aimZ=1;
        this.faceT+=this.state==='snooze'?0:dt;
        this.kicks[0]*=Math.exp(-5*dt);
        this.kicks[1]*=Math.exp(-5*dt);
        this.guardPads(ctx);
        this.tickHazards(dt,ctx);
        this.tickBar(dt,ctx);
        this.tickPads(dt,ctx);
        if (this.state==='snooze') {
            if (this.stateT>=this.snoozeT) {
                this.say=null;
                this.setState('move');
                this.patternT=d.gap[0];
            }
            return;
        }
        if (this.state==='burst') {
            this.burstTick(dt,ctx);
            return;
        }
        if (this.state==='move') {
            this.patternT-=dt;
            if (this.patternT<=0) {
                this.startPattern(ctx);
            }
            return;
        }
        if (this.state==='attack'&&this.hop) {
            this.hopTick(dt,ctx);
        }
        if (this.state==='attack'&&!this.beams.length&&!this.waves.length&&!this.hop) {
            this.setState('move');
            this.patternT=rng.range(d.gap[0],d.gap[1])+(this.pattern==='bells'?d.bells.rest:0);
        }
    }

    sync(alpha,dt) {
        super.sync(alpha,dt);
        const hy=this.hopY||0;
        this.root.position.y=hy;
        this.shadow.position.y=0.03-hy;
        this.shadow.scale.setScalar(this.def.radius*3.2*(1-0.4*hy/this.def.hop.height));
        const ox=this.pos.x;
        const oz=this.pos.z;
        let si=0;
        let li=8;
        const roles={h:null,m:null,s:null};
        for (const b of this.beams) {
            if (b.t<0) {
                continue;
            }
            const cx=Math.cos(b.a);
            const cz=Math.sin(b.a);
            if (b.role) {
                roles[b.role]=b.a;
            }
            if (b.t<b.warn) {
                const k=Math.min(1,b.t/(b.warn*0.5));
                for (const [r0,r1] of this.segs(b)) {
                    const r2=r0+(r1-r0)*k;
                    this.putLine(this.line(li++),ox+cx*r0,oz+cz*r0,ox+cx*r2,oz+cz*r2,b.thin?0.14:0.22);
                }
                if (b.speed!==0) {
                    const a2=b.a+Math.sign(b.speed)*0.2;
                    this.putLine(this.line(li++),ox+Math.cos(a2)*b.inner,oz+Math.sin(a2)*b.inner,ox+Math.cos(a2)*b.inner*3,oz+Math.sin(a2)*b.inner*3,0.08);
                }
            }
            else {
                const fade=Math.max(0,Math.min(1,1-(b.t-b.warn-b.dur)/0.25));
                for (const [r0,r1] of this.segs(b)) {
                    const m=this.strip(si++);
                    this.putLine(m,ox+cx*r0,oz+cz*r0,ox+cx*r1,oz+cz*r1,b.width*2.2);
                    m.material.uniforms.uAlpha.value=fade;
                }
            }
        }
        this.hideStrips(si);
        let wi=0;
        let ki=0;
        const BW=this.def.bells;
        for (const w of this.waves) {
            if (w.delay>0) {
                if (w.warn) {
                    const e=(w.warn-w.delay)/BW.warnCycle;
                    for (let j=0;j<BW.warnRings;j++) {
                        const f=(e+j/BW.warnRings)%1;
                        const m=this.warnMesh(ki++);
                        const R=w.r+f*BW.warnReach;
                        m.visible=true;
                        m.position.x=w.x;
                        m.position.z=w.z;
                        m.scale.set(R,1,R);
                        m.material.uniforms.uWidth.value=Math.min(2,BW.warnWidth*2/R);
                        m.material.uniforms.uAlpha.value=(1-f)*Math.min(1,e*3)*BW.warnAlpha;
                    }
                }
                continue;
            }
            const m=this.waveMesh(wi++);
            const R=w.r+w.width;
            m.visible=true;
            m.position.x=w.x;
            m.position.z=w.z;
            m.scale.set(R,1,R);
            m.material.uniforms.uWidth.value=Math.min(2,w.width*2/R);
            m.material.uniforms.uAlpha.value=Math.min(1,(w.max-w.r)/2);
        }
        for (let i=wi;i<this.waveMeshes.length;i++) {
            this.waveMeshes[i].visible=false;
        }
        for (let i=ki;i<this.warnMeshes.length;i++) {
            this.warnMeshes[i].visible=false;
        }
        const P=this.def.pad;
        const B=this.def.bar;
        const k=Math.max(0,Math.min(1,(this.bar-B.show)/(B.max-B.show)));
        for (let i=0;i<Math.max(this.pads.length,this.padMeshes.length);i++) {
            const q=this.pads[i];
            const pm=this.padMesh(i);
            if (!q) {
                pm.fill.visible=false;
                pm.edge.visible=false;
                pm.prog.visible=false;
                continue;
            }
            if (q.done) {
                q.out=(q.out||0)+dt;
            }
            const gone=q.done?Math.min(1,q.out/P.vanish):0;
            if (gone>=1) {
                pm.fill.visible=false;
                pm.edge.visible=false;
                pm.prog.visible=false;
                continue;
            }
            const pop=EASE.easeOutBack(Math.min(1,q.t/0.3));
            const r=P.r*pop*(1+gone*0.4);
            const blink=0.5+0.5*Math.sin(time.real*(6+k*14));
            for (const m of [pm.fill,pm.edge,pm.prog]) {
                m.visible=true;
                m.position.x=q.x;
                m.position.z=q.z;
            }
            pm.fill.scale.set(r,1,r);
            pm.fill.material.uniforms.uAlpha.value=q.done?0.45*(1-gone):0.12+0.2*blink;
            pm.edge.scale.set(r,1,r);
            pm.edge.material.uniforms.uAlpha.value=q.done?1-gone:0.55+0.45*blink;
            pm.edge.material.uniforms.uTime.value=time.real*0.6;
            pm.prog.scale.set(r*1.25,1,r*1.25);
            pm.prog.material.uniforms.uProgress.value=q.hold/q.need;
            pm.prog.material.uniforms.uAlpha.value=1-gone;
        }
        const bk=this.bar/this.def.bar.max;
        this.blush.visible=bk>0.02;
        this.blush.scale.setScalar(Math.max(0.01,bk));
        const ft=this.faceT;
        const sA=roles.s??-Math.PI/2+ft*Math.PI*2/6;
        const mA=roles.m??-Math.PI/2+ft*0.12;
        const hA=roles.h??-Math.PI/3+ft*0.01;
        this.sHand.rotation.z=handAngle(sA);
        this.mHand.rotation.z=handAngle(mA);
        this.hHand.rotation.z=handAngle(hA);
    }

    pose() {
        const tm=time.real;
        const k=this.bar/this.def.bar.max;
        const sleep=this.state==='snooze';
        const amp=this.state==='burst'?0.45:(sleep?0:k*k*0.4);
        const f=10+k*16;
        this.bells.forEach((b,i)=>{
            b.rotation.z=b.userData.base+Math.sin(tm*f+i*1.7)*amp+this.kicks[i]*Math.sin(tm*45+i)*0.35;
        });
        this.hammer.rotation.z=Math.sin(tm*f*1.3)*(amp+Math.max(this.kicks[0],this.kicks[1])*0.4)*1.4;
        this.clock.rotation.z=sleep?0.22:Math.sin(tm*f*0.5)*amp*0.2;
        this.clock.position.y=sleep?1.9+Math.sin(tm*2)*0.05:2.05+Math.abs(Math.sin(tm*f))*amp*0.25;
    }
}

const CLASSES={bookmark:Bookmark,stampSoldier:StampSoldier,scissorMinion:ScissorMinion,doodle:Doodle,sprayer:Sprayer,blob:Blob,blobSmall:Blob,compass:Compass,eraserMonster:EraserMonster,bird:Bird,inkCloud:InkCloud,inkBottle:InkBottle,scissors:Scissors,book:Book,exam:Exam,bookFinal:BookFinal,alarm:Alarm};

export class EnemyManager {
    constructor(parent,fxScene) {
        this.parent=parent;
        this.fxScene=fxScene;
        this.pools={};
        this.list=[];
        this.onKill=null;
        this.onHit=null;
        this.hpMult=1;
        this.act=0;
    }

    spawn(type,x,z,o={}) {
        const pool=this.pools[type]||(this.pools[type]=[]);
        let e=pool.find(q=>!q.alive&&!this.list.includes(q));
        if (!e) {
            const C=CLASSES[type];
            e=new C(type,ENEMIES[type],this.parent,this.fxScene);
            pool.push(e);
        }
        e.reset(x,z,{hpMult:o.hpMult??this.hpMult,quick:o.quick,act:this.act,elite:o.elite,dummy:o.dummy,immortal:o.immortal,tutor:o.tutor,tier:o.tier||0});
        this.list.push(e);
        if (this.onSpawned) {
            this.onSpawned(e);
        }
        return e;
    }

    clear() {
        for (const e of this.list) {
            e.hide();
        }
        this.list.length=0;
    }

    aliveCount() {
        return this.list.length;
    }

    boss() {
        for (const e of this.list) {
            if (e.def.boss) {
                return e;
            }
        }
        return null;
    }

    update(dt,ctx) {
        ctx.enemies=this.list;
        const arr=this.list.slice();
        const real=ctx.player;
        const D=this.decoy;
        if (D&&D.active) {
            if (!this.proxy||this.proxyOf!==real) {
                this.proxy=Object.create(real);
                this.proxy.vel=new THREE.Vector3();
                this.proxy.hurt=()=>false;
                this.proxyOf=real;
            }
            this.proxy.pos=D.fig.pos;
            ctx.player=this.proxy;
        }
        for (const e of arr) {
            if (e.alive) {
                e.update(e.def.boss?dt*TUNING.bossTempo*(1+e.tier*TUNING.bossScale.tempo):dt,ctx);
            }
        }
        ctx.player=real;
    }

    sync(alpha,dt) {
        for (const e of this.list) {
            e.sync(alpha,dt);
        }
    }

    slay(e) {
        if (!e.alive) {
            return false;
        }
        e.immortal=false;
        e.hp=0;
        this.kill(e,0,0,true);
        return true;
    }

    kill(e,dx,dz,clean=false) {
        e.hide();
        const i=this.list.indexOf(e);
        if (i>=0) {
            this.list.splice(i,1);
        }
        if (e.type==='scissorMinion'&&!clean) {
            for (const o of this.list) {
                if (o.type==='scissorMinion'&&o.alive) {
                    o.enrage();
                }
            }
        }
        if (this.onKill) {
            this.onKill(e,dx,dz);
        }
        const d=e.def;
        if (d.split&&!clean) {
            for (let k=0;k<d.splitCount;k++) {
                const a=Math.atan2(dz,dx)+(k===0?1.2:-1.2);
                this.spawn(d.split,e.pos.x+Math.cos(a)*0.7,e.pos.z+Math.sin(a)*0.7,{quick:true,dummy:e.dummy});
            }
        }
    }

    nearest(x,z,range,ground=false) {
        let best=null;
        let bd=range*range;
        for (const e of this.list) {
            if (e.state==='spawn'||(ground&&e.def.flying)) {
                continue;
            }
            const dx=e.pos.x-x;
            const dz=e.pos.z-z;
            const d=dx*dx+dz*dz;
            if (d<bd) {
                bd=d;
                best=e;
            }
        }
        return best;
    }

    damage(e,dmg,dx,dz,quiet=false,crit=false) {
        if (!e.alive) {
            return false;
        }
        if (e.shielded) {
            if (this.onBlock) {
                this.onBlock(e);
            }
            return false;
        }
        if (e.guardMult) {
            dmg*=e.guardMult();
        }
        if (e.vulnT>0) {
            dmg*=e.vulnMult;
        }
        if (this.dmgHook) {
            dmg=this.dmgHook(e,dmg);
        }
        let dead=e.hurt(dmg,dx,dz);
        if (dead&&e.immortal) {
            e.hp=e.maxHp;
            dead=false;
        }
        if (this.onDamage) {
            this.onDamage(e,dmg,crit);
        }
        if (this.onHit) {
            this.onHit(e,e.pos.x,e.pos.z,dx,dz,dead,quiet,crit);
        }
        if (dead) {
            this.kill(e,dx,dz);
        }
        return dead;
    }

    damageRadius(x,z,r,dmg) {
        const hit=[];
        for (const e of this.list) {
            if (e.state==='spawn') {
                continue;
            }
            const d=Math.hypot(e.pos.x-x,e.pos.z-z);
            if (d<=r+e.def.radius) {
                hit.push([e,d]);
            }
        }
        for (const [e,d] of hit) {
            const l=d||1;
            const f=1-Math.min(1,d/(r+e.def.radius))*0.5;
            this.damage(e,dmg*f,(e.pos.x-x)/l,(e.pos.z-z)/l);
        }
        return hit.length;
    }

    hitBullet(x,z,r,dmg,vx,vz,sys,bi) {
        for (const e of this.list) {
            if (e.state==='spawn') {
                continue;
            }
            if (sys&&sys.pierce&&sys.hasHit(bi,e.uid)) {
                continue;
            }
            const rr=e.def.radius+r;
            const ex=x-e.pos.x;
            const ez=z-e.pos.z;
            if (ex*ex+ez*ez<rr*rr) {
                const l=Math.hypot(vx,vz)||1;
                const m=e.damageMult(x,z);
                this.damage(e,dmg*m,vx/l,vz/l,false,m>1);
                return e;
            }
        }
        return null;
    }
}
