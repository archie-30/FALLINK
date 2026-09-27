import*as THREE from 'three';
import {toonMaterial} from '../render/materials.js';
import {makeBox,makeCircle} from '../core/collision.js';
import {RNG,hash1} from '../core/rng.js';

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
        return;
    }
    if (p.type==='pillar') {
        const g=cachedGeo('pillar|'+p.r+'|'+p.h,()=>new THREE.CylinderGeometry(p.r,p.r*1.08,p.h,9));
        const m=new THREE.Mesh(g,mat('cover'));
        m.position.set(p.x,p.h/2,p.z);
        group.add(m);
        const cap=new THREE.Mesh(box(p.r*2.3,0.3,p.r*2.3),mat('cover'));
        cap.position.set(p.x,p.h+0.15,p.z);
        cap.rotation.y=0.4;
        group.add(cap);
        colliders.push(makeCircle(p.x,p.z,p.r*1.08));
        return;
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

export function buildRoom(def,parent) {
    const group=new THREE.Group();
    group.name='room';
    const colliders=[];
    const hw=def.size[0]/2;
    const hd=def.size[1]/2;
    const ground=new THREE.Mesh(cachedGeo('ground',()=>new THREE.PlaneGeometry(400,400)),toonMaterial({...TONES.ground,grid:[hw,hd]}));
    ground.rotation.x=-Math.PI/2;
    group.add(ground);
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
        group.add(m);
        colliders.push(makeBox(w[0],w[1],w[2]/2,w[3]/2,0));
    }
    for (const p of def.props) {
        buildProp(p,group,colliders);
    }
    parent.add(group);
    return {
        def,
        group,
        colliders,
        bounds:{minX:-hw,maxX:hw,minZ:-hd,maxZ:hd},
        spawn:new THREE.Vector3(def.spawn[0],0,def.spawn[1])
    };
}
