import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {unlitMaterial,trailMaterial,registerShadow} from '../render/materials.js';
import {circleVs} from '../core/collision.js';

const _m=new THREE.Matrix4();
const _q=new THREE.Quaternion();
const _p=new THREE.Vector3();
const _s=new THREE.Vector3();
const _up=new THREE.Vector3(0,1,0);
const hit={x:0,z:0,depth:0};

function mergeGeos(list) {
    const pos=[];
    for (const g of list) {
        const a=g.toNonIndexed().getAttribute('position').array;
        for (let i=0;i<a.length;i++) {
            pos.push(a[i]);
        }
    }
    const out=new THREE.BufferGeometry();
    out.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    out.computeVertexNormals();
    return out;
}

function compassGeo() {
    const parts=[];
    for (const sx of [-1,1]) {
        const leg=new THREE.CylinderGeometry(0.07,0.03,1.3,6);
        leg.rotateZ(Math.PI/2);
        leg.translate(0.65,0,0);
        leg.rotateY(sx*0.32);
        parts.push(leg);
    }
    const tip=new THREE.ConeGeometry(0.06,0.2,6);
    tip.rotateZ(-Math.PI/2);
    tip.translate(1.38,0,0);
    tip.rotateY(0.32);
    parts.push(tip);
    const hinge=new THREE.CylinderGeometry(0.16,0.16,0.14,10);
    parts.push(hinge);
    const knob=new THREE.CylinderGeometry(0.05,0.05,0.34,6);
    knob.translate(0,0.22,0);
    parts.push(knob);
    const g=mergeGeos(parts);
    g.translate(-0.6,0,0);
    return g;
}

