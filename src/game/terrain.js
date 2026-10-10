import*as THREE from 'three';
import {toonMaterial,dissolveVariant,trapMaterial,inkMaterial,countdownMaterial,unlitMaterial,pal,setArenaClip} from '../render/materials.js';
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
        colliders.push(makeBox(p.x,p.z,p.w/2+TUNING.props.booksPad,p.d/2+TUNING.props.booksPad,rot));
        return {object:g,radius:Math.hypot(p.w,p.d)/2};
    }
    if (p.type==='crumple') {
        const m=new THREE.Mesh(crumpleGeo(p.r,Math.round(p.x*13+p.z*7)),mat('light'));
        m.position.set(p.x,p.r*0.7,p.z);
        m.rotation.set(0.4,p.x,0.2);
        group.add(m);
        colliders.push(makeCircle(p.x,p.z,p.r*TUNING.props.crumpleR));
        return {object:m,radius:p.r};
    }
    const deco=DECOR_BUILDERS[p.type];
    if (deco) {
        const g=deco(p);
        g.position.set(p.x,p.y||0,p.z);
        g.rotation.y=rot;
        group.add(g);
        if (p.solid) {
            colliders.push(makeBox(p.x,p.z,p.solid[0]/2,p.solid[1]/2,rot));
            return {object:g,radius:Math.hypot(p.solid[0],p.solid[1])/2};
        }
    }
}

function mesh(geo,tone) {
    return new THREE.Mesh(geo,mat(tone));
}

