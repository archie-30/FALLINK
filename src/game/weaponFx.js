import*as THREE from 'three';
import {TUNING} from '../data/tuning.js';
import {brushMaterial,beamMaterial} from '../render/materials.js';

const SEG=20;

export class BrushStrokes {
    constructor(fxScene,color) {
        const B=TUNING.brushStroke;
        this.items=[];
        for (let i=0;i<B.count;i++) {
            const g=new THREE.BufferGeometry();
            const uv=new Float32Array((SEG+1)*4);
            const idx=[];
            for (let j=0;j<=SEG;j++) {
                uv[j*4]=j/SEG;
                uv[j*4+1]=0;
                uv[j*4+2]=j/SEG;
                uv[j*4+3]=1;
                if (j<SEG) {
                    const v=j*2;
                    idx.push(v,v+1,v+2,v+1,v+3,v+2);
                }
            }
            const pos=new THREE.BufferAttribute(new Float32Array((SEG+1)*6),3);
            pos.setUsage(THREE.DynamicDrawUsage);
            const al=new THREE.BufferAttribute(new Float32Array((SEG+1)*2),1);
            al.setUsage(THREE.DynamicDrawUsage);
            g.setAttribute('position',pos);
            g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
            g.setAttribute('aAlpha',al);
            g.setIndex(idx);
            const m=new THREE.Mesh(g,brushMaterial(color));
            m.frustumCulled=false;
            m.visible=false;
            fxScene.add(m);
            this.items.push({mesh:m,pos,al,active:false,t:0,pt:0});
        }
        this.next=0;
    }

    spawn(x,z,ang,fan,v0,drag,life,ray=null) {
        const it=this.items[this.next];
        this.next=(this.next+1)%this.items.length;
        it.active=true;
        it.t=0;
        it.pt=0;
        it.x=x;
        it.z=z;
        it.ang=ang;
        it.fan=fan;
        it.v0=v0;
        it.drag=drag;
        it.life=life;
        it.dir=Math.random()<0.5?1:-1;
        const B=TUNING.brushStroke;
        const far=B.muzzle+v0/drag*(1+B.thickGrow)+B.thickMin;
        it.lim=it.lim||new Float32Array(SEG+1);
        for (let j=0;j<=SEG;j++) {
            const an=ang+(it.dir>0?j/SEG-0.5:0.5-j/SEG)*fan*B.arc;
            it.lim[j]=ray?ray(x,z,an,far):far;
        }
        it.mesh.material.uniforms.uSeed.value=Math.random()*10;
        it.mesh.visible=true;
    }

    clear() {
        for (const it of this.items) {
            it.active=false;
            it.mesh.visible=false;
        }
    }

    update(dt) {
        const B=TUNING.brushStroke;
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            it.pt=it.t;
            it.t+=dt;
            if (it.t>=it.life+B.fade) {
                it.active=false;
                it.mesh.visible=false;
            }
        }
    }

    render(alpha) {
        const B=TUNING.brushStroke;
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            const t=it.pt+(it.t-it.pt)*alpha;
            const tt=Math.min(t,it.life);
            const reach=it.v0/it.drag*(1-Math.exp(-it.drag*tt));
            const outer=B.muzzle+reach;
            const thick=B.thickMin+reach*B.thickGrow;
            const inner=Math.max(0,outer-thick*(1-B.lead));
            const front=outer+thick*B.lead;
            const fade=t<it.life?1:Math.max(0,1-(t-it.life)/B.fade);
            const a=fade*(1-0.3*tt/it.life);
            const p=it.pos.array;
            const al=it.al.array;
            for (let j=0;j<=SEG;j++) {
                const u=j/SEG;
                const an=it.ang+(it.dir>0?u-0.5:0.5-u)*it.fan*B.arc;
                const c=Math.cos(an);
                const s=Math.sin(an);
                const bow=Math.sin(u*Math.PI)*thick*B.bow;
                const k=j*6;
                const lim=it.lim[j];
                const ri=Math.min(inner+bow,lim);
                const ro=Math.min(front+bow,lim);
                p[k]=it.x+c*ri;
                p[k+1]=B.height;
                p[k+2]=it.z+s*ri;
                p[k+3]=it.x+c*ro;
                p[k+4]=B.height;
                p[k+5]=it.z+s*ro;
                al[j*2]=a;
                al[j*2+1]=a;
            }
            it.pos.needsUpdate=true;
            it.al.needsUpdate=true;
        }
    }
}

export class Beam {
    constructor(fxScene,color,core) {
        const g=new THREE.PlaneGeometry(1,1);
        g.rotateX(-Math.PI/2);
        g.translate(0.5,0,0);
        this.mesh=new THREE.Mesh(g,beamMaterial(color,core));
        this.mesh.frustumCulled=false;
        this.mesh.visible=false;
        fxScene.add(this.mesh);
        this.alpha=0;
        this.on=false;
        this.x=0;
        this.z=0;
        this.dx=1;
        this.dz=0;
        this.len=1;
        this.width=0.6;
        this.time=0;
    }

    set(on,x,z,dx,dz,len,width) {
        this.on=on;
        if (on) {
            this.x=x;
            this.z=z;
            this.dx=dx;
            this.dz=dz;
            this.len=Math.max(0.3,len);
            this.width=width;
        }
    }

    clear() {
        this.on=false;
        this.alpha=0;
        this.mesh.visible=false;
    }

    update(dt) {
        const C=TUNING.beam;
        const target=this.on?1:0;
        const k=Math.min(1,dt*(this.on?C.fadeIn:C.fadeOut));
        this.alpha+=(target-this.alpha)*k;
        this.time+=dt;
    }

    render() {
        const C=TUNING.beam;
        const vis=this.alpha>0.01;
        this.mesh.visible=vis;
        if (!vis) {
            return;
        }
        const pulse=1+Math.sin(this.time*C.pulse)*C.pulseAmp;
        this.mesh.position.set(this.x,C.height,this.z);
        this.mesh.rotation.y=-Math.atan2(this.dz,this.dx);
        this.mesh.scale.set(this.len,1,this.width*pulse*(0.6+this.alpha*0.4));
        const u=this.mesh.material.uniforms;
        u.uAlpha.value=this.alpha;
        u.uLength.value=this.len;
        u.uTime.value=this.time;
    }
}
