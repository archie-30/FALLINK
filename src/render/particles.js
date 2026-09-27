import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {particleMaterial,flashMaterial,ringMaterial,pal} from './materials.js';
import {EASE} from '../core/easing.js';
import {RNG} from '../core/rng.js';

const _m=new THREE.Matrix4();
const _q=new THREE.Quaternion();
const _p=new THREE.Vector3();
const _s=new THREE.Vector3();
const rng=new RNG(4242);

export class Particles {
    constructor(parent,capacity) {
        this.capacity=capacity;
        this.limit=capacity;
        this.mesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,1),particleMaterial(),capacity);
        this.mesh.frustumCulled=false;
        this.mesh.count=0;
        const ink=pal('ink');
        for (let i=0;i<capacity;i++) {
            this.mesh.setColorAt(i,ink);
        }
        this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        parent.add(this.mesh);
        this.px=new Float32Array(capacity);
        this.py=new Float32Array(capacity);
        this.pz=new Float32Array(capacity);
        this.vx=new Float32Array(capacity);
        this.vy=new Float32Array(capacity);
        this.vz=new Float32Array(capacity);
        this.life=new Float32Array(capacity);
        this.max=new Float32Array(capacity);
        this.size=new Float32Array(capacity);
        this.col=[];
        this.n=0;
    }

    clear() {
        this.n=0;
        this.mesh.count=0;
    }

    setLimit(n) {
        this.limit=Math.min(this.capacity,n);
    }

    burst(x,y,z,count,o={}) {
        const color=pal(o.color||'ink');
        const sp=o.speed||[2,6];
        const up=o.up||[1,5];
        const sz=o.size||[0.08,0.18];
        const lf=o.life||[0.35,0.7];
        const cone=o.cone??Math.PI;
        const base=o.dirX!==undefined?Math.atan2(o.dirZ,o.dirX):0;
        for (let k=0;k<count;k++) {
            if (this.n>=this.limit) {
                return;
            }
            const i=this.n++;
            const a=base+(rng.next()*2-1)*cone;
            const s=rng.range(sp[0],sp[1]);
            this.px[i]=x;
            this.py[i]=y;
            this.pz[i]=z;
            this.vx[i]=Math.cos(a)*s;
            this.vz[i]=Math.sin(a)*s;
            this.vy[i]=rng.range(up[0],up[1]);
            this.max[i]=this.life[i]=rng.range(lf[0],lf[1]);
            this.size[i]=rng.range(sz[0],sz[1]);
            this.col[i]=color;
        }
    }

    kill(i) {
        const j=--this.n;
        this.px[i]=this.px[j];
        this.py[i]=this.py[j];
        this.pz[i]=this.pz[j];
        this.vx[i]=this.vx[j];
        this.vy[i]=this.vy[j];
        this.vz[i]=this.vz[j];
        this.life[i]=this.life[j];
        this.max[i]=this.max[j];
        this.size[i]=this.size[j];
        this.col[i]=this.col[j];
    }

    update(dt) {
        const g=TUNING.particles.gravity;
        for (let i=this.n-1;i>=0;i--) {
            this.life[i]-=dt;
            if (this.life[i]<=0) {
                this.kill(i);
                continue;
            }
            if (this.py[i]>0.03) {
                this.vy[i]-=g*dt;
                this.px[i]+=this.vx[i]*dt;
                this.py[i]+=this.vy[i]*dt;
                this.pz[i]+=this.vz[i]*dt;
                if (this.py[i]<=0.03) {
                    this.py[i]=0.03;
                    this.size[i]*=1.4;
                }
            }
        }
    }

    render() {
        const mesh=this.mesh;
        for (let i=0;i<this.n;i++) {
            const f=this.life[i]/this.max[i];
            const s=this.size[i]*Math.min(1,f*3);
            _p.set(this.px[i],this.py[i],this.pz[i]);
            _s.set(s,s,s);
            _m.compose(_p,_q,_s);
            mesh.setMatrixAt(i,_m);
            mesh.setColorAt(i,this.col[i]);
        }
        mesh.count=this.n;
        mesh.instanceMatrix.needsUpdate=true;
        mesh.instanceColor.needsUpdate=true;
    }
}

