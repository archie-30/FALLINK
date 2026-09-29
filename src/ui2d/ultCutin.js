import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {EASE} from '../core/easing.js';
import {hash1} from '../core/rng.js';
import {time} from '../core/loop.js';
import {settings} from '../core/settings.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

function seg(k,a,b) {
    return Math.max(0,Math.min(1,(k-a)/(b-a)));
}

function jit(i,seed) {
    return hash1(i*97+seed*13+time.boilIndex*131)-0.5;
}

function line(ctx,x1,y1,x2,y2,wd,color,seed,amp=3) {
    const mx=(x1+x2)/2+jit(1,seed)*amp*2;
    const my=(y1+y2)/2+jit(2,seed)*amp*2;
    ctx.strokeStyle=color;
    ctx.lineWidth=wd;
    ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(x1+jit(3,seed)*amp,y1+jit(4,seed)*amp);
    ctx.quadraticCurveTo(mx,my,x2+jit(5,seed)*amp,y2+jit(6,seed)*amp);
    ctx.stroke();
}

function brush(ctx,x0,y0,x1,y1,p,W,color,seed) {
    if (p<=0) {
        return;
    }
    const n=18;
    const dx=x1-x0;
    const dy=y1-y0;
    const l=Math.hypot(dx,dy)||1;
    const nx=-dy/l;
    const ny=dx/l;
    const top=[];
    const bot=[];
    for (let i=0;i<=n;i++) {
        const f=i/n*p;
        const wd=W*Math.pow(Math.sin(Math.PI*Math.min(1,f*1.05)),0.55)*(0.85+jit(i,seed)*0.3);
        const cx=x0+dx*f;
        const cy=y0+dy*f;
        top.push([cx+nx*wd/2,cy+ny*wd/2]);
        bot.push([cx-nx*wd/2,cy-ny*wd/2]);
    }
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(top[0][0],top[0][1]);
    for (const q of top) {
        ctx.lineTo(q[0],q[1]);
    }
    for (let i=bot.length-1;i>=0;i--) {
        ctx.lineTo(bot[i][0],bot[i][1]);
    }
    ctx.closePath();
    ctx.fill();
}

function ring(ctx,cx,cy,r,wd,color,seed,from=0,to=Math.PI*2) {
    const n=28;
    ctx.strokeStyle=color;
    ctx.lineWidth=wd;
    ctx.lineCap='round';
    ctx.beginPath();
    for (let i=0;i<=n;i++) {
        const a=from+(to-from)*i/n;
        const rr=r*(1+jit(i%n,seed)*0.05);
        const x=cx+Math.cos(a)*rr;
        const y=cy+Math.sin(a)*rr;
        if (i===0) {
            ctx.moveTo(x,y);
        }
        else {
            ctx.lineTo(x,y);
        }
    }
    ctx.stroke();
}

function dot(ctx,x,y,r,color) {
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.arc(x,y,Math.max(0.1,r),0,Math.PI*2);
    ctx.fill();
}

function splat(ctx,x,y,r,k,color,seed) {
    if (k<=0) {
        return;
    }
    const e=EASE.easeOutCubic(Math.min(1,k));
    dot(ctx,x,y,r*e,color);
    for (let i=0;i<9;i++) {
        const a=hash1(seed+i)*Math.PI*2;
        const d=r*(1.2+hash1(seed+i*7)*1.6)*e;
        dot(ctx,x+Math.cos(a)*d,y+Math.sin(a)*d,r*(0.12+hash1(seed+i*3)*0.2)*e,color);
    }
}

