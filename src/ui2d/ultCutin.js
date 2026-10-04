import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {EASE} from '../core/easing.js';
import {hash1} from '../core/rng.js';
import {time} from '../core/loop.js';
import {settings} from '../core/settings.js';
import {ENEMY_ICONS} from './enemyIcons.js';

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
    dualWield:{
        back(ctx,w,h,k,cy) {
            const e=EASE.easeOutBack(seg(k,0.05,0.4));
            const L=h*0.5;
            for (const side of [-1,1]) {
                ctx.save();
                ctx.translate(w/2+side*(1-e)*w*0.6,cy);
                ctx.rotate(side*(0.55+(1-e)*0.6));
                ctx.fillStyle=PALETTE.farGray;
                ctx.fillRect(-h*0.04,-L*0.55,h*0.08,L*0.8);
                ctx.fillStyle=side<0?PALETTE.red:PALETTE.ink;
                ctx.beginPath();
                ctx.moveTo(-h*0.04,L*0.25);
                ctx.lineTo(h*0.04,L*0.25);
                ctx.lineTo(0,L*0.45);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle=PALETTE.ink;
                ctx.lineWidth=3;
                ctx.strokeRect(-h*0.04,-L*0.55,h*0.08,L*0.8);
                ctx.restore();
            }
            const q=seg(k,0.3,0.6);
            for (let i=0;i<10;i++) {
                const a=i/10*Math.PI*2;
                splat(ctx,w/2+Math.cos(a)*h*0.3*q,cy+Math.sin(a)*h*0.22*q,h*0.012,q,i%2?PALETTE.red:PALETTE.ink,640+i);
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
            for (const [k0,x0] of [[0.22,0.22],[0.48,0.48],[0.62,0.62]]) {
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
                const x=w*x0;
                ctx.moveTo(x,h*0.1);
                for (let j=1;j<=6;j++) {
                    const fj=j/6;
                    ctx.lineTo(x+(j<6?(hash1(j+k0*100)-0.5)*w*0.1:0),h*0.1+fj*h*0.34);
                }
                ctx.stroke();
                ctx.lineJoin='round';
            }
        }
    }
};

function foe(ctx,id,x,y,size,alpha=1,rot=0,flash=0) {
    if (alpha<=0) {
        return;
    }
    ctx.save();
    ctx.globalAlpha*=alpha;
    ctx.translate(x,y);
    ctx.rotate(rot);
    ctx.fillStyle=rgba('paper',0.9);
    ctx.beginPath();
    ctx.arc(0,0,size*0.55,0,Math.PI*2);
    ctx.fill();
    ctx.scale(size/60,size/60);
    ENEMY_ICONS[id](ctx,time.boilIndex);
    ctx.restore();
    if (flash>0) {
        dot(ctx,x,y,size*0.5,rgba('red',0.5*flash));
    }
}

function shatter(ctx,x,y,size,q,seed) {
    if (q<=0||q>=1) {
        return;
    }
    for (let i=0;i<9;i++) {
        const a=hash1(seed+i)*Math.PI*2;
        const d=size*(0.3+q*1.6*(0.5+hash1(seed+i*3)));
        const px=x+Math.cos(a)*d;
        const py=y+Math.sin(a)*d+q*q*size*0.8;
        ctx.save();
        ctx.translate(px,py);
        ctx.rotate(q*6*(hash1(i+seed)-0.5));
        ctx.fillStyle=rgba(i%3===0?'red':'ink',1-q);
        ctx.fillRect(-size*0.08,-size*0.05,size*0.16,size*0.1);
        ctx.restore();
    }
}

function bullet(ctx,x,y,r,a=1) {
    dot(ctx,x,y,r*1.4,rgba('paper',a));
    dot(ctx,x,y,r,rgba('red',a));
}

