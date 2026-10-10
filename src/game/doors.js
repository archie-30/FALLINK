import*as THREE from 'three';
import {toonMaterial,portalMaterial} from '../render/materials.js';
import {makeBox} from '../core/collision.js';
import {TUNING} from '../data/tuning.js';
import {PALETTE,hexToRgb,rgba} from '../data/palette.js';
import {EASE} from '../core/easing.js';

const TONES={
    cover:{light:'farGray',mid:'midGray',dark:'nearGray'},
    light:{light:'paper',mid:'farGray',dark:'midGray'},
    dark:{light:'midGray',mid:'nearGray',dark:'ink'},
    accent:{light:'red',mid:'red',dark:'darkRed'}
};

const geoCache=new Map();

function geo(key,make) {
    if (!geoCache.has(key)) {
        geoCache.set(key,make());
    }
    return geoCache.get(key);
}

function box(w,h,d) {
    return geo('b|'+w+'|'+h+'|'+d,()=>new THREE.BoxGeometry(w,h,d));
}

function plane(w,h) {
    return geo('p|'+w+'|'+h,()=>new THREE.PlaneGeometry(w,h));
}

let tex=null;

function makeTextures() {
    const [r,g,b]=hexToRgb(PALETTE.marker).map(v=>Math.round(v*255));
    const col=a=>'rgba('+r+','+g+','+b+','+a+')';
    const glow=document.createElement('canvas');
    glow.width=64;
    glow.height=128;
    const gc=glow.getContext('2d');
    const lg=gc.createLinearGradient(0,128,0,0);
    lg.addColorStop(0,col(0.95));
    lg.addColorStop(0.5,col(0.5));
    lg.addColorStop(1,col(0));
    gc.fillStyle=lg;
    gc.fillRect(0,0,64,128);
    const pool=document.createElement('canvas');
    pool.width=64;
    pool.height=64;
    const pc=pool.getContext('2d');
    const rg=pc.createRadialGradient(32,32,0,32,32,32);
    rg.addColorStop(0,col(0.9));
    rg.addColorStop(0.5,col(0.4));
    rg.addColorStop(1,col(0));
    pc.fillStyle=rg;
    pc.fillRect(0,0,64,64);
    const swirl=document.createElement('canvas');
    swirl.width=128;
    swirl.height=128;
    const sc=swirl.getContext('2d');
    sc.translate(64,64);
    sc.lineCap='round';
    for (let k=0;k<3;k++) {
        sc.strokeStyle=k===1?col(0.9):rgba('ink',0.55);
        sc.lineWidth=k===1?5:3;
        sc.beginPath();
        for (let i=0;i<=80;i++) {
            const a=i*0.16+k*2.1;
            const rr=4+i*0.72;
            const x=Math.cos(a)*rr;
            const y=Math.sin(a)*rr;
            if (i===0) {
                sc.moveTo(x,y);
            }
            else {
                sc.lineTo(x,y);
            }
        }
        sc.stroke();
    }
    const mk=c=>{
        const t=new THREE.CanvasTexture(c);
        t.colorSpace=THREE.SRGBColorSpace;
        return t;
    };
    const tunnel=document.createElement('canvas');
    tunnel.width=128;
    tunnel.height=128;
    const tc=tunnel.getContext('2d');
    tc.translate(64,64);
    const core=tc.createRadialGradient(0,0,0,0,0,40);
    core.addColorStop(0,col(0.95));
    core.addColorStop(0.45,col(0.35));
    core.addColorStop(1,col(0));
    tc.fillStyle=core;
    tc.fillRect(-64,-64,128,128);
    tc.lineCap='round';
    for (let k=0;k<4;k++) {
        const rr=22+k*11;
        tc.strokeStyle=k%2?col(0.8):rgba('ink',0.5-k*0.08);
        tc.lineWidth=k%2?3:2;
        tc.beginPath();
        for (let i=0;i<=48;i++) {
            const a=i/48*Math.PI*2;
            const j=Math.sin(a*5+k*1.7)*1.6+Math.sin(a*11+k)*0.8;
            const x=Math.cos(a)*(rr+j);
            const y=Math.sin(a)*(rr+j);
            if (i===0) {
                tc.moveTo(x,y);
            }
            else {
                tc.lineTo(x,y);
            }
        }
        tc.stroke();
    }
    const rune=document.createElement('canvas');
    rune.width=128;
    rune.height=128;
    const rc=rune.getContext('2d');
    rc.translate(64,64);
    rc.strokeStyle=col(0.95);
    rc.lineWidth=2.5;
    rc.beginPath();
    rc.arc(0,0,58,0,Math.PI*2);
    rc.stroke();
    rc.lineWidth=1.5;
    rc.beginPath();
    rc.arc(0,0,48,0,Math.PI*2);
    rc.stroke();
    rc.lineWidth=2.2;
    for (let i=0;i<16;i++) {
        const a=i/16*Math.PI*2;
        rc.save();
        rc.rotate(a);
        rc.beginPath();
        if (i%4===0) {
            rc.moveTo(-3,-56);
            rc.lineTo(0,-50);
            rc.lineTo(3,-56);
        }
        else if (i%2===0) {
            rc.arc(0,-53,2.2,0,Math.PI*2);
        }
        else {
            rc.moveTo(0,-56);
            rc.lineTo(0,-50);
        }
        rc.stroke();
        rc.restore();
    }
    const rays=document.createElement('canvas');
    rays.width=128;
    rays.height=128;
    const yc=rays.getContext('2d');
    for (let i=0;i<9;i++) {
        const x=8+i*14+Math.sin(i*2.3)*4;
        const w=3+(i*7%5);
        const lgr=yc.createLinearGradient(0,128,0,0);
        lgr.addColorStop(0,col(0.7));
        lgr.addColorStop(1,col(0));
        yc.fillStyle=lgr;
        yc.fillRect(x,0,w,128);
    }
    tex={glow:mk(glow),pool:mk(pool),swirl:mk(swirl),tunnel:mk(tunnel),rune:mk(rune),rays:mk(rays)};
}

