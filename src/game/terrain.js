import*as THREE from 'three';
import {toonMaterial,dissolveVariant,trapMaterial,inkMaterial,pal} from '../render/materials.js';
import {makeBox,makeCircle,circleVs} from '../core/collision.js';
import {RNG,hash1} from '../core/rng.js';
import {EASE} from '../core/easing.js';
import {TUNING} from '../data/tuning.js';

const geoCache=new Map();

function cachedGeo(key,make) {
    if (!geoCache.has(key)) {
        geoCache.set(key,make());
    }
    return geoCache.get(key);
}

const TONES={
    cover:{light:'farGray',mid:'midGray',dark:'nearGray'},
    light:{light:'paper',mid:'farGray',dark:'midGray'},
    dark:{light:'midGray',mid:'nearGray',dark:'ink'},
    ground:{light:'paper',mid:'paper',dark:'farGray'}
};

function mat(tone) {
    return toonMaterial(TONES[tone]);
}

function box(w,h,d) {
    return cachedGeo('box|'+w+'|'+h+'|'+d,()=>new THREE.BoxGeometry(w,h,d));
}

function crumpleGeo(r,seed) {
    return cachedGeo('crumple|'+r+'|'+seed,()=>{
        const g=new THREE.IcosahedronGeometry(r,1);
        const p=g.attributes.position;
        const v=new THREE.Vector3();
        for (let i=0;i<p.count;i++) {
            v.fromBufferAttribute(p,i);
            const k=Math.round(v.x*97)*7919+Math.round(v.y*97)*104729+Math.round(v.z*97)*1299709+seed;
            v.multiplyScalar(0.78+hash1(k)*0.36);
            p.setXYZ(i,v.x,v.y*0.85,v.z);
        }
        g.computeVertexNormals();
        return g;
    });
}

