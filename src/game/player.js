import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {toonMaterial,unlitMaterial,registerShadow,hullMaterial,pal} from '../render/materials.js';
import {resolveCircle,clampToBounds} from '../core/collision.js';
import {time} from '../core/loop.js';
import {SKIN_TONES,ACCENTS} from '../data/palette.js';
import {WEAPONS,WEAPON_LIMITS} from '../data/weapons.js';
import {DEFAULT_SKIN} from '../data/skins.js';

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
        this.hasteT=0;
        this.hasteMult=1;
        this.rapidMult=1;
        this.dualT=0;
        this.reflectT=0;
        this.W={...TUNING.weapon,...WEAPONS.pen};
        this.weaponId='pen';
        this.burstLeft=0;
        this.burstT=0;
        this.beamT=0;
        this.coolT=0;
        this.shotSeq=0;
        this.pending=[];
        this.resolved=[];
        this.equipAt=-9;
        this.ammo=this.W.magazine;
        this.reloadT=0;
        this.hp=TUNING.player.maxHp;
        this.invuln=0;
        this.shield=0;
        this.events={onDash:null,onFire:null,onHurt:null,onDown:null,onShield:null};
        this.build(parent);
    }

    build(parent) {
        const J=TUNING.boil.vertexJitter;
        const g=this.ghost;
        const tm=o=>toonMaterial(g?{...o,ghost:true,unique:true,alpha:0.75}:{...o,unique:true});
        const dark=tm({light:'midGray',mid:'nearGray',dark:'ink',jitter:J});
        const coat=tm({light:'farGray',mid:'midGray',dark:'ink',jitter:J});
        const face=tm({light:'paper',mid:'farGray',dark:'midGray',jitter:J});
        const hat=tm({light:'midGray',mid:'nearGray',dark:'ink',jitter:J});
        const gear=tm({light:'nearGray',mid:'nearGray',dark:'ink',jitter:J});
        const ink=g?dark:unlitMaterial({color:'ink',jitter:J,unique:true});
        this.skinMats={coat,limbs:dark,face,hat,gear,accent:g?null:ink};
        this.ghostMats=g?[dark,coat,face,hat,gear]:[];
        const hull={jitter:J};
        this.hullMat=g?null:hullMaterial({jitter:J,unique:true});
        const addHull=g?()=>null:(mesh=>{
            const h=new THREE.Mesh(mesh.geometry,this.hullMat);
            h.name='hull';
            h.renderOrder=mesh.renderOrder;
            mesh.add(h);
            return h;
        });
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
        const legGeo=capsule(0.12,0.2);
        const shoeGeo=new THREE.BoxGeometry(0.22,0.13,0.32);
        this.legs=[];
        for (const sx of [-1,1]) {
            const pivot=new THREE.Group();
            pivot.position.set(sx*0.15,0.5,0);
            const leg=new THREE.Mesh(legGeo,dark);
            leg.position.y=-0.2;
            addHull(leg,hull);
            pivot.add(leg);
            const shoe=new THREE.Mesh(shoeGeo,gear);
            shoe.position.set(0,-0.43,0.05);
            addHull(shoe,hull);
            pivot.add(shoe);
            this.body.add(pivot);
            this.legs.push(pivot);
        }
        this.torso=new THREE.Mesh(capsule(0.28,0.3),coat);
        this.torso.position.y=0.9;
        this.torso.scale.z=0.85;
        addHull(this.torso,hull);
        this.body.add(this.torso);
        const hem=new THREE.Mesh(new THREE.CylinderGeometry(0.3,0.32,0.1,12),coat);
        hem.position.y=-0.28;
        this.torso.add(hem);
        const belt=new THREE.Mesh(new THREE.TorusGeometry(0.285,0.045,5,16),gear);
        belt.rotation.x=Math.PI/2;
        belt.position.y=-0.14;
        this.torso.add(belt);
        const buckle=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.08,0.04),face);
        buckle.position.set(0,-0.14,0.29);
        this.torso.add(buckle);
        const btnGeo=new THREE.SphereGeometry(0.032,6,4);
        for (const by of [0.02,0.14]) {
            const b=new THREE.Mesh(btnGeo,ink);
            b.position.set(0,by,0.28);
            this.torso.add(b);
        }
        const pouch=new THREE.Mesh(new THREE.BoxGeometry(0.26,0.3,0.14),gear);
        pouch.position.set(0,0.02,-0.3);
        addHull(pouch,hull);
        this.torso.add(pouch);
        const flap=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.08,0.16),hat);
        flap.position.set(0,0.16,-0.3);
        this.torso.add(flap);
        const scarf=new THREE.Mesh(new THREE.TorusGeometry(0.2,0.075,6,14),hat);
        scarf.rotation.x=Math.PI/2;
        scarf.position.y=1.2;
        addHull(scarf,hull);
        this.body.add(scarf);
        const tail=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.26,0.05),hat);
        tail.position.set(0.1,1.06,-0.2);
        tail.rotation.set(0.35,0,-0.25);
        this.body.add(tail);
        this.scarfTail=tail;
        this.head=new THREE.Group();
        this.head.position.y=1.46;
        const skull=new THREE.Mesh(new THREE.SphereGeometry(0.31,12,9),face);
        addHull(skull,hull);
        this.head.add(skull);
        const eyeGeo=new THREE.BoxGeometry(0.06,0.13,0.05);
        for (const sx of [-1,1]) {
            const eye=new THREE.Mesh(eyeGeo,ink);
            eye.position.set(sx*0.1,0.03,0.28);
            this.head.add(eye);
            const cheek=new THREE.Mesh(new THREE.CircleGeometry(0.035,8),coat);
            cheek.position.set(sx*0.17,-0.07,0.265);
            cheek.rotation.y=sx*0.55;
            this.head.add(cheek);
        }
        const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.24,0.06,12),hat);
        brim.position.set(0,0.24,-0.02);
        brim.rotation.x=-0.3;
        addHull(brim,hull);
        this.head.add(brim);
        const drop=new THREE.Mesh(new THREE.ConeGeometry(0.15,0.36,10),hat);
        drop.position.set(0,0.4,-0.08);
        drop.rotation.x=-0.45;
        addHull(drop,hull);
        this.head.add(drop);
        const tip=new THREE.Mesh(new THREE.SphereGeometry(0.045,6,4),ink);
        tip.position.set(0,0.55,-0.17);
        this.head.add(tip);
        this.body.add(this.head);
        const armGeo=capsule(0.08,0.22);
        const handGeo=new THREE.SphereGeometry(0.085,8,6);
        this.arms=[];
        for (const sx of [-1,1]) {
            const pivot=new THREE.Group();
            pivot.position.set(sx*0.36,1.08,0);
            const arm=new THREE.Mesh(armGeo,coat);
            arm.position.y=-0.16;
            addHull(arm,hull);
            pivot.add(arm);
            const cuff=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.095,0.06,8),dark);
            cuff.position.y=-0.32;
            pivot.add(cuff);
            const hand=new THREE.Mesh(handGeo,gear);
            hand.position.y=-0.41;
            addHull(hand,hull);
            pivot.add(hand);
            this.body.add(pivot);
            this.arms.push(pivot);
        }
        this.bottle=new THREE.Group();
        const jar=new THREE.Mesh(new THREE.CylinderGeometry(0.11,0.12,0.2,7),face);
        addHull(jar,hull);
        const neck=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.06,0.08,6),ink);
        neck.position.y=0.14;
        const fill=new THREE.Mesh(new THREE.CylinderGeometry(0.115,0.125,0.1,7),ink);
        fill.position.y=-0.05;
        this.bottle.add(jar,neck,fill);
        this.bottle.position.set(0,-0.46,0.06);
        this.bottle.visible=false;
        this.arms[0].add(this.bottle);
        this.gun=new THREE.Group();
        this.gun.position.set(0.34,1.0,0.42);
        const barrel=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,0.5,8),gear);
        barrel.rotation.x=Math.PI/2;
        addHull(barrel,hull);
        const nib=new THREE.Mesh(new THREE.ConeGeometry(0.075,0.2,8),ink);
        nib.rotation.x=Math.PI/2;
        nib.position.z=0.35;
        const band=new THREE.Mesh(new THREE.CylinderGeometry(0.085,0.085,0.08,8),face);
        band.rotation.x=Math.PI/2;
        band.position.z=0.2;
        const cap=new THREE.Mesh(new THREE.CylinderGeometry(0.082,0.07,0.08,8),hat);
        cap.rotation.x=Math.PI/2;
        cap.position.z=-0.27;
        const clip=new THREE.Mesh(new THREE.BoxGeometry(0.025,0.03,0.26),face);
        clip.position.set(0,0.09,-0.08);
        const penG=new THREE.Group();
        penG.add(barrel,nib,band,cap,clip);
        this.gun.add(penG);
        const looks={pen:penG};
        const mk=(geo,mat,x,y,z,rx=Math.PI/2,hl=true)=>{
            const m=new THREE.Mesh(geo,mat);
            m.position.set(x,y,z);
            m.rotation.x=rx;
            if (hl) {
                addHull(m,hull);
            }
            return m;
        };
        const pencil=new THREE.Group();
        pencil.add(mk(new THREE.CylinderGeometry(0.07,0.07,0.52,6),gear,0,0,-0.02));
        pencil.add(mk(new THREE.ConeGeometry(0.07,0.18,6),face,0,0,0.33,Math.PI/2,false));
        pencil.add(mk(new THREE.ConeGeometry(0.025,0.07,6),ink,0,0,0.43,Math.PI/2,false));
        pencil.add(mk(new THREE.CylinderGeometry(0.075,0.075,0.07,6),face,0,0,-0.3,Math.PI/2,false));
        pencil.add(mk(new THREE.CylinderGeometry(0.068,0.068,0.08,6),hat,0,0,-0.37,Math.PI/2,false));
        looks.pencil=pencil;
        const brush=new THREE.Group();
        brush.add(mk(new THREE.CylinderGeometry(0.045,0.055,0.5,8),hat,0,0,-0.08));
        brush.add(mk(new THREE.CylinderGeometry(0.06,0.05,0.08,8),face,0,0,0.19,Math.PI/2,false));
        brush.add(mk(new THREE.ConeGeometry(0.075,0.26,8),ink,0,0,0.35,Math.PI/2));
        looks.brush=brush;
        const stapler=new THREE.Group();
        stapler.add(mk(new THREE.BoxGeometry(0.16,0.09,0.52),gear,0,-0.04,0,0));
        stapler.add(mk(new THREE.BoxGeometry(0.14,0.08,0.48),hat,0,0.06,0.01,-0.08));
        stapler.add(mk(new THREE.BoxGeometry(0.12,0.04,0.06),ink,0,0.01,0.27,0,false));
        looks.stapler=stapler;
        const hi=new THREE.Group();
        hi.add(mk(new THREE.CylinderGeometry(0.1,0.1,0.42,8),coat,0,0,0));
        hi.add(mk(new THREE.CylinderGeometry(0.105,0.105,0.14,8),hat,0,0,-0.26,Math.PI/2));
        hi.add(mk(new THREE.BoxGeometry(0.12,0.04,0.12),face,0,0,0.26,0.6,false));
        looks.highlighter=hi;
        const comp=new THREE.Group();
        for (const sx of [-1,1]) {
            const leg=mk(new THREE.CylinderGeometry(0.03,0.02,0.52,6),gear,sx*0.05,0,0.06);
            leg.rotation.z=sx*0.12;
            comp.add(leg);
        }
        comp.add(mk(new THREE.SphereGeometry(0.06,8,6),face,0,0,-0.22,0));
        comp.add(mk(new THREE.ConeGeometry(0.02,0.08,6),ink,0.02,0,0.34,Math.PI/2,false));
        looks.compass=comp;
        for (const k in looks) {
            if (k!=='pen') {
                this.gun.add(looks[k]);
            }
        }
        this.weaponLook=id=>{
            for (const k in looks) {
                looks[k].visible=k===id;
            }
        };
        this.weaponLook('pen');
        this.body.add(this.gun);
        this.muzzle=new THREE.Object3D();
        this.muzzle.position.z=0.46;
        this.gun.add(this.muzzle);
        parent.add(this.root);
    }

    applySkin(skin) {
        const S=TUNING.skinHatch;
        const plain=['coat','limbs','face','hat','gear'].every(k=>skin[k]===DEFAULT_SKIN[k]);
        if (this.hullMat) {
            this.hullMat.uniforms.uWidth.value=plain?S.hullPlain:S.hullColor;
            this.hullMat.uniforms.uColor.value.copy(pal(plain?'ink':S.hullTone));
        }
        for (const part of ['coat','limbs','face','hat','gear']) {
            const m0=this.skinMats[part];
            if (m0) {
                m0.uniforms.uHatch.value.set(plain?1:S.lines,plain?0:S.shade);
            }
            const tones=SKIN_TONES[skin[part]];
            const m=this.skinMats[part];
            if (!tones||!m) {
                continue;
            }
            m.uniforms.uColLight.value.set(tones[0]);
            m.uniforms.uColMid.value.set(tones[1]);
            m.uniforms.uColDark.value.set(tones[2]);
        }
        const a=this.skinMats.accent;
        if (a&&ACCENTS[skin.accent]) {
            a.uniforms.uColor.value.set(ACCENTS[skin.accent]);
        }
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
        const n=TUNING.effects.shieldPanels;
        for (let i=0;i<n;i++) {
            const holder=new THREE.Group();
            holder.rotation.y=i*Math.PI*2/n;
            const mesh=new THREE.Mesh(geo,m);
            mesh.rotation.z=((i%3)-1)*0.12;
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
            this.panels[i].rotation.y=i*Math.PI*2/Math.max(1,n);
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

    enterRoom(p) {
        this.pos.copy(p);
        this.prev.copy(p);
        this.renderPos.copy(p);
        this.vel.set(0,0,0);
        this.root.position.copy(p);
        this.dashT=0;
        this.rapidT=0;
        this.hasteT=0;
        this.hasteMult=1;
        this.dualT=0;
        this.reflectT=0;
        this.ammo=this.W.magazine;
        this.burstLeft=0;
        this.reloadT=0;
        this.invuln=1.0;
        this.setShield(0);
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

    resetPose() {
        this.speedFrac=0;
        this.moving=false;
        this.phase=0;
        this.sq=0;
        this.st=0;
        this.sqv=0;
        this.stv=0;
        this.kick=0;
        this.dashT=0;
        this.dashIT=0;
        this.reloadT=0;
        this.beamT=0;
        this.moveYaw=0;
        this.poseMoveYaw=0;
        this.invuln=0;
        this.moveFrame.visible=true;
        this.poseStep=-1;
        this.applyPose();
    }

    setWeapon(id) {
        const def=WEAPONS[id]||WEAPONS.pen;
        this.weaponId=WEAPONS[id]?id:'pen';
        this.W={...TUNING.weapon,...def};
        this.ammo=this.W.magazine;
        this.reloadT=0;
        this.burstLeft=0;
        this.beamT=0;
        this.pending.length=0;
        this.resolved.length=0;
        this.equipAt=time.real;
        if (this.weaponLook) {
            this.weaponLook(this.weaponId);
        }
        if (this.events&&this.events.onEquip) {
            this.events.onEquip(this);
        }
    }

    shotHit(tag) {
        for (const p of this.pending) {
            if (p.id===tag) {
                p.hits++;
                return;
            }
        }
    }

    updateRefund(dt) {
        const F=this.W.refund;
        if (!F) {
            return;
        }
        for (let i=this.pending.length-1;i>=0;i--) {
            const p=this.pending[i];
            p.t-=dt;
            if (p.t>0) {
                continue;
            }
            this.pending.splice(i,1);
            this.resolved.push(p.hits);
            if (this.resolved.length<F.shots) {
                continue;
            }
            const sum=this.resolved.reduce((a,b)=>a+b,0);
            this.resolved.length=0;
            if (sum>F.maxHits) {
                continue;
            }
            if (this.reloadT>0) {
                this.reloadT=0;
                this.ammo=1;
            }
            else {
                this.ammo=Math.min(this.W.magazine,this.ammo+1);
            }
            if (this.events.onRefund) {
                this.events.onRefund(this);
            }
        }
    }

    updateHeat(dt,firing) {
        const B=this.W.beam;
        this.beamT=Math.max(0,this.beamT-dt);
        if (!B) {
            return;
        }
        if (firing) {
            this.coolT=B.cool.delay;
            return;
        }
        this.coolT-=dt;
        if (this.coolT<=0&&this.reloadT<=0&&this.ammo<this.W.magazine) {
            this.ammo=Math.min(this.W.magazine,this.ammo+B.cool.rate*dt);
        }
    }

    startReload() {
        this.burstLeft=0;
        this.reloadT=this.W.reloadTime;
        if (this.events.onReload) {
            this.events.onReload(this);
        }
    }

    isInvulnerable() {
        return this.invuln>0||(TUNING.player.dashInvuln&&(this.dashT>0||this.dashIT>0));
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

    shoot(ctx,aim) {
        this.fire(ctx,aim);
        if (this.rapidT<=0) {
            this.ammo--;
            if (this.ammo<=0&&!this.W.returns) {
                this.startReload();
            }
        }
    }

    fireAngle(mx,mz) {
        const aim=this.lastAim;
        if (aim&&aim.mode==='point') {
            const ax=aim.point.x-mx;
            const az=aim.point.z-mz;
            if (Math.hypot(ax,az)>1.2) {
                return Math.atan2(az,ax);
            }
        }
        return Math.atan2(this.aimDirZ,this.aimDirX);
    }

    fire(ctx,aim) {
        const W=this.W;
        const mp=this.muzzlePoint(this._mp||(this._mp={x:0,z:0}));
        const mx=mp.x;
        const mz=mp.z;
        this.lastAim=aim;
        const base=this.fireAngle(mx,mz);
        let dx;
        let dz;
        if (W.beam) {
            this.beamT=W.fireInterval*1.8;
            if (ctx.onBeam) {
                ctx.onBeam(mx,mz,Math.cos(base),Math.sin(base),W);
            }
        }
        else {
            const sys=ctx.weaponSys[W.sys]||ctx.playerBullets;
            const n=W.pellets||1;
            const lanes=this.dualT>0?[-W.dualOffset,W.dualOffset]:[0];
            const tag=W.refund?++this.shotSeq:0;
            if (tag) {
                this.pending.push({id:tag,hits:0,t:W.bulletLife+0.08});
            }
            for (let p=0;p<n;p++) {
                const a=base+(n>1?(p/(n-1)-0.5)*W.fan:0)+(Math.random()*2-1)*W.spread;
                const cx=Math.cos(a);
                const cz=Math.sin(a);
                for (const o of lanes) {
                    const bi=sys.spawn(mx-cz*o,mz+cx*o,cx,cz,W.bulletSpeed,W.damage,W.bulletLife);
                    if (bi>=0) {
                        sys.tag[bi]=tag;
                    }
                }
            }
        }
        if (W.erase) {
            const E=W.erase;
            const px=this.pos.x;
            const pz=this.pos.z;
            ctx.enemyBullets.killWhere((x,z)=>{
                const ex=x-px;
                const ez=z-pz;
                const l=Math.hypot(ex,ez);
                return l<E.radius&&(ex*Math.cos(base)+ez*Math.sin(base))/(l||1)>Math.cos(E.cone);
            },(x,z)=>ctx.particles.burst(x,1,z,2,{color:'farGray',speed:[1,3],up:[1,2]}));
            if (ctx.onBrush) {
                ctx.onBrush(mx,mz,base,W.fan,E.radius);
            }
        }
        dx=Math.cos(base);
        dz=Math.sin(base);
        this.recoil();
        this.stv-=0.6;
        if (this.events.onFire) {
            this.events.onFire(this,mx,mz,dx,dz);
        }
    }

    update(dt,input,ctx,aim) {
        const P=TUNING.player;
        this.lastAim=aim;
        const room=ctx.room;
        this.prev.copy(this.pos);
        this.invuln=Math.max(0,this.invuln-dt);
        this.dashIT=Math.max(0,(this.dashIT||0)-dt);
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
        this.dashCd=Math.max(0,this.dashCd-dt*(this.hasteT>0?this.hasteMult:1));
        this.hasteT=Math.max(0,this.hasteT-dt);
        if (input.consumeDash()&&this.dashCd<=0) {
            let dx=this.aimDirX;
            let dz=this.aimDirZ;
            if (moveLen>0.1) {
                dx=_mv.x/moveLen;
                dz=_mv.z/moveLen;
            }
            this.vel.set(dx*P.dashSpeed,0,dz*P.dashSpeed);
            this.dashT=P.dashTime;
            this.dashIT=P.dashIframe;
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
            const slow=room.zones.playerSlowAt(this.pos.x,this.pos.z);
            const hm=this.hasteT>0?this.hasteMult:1;
            const tx=_mv.x*P.speed*slow*hm;
            const tz=_mv.z*P.speed*slow*hm;
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
        const W=this.W;
        if (this.reloadT>0) {
            this.reloadT-=dt;
            if (this.reloadT<=0) {
                this.reloadT=0;
                this.ammo=W.magazine;
                if (this.events.onReloaded) {
                    this.events.onReloaded(this);
                }
            }
        }
        else if (input.consumeReload&&input.consumeReload()&&this.ammo<W.magazine&&!W.heat&&!W.returns) {
            this.startReload();
        }
        this.updateHeat(dt,input.isFiring()&&this.reloadT<=0&&this.ammo>0);
        this.updateRefund(dt);
        this.rapidT=Math.max(0,this.rapidT-dt);
        this.dualT=Math.max(0,this.dualT-dt);
        this.reflectT=Math.max(0,this.reflectT-dt);
        if (this.burstLeft>0&&this.hp>0&&this.reloadT<=0) {
            this.burstT-=dt;
            if (this.burstT<=0) {
                this.burstT+=W.burstGap;
                this.burstLeft--;
                this.shoot(ctx,aim);
            }
        }
        if (input.isFiring()&&this.fireCd<=0&&this.hp>0&&this.reloadT<=0&&this.ammo>0&&this.burstLeft<=0) {
            this.fireCd+=Math.max(Math.min(W.fireInterval,WEAPON_LIMITS.minInterval),W.fireInterval/(this.rapidT>0?this.rapidMult:1));
            if (this.fireCd<0) {
                this.fireCd=0;
            }
            if (W.burst>1) {
                this.burstLeft=W.burst-1;
                this.burstT=W.burstGap;
            }
            this.shoot(ctx,aim);
        }
        else if (this.fireCd<0) {
            this.fireCd=0;
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
        this.gun.position.y=1.0;
        this.gun.rotation.set(0,0,0);
        this.head.rotation.x=0;
        this.bottle.visible=false;
        if (this.reloadT>0) {
            this.poseReload(1-this.reloadT/this.W.reloadTime);
        }
        const Q=TUNING.equip;
        const e=(time.real-this.equipAt)/Q.time;
        if (e>=0&&e<1) {
            const pop=e<0.6?Math.sin(e/0.6*Math.PI*0.5):1+Math.sin((e-0.6)/0.4*Math.PI)*0.12;
            this.gun.scale.setScalar(Math.max(0.01,pop));
            this.gun.rotation.z=(1-e)*(1-e)*Math.PI*2*Q.spin;
            this.gun.position.y=1.0+Math.sin(e*Math.PI)*Q.lift;
            this.arms[1].rotation.x=-1.35-Math.sin(e*Math.PI)*0.6;
        }
        else {
            this.gun.scale.setScalar(1);
        }
    }

    poseReload(r) {
        const R=TUNING.player.reloadPose;
        const up=Math.min(1,r/R.raise)*(r<R.snap?1:Math.max(0,1-(r-R.snap)/(1-R.snap)));
        const pour=r>R.raise&&r<R.snap?Math.sin((r-R.raise)/(R.snap-R.raise)*Math.PI):0;
        this.gun.rotation.x=-R.gunTilt*up;
        this.gun.rotation.z=r>=R.snap?(r-R.snap)/(1-R.snap)*Math.PI*2:Math.sin(r*R.shakeFreq)*R.shake*pour;
        this.gun.position.y=1.0+R.gunLift*up;
        this.gun.position.z=0.42-R.gunBack*up;
        this.arms[1].rotation.x=-1.35-R.armRaise*up;
        this.arms[0].rotation.x=this.arms[0].rotation.x*(1-up)-R.offArm*up;
        this.arms[0].rotation.z=-0.15+R.offArmIn*up;
        this.head.rotation.x=R.headTilt*up;
        this.bottle.visible=up>0.35;
        this.bottle.rotation.x=-R.pourTilt*pour;
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
        if (this.invuln>0&&this.shield===0&&time.timeScale>0) {
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

    stop() {
        this.active=false;
        this.fig.root.visible=false;
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
