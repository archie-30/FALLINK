import*as THREE from 'three';
import {toonMaterial,iconMaterial} from '../render/materials.js';
import {makeCircle} from '../core/collision.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';
import {drawRelicIcon} from '../ui2d/relicIcons.js';

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
    cloud(body) {
        body.add(cyl(0.05,0.05,1.2,'dark',0,0.6,0,6));
        body.add(cyl(0.35,0.4,0.12,'dark',0,0.06,0,10));
        for (const [x,y,r] of [[0,1.7,0.5],[-0.45,1.55,0.36],[0.45,1.55,0.38],[0.2,1.95,0.32],[-0.22,1.9,0.3]]) {
            body.add(ball(r,'light',x,y,0));
        }
        eyes(body,1.72,0.45,0.13,0.07);
        for (const x of [-0.3,0.05,0.35]) {
            body.add(ball(0.08,'ink',x,1.05+Math.abs(x)*0.4,0.05));
        }
        return {r:0.7,h:2.3};
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
    coach(body) {
        body.add(cyl(0.38,0.45,1.1,'cover',0,0.55,0));
        body.add(ball(0.36,'light',0,1.38,0));
        body.add(cyl(0.38,0.38,0.12,'accent',0,1.66,0,12));
        body.add(bx(0.45,0.05,0.3,'accent',0,1.64,0.28));
        body.add(cyl(0.02,0.02,0.4,'ink',0.18,1.05,0.4,4));
        body.add(bx(0.12,0.08,0.14,'dark',0.18,0.85,0.44));
        eyes(body,1.42,0.33,0.13,0.06);
        return {r:0.7,h:2.0};
    },
    teacher(body) {
        body.add(cyl(0.34,0.5,1.15,'dark',0,0.58,0));
        body.add(bx(0.2,0.3,0.04,'light',0,1.0,0.36));
        body.add(ball(0.35,'light',0,1.42,0));
        body.add(ball(0.2,'ink',0,1.66,-0.22));
        body.add(cyl(0.36,0.36,0.12,'ink',0,1.62,0,12));
        for (const s of [-1,1]) {
            const lens=cyl(0.1,0.1,0.03,'ink',s*0.13,1.45,0.32,12);
            lens.rotation.x=Math.PI/2;
            body.add(lens);
        }
        body.add(bx(0.08,0.02,0.02,'ink',0,1.46,0.34));
        const stick=cyl(0.02,0.025,0.95,'accent',0.42,1.0,0.25,6);
        stick.rotation.x=0.9;
        stick.rotation.z=-0.3;
        body.add(stick);
        eyes(body,1.4,0.33,0.13,0.05);
        return {r:0.7,h:2.0};
    },
    item(body,root,s) {
        root.add(cyl(0.55,0.62,0.7,'cover',0,0.35,0,10));
        root.add(cyl(0.62,0.62,0.06,'dark',0,0.72,0,10));
        const k=s.item;
        const y=0.75;
        if (k==='buy'||k==='rare') {
            for (let i=0;i<3;i++) {
                const c=bx(0.42,0.04,0.58,i===2&&k==='rare'?'accent':'light',0.04*i,y+0.03+i*0.05,-0.02*i);
                c.rotation.y=0.25*i-0.25;
                body.add(c);
            }
            if (k==='rare') {
                body.add(ball(0.1,'accent',0,y+0.3,0));
            }
        }
        else if (k==='upgrade'||k==='upgrade2') {
            body.add(bx(0.42,0.04,0.58,'light',0,y+0.03,0));
            const n=k==='upgrade'?1:2;
            for (let i=0;i<n;i++) {
                const st=cyl(0.16,0.16,0.06,'accent',(i-(n-1)/2)*0.32,y+0.4,0,5);
                st.rotation.x=Math.PI/2;
                body.add(st);
            }
        }
        else if (k==='patch'||k==='bigPatch') {
            const sc=k==='patch'?1:1.4;
            body.add(bx(0.5*sc,0.12*sc,0.32*sc,'light',0,y+0.08*sc,0));
            body.add(bx(0.12*sc,0.13*sc,0.24*sc,'accent',0,y+0.09*sc,0));
            body.add(bx(0.3*sc,0.13*sc,0.08*sc,'accent',0,y+0.09*sc,0));
        }
        else if (k==='remove') {
            body.add(cyl(0.2,0.2,0.16,'light',0,y+0.25,0,14).rotateX(Math.PI/2));
            body.add(bx(0.36,0.2,0.18,'cover',0.12,y+0.12,0));
            body.add(bx(0.4,0.03,0.12,'light',0.32,y+0.03,0));
        }
        else if (k==='ink') {
            body.add(cyl(0.2,0.24,0.34,'ink',0,y+0.17,0));
            body.add(cyl(0.1,0.12,0.12,'ink',0,y+0.4,0));
        }
        else {
            for (const sx of [-1,1]) {
                const p=cyl(0.04,0.04,0.7,sx<0?'dark':'accent',0,y+0.3,0,6);
                p.rotation.z=sx*0.7;
                body.add(p);
            }
        }
        return {r:0.65,h:1.3,still:true};
    },
    cardKeeper(body) {
        body.add(cyl(0.48,0.56,1.3,'light',0,0.65,0));
        body.add(bx(1.05,0.1,0.6,'dark',0,1.32,0));
        for (let i=0;i<4;i++) {
            const c=bx(0.42,0.6,0.04,i===3?'cover':'light',-0.3+i*0.2,1.62,0.2-i*0.05);
            c.rotation.z=-0.35+i*0.23;
            body.add(c);
        }
        body.add(ball(0.36,'light',0,2.1,0));
        body.add(cyl(0.38,0.38,0.06,'dark',0,2.3,0,14));
        body.add(cyl(0.22,0.26,0.32,'dark',0,2.48,0,12));
        eyes(body,2.12,0.32,0.13,0.06);
        body.add(bx(0.08,0.4,0.05,'accent',0,0.85,0.55));
        return {r:0.85,h:2.8};
    },
    ultKeeper(body) {
        body.add(cyl(0.42,0.62,1.4,'dark',0,0.7,0));
        body.add(ball(0.38,'light',0,1.75,0));
        const hood=cyl(0.05,0.46,0.7,'dark',0,2.05,-0.04,12);
        body.add(hood);
        eyes(body,1.78,0.33,0.13,0.07,'accent');
        const star=new THREE.Group();
        star.position.set(0.55,1.4,0.35);
        for (let i=0;i<3;i++) {
            const b=bx(0.42,0.1,0.06,'accent',0,0,0);
            b.rotation.z=i*Math.PI/3;
            star.add(b);
        }
        body.add(star);
        body.add(cyl(0.04,0.04,1.8,'dark',-0.62,0.9,0.15,6));
        body.add(ball(0.13,'accent',-0.62,1.86,0.15));
        return {r:0.85,h:2.6};
    },
    librarian(body,root) {
        body.add(cyl(0.38,0.7,1.6,'dark',0,0.8,0));
        body.add(cyl(0.45,0.45,0.1,'cover',0,1.62,0,12));
        body.add(ball(0.36,'light',0,1.95,0));
        body.add(cyl(0.02,0.56,0.95,'ink',0,2.55,0,10));
        body.add(cyl(0.6,0.6,0.05,'ink',0,2.12,0,16));
        for (const sx of [-1,1]) {
            const lens=cyl(0.1,0.1,0.03,'light',sx*0.13,1.98,0.33,10);
            lens.rotation.x=Math.PI/2;
            body.add(lens);
        }
        body.add(bx(0.1,0.03,0.03,'ink',0,1.98,0.34));
        body.add(ball(0.04,'ink',-0.13,1.98,0.35),ball(0.04,'ink',0.13,1.98,0.35));
        body.add(bx(0.18,0.5,0.1,'light',0,1.62,0.4));
        const book=bx(0.6,0.08,0.44,'cover',0,1.2,0.62);
        book.rotation.x=0.35;
        body.add(book);
        body.add(bx(0.26,0.02,0.36,'light',-0.14,1.25,0.62));
        body.add(bx(0.26,0.02,0.36,'light',0.14,1.25,0.62));
        root.add(cyl(0.08,0.18,1.0,'dark',-1.0,0.5,0.7,8));
        root.add(bx(0.8,0.06,0.6,'dark',-1.0,1.03,0.7));
        const open=bx(0.66,0.06,0.46,'light',-1.0,1.09,0.7);
        open.rotation.x=-0.25;
        root.add(open);
        return {r:1.0,h:3.0};
    },
    relic(body,root,s) {
        root.add(cyl(0.38,0.48,0.75,'cover',0,0.375,0,8));
        root.add(cyl(0.5,0.5,0.08,'dark',0,0.78,0,8));
        root.add(cyl(0.48,0.5,0.06,'dark',0,0.03,0,8));
        const c=document.createElement('canvas');
        c.width=128;
        c.height=128;
        drawRelicIcon(c.getContext('2d'),s.relic,64,64,1.3,0);
        const tex=new THREE.CanvasTexture(c);
        tex.colorSpace=THREE.NoColorSpace;
        const icon=new THREE.Mesh(geo('relicIcon',()=>new THREE.PlaneGeometry(1.1,1.1)),iconMaterial(tex));
        icon.position.y=1.55;
        icon.rotation.x=-TUNING.npc.iconTilt;
        const spin=new THREE.Group();
        spin.add(icon);
        body.add(spin);
        return {r:0.65,h:1.9,float:true,still:true,icon:spin};
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
        this.armed=-1;
    }

    clear() {
        this.list=[];
        this.focus=-1;
        this.armed=-1;
    }

    build(room,specs) {
        this.clear();
        for (const s of specs) {
            const root=new THREE.Group();
            root.position.set(s.x,0,s.z);
            const body=new THREE.Group();
            root.add(body);
            const info=MODELS[s.model](body,root,s);
            room.group.add(root);
            room.addPiece('npc',root,[makeCircle(s.x,s.z,info.r)],{x:s.x,z:s.z,radius:info.r,erasable:false});
            this.list.push({model:s.model,item:s.item||null,label:s.label||null,price:s.price||0,relic:s.relic||null,root,body,x:s.x,z:s.z,r:info.r,h:info.h,lid:info.lid||null,icon:info.icon||null,float:!!info.float,still:!!info.still,used:false,sealed:false,t:Math.random()*6,yaw:0,pop:0,open:0});
        }
    }

    say(i,text,dur) {
        const n=this.list[i];
        if (n) {
            n.say={text,t:0,dur};
            n.pop=1;
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
            if (n.say) {
                n.say.t+=dt;
                if (n.say.t>=n.say.dur) {
                    n.say=null;
                }
            }
            const bob=n.float?N.floatAmp*(1+Math.sin(n.t*N.floatRate))+N.floatBase:Math.abs(Math.sin(n.t*N.bobRate))*N.bobAmp;
            n.body.position.y=n.sealed||still?0:bob;
            const sq=1+(still?0:Math.sin(n.t*N.bobRate*2)*N.squash)+Math.sin(n.pop*Math.PI)*N.popScale;
            n.body.scale.set(1/Math.sqrt(sq),n.sealed?N.sealedScale:sq,1/Math.sqrt(sq));
            if ((n.model==='item'||n.model==='relic')&&n.used) {
                n.gone=Math.min(1,(n.gone||0)+dt*N.goneRate);
                const g=Math.max(0.001,1-EASE.easeInCubic(n.gone));
                n.body.scale.set(g,g,g);
                n.body.position.y=n.gone*N.goneLift;
                n.body.visible=n.gone<1;
            }
            if (n.icon) {
                n.icon.rotation.y=Math.sin(n.t*N.iconSway)*0.35;
            }
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
