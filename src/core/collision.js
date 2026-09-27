const tmp={x:0,z:0,depth:0};

export function makeBox(x,z,hx,hz,rot) {
    return {type:'box',x,z,hx,hz,rot,c:Math.cos(rot),s:Math.sin(rot),r:Math.hypot(hx,hz)};
}

export function makeCircle(x,z,r) {
    return {type:'circle',x,z,r};
}

export function circleCircle(ax,az,ar,bx,bz,br,out=tmp) {
    const dx=ax-bx;
    const dz=az-bz;
    const rr=ar+br;
    const d2=dx*dx+dz*dz;
    if (d2>=rr*rr) {
        return false;
    }
    const d=Math.sqrt(d2);
    if (d>1e-6) {
        out.x=dx/d;
        out.z=dz/d;
    }
    else {
        out.x=1;
        out.z=0;
    }
    out.depth=rr-d;
    return true;
}

export function circleBox(cx,cz,r,b,out=tmp) {
    const dx=cx-b.x;
    const dz=cz-b.z;
    if (dx*dx+dz*dz>(b.r+r)*(b.r+r)) {
        return false;
    }
    const lx=dx*b.c-dz*b.s;
    const lz=dx*b.s+dz*b.c;
    let nx=0;
    let nz=0;
    let depth=0;
    if (Math.abs(lx)<=b.hx&&Math.abs(lz)<=b.hz) {
        const px=b.hx-Math.abs(lx);
        const pz=b.hz-Math.abs(lz);
        if (px<pz) {
            nx=lx<0?-1:1;
            depth=px+r;
        }
        else {
            nz=lz<0?-1:1;
            depth=pz+r;
        }
    }
    else {
        const qx=Math.max(-b.hx,Math.min(b.hx,lx));
        const qz=Math.max(-b.hz,Math.min(b.hz,lz));
        const ex=lx-qx;
        const ez=lz-qz;
        const d2=ex*ex+ez*ez;
        if (d2>=r*r) {
            return false;
        }
        const d=Math.sqrt(d2);
        nx=ex/d;
        nz=ez/d;
        depth=r-d;
    }
    out.x=b.c*nx+b.s*nz;
    out.z=-b.s*nx+b.c*nz;
    out.depth=depth;
    return true;
}

export function circleSegment(cx,cz,r,ax,az,bx,bz,out=tmp) {
    const sx=bx-ax;
    const sz=bz-az;
    const l2=sx*sx+sz*sz;
    let t=l2>0?((cx-ax)*sx+(cz-az)*sz)/l2:0;
    t=Math.max(0,Math.min(1,t));
    const px=ax+sx*t;
    const pz=az+sz*t;
    return circleCircle(cx,cz,r,px,pz,0,out);
}

export function circleVs(cx,cz,r,col,out=tmp) {
    if (col.type==='box') {
        return circleBox(cx,cz,r,col,out);
    }
    if (col.type==='circle') {
        return circleCircle(cx,cz,r,col.x,col.z,col.r,out);
    }
    if (col.type==='segment') {
        return circleSegment(cx,cz,r+col.r,col.ax,col.az,col.bx,col.bz,out);
    }
    return false;
}

export function resolveCircle(pos,r,colliders,iterations=2) {
    let hit=false;
    for (let it=0;it<iterations;it++) {
        let any=false;
        for (let i=0;i<colliders.length;i++) {
            if (circleVs(pos.x,pos.z,r,colliders[i],tmp)) {
                pos.x+=tmp.x*tmp.depth;
                pos.z+=tmp.z*tmp.depth;
                any=true;
            }
        }
        if (!any) {
            break;
        }
        hit=true;
    }
    return hit;
}

export function clampToBounds(pos,r,b) {
    pos.x=Math.max(b.minX+r,Math.min(b.maxX-r,pos.x));
    pos.z=Math.max(b.minZ+r,Math.min(b.maxZ-r,pos.z));
}
