import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {ENEMIES} from '../data/enemies.js';
import {toonMaterial,hullMaterial,unlitMaterial,lineMaterial,trapMaterial,registerShadow,pal,renderFlags} from '../render/materials.js';
import {resolveCircle,clampToBounds,circleVs} from '../core/collision.js';
import {EASE} from '../core/easing.js';
import {RNG} from '../core/rng.js';
import {time} from '../core/loop.js';

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
        parent.add(this.root);
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
        this.maxHp=this.hp;
        this.uid=++uidCounter;
        this.alive=true;
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
        const km=this.def.knockMult??1;
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
        if (this.state==='spawn') {
            if (this.t>=this.spawnTime) {
                this.setState('move');
                this.sqv+=2;
            }
            this.vel.multiplyScalar(Math.exp(-8*dt));
        }
        else {
            this.think(dt,ctx);
        }
        const slow=d.flying?1:ctx.room.zones.slowAt(this.pos.x,this.pos.z);
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
        if (this.state!=='spawn'&&this.canContact()&&this.dist<d.radius+TUNING.player.radius) {
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
        this.hull.uniforms.uColor.value.copy(pal(fl?'paper':'ink'));
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
                r.position.set(this.renderPos.x,0.05,this.renderPos.z);
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
                this.teleLine(this.nx,this.nz,d.telegraphLength,d.telegraph);
            }
        }
        else if (this.state==='telegraph') {
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
        ctx.enemyBullets.spawn(mx,mz,this.aimX,this.aimZ,d.bulletSpeed,d.bulletDamage,d.bulletLife);
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
            this.patternT-=dt*(1+ph*0.35);
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
                while (this.fireAcc>=0.075) {
                    this.fireAcc-=0.075;
                    for (let i=0;i<arms;i++) {
                        const a=this.spiralA+i/arms*Math.PI*2;
                        ctx.enemyBullets.spawn(px+Math.cos(a)*1.8,pz+Math.sin(a)*1.8,Math.cos(a),Math.sin(a),sp,d.bulletDamage,d.bulletLife);
                    }
                    this.spiralA+=0.22;
                }
                if (this.stateT>=3.0) {
                    this.finish();
                }
            }
            else if (this.pattern==='fan') {
                this.fireAcc+=dt;
                if (this.fireAcc>=0.4||this.volley===0) {
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
        this.patternT=rng.range(0.8,1.4);
    }

    pose() {
        this.body.position.y=Math.sin(time.real*2)*0.05;
        const pulse=1+Math.sin(time.real*7)*0.15;
        this.weak.scale.set(pulse,pulse,1);
        this.cap.position.y+=(4.5-this.cap.position.y)*0.4;
    }
}

const CLASSES={doodle:Doodle,blob:Blob,blobSmall:Blob,compass:Compass,eraserMonster:EraserMonster,bird:Bird,inkBottle:InkBottle};

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
        e.reset(x,z,{hpMult:o.hpMult??this.hpMult,quick:o.quick,act:this.act});
        this.list.push(e);
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
                e.update(dt,ctx);
            }
        }
    }

    sync(alpha,dt) {
        for (const e of this.list) {
            e.sync(alpha,dt);
        }
    }

    kill(e,dx,dz) {
        e.hide();
        const i=this.list.indexOf(e);
        if (i>=0) {
            this.list.splice(i,1);
        }
        if (this.onKill) {
            this.onKill(e,dx,dz);
        }
        const d=e.def;
        if (d.split) {
            for (let k=0;k<d.splitCount;k++) {
                const a=Math.atan2(dz,dx)+(k===0?1.2:-1.2);
                this.spawn(d.split,e.pos.x+Math.cos(a)*0.7,e.pos.z+Math.sin(a)*0.7,{quick:true});
            }
        }
    }

    nearest(x,z,range) {
        let best=null;
        let bd=range*range;
        for (const e of this.list) {
            if (e.state==='spawn') {
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
        const dead=e.hurt(dmg,dx,dz);
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