const MODELS={compass:compassGeo};

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
        this.pierce=!!o.pierce;
        this.owner=o.owner||'player';
        this.frozen=0;
        this.homing=o.homing||0;
        this.hits=new Int32Array(cap*6);
        this.hitN=new Uint8Array(cap);
        this.boomerang=!!o.boomerang;
        this.ret=new Uint8Array(cap);
        this.tag=new Int32Array(cap);
        this.el=new Float32Array(cap);
        this.spd=new Float32Array(cap);
        this.drag=o.drag||0;
        this.spin=o.spin||0;
        this.hidden=!!o.hidden;
        this.returnAccel=o.returnAccel||0;
        this.turnRate=o.turnRate||7;
        this.thruWalls=!!o.thruWalls;
        this.ramp=0;
        this.target=null;
        this.onReturn=null;
        this.n=0;
        this.onWall=null;
        this.onHit=null;
        this.onSeek=null;
        let geo;
        if (o.model&&MODELS[o.model]) {
            geo=MODELS[o.model]();
        }
        else {
            geo=new THREE.OctahedronGeometry(1,0);
            geo.scale(0.6,0.6,1.5);
        }
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
        this.hitN[i]=0;
        this.ret[i]=0;
        this.tag[i]=0;
        this.el[i]=0;
        this.spd[i]=speed;
        const K=this.K;
        for (let j=0;j<K;j++) {
            this.hist[(i*K+j)*2]=x;
            this.hist[(i*K+j)*2+1]=z;
        }
        return i;
    }

    kill(i,caught=false) {
        if (this.boomerang&&this.onReturn) {
            this.onReturn(this.x[i],this.z[i],caught);
        }
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
        this.hitN[i]=this.hitN[j];
        this.ret[i]=this.ret[j];
        this.tag[i]=this.tag[j];
        this.el[i]=this.el[j];
        this.spd[i]=this.spd[j];
        this.hits.copyWithin(i*6,j*6,j*6+6);
        const K2=this.K*2;
        this.hist.copyWithin(i*K2,j*K2,j*K2+K2);
    }

    turnBack(i) {
        this.ret[i]=1;
        this.life[i]=4;
        this.hitN[i]=0;
        let dx=-this.vx[i];
        let dz=-this.vz[i];
        if (this.target) {
            dx=this.target.x-this.x[i];
            dz=this.target.z-this.z[i];
        }
        const l=Math.hypot(dx,dz)||1;
        this.vx[i]=dx/l*this.spd[i];
        this.vz[i]=dz/l*this.spd[i];
    }

    clear() {
        this.n=0;
        this.frozen=0;
    }

    hasHit(i,uid) {
        const n=this.hitN[i];
        for (let k=0;k<n;k++) {
            if (this.hits[i*6+k]===uid) {
                return true;
            }
        }
        return false;
    }

    steer(i,dt) {
        const tg=this.onSeek(this.x[i],this.z[i]);
        if (!tg) {
            return;
        }
        const vx=this.vx[i];
        const vz=this.vz[i];
        const sp=Math.hypot(vx,vz);
        const cur=Math.atan2(vz,vx);
        let want=Math.atan2(tg.z-this.z[i],tg.x-this.x[i])-cur;
        while (want>Math.PI) {
            want-=Math.PI*2;
        }
        while (want<-Math.PI) {
            want+=Math.PI*2;
        }
        const mx=this.homing*dt;
        const a=cur+Math.max(-mx,Math.min(mx,want));
        this.vx[i]=Math.cos(a)*sp;
        this.vz[i]=Math.sin(a)*sp;
    }

    killWhere(fn,onKill) {
        for (let i=this.n-1;i>=0;i--) {
            if (fn(this.x[i],this.z[i])) {
                if (onKill) {
                    onKill(this.x[i],this.z[i]);
                }
                this.kill(i);
            }
        }
    }

    update(dt,room) {
        const K=this.K;
        const cols=room.colliders;
        const b=room.bounds;
        const r=this.radius;
        const frozen=this.frozen>0;
        if (frozen) {
            this.frozen-=dt;
        }
        const own=this.owner==='player';
        for (let i=this.n-1;i>=0;i--) {
            if (frozen) {
                this.ox[i]=this.x[i];
                this.oz[i]=this.z[i];
                if (this.onHit&&this.onHit(this.x[i],this.z[i],r,this.dmg[i],this.vx[i],this.vz[i],this,i)) {
                    this.kill(i);
                }
                continue;
            }
            const h=i*K*2;
            this.hist.copyWithin(h+2,h,h+K*2-2);
            this.hist[h]=this.x[i];
            this.hist[h+1]=this.z[i];
            this.ox[i]=this.x[i];
            this.oz[i]=this.z[i];
            if (this.homing&&this.onSeek) {
                this.steer(i,dt);
            }
            this.el[i]+=dt;
            if (this.drag) {
                const f=Math.exp(-this.drag*dt);
                this.vx[i]*=f;
                this.vz[i]*=f;
            }
            if (this.boomerang&&!this.ret[i]) {
                const sp=Math.hypot(this.vx[i],this.vz[i])||1;
                const ns=Math.max(this.spd[i]*0.12,sp-this.returnAccel*dt);
                this.vx[i]*=ns/sp;
                this.vz[i]*=ns/sp;
            }
            if (this.boomerang&&this.ret[i]&&this.target) {
                const tx=this.target.x-this.x[i];
                const tz=this.target.z-this.z[i];
                const tl=Math.hypot(tx,tz)||1;
                if (tl<0.9) {
                    this.kill(i,true);
                    continue;
                }
                const sp=this.returnAccel>0?Math.min(this.spd[i],Math.hypot(this.vx[i],this.vz[i])+this.returnAccel*dt):this.spd[i];
                const k=Math.min(1,dt*this.turnRate);
                this.vx[i]+=(tx/tl*sp-this.vx[i])*k;
                this.vz[i]+=(tz/tl*sp-this.vz[i])*k;
                const cl=Math.hypot(this.vx[i],this.vz[i])||1;
                this.vx[i]*=sp/cl;
                this.vz[i]*=sp/cl;
            }
            this.x[i]+=this.vx[i]*dt;
            this.z[i]+=this.vz[i]*dt;
            this.life[i]-=dt;
            if (this.boomerang&&!this.ret[i]&&this.life[i]<=0) {
                this.turnBack(i);
            }
            if (this.age[i]<K) {
                this.age[i]++;
            }
            const x=this.x[i];
            const z=this.z[i];
            if (this.life[i]<=0||x<b.minX-2||x>b.maxX+2||z<b.minZ-2||z>b.maxZ+2) {
                this.kill(i);
                continue;
            }
            let wall=null;
            for (let c=0;c<cols.length&&!this.thruWalls;c++) {
                const col=cols[c];
                if (own&&col.passPlayer) {
                    continue;
                }
                if (this.boomerang&&col.piece&&col.piece.kind!=='border'&&col.piece.kind!=='door'&&col.piece.kind!=='target') {
                    continue;
                }
                if (circleVs(x,z,r,col,hit)) {
                    wall=col;
                    break;
                }
            }
            if (wall&&this.boomerang&&!this.ret[i]) {
                this.x[i]-=this.vx[i]*dt;
                this.z[i]-=this.vz[i]*dt;
                this.turnBack(i);
                if (this.onWall) {
                    this.onWall(x,z,-this.vx[i],-this.vz[i],wall);
                }
                continue;
            }
            if (wall&&this.boomerang) {
                wall=null;
            }
            if (wall) {
                if (this.onWall) {
                    this.onWall(x-this.vx[i]*dt*0.5,z-this.vz[i]*dt*0.5,this.vx[i],this.vz[i],wall);
                }
                this.kill(i);
                continue;
            }
            if (this.onHit) {
                const e=this.onHit(x,z,r,this.dmg[i],this.vx[i],this.vz[i],this,i);
                if (e) {
                    if (this.pierce&&this.hitN[i]<6) {
                        this.hits[i*6+this.hitN[i]]=e.uid;
                        this.hitN[i]++;
                        this.dmg[i]*=1+this.ramp;
                    }
                    else {
                        this.kill(i);
                    }
                }
            }
        }
    }

    render(alpha) {
        if (this.hidden) {
            this.heads.count=0;
            this.trails.geometry.setDrawRange(0,0);
            return;
        }
        const K=this.K;
        const y=this.height;
        const pos=this.tPos.array;
        const al=this.tAlpha.array;
        const hw=this.trailWidth*0.5;
        for (let i=0;i<this.n;i++) {
            const x=this.ox[i]+(this.x[i]-this.ox[i])*alpha;
            const z=this.oz[i]+(this.z[i]-this.oz[i])*alpha;
            _p.set(x,y,z);
            _q.setFromAxisAngle(_up,this.spin?-this.el[i]*this.spin:Math.atan2(this.vx[i],this.vz[i]));
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

export class Lobs {
    constructor(scene,count=6) {
        const geo=new THREE.IcosahedronGeometry(0.36,1);
        const mat=unlitMaterial({color:'ink',jitter:0.02});
        this.items=[];
        for (let i=0;i<count;i++) {
            const m=new THREE.Mesh(geo,mat);
            m.visible=false;
            scene.add(m);
            const sh=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),null);
            sh.rotation.x=-Math.PI/2;
            sh.position.y=0.03;
            sh.visible=false;
            registerShadow(sh);
            scene.add(sh);
            this.items.push({mesh:m,shadow:sh,active:false,t:0,pt:0,dur:1,x0:0,z0:0,x1:0,z1:0,y0:1,arc:3,onLand:null});
        }
    }

    clear() {
        for (const it of this.items) {
            it.active=false;
            it.mesh.visible=false;
            it.shadow.visible=false;
        }
    }

    launch(x0,z0,x1,z1,dur,arc,onLand) {
        const it=this.items.find(o=>!o.active);
        if (!it) {
            onLand(x1,z1);
            return;
        }
        it.active=true;
        it.t=0;
        it.pt=0;
        it.dur=dur;
        it.x0=x0;
        it.z0=z0;
        it.x1=x1;
        it.z1=z1;
        it.y0=TUNING.weapon.height;
        it.arc=arc;
        it.onLand=onLand;
        it.mesh.visible=true;
        it.shadow.visible=true;
    }

    update(dt) {
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            it.pt=it.t;
            it.t+=dt;
            if (it.t>=it.dur) {
                it.active=false;
                it.mesh.visible=false;
                it.shadow.visible=false;
                it.onLand(it.x1,it.z1);
            }
        }
    }

    render(alpha) {
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            const t=it.pt+(it.t-it.pt)*alpha;
            const p=Math.min(1,t/it.dur);
            const x=it.x0+(it.x1-it.x0)*p;
            const z=it.z0+(it.z1-it.z0)*p;
            const y=it.y0*(1-p)+0.2*p+Math.sin(p*Math.PI)*it.arc;
            it.mesh.position.set(x,y,z);
            it.mesh.rotation.set(t*9,t*6,0);
            const sq=1+Math.sin(p*Math.PI)*0.15;
            it.mesh.scale.set(1/sq,sq,1/sq);
            it.shadow.position.set(x,0.03,z);
            const ss=Math.max(0.35,1-y*0.12);
            it.shadow.scale.set(ss,ss,ss);
        }
    }
}
