import*as THREE from 'three';
import {toonMaterial} from '../render/materials.js';
import {makeCircle} from '../core/collision.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';

const TONES={
    cover:{light:'farGray',mid:'midGray',dark:'nearGray'},
    light:{light:'paper',mid:'farGray',dark:'midGray'},
    dark:{light:'midGray',mid:'nearGray',dark:'ink'},
    ink:{light:'nearGray',mid:'ink',dark:'ink'},
    accent:{light:'red',mid:'red',dark:'darkRed'},
    marker:{light:'marker',mid:'marker',dark:'midGray'}
};

const geoCache=new Map();

function geo(key,make) {
    if (!geoCache.has(key)) {
        geoCache.set(key,make());
    }
    return geoCache.get(key);
}

function mesh(g,tone,x=0,y=0,z=0) {
    const m=new THREE.Mesh(g,toonMaterial(TONES[tone]));
    m.position.set(x,y,z);
    return m;
}

function bx(w,h,d,tone,x,y,z) {
    return mesh(geo('b|'+w+'|'+h+'|'+d,()=>new THREE.BoxGeometry(w,h,d)),tone,x,y,z);
}

function cyl(rt,rb,h,tone,x,y,z,seg=12) {
    return mesh(geo('c|'+rt+'|'+rb+'|'+h+'|'+seg,()=>new THREE.CylinderGeometry(rt,rb,h,seg)),tone,x,y,z);
}

function ball(r,tone,x,y,z) {
    return mesh(geo('s|'+r,()=>new THREE.SphereGeometry(r,12,10)),tone,x,y,z);
}

function eyes(g,y,z,spread,size,tone='ink') {
    g.add(ball(size,tone,-spread,y,z),ball(size,tone,spread,y,z));
}

