import*as THREE from 'three';
import {RNG} from '../core/rng.js';

function periodic(rng,terms) {
    const k=[];
    for (let i=0;i<terms;i++) {
        k.push({f:i+1,a:rng.range(0.3,1)/(i+1),p:rng.range(0,Math.PI*2)});
    }
    return t=>{
        let v=0;
        for (const q of k) {
            v+=Math.sin(t*Math.PI*2*q.f+q.p)*q.a;
        }
        return v;
    };
}

function drawChannel(size,count,dirX,dirY,rng) {
    const canvas=document.createElement('canvas');
    canvas.width=size;
    canvas.height=size;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle='#000';
    ctx.fillRect(0,0,size,size);
    ctx.strokeStyle='#fff';
    ctx.lineCap='round';
    const px=-dirY;
    const py=dirX;
    const len=Math.hypot(dirX,dirY)*size;
    const ux=dirX/Math.hypot(dirX,dirY);
    const uy=dirY/Math.hypot(dirX,dirY);
    const spacing=size/count;
    const segs=48;
    for (let i=0;i<count;i++) {
        const wob=periodic(rng,3);
        const wid=periodic(rng,4);
        const gap=periodic(rng,5);
        const off=(i+rng.range(-0.18,0.18))*spacing;
        const sx=dirY===0?0:off;
        const sy=dirY===0?off:0;
        const amp=spacing*0.12;
        const pts=[];
        for (let s=0;s<=segs;s++) {
            const t=s/segs;
            const w=wob(t)*amp;
            pts.push([sx+ux*len*t+px*w/Math.hypot(px,py),sy+uy*len*t+py*w/Math.hypot(px,py),t]);
        }
        for (let ox=-size;ox<=size;ox+=size) {
            for (let oy=-size;oy<=size;oy+=size) {
                for (let s=0;s<segs;s++) {
                    const a=pts[s];
                    const b=pts[s+1];
                    const tm=(a[2]+b[2])*0.5;
                    if (gap(tm)>1.15) {
                        continue;
                    }
                    ctx.lineWidth=Math.max(0.6,spacing*0.2+wid(tm)*spacing*0.07);
                    ctx.beginPath();
                    ctx.moveTo(a[0]+ox,a[1]+oy);
                    ctx.lineTo(b[0]+ox,b[1]+oy);
                    ctx.stroke();
                }
            }
        }
    }
    return ctx.getImageData(0,0,size,size).data;
}

export function createHatchTexture(size=256,seed=99) {
    const rng=new RNG(seed);
    const r=drawChannel(size,14,1,1,rng);
    const g=drawChannel(size,14,1,-1,rng);
    const b=drawChannel(size,18,1,0,rng);
    const canvas=document.createElement('canvas');
    canvas.width=size;
    canvas.height=size;
    const ctx=canvas.getContext('2d');
    const img=ctx.createImageData(size,size);
    const d=img.data;
    for (let i=0;i<size*size*4;i+=4) {
        d[i]=r[i];
        d[i+1]=g[i];
        d[i+2]=b[i];
        d[i+3]=255;
    }
    ctx.putImageData(img,0,0);
    const tex=new THREE.CanvasTexture(canvas);
    tex.colorSpace=THREE.NoColorSpace;
    tex.wrapS=THREE.RepeatWrapping;
    tex.wrapT=THREE.RepeatWrapping;
    tex.generateMipmaps=true;
    tex.minFilter=THREE.LinearMipmapLinearFilter;
    tex.magFilter=THREE.LinearFilter;
    tex.needsUpdate=true;
    return tex;
}
