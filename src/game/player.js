import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {toonMaterial,unlitMaterial,registerShadow,hullMaterial,pal} from '../render/materials.js';
import {resolveCircle,clampToBounds} from '../core/collision.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {SKIN_TONES,ACCENTS} from '../data/palette.js';
import {WEAPONS,WEAPON_LIMITS} from '../data/weapons.js';
import {DEFAULT_SKIN} from '../data/skins.js';
import {ACC_DEFAULT} from '../data/cosmetics.js';
import {magBonus,reloadMult,takeGuard,maxHpBonus,hurtInvulnBonus,dashIframeBonus,speedMult,fireMult,flashRelic} from './relic.js';

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
        this.courseSpeed=1;
        this.courseDash=1;
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
        this.hp=this.maxHp;
        this.invuln=0;
        this.safeT=0;
        this.bulletProofT=0;
        this.shield=0;
        this.shieldT=0;
        this.fortT=0;
        this.fortAge=0;
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
            this.buildFort();
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
        const paper=tm({light:'paper',mid:'paper',dark:'farGray',jitter:J});
        if (g) {
            this.ghostMats.push(paper);
        }
        const A={headwear:{},eyewear:{},neckwear:{},backwear:{}};
        this.acc=A;
        const grp=(slot,id,parentObj)=>{
            const q=new THREE.Group();
            q.name='acc';
            A[slot][id]=q;
            parentObj.add(q);
            return q;
        };
        const put=(q,geo,mat,x,y,z,rx=0,ry=0,rz=0,thin=false)=>{
            const m=new THREE.Mesh(geo,mat);
            m.position.set(x,y,z);
            m.rotation.set(rx,ry,rz);
            if (thin) {
                addHull(m,hull,true);
            }
            q.add(m);
            return m;
        };
        const pouchG=grp('backwear','pouch',this.torso);
        put(pouchG,new THREE.BoxGeometry(0.26,0.3,0.14),gear,0,0.02,-0.3,0,0,0,true);
        put(pouchG,new THREE.BoxGeometry(0.28,0.08,0.16),hat,0,0.16,-0.3);
        const scarfG=grp('neckwear','scarf',this.body);
        put(scarfG,new THREE.TorusGeometry(0.2,0.075,6,14),hat,0,1.2,0,Math.PI/2,0,0,true);
        this.scarfTail=put(scarfG,new THREE.BoxGeometry(0.1,0.26,0.05),hat,0.1,1.06,-0.2,0.35,0,-0.25);
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
        const BY=TUNING.skinHatch.brimY;
        const dropG=grp('headwear','drop',this.head);
        const brim=put(dropG,new THREE.CylinderGeometry(0.21,0.25,0.06,12),hat,0,BY,-0.02,-0.3);
        addHull(brim,hull);
        const drop=put(dropG,new THREE.ConeGeometry(0.15,0.36,10),hat,0,BY+0.16,-0.08,-0.45);
        addHull(drop,hull);
        put(dropG,new THREE.SphereGeometry(0.045,6,4),ink,0,BY+0.31,-0.17);
        this.buildAcc(grp,put,{hat,gear,coat,face,dark,ink,paper});
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
        penG.add(mk(new THREE.CylinderGeometry(0.06,0.056,0.42,12),wD,0,0,-0.02));
        penG.add(mk(new THREE.CylinderGeometry(0.064,0.064,0.05,12),wL,0,0,0.18,Math.PI/2,false));
        penG.add(mk(new THREE.CylinderGeometry(0.05,0.06,0.07,12),wM,0,0,0.24,Math.PI/2,false));
        const nib=mk(new THREE.ConeGeometry(0.05,0.17,4),wL,0,0,0.355,Math.PI/2,false);
        nib.scale.set(1,1,0.35);
        penG.add(nib);
        penG.add(mk(new THREE.BoxGeometry(0.006,0.012,0.12),ink,0,0.012,0.36,0,false));
        penG.add(mk(new THREE.SphereGeometry(0.058,10,6),wD,0,0,-0.23,0,false));
        penG.add(mk(new THREE.CylinderGeometry(0.066,0.066,0.035,12),wL,0,0,-0.13,Math.PI/2,false));
        penG.add(mk(new THREE.BoxGeometry(0.018,0.024,0.24),wL,0,0.07,-0.07,0,false));
        this.gun.add(penG);
        const looks={pen:penG};
        const pencil=new THREE.Group();
        pencil.add(mk(new THREE.CylinderGeometry(0.034,0.034,0.4,6),wL,0,0,-0.1));
        for (let k=0;k<4;k++) {
            pencil.add(mk(new THREE.CylinderGeometry(0.04,0.04,0.022,8),wD,0,0,0.13+k*0.04,Math.PI/2,false));
        }
        pencil.add(mk(new THREE.CylinderGeometry(0.03,0.03,0.17,8),wM,0,0,0.19,Math.PI/2,false));
        pencil.add(mk(new THREE.ConeGeometry(0.03,0.09,8),wM,0,0,0.32,Math.PI/2,false));
        pencil.add(mk(new THREE.CylinderGeometry(0.008,0.008,0.1,5),wD,0,0,0.41,Math.PI/2,false));
        pencil.add(mk(new THREE.CylinderGeometry(0.005,0.005,0.04,4),ink,0,0,0.47,Math.PI/2,false));
        pencil.add(mk(new THREE.CylinderGeometry(0.038,0.038,0.03,8),wD,0,0,-0.31,Math.PI/2,false));
        pencil.add(mk(new THREE.CylinderGeometry(0.026,0.03,0.08,8),g?coat:unlitMaterial({color:'red'}),0,0,-0.36,Math.PI/2,false));
        pencil.add(mk(new THREE.BoxGeometry(0.012,0.02,0.2),wM,0,0.045,-0.18,0,false));
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
        const cray=new THREE.Group();
        cray.add(mk(new THREE.CylinderGeometry(0.062,0.062,0.4,8),wL,0,0,-0.04));
        cray.add(mk(new THREE.CylinderGeometry(0.066,0.066,0.22,8),g?coat:unlitMaterial({color:'red'}),0,0,-0.02,Math.PI/2,false));
        cray.add(mk(new THREE.ConeGeometry(0.062,0.14,8),g?coat:unlitMaterial({color:'red'}),0,0,0.23,Math.PI/2,false));
        cray.add(mk(new THREE.CylinderGeometry(0.03,0.03,0.05,6),g?coat:unlitMaterial({color:'crayonBlue'}),0.075,0,-0.18,Math.PI/2,false));
        cray.add(mk(new THREE.CylinderGeometry(0.03,0.03,0.05,6),g?coat:unlitMaterial({color:'crayonGreen'}),-0.075,0,-0.18,Math.PI/2,false));
        looks.crayon=cray;
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

    buildAcc(grp,put,m) {
        const H=this.head;
        const B=this.body;
        const ball=(r,w=8,h=6)=>new THREE.SphereGeometry(r,w,h);
        const box=(x,y,z)=>new THREE.BoxGeometry(x,y,z);
        const cyl=(a,b,h,n=8)=>new THREE.CylinderGeometry(a,b,h,n);
        const cone=(r,h,n=8)=>new THREE.ConeGeometry(r,h,n);
        const ring=(r,t,n=14,arc=Math.PI*2)=>new THREE.TorusGeometry(r,t,5,n,arc);
        let q=grp('headwear','beret',H);
        put(q,ball(0.28,12,8),m.hat,-0.03,0.25,-0.02,0,0,0.22,true).scale.set(1,0.34,1);
        put(q,cyl(0.022,0.03,0.07,6),m.hat,0.0,0.36,-0.02,0,0,0.22);
        q=grp('headwear','crown',H);
        put(q,cyl(0.21,0.23,0.11,12),m.gear,0,0.3,-0.02,-0.12,0,0,true);
        for (let i=0;i<5;i++) {
            const a=i/5*Math.PI*2;
            put(q,cone(0.045,0.11,4),m.gear,Math.sin(a)*0.2,0.4+Math.cos(a)*0.02,Math.cos(a)*0.2-0.02-Math.cos(a)*0.03,0,0,0);
        }
        put(q,ball(0.03,6,4),m.ink,0,0.3,0.21);
        q=grp('headwear','propeller',H);
        put(q,new THREE.SphereGeometry(0.31,12,6,0,Math.PI*2,0,Math.PI*0.42),m.hat,0,0.04,0,-0.12,0,0,true);
        put(q,cyl(0.015,0.015,0.14,5),m.ink,0,0.36,-0.04);
        const prop=new THREE.Group();
        prop.position.set(0,0.43,-0.04);
        put(prop,box(0.38,0.012,0.07),m.gear,0,0,0,0,0,0,true);
        put(prop,ball(0.025,6,4),m.ink,0,0.01,0);
        q.add(prop);
        this.propeller=prop;
        q=grp('headwear','headphones',H);
        put(q,ring(0.33,0.025,14,Math.PI),m.ink,0,0.02,-0.02);
        for (const sx of [-1,1]) {
            put(q,cyl(0.1,0.1,0.07,10),m.gear,sx*0.33,0.0,-0.02,0,0,Math.PI/2,true);
        }
        q=grp('headwear','catEars',H);
        for (const sx of [-1,1]) {
            put(q,cone(0.1,0.2,4),m.hat,sx*0.17,0.31,-0.02,0,Math.PI/4,-sx*0.38,true);
            put(q,cone(0.05,0.1,4),m.face,sx*0.165,0.3,0.03,0,Math.PI/4,-sx*0.38);
        }
        q=grp('headwear','paperBoat',H);
        put(q,cyl(0.24,0.24,0.12,3),m.paper,0,0.37,-0.02,-Math.PI/2,0,0,true).scale.set(1.25,1,1);
        put(q,box(0.44,0.03,0.14),m.ink,0,0.26,-0.02);
        q=grp('headwear','topHat',H);
        put(q,cyl(0.32,0.32,0.03,14),m.hat,0,0.27,-0.02,-0.1,0,0,true);
        put(q,cyl(0.2,0.21,0.34,12),m.hat,0,0.45,-0.04,-0.1,0,0,true);
        put(q,cyl(0.212,0.212,0.06,12),m.ink,0,0.32,-0.03,-0.1,0,0);
        q=grp('headwear','cap',H);
        put(q,new THREE.SphereGeometry(0.31,12,6,0,Math.PI*2,0,Math.PI*0.45),m.hat,0,0.05,-0.01,-0.1,0,0,true);
        put(q,box(0.32,0.025,0.24),m.gear,0,0.17,0.3,0.12,0,0,true);
        put(q,ball(0.03,6,4),m.gear,0,0.36,-0.04);
        q=grp('eyewear','shades',H);
        for (const sx of [-1,1]) {
            put(q,box(0.15,0.085,0.02),m.ink,sx*0.1,0.04,0.3,0,sx*0.12,0);
            put(q,box(0.012,0.012,0.2),m.ink,sx*0.2,0.06,0.2,0,sx*0.25,0);
        }
        put(q,box(0.06,0.014,0.014),m.ink,0,0.06,0.31);
        q=grp('eyewear','mask',H);
        put(q,new THREE.SphereGeometry(0.33,12,5,Math.PI/2-0.62,1.24,1.62,0.56),m.paper,0,0,0,0,0,0,true);
        const strap=new THREE.TorusGeometry(0.325,0.011,4,18,Math.PI*2-1.24);
        strap.rotateZ(Math.PI/2+0.62);
        strap.rotateX(Math.PI/2);
        put(q,strap,m.ink,0,-0.07,0,0.18,0,0);
        put(q,box(0.1,0.008,0.012),m.ink,0,-0.1,0.318);
        q=grp('eyewear','glasses',H);
        for (const sx of [-1,1]) {
            put(q,ring(0.072,0.013),m.ink,sx*0.1,0.03,0.3);
            put(q,box(0.012,0.012,0.2),m.ink,sx*0.2,0.05,0.2,0,sx*0.25,0);
        }
        put(q,box(0.06,0.012,0.012),m.ink,0,0.05,0.31);
        q=grp('eyewear','monocle',H);
        put(q,ring(0.085,0.015),m.ink,0.1,0.03,0.305);
        for (let i=0;i<4;i++) {
            put(q,ball(0.012,4,3),m.ink,0.17+i*0.02,-0.05-i*0.05,0.28-i*0.02);
        }
        q=grp('eyewear','eyepatch',H);
        put(q,cyl(0.085,0.085,0.02,10),m.ink,-0.1,0.04,0.3,Math.PI/2,0,0);
        put(q,ring(0.315,0.011,24),m.ink,0,0.07,0,Math.PI/2,0,0.32);
        q=grp('eyewear','mustache',H);
        for (const sx of [-1,1]) {
            put(q,ball(0.07,8,6),m.dark,sx*0.065,-0.09,0.28,0,0,sx*0.35).scale.set(1.3,0.45,0.55);
        }
        q=grp('eyewear','bandage',H);
        for (const sz of [-1,1]) {
            put(q,box(0.15,0.045,0.012),m.paper,-0.17,-0.06,0.265,0,-0.55,sz*0.6,true);
        }
        q=grp('neckwear','bowtie',B);
        for (const sx of [-1,1]) {
            put(q,cone(0.075,0.15,4),m.hat,sx*0.085,1.16,0.24,0,0,sx*Math.PI/2,true);
        }
        put(q,ball(0.04,6,4),m.hat,0,1.16,0.25);
        q=grp('neckwear','tie',B);
        put(q,box(0.08,0.07,0.05),m.hat,0,1.15,0.24,0,0,0,true);
        put(q,box(0.085,0.24,0.03),m.hat,0,1.0,0.26,-0.12,0,0,true);
        put(q,cone(0.06,0.08,4),m.hat,0,0.86,0.28,Math.PI-0.12,Math.PI/4,0);
        q=grp('neckwear','bell',B);
        put(q,ring(0.2,0.03),m.hat,0,1.19,0,Math.PI/2,0,0,true);
        put(q,ball(0.065,8,6),m.gear,0,1.11,0.22,0,0,0,true);
        put(q,box(0.08,0.012,0.02),m.ink,0,1.1,0.285);
        q=grp('neckwear','beads',B);
        const bead=ball(0.038,6,4);
        for (let i=0;i<12;i++) {
            const a=i/12*Math.PI*2;
            const c=Math.cos(a);
            put(q,bead,i%3===0?m.ink:m.hat,Math.sin(a)*0.23,1.17-Math.max(0,c)*0.06,c*0.21);
        }
        q=grp('neckwear','ruff',B);
        const frill=ball(0.075,8,5);
        for (let i=0;i<12;i++) {
            const a=i/12*Math.PI*2;
            put(q,frill,m.paper,Math.sin(a)*0.22,1.19,Math.cos(a)*0.2,0,a,0,true).scale.set(1.1,0.5,0.8);
        }
        q=grp('neckwear','medal',B);
        put(q,ring(0.2,0.02),m.hat,0,1.19,0,Math.PI/2,0,0);
        put(q,box(0.07,0.18,0.02),m.hat,0,1.09,0.24,-0.18,0,0,true);
        put(q,cyl(0.075,0.075,0.025,12),m.gear,0,0.97,0.27,Math.PI/2-0.18,0,0,true);
        put(q,ball(0.02,6,4),m.ink,0,0.97,0.29);
        q=grp('neckwear','bandana',B);
        put(q,ring(0.2,0.035),m.hat,0,1.18,0,Math.PI/2,0,0,true);
        put(q,cone(0.17,0.22,3),m.hat,0,1.06,0.22,Math.PI-0.2,0,0,true).scale.set(1,1,0.35);
        q=grp('backwear','balloon',B);
        const tieA=new THREE.Vector3(0.1,1.0,-0.235);
        const tieB=new THREE.Vector3(0.27,1.84,-0.32);
        const tieD=tieB.clone().sub(tieA);
        const tie=put(q,cyl(0.006,0.006,tieD.length(),4),m.ink,(tieA.x+tieB.x)/2,(tieA.y+tieB.y)/2,(tieA.z+tieB.z)/2);
        tie.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),tieD.normalize());
        put(q,ball(0.022,6,4),m.ink,tieA.x,tieA.y,tieA.z);
        put(q,box(0.09,0.05,0.012),m.paper,tieA.x,tieA.y-0.005,tieA.z-0.004,0,0,0.3,true);
        put(q,ball(0.21,10,8),m.hat,0.28,2.12,-0.32,0,0,0,true).scale.set(1,1.18,1);
        put(q,cone(0.04,0.06,6),m.hat,0.27,1.86,-0.32,Math.PI,0,0);
        q=grp('backwear','yardstick',B);
        put(q,box(0.11,0.9,0.03),m.gear,0,1.02,-0.3,0,0,0.55,true);
        for (let i=0;i<6;i++) {
            const k=-0.36+i*0.14;
            put(q,box(0.05,0.012,0.035),m.ink,-Math.sin(0.55)*k+0.03,1.02+Math.cos(0.55)*k,-0.31,0,0,0.55);
        }
        q=grp('backwear','cape',B);
        const cape=new THREE.Group();
        cape.position.set(0,1.18,-0.24);
        put(cape,box(0.5,0.66,0.03),m.hat,0,-0.33,0,0,0,0,true);
        put(cape,box(0.52,0.06,0.05),m.ink,0,-0.02,0.01);
        q.add(cape);
        this.cape=cape;
        q=grp('backwear','wings',B);
        this.wings=[];
        for (const sx of [-1,1]) {
            const w=new THREE.Group();
            w.position.set(sx*0.06,1.04,-0.27);
            put(w,cone(0.09,0.3,3),m.paper,sx*0.15,0.02,0,0,0,-sx*Math.PI/2-sx*0.35,true).scale.set(1,1,0.18);
            q.add(w);
            this.wings.push(w);
        }
        q=grp('backwear','backpack',B);
        put(q,box(0.38,0.4,0.18),m.gear,0,0.92,-0.34,0,0,0,true);
        put(q,box(0.4,0.12,0.2),m.hat,0,1.08,-0.34);
        put(q,box(0.2,0.12,0.04),m.hat,0,0.86,-0.44);
        q=grp('backwear','quiver',B);
        put(q,cyl(0.085,0.075,0.46,8),m.gear,0.06,0.98,-0.33,0,0,0.4,true);
        for (let i=0;i<3;i++) {
            const px=-0.04-i*0.03;
            const py=1.25+i*0.01;
            put(q,cyl(0.022,0.022,0.14,6),i===1?m.hat:m.paper,px+0.02*i,py,-0.33+(i-1)*0.04,0,0,0.4);
            put(q,cone(0.022,0.05,6),m.ink,px+0.02*i-0.035,py+0.09,-0.33+(i-1)*0.04,0,0,0.4);
        }
        q=grp('backwear','scroll',B);
        put(q,cyl(0.075,0.075,0.5,8),m.paper,0,1.04,-0.33,0,0,Math.PI/2+0.25,true);
        for (const sx of [-1,1]) {
            put(q,cyl(0.09,0.09,0.04,8),m.gear,sx*0.25,1.04+sx*0.063,-0.33,0,0,Math.PI/2+0.25);
        }
        put(q,box(0.04,0.18,0.18),m.hat,0.0,1.04,-0.33,0,0,0.25);
        this.applyAcc(ACC_DEFAULT);
    }

    applyAcc(skin) {
        for (const slot in this.acc) {
            const want=skin[slot]??ACC_DEFAULT[slot];
            for (const id in this.acc[slot]) {
                this.acc[slot][id].visible=id===want;
            }
        }
    }

    animAcc(s) {
        const T=time.real;
        if (this.propeller&&this.propeller.parent.visible) {
            this.propeller.rotation.y=T*(8+s*14);
        }
        if (this.cape&&this.cape.parent.visible) {
            this.cape.rotation.x=0.12+s*0.45+Math.sin(T*3)*0.04;
        }
        if (this.wings&&this.wings[0].parent.visible) {
            const f=Math.sin(T*(3+s*6))*0.25;
            this.wings[0].rotation.y=f;
            this.wings[1].rotation.y=-f;
        }
    }

    applySkin(skin) {
        this.applyAcc(skin);
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

    buildFort() {
        const E=TUNING.effects;
        const R=E.fortRadius;
        const n=E.fortPanels;
        const wd=Math.PI*2*R/n*1.08;
        const geo=new THREE.PlaneGeometry(wd,1.5,4,1);
        const pa=geo.attributes.position;
        for (let i=0;i<pa.count;i++) {
            const x=pa.getX(i);
            const y=pa.getY(i);
            const a=x/R;
            pa.setXYZ(i,Math.sin(a)*R,y+0.85,Math.cos(a)*R);
        }
        geo.computeVertexNormals();
        const m=toonMaterial({light:'paper',mid:'farGray',dark:'midGray',jitter:TUNING.boil.vertexJitter,side:THREE.DoubleSide});
        this.fortGroup=new THREE.Group();
        for (let i=0;i<n;i++) {
            const holder=new THREE.Group();
            holder.rotation.y=i*Math.PI*2/n;
            const mesh=new THREE.Mesh(geo,m);
            mesh.rotation.z=((i%3)-1)*0.06;
            mesh.position.y=(i%2)*0.08;
            holder.add(mesh);
            this.fortGroup.add(holder);
        }
        this.fortGroup.visible=false;
        this.root.add(this.fortGroup);
    }

    setFort(dur) {
        this.fortT=dur;
        this.fortAge=0;
        if (this.fortGroup) {
            this.fortGroup.visible=dur>0;
        }
    }

    setShield(n,dur=0) {
        this.shield=n;
        if (dur>0) {
            this.shieldT=dur;
        }
        if (n<=0) {
            this.shieldT=0;
        }
        if (!this.panels) {
            return;
        }
        for (let i=0;i<this.panels.length;i++) {
            this.panels[i].visible=i<n;
            this.panels[i].rotation.y=i*Math.PI*2/Math.max(1,n);
        }
    }

    leap(x,z,dur,h) {
        this.leapX0=this.pos.x;
        this.leapZ0=this.pos.z;
        this.leapX1=x;
        this.leapZ1=z;
        this.leapDur=dur;
        this.leapT=dur;
        this.leapH=h;
        this.leapF=0;
        this.leapPF=0;
        this.dashT=0;
        this.vel.set(0,0,0);
        this.invuln=Math.max(this.invuln,dur+TUNING.effects.leap.grace);
        this.moveYaw=Math.atan2(x-this.pos.x,z-this.pos.z);
        this.stv+=TUNING.player.dashStretch;
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
        this.leapT=0;
        this.leapF=0;
        this.leapPF=0;
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
        this.setFort(0);
    }

    spawn(p) {
        this.pos.copy(p);
        this.prev.copy(p);
        this.renderPos.copy(p);
        this.vel.set(0,0,0);
        this.root.position.copy(p);
        this.hp=this.maxHp;
        this.invuln=0;
        this.setShield(0);
        this.setFort(0);
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
        this.leapT=0;
        this.leapF=0;
        this.leapPF=0;
        this.dashIT=0;
        this.reloadT=0;
        this.beamT=0;
        this.moveYaw=0;
        this.poseMoveYaw=0;
        this.invuln=0;
        this.safeT=0;
        this.moveFrame.visible=true;
        this.poseStep=-1;
        this.applyPose();
    }

    setWeapon(id) {
        const def=WEAPONS[id]||WEAPONS.pen;
        this.weaponId=WEAPONS[id]?id:'pen';
        this.W={...TUNING.weapon,...def};
        if (!this.ghost&&!def.cooldown) {
            this.W.magazine+=magBonus(this.weaponId);
            this.W.reloadTime*=reloadMult();
        }
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
        return this.invuln>0||this.safeT>0||this.fortT>0||(TUNING.player.dashInvuln&&(this.dashT>0||this.dashIT>0));
    }

    get maxHp() {
        return TUNING.player.maxHp+(this.ghost?0:maxHpBonus()+(this.hpMod||0));
    }

    hurt(dmg,dx,dz) {
        const P=TUNING.player;
        if (!this.ghost&&this.hp>0&&(this.fortT>0||!this.isInvulnerable())&&this.events.onAttacked) {
            this.events.onAttacked(this);
        }
        if (this.fortT>0) {
            if (this.events.onFortHit) {
                this.events.onFortHit(this,dx,dz);
            }
            return false;
        }
        if (this.isInvulnerable()||this.hp<=0) {
            return false;
        }
        if (!this.ghost&&takeGuard()) {
            this.invuln=TUNING.relics.whiteout.invuln;
            this.sqv+=1.5;
            if (this.events.onGuard) {
                this.events.onGuard(this,dx,dz);
            }
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
        this.invuln=P.invulnTime+(this.ghost?0:hurtInvulnBonus());
        if (!this.ghost) {
            flashRelic('styptic',this.invuln);
        }
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

    noteDodge() {
        if ((this.dashT>0||this.dashIT>0)&&!this.dodged) {
            this.dodged=true;
            if (this.events.onDodge) {
                this.events.onDodge(this);
            }
        }
    }

    hitBullet(x,z,r,dmg,vx,vz) {
        const rr=(this.fortT>0?TUNING.effects.fortRadius:TUNING.player.radius*0.8)+r;
        const ex=x-this.pos.x;
        const ez=z-this.pos.z;
        if (ex*ex+ez*ez>=rr*rr) {
            return false;
        }
        if (this.fortT>0) {
            if (this.events.onFortHit) {
                this.events.onFortHit(this,-ex/(Math.hypot(ex,ez)||1),-ez/(Math.hypot(ex,ez)||1));
            }
            return true;
        }
        if (this.bulletProofT>0) {
            if (this.events.onBulletProof) {
                this.events.onBulletProof(this,x,z);
            }
            return true;
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

    muzzleLeft(out) {
        const W=TUNING.weapon;
        const c=Math.cos(this.aimYaw);
        const sn=Math.sin(this.aimYaw);
        out.x=this.pos.x-W.muzzleSide*c+W.muzzleForward*sn;
        out.z=this.pos.z+W.muzzleSide*sn+W.muzzleForward*c;
        return out;
    }

    beamAngle(mx,mz) {
        return this.dualT>0?this.fireAngle(this.pos.x,this.pos.z):this.fireAngle(mx,mz);
    }

    faceDir(dx,dz) {
        this.aimDirX=dx;
        this.aimDirZ=dz;
        this.aimYaw=Math.atan2(dx,dz);
    }

    shoot(ctx,aim) {
        this.fire(ctx,aim);
        if (this.W.cooldown) {
            this.cdT=this.W.cooldown/((this.rapidT>0?this.rapidMult:1)*fireMult(this.hp));
            return;
        }
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
        this.shots=(this.shots||0)+1;
        const mp=this.muzzlePoint(this._mp||(this._mp={x:0,z:0}));
        this.lastAim=aim;
        const ang=this.W.beam?this.beamAngle(mp.x,mp.z):null;
        if (this.dualT>0) {
            const lp=this.muzzleLeft(this._lp||(this._lp={x:0,z:0}));
            this.fireFrom(ctx,lp.x,lp.z,ang);
            this.dualKick=1;
        }
        this.fireFrom(ctx,mp.x,mp.z,ang);
    }

    fireFrom(ctx,mx,mz,ang=null) {
        const W=this.W;
        const base=ang??this.fireAngle(mx,mz);
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
            let pick=null;
            if (W.colors) {
                let roll=Math.random()*W.colors.reduce((a,c)=>a+c.chance,0);
                pick=W.colors[W.colors.length-1];
                for (const c of W.colors) {
                    roll-=c.chance;
                    if (roll<0) {
                        pick=c;
                        break;
                    }
                }
            }
            const sys=ctx.weaponSys[pick?pick.sys:W.sys]||ctx.playerBullets;
            const dmg=pick?pick.damage:W.damage;
            const n=W.pellets||1;
            for (let p=0;p<n;p++) {
                const a=base+(n>1?(p/(n-1)-0.5)*W.fan:0)+(Math.random()*2-1)*W.spread;
                const bi=sys.spawn(mx,mz,Math.cos(a),Math.sin(a),W.bulletSpeed,dmg,W.bulletLife);
                if (bi>=0) {
                    sys.tag[bi]|=TUNING.relics.weaponTag;
                }
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
        this.bulletProofT=Math.max(0,(this.bulletProofT||0)-dt);
        this.safeT=Math.max(0,(this.safeT||0)-dt);
        if (this.fortT>0) {
            this.fortT-=dt;
            this.fortAge+=dt;
            if (this.fortT<=0) {
                this.setFort(0);
                if (this.events.onFortEnd) {
                    this.events.onFortEnd(this);
                }
            }
        }
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
        this.dashCd=Math.max(0,this.dashCd-dt*(this.hasteT>0?this.hasteMult:1)*this.courseDash);
        this.hasteT=Math.max(0,this.hasteT-dt);
        if (this.shieldT>0) {
            this.shieldT-=dt;
            if (this.shieldT<=0) {
                this.setShield(0);
            }
        }
        if (input.consumeDash()&&this.dashCd<=0&&!(this.leapT>0)) {
            let dx=this.aimDirX;
            let dz=this.aimDirZ;
            if (moveLen>0.1) {
                dx=_mv.x/moveLen;
                dz=_mv.z/moveLen;
            }
            this.vel.set(dx*P.dashSpeed,0,dz*P.dashSpeed);
            this.dashT=P.dashTime;
            this.dashIT=P.dashIframe+(this.ghost?0:dashIframeBonus());
            if (!this.ghost) {
                flashRelic('sneakers',P.dashIframe+dashIframeBonus());
            }
            this.dodged=false;
            this.dashCd=P.dashCooldown;
            this.moveYaw=Math.atan2(dx,dz);
            this.stv+=P.dashStretch;
            if (this.events.onDash) {
                this.events.onDash(this);
            }
        }
        if (this.leapT>0) {
            this.leapT-=dt;
            const f=1-Math.max(0,this.leapT)/this.leapDur;
            const e=(1-Math.cos(f*Math.PI))/2;
            this.vel.set(0,0,0);
            this.pos.x=this.leapX0+(this.leapX1-this.leapX0)*e;
            this.pos.z=this.leapZ0+(this.leapZ1-this.leapZ0)*e;
            this.leapPF=this.leapF??0;
            this.leapF=f;
            if (this.leapT<=0) {
                this.leapF=0;
                this.leapPF=0;
                this.sqv-=TUNING.effects.leap.land;
                if (this.events.onLand) {
                    this.events.onLand(this);
                }
            }
        }
        else if (this.dashT>0) {
            this.dashT-=dt;
        }
        else {
            const slow=room.zones.playerSlowAt(this.pos.x,this.pos.z);
            const hm=this.hasteT>0?this.hasteMult:1;
            const rm=this.ghost?1:speedMult(this.hp);
            const tx=_mv.x*P.speed*slow*hm*this.courseSpeed*rm;
            const tz=_mv.z*P.speed*slow*hm*this.courseSpeed*rm;
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
            this.fireCd+=Math.max(Math.min(W.fireInterval,WEAPON_LIMITS.minInterval),W.fireInterval/((this.rapidT>0?this.rapidMult:1)*fireMult(this.hp)));
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
        this.animAcc(s);
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
        if (this.leapT>0||this.leapF>0) {
            const f=(this.leapPF??0)+((this.leapF??0)-(this.leapPF??0))*alpha;
            this.root.position.y+=Math.sin(f*Math.PI)*this.leapH;
        }
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
        if (this.fortGroup&&this.fortT>0) {
            const E=TUNING.effects;
            const pop=Math.min(1,this.fortAge/E.fortPop);
            const s=0.4+0.6*EASE.easeOutBack(pop);
            this.fortGroup.scale.set(s,s,s);
            this.fortGroup.rotation.y=time.game*E.fortSpin;
            this.fortGroup.visible=this.fortT>E.fortBlink||Math.floor(time.real*10)%2===0;
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

    start(x,z,duration,damage,decoy=false) {
        this.decoy=decoy;
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
            m.uniforms.uAlpha.value=decoy?TUNING.effects.puppet.alpha:0.75;
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
        const e=this.decoy?null:ctx.enemyMgr.nearest(f.pos.x,f.pos.z,E.cloneRange);
        if (this.decoy) {
            f.aimYaw+=dt*E.puppet.spin;
        }
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
            m.uniforms.uAlpha.value=(this.decoy?E.puppet.alpha:0.75)*Math.max(0,fade);
        }
        if (this.t>=this.life) {
            this.active=false;
            f.root.visible=false;
        }
    }

    sync(alpha) {
        if (this.active) {
            this.fig.sync(alpha);
            const P=TUNING.effects.puppet;
            if (this.decoy&&this.t<P.drop) {
                const k=this.t/P.drop;
                this.fig.root.position.y+=P.dropH*(1-k*k);
            }
        }
    }
}