function stamp(ctx,x,y,txt,size,q,color) {
    if (q<=0) {
        return;
    }
    const e=EASE.easeOutBack(Math.min(1,q));
    ctx.save();
    ctx.translate(x,y);
    ctx.rotate(-0.1);
    ctx.scale(e,e);
    ctx.font='900 '+Math.round(size)+'px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.lineWidth=size*0.14;
    ctx.lineJoin='round';
    ctx.strokeStyle=PALETTE.paper;
    ctx.strokeText(txt,0,0);
    ctx.fillStyle=color;
    ctx.fillText(txt,0,0);
    ctx.restore();
}

const FOES=['doodle','blob','sprayer','compass','eraserMonster','inkCloud'];

const EXTRAS={
    execute(ctx,w,h,k,cy,a) {
        const S=Math.min(w,h)*0.16;
        const hitK=seg(k,0.2,0.3);
        const dead=seg(k,0.32,0.62);
        foe(ctx,'doodle',w/2,cy,S,1-dead,0,hitK>0?1-dead:0);
        shatter(ctx,w/2,cy,S,dead,31);
        const r=S*(1.6-EASE.easeOutCubic(seg(k,0.02,0.2))*0.9);
        const ra=1-seg(k,0.25,0.35);
        ctx.save();
        ctx.globalAlpha*=ra;
        ctx.translate(w/2,cy);
        ctx.rotate(k*2);
        ring(ctx,0,0,r,4,PALETTE.red,51);
        for (let i=0;i<4;i++) {
            ctx.rotate(Math.PI/2);
            line(ctx,r*0.7,0,r*1.25,0,4,PALETTE.red,60+i,0);
        }
        ctx.restore();
        stamp(ctx,w/2+S*0.9,cy-S*0.7,String(a.p.damage||''),S*0.55,seg(k,0.32,0.45),PALETTE.red);
    },
    redraw(ctx,w,h,k,cy,a) {
        const ex=-w*0.1+EASE.easeInOutCubic(seg(k,0.08,0.5))*w*1.2;
        for (let i=0;i<26;i++) {
            const x=w*(0.05+hash1(i+300)*0.9);
            const y=cy+(hash1(i+330)-0.5)*h*0.55;
            if (x>ex+40) {
                bullet(ctx,x+Math.sin(time.real*3+i)*4,y,6);
            }
            else {
                const q=seg(k,0.5,0.75);
                const bx=w*0.76;
                const by=h*0.14;
                const f=Math.min(1,Math.max(0,q*1.4-hash1(i)*0.4));
                if (f<1) {
                    dot(ctx,x+(bx-x)*f,y+(by-y)*f-Math.sin(f*Math.PI)*h*0.15,5,rgba('ink',1-f*0.3));
                }
            }
        }
        const q=seg(k,0.5,0.8);
        if (q>0) {
            const bx=w*0.76;
            const by=h*0.14;
            ctx.save();
            ctx.translate(bx,by);
            ctx.scale(1+Math.sin(q*Math.PI*4)*0.08,1+Math.sin(q*Math.PI*4)*0.08);
            ctx.fillStyle=PALETTE.paper;
            ctx.fillRect(-22,-26,44,52);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(-22,26-52*q,44,52*q);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=3;
            ctx.strokeRect(-22,-26,44,52);
            ctx.restore();
            stamp(ctx,bx+70,by,'+'+(a.p.ink||''),h*0.05,seg(k,0.6,0.7),PALETTE.ink);
        }
    },
    tsunami(ctx,w,h,k,cy,a) {
        const front=-w*0.25+EASE.easeInOutCubic(seg(k,0.02,0.72))*w*1.45;
        const S=Math.min(w,h)*0.1;
        for (let i=0;i<4;i++) {
            const x0=w*(0.35+i*0.17);
            const y0=cy+(hash1(i+400)-0.5)*h*0.3;
            const hit=front>x0-S*0.4;
            const q=hit?Math.min(1,(front-x0)/(w*0.3)):0;
            foe(ctx,FOES[i],x0+q*w*0.3,y0-Math.sin(q*Math.PI)*h*0.2,S,1-seg(q,0.6,1),q*8,hit?1:0);
        }
        for (let i=0;i<16;i++) {
            const x=w*(0.3+hash1(i+420)*0.7);
            if (x>front+20) {
                bullet(ctx,x,cy+(hash1(i+440)-0.5)*h*0.5,5);
            }
        }
    },
    blackHole(ctx,w,h,k,cy,a) {
        const cx=w/2;
        const pull=EASE.easeInCubic(seg(k,0.05,0.62));
        const S=Math.min(w,h)*0.1;
        for (let i=0;i<6;i++) {
            const a0=hash1(i+500)*Math.PI*2;
            const r=Math.min(w,h)*0.42*(1-pull);
            const an=a0+pull*5;
            foe(ctx,FOES[i%FOES.length],cx+Math.cos(an)*r,cy+Math.sin(an)*r*0.72,S*(1-pull*0.8),1-seg(k,0.55,0.64),pull*10);
        }
        const bq=seg(k,0.64,0.8);
        if (bq>0&&bq<1) {
            ring(ctx,cx,cy,Math.min(w,h)*0.5*EASE.easeOutCubic(bq),22*(1-bq)+2,PALETTE.ink,560);
            ring(ctx,cx,cy,Math.min(w,h)*0.38*EASE.easeOutCubic(bq),8*(1-bq)+1,PALETTE.red,561);
            splat(ctx,cx,cy,Math.min(w,h)*0.07,bq*2,PALETTE.ink,570);
        }
    },
    barrage(ctx,w,h,k,cy,a) {
        const S=Math.min(w,h)*0.1;
        const tg=[[0.72,0.25],[0.82,0.5],[0.68,0.72]];
        for (let j=0;j<3;j++) {
            const hits=seg(k,0.3+j*0.08,0.45+j*0.08);
            foe(ctx,FOES[j],w*tg[j][0],h*tg[j][1],S,1-seg(k,0.55+j*0.05,0.7+j*0.05),0,hits>0?1:0);
            shatter(ctx,w*tg[j][0],h*tg[j][1],S,seg(k,0.55+j*0.05,0.85+j*0.05),600+j*9);
        }
        for (let i=0;i<9;i++) {
            const j=i%3;
            const q=seg(k,0.06+i*0.035,0.34+i*0.035);
            if (q<=0||q>=1) {
                continue;
            }
            const sx=w*0.08;
            const sy=h*(0.3+hash1(i+620)*0.4);
            const tx=w*tg[j][0];
            const ty=h*tg[j][1];
            const c1x=w*0.35;
            const c1y=h*(hash1(i+640)>0.5?-0.1:1.1);
            const e=EASE.easeInCubic(q);
            const x=(1-e)*(1-e)*sx+2*(1-e)*e*c1x+e*e*tx;
            const y=(1-e)*(1-e)*sy+2*(1-e)*e*c1y+e*e*ty;
            const dx=2*(1-e)*(c1x-sx)+2*e*(tx-c1x);
            const dy=2*(1-e)*(c1y-sy)+2*e*(ty-c1y);
            ctx.save();
            ctx.translate(x,y);
            ctx.rotate(Math.atan2(dy,dx));
            ctx.fillStyle=PALETTE.farGray;
            ctx.fillRect(-26,-4,22,8);
            ctx.fillStyle=PALETTE.ink;
            ctx.beginPath();
            ctx.moveTo(10,0);
            ctx.lineTo(-4,-4);
            ctx.lineTo(-4,4);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.5;
            ctx.strokeRect(-26,-4,22,8);
            ctx.restore();
        }
    },
    giantPen(ctx,w,h,k,cy,a) {
        const e=EASE.easeInOutCubic(seg(k,0.05,0.55));
        const S=Math.min(w,h)*0.1;
        for (let i=0;i<4;i++) {
            const f=0.2+i*0.2;
            const x=-w*0.05+w*1.1*f;
            const y=cy-h*0.42+(h*0.78)*f+(i%2?-1:1)*S*0.3;
            const q=e>f?seg(e,f,f+0.25):0;
            foe(ctx,FOES[i],x+q*S*2*(i%2?-1:1),y-Math.sin(q*Math.PI)*S*1.5,S,1-seg(q,0.5,1),q*6,q>0?1:0);
            shatter(ctx,x,y,S,q,700+i*7);
        }
    },
    freezeAll(ctx,w,h,k,cy,a) {
        const S=Math.min(w,h)*0.09;
        const fz=seg(k,0.12,0.2);
        const run=Math.min(k,0.15);
        for (let i=0;i<5;i++) {
            const x=w*(0.15+i*0.18);
            const y=cy+(hash1(i+800)-0.5)*h*0.4;
            foe(ctx,FOES[i],x+run*120,y,S,1);
            if (fz>0) {
                ctx.save();
                ctx.globalAlpha*=fz;
                ctx.strokeStyle=PALETTE.ink;
                ctx.lineWidth=2;
                ctx.strokeRect(x+run*120-S*0.6,y-S*0.6,S*1.2,S*1.2);
                line(ctx,x+run*120-S*0.6,y-S*0.2,x+run*120-S*0.1,y+S*0.6,1.5,PALETTE.ink,810+i,1);
                ctx.restore();
            }
        }
        for (let i=0;i<14;i++) {
            const x=w*(0.1+hash1(i+830)*0.8)+run*300;
            const y=cy+(hash1(i+850)-0.5)*h*0.6;
            if (fz<1) {
                line(ctx,x-40,y,x,y,2,rgba('red',0.5*(1-fz)),860+i,0);
            }
            bullet(ctx,x,y,5);
        }
    },
    echo(ctx,w,h,k,cy,a) {
        stamp(ctx,w/2,cy,'+'+(a.p.ink||''),h*0.1,seg(k,0.3,0.45),PALETTE.ink);
    },
    inkStorm(ctx,w,h,k,cy,a) {
        const S=Math.min(w,h)*0.1;
        const strikes=[[0.22,0.22],[0.48,0.48],[0.62,0.62]];
        for (let i=0;i<3;i++) {
            const [k0,x0]=strikes[i];
            const q=seg(k,k0,k0+0.15);
            const x=w*x0;
            const y=h*0.44;
            foe(ctx,FOES[i+2],x,y,S,1-seg(q,0.5,1),0,q>0?1:0);
            shatter(ctx,x,y,S,q,900+i*9);
        }
    }
};