const MODELS={
    shop(body,root) {
        root.add(bx(2.6,0.9,1.0,'cover',0,0.45,0.75));
        root.add(bx(2.7,0.08,1.1,'dark',0,0.94,0.75));
        for (const sx of [-1.25,1.25]) {
            root.add(cyl(0.06,0.06,2.4,'dark',sx,1.2,0.2,6));
        }
        root.add(bx(3.0,0.12,1.5,'light',0,2.42,0.4));
        for (const sx of [-1,0,1]) {
            root.add(bx(0.45,0.14,1.52,'accent',sx,2.44,0.4));
        }
        body.add(cyl(0.42,0.5,1.2,'light',0,0.6,-0.2));
        body.add(ball(0.4,'light',0,1.5,-0.2));
        body.add(bx(0.5,0.25,0.5,'dark',0,1.9,-0.2));
        eyes(body,1.55,0.15,0.13,0.07);
        return {r:1.5,h:2.7};
    },
    rest(body) {
        body.add(cyl(0.5,0.55,1.4,'light',0,0.7,0));
        body.add(cyl(0.28,0.4,0.25,'light',0,1.52,0));
        body.add(cyl(0.22,0.22,0.5,'ink',0,1.85,0));
        body.add(bx(0.5,0.14,0.05,'accent',0,0.75,0.54));
        body.add(bx(0.14,0.5,0.05,'accent',0,0.75,0.54));
        eyes(body,1.15,0.48,0.16,0.07);
        return {r:0.8,h:2.2};
    },
    bottle(body,root) {
        body.add(cyl(0.7,0.75,0.9,'ink',0,0.45,0));
        body.add(cyl(0.35,0.45,0.35,'ink',0,1.07,0));
        body.add(cyl(0.4,0.4,0.12,'dark',0,1.3,0));
        eyes(body,0.6,0.7,0.22,0.09,'light');
        const puddle=cyl(1.3,1.3,0.03,'ink',0.6,0.02,0.7,16);
        puddle.scale.set(1,1,0.6);
        root.add(puddle);
        return {r:0.9,h:1.6};
    },
    eraser(body) {
        body.add(bx(0.9,1.3,0.7,'light',0,0.65,0));
        body.add(bx(0.94,0.5,0.74,'accent',0,1.1,0));
        eyes(body,0.75,0.37,0.18,0.08);
        body.add(bx(0.3,0.06,0.04,'ink',0,0.5,0.37));
        return {r:0.8,h:1.6};
    },
    board(body) {
        for (const sx of [-0.55,0.55]) {
            const leg=bx(0.1,2.0,0.1,'dark',sx,1.0,-0.1);
            leg.rotation.z=sx*0.12;
            body.add(leg);
        }
        body.add(bx(1.7,1.25,0.08,'light',0,1.45,0.05));
        body.add(bx(1.0,0.06,0.04,'ink',-0.1,1.7,0.1));
        body.add(bx(0.06,0.6,0.04,'accent',0.45,1.35,0.1));
        body.add(bx(0.5,0.06,0.04,'ink',-0.2,1.15,0.1));
        eyes(body,1.45,0.1,0.25,0.08);
        return {r:0.9,h:2.3};
    },
    notebook(body) {
        body.add(bx(1.0,1.4,0.22,'dark',0,0.75,0));
        body.add(bx(0.9,1.3,0.18,'light',0.04,0.75,0.04));
        body.add(bx(0.12,1.42,0.24,'accent',-0.46,0.75,0));
        eyes(body,0.95,0.15,0.18,0.07);
        return {r:0.7,h:1.8};
    },
    gacha(body) {
        body.add(bx(1.0,1.0,0.9,'accent',0,0.5,0));
        body.add(ball(0.6,'light',0,1.45,0));
        body.add(ball(0.16,'marker',-0.2,1.3,0.3));
        body.add(ball(0.15,'accent',0.22,1.42,0.28));
        body.add(ball(0.14,'dark',0,1.62,0.32));
        body.add(cyl(0.12,0.12,0.12,'ink',0,0.45,0.48));
        eyes(body,0.78,0.46,0.22,0.07,'light');
        return {r:0.8,h:2.2};
    },
    sharpener(body) {
        body.add(bx(1.0,0.8,0.8,'cover',0,0.4,0));
        const hole=cyl(0.22,0.22,0.1,'ink',0,0.45,0.41);
        hole.rotation.x=Math.PI/2;
        body.add(hole);
        body.add(bx(0.06,0.5,0.84,'dark',0.4,0.4,0));
        eyes(body,0.68,0.41,0.22,0.07);
        return {r:0.8,h:1.3};
    },
    mug(body) {
        body.add(cyl(0.55,0.5,0.95,'light',0,0.48,0));
        body.add(cyl(0.48,0.48,0.04,'ink',0,0.94,0));
        const handle=mesh(geo('torus',()=>new THREE.TorusGeometry(0.28,0.07,6,12)),'dark',0.62,0.5,0);
        body.add(handle);
        eyes(body,0.6,0.52,0.17,0.07);
        return {r:0.8,h:1.4};
    },
    ghost(body) {
        body.add(ball(0.62,'light',0,1.35,0));
        const tail=cyl(0.62,0.05,1.0,'light',0,0.65,0,12);
        body.add(tail);
        eyes(body,1.45,0.55,0.2,0.09);
        body.add(ball(0.12,'ink',0,1.15,0.56));
        return {r:0.8,h:2.2,float:true};
    },
    conductor(body) {
        body.add(cyl(0.05,0.05,1.3,'dark',0,0.65,0,6));
        body.add(cyl(0.35,0.4,0.06,'dark',0,0.03,0,10));
        const stand=bx(1.0,0.7,0.06,'light',0,1.45,0.05);
        stand.rotation.x=-0.35;
        body.add(stand);
        body.add(bx(0.6,0.04,0.02,'ink',0,1.55,0.11));
        body.add(bx(0.5,0.04,0.02,'ink',0,1.42,0.15));
        body.add(ball(0.07,'ink',0.2,1.36,0.17));
        eyes(body,1.75,0.02,0.18,0.07);
        return {r:0.7,h:2.1};
    },
    flag(body) {
        body.add(cyl(0.06,0.06,2.0,'dark',0,1.0,0,6));
        body.add(cyl(0.35,0.4,0.12,'dark',0,0.06,0,10));
        body.add(bx(0.8,0.5,0.05,'accent',0.42,1.7,0));
        body.add(ball(0.32,'light',0,0.9,0.05));
        eyes(body,0.95,0.32,0.11,0.06);
        return {r:0.6,h:2.2};
    },
    dice(body) {
        body.add(bx(1.0,1.0,1.0,'light',0,0.55,0));
        for (const [x,y] of [[-0.25,0.8],[0.25,0.3],[0,0.55]]) {
            body.add(ball(0.08,'ink',x,y,0.5));
        }
        body.add(ball(0.08,'accent',0,1.06,0));
        eyes(body,0.8,0.52,0.2,0.05,'accent');
        return {r:0.75,h:1.4};
    },
    plane(body) {
        const wing=cyl(0.01,0.7,1.6,'light',0,1.1,0,3);
        wing.rotation.x=Math.PI/2;
        wing.scale.set(1,1,0.3);
        body.add(wing);
        body.add(cyl(0.05,0.05,0.9,'dark',0,0.45,0,6));
        eyes(body,1.15,0.35,0.15,0.06);
        return {r:0.7,h:1.6,float:true};
    },
    metronome(body) {
        body.add(cyl(0.2,0.6,1.5,'cover',0,0.75,0,4));
        const arm=bx(0.06,1.2,0.06,'ink',0,1.1,0.3);
        arm.rotation.z=0.3;
        body.add(arm);
        body.add(bx(0.18,0.14,0.1,'accent',0.16,1.45,0.3));
        eyes(body,0.6,0.42,0.16,0.06);
        return {r:0.7,h:1.8};
    },
    marble(body) {
        body.add(ball(0.55,'accent',0,0.6,0));
        body.add(bx(1.12,0.1,0.1,'light',0,0.6,0));
        eyes(body,0.8,0.48,0.17,0.07,'light');
        return {r:0.6,h:1.3};
    },
    ruler(body) {
        const r=bx(0.5,2.0,0.12,'light',0,1.0,0);
        body.add(r);
        for (let i=0;i<7;i++) {
            body.add(bx(i%2?0.12:0.22,0.03,0.04,'ink',-0.16,0.25+i*0.25,0.07));
        }
        eyes(body,1.55,0.08,0.12,0.06);
        return {r:0.6,h:2.2};
    },
    range(body) {
        body.add(bx(0.12,1.6,0.12,'dark',0,0.8,0));
        body.add(cyl(0.55,0.55,0.08,'light',0,1.5,0.1,16).rotateX(Math.PI/2));
        body.add(cyl(0.38,0.38,0.09,'accent',0,1.5,0.12,16).rotateX(Math.PI/2));
        body.add(cyl(0.2,0.2,0.1,'light',0,1.5,0.14,16).rotateX(Math.PI/2));
        body.add(cyl(0.08,0.08,0.11,'ink',0,1.5,0.16,10).rotateX(Math.PI/2));
        eyes(body,1.05,0.08,0.14,0.06);
        return {r:0.6,h:2.1};
    },
    chest(body) {
        body.add(bx(1.2,0.65,0.85,'cover',0,0.33,0));
        body.add(bx(1.24,0.1,0.89,'dark',0,0.62,0));
        const lid=new THREE.Group();
        lid.position.set(0,0.66,-0.43);
        const top=bx(1.2,0.28,0.86,'dark',0,0.14,0.43);
        lid.add(top);
        lid.add(bx(0.18,0.2,0.06,'marker',0,0.0,0.88));
        body.add(lid);
        return {r:0.8,h:1.2,lid};
    }
};