function fxMaterial(map) {
    return portalMaterial(map);
}

export function doorXs(n,hw) {
    const D=TUNING.doors;
    if (n<=1) {
        return n===1?[0]:[];
    }
    if (n===2) {
        return [-hw*D.pairSpread,hw*D.pairSpread];
    }
    return [-hw*D.spread,0,hw*D.spread];
}

export class Doors {
    constructor(fxScene,particles) {
        this.fx=fxScene;
        this.particles=particles;
        this.list=[];
        this.focus=-1;
        this.onOpen=null;
        this.onClose=null;
        this.room=null;
    }

    prewarm() {
        if (!tex) {
            makeTextures();
        }
        for (const k of ['glow','swirl','pool','tunnel','rune','rays']) {
            const m=new THREE.Mesh(plane(1,1),fxMaterial(tex[k]));
            m.visible=false;
            this.fx.add(m);
        }
    }

    clear() {
        for (const d of this.list) {
            for (const m of d.fxMeshes) {
                this.fx.remove(m);
                m.material.dispose();
            }
        }
        this.list=[];
        this.focus=-1;
        this.room=null;
    }

    build(room,exits) {
        this.clear();
        if (exits.length===0) {
            return;
        }
        if (!tex) {
            makeTextures();
        }
        const D=TUNING.doors;
        const b=room.bounds;
        const t=room.def.wallThickness;
        this.room=room;
        room.walkBounds={...b,minZ:b.minZ-t-D.alcove};
        const xs=doorXs(exits.length,b.maxX);
        for (let i=0;i<xs.length;i++) {
            const d=this.makeDoor(room,xs[i],b.minZ,t);
            d.exit=exits[i];
            d.index=i;
            this.list.push(d);
        }
    }