function speedLines(ctx,w,h,cx,cy,k,color,seed) {
    const n=34;
    const R=Math.hypot(w,h);
    ctx.strokeStyle=color;
    ctx.lineCap='round';
    for (let i=0;i<n;i++) {
        const a=hash1(i+seed)*Math.PI*2;
        const q=(hash1(i*3+seed)+k*2.4)%1;
        const r0=R*(0.28+q*0.5);
        const r1=r0+R*(0.08+hash1(i*7+seed)*0.12);
        ctx.lineWidth=1+hash1(i*5+seed)*3;
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0);
        ctx.lineTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);
        ctx.stroke();
    }
}

function vignette(ctx,w,h,a) {
    if (a<=0) {
        return;
    }
    const g=ctx.createRadialGradient(w/2,h/2,Math.min(w,h)*0.3,w/2,h/2,Math.hypot(w,h)*0.6);
    g.addColorStop(0,rgba('ink',0));
    g.addColorStop(1,rgba('ink',0.55*a));
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
}

function band(ctx,w,bh,tear,seed) {
    const n=24;
    const top=[];
    const bot=[];
    for (let i=0;i<=n;i++) {
        const x=-w*0.7+i*w*1.4/n;
        top.push([x,-bh/2+jit(i,seed)*6]);
        bot.push([x,bh/2+jit(i,seed+9)*6]);
    }
    const mid=[];
    for (let i=0;i<=n;i++) {
        mid.push([-w*0.7+i*w*1.4/n,(hash1(i+seed*3)-0.5)*bh*0.3]);
    }
    for (let half=0;half<2;half++) {
        const off=(half===0?-1:1)*tear*bh*1.6;
        const rot=(half===0?-1:1)*tear*0.08;
        ctx.save();
        ctx.translate(0,off);
        ctx.rotate(rot);
        ctx.beginPath();
        const edge=half===0?top:bot;
        ctx.moveTo(edge[0][0],edge[0][1]);
        for (const q of edge) {
            ctx.lineTo(q[0],q[1]);
        }
        for (let i=mid.length-1;i>=0;i--) {
            ctx.lineTo(mid[i][0],tear>0?mid[i][1]:(half===0?0.5:-0.5));
        }
        ctx.closePath();
        ctx.fillStyle=rgba('paper',0.96);
        ctx.fill();
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=4;
        ctx.beginPath();
        ctx.moveTo(edge[0][0],edge[0][1]);
        for (const q of edge) {
            ctx.lineTo(q[0],q[1]);
        }
        ctx.stroke();
        if (tear>0) {
            ctx.lineWidth=1.5;
            ctx.strokeStyle=PALETTE.midGray;
            ctx.beginPath();
            ctx.moveTo(mid[0][0],mid[0][1]);
            for (const q of mid) {
                ctx.lineTo(q[0],q[1]);
            }
            ctx.stroke();
        }
        ctx.restore();
    }
}