const MOTIFS={
    execute:{
        back(ctx,w,h,k,cy) {
            const f=seg(k,0.05,0.2);
            const g=seg(k,0.16,0.32);
            if (f>0&&f<0.6) {
                ctx.fillStyle=rgba('red',0.18*(1-f/0.6));
                ctx.fillRect(0,0,w,h);
            }
            brush(ctx,w*0.12,cy-h*0.36,w*0.88,cy+h*0.36,EASE.easeOutCubic(f),h*0.09,PALETTE.red,11);
            brush(ctx,w*0.86,cy-h*0.34,w*0.14,cy+h*0.38,EASE.easeOutCubic(g),h*0.08,PALETTE.darkRed,23);
            splat(ctx,w*0.5,cy,h*0.05,seg(k,0.3,0.45),PALETTE.red,41);
            splat(ctx,w*0.2,cy+h*0.28,h*0.025,seg(k,0.34,0.5),PALETTE.red,57);
            splat(ctx,w*0.8,cy-h*0.27,h*0.03,seg(k,0.38,0.52),PALETTE.darkRed,71);
        }
    },
    redraw:{
        back(ctx,w,h,k,cy) {
            const e=EASE.easeInOutCubic(seg(k,0.08,0.5));
            const ex=-w*0.1+e*w*1.2;
            ctx.save();
            ctx.beginPath();
            ctx.rect(ex,0,w,h);
            ctx.clip();
            for (let i=0;i<26;i++) {
                const y=cy-h*0.34+i*h*0.027;
                line(ctx,0,y+jit(i,3)*6,w,y-h*0.06+jit(i,4)*6,1.4,rgba('ink',0.45),200+i,4);
            }
            ctx.restore();
            ctx.save();
            ctx.translate(ex,cy);
            ctx.rotate(-0.12);
            ctx.fillStyle=PALETTE.paper;
            ctx.fillRect(-60,-h*0.22,120,h*0.44);
            ctx.fillStyle=PALETTE.midGray;
            ctx.fillRect(-60,-h*0.22,44,h*0.44);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=4;
            ctx.strokeRect(-60,-h*0.22,120,h*0.44);
            ctx.restore();
            for (let i=0;i<10;i++) {
                const q=seg(k,0.1+i*0.03,0.55+i*0.03);
                if (q>0&&q<1) {
                    dot(ctx,ex-40-q*140*hash1(i),cy+(hash1(i+9)-0.5)*h*0.4+q*40,3+hash1(i+3)*4,rgba('midGray',1-q));
                }
            }
            const r=seg(k,0.45,0.75);
            if (r>0) {
                const rad=Math.min(w,h)*0.3;
                const a0=-Math.PI*0.4;
                const a1=a0+EASE.easeOutCubic(r)*Math.PI*1.7;
                ring(ctx,w/2,cy,rad,9,PALETTE.ink,301,a0,a1);
                const hx=w/2+Math.cos(a1)*rad;
                const hy=cy+Math.sin(a1)*rad;
                ctx.save();
                ctx.translate(hx,hy);
                ctx.rotate(a1+Math.PI/2);
                ctx.fillStyle=PALETTE.ink;
                ctx.beginPath();
                ctx.moveTo(22,0);
                ctx.lineTo(-14,-16);
                ctx.lineTo(-14,16);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
                dot(ctx,w/2,cy,14*EASE.easeOutBack(r),PALETTE.red);
            }
        }
    },
    tsunami:{
        back(ctx,w,h,k,cy) {
            const e=EASE.easeInOutCubic(seg(k,0.02,0.72));
            const front=-w*0.25+e*w*1.45;
            const base=h*1.02;
            const H=h*0.62;
            const sway=Math.sin(time.real*5)*6;
            const surf=f=>base-H*Math.pow(f,1.8);
            ctx.fillStyle=PALETTE.ink;
            ctx.beginPath();
            ctx.moveTo(front-w*1.3,base);
            for (let i=0;i<=36;i++) {
                const f=i/36;
                ctx.lineTo(front-w*1.3+f*w*1.3,surf(f)+Math.sin(i*1.1+time.real*7)*6*(1-f));
            }
            const tx=front;
            const ty=surf(1);
            ctx.bezierCurveTo(tx+w*0.07,ty-h*0.08+sway,tx+w*0.17,ty+h*0.02,tx+w*0.12,ty+h*0.12);
            ctx.bezierCurveTo(tx+w*0.09,ty+h*0.06,tx+w*0.05,ty+h*0.05,tx+w*0.035,ty+h*0.1);
            ctx.bezierCurveTo(tx+w*0.07,ty+h*0.3,tx+w*0.16,ty+h*0.5,tx+w*0.3,base);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle=PALETTE.paper;
            ctx.lineWidth=3;
            ctx.lineCap='round';
            for (let r=0;r<3;r++) {
                ctx.beginPath();
                for (let i=0;i<=20;i++) {
                    const f=0.35+i/20*0.6;
                    const x=front-w*1.3+f*w*1.3;
                    const y=surf(f)+22+r*26+Math.sin(i*0.8+r+time.real*4)*5;
                    if (i===0) {
                        ctx.moveTo(x,y);
                    }
                    else {
                        ctx.lineTo(x,y);
                    }
                }
                ctx.stroke();
            }
            for (let i=0;i<18;i++) {
                const q=hash1(i+5);
                dot(ctx,tx+w*0.12*q,ty-h*0.02+hash1(i+30)*h*0.1,3+hash1(i+60)*5,PALETTE.paper);
            }
            for (let i=0;i<14;i++) {
                const q=seg(k,0.25+i*0.025,0.65+i*0.025);
                if (q>0&&q<1) {
                    dot(ctx,tx+w*0.1+q*w*0.22*hash1(i+80),ty-Math.sin(q*Math.PI)*h*0.16*hash1(i+90),4+hash1(i)*5,rgba('ink',1-q));
                }
            }
        }
    },
    blackHole:{
        back(ctx,w,h,k,cy) {
            const cx=w/2;
            const R=Math.hypot(w,h)*0.6;
            const spin=time.real*3;
            const pull=EASE.easeInCubic(seg(k,0.05,0.85));
            for (let arm=0;arm<5;arm++) {
                ctx.strokeStyle=arm%2?PALETTE.ink:PALETTE.nearGray;
                ctx.lineWidth=5-arm*0.5;
                ctx.lineCap='round';
                ctx.beginPath();
                for (let i=0;i<=60;i++) {
                    const f=i/60;
                    const r=R*(1-pull*0.7)*(1-f)+8;
                    const a=spin+arm*Math.PI*2/5+f*7.5;
                    const x=cx+Math.cos(a)*r;
                    const y=cy+Math.sin(a)*r*0.72;
                    if (i===0) {
                        ctx.moveTo(x,y);
                    }
                    else {
                        ctx.lineTo(x,y);
                    }
                }
                ctx.stroke();
            }
            for (let i=0;i<40;i++) {
                const q=(hash1(i)+k*1.6)%1;
                const r=R*0.5*(1-q);
                const a=hash1(i+50)*Math.PI*2+q*4;
                dot(ctx,cx+Math.cos(a)*r,cy+Math.sin(a)*r*0.72,2+3*(1-q),PALETTE.ink);
            }
            dot(ctx,cx,cy,Math.min(w,h)*0.08*EASE.easeOutBack(seg(k,0.1,0.4)),PALETTE.ink);
            ring(ctx,cx,cy,Math.min(w,h)*0.1*EASE.easeOutBack(seg(k,0.15,0.45)),4,PALETTE.red,401);
        }
    },
    barrage:{
        back(ctx,w,h,k,cy) {
            for (let i=0;i<42;i++) {
                const d=hash1(i+7)*0.45;
                const q=seg(k,0.04+d,0.3+d);
                if (q<=0||q>=1) {
                    continue;
                }
                const y=cy+(hash1(i+100)-0.5)*h*0.9;
                const x=-w*0.2+EASE.easeInCubic(q)*w*1.5;
                const len=w*(0.12+hash1(i+200)*0.12);
                line(ctx,x-len,y+len*0.12,x,y,3,rgba('ink',0.75),500+i,2);
                ctx.save();
                ctx.translate(x,y);
                ctx.rotate(-0.12);
                ctx.fillStyle=i%5===0?PALETTE.red:PALETTE.ink;
                ctx.beginPath();
                ctx.moveTo(16,0);
                ctx.lineTo(-4,-6);
                ctx.lineTo(-4,6);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
        }
    },
    giantPen:{
        back(ctx,w,h,k,cy) {
            const e=EASE.easeInOutCubic(seg(k,0.05,0.55));
            const x0=-w*0.05;
            const y0=cy-h*0.42;
            const x1=w*1.05;
            const y1=cy+h*0.36;
            brush(ctx,x0,y0,x1,y1,e,h*0.16,PALETTE.ink,601);
            const px=x0+(x1-x0)*e;
            const py=y0+(y1-y0)*e;
            ctx.save();
            ctx.translate(px,py);
            ctx.rotate(0.45+Math.sin(k*18)*0.05);
            const L=h*0.55;
            ctx.fillStyle=PALETTE.farGray;
            ctx.fillRect(-h*0.05,-L,h*0.1,L*0.8);
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillRect(-h*0.05,-L*0.25,h*0.1,L*0.07);
            ctx.fillStyle=PALETTE.ink;
            ctx.beginPath();
            ctx.moveTo(-h*0.05,-L*0.2);
            ctx.lineTo(h*0.05,-L*0.2);
            ctx.lineTo(0,0);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=3;
            ctx.strokeRect(-h*0.05,-L,h*0.1,L*0.8);
            ctx.restore();
            for (let i=0;i<8;i++) {
                const q=seg(k,0.1+i*0.05,0.45+i*0.05);
                splat(ctx,x0+(x1-x0)*(0.1+i*0.11),y0+(y1-y0)*(0.1+i*0.11)+(hash1(i)-0.5)*h*0.2,h*0.012,q,PALETTE.ink,700+i*9);
            }
        }
    },
    freezeAll:{
        back(ctx,w,h,k,cy) {
            const s=seg(k,0.05,0.2);
            ctx.fillStyle=rgba('paper',0.35*s);
            ctx.fillRect(0,0,w,h);
            const m=24+(1-EASE.easeOutBack(s))*80;
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=6;
            ctx.strokeRect(m,m,w-m*2,h-m*2);
            for (let i=0;i<4;i++) {
                const x=i<2?m:w-m;
                const y=i%2?h-m:m;
                const sx=i<2?1:-1;
                const sy=i%2?-1:1;
                line(ctx,x,y+sy*40,x,y,10,PALETTE.red,800+i,0);
                line(ctx,x,y,x+sx*40,y,10,PALETTE.red,810+i,0);
            }
            const c=seg(k,0.2,0.4);
            for (let i=0;i<9;i++) {
                const a=hash1(i+900)*Math.PI*2;
                let x=w/2;
                let y=cy;
                ctx.strokeStyle=PALETTE.ink;
                ctx.lineWidth=2.4;
                ctx.beginPath();
                ctx.moveTo(x,y);
                const len=Math.hypot(w,h)*0.5*c;
                for (let j=1;j<=6;j++) {
                    const f=j/6;
                    x=w/2+Math.cos(a+(hash1(i*9+j)-0.5)*0.5)*len*f;
                    y=cy+Math.sin(a+(hash1(i*9+j+3)-0.5)*0.5)*len*f;
                    ctx.lineTo(x,y);
                }
                ctx.stroke();
            }
            const p=EASE.easeOutBack(seg(k,0.12,0.3));
            const bh=Math.min(w,h)*0.3*p;
            ctx.fillStyle=rgba('ink',0.85);
            ctx.fillRect(w/2-bh*0.42,cy-bh/2,bh*0.28,bh);
            ctx.fillRect(w/2+bh*0.14,cy-bh/2,bh*0.28,bh);
        }
    },
    echo:{
        back(ctx,w,h,k,cy) {
            const R=Math.hypot(w,h)*0.55;
            for (let i=0;i<5;i++) {
                const q=((k*1.4+i*0.2)%1);
                ring(ctx,w/2,cy,R*q,8*(1-q)+1,rgba(i%2?'red':'ink',1-q),1000+i);
            }
            const e=EASE.easeInOutCubic(seg(k,0.1,0.7));
            for (let j=0;j<3;j++) {
                const x=w*(1.1-e*1.3)+j*70;
                ctx.fillStyle=j===0?PALETTE.red:rgba('ink',0.7-j*0.2);
                for (const off of [0,46]) {
                    ctx.beginPath();
                    ctx.moveTo(x+off,cy-h*0.3);
                    ctx.lineTo(x+off+44,cy-h*0.3-30);
                    ctx.lineTo(x+off+44,cy-h*0.3+30);
                    ctx.closePath();
                    ctx.fill();
                }
            }
        },
        ghost:true
    },
    inkStorm:{
        back(ctx,w,h,k,cy) {
            const c=EASE.easeOutCubic(seg(k,0.02,0.25));
            ctx.fillStyle=PALETTE.nearGray;
            for (let i=0;i<14;i++) {
                const x=i/13*w;
                const r=h*(0.1+hash1(i+1100)*0.08);
                dot(ctx,x,-r*0.4+c*r*1.1,r,i%2?PALETTE.nearGray:PALETTE.ink);
            }
            for (let i=0;i<70;i++) {
                const q=(hash1(i+1200)+k*2.2)%1;
                const x=hash1(i+1300)*w*1.2-w*0.1+q*h*0.25;
                const y=h*0.12+q*h;
                line(ctx,x,y,x-h*0.05,y-h*0.08,2,rgba('ink',0.6*c),1400+i,1);
            }
            for (const [k0,x0] of [[0.22,0.3],[0.48,0.72]]) {
                const f=seg(k,k0,k0+0.12);
                if (f<=0||f>=1) {
                    continue;
                }
                ctx.fillStyle=rgba('paper',0.35*(1-f));
                ctx.fillRect(0,0,w,h);
                ctx.strokeStyle=PALETTE.red;
                ctx.lineWidth=7*(1-f)+2;
                ctx.lineJoin='miter';
                ctx.beginPath();
                let x=w*x0;
                let y=h*0.1;
                ctx.moveTo(x,y);
                for (let j=0;j<7;j++) {
                    x+=(hash1(j+k0*100)-0.5)*w*0.12;
                    y+=h*0.12;
                    ctx.lineTo(x,y);
                }
                ctx.stroke();
                ctx.lineJoin='round';
            }
        }
    }
};

export class UltCutin {
    constructor() {
        this.active=null;
    }

    play(card) {
        const U=TUNING.ultFx;
        this.active={id:card.def.id,name:t(card.def.nameKey)+(card.upgraded?'+':''),t:0,dur:settings.reducedMotion?U.calmTime:U.time};
    }

    update(dt) {
        const a=this.active;
        if (!a) {
            return;
        }
        a.t+=dt;
        if (a.t>=a.dur) {
            this.active=null;
        }
    }

    draw(ctx,w,h) {
        const a=this.active;
        if (!a) {
            return;
        }
        const k=Math.min(1,a.t/a.dur);
        const calm=settings.reducedMotion;
        const inK=seg(k,0,0.12);
        const outK=seg(k,0.82,1);
        const env=EASE.easeOutCubic(inK)*(1-EASE.easeInCubic(outK));
        const cy=h*TUNING.ultFx.motifY;
        ctx.save();
        ctx.fillStyle=rgba('ink',0.22*env);
        ctx.fillRect(0,0,w,h);
        const M=MOTIFS[a.id];
        if (M&&!calm) {
            ctx.globalAlpha=1-EASE.easeInCubic(outK);
            M.back(ctx,w,h,k,cy);
            ctx.globalAlpha=1;
        }
        const bh=Math.min(h*0.19,150);
        const slide=(1-EASE.easeOutCubic(inK))*-w+EASE.easeInCubic(outK)*w;
        ctx.save();
        ctx.translate(w/2+(calm?0:slide),h*TUNING.ultFx.bandY);
        ctx.rotate(-0.06);
        ctx.globalAlpha=calm?env:1;
        ctx.fillStyle=rgba('paper',0.94);
        ctx.fillRect(-w*0.7,-bh/2,w*1.4,bh);
        line(ctx,-w*0.7,-bh/2,w*0.7,-bh/2,4,PALETTE.ink,1500,2);
        line(ctx,-w*0.7,bh/2,w*0.7,bh/2,4,PALETTE.ink,1501,2);
        line(ctx,-w*0.7,bh/2+10,w*0.7,bh/2+10,2,PALETTE.red,1502,2);
        const pop=calm?1:EASE.easeOutBack(seg(k,0.1,0.3));
        const size=Math.min(w*0.085,bh*0.5);
        ctx.font='900 '+Math.round(size)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const tw=ctx.measureText(a.name).width;
        ctx.save();
        ctx.scale(0.6+0.4*pop,0.6+0.4*pop);
        if (M&&M.ghost&&!calm) {
            ctx.fillStyle=rgba('red',0.35);
            ctx.fillText(a.name,-14-Math.sin(k*20)*6,4);
        }
        ctx.fillStyle=rgba('ink',0.3);
        ctx.fillText(a.name,5,6);
        ctx.lineWidth=size*0.12;
        ctx.lineJoin='round';
        ctx.strokeStyle=PALETTE.paper;
        ctx.strokeText(a.name,0,0);
        ctx.fillStyle=PALETTE.red;
        ctx.fillText(a.name,0,0);
        ctx.restore();
        const u=calm?1:EASE.easeOutCubic(seg(k,0.2,0.42));
        if (u>0) {
            brush(ctx,-tw*0.5,size*0.62,-tw*0.5+tw*u,size*0.62,1,size*0.12,PALETTE.ink,1503);
        }
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font='bold '+Math.round(size*0.28)+'px '+FONT;
        ctx.fillText(t('type.ult'),0,-size*0.78);
        ctx.restore();
        ctx.restore();
    }
}
