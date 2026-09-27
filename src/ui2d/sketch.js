import {RNG} from '../core/rng.js';
import {time} from '../core/loop.js';
import {TUNING} from '../data/tuning.js';

const VARIANTS=TUNING.boil.variants;
const MAX_CACHE=4000;
const cache=new Map();

function hashStr(s) {
    let h=2166136261;
    for (let i=0;i<s.length;i++) {
        h^=s.charCodeAt(i);
        h=Math.imul(h,16777619);
    }
    return h>>>0;
}

function smoothNoise(rng,n=8) {
    const v=[];
    for (let i=0;i<=n;i++) {
        v.push(rng.next()*2-1);
    }
    return t=>{
        const x=Math.max(0,Math.min(0.9999,t))*n;
        const i=Math.floor(x);
        let f=x-i;
        f=f*f*(3-2*f);
        return v[i]+(v[i+1]-v[i])*f;
    };
}

function defaults(o) {
    return {
        width:o.width??2,
        jitter:o.jitter??1.2,
        overshoot:o.overshoot??3,
        seed:o.seed??1,
        taper:o.taper??0.35,
        pressure:o.pressure??0.3
    };
}

function resample(points) {
    const out=[];
    let total=0;
    const lens=[0];
    for (let i=1;i<points.length;i++) {
        total+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);
        lens.push(total);
    }
    const n=Math.max(4,Math.ceil(total/5));
    let seg=1;
    for (let k=0;k<=n;k++) {
        const d=total*k/n;
        while (seg<lens.length-1&&lens[seg]<d) {
            seg++;
        }
        const l0=lens[seg-1];
        const l1=lens[seg];
        const f=l1>l0?(d-l0)/(l1-l0):0;
        const a=points[seg-1];
        const b=points[seg];
        out.push([a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
    }
    return {pts:out,total};
}

function strokeInto(path,points,o,rng,closedLoop) {
    if (points.length<2) {
        return;
    }
    const pts=points.slice();
    if (!closedLoop&&o.overshoot>0) {
        const a=pts[0];
        const b=pts[1];
        const la=Math.hypot(b[0]-a[0],b[1]-a[1])||1;
        const oa=o.overshoot*rng.range(0.2,1.2);
        pts[0]=[a[0]-(b[0]-a[0])/la*oa,a[1]-(b[1]-a[1])/la*oa];
        const c=pts[pts.length-1];
        const d=pts[pts.length-2];
        const lc=Math.hypot(c[0]-d[0],c[1]-d[1])||1;
        const oc=o.overshoot*rng.range(0.2,1.2);
        pts[pts.length-1]=[c[0]+(c[0]-d[0])/lc*oc,c[1]+(c[1]-d[1])/lc*oc];
    }
    const {pts:s,total}=resample(pts);
    const jn=smoothNoise(rng,Math.max(3,Math.min(12,Math.round(total/40))));
    const wn=smoothNoise(rng,5);
    const left=[];
    const right=[];
    const n=s.length;
    for (let i=0;i<n;i++) {
        const t=i/(n-1);
        const p=s[i];
        const q0=s[Math.max(0,i-1)];
        const q1=s[Math.min(n-1,i+1)];
        let tx=q1[0]-q0[0];
        let ty=q1[1]-q0[1];
        const tl=Math.hypot(tx,ty)||1;
        tx/=tl;
        ty/=tl;
        const nx=-ty;
        const ny=tx;
        const j=jn(t)*o.jitter;
        const end=Math.min(1,t/0.12,(1-t)/0.18);
        const press=o.taper+(1-o.taper)*Math.sqrt(Math.max(0,end));
        const w=o.width*0.5*press*(1+wn(t)*o.pressure);
        const cx=p[0]+nx*j;
        const cy=p[1]+ny*j;
        left.push([cx+nx*w,cy+ny*w]);
        right.push([cx-nx*w,cy-ny*w]);
    }
    path.moveTo(left[0][0],left[0][1]);
    for (let i=1;i<n;i++) {
        path.lineTo(left[i][0],left[i][1]);
    }
    for (let i=n-1;i>=0;i--) {
        path.lineTo(right[i][0],right[i][1]);
    }
    path.closePath();
}

function build(key,o,fn) {
    const k=key+'|'+o.width+'|'+o.jitter+'|'+o.overshoot+'|'+o.seed+'|'+o.taper;
    const hit=cache.get(k);
    if (hit) {
        return hit;
    }
    const base=hashStr(k);
    const shape={variants:[]};
    for (let v=0;v<VARIANTS;v++) {
        const path=new Path2D();
        fn(path,new RNG(base+v*7919+o.seed*104729));
        shape.variants.push(path);
    }
    if (cache.size>MAX_CACHE) {
        let i=0;
        for (const key2 of cache.keys()) {
            cache.delete(key2);
            if (++i>800) {
                break;
            }
        }
    }
    cache.set(k,shape);
    return shape;
}

function r1(v) {
    return Math.round(v*2)/2;
}

export function sketchLine(x1,y1,x2,y2,opts={}) {
    const o=defaults(opts);
    return build('L|'+r1(x1)+','+r1(y1)+','+r1(x2)+','+r1(y2),o,(path,rng)=>{
        strokeInto(path,[[x1,y1],[x2,y2]],o,rng,false);
    });
}

export function sketchPath(points,opts={}) {
    const o=defaults(opts);
    let key='P|';
    for (const p of points) {
        key+=r1(p[0])+','+r1(p[1])+';';
    }
    return build(key,o,(path,rng)=>{
        strokeInto(path,points,o,rng,false);
    });
}

export function sketchPolygon(points,opts={}) {
    const o=defaults(opts);
    let key='G|';
    for (const p of points) {
        key+=r1(p[0])+','+r1(p[1])+';';
    }
    return build(key,o,(path,rng)=>{
        for (let i=0;i<points.length;i++) {
            const a=points[i];
            const b=points[(i+1)%points.length];
            strokeInto(path,[a,b],o,rng,false);
        }
    });
}

export function sketchRect(x,y,w,h,opts={}) {
    return sketchPolygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],opts);
}