    makeDoor(room,x,z,t) {
        const D=TUNING.doors;
        const W=D.width;
        const H=D.height;
        const A=D.alcove;
        const g=new THREE.Group();
        g.position.set(x,0,z);
        const cover=toonMaterial(TONES.cover);
        const dark=toonMaterial(TONES.dark);
        const light=toonMaterial(TONES.light);
        const accent=toonMaterial(TONES.accent);
        const ph=H+0.2;
        for (const sx of [-1,1]) {
            const post=new THREE.Mesh(box(D.post,ph,t+0.2),cover);
            post.position.set(sx*(W/2+D.post/2),ph/2,-t/2);
            g.add(post);
            const side=new THREE.Mesh(box(D.side,D.sideH,A),cover);
            side.position.set(sx*(W/2+D.side/2),D.sideH/2,-t-A/2);
            g.add(side);
        }
        const lintel=new THREE.Mesh(box(W+D.post*2+0.3,D.post,t+0.3),cover);
        lintel.position.set(0,ph+D.post/2,-t/2);
        g.add(lintel);
        const tab=new THREE.Mesh(box(W*0.55,0.5,0.08),light);
        tab.position.set(0,ph+D.post+0.2,-t/2+0.2);
        g.add(tab);
        const sill=new THREE.Mesh(box(W,0.06,t),dark);
        sill.position.set(0,0.03,-t/2);
        g.add(sill);
        const back=new THREE.Mesh(box(W+D.side*2,H*D.backH,0.12),light);
        back.position.set(0,H*D.backH/2,-t-A);
        g.add(back);
        const backRim=new THREE.Mesh(box(W+D.side*2+0.1,0.12,0.16),dark);
        backRim.position.set(0,H*D.backH,-t-A);
        g.add(backRim);
        const leaves=[];
        for (const sx of [-1,1]) {
            const hinge=new THREE.Group();
            hinge.position.set(sx*W/2,0,-t/2);
            const leaf=new THREE.Mesh(box(W/2-0.04,H,D.leaf),dark);
            leaf.position.set(-sx*(W/4),H/2,0);
            hinge.add(leaf);
            const knob=new THREE.Mesh(box(0.12,0.12,D.leaf+0.1),accent);
            knob.position.set(-sx*(W/2-0.2),H*0.48,0);
            hinge.add(knob);
            const panel=new THREE.Mesh(box(W/2-0.4,H*0.35,D.leaf+0.04),cover);
            panel.position.set(-sx*(W/4),H*0.7,0);
            hinge.add(panel);
            g.add(hinge);
            leaves.push({hinge,sx});
        }
        room.group.add(g);
        const wx=x;
        const cols=[];
        for (const sx of [-1,1]) {
            cols.push(makeBox(wx+sx*(W/2+D.side/2),z-t-A/2,D.side/2,A/2+t/2,0));
        }
        cols.push(makeBox(wx,z-t-A-0.06,W/2+D.side,0.12,0));
        const leafCol=makeBox(wx,z-t/2,W/2,t/2,0);
        const piece=room.addPiece('door',g,cols.concat([leafCol]),{x:wx,z:z-t,radius:W,erasable:false});
        const portal=new THREE.Mesh(plane(W*0.95,H*0.85),fxMaterial(tex.glow));
        portal.position.set(wx,H*0.43,z-t-A+0.1);
        const swirl=new THREE.Mesh(plane(H*0.8,H*0.8),fxMaterial(tex.swirl));
        swirl.position.set(wx,H*0.5,z-t-A+0.12);
        const pool=new THREE.Mesh(plane(W*1.6,A+2.4),fxMaterial(tex.pool));
        pool.rotation.x=-Math.PI/2;
        pool.position.set(wx,0.03,z-t-A/2+0.4);
        const zb=z-t-A;
        const tunnel=[];
        for (let i=0;i<TUNING.doors.tunnelLayers;i++) {
            const m=new THREE.Mesh(plane(H*0.9,H*0.9),fxMaterial(tex.tunnel));
            m.position.set(wx,H*0.48,zb+0.105+i*0.004);
            tunnel.push(m);
        }
        const rays=new THREE.Mesh(plane(W*0.9,H*0.9),fxMaterial(tex.rays));
        rays.position.set(wx,H*0.45,zb+0.115);
        const rune=new THREE.Mesh(plane(H*0.9,H*0.9),fxMaterial(tex.rune));
        rune.position.set(wx,H*0.5,zb+0.13);
        this.fx.add(portal,...tunnel,rays,swirl,rune,pool);
        return {group:g,leaves,piece,cols,leafCol,x:wx,z,t,open:0,target:0,portal,swirl,pool,tunnel,rays,rune,fxMeshes:[portal,swirl,pool,rays,rune,...tunnel],time:Math.random()*5,emit:0,delay:0};
    }

