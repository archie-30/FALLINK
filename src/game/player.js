import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {toonMaterial,unlitMaterial,registerShadow} from '../render/materials.js';
import {addHull as addHullBase} from '../render/outline.js';
import {resolveCircle,clampToBounds} from '../core/collision.js';
import {time} from '../core/loop.js';

const _mv={x:0,z:0};

function wrapAngle(a) {
    while (a>Math.PI) {
        a-=Math.PI*2;
    }
    while (a<-Math.PI) {
        a+=Math.PI*2;
    }
    return a;
}

function approachAngle(cur,target,k) {
    return cur+wrapAngle(target-cur)*Math.min(1,k);
}

function capsule(r,len) {
    return new THREE.CapsuleGeometry(r,len,3,8);
}

export class Player {
    constructor(parent,opts={}) {
        this.ghost=!!opts.ghost;
        this.pos=new THREE.Vector3();
        this.prev=new THREE.Vector3();
        this.vel=new THREE.Vector3();
        this.renderPos=new THREE.Vector3();
        this.aimYaw=0;
        this.moveYaw=0;
        this.poseMoveYaw=0;
        this.aimDirX=0;
        this.aimDirZ=-1;
        this.dashT=0;
        this.dashCd=0;
        this.moving=false;
        this.speedFrac=0;
        this.phase=0;
        this.sq=0;
        this.sqv=0;
        this.st=0;
        this.stv=0;
        this.kick=0;
        this.poseStep=-1;
        this.fireCd=0;
        this.rapidT=0;
        this.rapidMult=1;
        this.hp=TUNING.player.maxHp;
        this.invuln=0;
        this.shield=0;
        this.events={onDash:null,onFire:null,onHurt:null,onDown:null,onShield:null};
        this.build(parent);
    }