export function sketchCircle(cx,cy,r,opts={}) {
    const o=defaults(opts);
    return build('C|'+r1(cx)+','+r1(cy)+','+r1(r),o,(path,rng)=>{
        const a0=rng.range(0,Math.PI*2);
        const sweep=Math.PI*2*(1+rng.range(-0.05,0.09));
        const ex=1+rng.range(-0.04,0.04);
        const rn=smoothNoise(rng,6);
        const n=Math.max(16,Math.ceil(r*sweep/4));
        const pts=[];
        for (let i=0;i<=n;i++) {
            const t=i/n;
            const a=a0+sweep*t;
            const rr=r*(1+rn(t)*0.035)+(t-0.5)*o.jitter*0.8;
            pts.push([cx+Math.cos(a)*rr*ex,cy+Math.sin(a)*rr/ex]);
        }
        strokeInto(path,pts,{...o,jitter:o.jitter*0.4,overshoot:0},rng,true);
    });
}

function hatchSegments(poly,angle,spacing) {
    const c=Math.cos(-angle);
    const s=Math.sin(-angle);
    const rp=poly.map(p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c]);
    let minY=Infinity;
    let maxY=-Infinity;
    for (const p of rp) {
        minY=Math.min(minY,p[1]);
        maxY=Math.max(maxY,p[1]);
    }
    const segs=[];
    const ic=Math.cos(angle);
    const is=Math.sin(angle);
    for (let y=minY+spacing*0.5;y<maxY;y+=spacing) {
        const xs=[];
        for (let i=0;i<rp.length;i++) {
            const a=rp[i];
            const b=rp[(i+1)%rp.length];
            if ((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y)) {
                xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));
            }
        }
        xs.sort((p,q)=>p-q);
        for (let k=0;k+1<xs.length;k+=2) {
            segs.push([[xs[k]*ic-y*is,xs[k]*is+y*ic],[xs[k+1]*ic-y*is,xs[k+1]*is+y*ic]]);
        }
    }
    return segs;
}

export function hatchFill(poly,opts={}) {
    const o=defaults({width:1.2,jitter:0.6,overshoot:1.5,taper:0.5,...opts});
    const angle=opts.angle??-0.8;
    const spacing=opts.spacing??6;
    const cross=!!opts.cross;
    let key='H|'+angle+'|'+spacing+'|'+cross+'|';
    for (const p of poly) {
        key+=r1(p[0])+','+r1(p[1])+';';
    }
    return build(key,o,(path,rng)=>{
        const sets=[hatchSegments(poly,angle,spacing)];
        if (cross) {
            sets.push(hatchSegments(poly,angle+Math.PI/2,spacing*1.2));
        }
        for (const segs of sets) {
            for (const sg of segs) {
                strokeInto(path,sg,o,rng,false);
            }
        }
    });
}

export function rectPoly(x,y,w,h) {
    return [[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
}

export function drawShape(ctx,shape,color,variant=time.boilIndex) {
    ctx.fillStyle=color;
    ctx.fill(shape.variants[variant%shape.variants.length]);
}
