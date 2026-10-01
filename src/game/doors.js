import*as THREE from 'three';
import {toonMaterial} from '../render/materials.js';
import {TUNING} from '../data/tuning.js';
import {PALETTE,hexToRgb} from '../data/palette.js';
import {EASE} from '../core/easing.js';

const TONES={
    cover:{light:'farGray',mid:'midGray',dark:'nearGray'},
    dark:{light:'midGray',mid:'nearGray',dark:'ink'},
    accent:{light:'red',mid:'red',dark:'darkRed'}
};

const geoCache=new Map();

function box(w,h,d) {
    const k=w+'|'+h+'|'+d;
    if (!geoCache.has(k)) {
        geoCache.set(k,new THREE.BoxGeometry(w,h,d));
    }
    return geoCache.get(k);
}

let glowTex=null;
let floorTex=null;

function gradientTexture(radial) {
    const c=document.createElement('canvas');
    c.width=64;
    c.height=radial?64:128;
    const g=c.getContext('2d');
    const [r,gg,b]=hexToRgb(PALETTE.marker).map(v=>Math.round(v*255));
    const col=a=>'rgba('+r+','+gg+','+b+','+a+')';
    const grad=radial?g.createRadialGradient(32,32,0,32,32,32):g.createLinearGradient(0,128,0,0);
    grad.addColorStop(0,col(0.95));
    grad.addColorStop(0.45,col(0.45));
    grad.addColorStop(1,col(0));
    g.fillStyle=grad;
    g.fillRect(0,0,c.width,c.height);
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.SRGBColorSpace;
    return tex;
}

function glowMaterial(tex) {
    return new THREE.MeshBasicMaterial({map:tex,transparent:true,depthTest:false,depthWrite:false,opacity:0,side:THREE.DoubleSide});
}

export class Doors {
    constructor(fxScene,particles) {
        this.fx=fxScene;
        this.particles=particles;
        this.list=[];
        this.entry=null;
        this.onSlam=null;
        this.onOpen=null;
    }

    clear() {
        for (const d of this.list.concat(this.entry?[this.entry]:[])) {
            this.fx.remove(d.glow,d.floor);
            d.glow.material.dispose();
            d.floor.material.dispose();
        }
        this.list=[];
        this.entry=null;
    }

    build(room,exits,entry) {
        this.clear();
        if (!glowTex) {
            glowTex=gradientTexture(false);
            floorTex=gradientTexture(true);
        }
        const D=TUNING.doors;
        const b=room.bounds;
        const n=exits.length;
        for (let i=0;i<n;i++) {
            const x=n===1?0:(i-(n-1)/2)*b.maxX*(n===2?D.pairSpread:D.spread);
            const d=this.makeDoor(room,x,b.minZ,1);
            d.exit=exits[i];
            d.index=i;
            this.list.push(d);
        }
        if (entry) {
            const d=this.makeDoor(room,0,b.maxZ,-1);
            d.open=1;
            d.target=1;
            d.closeT=D.closeDelay;
            this.entry=d;
            this.pose(d);
        }
    }