function fog(ctx,w,h,env,k) {
    const U=TUNING.ultFx;
    const d=Math.min(w,h)*U.fogSize;
    const A=U.fogAlpha*env;
    const sides=[[0,0,w,d,0,0,0,d],[0,h-d,w,d,0,h,0,h-d],[0,0,d,h,0,0,d,0],[w-d,0,d,h,w,0,w-d,0]];
    for (const s of sides) {
        const g=ctx.createLinearGradient(s[4],s[5],s[6],s[7]);
        g.addColorStop(0,rgba('paper',A));
        g.addColorStop(1,rgba('paper',0));
        ctx.fillStyle=g;
        ctx.fillRect(s[0],s[1],s[2],s[3]);
    }
    for (let i=0;i<U.fogPuffs;i++) {
        const side=i%4;
        const q=(hash1(i+1700)+k*(0.15+hash1(i+1720)*0.2))%1;
        const r=d*(0.6+hash1(i+1710)*0.8);
        const o=d*0.2*Math.sin(k*6+i);
        const x=side<2?q*w:(side===2?o:w-o);
        const y=side<2?(side===0?o:h-o):q*h;
        const g=ctx.createRadialGradient(x,y,0,x,y,r);
        g.addColorStop(0,rgba(i%3?'paper':'farGray',A*0.6));
        g.addColorStop(1,rgba('paper',0));
        ctx.fillStyle=g;
        ctx.fillRect(x-r,y-r,r*2,r*2);
    }
}

