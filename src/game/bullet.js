import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {unlitMaterial,trailMaterial} from '../render/materials.js';
import {circleVs} from '../core/collision.js';

const _m=new THREE.Matrix4();
const _q=new THREE.Quaternion();
const _p=new THREE.Vector3();
const _s=new THREE.Vector3();
const _up=new THREE.Vector3(0,1,0);
const hit={x:0,z:0,depth:0};

export class BulletSystem {
    constructor(scene,fxScene,o) {
        const cap=o.capacity||TUNING.bullet.capacity;
        const K=TUNING.bullet.trailPoints;
        this.cap=cap;
        this.K=K;
        this.color=o.color;
        this.radius=o.radius;
        this.size=o.size;
        this.trailWidth=o.trailWidth;
        this.height=o.height??TUNING.weapon.height;
        this.x=new Float32Array(cap);
        this.z=new Float32Array(cap);
        this.ox=new Float32Array(cap);
        this.oz=new Float32Array(cap);
        this.vx=new Float32Array(cap);
        this.vz=new Float32Array(cap);
        this.life=new Float32Array(cap);
        this.dmg=new Float32Array(cap);
        this.age=new Uint16Array(cap);
        this.hist=new Float32Array(cap*K*2);
        this.n=0;
        this.onWall=null;
        this.onHit=null;
        const geo=new THREE.OctahedronGeometry(1,0);
        geo.scale(0.6,0.6,1.5);
        this.heads=new THREE.InstancedMesh(geo,unlitMaterial({color:o.color}),cap);
        this.heads.frustumCulled=false;
        this.heads.count=0;
        this.heads.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.heads);
        const vcount=cap*K*2;
        const tg=new THREE.BufferGeometry();
        this.tPos=new THREE.BufferAttribute(new Float32Array(vcount*3),3);
        this.tPos.setUsage(THREE.DynamicDrawUsage);
        this.tAlpha=new THREE.BufferAttribute(new Float32Array(vcount),1);
        this.tAlpha.setUsage(THREE.DynamicDrawUsage);
        const uv=new Float32Array(vcount*2);
        const idx=new Uint32Array(cap*(K-1)*6);
        let w=0;
        for (let b=0;b<cap;b++) {
            for (let j=0;j<K;j++) {
                const v=(b*K+j)*2;
                uv[v*2]=j/(K-1);
                uv[v*2+1]=0;
                uv[v*2+2]=j/(K-1);
                uv[v*2+3]=1;
                if (j<K-1) {
                    idx[w++]=v;
                    idx[w++]=v+1;
                    idx[w++]=v+2;
                    idx[w++]=v+1;
                    idx[w++]=v+3;
                    idx[w++]=v+2;
                }
            }
        }
        tg.setAttribute('position',this.tPos);
        tg.setAttribute('aAlpha',this.tAlpha);
        tg.setAttribute('uv',new THREE.BufferAttribute(uv,2));
        tg.setIndex(new THREE.BufferAttribute(idx,1));
        tg.setDrawRange(0,0);
        this.trails=new THREE.Mesh(tg,trailMaterial(o.color));
        this.trails.frustumCulled=false;
        fxScene.add(this.trails);
    }

    spawn(x,z,dx,dz,speed,dmg,life) {
        if (this.n>=this.cap) {
            return -1;
        }
        const i=this.n++;
        this.x[i]=this.ox[i]=x;
        this.z[i]=this.oz[i]=z;
        this.vx[i]=dx*speed;
        this.vz[i]=dz*speed;
        this.life[i]=life;
        this.dmg[i]=dmg;
        this.age[i]=0;
        const K=this.K;
        for (let j=0;j<K;j++) {
            this.hist[(i*K+j)*2]=x;
            this.hist[(i*K+j)*2+1]=z;
        }
        return i;
    }

    kill(i) {
        const j=--this.n;
        if (i===j) {
            return;
        }
        this.x[i]=this.x[j];
        this.z[i]=this.z[j];
        this.ox[i]=this.ox[j];
        this.oz[i]=this.oz[j];
        this.vx[i]=this.vx[j];
        this.vz[i]=this.vz[j];
        this.life[i]=this.life[j];
        this.dmg[i]=this.dmg[j];
        this.age[i]=this.age[j];
        const K2=this.K*2;
        this.hist.copyWithin(i*K2,j*K2,j*K2+K2);
    }

    clear() {
        this.n=0;
    }

    update(dt,room) {
        const K=this.K;
        const cols=room.colliders;
        const b=room.bounds;
        const r=this.radius;
        for (let i=this.n-1;i>=0;i--) {
            const h=i*K*2;
            this.hist.copyWithin(h+2,h,h+K*2-2);
            this.hist[h]=this.x[i];
            this.hist[h+1]=this.z[i];
            this.ox[i]=this.x[i];
            this.oz[i]=this.z[i];
            this.x[i]+=this.vx[i]*dt;
            this.z[i]+=this.vz[i]*dt;
            this.life[i]-=dt;
            if (this.age[i]<K) {
                this.age[i]++;
            }
            const x=this.x[i];
            const z=this.z[i];
            if (this.life[i]<=0||x<b.minX-2||x>b.maxX+2||z<b.minZ-2||z>b.maxZ+2) {
                this.kill(i);
                continue;
            }
            let wall=false;
            for (let c=0;c<cols.length;c++) {
                if (circleVs(x,z,r,cols[c],hit)) {
                    wall=true;
                    break;
                }
            }
            if (wall) {
                if (this.onWall) {
                    this.onWall(x-this.vx[i]*dt*0.5,z-this.vz[i]*dt*0.5,this.vx[i],this.vz[i]);
                }
                this.kill(i);
                continue;
            }
            if (this.onHit&&this.onHit(x,z,r,this.dmg[i],this.vx[i],this.vz[i])) {
                this.kill(i);
            }
        }
    }

    render(alpha) {
        const K=this.K;
        const y=this.height;
        const pos=this.tPos.array;
        const al=this.tAlpha.array;
        const hw=this.trailWidth*0.5;
        for (let i=0;i<this.n;i++) {
            const x=this.ox[i]+(this.x[i]-this.ox[i])*alpha;
            const z=this.oz[i]+(this.z[i]-this.oz[i])*alpha;
            _p.set(x,y,z);
            _q.setFromAxisAngle(_up,Math.atan2(this.vx[i],this.vz[i]));
            _s.setScalar(this.size);
            _m.compose(_p,_q,_s);
            this.heads.setMatrixAt(i,_m);
            const h=i*K*2;
            const valid=Math.min(this.age[i]+1,K);
            let px=x;
            let pz=z;
            for (let j=0;j<K;j++) {
                let cx;
                let cz;
                if (j===0) {
                    cx=x;
                    cz=z;
                }
                else {
                    const jj=Math.min(j-1,valid-1);
                    cx=this.hist[h+jj*2];
                    cz=this.hist[h+jj*2+1];
                }
                let tx=j===0?-this.vx[i]:cx-px;
                let tz=j===0?-this.vz[i]:cz-pz;
                const tl=Math.hypot(tx,tz)||1;
                tx/=tl;
                tz/=tl;
                const f=1-j/(K-1);
                const w=hw*(0.25+0.75*f);
                const v=(i*K+j)*2;
                pos[v*3]=cx-tz*w;
                pos[v*3+1]=y;
                pos[v*3+2]=cz+tx*w;
                pos[v*3+3]=cx+tz*w;
                pos[v*3+4]=y;
                pos[v*3+5]=cz-tx*w;
                const a=j<valid?f:0;
                al[v]=a;
                al[v+1]=a;
                px=cx;
                pz=cz;
            }
        }
        this.heads.count=this.n;
        this.heads.instanceMatrix.needsUpdate=true;
        this.tPos.needsUpdate=true;
        this.tAlpha.needsUpdate=true;
        this.trails.geometry.setDrawRange(0,this.n*(K-1)*6);
    }
}