function buildProp(p,group,colliders) {
    const rot=p.rot||0;
    if (p.type==='wall'||p.type==='box') {
        const m=new THREE.Mesh(box(p.w,p.h,p.d),mat('cover'));
        m.position.set(p.x,p.h/2,p.z);
        m.rotation.y=rot;
        group.add(m);
        colliders.push(makeBox(p.x,p.z,p.w/2,p.d/2,rot));
        return {object:m,radius:Math.hypot(p.w,p.d)/2};
    }
    if (p.type==='pillar') {
        const g=cachedGeo('pillar|'+p.r+'|'+p.h,()=>new THREE.CylinderGeometry(p.r,p.r*1.08,p.h,9));
        const holder=new THREE.Group();
        const m=new THREE.Mesh(g,mat('cover'));
        m.position.set(p.x,p.h/2,p.z);
        holder.add(m);
        const cap=new THREE.Mesh(box(p.r*2.3,0.3,p.r*2.3),mat('cover'));
        cap.position.set(p.x,p.h+0.15,p.z);
        cap.rotation.y=0.4;
        holder.add(cap);
        group.add(holder);
        colliders.push(makeCircle(p.x,p.z,p.r*1.08));
        return {object:holder,radius:p.r*1.6};
    }
    if (p.type==='pencil') {
        const g=new THREE.Group();
        const bodyLen=p.len*0.82;
        const tipLen=p.len-bodyLen;
        const body=new THREE.Mesh(cachedGeo('pbody|'+p.r+'|'+bodyLen,()=>new THREE.CylinderGeometry(p.r,p.r,bodyLen,6)),mat('cover'));
        body.rotation.z=Math.PI/2;
        body.position.x=-tipLen/2;
        const tip=new THREE.Mesh(cachedGeo('ptip|'+p.r+'|'+tipLen,()=>new THREE.CylinderGeometry(p.r*0.22,p.r,tipLen,6)),mat('light'));
        tip.rotation.z=-Math.PI/2;
        tip.position.x=bodyLen/2;
        const lead=new THREE.Mesh(cachedGeo('plead|'+p.r+'|'+tipLen,()=>new THREE.ConeGeometry(p.r*0.22,tipLen*0.3,6)),mat('dark'));
        lead.rotation.z=-Math.PI/2;
        lead.position.x=bodyLen/2+tipLen*0.5+tipLen*0.15;
        const band=new THREE.Mesh(cachedGeo('pband|'+p.r,()=>new THREE.CylinderGeometry(p.r*1.04,p.r*1.04,p.r*1.2,6)),mat('dark'));
        band.rotation.z=Math.PI/2;
        band.position.x=-tipLen/2-bodyLen/2+p.r*0.6;
        g.add(body,tip,lead,band);
        g.position.set(p.x,p.r*0.87,p.z);
        g.rotation.y=rot;
        group.add(g);
        return;
    }
    if (p.type==='eraser') {
        const g=new THREE.Group();
        const a=new THREE.Mesh(box(p.w*0.62,p.h,p.d),mat('light'));
        a.position.x=-p.w*0.19;
        const b=new THREE.Mesh(box(p.w*0.38,p.h*1.04,p.d*1.04),mat('cover'));
        b.position.x=p.w*0.31;
        g.add(a,b);
        g.position.set(p.x,p.h/2,p.z);
        g.rotation.y=rot;
        group.add(g);
        return;
    }
    if (p.type==='books') {
        const rng=new RNG(Math.round(p.x*31+p.z*17));
        const g=new THREE.Group();
        let y=0;
        const tones=['cover','light','dark','cover','light'];
        for (let i=0;i<p.count;i++) {
            const h=rng.range(0.6,1.1);
            const w=p.w*rng.range(0.85,1.05);
            const d=p.d*rng.range(0.85,1.05);
            const m=new THREE.Mesh(box(+w.toFixed(2),+h.toFixed(2),+d.toFixed(2)),mat(tones[i%tones.length]));
            m.position.set(rng.range(-0.3,0.3),y+h/2,rng.range(-0.3,0.3));
            m.rotation.y=rng.range(-0.25,0.25);
            g.add(m);
            y+=h;
        }
        g.position.set(p.x,0,p.z);
        g.rotation.y=rot;
        group.add(g);
        return;
    }
    if (p.type==='crumple') {
        const m=new THREE.Mesh(crumpleGeo(p.r,Math.round(p.x*13+p.z*7)),mat('light'));
        m.position.set(p.x,p.r*0.7,p.z);
        m.rotation.set(0.4,p.x,0.2);
        group.add(m);
    }
}

let pieceId=0;

function smoothPath(pts) {
    if (pts.length<3) {
        return pts.slice();
    }
    let out=pts;
    for (let it=0;it<2;it++) {
        const n=[out[0]];
        for (let i=0;i<out.length-1;i++) {
            const a=out[i];
            const b=out[i+1];
            n.push({x:a.x*0.75+b.x*0.25,z:a.z*0.75+b.z*0.25});
            n.push({x:a.x*0.25+b.x*0.75,z:a.z*0.25+b.z*0.75});
        }
        n.push(out[out.length-1]);
        out=n;
    }
    return out;
}

function resamplePath(pts,step) {
    const out=[pts[0]];
    let carry=0;
    for (let i=1;i<pts.length;i++) {
        const a=pts[i-1];
        const b=pts[i];
        const l=Math.hypot(b.x-a.x,b.z-a.z);
        let d=step-carry;
        while (d<=l) {
            const f=d/l;
            out.push({x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f});
            d+=step;
        }
        carry=l-(d-step);
    }
    const last=pts[pts.length-1];
    const pl=out[out.length-1];
    if (Math.hypot(last.x-pl.x,last.z-pl.z)>step*0.3) {
        out.push({x:last.x,z:last.z});
    }
    return out;
}

