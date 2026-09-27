import*as THREE from 'three';
import {dashMaterial,ringMaterial,pal} from './materials.js';
import {cardParams,cardRange} from '../game/card.js';
import {TUNING} from '../data/tuning.js';

const SEG=24;

export class Preview {
    constructor(parent) {
        const lg=new THREE.PlaneGeometry(1,1);
        lg.rotateX(-Math.PI/2);
        lg.translate(0.5,0,0);
        this.lines=[];
        for (let i=0;i<9;i++) {
            const m=new THREE.Mesh(lg,dashMaterial('ink'));
            m.visible=false;
            m.frustumCulled=false;
            parent.add(m);
            this.lines.push(m);
        }
        const ag=new THREE.BufferGeometry();
        this.arcPos=new THREE.BufferAttribute(new Float32Array((SEG+1)*2*3),3);
        this.arcPos.setUsage(THREE.DynamicDrawUsage);
        const uv=new Float32Array((SEG+1)*2*2);
        const idx=[];
        for (let i=0;i<=SEG;i++) {
            uv[i*4]=i/SEG;
            uv[i*4+1]=0;
            uv[i*4+2]=i/SEG;
            uv[i*4+3]=1;
            if (i<SEG) {
                const v=i*2;
                idx.push(v,v+1,v+2,v+1,v+3,v+2);
            }
        }
        ag.setAttribute('position',this.arcPos);
        ag.setAttribute('uv',new THREE.BufferAttribute(uv,2));
        ag.setIndex(idx);
        this.arc=new THREE.Mesh(ag,dashMaterial('ink'));
        this.arc.visible=false;
        this.arc.frustumCulled=false;
        parent.add(this.arc);
        const rg=new THREE.PlaneGeometry(2,2);
        rg.rotateX(-Math.PI/2);
        this.ring=new THREE.Mesh(rg,ringMaterial('ink'));
        this.ring.visible=false;
        this.ring.frustumCulled=false;
        this.ring.material.uniforms.uDash.value=18;
        this.ring.material.uniforms.uWidth.value=0.08;
        parent.add(this.ring);
        this.time=0;
    }

    hide() {
        for (const l of this.lines) {
            l.visible=false;
        }
        this.arc.visible=false;
        this.ring.visible=false;
    }

    setLine(m,x,z,dx,dz,len,color) {
        m.visible=true;
        m.position.set(x,0.05,z);
        m.rotation.y=Math.atan2(-dz,dx);
        m.scale.set(len,1,0.14);
        const u=m.material.uniforms;
        u.uLength.value=len;
        u.uColor.value.copy(pal(color));
    }

    show(card,target,p) {
        this.hide();
        const tg=card.def.targeting;
        const color=card.def.rarity==='rare'?'red':'ink';
        const params=cardParams(card);
        if (tg==='direction') {
            const count=card.id==='scatter'?params.count:1;
            const spread=card.id==='scatter'?params.spread:0;
            const base=Math.atan2(target.dz,target.dx);
            const len=cardRange(card);
            for (let i=0;i<count&&i<this.lines.length;i++) {
                const a=count>1?base+(i/(count-1)-0.5)*spread:base;
                this.setLine(this.lines[i],p.x,p.z,Math.cos(a),Math.sin(a),len,color);
            }
            return;
        }
        if (tg==='point') {
            const a=this.arcPos.array;
            const x0=p.x;
            const z0=p.z;
            const x1=target.x;
            const z1=target.z;
            const dx=x1-x0;
            const dz=z1-z0;
            const L=Math.hypot(dx,dz)||1;
            const nx=-dz/L*0.07;
            const nz=dx/L*0.07;
            const h=Math.min(TUNING.effects.bombArc,L*0.4);
            for (let i=0;i<=SEG;i++) {
                const f=i/SEG;
                const x=x0+dx*f;
                const z=z0+dz*f;
                const y=TUNING.weapon.height*(1-f)+0.05*f+Math.sin(f*Math.PI)*h;
                a[i*6]=x+nx;
                a[i*6+1]=y;
                a[i*6+2]=z+nz;
                a[i*6+3]=x-nx;
                a[i*6+4]=y;
                a[i*6+5]=z-nz;
            }
            this.arcPos.needsUpdate=true;
            this.arc.geometry.computeBoundingSphere();
            this.arc.visible=true;
            const u=this.arc.material.uniforms;
            u.uLength.value=L+h;
            u.uColor.value.copy(pal(color));
            const r=params.radius||1;
            this.ring.visible=true;
            this.ring.position.set(x1,0.06,z1);
            this.ring.scale.set(r,1,r);
            this.ring.material.uniforms.uColor.value.copy(pal(color));
            return;
        }
        this.ring.visible=true;
        this.ring.position.set(p.x,0.06,p.z);
        this.ring.scale.set(1.3,1,1.3);
        this.ring.material.uniforms.uColor.value.copy(pal(color));
    }

    update(dt) {
        this.time+=dt;
        const k=this.time*1.5;
        for (const l of this.lines) {
            l.material.uniforms.uTime.value=k;
        }
        this.arc.material.uniforms.uTime.value=k;
        this.ring.material.uniforms.uTime.value=this.time*0.3;
    }
}
