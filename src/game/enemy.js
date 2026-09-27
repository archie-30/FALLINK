import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {ENEMIES} from '../data/enemies.js';
import {toonMaterial,hullMaterial,unlitMaterial,lineMaterial,registerShadow,pal} from '../render/materials.js';
import {resolveCircle,clampToBounds} from '../core/collision.js';
import {EASE} from '../core/easing.js';
import {RNG} from '../core/rng.js';
import {time} from '../core/loop.js';

const rng=new RNG(1234);

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

export class Enemy {
    constructor(def,parent,fxScene) {
        this.def=def;
        this.pos=new THREE.Vector3();
        this.prev=new THREE.Vector3();
        this.vel=new THREE.Vector3();
        this.renderPos=new THREE.Vector3();
        this.alive=false;
        this.state='spawn';
        this.build(parent,fxScene);
    }

    build(parent,fxScene) {
        const d=this.def;
        const J=TUNING.boil.vertexJitter;
        this.mats=[
            toonMaterial({...d.tones.body,jitter:J,unique:true}),
            toonMaterial({...d.tones.head,jitter:J,unique:true}),
            toonMaterial({...d.tones.limb,jitter:J,unique:true})
        ];
        this.hull=hullMaterial({jitter:J,unique:true});
        const [body,head,limb]=this.mats;
        const ink=unlitMaterial({color:'ink',jitter:J});
        const addHull=m=>{
            const h=new THREE.Mesh(m.geometry,this.hull);
            m.add(h);
            return m;
        };
        this.root=new THREE.Group();
        this.root.visible=false;
        this.shadow=new THREE.Mesh(geo('shadow',()=>new THREE.PlaneGeometry(1.8,1.8)),null);
        this.shadow.rotation.x=-Math.PI/2;
        this.shadow.position.y=0.03;
        registerShadow(this.shadow);
        this.root.add(this.shadow);
        this.yawGroup=new THREE.Group();
        this.squash=new THREE.Group();
        this.body=new THREE.Group();
        this.yawGroup.scale.setScalar(d.scale);
        this.root.add(this.yawGroup);
        this.yawGroup.add(this.squash);
        this.squash.add(this.body);
        this.legs=[];
        for (const sx of [-1,1]) {
            const p=new THREE.Group();
            p.position.set(sx*0.17,0.45,0);
            const leg=addHull(new THREE.Mesh(geo('leg',()=>capsule(0.11,0.22)),limb));
            leg.position.y=-0.22;
            p.add(leg);
            this.body.add(p);
            this.legs.push(p);
        }
        const torso=addHull(new THREE.Mesh(geo('torso',()=>new THREE.BoxGeometry(0.62,0.62,0.44)),body));
        torso.position.y=0.8;
        this.torso=torso;
        this.body.add(torso);
        this.head=new THREE.Group();
        this.head.position.y=1.38;
        const skull=addHull(new THREE.Mesh(geo('skull',()=>new THREE.SphereGeometry(0.3,9,6)),head));
        this.head.add(skull);
        const helmet=addHull(new THREE.Mesh(geo('helmet',()=>new THREE.SphereGeometry(0.34,9,5,0,Math.PI*2,0,Math.PI*0.45)),body));
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
        const armMesh=addHull(new THREE.Mesh(geo('arm',()=>capsule(0.08,0.26)),limb));
        armMesh.position.y=-0.18;
        this.arm.add(armMesh);
        const gun=addHull(new THREE.Mesh(geo('gun',()=>new THREE.CylinderGeometry(0.07,0.07,0.42,6)),limb));
        gun.position.set(0,-0.4,0.12);
        gun.rotation.x=Math.PI/2;
        this.arm.add(gun);
        this.body.add(this.arm);
        parent.add(this.root);
        const lg=geo('line',()=>{
            const g=new THREE.PlaneGeometry(1,1);
            g.rotateX(-Math.PI/2);
            g.translate(0.5,0,0);
            return g;
        });
        this.line=new THREE.Mesh(lg,lineMaterial('red'));
        this.line.visible=false;
        this.line.frustumCulled=false;
        fxScene.add(this.line);
    }

