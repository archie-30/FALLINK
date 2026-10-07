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
        const pg=new THREE.BufferGeometry();
        this.pathCap=64;
        this.pathPos=new THREE.BufferAttribute(new Float32Array(this.pathCap*2*3),3);
        this.pathPos.setUsage(THREE.DynamicDrawUsage);
        this.pathUv=new THREE.BufferAttribute(new Float32Array(this.pathCap*2*2),2);
        this.pathUv.setUsage(THREE.DynamicDrawUsage);
        const pidx=[];
        for (let i=0;i<this.pathCap-1;i++) {
            const v=i*2;
            pidx.push(v,v+1,v+2,v+1,v+3,v+2);
        }
        pg.setAttribute('position',this.pathPos);
        pg.setAttribute('uv',this.pathUv);
        pg.setIndex(pidx);
        pg.setDrawRange(0,0);
        this.path=new THREE.Mesh(pg,dashMaterial('ink'));
        this.path.visible=false;
        this.path.frustumCulled=false;
        this.path.material.uniforms.uDash.value=0.35;
        parent.add(this.path);
        this.time=0;
        this.warmN=0;
    }

    warm() {
        this.warmN=2;
        for (const m of [...this.lines,this.arc,this.ring,this.path]) {
            m.visible=true;
            m.scale.set(1e-4,1e-4,1e-4);
        }
        this.path.geometry.setDrawRange(0,6);
    }

    showPath(pts,card) {
        this.hide();
        const n=Math.min(pts.length,this.pathCap);
        if (n<2) {
            return;
        }
        const a=this.pathPos.array;
        const u=this.pathUv.array;
        const w=TUNING.terrain.wallThickness*0.5;
        let L=0;
        const lens=[0];
        for (let i=1;i<n;i++) {
            L+=Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z);
            lens.push(L);
        }
        for (let i=0;i<n;i++) {
            const p=pts[i];
            const q=pts[Math.min(n-1,i+1)];
            const o=pts[Math.max(0,i-1)];
            let tx=q.x-o.x;
            let tz=q.z-o.z;
            const tl=Math.hypot(tx,tz)||1;
            tx/=tl;
            tz/=tl;
            a[i*6]=p.x-tz*w;
            a[i*6+1]=0.06;
            a[i*6+2]=p.z+tx*w;
            a[i*6+3]=p.x+tz*w;
            a[i*6+4]=0.06;
            a[i*6+5]=p.z-tx*w;
            const f=L>0?lens[i]/L:0;
            u[i*4]=f;
            u[i*4+1]=0;
            u[i*4+2]=f;
            u[i*4+3]=1;
        }
        this.pathPos.needsUpdate=true;
        this.pathUv.needsUpdate=true;
        this.path.geometry.setDrawRange(0,(n-1)*6);
        this.path.material.uniforms.uLength.value=L;
        this.path.visible=true;
    }

    hide() {
        for (const l of this.lines) {
            l.visible=false;
        }
        this.arc.visible=false;
        this.ring.visible=false;
        if (this.path) {
            this.path.visible=false;
        }
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

    showSector(x,z,base,angle,R,color) {
        const a0=base-angle/2;
        const a1=base+angle/2;
        this.setLine(this.lines[0],x,z,Math.cos(a0),Math.sin(a0),R,color);
        this.setLine(this.lines[1],x,z,Math.cos(a1),Math.sin(a1),R,color);
        const n=this.lines.length-2;
        for (let i=0;i<n;i++) {
            const b0=a0+(a1-a0)*i/n;
            const b1=a0+(a1-a0)*(i+1)/n;
            const sx=x+Math.cos(b0)*R;
            const sz=z+Math.sin(b0)*R;
            const ex=x+Math.cos(b1)*R;
            const ez=z+Math.sin(b1)*R;
            const L=Math.hypot(ex-sx,ez-sz)||0.01;
            this.setLine(this.lines[2+i],sx,sz,(ex-sx)/L,(ez-sz)/L,L,color);
        }
    }

    show(card,target,p) {
        this.hide();
        const tg=card.def.targeting;
        const color=card.def.rarity==='rare'?'red':'ink';
        const params=cardParams(card);
        if (tg==='direction') {
            let count=1;
            let spread=0;
            if (card.id==='scatter') {
                count=params.count;
                spread=params.spread;
            }
            const base=Math.atan2(target.dz,target.dx);
            const len=cardRange(card);
            if (card.id==='eraser') {
                this.showSector(p.x,p.z,base,params.angle,params.range,color);
                return;
            }
            const lead=card.def.mode==='dash'?TUNING.effects.dashLead:0;
            for (let i=0;i<count&&i<this.lines.length;i++) {
                const a=count>1?base+(i/(count-1)-0.5)*spread:base;
                this.setLine(this.lines[i],p.x+Math.cos(a)*lead,p.z+Math.sin(a)*lead,Math.cos(a),Math.sin(a),len,color);
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
        const ar=tg==='aura'?params.radius:TUNING.effects.selfRing;
        this.ring.visible=true;
        this.ring.position.set(p.x,0.06,p.z);
        this.ring.scale.set(ar,1,ar);
        this.ring.material.uniforms.uColor.value.copy(pal(color));
    }

    update(dt) {
        if (this.warmN>0) {
            this.warmN--;
            if (this.warmN===0) {
                this.hide();
                this.arc.scale.set(1,1,1);
                this.path.scale.set(1,1,1);
                this.path.geometry.setDrawRange(0,0);
            }
        }
        this.time+=dt;
        const k=this.time*1.5;
        for (const l of this.lines) {
            l.material.uniforms.uTime.value=k;
        }
        this.arc.material.uniforms.uTime.value=k;
        this.path.material.uniforms.uTime.value=k;
        this.ring.material.uniforms.uTime.value=this.time*0.3;
    }
}
