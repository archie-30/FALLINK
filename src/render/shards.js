import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {RNG} from '../core/rng.js';

const _m=new THREE.Matrix4();
const _q=new THREE.Quaternion();
const _e=new THREE.Euler();
const _p=new THREE.Vector3();
const _s=new THREE.Vector3();
const rng=new RNG(9001);

function shardGeometry() {
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute([0,0.55,0,-0.45,-0.3,0,0.5,-0.22,0],3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute([0,0,1,0,0,1,0,0,1],3));
    return g;
}

export class Shards {
    constructor(parent,material,capacity=TUNING.shards.capacity) {
        this.capacity=capacity;
        this.mesh=new THREE.InstancedMesh(shardGeometry(),material,capacity);
        this.mesh.frustumCulled=false;
        this.mesh.count=0;
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        parent.add(this.mesh);
        this.items=[];
        for (let i=0;i<capacity;i++) {
            this.items.push({x:0,y:0,z:0,vx:0,vy:0,vz:0,rx:0,ry:0,rz:0,wx:0,wy:0,wz:0,sx:1,sy:1,life:0,max:1,ground:0});
        }
        this.n=0;
    }

    burst(x,y,z,count,dirX=0,dirZ=0,scale=1) {
        const S=TUNING.shards;
        for (let k=0;k<count;k++) {
            if (this.n>=this.capacity) {
                return;
            }
            const it=this.items[this.n++];
            const a=rng.range(0,Math.PI*2);
            const sp=rng.range(S.speed[0],S.speed[1]);
            it.x=x+Math.cos(a)*0.2;
            it.y=y+rng.range(-0.3,0.4);
            it.z=z+Math.sin(a)*0.2;
            it.vx=Math.cos(a)*sp+dirX*3;
            it.vz=Math.sin(a)*sp+dirZ*3;
            it.vy=rng.range(S.up[0],S.up[1]);
            it.rx=rng.range(0,6.28);
            it.ry=rng.range(0,6.28);
            it.rz=rng.range(0,6.28);
            it.wx=rng.range(-1,1)*S.spin;
            it.wy=rng.range(-1,1)*S.spin;
            it.wz=rng.range(-1,1)*S.spin;
            it.sx=rng.range(S.size[0],S.size[1])*scale;
            it.sy=it.sx*rng.range(0.6,1.4);
            it.max=it.life=S.life*rng.range(0.8,1.2);
            it.ground=0;
        }
    }

    update(dt) {
        const S=TUNING.shards;
        for (let i=this.n-1;i>=0;i--) {
            const it=this.items[i];
            it.life-=dt;
            if (it.life<=0) {
                const last=this.items[--this.n];
                this.items[this.n]=it;
                this.items[i]=last;
                continue;
            }
            if (it.ground<3) {
                it.vy-=S.gravity*dt;
                it.x+=it.vx*dt;
                it.y+=it.vy*dt;
                it.z+=it.vz*dt;
                it.rx+=it.wx*dt;
                it.ry+=it.wy*dt;
                it.rz+=it.wz*dt;
                if (it.y<0.04) {
                    it.y=0.04;
                    it.ground++;
                    it.vy=-it.vy*S.bounce;
                    it.vx*=0.55;
                    it.vz*=0.55;
                    it.wx*=0.5;
                    it.wy*=0.5;
                    it.wz*=0.5;
                    if (it.ground>=3||Math.abs(it.vy)<0.8) {
                        it.ground=3;
                        it.rx=-Math.PI/2+rng.range(-0.35,0.35);
                        it.rz=rng.range(-0.3,0.3);
                        it.y=0.12;
                    }
                }
            }
        }
    }

    render() {
        for (let i=0;i<this.n;i++) {
            const it=this.items[i];
            const f=Math.min(1,it.life/0.4);
            _p.set(it.x,it.y,it.z);
            _q.setFromEuler(_e.set(it.rx,it.ry,it.rz,'YXZ'));
            _s.set(it.sx*f,it.sy*f,1);
            _m.compose(_p,_q,_s);
            this.mesh.setMatrixAt(i,_m);
        }
        this.mesh.count=this.n;
        this.mesh.instanceMatrix.needsUpdate=true;
    }
}