    reset(x,z) {
        const d=this.def;
        this.pos.set(x,0,z);
        this.prev.copy(this.pos);
        this.renderPos.copy(this.pos);
        this.vel.set(0,0,0);
        this.hp=d.hp;
        this.alive=true;
        this.state='spawn';
        this.t=0;
        this.fireT=rng.range(d.firstShot[0],d.firstShot[1]);
        this.strafeSign=rng.sign();
        this.strafeT=rng.range(1,3);
        this.yaw=0;
        this.aimX=0;
        this.aimZ=1;
        this.sq=0;
        this.sqv=0;
        this.flashT=0;
        this.kick=0;
        this.phase=rng.range(0,6);
        this.poseStep=-1;
        this.root.visible=true;
        this.root.position.copy(this.pos);
        this.squash.scale.setScalar(0.01);
        this.line.visible=false;
    }

    hide() {
        this.alive=false;
        this.root.visible=false;
        this.line.visible=false;
    }

    hurt(dmg,dx,dz) {
        const F=TUNING.feel;
        this.hp-=dmg;
        this.flashT=F.flashTime;
        this.vel.x+=dx*F.knockback;
        this.vel.z+=dz*F.knockback;
        this.sqv+=F.hurtSquash;
        return this.hp<=0;
    }

    update(dt,ctx) {
        const d=this.def;
        const p=ctx.player;
        this.prev.copy(this.pos);
        this.t+=dt;
        const tx=p.pos.x-this.pos.x;
        const tz=p.pos.z-this.pos.z;
        const dist=Math.hypot(tx,tz)||1;
        const nx=tx/dist;
        const nz=tz/dist;
        let wx=0;
        let wz=0;
        if (this.state==='spawn') {
            if (this.t>=d.spawnTime) {
                this.state='move';
                this.sqv+=2;
            }
        }
        else if (this.state==='move') {
            let push=0;
            if (dist>d.range[1]) {
                push=1;
            }
            else if (dist<d.range[0]) {
                push=-1;
            }
            this.strafeT-=dt;
            if (this.strafeT<=0) {
                this.strafeT=rng.range(1.2,3);
                this.strafeSign=-this.strafeSign;
            }
            wx=nx*push-nz*this.strafeSign*d.strafe;
            wz=nz*push+nx*this.strafeSign*d.strafe;
            this.aimX=nx;
            this.aimZ=nz;
            this.fireT-=dt;
            if (this.fireT<=0) {
                this.state='telegraph';
                this.t=0;
                this.aimX=nx;
                this.aimZ=nz;
                this.line.visible=true;
            }
        }
        else if (this.state==='telegraph') {
            if (this.t>=d.telegraph) {
                this.fire(ctx);
                this.state='move';
                this.fireT=rng.range(d.fireInterval[0],d.fireInterval[1]);
                this.line.visible=false;
            }
        }
        for (const o of ctx.enemies) {
            if (o===this||!o.alive) {
                continue;
            }
            const ex=this.pos.x-o.pos.x;
            const ez=this.pos.z-o.pos.z;
            const e2=ex*ex+ez*ez;
            const rr=d.radius*2.4;
            if (e2<rr*rr&&e2>1e-6) {
                const e=Math.sqrt(e2);
                wx+=ex/e*(1-e/rr)*1.5;
                wz+=ez/e*(1-e/rr)*1.5;
            }
        }
        const wl=Math.hypot(wx,wz);
        if (wl>1) {
            wx/=wl;
            wz/=wl;
        }
        const k=Math.min(1,d.accel*dt);
        this.vel.x+=(wx*d.speed-this.vel.x)*k;
        this.vel.z+=(wz*d.speed-this.vel.z)*k;
        this.pos.x+=this.vel.x*dt;
        this.pos.z+=this.vel.z*dt;
        resolveCircle(this.pos,d.radius,ctx.room.colliders,2);
        clampToBounds(this.pos,d.radius,ctx.room.bounds);
        const sp=Math.hypot(this.pos.x-this.prev.x,this.pos.z-this.prev.z)/dt;
        this.speedFrac=Math.min(1,sp/d.speed);
        this.phase+=dt*9*this.speedFrac;
        const ty=Math.atan2(this.aimX,this.aimZ);
        let dy=ty-this.yaw;
        while (dy>Math.PI) {
            dy-=Math.PI*2;
        }
        while (dy<-Math.PI) {
            dy+=Math.PI*2;
        }
        this.yaw+=dy*Math.min(1,10*dt);
        this.sqv+=(-300*this.sq-12*this.sqv)*dt;
        this.sq+=this.sqv*dt;
        this.sq=Math.max(-0.45,Math.min(0.45,this.sq));
        this.kick*=Math.exp(-14*dt);
        if (this.state!=='spawn'&&dist<d.radius+TUNING.player.radius) {
            p.hurt(d.contactDamage,nx,nz);
        }
    }

