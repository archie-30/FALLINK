import*as THREE from 'three';
import {RNG} from '../core/rng.js';

function latticeNoise(size,period,rng) {
    const g=new Float32Array(period*period);
    for (let i=0;i<g.length;i++) {
        g[i]=rng.next();
    }
    const out=new Float32Array(size*size);
    const s=period/size;
    for (let y=0;y<size;y++) {
        const fy=y*s;
        const iy=Math.floor(fy);
        let ty=fy-iy;
        ty=ty*ty*(3-2*ty);
        const y0=(iy%period)*period;
        const y1=((iy+1)%period)*period;
        for (let x=0;x<size;x++) {
            const fx=x*s;
            const ix=Math.floor(fx);
            let tx=fx-ix;
            tx=tx*tx*(3-2*tx);
            const x0=ix%period;
            const x1=(ix+1)%period;
            const a=g[y0+x0]+(g[y0+x1]-g[y0+x0])*tx;
            const b=g[y1+x0]+(g[y1+x1]-g[y1+x0])*tx;
            out[y*size+x]=a+(b-a)*ty;
        }
    }
    return out;
}

function fbm(size,periods,weights,rng) {
    const out=new Float32Array(size*size);
    let wsum=0;
    for (let o=0;o<periods.length;o++) {
        const n=latticeNoise(size,periods[o],rng);
        const w=weights[o];
        wsum+=w;
        for (let i=0;i<out.length;i++) {
            out[i]+=n[i]*w;
        }
    }
    for (let i=0;i<out.length;i++) {
        out[i]/=wsum;
    }
    return out;
}

function toTexture(canvas,repeat=true,mip=false) {
    const tex=new THREE.CanvasTexture(canvas);
    tex.colorSpace=THREE.NoColorSpace;
    if (repeat) {
        tex.wrapS=THREE.RepeatWrapping;
        tex.wrapT=THREE.RepeatWrapping;
    }
    tex.generateMipmaps=mip;
    tex.minFilter=mip?THREE.LinearMipmapLinearFilter:THREE.LinearFilter;
    tex.magFilter=THREE.LinearFilter;
    tex.needsUpdate=true;
    return tex;
}

export function createPaperTexture(size=512,seed=7) {
    const rng=new RNG(seed);
    const base=fbm(size,[8,32,64,128],[0.35,0.3,0.2,0.15],rng);
    const canvas=document.createElement('canvas');
    canvas.width=size;
    canvas.height=size;
    const ctx=canvas.getContext('2d');
    const img=ctx.createImageData(size,size);
    const d=img.data;
    for (let i=0;i<size*size;i++) {
        const speck=rng.next();
        let v=0.9+(base[i]-0.5)*0.22+(speck-0.5)*0.07;
        if (speck>0.997) {
            v-=0.12;
        }
        const c=Math.max(0,Math.min(255,Math.round(v*255)));
        d[i*4]=c;
        d[i*4+1]=c;
        d[i*4+2]=c;
        d[i*4+3]=255;
    }
    ctx.putImageData(img,0,0);
    ctx.lineCap='round';
    for (let f=0;f<220;f++) {
        const x=rng.next()*size;
        const y=rng.next()*size;
        const a=rng.next()*Math.PI*2;
        const len=4+rng.next()*18;
        const bend=(rng.next()-0.5)*0.8;
        const dark=rng.next()<0.5;
        ctx.strokeStyle=dark?'rgba(0,0,0,'+(0.04+rng.next()*0.05)+')':'rgba(255,255,255,'+(0.08+rng.next()*0.1)+')';
        ctx.lineWidth=0.6+rng.next()*0.8;
        for (let ox=-size;ox<=size;ox+=size) {
            for (let oy=-size;oy<=size;oy+=size) {
                ctx.beginPath();
                ctx.moveTo(x+ox,y+oy);
                ctx.quadraticCurveTo(x+ox+Math.cos(a+bend)*len*0.5,y+oy+Math.sin(a+bend)*len*0.5,x+ox+Math.cos(a)*len,y+oy+Math.sin(a)*len);
                ctx.stroke();
            }
        }
    }
    return toTexture(canvas,true,false);
}

export function createNoiseTexture(size=256,seed=13) {
    const rng=new RNG(seed);
    const r=fbm(size,[4,8,16],[0.55,0.3,0.15],rng);
    const g=fbm(size,[4,8,16],[0.55,0.3,0.15],rng);
    const b=fbm(size,[16,32],[0.6,0.4],rng);
    const canvas=document.createElement('canvas');
    canvas.width=size;
    canvas.height=size;
    const ctx=canvas.getContext('2d');
    const img=ctx.createImageData(size,size);
    const d=img.data;
    for (let i=0;i<size*size;i++) {
        d[i*4]=Math.round(r[i]*255);
        d[i*4+1]=Math.round(g[i]*255);
        d[i*4+2]=Math.round(b[i]*255);
        d[i*4+3]=255;
    }
    ctx.putImageData(img,0,0);
    return toTexture(canvas,true,false);
}