    build(parent) {
        const J=TUNING.boil.vertexJitter;
        const g=this.ghost;
        const tm=o=>toonMaterial(g?{...o,ghost:true,unique:true,alpha:0.75}:o);
        const dark=tm({light:'midGray',mid:'nearGray',dark:'ink',jitter:J});
        const coat=tm({light:'farGray',mid:'midGray',dark:'ink',jitter:J});
        const face=tm({light:'paper',mid:'farGray',dark:'midGray',jitter:J});
        const ink=g?dark:unlitMaterial({color:'ink',jitter:J});
        this.ghostMats=g?[dark,coat,face]:[];
        const hull={jitter:J};
        const addHull=g?()=>null:addHullBase;
        this.root=new THREE.Group();
        this.root.name=g?'clone':'player';
        if (!g) {
            this.shadow=new THREE.Mesh(new THREE.PlaneGeometry(1.9,1.9),null);
            this.shadow.rotation.x=-Math.PI/2;
            this.shadow.position.y=0.03;
            registerShadow(this.shadow);
            this.root.add(this.shadow);
            this.buildShield();
        }
        this.moveFrame=new THREE.Group();
        this.leanGroup=new THREE.Group();
        this.stretch=new THREE.Group();
        this.aimFrame=new THREE.Group();
        this.body=new THREE.Group();
        this.root.add(this.moveFrame);
        this.moveFrame.scale.setScalar(TUNING.player.visualScale);
        this.moveFrame.add(this.leanGroup);
        this.leanGroup.add(this.stretch);
        this.stretch.add(this.aimFrame);
        this.aimFrame.add(this.body);
        const legGeo=capsule(0.12,0.26);
        this.legs=[];
        for (const sx of [-1,1]) {
            const pivot=new THREE.Group();
            pivot.position.set(sx*0.15,0.5,0);
            const leg=new THREE.Mesh(legGeo,dark);
            leg.position.y=-0.25;
            addHull(leg,hull);
            pivot.add(leg);
            this.body.add(pivot);
            this.legs.push(pivot);
        }
        this.torso=new THREE.Mesh(capsule(0.28,0.3),coat);
        this.torso.position.y=0.9;
        this.torso.scale.z=0.85;
        addHull(this.torso,hull);
        this.body.add(this.torso);
        this.head=new THREE.Group();
        this.head.position.y=1.46;
        const skull=new THREE.Mesh(new THREE.SphereGeometry(0.31,10,7),face);
        addHull(skull,hull);
        this.head.add(skull);
        const eyeGeo=new THREE.BoxGeometry(0.06,0.13,0.05);
        for (const sx of [-1,1]) {
            const eye=new THREE.Mesh(eyeGeo,ink);
            eye.position.set(sx*0.1,0.03,0.28);
            this.head.add(eye);
        }
        const drop=new THREE.Mesh(new THREE.ConeGeometry(0.15,0.36,8),dark);
        drop.position.set(0,0.36,-0.06);
        drop.rotation.x=-0.45;
        addHull(drop,hull);
        this.head.add(drop);
        this.body.add(this.head);
        const armGeo=capsule(0.08,0.28);
        this.arms=[];
        for (const sx of [-1,1]) {
            const pivot=new THREE.Group();
            pivot.position.set(sx*0.36,1.08,0);
            const arm=new THREE.Mesh(armGeo,dark);
            arm.position.y=-0.2;
            addHull(arm,hull);
            pivot.add(arm);
            this.body.add(pivot);
            this.arms.push(pivot);
        }
        this.gun=new THREE.Group();
        this.gun.position.set(0.34,1.0,0.42);
        const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.5,6),dark);
        barrel.rotation.x=Math.PI/2;
        addHull(barrel,hull);
        const nib=new THREE.Mesh(new THREE.ConeGeometry(0.075,0.2,6),ink);
        nib.rotation.x=Math.PI/2;
        nib.position.z=0.35;
        const band=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,0.08,6),face);
        band.rotation.x=Math.PI/2;
        band.position.z=0.2;
        this.gun.add(barrel,nib,band);
        this.body.add(this.gun);
        this.muzzle=new THREE.Object3D();
        this.muzzle.position.z=0.46;
        this.gun.add(this.muzzle);
        parent.add(this.root);
    }

    buildShield() {
        const R=TUNING.effects.shieldRadius;
        const geo=new THREE.PlaneGeometry(0.95,1.25,6,1);
        const pa=geo.attributes.position;
        for (let i=0;i<pa.count;i++) {
            const x=pa.getX(i);
            const y=pa.getY(i);
            const a=x/R;
            pa.setXYZ(i,Math.sin(a)*R,y+0.95+Math.sin(x*3)*0.05,Math.cos(a)*R);
        }
        geo.computeVertexNormals();
        const m=toonMaterial({light:'paper',mid:'farGray',dark:'midGray',jitter:TUNING.boil.vertexJitter,side:THREE.DoubleSide});
        this.shieldGroup=new THREE.Group();
        this.panels=[];
        for (let i=0;i<3;i++) {
            const holder=new THREE.Group();
            holder.rotation.y=i*Math.PI*2/3;
            const mesh=new THREE.Mesh(geo,m);
            mesh.rotation.z=(i-1)*0.12;
            holder.add(mesh);
            holder.visible=false;
            this.shieldGroup.add(holder);
            this.panels.push(holder);
        }
        this.root.add(this.shieldGroup);
    }

    setShield(n) {
        this.shield=n;
        if (!this.panels) {
            return;
        }
        for (let i=0;i<this.panels.length;i++) {
            this.panels[i].visible=i<n;
        }
    }

    forceDash(dx,dz,speed,dur) {
        this.vel.set(dx*speed,0,dz*speed);
        this.dashT=dur;
        this.dashCd=Math.max(this.dashCd,0.2);
        this.moveYaw=Math.atan2(dx,dz);
        this.stv+=TUNING.player.dashStretch;
        if (this.events.onDash) {
            this.events.onDash(this);
        }
    }

    spawn(p) {
        this.pos.copy(p);
        this.prev.copy(p);
        this.renderPos.copy(p);
        this.vel.set(0,0,0);
        this.root.position.copy(p);
        this.hp=TUNING.player.maxHp;
        this.invuln=0;
        this.setShield(0);
    }

    recoil() {
        this.kick=1;
    }

    isInvulnerable() {
        return this.invuln>0||(TUNING.player.dashInvuln&&this.dashT>0);
    }

    hurt(dmg,dx,dz) {
        const P=TUNING.player;
        if (this.isInvulnerable()||this.hp<=0) {
            return false;
        }
        if (this.shield>0) {
            const idx=this.shield-1;
            this.setShield(this.shield-1);
            this.invuln=0.35;
            this.sqv+=1.5;
            if (this.events.onShield) {
                this.events.onShield(this,idx,dx,dz);
            }
            return false;
        }
        this.hp=Math.max(0,this.hp-dmg);
        this.invuln=P.invulnTime;
        this.vel.x+=dx*P.hurtKnockback;
        this.vel.z+=dz*P.hurtKnockback;
        this.sqv+=TUNING.feel.hurtSquash;
        if (this.events.onHurt) {
            this.events.onHurt(this,dx,dz);
        }
        if (this.hp<=0&&this.events.onDown) {
            this.events.onDown(this);
        }
        return true;
    }

    hitBullet(x,z,r,dmg,vx,vz) {
        const rr=TUNING.player.radius*0.8+r;
        const ex=x-this.pos.x;
        const ez=z-this.pos.z;
        if (ex*ex+ez*ez>=rr*rr) {
            return false;
        }
        if (this.isInvulnerable()) {
            return false;
        }
        const l=Math.hypot(vx,vz)||1;
        this.hurt(dmg,vx/l,vz/l);
        return true;
    }

    muzzlePoint(out) {
        const W=TUNING.weapon;
        const c=Math.cos(this.aimYaw);
        const sn=Math.sin(this.aimYaw);
        out.x=this.pos.x+W.muzzleSide*c+W.muzzleForward*sn;
        out.z=this.pos.z-W.muzzleSide*sn+W.muzzleForward*c;
        return out;
    }

    faceDir(dx,dz) {
        this.aimDirX=dx;
        this.aimDirZ=dz;
        this.aimYaw=Math.atan2(dx,dz);
    }

    fire(ctx,aim) {
        const W=TUNING.weapon;
        const mp=this.muzzlePoint(this._mp||(this._mp={x:0,z:0}));
        const mx=mp.x;
        const mz=mp.z;
        let dx=this.aimDirX;
        let dz=this.aimDirZ;
        if (aim.mode==='point') {
            const ax=aim.point.x-mx;
            const az=aim.point.z-mz;
            const al=Math.hypot(ax,az);
            if (al>1.2) {
                dx=ax/al;
                dz=az/al;
            }
        }
        const a=Math.atan2(dz,dx)+(Math.random()*2-1)*W.spread;
        dx=Math.cos(a);
        dz=Math.sin(a);
        ctx.playerBullets.spawn(mx,mz,dx,dz,W.bulletSpeed,W.damage,W.bulletLife);
        this.recoil();
        this.stv-=0.6;
        if (this.events.onFire) {
            this.events.onFire(this,mx,mz,dx,dz);
        }
    }

    update(dt,input,ctx,aim) {
        const P=TUNING.player;
        const room=ctx.room;
        this.prev.copy(this.pos);
        this.invuln=Math.max(0,this.invuln-dt);
        input.getMove(_mv);
        const moveLen=Math.hypot(_mv.x,_mv.z);
        if (aim.mode==='point') {
            const dx=aim.point.x-this.pos.x;
            const dz=aim.point.z-this.pos.z;
            const l=Math.hypot(dx,dz);
            if (l>0.2) {
                this.aimDirX=dx/l;
                this.aimDirZ=dz/l;
            }
        }
        else if (aim.mode==='dir') {
            this.aimDirX=aim.dx;
            this.aimDirZ=aim.dz;
        }
        else if (moveLen>0.1) {
            this.aimDirX=_mv.x/moveLen;
            this.aimDirZ=_mv.z/moveLen;
        }
        this.dashCd=Math.max(0,this.dashCd-dt);
        if (input.consumeDash()&&this.dashCd<=0) {
            let dx=this.aimDirX;
            let dz=this.aimDirZ;
            if (moveLen>0.1) {
                dx=_mv.x/moveLen;
                dz=_mv.z/moveLen;
            }
            this.vel.set(dx*P.dashSpeed,0,dz*P.dashSpeed);
            this.dashT=P.dashTime;
            this.dashCd=P.dashCooldown;
            this.moveYaw=Math.atan2(dx,dz);
            this.stv+=P.dashStretch;
            if (this.events.onDash) {
                this.events.onDash(this);
            }
        }
        if (this.dashT>0) {
            this.dashT-=dt;
        }
        else {
            const tx=_mv.x*P.speed;
            const tz=_mv.z*P.speed;
            const rate=(moveLen>0.05?P.accel:P.friction)*dt;
            const ex=tx-this.vel.x;
            const ez=tz-this.vel.z;
            const el=Math.hypot(ex,ez);
            if (el<=rate) {
                this.vel.x=tx;
                this.vel.z=tz;
            }
            else {
                this.vel.x+=ex/el*rate;
                this.vel.z+=ez/el*rate;
            }
        }
        this.pos.x+=this.vel.x*dt;
        this.pos.z+=this.vel.z*dt;
        resolveCircle(this.pos,P.radius,room.colliders,3);
        clampToBounds(this.pos,P.radius,room.bounds);
        const sp=Math.hypot(this.pos.x-this.prev.x,this.pos.z-this.prev.z)/dt;
        this.speedFrac=Math.min(1,sp/P.speed);
        const nowMoving=moveLen>0.05&&this.speedFrac>0.05;
        if (nowMoving&&!this.moving) {
            this.moveYaw=Math.atan2(_mv.x,_mv.z);
            this.stv+=P.startStretch;
        }
        else if (!nowMoving&&this.moving&&this.dashT<=0) {
            this.sqv+=P.stopSquash;
        }
        this.moving=nowMoving;
        if (moveLen>0.05&&this.dashT<=0) {
            this.moveYaw=approachAngle(this.moveYaw,Math.atan2(_mv.x,_mv.z),18*dt);
        }
        this.aimYaw=approachAngle(this.aimYaw,Math.atan2(this.aimDirX,this.aimDirZ),P.turnSpeed*dt);
        this.phase+=dt*P.stepFreq*this.speedFrac;
        const k=P.squashStiffness;
        const c=P.squashDamping;
        this.sqv+=(-k*this.sq-c*this.sqv)*dt;
        this.sq+=this.sqv*dt;
        this.stv+=(-k*this.st-c*this.stv)*dt;
        this.st+=this.stv*dt;
        this.sq=Math.max(-0.45,Math.min(0.45,this.sq));
        this.st=Math.max(-0.45,Math.min(0.8,this.st));
        this.kick*=Math.exp(-18*dt);
        this.fireCd-=dt;
        this.rapidT=Math.max(0,this.rapidT-dt);
        if (input.isFiring()&&this.fireCd<=0&&this.hp>0) {
            this.fireCd+=TUNING.weapon.fireInterval/(this.rapidT>0?this.rapidMult:1);
            if (this.fireCd<0) {
                this.fireCd=0;
        this.rapidT=0;
        this.rapidMult=1;
            }
            this.fire(ctx,aim);
        }
        else if (this.fireCd<0) {
            this.fireCd=0;
        this.rapidT=0;
        this.rapidMult=1;
        }
    }

    applyPose() {
        const P=TUNING.player;
        const s=this.speedFrac;
        const ph=this.phase;
        this.poseMoveYaw=this.moveYaw;
        this.moveFrame.rotation.y=this.poseMoveYaw;
        this.leanGroup.rotation.x=P.lean*s+(this.dashT>0?0.2:0)-this.kick*0.08;
        const ks=1-this.sq;
        const kt=1+this.st;
        this.stretch.scale.set(1/Math.sqrt(ks*kt),ks/Math.sqrt(kt),kt/Math.sqrt(ks));
        this.body.position.y=Math.abs(Math.sin(ph))*P.bobAmp*s;
        const swing=Math.sin(ph)*P.legSwing*s;
        this.legs[0].rotation.x=swing;
        this.legs[1].rotation.x=-swing;
        this.arms[0].rotation.x=-swing*P.armSwing/P.legSwing;
        this.arms[0].rotation.z=-0.15;
        this.arms[1].rotation.x=-1.35+this.kick*0.35;
        this.arms[1].rotation.z=0.12;
        const breath=Math.sin(time.real*2.4)*P.idleBreath*(1-s);
        this.torso.scale.y=1+breath;
        this.head.position.y=1.46+breath*0.6;
        this.head.rotation.z=Math.sin(ph*0.5)*0.06*s;
        this.gun.position.z=0.42-this.kick*P.recoilDistance;
    }

    sync(alpha) {
        this.renderPos.lerpVectors(this.prev,this.pos,alpha);
        this.root.position.copy(this.renderPos);
        const step=Math.floor(time.real*TUNING.player.poseFps);
        if (step!==this.poseStep) {
            this.poseStep=step;
            this.applyPose();
        }
        this.aimFrame.rotation.y=this.aimYaw-this.poseMoveYaw;
        if (this.invuln>0&&this.shield===0) {
            this.moveFrame.visible=Math.floor(time.real*TUNING.player.flickerFps)%2===0;
        }
        else {
            this.moveFrame.visible=true;
        }
        if (this.shieldGroup) {
            this.shieldGroup.rotation.y=time.game*TUNING.effects.shieldSpin;
        }
    }
}

