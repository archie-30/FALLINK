import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {toonMaterial,unlitMaterial,registerShadow,hullMaterial,pal} from '../render/materials.js';
import {resolveCircle,clampToBounds} from '../core/collision.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
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
        this.dropDual(true);
        this.reflectT=0;
        this.W={...TUNING.weapon,...WEAPONS.pen};
        this.weaponId='pen';
        this.burstLeft=0;
        this.burstT=0;
        this.beamT=0;
        this.coolT=0;
        this.equipAt=-9;
        this.armed=true;
        this.armK=1;
        this.armAt=-9;
        this.ammo=this.W.magazine;
        this.cdT=0;
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
        const sleeve=tm({light:'farGray',mid:'farGray',dark:'midGray',jitter:J,softNormal:TUNING.skinHatch.sleeveSoft});
        const face=tm({light:'paper',mid:'farGray',dark:'midGray',jitter:J});
        const hat=tm({light:'midGray',mid:'nearGray',dark:'ink',jitter:J*TUNING.boil.hatJitter});
        const gear=tm({light:'nearGray',mid:'nearGray',dark:'ink',jitter:J});
        const ink=g?dark:unlitMaterial({color:'ink',jitter:J,unique:true});
        this.skinMats={coat,limbs:dark,face,hat,gear,accent:g?null:ink};
        this.sleeveMat=sleeve;
        this.ghostMats=g?[dark,coat,face,hat,gear,sleeve]:[];
        const hull={jitter:J};
        this.hullMat=g?null:hullMaterial({jitter:J,unique:true});
        this.limbHullMat=g?null:hullMaterial({jitter:J,unique:true});
        const addHull=g?()=>null:((mesh,o,thin=false)=>{
            const h=new THREE.Mesh(mesh.geometry,thin?this.limbHullMat:this.hullMat);
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
        const brim=new THREE.Mesh(new THREE.CylinderGeometry(0.21,0.25,0.06,12),hat);
        brim.position.set(0,TUNING.skinHatch.brimY,-0.02);
        brim.rotation.x=-0.3;
        addHull(brim,hull);
        this.head.add(brim);
        const drop=new THREE.Mesh(new THREE.ConeGeometry(0.15,0.36,10),hat);
        drop.position.set(0,TUNING.skinHatch.brimY+0.16,-0.08);
        drop.rotation.x=-0.45;
        addHull(drop,hull);
        this.head.add(drop);
        const tip=new THREE.Mesh(new THREE.SphereGeometry(0.045,6,4),ink);
        tip.position.set(0,TUNING.skinHatch.brimY+0.31,-0.17);
        this.head.add(tip);
        this.body.add(this.head);
        const armGeo=capsule(0.08,0.22);
        const handGeo=new THREE.SphereGeometry(0.085,8,6);
        this.arms=[];
        for (const sx of [-1,1]) {
            const pivot=new THREE.Group();
            pivot.position.set(sx*0.36,1.08,0);
            const arm=new THREE.Mesh(armGeo,sleeve);
            arm.position.y=-0.16;
            addHull(arm,hull,true);
            pivot.add(arm);
            const cuff=new THREE.Mesh(new THREE.CylinderGeometry(0.095,0.095,0.06,8),dark);
            cuff.position.y=-0.32;
            pivot.add(cuff);
            const hand=new THREE.Mesh(handGeo,gear);
            hand.position.y=-0.41;
            addHull(hand,hull,true);
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
        const WS=TUNING.player.weaponSoft;
        const wL=g?coat:tm({light:'paper',mid:'farGray',dark:'midGray',jitter:J,softNormal:WS});
        const wM=g?coat:tm({light:'farGray',mid:'midGray',dark:'nearGray',jitter:J,softNormal:WS});
        const wD=g?coat:tm({light:'midGray',mid:'nearGray',dark:'ink',jitter:J,softNormal:WS});
        const mk=(geo,mat,x,y,z,rx=Math.PI/2,hl=true)=>{
            const m=new THREE.Mesh(geo,mat);
            m.position.set(x,y,z);
            m.rotation.x=rx;
            if (hl&&TUNING.player.weaponHull) {
                addHull(m,hull,true);
            }
            return m;
        };
        const penG=new THREE.Group();
        penG.add(mk(new THREE.CylinderGeometry(0.048,0.048,0.46,10),wM,0,0,0));
        penG.add(mk(new THREE.ConeGeometry(0.048,0.18,10),wD,0,0,0.32,Math.PI/2,false));
        penG.add(mk(new THREE.ConeGeometry(0.014,0.05,6),ink,0,0,0.43,Math.PI/2,false));
        penG.add(mk(new THREE.CylinderGeometry(0.054,0.054,0.06,10),wL,0,0,0.19,Math.PI/2,false));
        penG.add(mk(new THREE.CylinderGeometry(0.052,0.046,0.08,10),wD,0,0,-0.25,Math.PI/2,false));
        penG.add(mk(new THREE.BoxGeometry(0.016,0.022,0.22),wL,0,0.06,-0.08,0,false));
        this.gun.add(penG);
        const looks={pen:penG};
        const pencil=new THREE.Group();
        pencil.add(mk(new THREE.CylinderGeometry(0.045,0.045,0.5,6),wL,0,0,-0.02));
        pencil.add(mk(new THREE.ConeGeometry(0.045,0.16,6),wM,0,0,0.31,Math.PI/2,false));
        pencil.add(mk(new THREE.ConeGeometry(0.016,0.06,6),ink,0,0,0.41,Math.PI/2,false));
        pencil.add(mk(new THREE.CylinderGeometry(0.05,0.05,0.06,6),wD,0,0,-0.29,Math.PI/2,false));
        pencil.add(mk(new THREE.CylinderGeometry(0.044,0.044,0.07,6),wM,0,0,-0.35,Math.PI/2,false));
        looks.pencil=pencil;
        const brush=new THREE.Group();
        brush.add(mk(new THREE.CylinderGeometry(0.032,0.04,0.5,8),wL,0,0,-0.08));
        brush.add(mk(new THREE.CylinderGeometry(0.045,0.036,0.07,8),wM,0,0,0.19,Math.PI/2,false));
        brush.add(mk(new THREE.ConeGeometry(0.055,0.24,8),ink,0,0,0.34,Math.PI/2,false));
        looks.brush=brush;
        const stapler=new THREE.Group();
        stapler.add(mk(new THREE.BoxGeometry(0.12,0.06,0.46),wM,0,-0.03,0,0));
        stapler.add(mk(new THREE.BoxGeometry(0.1,0.055,0.42),wL,0,0.04,0.01,-0.08));
        stapler.add(mk(new THREE.BoxGeometry(0.09,0.03,0.05),wD,0,0.01,0.24,0,false));
        looks.stapler=stapler;
        const hi=new THREE.Group();
        hi.add(mk(new THREE.CylinderGeometry(0.068,0.068,0.4,8),wL,0,0,0));
        hi.add(mk(new THREE.CylinderGeometry(0.072,0.072,0.12,8),wD,0,0,-0.24,Math.PI/2,false));
        hi.add(mk(new THREE.BoxGeometry(0.08,0.03,0.09),wM,0,0,0.24,0.6,false));
        looks.highlighter=hi;
        const comp=new THREE.Group();
        for (const sx of [-1,1]) {
            const leg=mk(new THREE.CylinderGeometry(0.02,0.012,0.5,6),wM,sx*0.045,0,0.06);
            leg.rotation.z=sx*0.12;
            comp.add(leg);
        }
        comp.add(mk(new THREE.SphereGeometry(0.045,8,6),wL,0,0,-0.21,0,false));
        comp.add(mk(new THREE.ConeGeometry(0.014,0.07,6),ink,0.02,0,0.33,Math.PI/2,false));
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
            const w=plain?S.hullPlain:S.hullColor;
            const c=pal(plain?'ink':S.hullTone);
            this.hullMat.uniforms.uWidth.value=w;
            this.hullMat.uniforms.uColor.value.copy(c);
            this.limbHullMat.uniforms.uWidth.value=w*S.limbHull;
            this.limbHullMat.uniforms.uColor.value.copy(c);
        }
        for (const part of ['coat','limbs','face','hat','gear']) {
            const m0=this.skinMats[part];
            if (m0) {
                m0.uniforms.uHatch.value.set(S.lines,S.shade);
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
        const st=SKIN_TONES[skin.coat];
        const sm=this.sleeveMat;
        if (st&&sm) {
            sm.uniforms.uColLight.value.set(st[0]);
            sm.uniforms.uColMid.value.set(st[0]).lerp(sm.uniforms.uColDark.value.set(st[1]),S.sleeveMid);
            sm.uniforms.uColDark.value.set(st[1]);
            sm.uniforms.uHatch.value.set(S.lines,S.shade);
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

    setArmed(on,instant=false) {
        if (on===this.armed&&!instant) {
            return;
        }
        this.armed=on;
        this.armAt=time.real;
        if (instant) {
            this.armK=on?1:0;
        }
        if (on&&!instant&&this.events&&this.events.onArm) {
            this.events.onArm(this);
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
        this.cdT=0;
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
        this.cdT=0;
        this.reloadT=0;
        this.burstLeft=0;
        this.beamT=0;
        this.equipAt=time.real;
        if (this.weaponLook) {
            this.weaponLook(this.weaponId);
        }
        if (this.gunL&&!this.gunL.userData.drop) {
            this.dropDual(true);
            this.equipDual();
        }
        if (this.events&&this.events.onEquip) {
            this.events.onEquip(this);
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
            this.events.onHurt(this,dx,dz,dmg);
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
            if ((this.dashT>0||this.dashIT>0)&&!this.dodged) {
                this.dodged=true;
                if (this.events.onDodge) {
                    this.events.onDodge(this);
                }
            }
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
        if (this.W.cooldown) {
            this.cdT=this.W.cooldown/(this.rapidT>0?this.rapidMult:1);
            return;
        }
        if (this.rapidT<=0) {
            this.ammo--;
            if (this.ammo<=0) {
                if (this.W.refund) {
                    this.pendReload=true;
                    this.pendT=this.W.bulletLife+this.W.refund.wait;
                }
                else {
                    this.startReload();
                }
            }
        }
    }

    swingResult(dealt) {
        const W=this.W;
        if (!W.refund) {
            return;
        }
        this.lowStreak=dealt<=W.refund.max?(this.lowStreak||0)+1:0;
        if (this.lowStreak>=W.refund.streak) {
            this.lowStreak=0;
            this.ammo=Math.min(W.magazine,this.ammo+1);
            this.pendReload=false;
            if (this.events.onRefund) {
                this.events.onRefund(this);
            }
        }
        if (this.pendReload) {
            this.pendReload=false;
            if (this.ammo<=0) {
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
        const mp=this.muzzlePoint(this._mp||(this._mp={x:0,z:0}));
        this.lastAim=aim;
        if (this.dualT>0) {
            const W=TUNING.weapon;
            const c=Math.cos(this.aimYaw);
            const sn=Math.sin(this.aimYaw);
            this.fireFrom(ctx,this.pos.x-W.muzzleSide*c+W.muzzleForward*sn,this.pos.z+W.muzzleSide*sn+W.muzzleForward*c);
            this.dualKick=1;
        }
        this.fireFrom(ctx,mp.x,mp.z);
    }

    fireFrom(ctx,mx,mz) {
        const W=this.W;
        const base=this.fireAngle(mx,mz);
        let dx;
        let dz;
        if (W.swing) {
            if (ctx.onBrush) {
                ctx.onBrush(mx,mz,base,W.fan);
            }
        }
        else if (W.beam) {
            this.beamT=W.fireInterval*1.8;
            if (ctx.onBeam) {
                ctx.onBeam(mx,mz,Math.cos(base),Math.sin(base),W);
            }
        }
        else {
            const sys=ctx.weaponSys[W.sys]||ctx.playerBullets;
            const n=W.pellets||1;
            for (let p=0;p<n;p++) {
                const a=base+(n>1?(p/(n-1)-0.5)*W.fan:0)+(Math.random()*2-1)*W.spread;
                sys.spawn(mx,mz,Math.cos(a),Math.sin(a),W.bulletSpeed,W.damage,W.bulletLife);
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
            this.dodged=false;
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
        clampToBounds(this.pos,P.radius,room.walkBounds||room.bounds);
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
        if (this.pendReload) {
            this.pendT-=dt;
            if (this.pendT<=0) {
                this.pendReload=false;
                if (this.ammo<=0) {
                    this.startReload();
                }
            }
        }
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
        else if (input.consumeReload&&input.consumeReload()&&this.ammo<W.magazine&&!W.heat&&!W.cooldown) {
            this.startReload();
        }
        this.updateHeat(dt,input.isFiring()&&this.reloadT<=0&&this.ammo>0);
        this.rapidT=Math.max(0,this.rapidT-dt);
        const wasDual=this.dualT>0;
        this.dualT=Math.max(0,this.dualT-dt);
        this.dualDt=dt;
        if (this.dualT>0&&!this.gunL) {
            this.equipDual();
        }
        if (wasDual&&this.dualT<=0) {
            this.dropDual();
            if (this.events.onDualEnd) {
                this.events.onDualEnd(this);
            }
        }
        this.reflectT=Math.max(0,this.reflectT-dt);
        if (this.burstLeft>0&&this.hp>0&&this.reloadT<=0) {
            this.burstT-=dt;
            if (this.burstT<=0) {
                this.burstT+=W.burstGap;
                this.burstLeft--;
                this.shoot(ctx,aim);
            }
        }
        this.cdT=Math.max(0,(this.cdT||0)-dt);
        if (this.armed&&this.armK>TUNING.player.arm.ready&&input.isFiring()&&this.fireCd<=0&&this.hp>0&&this.reloadT<=0&&this.ammo>0&&this.burstLeft<=0&&this.cdT<=0) {
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
        this.poseArm(swing);
        this.dualKick=Math.max(0,(this.dualKick||0)-TUNING.dualPose.kickDecay*Math.min(0.1,this.dualDt||0));
        this.poseDual();
    }

    equipDual() {
        if (this.gunL) {
            return;
        }
        this.gunL=this.gun.clone();
        this.gunL.userData.at=time.real;
        this.body.add(this.gunL);
    }

    dropDual(now=false) {
        const g=this.gunL;
        if (!g) {
            return;
        }
        if (now) {
            this.body.remove(g);
            this.gunL=null;
            return;
        }
        if (g.userData.drop===undefined) {
            g.userData.drop=time.real;
        }
    }

    poseDual() {
        const g=this.gunL;
        if (!g) {
            return;
        }
        const D=TUNING.dualPose;
        const src=this.gun;
        g.visible=src.visible;
        g.position.set(-src.position.x,src.position.y,src.position.z+(this.dualKick||0)*D.kick);
        g.rotation.set(src.rotation.x,-src.rotation.y,-src.rotation.z);
        g.scale.copy(src.scale);
        this.arms[0].rotation.x=this.arms[1].rotation.x;
        this.arms[0].rotation.z=-this.arms[1].rotation.z;
        const e=Math.min(1,(time.real-g.userData.at)/D.equip);
        if (e<1) {
            const k=EASE.easeOutBack(e);
            g.scale.multiplyScalar(Math.max(0.01,k));
            g.rotation.z-=(1-e)*Math.PI*2;
            g.position.y+=Math.sin(e*Math.PI)*D.lift;
        }
        if (g.userData.drop!==undefined) {
            const q=Math.min(1,(time.real-g.userData.drop)/D.drop);
            g.position.x-=q*D.toss;
            g.position.y+=Math.sin(q*Math.PI)*D.lift-q*q*D.fall;
            g.rotation.z+=q*Math.PI*D.spin;
            g.scale.multiplyScalar(Math.max(0.01,1-q*q));
            const rest=-0.15;
            this.arms[0].rotation.x*=1-EASE.easeOutCubic(q);
            this.arms[0].rotation.z=this.arms[0].rotation.z+(rest-this.arms[0].rotation.z)*EASE.easeOutCubic(q);
            if (q>=1) {
                this.dropDual(true);
            }
        }
    }

    poseArm(swing) {
        const A=TUNING.player.arm;
        const want=this.armed?1:0;
        const dt=Math.min(0.1,time.real-(this.armTick??time.real));
        this.armTick=time.real;
        if (want>this.armK) {
            this.armK=Math.min(1,this.armK+dt/A.drawTime);
        }
        else if (want<this.armK) {
            this.armK=Math.max(0,this.armK-dt/A.stowTime);
        }
        const k=this.armK;
        if (k>=1) {
            this.gun.visible=true;
            return;
        }
        const e=this.armed?EASE.easeOutBack(k):k;
        this.gun.visible=k>0.02;
        this.gun.scale.multiplyScalar(Math.max(0.01,e));
        this.gun.rotation.y+=(1-k)*A.spin;
        this.gun.position.y+=Math.sin(k*Math.PI)*A.lift;
        this.gun.position.z-=(1-k)*A.back;
        const rest=swing*TUNING.player.armSwing/TUNING.player.legSwing;
        this.arms[1].rotation.x=rest+(this.arms[1].rotation.x-rest)*Math.min(1,k*1.4)-(this.armed?Math.sin(k*Math.PI)*A.raise:0);
        this.arms[1].rotation.z=0.12*k-0.15*(1-k);
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