    makeDoor(room,x,z,side) {
        const D=TUNING.doors;
        const g=new THREE.Group();
        g.position.set(x,0,z);
        const cover=toonMaterial(TONES.cover);
        const dark=toonMaterial(TONES.dark);
        const lh=side>0?D.height:D.entryHeight;
        const ph=lh+0.25;
        for (const sx of [-1,1]) {
            const post=new THREE.Mesh(box(D.post,ph,D.depth),cover);
            post.position.set(sx*(D.width/2+D.post/2),ph/2,0);
            g.add(post);
        }
        if (side>0) {
            const lintel=new THREE.Mesh(box(D.width+D.post*2+0.3,D.post,D.depth+0.1),cover);
            lintel.position.set(0,ph+D.post/2,0);
            g.add(lintel);
        }
        const sill=new THREE.Mesh(box(D.width,0.08,D.depth),dark);
        sill.position.set(0,0.04,0);
        g.add(sill);
        const hinge=new THREE.Group();
        hinge.position.set(-D.width/2,0,0);
        const leaf=new THREE.Mesh(box(D.width,lh,D.leaf),dark);
        leaf.position.set(D.width/2,lh/2,0);
        hinge.add(leaf);
        const knob=new THREE.Mesh(box(0.14,0.14,D.leaf+0.12),toonMaterial(side>0?TONES.accent:TONES.cover));
        knob.position.set(D.width*0.85,lh*0.48,0);
        hinge.add(knob);
        g.add(hinge);
        room.group.add(g);
        const glow=new THREE.Mesh(new THREE.PlaneGeometry(D.width*1.05,D.height),glowMaterial(glowTex));
        glow.position.set(x,D.height/2,z);
        const floor=new THREE.Mesh(new THREE.PlaneGeometry(D.width*2.2,D.floorLen),glowMaterial(floorTex));
        floor.rotation.x=-Math.PI/2;
        floor.position.set(x,0.03,z+side*D.floorLen*0.3);
        this.fx.add(glow,floor);
        return {group:g,hinge,side,x,z,open:0,target:0,glow,floor,t:Math.random()*5,emit:0,delay:0,closeT:-1};
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
        }
    }

    pose(d) {
        const D=TUNING.doors;
        const e=EASE.easeOutBack(Math.max(0,Math.min(1,d.open)));
        d.hinge.rotation.y=d.side*D.swing*e;
    }

    update(dt,player,canExit) {
        const D=TUNING.doors;
        let hit=-1;
        const all=this.entry?this.list.concat([this.entry]):this.list;
        for (const d of all) {
            d.t+=dt;
            if (d.closeT>0) {
                d.closeT-=dt;
                if (d.closeT<=0) {
                    d.target=0;
                    d.slam=true;
                }
            }
            if (d.delay>0) {
                d.delay-=dt;
                continue;
            }
            const before=d.open;
            const sp=dt/(d.target>d.open?D.openTime:D.closeTime);
            d.open=d.target>d.open?Math.min(d.target,d.open+sp):Math.max(d.target,d.open-sp);
            this.pose(d);
            if (d.burst&&d.open>0) {
                d.burst=false;
                this.particles.burst(d.x,1.2,d.z+d.side*0.4,D.burstCount,{color:'marker',speed:[1,4],up:[2,5],size:[0.08,0.2],life:[0.5,1]});
                if (this.onOpen) {
                    this.onOpen(d);
                }
            }
            if (d.slam&&before>0&&d.open<=0) {
                d.slam=false;
                this.particles.burst(d.x,0.3,d.z-d.side*0.5,D.dustCount,{color:'midGray',speed:[1,3],up:[1,3],size:[0.1,0.22],life:[0.4,0.8]});
                if (this.onSlam) {
                    this.onSlam(d);
                }
            }
            const lit=d===this.entry?0:d.open;
            const pulse=1-D.pulse+D.pulse*Math.sin(d.t*D.pulseRate);
            d.glow.material.opacity=lit*D.glow*pulse;
            d.floor.material.opacity=lit*D.floor*pulse;
            if (lit>0.6) {
                d.emit-=dt;
                if (d.emit<=0) {
                    d.emit=D.emitEvery;
                    this.particles.burst(d.x+(Math.random()-0.5)*D.width,0.2,d.z+d.side*(0.3+Math.random()*0.8),1,{color:'marker',speed:[0.1,0.5],up:[1.2,2.6],size:[0.06,0.14],life:[0.7,1.2]});
                }
            }
            if (canExit&&d!==this.entry&&d.open>0.8&&Math.abs(player.pos.x-d.x)<D.width/2+D.reachX&&player.pos.z<d.z+D.reach) {
                hit=d.index;
            }
        }
        return hit;
    }
}