export class Clone {
    constructor(fxScene) {
        this.fig=new Player(fxScene,{ghost:true});
        this.active=false;
        this.t=0;
        this.fireCd=0;
        this.fig.root.visible=false;
        this.mp={x:0,z:0};
    }

    start(x,z,duration,damage) {
        const f=this.fig;
        f.pos.set(x,0,z);
        f.prev.copy(f.pos);
        f.vel.set(0,0,0);
        f.sq=0.4;
        f.sqv=-3;
        f.st=0;
        f.stv=0;
        this.active=true;
        this.t=0;
        this.life=duration;
        this.damage=damage;
        f.root.visible=true;
        for (const m of f.ghostMats) {
            m.uniforms.uAlpha.value=0.75;
        }
    }

    update(dt,ctx) {
        if (!this.active) {
            return;
        }
        const f=this.fig;
        const E=TUNING.effects;
        this.t+=dt;
        f.prev.copy(f.pos);
        const e=ctx.enemyMgr.nearest(f.pos.x,f.pos.z,E.cloneRange);
        if (e) {
            const dx=e.pos.x-f.pos.x;
            const dz=e.pos.z-f.pos.z;
            const l=Math.hypot(dx,dz)||1;
            f.aimDirX=dx/l;
            f.aimDirZ=dz/l;
            let d=Math.atan2(f.aimDirX,f.aimDirZ)-f.aimYaw;
            while (d>Math.PI) {
                d-=Math.PI*2;
            }
            while (d<-Math.PI) {
                d+=Math.PI*2;
            }
            f.aimYaw+=d*Math.min(1,20*dt);
            this.fireCd-=dt;
            if (this.fireCd<=0&&this.t>0.3) {
                this.fireCd=E.cloneFire;
                const m=f.muzzlePoint(this.mp);
                ctx.playerBullets.spawn(m.x,m.z,f.aimDirX,f.aimDirZ,TUNING.weapon.bulletSpeed,this.damage,TUNING.weapon.bulletLife);
                ctx.muzzle.show(m.x,TUNING.weapon.height,m.z,'nearGray',0.7);
                f.kick=1;
            }
        }
        f.kick*=Math.exp(-18*dt);
        const k=TUNING.player.squashStiffness;
        const c=TUNING.player.squashDamping;
        f.sqv+=(-k*f.sq-c*f.sqv)*dt;
        f.sq+=f.sqv*dt;
        f.sq=Math.max(-0.45,Math.min(0.45,f.sq));
        const fade=Math.min(1,(this.life-this.t)/0.4);
        for (const m of f.ghostMats) {
            m.uniforms.uAlpha.value=0.75*Math.max(0,fade);
        }
        if (this.t>=this.life) {
            this.active=false;
            f.root.visible=false;
        }
    }

    sync(alpha) {
        if (this.active) {
            this.fig.sync(alpha);
        }
    }
}
