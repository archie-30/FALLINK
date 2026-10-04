import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {ENEMIES} from '../data/enemies.js';
import {toonMaterial,hullMaterial,unlitMaterial,lineMaterial,trapMaterial,inkMaterial,registerShadow,pal,renderFlags} from '../render/materials.js';
import {resolveCircle,clampToBounds,circleVs} from '../core/collision.js';
import {EASE} from '../core/easing.js';
import {RNG} from '../core/rng.js';
import {time} from '../core/loop.js';
import {t} from '../data/strings.js';

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
        this.elite=!!o.elite;
        this.dummy=!!o.dummy;
        this.immortal=!!o.immortal;
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
    }

    teleRing(r,dur) {
        this.tele={type:'ring',r,dur,t:0};
    }

    hurt(dmg,dx,dz) {
        const F=TUNING.feel;
        const km=(this.def.knockMult??1)*(this.elite?TUNING.elite.knock:1);
        this.hp-=dmg;
        this.flashT=F.flashTime;
        this.vel.x+=dx*F.knockback*km;
        this.vel.z+=dz*F.knockback*km;
        this.sqv+=F.hurtSquash*(km>0?1:0.4);
        return this.hp<=0;
    }

    damageMult() {
        return 1;
    }

    summonTick(dt,ctx) {
        const B=TUNING.bossScale;
        this.minionT-=dt;
        if (this.minionT>0) {
            return;
        }
        const k=Math.min(this.tier,B.summonEvery.length)-1;
        this.minionT=B.summonEvery[k];
        if (ctx.enemyMgr.list.length>=B.summonCap) {
            return;
        }
        for (const type of B.minions[k]) {
            const a=rng.range(0,Math.PI*2);
            const e=ctx.enemyMgr.spawn(type,this.pos.x+Math.cos(a)*3.5,this.pos.z+Math.sin(a)*3.5,{});
            ctx.particles.burst(e.pos.x,0.4,e.pos.z,8,{color:'midGray',speed:[1,4],up:[1,4]});
        }
        this.sqv+=2;
    }

    colliders(ctx) {
        return ctx.room.colliders;
    }

    canContact() {
        return true;
    }

    update(dt,ctx) {
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
        this.hull.uniforms.uColor.value.copy(pal(fl?'paper':(this.rage?'red':(this.elite?'darkRed':'ink'))));
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
        this.fireT=rng.range(d.firstShot[0],d.firstShot[1]);
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
                this.fireT=rng.range(d.fireInterval[0],d.fireInterval[1]);
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
        this.fireT=rng.range(d.firstShot[0],d.firstShot[1]);
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
                this.fireT=rng.range(d.fireInterval[0],d.fireInterval[1]);
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
        this.swoopT=rng.range(d.swoopEvery[0],d.swoopEvery[1]);
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
                this.swoopT=rng.range(d.swoopEvery[0],d.swoopEvery[1]);
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
        this.castT=rng.range(d.firstCast[0],d.firstCast[1]);
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
                this.castT=rng.range(d.castEvery[0],d.castEvery[1]);
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
        const f=this.hp/this.maxHp;
        return f>0.66?0:(f>0.33?1:2);
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
        const list=ph===0?['spiral','fan','spill']:(ph===1?['spiral','fan','ring','spill','summon']:['spiral','ring','fan','spill','summon','ring']);
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
                if (this.pattern==='fan') {
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
                for (const sx of [-1,1]) {
                    ctx.enemyMgr.spawn('blob',px+sx*2.6,pz+1.5,{hpMult:1,quick:false});
                }
                this.finish();
            }
        }
    }

    finish() {
        this.setState('move');
        this.patternT=rng.range(this.def.patternGap[0],this.def.patternGap[1]);
    }

    pose() {
        this.body.position.y=Math.sin(time.real*2)*0.05;
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
        return this.hp<this.maxHp*0.5;
    }

    choose() {
        const list=this.phase2()?['dash','snip','spin','dash']:['dash','snip','spin'];
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
                    this.teleRing(this.pattern==='spin'?3.4:2.6,0.6);
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
                    if (this.phase2()&&this.dashes<1) {
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
        this.stampT=rng.range(d.firstStamp[0],d.firstStamp[1]);
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
                this.stampT=rng.range(d.stampEvery[0],d.stampEvery[1]);
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
        this.snipT=rng.range(d.firstSnip[0],d.firstSnip[1]);
        this.rage=false;
        this.partner=null;
        this.lead=false;
        this.pattern=null;
        this.ang=rng.range(0,Math.PI*2);
        this.dx=0;
        this.dz=1;
    }

    enrage() {
        if (this.rage||!this.alive) {
            return;
        }
        this.rage=true;
        this.partner=null;
        this.sqv+=4;
        this.flashT=0.3;
    }

    mate(ctx) {
        const o=this.partner;
        if (o&&o.alive&&o.partner===this) {
            return o;
        }
        this.partner=null;
        if (this.rage) {
            return null;
        }
        let best=null;
        let bd=this.def.pairRange;
        for (const q of ctx.enemies) {
            if (q!==this&&q.alive&&q.type==='scissorMinion'&&!q.rage&&!q.dummy&&(!q.partner||!q.partner.alive)) {
                const dd=Math.hypot(q.pos.x-this.pos.x,q.pos.z-this.pos.z);
                if (dd<bd) {
                    bd=dd;
                    best=q;
                }
            }
        }
        if (best) {
            this.partner=best;
            best.partner=this;
            this.lead=true;
            best.lead=false;
            best.ang=this.ang+Math.PI;
        }
        return best;
    }

    thread() {
        const o=this.partner;
        if (!o||!o.alive) {
            return;
        }
        const dx=o.pos.x-this.pos.x;
        const dz=o.pos.z-this.pos.z;
        const l=Math.hypot(dx,dz)||1;
        if (!this.tele) {
            this.teleLine(dx/l,dz/l,0,this.def.threadTele);
        }
        this.tele.dx=dx/l;
        this.tele.dz=dz/l;
        this.tele.len=Math.max(0,l/2-this.def.radius-0.1);
    }

    startPinch() {
        const o=this.partner;
        for (const q of [this,o]) {
            q.pattern='pinch';
            q.tele=null;
            q.setState('telegraph');
            q.thread();
        }
    }

    startThrow(ctx) {
        const d=this.def;
        this.pattern='throw';
        this.dx=this.nx;
        this.dz=this.nz;
        this.setState('telegraph');
        this.teleLine(this.dx,this.dz,d.throwRange,d.throwTele*(this.rage?d.rage.tele:1),this.elite?2:1,this.elite?d.eliteThrowSpread:0);
    }

    snap(ctx) {
        const d=this.def;
        const o=this.partner;
        const mx=o?(this.pos.x+o.pos.x)/2:this.pos.x;
        const mz=o?(this.pos.z+o.pos.z)/2:this.pos.z;
        ctx.particles.burst(mx,1,mz,14,{color:'midGray',speed:[2,7],up:[2,5]});
        ctx.fx.cameraShake(0.15);
        if (this.elite||(o&&o.elite)) {
            fireRing(ctx,mx,mz,d.eliteRing,rng.range(0,1),d.bulletSpeed,d.bulletDamage,d.bulletLife);
        }
        for (const q of [this,o]) {
            if (q&&q.alive) {
                q.tele=null;
                q.vel.multiplyScalar(0.1);
                q.setState('recover');
            }
        }
    }

    throwBlades(ctx) {
        const d=this.def;
        const base=Math.atan2(this.dz,this.dx);
        const n=this.elite?2:1;
        const sp=d.throwSpeed*(this.rage?d.rage.dash:1);
        const out=d.throwRange/sp;
        for (let j=0;j<n;j++) {
            const a=n>1?base+(j-0.5)*d.eliteThrowSpread:base;
            const cx=Math.cos(a);
            const cz=Math.sin(a);
            for (let k=0;k<d.bladeDots;k++) {
                const off=(k-(d.bladeDots-1)/2)*d.bladeGap;
                const i=ctx.enemyBullets.spawn(this.pos.x-cz*off,this.pos.z+cx*off,cx,cz,sp,d.bulletDamage,out*2+0.3);
                ctx.enemyBullets.redirect(i,out,-cx*sp,-cz*sp);
            }
        }
    }

    think(dt,ctx) {
        const d=this.def;
        const R=this.rage?d.rage:null;
        const p=ctx.player;
        const o=this.mate(ctx);
        if (this.state==='move') {
            const sp=R?R.speed:1;
            if (o) {
                if (this.lead) {
                    this.ang+=dt*d.orbit;
                    o.ang=this.ang+Math.PI;
                }
                const tx=p.pos.x+Math.cos(this.ang)*d.flank-this.pos.x;
                const tz=p.pos.z+Math.sin(this.ang)*d.flank-this.pos.z;
                const tl=Math.hypot(tx,tz)||1;
                const f=Math.min(1,tl/1.5);
                this.wx=tx/tl*f*sp;
                this.wz=tz/tl*f*sp;
                this.aimX=this.nx;
                this.aimZ=this.nz;
                if (this.lead&&o.state==='move'&&o.stunT<=0) {
                    this.snipT-=dt;
                    const ready=tl<d.readyDist&&Math.hypot(p.pos.x+Math.cos(o.ang)*d.flank-o.pos.x,p.pos.z+Math.sin(o.ang)*d.flank-o.pos.z)<d.readyDist;
                    if (this.snipT<=0&&(ready||this.snipT<-d.readyWait)) {
                        this.startPinch();
                    }
                }
                return;
            }
            let push=0;
            if (this.dist>d.range[1]) {
                push=1;
            }
            else if (this.dist<d.range[0]) {
                push=-1;
            }
            this.wx=(this.nx*push-this.nz*d.strafe)*sp;
            this.wz=(this.nz*push+this.nx*d.strafe)*sp;
            this.aimX=this.nx;
            this.aimZ=this.nz;
            this.snipT-=dt/(R?R.every:1);
            if (this.snipT<=0) {
                this.startThrow(ctx);
            }
            return;
        }
        if (this.state==='telegraph') {
            this.manual=true;
            this.vel.multiplyScalar(Math.exp(-8*dt));
            if (this.pattern==='pinch') {
                if (!o) {
                    this.tele=null;
                    this.setState('recover');
                    return;
                }
                this.thread();
                this.aimX=o.pos.x-this.pos.x;
                this.aimZ=o.pos.z-this.pos.z;
                if (this.lead&&this.stateT>=d.threadTele) {
                    this.hitDone=false;
                    this.mx=(this.pos.x+o.pos.x)/2;
                    this.mz=(this.pos.z+o.pos.z)/2;
                    for (const q of [this,o]) {
                        q.setState('attack');
                        const ex=this.mx-q.pos.x;
                        const ez=this.mz-q.pos.z;
                        const el=Math.hypot(ex,ez)||1;
                        q.dx=ex/el;
                        q.dz=ez/el;
                    }
                }
                return;
            }
            if (this.stateT<this.tele.dur*0.5) {
                this.dx=this.nx;
                this.dz=this.nz;
                this.tele.dx=this.dx;
                this.tele.dz=this.dz;
            }
            this.aimX=this.dx;
            this.aimZ=this.dz;
            if (this.stateT>=this.tele.dur) {
                this.tele=null;
                this.throwBlades(ctx);
                this.sqv+=3;
                this.setState('recover');
            }
            return;
        }
        if (this.state==='attack') {
            this.manual=true;
            if (!o) {
                this.tele=null;
                this.vel.multiplyScalar(0.2);
                this.setState('recover');
                return;
            }
            this.vel.set(this.dx*d.dashSpeed,0,this.dz*d.dashSpeed);
            this.thread();
            if (this.lead) {
                const ax=this.pos.x;
                const az=this.pos.z;
                const sx=o.pos.x-ax;
                const sz=o.pos.z-az;
                const l2=sx*sx+sz*sz||1;
                const u=Math.max(0,Math.min(1,((p.pos.x-ax)*sx+(p.pos.z-az)*sz)/l2));
                const qx=p.pos.x-(ax+sx*u);
                const qz=p.pos.z-(az+sz*u);
                if (!this.hitDone&&Math.hypot(qx,qz)<d.threadWidth+TUNING.player.radius) {
                    this.hitDone=true;
                    const ql=Math.hypot(qx,qz)||1;
                    p.hurt(d.snipDamage,qx/ql,qz/ql);
                }
                if (Math.sqrt(l2)<d.radius*2+0.3||this.stateT>=d.dashTime) {
                    this.snap(ctx);
                }
            }
            return;
        }
        if (this.state==='recover') {
            this.manual=true;
            this.vel.multiplyScalar(Math.exp(-10*dt));
            if (this.stateT>=d.recover*(R?R.tele:1)) {
                this.setState('move');
                this.snipT=rng.range(d.snipEvery[0],d.snipEvery[1]);
            }
        }
    }

    pose() {
        let open=0.35+Math.sin(time.real*(this.rage?16:6))*0.12;
        if (this.state==='telegraph') {
            open=0.75;
        }
        else if (this.state==='attack') {
            open=0.03;
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
    }

    damageMult() {
        return this.state==='rest'?this.def.weakMult:1;
    }

    phase2() {
        return this.hp<this.maxHp*0.5;
    }

    choose(ctx) {
        const list=['wall','rain','slam','wall'];
        if (ctx.enemyMgr.list.length<5) {
            list.push('summon');
        }
        if (this.phase2()) {
            list.push('rain','wall');
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
                else {
                    this.teleRing(2.6,0.5);
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
            else if (this.pattern==='summon') {
                const types=['doodle','doodle','bird'];
                for (let i=0;i<types.length;i++) {
                    const a=Math.atan2(this.nz,this.nx)+(i-1)*0.9;
                    ctx.enemyMgr.spawn(types[i],this.pos.x+Math.cos(a)*3.2,this.pos.z+Math.sin(a)*3.2,{});
                }
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
        this.stand.position.y=0.6+Math.sin(time.real*1.8)*0.08;
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
    }

    damageMult() {
        return this.state==='rest'?this.def.weakMult:1;
    }

    phase2() {
        return this.hp<this.maxHp*0.5;
    }

    speak(key,dur) {
        this.say={text:t(key),t:0,dur,keep:true};
    }

    choose() {
        const list=['zone','quiet','grade','toss'];
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
                if (this.pattern==='grade') {
                    const n=P2?d.grade.lines2:d.grade.lines;
                    this.teleLine(this.nx,this.nz,18,d.askTime,n,d.grade.spread);
                }
                else {
                    this.teleRing(this.pattern==='quiet'?3.2:2.4,d.askTime);
                }
            }
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
            if (this.stateT>=d.askTime) {
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
                if ((p.shots||0)>this.shotsAsk&&this.coolT<=0) {
                    this.shotsAsk=p.shots;
                    this.coolT=Q.cool;
                    const n=P2?Q.shots2:Q.shots;
                    const base=Math.atan2(this.nz,this.nx);
                    for (let i=0;i<n;i++) {
                        const a=base+(i/(n-1)-0.5)*Q.spread;
                        ctx.enemyBullets.spawn(this.pos.x,this.pos.z,Math.cos(a),Math.sin(a),sp*1.2,d.bulletDamage,d.bulletLife);
                    }
                    this.speak('exam.cheat',0.9);
                    this.kick=1;
                }
                this.shotsAsk=Math.max(this.shotsAsk,p.shots||0);
                done=this.stateT>=Q.time;
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
            if (done) {
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
        const red=this.mat('body');
        const tag=this.mat('head');
        this.float=new THREE.Group();
        this.float.position.y=0.4;
        const rib=this.hullify(new THREE.Mesh(geo('bmRibbon',()=>new THREE.BoxGeometry(0.42,2.2,0.08)),red));
        rib.position.y=1.1;
        this.float.add(rib);
        const tail=this.hullify(new THREE.Mesh(geo('bmTail',()=>new THREE.ConeGeometry(0.3,0.5,3)),red));
        tail.rotation.z=Math.PI;
        tail.position.y=-0.1;
        this.float.add(tail);
        const card=this.hullify(new THREE.Mesh(geo('bmTag',()=>new THREE.BoxGeometry(0.62,0.5,0.1)),tag));
        card.position.y=2.35;
        this.float.add(card);
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
        if (!h||!h.alive||!h.sealed) {
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
        super.buildBody();
        const red=unlitMaterial({color:'red'});
        for (const sx of [-1,1]) {
            const r=new THREE.Mesh(geo('bfRibbon',()=>new THREE.BoxGeometry(0.16,0.05,3.4)),red);
            r.position.set(sx*0.55,0.48,0);
            this.stand.add(r);
        }
        this.crown=new THREE.Group();
        const sp=geo('bfSpike',()=>new THREE.ConeGeometry(0.22,0.7,5));
        for (let i=0;i<5;i++) {
            const m=new THREE.Mesh(sp,red);
            m.position.set((i-2)*0.5,0.9,-1.3);
            this.crown.add(m);
        }
        this.stand.add(this.crown);
        this.strips=[];
    }

    onReset() {
        super.onReset();
        this.page=0;
        this.bombs=[];
        this.hz=[];
        this.sweep=null;
        this.sealed=false;
        this.shielded=false;
        this.marks=[];
        this.sealT=0;
        this.sealAtk=0;
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
        return this.hp<this.maxHp/3?2:(this.hp<this.maxHp*2/3?1:0);
    }

    damageMult() {
        return this.state==='rest'||this.state==='broken'?this.def.weakMult:1;
    }

    choose() {
        const list=['lines','sweep','mimicBomb','mimicScatter'];
        if (this.page>=1) {
            list.push('wall','sweep');
        }
        if (this.page>=2) {
            list.push('lines','mimicBomb');
        }
        let p=list[Math.floor(rng.next()*list.length)];
        if (p===this.last) {
            p=list[(list.indexOf(p)+1)%list.length];
        }
        this.last=p;
        return p;
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
            if (h.t>=h.warn&&h.t<h.warn+L.live&&!h.hit&&this.segHit(p,h.ax,h.az,h.bx,h.bz,L.width)) {
                h.hit=true;
                p.hurt(1,h.bx===h.ax?Math.sign(p.pos.x-h.ax)||1:0,h.bz===h.az?Math.sign(p.pos.z-h.az)||1:0);
            }
            if (h.t>=h.warn+L.live+L.fade) {
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

    seal(ctx) {
        const S=this.def.seal;
        this.sealed=true;
        this.shielded=true;
        this.sealT=0;
        this.sealAtk=S.attackEvery*0.6;
        this.tele=null;
        this.bombs=[];
        this.setState('sealed');
        this.marks=[];
        const n=S.marks[Math.min(S.marks.length-1,this.page-1)];
        const b=ctx.room.bounds;
        const a0=rng.range(0,Math.PI*2);
        for (let i=0;i<n;i++) {
            const a=a0+i/n*Math.PI*2;
            const x=Math.max(b.minX+1.5,Math.min(b.maxX-1.5,this.pos.x+Math.cos(a)*S.radius));
            const z=Math.max(b.minZ+1.5,Math.min(b.maxZ-1.5,this.pos.z+Math.sin(a)*S.radius));
            const m=ctx.enemyMgr.spawn('bookmark',x,z,{hpMult:1});
            m.host=this;
            this.marks.push(m);
        }
        this.say={text:t('bookFinal.seal'),t:0,dur:2.2,keep:true};
        ctx.fx.cameraShake(0.4);
    }

    unseal(ctx,broken) {
        const S=this.def.seal;
        this.sealed=false;
        this.shielded=false;
        this.tele=null;
        for (const m of this.marks) {
            if (m.alive) {
                ctx.enemyMgr.slay(m);
            }
        }
        this.marks=[];
        if (broken) {
            this.setState('broken');
            this.say={text:t('bookFinal.broken'),t:0,dur:2,keep:true};
            this.sqv+=5;
        }
        else {
            this.hp=Math.min(this.maxHp,this.hp+this.maxHp*S.heal);
            this.setState('move');
            this.patternT=0.8;
            this.say={text:t('bookFinal.healed'),t:0,dur:2,keep:true};
        }
    }

    think(dt,ctx) {
        const d=this.def;
        const p=ctx.player;
        this.tickHazards(dt,ctx);
        const pg=Math.max(this.page,this.pageOf());
        if (pg!==this.page) {
            this.page=pg;
            this.say={text:t('bookFinal.page'+pg),t:0,dur:2,keep:true};
            this.seal(ctx);
            return;
        }
        this.manual=true;
        this.vel.set(0,0,0);
        this.aimX=this.nx;
        this.aimZ=this.nz;
        if (this.state==='sealed') {
            const S=d.seal;
            this.sealT+=dt;
            if (!this.tele) {
                this.teleRing(d.radius+0.6,0.4);
            }
            this.tele.t=Math.min(this.tele.t,0.3);
            this.sealAtk-=dt;
            if (this.sealAtk<=0&&this.hz.length===0) {
                this.sealAtk=S.attackEvery;
                this.addLines(ctx,S.lines,d.lines.warn);
            }
            if (this.marks.every(m=>!m.alive)) {
                this.unseal(ctx,true);
            }
            else if (this.sealT>=S.time) {
                this.unseal(ctx,false);
            }
            return;
        }
        if (this.state==='broken') {
            if (this.stateT>=d.seal.stun) {
                this.setState('move');
                this.patternT=0.6;
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
                else {
                    this.teleRing(2.6,0.5);
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
                m.material.uniforms.uAlpha.value=Math.max(0,Math.min(1,1-(h.t-h.warn-L.live)/L.fade));
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

    pose() {
        super.pose();
        this.crown.rotation.y=time.real*(this.sealed?2.4:0.6);
        if (this.sealed) {
            this.covers[0].rotation.z=0.02;
            this.covers[1].rotation.z=-0.02;
        }
        else if (this.state==='broken') {
            this.covers[0].rotation.z=0.05;
            this.covers[1].rotation.z=-0.05;
            const pulse=1.25+Math.sin(time.real*14)*0.2;
            this.mark.scale.set(pulse,1,1);
        }
    }
}

const CLASSES={bookmark:Bookmark,stampSoldier:StampSoldier,scissorMinion:ScissorMinion,doodle:Doodle,sprayer:Sprayer,blob:Blob,blobSmall:Blob,compass:Compass,eraserMonster:EraserMonster,bird:Bird,inkCloud:InkCloud,inkBottle:InkBottle,scissors:Scissors,book:Book,exam:Exam,bookFinal:BookFinal};

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
        e.reset(x,z,{hpMult:o.hpMult??this.hpMult,quick:o.quick,act:this.act,elite:o.elite,dummy:o.dummy,immortal:o.immortal,tier:o.tier||0});
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
        for (const e of arr) {
            if (e.alive) {
                e.update(e.def.boss?dt*TUNING.bossTempo*(1+e.tier*TUNING.bossScale.tempo):dt,ctx);
            }
        }
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
        if (e.vulnT>0) {
            dmg*=e.vulnMult;
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