function wallGeometry(pts,thick,height,seed) {
    const n=pts.length;
    const dist=[0];
    for (let i=1;i<n;i++) {
        dist.push(dist[i-1]+Math.hypot(pts[i].x-pts[i-1].x,pts[i].z-pts[i-1].z));
    }
    const L=dist[n-1]||1;
    const pos=[];
    const nor=[];
    const rev=[];
    const idx=[];
    const hw=thick/2;
    const L2=[];
    const R2=[];
    const H=[];
    const T=[];
    for (let i=0;i<n;i++) {
        const a=pts[Math.max(0,i-1)];
        const b=pts[Math.min(n-1,i+1)];
        let tx=b.x-a.x;
        let tz=b.z-a.z;
        const tl=Math.hypot(tx,tz)||1;
        tx/=tl;
        tz/=tl;
        const nx=-tz;
        const nz=tx;
        L2.push([pts[i].x+nx*hw,pts[i].z+nz*hw,nx,nz]);
        R2.push([pts[i].x-nx*hw,pts[i].z-nz*hw,-nx,-nz]);
        H.push(height*(0.92+hash1(seed+i*13)*0.16));
        T.push([tx,tz]);
    }
    function quadStrip(side,flip) {
        const base=pos.length/3;
        for (let i=0;i<n;i++) {
            const p=side[i];
            pos.push(p[0],0,p[1],p[0],H[i],p[1]);
            nor.push(p[2],0,p[3],p[2],0,p[3]);
            rev.push(dist[i]/L,dist[i]/L);
        }
        for (let i=0;i<n-1;i++) {
            const v=base+i*2;
            if (flip) {
                idx.push(v,v+1,v+2,v+1,v+3,v+2);
            }
            else {
                idx.push(v,v+2,v+1,v+1,v+2,v+3);
            }
        }
    }
    quadStrip(L2,false);
    quadStrip(R2,true);
    const baseT=pos.length/3;
    for (let i=0;i<n;i++) {
        pos.push(L2[i][0],H[i],L2[i][1],R2[i][0],H[i],R2[i][1]);
        nor.push(0,1,0,0,1,0);
        rev.push(dist[i]/L,dist[i]/L);
    }
    for (let i=0;i<n-1;i++) {
        const v=baseT+i*2;
        idx.push(v,v+2,v+1,v+1,v+2,v+3);
    }
    for (const [i,s] of [[0,-1],[n-1,1]]) {
        const b=pos.length/3;
        const l=L2[i];
        const r=R2[i];
        const t=T[i];
        pos.push(l[0],0,l[1],l[0],H[i],l[1],r[0],0,r[1],r[0],H[i],r[1]);
        for (let k=0;k<4;k++) {
            nor.push(t[0]*s,0,t[1]*s);
            rev.push(dist[i]/L);
        }
        if (s<0) {
            idx.push(b,b+1,b+2,b+1,b+3,b+2);
        }
        else {
            idx.push(b,b+2,b+1,b+1,b+2,b+3);
        }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
    g.setAttribute('aReveal',new THREE.Float32BufferAttribute(rev,1));
    g.setIndex(idx);
    g.computeBoundingSphere();
    return {geometry:g,length:L};
}

function pencilTool() {
    const g=new THREE.Group();
    const body=new THREE.Mesh(cachedGeo('toolBody',()=>new THREE.CylinderGeometry(0.09,0.09,0.9,6)),mat('cover'));
    body.position.y=0.55;
    const tip=new THREE.Mesh(cachedGeo('toolTip',()=>new THREE.ConeGeometry(0.09,0.22,6)),mat('dark'));
    tip.rotation.x=Math.PI;
    tip.position.y=0.02;
    g.add(body,tip);
    g.rotation.z=0.5;
    return g;
}

class Zones {
    constructor(fxScene,room) {
        this.fxScene=fxScene;
        this.room=room;
        this.list=[];
        this.planeGeo=new THREE.PlaneGeometry(2,2);
        this.planeGeo.rotateX(-Math.PI/2);
    }

    addSlow(x,z,r,duration,slow) {
        const m=new THREE.Mesh(this.planeGeo,trapMaterial('ink'));
        m.position.set(x,0.05,z);
        m.scale.set(r,1,r);
        m.frustumCulled=false;
        this.fxScene.add(m);
        this.list.push({type:'slow',x,z,r,slow,t:0,life:duration,mesh:m});
    }

    addTrail(player,dps,duration) {
        const geo=new THREE.BufferGeometry();
        const cap=40;
        const posAttr=new THREE.BufferAttribute(new Float32Array(cap*2*3),3);
        posAttr.setUsage(THREE.DynamicDrawUsage);
        const uv=new Float32Array(cap*2*2);
        const idx=[];
        for (let i=0;i<cap;i++) {
            uv[i*4]=i/(cap-1);
            uv[i*4+1]=0;
            uv[i*4+2]=i/(cap-1);
            uv[i*4+3]=1;
            if (i<cap-1) {
                const v=i*2;
                idx.push(v,v+1,v+2,v+1,v+3,v+2);
            }
        }
        geo.setAttribute('position',posAttr);
        geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
        geo.setIndex(idx);
        geo.setDrawRange(0,0);
        const m=new THREE.Mesh(geo,inkMaterial('ink'));
        m.frustumCulled=false;
        this.fxScene.add(m);
        const z={type:'trail',player,dps,t:0,life:duration,pts:[{x:player.pos.x,z:player.pos.z}],cap,mesh:m,posAttr,recording:true,tick:0,radius:0.7};
        this.list.push(z);
        return z;
    }

    rebuildTrail(z) {
        const a=z.posAttr.array;
        const pts=z.pts;
        const n=pts.length;
        const w=0.55;
        let L=0;
        for (let i=0;i<n;i++) {
            const p=pts[i];
            const q=pts[Math.min(n-1,i+1)];
            const o=pts[Math.max(0,i-1)];
            let tx=q.x-o.x;
            let tz=q.z-o.z;
            const tl=Math.hypot(tx,tz)||1;
            tx/=tl;
            tz/=tl;
            const f=0.55+0.45*Math.sin(Math.PI*Math.min(1,(i+0.5)/n));
            a[i*6]=p.x-tz*w*f;
            a[i*6+1]=0.05;
            a[i*6+2]=p.z+tx*w*f;
            a[i*6+3]=p.x+tz*w*f;
            a[i*6+4]=0.05;
            a[i*6+5]=p.z-tx*w*f;
            if (i>0) {
                L+=Math.hypot(p.x-pts[i-1].x,p.z-pts[i-1].z);
            }
        }
        z.posAttr.needsUpdate=true;
        z.mesh.geometry.setDrawRange(0,Math.max(0,n-1)*6);
        z.mesh.material.uniforms.uLength.value=L;
    }

    addPuddle(x,z,r,duration,slow) {
        this.list.push({type:'puddle',x,z,r,slow,t:0,life:duration,mesh:null});
    }

    playerSlowAt(x,z) {
        let m=1;
        for (const zn of this.list) {
            if (zn.type==='puddle'&&zn.t<zn.life) {
                const dx=x-zn.x;
                const dz=z-zn.z;
                if (dx*dx+dz*dz<zn.r*zn.r) {
                    m=Math.min(m,zn.slow);
                }
            }
        }
        return m;
    }

    clear() {
        for (const zn of this.list) {
            if (zn.mesh) {
                this.fxScene.remove(zn.mesh);
                if (zn.type==='trail') {
                    zn.mesh.geometry.dispose();
                }
                zn.mesh.material.dispose();
            }
        }
        this.list.length=0;
    }

    slowAt(x,z) {
        let m=1;
        for (const zn of this.list) {
            if (zn.type==='slow'&&zn.t<zn.life) {
                const dx=x-zn.x;
                const dz=z-zn.z;
                if (dx*dx+dz*dz<zn.r*zn.r) {
                    m=Math.min(m,zn.slow);
                }
            }
        }
        return m;
    }

    trailHit(zn,x,z,r) {
        const pts=zn.pts;
        const rr=(zn.radius+r)*(zn.radius+r);
        for (let i=0;i<pts.length-1;i++) {
            const a=pts[i];
            const b=pts[i+1];
            const sx=b.x-a.x;
            const sz=b.z-a.z;
            const l2=sx*sx+sz*sz||1;
            let t=((x-a.x)*sx+(z-a.z)*sz)/l2;
            t=Math.max(0,Math.min(1,t));
            const dx=x-(a.x+sx*t);
            const dz=z-(a.z+sz*t);
            if (dx*dx+dz*dz<rr) {
                return true;
            }
        }
        return false;
    }

    update(dt,enemies) {
        for (let i=this.list.length-1;i>=0;i--) {
            const zn=this.list[i];
            zn.t+=dt;
            if (zn.type==='slow') {
                const u=zn.mesh.material.uniforms;
                u.uProgress.value=EASE.easeOutCubic(Math.min(1,zn.t/0.45));
                u.uAlpha.value=Math.min(1,(zn.life-zn.t)/0.5);
            }
            else if (zn.type==='trail') {
                const p=zn.player;
                if (zn.recording) {
                    const last=zn.pts[zn.pts.length-1];
                    if (Math.hypot(p.pos.x-last.x,p.pos.z-last.z)>0.3&&zn.pts.length<zn.cap) {
                        zn.pts.push({x:p.pos.x,z:p.pos.z});
                        this.rebuildTrail(zn);
                    }
                    if (p.dashT<=0) {
                        zn.recording=false;
                    }
                }
                zn.mesh.material.uniforms.uAlpha.value=Math.min(1,(zn.life-zn.t)/0.8);
                zn.tick-=dt;
                if (zn.tick<=0&&enemies) {
                    zn.tick=0.25;
                    for (const e of enemies.list.slice()) {
                        if (e.state!=='spawn'&&this.trailHit(zn,e.pos.x,e.pos.z,e.def.radius)) {
                            enemies.damage(e,zn.dps*0.25,0,0,true);
                        }
                    }
                }
            }
            if (zn.t>=zn.life) {
                if (zn.mesh) {
                    this.fxScene.remove(zn.mesh);
                    if (zn.type==='trail') {
                        zn.mesh.geometry.dispose();
                    }
                    zn.mesh.material.dispose();
                }
                this.list.splice(i,1);
            }
        }
    }
}

function buildInteractive(type,x,z,group) {
    if (type==='barrel') {
        const g=new THREE.Group();
        const body=new THREE.Mesh(cachedGeo('barrel',()=>new THREE.CylinderGeometry(0.55,0.6,1.3,10)),mat('dark'));
        body.position.y=0.65;
        const band=new THREE.Mesh(cachedGeo('barrelBand',()=>new THREE.CylinderGeometry(0.62,0.62,0.4,10)),mat('light'));
        band.position.y=0.7;
        const cap=new THREE.Mesh(cachedGeo('barrelCap',()=>new THREE.CylinderGeometry(0.3,0.3,0.2,8)),mat('dark'));
        cap.position.y=1.38;
        g.add(body,band,cap);
        g.position.set(x,0,z);
        group.add(g);
        return {object:g,cols:[makeCircle(x,z,0.62)],radius:0.62,hp:TUNING.props.barrelHp};
    }
    const g=new THREE.Group();
    const rot=hash1(Math.round(x*13+z*7))*1.5;
    const box1=new THREE.Mesh(box(1.2,1.0,1.2),mat('light'));
    box1.position.y=0.5;
    const strap=new THREE.Mesh(box(1.24,1.04,0.22),mat('cover'));
    strap.position.y=0.5;
    g.add(box1,strap);
    g.position.set(x,0,z);
    g.rotation.y=rot;
    group.add(g);
    return {object:g,cols:[makeBox(x,z,0.6,0.6,rot)],radius:0.85,hp:TUNING.props.crateHp};
}

export class Room {
    constructor(def,parent,fxScene,opts={}) {
        this.def=def;
        this.parent=parent;
        this.group=new THREE.Group();
        this.group.name='room';
        this.colliders=[];
        this.pieces=[];
        this.effects=[];
        this.shards=null;
        this.onBreak=null;
        const hw=def.size[0]/2;
        const hd=def.size[1]/2;
        this.bounds={minX:-hw,maxX:hw,minZ:-hd,maxZ:hd};
        this.spawn=new THREE.Vector3(def.spawn[0],0,def.spawn[1]);
        this.zones=new Zones(fxScene,this);
        const ground=new THREE.Mesh(cachedGeo('ground',()=>new THREE.PlaneGeometry(400,400)),toonMaterial({...TONES.ground,grid:[hw,hd]}));
        ground.rotation.x=-Math.PI/2;
        this.group.add(ground);
        const t=def.wallThickness;
        const h=def.wallHeight;
        const walls=[
            [0,-hd-t/2,def.size[0]+t*2,t],
            [0,hd+t/2,def.size[0]+t*2,t],
            [-hw-t/2,0,t,def.size[1]],
            [hw+t/2,0,t,def.size[1]]
        ];
        for (const w of walls) {
            const m=new THREE.Mesh(box(w[2],h,w[3]),mat('cover'));
            m.position.set(w[0],h/2,w[1]);
            this.group.add(m);
            this.addPiece('border',m,[makeBox(w[0],w[1],w[2]/2,w[3]/2,0)],{x:w[0],z:w[1],radius:0,erasable:false});
        }
        for (const p of def.props) {
            const cols=[];
            const res=buildProp(p,this.group,cols);
            if (res&&cols.length>0) {
                this.addPiece('prop',res.object,cols,{x:p.x,z:p.z,radius:res.radius,erasable:p.erasable!==false});
            }
        }
        if (opts.rng) {
            this.placeInteractive(opts.rng,opts.barrels||0,opts.crates||0);
        }
        parent.add(this.group);
    }

    freeSpot(rng) {
        const b=this.bounds;
        const tmp={x:0,z:0,depth:0};
        for (let tries=0;tries<40;tries++) {
            const x=rng.range(b.minX+2,b.maxX-2);
            const z=rng.range(b.minZ+2,b.maxZ-2);
            if (Math.hypot(x-this.spawn.x,z-this.spawn.z)<3.5) {
                continue;
            }
            let ok=true;
            for (const c of this.colliders) {
                if (circleVs(x,z,1.6,c,tmp)) {
                    ok=false;
                    break;
                }
            }
            for (const sp of this.def.spawnPoints||[]) {
                if (Math.hypot(sp[0]-x,sp[1]-z)<2.2) {
                    ok=false;
                }
            }
            if (ok) {
                return {x,z};
            }
        }
        return null;
    }

    placeInteractive(rng,barrels,crates) {
        const list=[];
        for (let i=0;i<barrels;i++) {
            list.push('barrel');
        }
        for (let i=0;i<crates;i++) {
            list.push('crate');
        }
        for (const type of list) {
            const p=this.freeSpot(rng);
            if (!p) {
                continue;
            }
            const res=buildInteractive(type,p.x,p.z,this.group);
            const piece=this.addPiece(type,res.object,res.cols,{x:p.x,z:p.z,radius:res.radius,erasable:true,hp:res.hp});
            piece.flash=0;
        }
    }

    damageProps(x,z,r,dmg) {
        for (const p of this.pieces.slice()) {
            if ((p.kind==='barrel'||p.kind==='crate')&&p.state==='alive'&&Math.hypot(p.x-x,p.z-z)<r+p.radius) {
                this.damagePiece(p,dmg);
            }
        }
    }

    destroy() {
        for (const p of this.pieces.slice()) {
            if (p.kind==='pencilWall') {
                this.removePiece(p);
            }
        }
        this.zones.clear();
        if (this.group.parent) {
            this.group.parent.remove(this.group);
        }
        this.pieces.length=0;
        this.colliders.length=0;
    }

    addPiece(kind,object,colliders,o) {
        const piece={id:++pieceId,kind,object,colliders,x:o.x,z:o.z,radius:o.radius,erasable:o.erasable,hp:o.hp||0,maxHp:o.hp||0,state:'alive',t:0,mats:o.mats||null,length:o.length||0};
        for (const c of colliders) {
            c.piece=piece;
            c.passPlayer=!!o.passPlayer;
        }
        this.pieces.push(piece);
        this.rebuildColliders();
        return piece;
    }

    rebuildColliders() {
        this.colliders.length=0;
        for (const p of this.pieces) {
            if (p.state==='erasing'&&p.t>0.3) {
                continue;
            }
            for (const c of p.colliders) {
                this.colliders.push(c);
            }
        }
    }

    removePiece(piece) {
        const i=this.pieces.indexOf(piece);
        if (i>=0) {
            this.pieces.splice(i,1);
        }
        if (piece.object.parent) {
            piece.object.parent.remove(piece.object);
        }
        if (piece.kind==='pencilWall') {
            piece.object.geometry.dispose();
            piece.object.material.dispose();
        }
        if (piece.tool&&piece.tool.parent) {
            piece.tool.parent.remove(piece.tool);
        }
        this.rebuildColliders();
    }

    nearestErasable(x,z,r) {
        let best=null;
        let bd=Infinity;
        for (const p of this.pieces) {
            if (!p.erasable||p.state!=='alive') {
                continue;
            }
            const d=Math.hypot(p.x-x,p.z-z)-p.radius;
            if (d<r&&d<bd) {
                bd=d;
                best=p;
            }
        }
        return best;
    }

    erasePiece(piece,fromX,fromZ,duration=0.8) {
        if (piece.state!=='alive'&&piece.state!=='growing') {
            return false;
        }
        let dx=piece.x-fromX;
        let dz=piece.z-fromZ;
        const l=Math.hypot(dx,dz)||1;
        dx/=l;
        dz/=l;
        const c=piece.x*dx+piece.z*dz;
        const ext=Math.max(piece.radius,piece.length*0.5,1);
        const mats=[];
        piece.object.traverse(o=>{
            if (o.isMesh&&o.material&&o.material.userData.opts) {
                const dm=dissolveVariant(o.material);
                dm.uniforms.uSwipe.value.set(dx,dz,c-ext,c+ext);
                if (o.material.defines&&o.material.defines.USE_REVEAL!==undefined) {
                    dm.dispose();
                    return;
                }
                o.material=dm;
                mats.push(dm);
            }
        });
        if (piece.kind==='pencilWall') {
            const wm=piece.object.material;
            wm.defines.USE_DISSOLVE='';
            wm.uniforms.uDissolve={value:0};
            wm.uniforms.uSwipe={value:new THREE.Vector4(dx,dz,c-ext,c+ext)};
            wm.uniforms.uEdgeColor={value:pal('paper').clone()};
            wm.needsUpdate=true;
            mats.push(wm);
        }
        piece.dissolveMats=mats;
        piece.state='erasing';
        piece.t=0;
        piece.duration=duration;
        return true;
    }

    addPencilWall(points,params) {
        const W=TUNING.terrain;
        let pts=resamplePath(smoothPath(points),0.35);
        if (pts.length<2) {
            return null;
        }
        const {geometry,length}=wallGeometry(pts,W.wallThickness,params.height||W.wallHeight,pieceId*97);
        const m=toonMaterial({...TONES.cover,reveal:true,unique:true,jitter:TUNING.boil.vertexJitter*0.6});
        m.uniforms.uReveal.value=0;
        m.uniforms.uLen.value=length;
        const mesh=new THREE.Mesh(geometry,m);
        this.group.add(mesh);
        const cols=[];
        for (let i=0;i<pts.length-1;i++) {
            cols.push({type:'segment',ax:pts[i].x,az:pts[i].z,bx:pts[i+1].x,bz:pts[i+1].z,r:W.wallThickness/2});
        }
        let cx=0;
        let cz=0;
        for (const p of pts) {
            cx+=p.x;
            cz+=p.z;
        }
        cx/=pts.length;
        cz/=pts.length;
        const piece=this.addPiece('pencilWall',mesh,cols,{x:cx,z:cz,radius:0.5,erasable:true,hp:params.hp,passPlayer:true,length});
        piece.pts=pts;
        piece.state='growing';
        piece.t=0;
        piece.tool=pencilTool();
        this.group.add(piece.tool);
        const walls=this.pieces.filter(p=>p.kind==='pencilWall'&&p.state!=='erasing');
        if (walls.length>W.maxWalls) {
            this.erasePiece(walls[0],walls[0].x+1,walls[0].z,0.5);
        }
        return piece;
    }

    damagePiece(piece,dmg) {
        if ((piece.kind==='barrel'||piece.kind==='crate')&&piece.state==='alive') {
            piece.hp-=dmg;
            piece.object.scale.set(1.12,0.9,1.12);
            piece.flash=0.12;
            if (piece.hp<=0) {
                piece.state='broken';
                if (this.shards) {
                    this.shards.burst(piece.x,0.7,piece.z,piece.kind==='crate'?6:4,0,0,0.9);
                }
                if (this.onPropBreak) {
                    this.onPropBreak(piece);
                }
                this.removePiece(piece);
            }
            return;
        }
        if (piece.kind!=='pencilWall'||piece.state==='erasing') {
            return;
        }
        piece.hp-=dmg;
        piece.object.material.uniforms.uCrack.value=Math.min(1,1-piece.hp/piece.maxHp+0.15);
        if (piece.hp<=0) {
            this.breakPiece(piece);
        }
    }

    breakPiece(piece) {
        if (this.shards) {
            const pts=piece.pts||[{x:piece.x,z:piece.z}];
            const step=Math.max(1,Math.floor(pts.length/6));
            for (let i=0;i<pts.length;i+=step) {
                this.shards.burst(pts[i].x,0.7,pts[i].z,2,0,0,0.9);
            }
        }
        if (this.onBreak) {
            this.onBreak(piece);
        }
        this.removePiece(piece);
    }

    update(dt,enemies) {
        let dirty=false;
        for (let i=this.pieces.length-1;i>=0;i--) {
            const p=this.pieces[i];
            if (p.flash!==undefined&&p.flash>0) {
                p.flash-=dt;
                const k=Math.max(0,p.flash/0.12);
                p.object.scale.set(1+0.12*k,1-0.1*k,1+0.12*k);
            }
            if (p.state==='growing') {
                p.t+=dt;
                const k=Math.min(1,p.t/TUNING.terrain.growTime);
                const r=EASE.easeOutQuad(k);
                p.object.material.uniforms.uReveal.value=k>=1?1:r;
                if (p.tool) {
                    const pts=p.pts;
                    const fi=Math.min(pts.length-1,Math.floor(r*(pts.length-1)));
                    const q=pts[fi];
                    p.tool.position.set(q.x,TUNING.terrain.wallHeight*0.95,q.z);
                    p.tool.rotation.y=r*8;
                }
                if (k>=1) {
                    p.state='alive';
                    if (p.tool) {
                        this.group.remove(p.tool);
                        p.tool=null;
                    }
                }
            }
            else if (p.state==='erasing') {
                const before=p.t;
                p.t+=dt;
                const k=Math.min(1,p.t/p.duration);
                for (const m of p.dissolveMats) {
                    m.uniforms.uDissolve.value=EASE.easeInOutQuad(k);
                }
                if (before<=0.3&&p.t>0.3) {
                    dirty=true;
                }
                if (k>=1) {
                    for (const m of p.dissolveMats) {
                        if (m!==p.object.material||p.kind!=='pencilWall') {
                            m.dispose();
                        }
                    }
                    this.removePiece(p);
                    dirty=false;
                }
            }
        }
        if (dirty) {
            this.rebuildColliders();
        }
        this.zones.update(dt,enemies);
    }
}

export function buildRoom(def,parent,fxScene,opts) {
    return new Room(def,parent,fxScene,opts);
}