function drawStar(ctx,cx,cy,r,rng) {
    const spikes=rng.int(7,10);
    ctx.beginPath();
    for (let i=0;i<=spikes*2;i++) {
        const a=i/(spikes*2)*Math.PI*2+rng.range(-0.12,0.12);
        const rr=i%2===0?r*rng.range(0.75,1.0):r*rng.range(0.25,0.42);
        const x=cx+Math.cos(a)*rr;
        const y=cy+Math.sin(a)*rr;
        if (i===0) {
            ctx.moveTo(x,y);
        }
        else {
            ctx.lineTo(x,y);
        }
    }
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth=r*0.07;
    for (let k=0;k<4;k++) {
        const a=rng.range(0,Math.PI*2);
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(a)*r*0.5,cy+Math.sin(a)*r*0.5);
        ctx.lineTo(cx+Math.cos(a)*r*1.15,cy+Math.sin(a)*r*1.15);
        ctx.stroke();
    }
}

export function createFlashAtlas(size=128) {
    const c=document.createElement('canvas');
    c.width=size*3;
    c.height=size;
    const ctx=c.getContext('2d');
    ctx.fillStyle='#fff';
    ctx.strokeStyle='#fff';
    ctx.lineCap='round';
    const r=new RNG(77);
    for (let f=0;f<3;f++) {
        drawStar(ctx,size*f+size/2,size/2,size*(0.42-f*0.06),r);
    }
    const tex=new THREE.CanvasTexture(c);
    tex.colorSpace=THREE.NoColorSpace;
    tex.generateMipmaps=false;
    tex.minFilter=THREE.LinearFilter;
    return tex;
}

export class MuzzleFlashes {
    constructor(parent,count=8) {
        this.atlas=createFlashAtlas();
        this.items=[];
        const geo=new THREE.PlaneGeometry(1,1);
        for (let i=0;i<count;i++) {
            const m=new THREE.Mesh(geo,flashMaterial(this.atlas));
            m.frustumCulled=false;
            m.visible=false;
            parent.add(m);
            this.items.push({mesh:m,t:0,active:false});
        }
        this.next=0;
        this.frameTime=1/30;
    }

    show(x,y,z,color='ink',scale=1) {
        const it=this.items[this.next];
        this.next=(this.next+1)%this.items.length;
        it.active=true;
        it.t=0;
        it.mesh.visible=true;
        it.mesh.position.set(x,y,z);
        const u=it.mesh.material.uniforms;
        u.uColor.value.copy(pal(color));
        u.uRot.value=rng.range(0,Math.PI*2);
        u.uScale.value=scale*rng.range(0.85,1.15);
        u.uFrame.value=0;
    }

    update(dt) {
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            it.t+=dt;
            const f=Math.floor(it.t/this.frameTime);
            if (f>2) {
                it.active=false;
                it.mesh.visible=false;
                continue;
            }
            it.mesh.material.uniforms.uFrame.value=f;
        }
    }
}

export class Rings {
    constructor(parent,count=8) {
        const geo=new THREE.PlaneGeometry(2,2);
        geo.rotateX(-Math.PI/2);
        this.items=[];
        for (let i=0;i<count;i++) {
            const m=new THREE.Mesh(geo,ringMaterial('ink'));
            m.visible=false;
            m.frustumCulled=false;
            parent.add(m);
            this.items.push({mesh:m,t:0,dur:0.3,r:1,active:false});
        }
        this.next=0;
    }

    spawn(x,z,radius,color='ink',dur=0.32) {
        const it=this.items[this.next];
        this.next=(this.next+1)%this.items.length;
        it.active=true;
        it.t=0;
        it.dur=dur;
        it.r=radius;
        it.mesh.visible=true;
        it.mesh.position.set(x,0.06,z);
        it.mesh.material.uniforms.uColor.value.copy(pal(color));
    }

    update(dt) {
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            it.t+=dt;
            const p=Math.min(1,it.t/it.dur);
            if (p>=1) {
                it.active=false;
                it.mesh.visible=false;
                continue;
            }
            const r=Math.max(0.05,it.r*EASE.easeOutCubic(p));
            it.mesh.scale.set(r,1,r);
            const u=it.mesh.material.uniforms;
            u.uWidth.value=0.3*(1-p)+0.03;
            u.uAlpha.value=1-p*p;
        }
    }
}