export class Npcs {
    constructor() {
        this.list=[];
        this.focus=-1;
    }

    clear() {
        this.list=[];
        this.focus=-1;
    }

    build(room,specs) {
        this.clear();
        for (const s of specs) {
            const root=new THREE.Group();
            root.position.set(s.x,0,s.z);
            const body=new THREE.Group();
            root.add(body);
            const info=MODELS[s.model](body,root);
            room.group.add(root);
            room.addPiece('npc',root,[makeCircle(s.x,s.z,info.r)],{x:s.x,z:s.z,radius:info.r,erasable:false});
            this.list.push({model:s.model,root,body,x:s.x,z:s.z,r:info.r,h:info.h,lid:info.lid||null,float:!!info.float,still:!!info.still,used:false,sealed:false,t:Math.random()*6,yaw:0,pop:0,open:0});
        }
    }

    markUsed(i,sealed=false) {
        const n=this.list[i];
        if (!n) {
            return;
        }
        n.used=true;
        n.sealed=sealed;
        n.pop=1;
    }

    update(dt,player,can) {
        const N=TUNING.npc;
        let best=-1;
        let bd=1e9;
        for (let i=0;i<this.list.length;i++) {
            const n=this.list[i];
            n.t+=dt;
            const dx=player.pos.x-n.x;
            const dz=player.pos.z-n.z;
            const d=Math.hypot(dx,dz);
            const still=n.still||n.model==='shop'||n.model==='chest';
            const want=still?0:Math.atan2(dx,dz);
            let dy=want-n.yaw;
            dy=Math.atan2(Math.sin(dy),Math.cos(dy));
            n.yaw+=dy*Math.min(1,dt*N.turn);
            n.body.rotation.y=n.yaw;
            n.pop=Math.max(0,n.pop-dt*N.popDecay);
            const bob=n.float?N.floatAmp*(1+Math.sin(n.t*N.floatRate))+N.floatBase:Math.abs(Math.sin(n.t*N.bobRate))*N.bobAmp;
            n.body.position.y=n.sealed||still?0:bob;
            const sq=1+(still?0:Math.sin(n.t*N.bobRate*2)*N.squash)+Math.sin(n.pop*Math.PI)*N.popScale;
            n.body.scale.set(1/Math.sqrt(sq),n.sealed?N.sealedScale:sq,1/Math.sqrt(sq));
            if (n.lid) {
                n.open+=((n.used&&!n.sealed?1:0)-n.open)*Math.min(1,dt*N.lidRate);
                n.lid.rotation.x=-N.lidOpen*EASE.easeOutBack(Math.min(1,n.open));
            }
            if (!n.used&&can(i)&&d<n.r+N.range&&d<bd) {
                bd=d;
                best=i;
            }
        }
        this.focus=best;
    }
}
