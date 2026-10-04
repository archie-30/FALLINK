import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {decalMaterial,pal} from './materials.js';
import {RNG} from '../core/rng.js';
import {EASE} from '../core/easing.js';

const rng=new RNG(555);

function drawSplat(ctx,ox,size,r) {
    const cx=ox+size/2;
    const cy=size/2;
    ctx.fillStyle='#fff';
    const main=size*r.range(0.16,0.2);
    for (let i=0;i<9;i++) {
        const a=r.range(0,Math.PI*2);
        const d=r.range(0,main*0.6);
        ctx.beginPath();
        ctx.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d,main*r.range(0.45,0.85),0,Math.PI*2);
        ctx.fill();
    }
    const streaks=r.int(6,10);
    for (let i=0;i<streaks;i++) {
        const a=r.range(0,Math.PI*2);
        const len=size*r.range(0.18,0.42);
        const w=size*r.range(0.015,0.035);
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.moveTo(main*0.5,-w);
        ctx.quadraticCurveTo(len*0.7,-w*0.4,len,0);
        ctx.quadraticCurveTo(len*0.7,w*0.4,main*0.5,w);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(len,0,w*r.range(0.9,1.6),0,Math.PI*2);
        ctx.fill();
        ctx.restore();
    }
    const drops=r.int(10,18);
    for (let i=0;i<drops;i++) {
        const a=r.range(0,Math.PI*2);
        const d=size*r.range(0.22,0.46);
        ctx.beginPath();
        ctx.arc(cx+Math.cos(a)*d,cy+Math.sin(a)*d,size*r.range(0.006,0.02),0,Math.PI*2);
        ctx.fill();
    }
}

export function createSplatAtlas(size=256) {
    const c=document.createElement('canvas');
    c.width=size*3;
    c.height=size;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#000';
    ctx.fillRect(0,0,size*3,size);
    const r=new RNG(31337);
    for (let i=0;i<3;i++) {
        drawSplat(ctx,size*i,size,r);
    }
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.NoColorSpace;
    tex.generateMipmaps=false;
    tex.minFilter=THREE.LinearFilter;
    return tex;
}

export class Decals {
    constructor(parent,capacity=TUNING.decals.capacity) {
        this.atlas=createSplatAtlas();
        const geo=new THREE.PlaneGeometry(1,1);
        geo.rotateX(-Math.PI/2);
        this.items=[];
        for (let i=0;i<capacity;i++) {
            const m=new THREE.Mesh(geo,decalMaterial(this.atlas));
            m.visible=false;
            m.position.y=0.02+i*0.0015;
            parent.add(m);
            this.items.push({mesh:m,age:0,size:1,active:false});
        }
        this.next=0;
        this.limit=capacity;
    }

    setLimit(n) {
        this.limit=Math.max(1,Math.min(this.items.length,n));
        this.next=this.next%this.limit;
        for (let i=this.limit;i<this.items.length;i++) {
            this.items[i].active=false;
            this.items[i].mesh.visible=false;
        }
    }

    clear() {
        for (const it of this.items) {
            it.active=false;
            it.mesh.visible=false;
        }
    }

    spawn(x,z,size,color='red',old='darkRed') {
        const it=this.items[this.next];
        this.next=(this.next+1)%this.limit;
        it.active=true;
        it.age=0;
        it.size=size;
        it.mesh.visible=true;
        it.mesh.position.x=x;
        it.mesh.position.z=z;
        it.mesh.rotation.y=rng.range(0,Math.PI*2);
        it.mesh.scale.setScalar(0.01);
        const u=it.mesh.material.uniforms;
        u.uVariant.value=rng.int(0,2);
        u.uSeed.value=rng.next();
        u.uAge.value=0;
        u.uColor.value.copy(pal(color));
        u.uColorOld.value.copy(pal(old));
    }

    update(dt) {
        const D=TUNING.decals;
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            it.age+=dt;
            const k=it.age/D.life;
            if (k>=1) {
                it.active=false;
                it.mesh.visible=false;
                continue;
            }
            it.mesh.scale.setScalar(it.size*EASE.easeOutQuad(Math.min(1,it.age/D.grow)));
            it.mesh.material.uniforms.uAge.value=k;
        }
    }
}