const DECOR_BUILDERS={
    mug(p) {
        const g=new THREE.Group();
        const r=p.r;
        const h=p.h;
        const cup=mesh(cachedGeo('mug|'+r+'|'+h,()=>new THREE.CylinderGeometry(r,r*0.88,h,12,1,true)),'light');
        cup.material=toonMaterial({...TONES.light,side:THREE.DoubleSide});
        cup.position.y=h/2;
        const base=mesh(cachedGeo('mugb|'+r,()=>new THREE.CylinderGeometry(r*0.88,r*0.88,0.2,12)),'light');
        base.position.y=0.1;
        const coffee=mesh(cachedGeo('mugc|'+r,()=>new THREE.CircleGeometry(r*0.94,12)),'dark');
        coffee.rotation.x=-Math.PI/2;
        coffee.position.y=h*0.82;
        const handle=mesh(cachedGeo('mugh|'+r+'|'+h,()=>new THREE.TorusGeometry(h*0.26,r*0.11,6,10,Math.PI*1.2)),'light');
        handle.position.set(r*1.02,h*0.52,0);
        handle.rotation.z=-Math.PI*0.6;
        const band=mesh(cachedGeo('mugr|'+r+'|'+h,()=>new THREE.CylinderGeometry(r*1.01,r*0.97,h*0.16,12,1,true)),'dark');
        band.position.y=h*0.6;
        g.add(cup,base,coffee,handle,band);
        return g;
    },
    ruler(p) {
        const g=new THREE.Group();
        const body=mesh(box(p.len,0.36,p.w),'cover');
        body.position.y=0.18;
        g.add(body);
        const n=Math.floor(p.len/0.5);
        const tick=box(0.06,0.04,1);
        for (let i=1;i<n;i++) {
            const m=mesh(tick,'dark');
            const long=i%2===0;
            m.scale.z=p.w*(long?0.42:0.24);
            m.position.set(-p.len/2+i*0.5,0.37,-p.w/2+m.scale.z/2);
            g.add(m);
        }
        return g;
    },
    pin(p) {
        const g=new THREE.Group();
        const head=mesh(cachedGeo('pinh|'+p.r,()=>new THREE.CylinderGeometry(p.r,p.r*1.1,p.r*0.9,10)),'dark');
        head.position.y=p.r*2.1;
        const neck=mesh(cachedGeo('pinn|'+p.r,()=>new THREE.CylinderGeometry(p.r*0.45,p.r*0.7,p.r*1.2,8)),'cover');
        neck.position.y=p.r*1.2;
        const needle=mesh(cachedGeo('pinp|'+p.r,()=>new THREE.CylinderGeometry(p.r*0.08,p.r*0.08,p.r*0.8,5)),'dark');
        needle.position.y=p.r*0.4;
        g.add(head,neck,needle);
        g.rotation.z=p.tilt||0;
        return g;
    },
    notes(p) {
        const g=new THREE.Group();
        const rng=new RNG(Math.round(p.x*11+p.z*5));
        for (let i=0;i<p.count;i++) {
            const m=mesh(box(p.s,0.06,p.s),i%2?'light':'cover');
            m.position.set(rng.range(-0.15,0.15),0.03+i*0.06,rng.range(-0.15,0.15));
            m.rotation.y=rng.range(-0.3,0.3);
            g.add(m);
        }
        const curl=mesh(box(p.s,0.05,p.s*0.35),'light');
        curl.position.set(0,p.count*0.06+0.12,-p.s*0.36);
        curl.rotation.x=0.5;
        g.add(curl);
        return g;
    },
    sheet(p) {
        const g=new THREE.Group();
        const paper=mesh(box(p.w,0.12,p.d),'cover');
        paper.position.y=0.06;
        g.add(paper);
        const line=box(1,0.02,0.05);
        for (let z=-p.d/2+0.6;z<p.d/2-0.2;z+=0.55) {
            const m=mesh(line,'dark');
            m.scale.x=p.w*0.86;
            m.position.set(0.05,0.13,z);
            g.add(m);
        }
        return g;
    },
    clip(p) {
        const g=new THREE.Group();
        const r=p.r;
        const L=p.len;
        const pts=[[0,0],[L,0],[L,r*2],[-r*0.6,r*2],[-r*0.6,r*0.4],[L*0.8,r*0.4],[L*0.8,r*1.6],[r*0.3,r*1.6]];
        const curve=new THREE.CurvePath();
        for (let i=0;i<pts.length-1;i++) {
            curve.add(new THREE.LineCurve3(new THREE.Vector3(pts[i][0],0,pts[i][1]),new THREE.Vector3(pts[i+1][0],0,pts[i+1][1])));
        }
        const tube=mesh(cachedGeo('clip|'+r+'|'+L,()=>new THREE.TubeGeometry(curve,48,r*0.16,5,false)),'cover');
        tube.position.set(-L/2,r*0.16,-r);
        g.add(tube);
        return g;
    },
    lamp(p) {
        const g=new THREE.Group();
        const s=p.s;
        const base=mesh(cachedGeo('lampb|'+s,()=>new THREE.CylinderGeometry(s*0.9,s,s*0.3,12)),'dark');
        base.position.y=s*0.15;
        const arm1=mesh(box(s*0.22,s*2.6,s*0.22),'cover');
        arm1.position.set(0,s*1.5,0);
        arm1.rotation.z=-0.35;
        const joint=mesh(cachedGeo('lampj|'+s,()=>new THREE.SphereGeometry(s*0.22,8,6)),'dark');
        joint.position.set(s*0.43,s*2.72,0);
        const arm2=mesh(box(s*2.2,s*0.2,s*0.2),'cover');
        arm2.position.set(s*1.4,s*3.0,0);
        arm2.rotation.z=0.3;
        const shade=mesh(cachedGeo('lamps|'+s,()=>new THREE.ConeGeometry(s*0.8,s*1.1,12,1,true)),'dark');
        shade.material=toonMaterial({...TONES.dark,side:THREE.DoubleSide});
        shade.position.set(s*2.5,s*2.85,0);
        shade.rotation.z=0.35;
        g.add(base,arm1,joint,arm2,shade);
        return g;
    },
    sharpener(p) {
        const g=new THREE.Group();
        const s=p.s;
        const body=mesh(box(s*1.6,s,s),'cover');
        body.position.y=s/2;
        const hole=mesh(cachedGeo('sharph|'+s,()=>new THREE.CylinderGeometry(s*0.28,s*0.28,0.1,10)),'dark');
        hole.rotation.z=Math.PI/2;
        hole.position.set(s*0.81,s*0.55,0);
        const blade=mesh(box(s*1.2,0.06,s*0.5),'dark');
        blade.position.set(0,s+0.03,-s*0.1);
        g.add(body,hole,blade);
        return g;
    },
    shelf(p) {
        const g=new THREE.Group();
        const rng=new RNG(Math.round(p.x*19+p.z*23));
        const w=p.w;
        const h=p.h;
        const d=p.d;
        const t=0.22;
        for (const sx of [-1,1]) {
            const side=mesh(box(t,h,d),'dark');
            side.position.set(sx*(w/2-t/2),h/2,0);
            g.add(side);
        }
        const top=mesh(box(w+0.4,t*1.4,d+0.3),'dark');
        top.position.y=h+t*0.7;
        const back=mesh(box(w,h,0.1),'cover');
        back.position.set(0,h/2,-d/2+0.05);
        g.add(top,back);
        const rows=Math.max(2,Math.floor(h/1.15));
        const rh=h/rows;
        const tones=['cover','light','dark','cover','light','dark'];
        for (let r=0;r<rows;r++) {
            const y=r*rh;
            const plank=mesh(box(w-t*2,0.12,d),'dark');
            plank.position.y=y+0.06;
            g.add(plank);
            let x=-w/2+t+0.05;
            let lean=0;
            while (x<w/2-t-0.3) {
                const bw=+rng.range(0.16,0.34).toFixed(2);
                const bh=+(rh*rng.range(0.58,0.88)).toFixed(2);
                if (rng.next()<0.08) {
                    x+=0.4;
                    lean=0.35;
                    continue;
                }
                const b=mesh(box(bw,bh,+(d*0.8).toFixed(2)),tones[Math.floor(rng.next()*tones.length)]);
                b.position.set(x+bw/2,y+0.12+bh/2,0.04);
                b.rotation.z=lean;
                if (lean) {
                    b.position.x+=0.12;
                    b.position.y-=0.05;
                }
                lean=0;
                g.add(b);
                x+=bw+0.02;
            }
        }
        return g;
    },
    tome(p) {
        const g=new THREE.Group();
        const s=p.s;
        for (const sx of [-1,1]) {
            const half=new THREE.Group();
            const cover=mesh(box(s*1.6,s*0.12,s*2.2),'dark');
            cover.position.set(sx*s*0.8,0,0);
            const pages=mesh(box(s*1.5,s*0.22,s*2.05),'light');
            pages.position.set(sx*s*0.78,s*0.15,0);
            half.add(cover,pages);
            for (let i=0;i<5;i++) {
                const ln=mesh(box(s*1.05,0.02,s*0.05),'cover');
                ln.position.set(sx*s*0.8,s*0.27,-s*0.7+i*s*0.32);
                half.add(ln);
            }
            half.rotation.z=-sx*0.12;
            half.position.y=s*0.12;
            g.add(half);
        }
        const spine=mesh(cachedGeo('tomes|'+s,()=>new THREE.CylinderGeometry(s*0.14,s*0.14,s*2.2,8)),'dark');
        spine.rotation.x=Math.PI/2;
        spine.position.y=s*0.06;
        const mark=new THREE.Mesh(box(s*0.16,0.03,s*1.2),unlitMaterial({color:'red'}));
        mark.position.set(s*0.2,s*0.36,s*0.9);
        mark.rotation.y=0.15;
        g.add(spine,mark);
        return g;
    },
    candle(p) {
        const g=new THREE.Group();
        const r=p.r||0.2;
        const h=p.h||0.8;
        const dish=mesh(cachedGeo('cdish|'+r,()=>new THREE.CylinderGeometry(r*2,r*2.2,r*0.4,10)),'dark');
        dish.position.y=r*0.2;
        const wax=mesh(cachedGeo('cwax|'+r+'|'+h,()=>new THREE.CylinderGeometry(r,r*1.05,h,8)),'light');
        wax.position.y=r*0.4+h/2;
        const drip=mesh(cachedGeo('cdrip|'+r,()=>new THREE.SphereGeometry(r*0.35,6,5)),'light');
        drip.position.set(r*0.9,r*0.4+h*0.7,0);
        drip.scale.set(0.7,1.6,0.7);
        const flame=new THREE.Mesh(cachedGeo('cflame|'+r,()=>new THREE.ConeGeometry(r*0.55,r*1.8,8)),unlitMaterial({color:'red'}));
        flame.position.y=r*0.4+h+r*0.95;
        const wick=mesh(box(0.03,r*0.4,0.03),'dark');
        wick.position.y=r*0.4+h+r*0.15;
        g.add(dish,wax,drip,wick,flame);
        return g;
    },
    runes(p) {
        const g=new THREE.Group();
        const r=p.r;
        const red=unlitMaterial({color:'red'});
        for (const [k,w] of [[1,0.1],[0.82,0.06]]) {
            const ring=new THREE.Mesh(cachedGeo('rring|'+r*k+'|'+w,()=>new THREE.RingGeometry(r*k-w,r*k,48)),k===1?red:toonMaterial({...TONES.dark,side:THREE.DoubleSide}));
            ring.rotation.x=-Math.PI/2;
            ring.position.y=0.03;
            g.add(ring);
        }
        const n=p.count||9;
        for (let i=0;i<n;i++) {
            const a=i/n*Math.PI*2;
            const m=mesh(box(0.34,0.03,0.08),'dark');
            m.position.set(Math.cos(a)*r*0.91,0.04,Math.sin(a)*r*0.91);
            m.rotation.y=-a+(i%2?0.8:-0.5);
            const m2=mesh(box(0.08,0.03,0.24),'dark');
            m2.position.set(Math.cos(a+0.12)*r*0.91,0.04,Math.sin(a+0.12)*r*0.91);
            g.add(m,m2);
        }
        return g;
    },
    arch(p) {
        const g=new THREE.Group();
        const w=p.w;
        const h=p.h;
        for (const sx of [-1,1]) {
            const col=mesh(cachedGeo('archc|'+h,()=>new THREE.CylinderGeometry(0.5,0.6,h,8)),'cover');
            col.position.set(sx*w/2,h/2,0);
            const base=mesh(box(1.5,0.5,1.5),'dark');
            base.position.set(sx*w/2,0.25,0);
            g.add(col,base);
        }
        const top=mesh(cachedGeo('archt|'+w,()=>new THREE.TorusGeometry(w/2,0.5,6,16,Math.PI)),'cover');
        top.position.y=h;
        const key=new THREE.Mesh(box(0.6,0.9,0.7),unlitMaterial({color:'red'}));
        key.position.y=h+w/2;
        g.add(top,key);
        return g;
    },
    shavings(p) {
        const g=new THREE.Group();
        const rng=new RNG(Math.round(p.x*7+p.z*3));
        const geo=cachedGeo('shave',()=>new THREE.CylinderGeometry(0.02,0.5,0.1,10,1,true));
        for (let i=0;i<p.count;i++) {
            const m=mesh(geo,i%2?'light':'cover');
            m.material=toonMaterial({...(i%2?TONES.light:TONES.cover),side:THREE.DoubleSide});
            m.position.set(rng.range(-1,1),0.06,rng.range(-0.8,0.8));
            m.rotation.set(rng.range(-0.3,0.3),rng.range(0,6),rng.range(-0.3,0.3));
            m.scale.setScalar(rng.range(0.7,1.2));
            g.add(m);
        }
        return g;
    }
};

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

    countdown(x,z,r,color) {
        const m=new THREE.Mesh(this.planeGeo,countdownMaterial(color));
        m.position.set(x,0.06,z);
        m.scale.set(r,1,r);
        m.frustumCulled=false;
        m.material.uniforms.uR.value=r;
        m.renderOrder=3;
        this.fxScene.add(m);
        return m;
    }

    addSlow(x,z,r,duration,slow) {
        const m=new THREE.Mesh(this.planeGeo,trapMaterial('ink'));
        m.position.set(x,0.05,z);
        m.scale.set(r,1,r);
        m.frustumCulled=false;
        this.fxScene.add(m);
        this.list.push({type:'slow',x,z,r,slow,t:0,life:duration,mesh:m,cd:this.countdown(x,z,r,'ink')});
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

    addPrint(x,z,r,duration,fade,slow) {
        const m=new THREE.Mesh(this.planeGeo,trapMaterial('ink'));
        m.position.set(x,0.04,z);
        m.scale.set(r,1,r);
        m.frustumCulled=false;
        this.fxScene.add(m);
        this.list.push({type:'puddle',x,z,r,slow,t:0,life:duration,fade,mesh:m,cd:this.countdown(x,z,r,'ink')});
    }

    fadeOf(zn) {
        return zn.fade?Math.max(0,Math.min(1,(zn.life-zn.t)/zn.fade)):1;
    }

    playerSlowAt(x,z) {
        let m=1;
        for (const zn of this.list) {
            if (zn.type==='puddle'&&zn.t<zn.life) {
                const dx=x-zn.x;
                const dz=z-zn.z;
                if (dx*dx+dz*dz<zn.r*zn.r) {
                    m=Math.min(m,1-(1-zn.slow)*this.fadeOf(zn));
                }
            }
        }
        return m;
    }

    clear() {
        for (const zn of this.list) {
            this.dropCd(zn);
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

    dropCd(zn) {
        if (zn.cd) {
            this.fxScene.remove(zn.cd);
            zn.cd.material.dispose();
            zn.cd=null;
        }
    }

    update(dt,enemies) {
        for (let i=this.list.length-1;i>=0;i--) {
            const zn=this.list[i];
            zn.t+=dt;
            if (zn.cd) {
                const u=zn.cd.material.uniforms;
                u.uFrac.value=Math.max(0,1-zn.t/zn.life);
                u.uAlpha.value=Math.min(1,zn.t/0.3,(zn.life-zn.t)/0.3);
            }
            if (zn.type==='puddle'&&zn.mesh) {
                const u=zn.mesh.material.uniforms;
                u.uProgress.value=EASE.easeOutCubic(Math.min(1,zn.t/0.3));
                u.uAlpha.value=this.fadeOf(zn);
            }
            else if (zn.type==='slow') {
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
                this.dropCd(zn);
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
    if (type==='target') {
        const g=new THREE.Group();
        const post=new THREE.Mesh(cachedGeo('tpost',()=>new THREE.CylinderGeometry(0.06,0.08,1.1,6)),mat('dark'));
        post.position.y=0.55;
        g.add(post);
        const rings=[[0.55,'light'],[0.4,'red'],[0.24,'light'],[0.1,'dark']];
        rings.forEach(([r,tone],i)=>{
            const m=new THREE.Mesh(cachedGeo('tdisc|'+r,()=>new THREE.CylinderGeometry(r,r,0.06,18)),tone==='red'?toonMaterial({light:'red',mid:'red',dark:'darkRed'}):mat(tone));
            m.rotation.x=Math.PI/2;
            m.position.set(0,1.25,0.03+i*0.012);
            g.add(m);
        });
        g.position.set(x,0,z);
        group.add(g);
        return {object:g,cols:[makeCircle(x,z,0.5)],radius:0.6,hp:1};
    }
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
        setArenaClip(this.bounds);
        this.spawn=new THREE.Vector3(def.spawn[0],0,def.spawn[1]);
        this.zones=new Zones(fxScene,this);
        const ground=new THREE.Mesh(cachedGeo('ground',()=>new THREE.PlaneGeometry(400,400)),toonMaterial({...TONES.ground,grid:[hw,hd]}));
        ground.rotation.x=-Math.PI/2;
        this.group.add(ground);
        const t=def.wallThickness;
        const h=def.wallHeight;
        const walls=[
            [0,hd+t/2,def.size[0]+t*2,t],
            [-hw-t/2,0,t,def.size[1]],
            [hw+t/2,0,t,def.size[1]]
        ];
        const gaps=(opts.gaps||[]).slice().sort((a,b)=>a.x-b.x);
        let from=-hw-t;
        for (const g of gaps.concat([{x:hw+t,w:0}])) {
            const to=g.x-g.w/2;
            if (to-from>0.01) {
                walls.push([(from+to)/2,-hd-t/2,to-from,t]);
            }
            from=g.x+g.w/2;
        }
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

    addTarget(x,z) {
        const res=buildInteractive('target',x,z,this.group);
        const piece=this.addPiece('target',res.object,res.cols,{x,z,radius:res.radius,erasable:false,hp:res.hp});
        piece.flash=0;
        return piece;
    }

    damageProps(x,z,r,dmg) {
        for (const p of this.pieces.slice()) {
            if ((p.kind==='barrel'||p.kind==='crate'||p.kind==='target')&&p.state==='alive'&&Math.hypot(p.x-x,p.z-z)<r+p.radius) {
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
                if (!o.userData.orig) {
                    o.userData.orig=o.material;
                }
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
        const piece=this.addPiece('pencilWall',mesh,cols,{x:cx,z:cz,radius:0.5,erasable:true,hp:1,passPlayer:true,length});
        piece.pts=pts;
        piece.life=params.duration;
        piece.maxLife=params.duration;
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
        if ((piece.kind==='barrel'||piece.kind==='crate'||piece.kind==='target')&&piece.state==='alive') {
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
            if (p.kind==='pencilWall'&&p.state!=='erasing'&&p.maxLife>0) {
                p.life-=dt;
                p.object.material.uniforms.uCrack.value=Math.max(0,Math.min(1,1-p.life/p.maxLife));
                if (p.life<=0) {
                    this.erasePiece(p,p.x+1,p.z,TUNING.terrain.wallFade);
                    continue;
                }
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