    fire(ctx) {
        const d=this.def;
        const s=d.scale;
        const c=Math.cos(this.yaw);
        const sn=Math.sin(this.yaw);
        const lx=0.38*s;
        const lz=0.55*s;
        const mx=this.pos.x+lx*c+lz*sn;
        const mz=this.pos.z-lx*sn+lz*c;
        ctx.enemyBullets.spawn(mx,mz,this.aimX,this.aimZ,d.bulletSpeed,d.bulletDamage,d.bulletLife);
        ctx.muzzle.show(mx,TUNING.weapon.height,mz,'red',0.8);
        this.kick=1;
        this.sqv-=1.5;
    }

    sync(alpha,dt) {
        const d=this.def;
        this.renderPos.lerpVectors(this.prev,this.pos,alpha);
        this.root.position.copy(this.renderPos);
        this.yawGroup.rotation.y=this.yaw;
        if (this.flashT>0) {
            this.flashT-=dt;
        }
        const fl=this.flashT>0?1:0;
        for (const m of this.mats) {
            m.uniforms.uFlash.value=fl;
        }
        this.hull.uniforms.uColor.value.copy(pal(fl?'paper':'ink'));
        if (this.state==='telegraph') {
            const k=EASE.easeOutCubic(Math.min(1,this.t/(d.telegraph*0.7)));
            const len=d.telegraphLength*k;
            this.line.position.set(this.renderPos.x+this.aimX*0.6,0.04,this.renderPos.z+this.aimZ*0.6);
            this.line.rotation.y=Math.atan2(-this.aimZ,this.aimX);
            this.line.scale.set(Math.max(0.01,len),1,0.16);
            this.line.material.uniforms.uLength.value=len;
        }
        const step=Math.floor(time.real*TUNING.player.poseFps);
        if (step!==this.poseStep) {
            this.poseStep=step;
            this.applyPose();
        }
    }

    applyPose() {
        const d=this.def;
        let base=1;
        if (this.state==='spawn') {
            base=EASE.easeOutBack(Math.min(1,this.t/d.spawnTime));
        }
        const ks=1-this.sq;
        const w=1/Math.sqrt(Math.max(0.3,ks));
        this.squash.scale.set(w*base,ks*base,w*base);
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

export class EnemyManager {
    constructor(parent,fxScene) {
        this.parent=parent;
        this.fxScene=fxScene;
        this.pools={};
        this.list=[];
        this.onKill=null;
    }

    spawn(type,x,z) {
        const pool=this.pools[type]||(this.pools[type]=[]);
        let e=pool.find(o=>!o.alive&&!this.list.includes(o));
        if (!e) {
            e=new Enemy(ENEMIES[type],this.parent,this.fxScene);
            e.type=type;
            pool.push(e);
        }
        e.reset(x,z);
        this.list.push(e);
        return e;
    }

    aliveCount() {
        return this.list.length;
    }

    update(dt,ctx) {
        ctx.enemies=this.list;
        for (const e of this.list) {
            e.update(dt,ctx);
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
    }

    hitBullet(x,z,r,dmg,vx,vz) {
        for (const e of this.list) {
            if (e.state==='spawn') {
                continue;
            }
            const rr=e.def.radius+r;
            const ex=x-e.pos.x;
            const ez=z-e.pos.z;
            if (ex*ex+ez*ez<rr*rr) {
                const l=Math.hypot(vx,vz)||1;
                const dx=vx/l;
                const dz=vz/l;
                const dead=e.hurt(dmg,dx,dz);
                if (this.onHit) {
                    this.onHit(e,x,z,dx,dz,dead);
                }
                if (dead) {
                    this.kill(e,dx,dz);
                }
                return true;
            }
        }
        return false;
    }
}