export class UltCutin {
    constructor() {
        this.active=null;
    }

    play(card,onFire=null,info={}) {
        const U=TUNING.ultFx;
        const src=info.echo||card;
        const name=t(src.def.nameKey)+(src.upgraded?'+':'');
        this.active={p:info.params||{},echo:!!info.echo,card:src,id:src.def.id,name:info.echo?t('ult.echoName',{name}):name,t:0,dur:settings.reducedMotion?U.calmTime:U.time,onFire,fired:false};
    }

    holding() {
        return !!this.active&&!this.active.fired;
    }

    fire() {
        const a=this.active;
        if (!a||a.fired) {
            return;
        }
        a.fired=true;
        if (a.onFire) {
            a.onFire();
        }
    }

    update(dt) {
        const a=this.active;
        if (!a) {
            return;
        }
        a.t+=dt;
        if (a.t>=a.dur*TUNING.ultFx.release) {
            this.fire();
        }
        if (a.t>=a.dur) {
            this.active=null;
        }
    }

    cancel() {
        this.active=null;
    }

    draw(ctx,w,h,art) {
        const a=this.active;
        if (!a) {
            return;
        }
        const U=TUNING.ultFx;
        const k=Math.min(1,a.t/a.dur);
        const calm=settings.reducedMotion;
        const inK=seg(k,0,0.1);
        const outK=seg(k,0.8,1);
        const env=EASE.easeOutCubic(inK)*(1-EASE.easeInCubic(outK));
        const cy=h*U.motifY;
        const by=h*U.bandY;
        const M=MOTIFS[a.id];
        ctx.save();
        ctx.fillStyle=rgba('ink',0.22*env);
        ctx.fillRect(0,0,w,h);
        if (!calm) {
            vignette(ctx,w,h,env);
            ctx.globalAlpha=env*0.5;
            speedLines(ctx,w,h,w/2,by,k,PALETTE.ink,77);
            ctx.globalAlpha=1;
        }
        if (M) {
            ctx.globalAlpha=1-EASE.easeInCubic(outK);
            M.back(ctx,w,h,k,cy);
            if (EXTRAS[a.id]) {
                EXTRAS[a.id](ctx,w,h,k,cy,{...a,art});
            }
            ctx.globalAlpha=1;
        }
        if (a.echo) {
            fog(ctx,w,h,env,k);
        }
        const hitK=seg(k,U.impact,U.impact+0.1);
        if (!calm&&hitK>0&&hitK<1) {
            ctx.fillStyle=rgba('paper',0.55*(1-hitK));
            ctx.fillRect(0,0,w,h);
            for (let i=0;i<6;i++) {
                splat(ctx,w*(0.15+hash1(i+40)*0.7),by+(hash1(i+50)-0.5)*h*0.3,h*0.012*(1+hash1(i)),hitK*3,i%3===0?PALETTE.red:PALETTE.ink,600+i*11);
            }
        }
        const bh=Math.min(h*0.19,150);
        const slide=(1-EASE.easeOutCubic(inK))*-w;
        const tear=calm?0:EASE.easeInCubic(outK);
        ctx.save();
        ctx.translate(w/2+(calm?0:slide),by);
        ctx.rotate(-0.06);
        ctx.globalAlpha=calm?env:1-tear*0.6;
        band(ctx,w,bh,tear,1500);
        if (tear<0.05) {
            line(ctx,-w*0.7,bh/2+10,w*0.7,bh/2+10,2,PALETTE.red,1502,2);
        }
        const pop=calm?1:EASE.easeOutBack(seg(k,0.08,0.26));
        const size=Math.min(w*0.085,bh*0.5);
        ctx.font='900 '+Math.round(size)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const tw=ctx.measureText(a.name).width;
        const shake=!calm&&hitK>0&&hitK<1?(hash1(Math.floor(a.t*60))-0.5)*10*(1-hitK):0;
        ctx.save();
        ctx.translate(shake+size*0.9,-tear*bh*0.4);
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
        if (u>0&&tear<0.3) {
            brush(ctx,size*0.9-tw*0.5,size*0.62,size*0.9-tw*0.5+tw*u,size*0.62,1,size*0.12,PALETTE.ink,1503);
        }
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font='bold '+Math.round(size*0.28)+'px '+FONT;
        ctx.fillText(t('type.ult'),size*0.9,-size*0.78-tear*bh*0.4);
        if (art&&a.card) {
            const ck=calm?1:seg(k,0.04,0.2);
            if (ck>0) {
                const e=EASE.easeOutBack(ck);
                const cs=bh*1.25/164;
                const cx=size*0.9-tw*0.5-cs*112+(1-e)*-w*0.3;
                ctx.save();
                ctx.translate(cx,tear*bh*0.6);
                ctx.rotate(-0.18+(1-e)*-1.2+tear*0.4);
                ctx.scale(cs*(1+(1-ck)*0.8),cs*(1+(1-ck)*0.8));
                ctx.fillStyle=rgba('ink',0.3);
                ctx.fillRect(-55,-78,118,164);
                ctx.drawImage(art.face(a.card,time.boilIndex),-59,-82,118,164);
                ctx.strokeStyle=PALETTE.red;
                ctx.lineWidth=5;
                ctx.strokeRect(-61,-84,122,168);
                ctx.restore();
            }
        }
        ctx.restore();
        ctx.restore();
    }
}