    setSolid(d,closed) {
        d.piece.colliders=closed?d.cols.concat([d.leafCol]):d.cols.slice();
        for (const c of d.piece.colliders) {
            c.piece=d.piece;
        }
        this.room.rebuildColliders();
    }

    openAll() {
        const D=TUNING.doors;
        this.list.forEach((d,i)=>{
            d.target=1;
            d.delay=i*D.stagger;
            d.burst=true;
        });
    }

    closeAll() {
        for (const d of this.list) {
            d.target=0;
            d.delay=0;
            this.setSolid(d,true);
        }
    }

    inside(d,player) {
        const D=TUNING.doors;
        return Math.abs(player.pos.x-d.x)<D.width/2&&player.pos.z<d.z-d.t*D.insideK;
    }

    update(dt,player) {
        const D=TUNING.doors;
        this.focus=-1;
        for (const d of this.list) {
            d.time+=dt;
            if (d.delay>0) {
                d.delay-=dt;
                continue;
            }
            const before=d.open;
            const sp=dt/(d.target>d.open?D.openTime:D.closeTime);
            d.open=d.target>d.open?Math.min(d.target,d.open+sp):Math.max(d.target,d.open-sp);
            const e=EASE.easeOutBack(Math.max(0,Math.min(1,d.open)));
            for (const l of d.leaves) {
                l.hinge.rotation.y=l.sx*-D.swing*e;
            }
            if (d.burst&&d.open>0) {
                d.burst=false;
                this.setSolid(d,false);
                this.particles.burst(d.x,1.2,d.z-d.t,D.burstCount,{color:'marker',speed:[1,4],up:[2,5],size:[0.08,0.2],life:[0.5,1]});
                if (this.onOpen) {
                    this.onOpen(d);
                }
            }
            if (before>0&&d.open<=0&&this.onClose) {
                this.onClose(d);
            }
            const pulse=1-D.pulse+D.pulse*Math.sin(d.time*D.pulseRate);
            const lit=d.open;
            d.portal.material.opacity=lit*D.glow*pulse;
            d.pool.material.opacity=lit*D.floor*pulse;
            d.swirl.material.opacity=lit*D.swirlAlpha;
            d.swirl.rotation.z=-d.time*D.swirlRate;
            d.tunnel.forEach((m,i)=>{
                const p=(d.time*D.tunnelRate+i/d.tunnel.length)%1;
                const sc=D.tunnelScale[0]+(D.tunnelScale[1]-D.tunnelScale[0])*p;
                m.scale.set(sc,sc,1);
                m.rotation.z=(i%2?1:-1)*d.time*D.tunnelSpin+i;
                m.material.opacity=lit*D.tunnelAlpha*Math.sin(p*Math.PI);
            });
            d.rays.material.opacity=lit*D.raysAlpha*(0.7+0.3*Math.sin(d.time*D.raysRate)*Math.sin(d.time*D.raysRate*0.37+1));
            d.rune.rotation.z=d.time*D.runeSpin;
            d.rune.material.opacity=lit*D.runeAlpha*pulse;
            if (lit>0.6) {
                d.emit-=dt;
                if (d.emit<=0) {
                    d.emit=D.emitEvery;
                    this.particles.burst(d.x+(Math.random()-0.5)*D.width,0.2,d.z-d.t-Math.random()*D.alcove,1,{color:'marker',speed:[0.1,0.5],up:[1.2,2.6],size:[0.06,0.14],life:[0.7,1.2]});
                }
                if (this.inside(d,player)) {
                    this.focus=d.index;
                }
            }
        }
        return this.focus;
    }
}
