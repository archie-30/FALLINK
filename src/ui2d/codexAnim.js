import {PALETTE,rgba} from '../data/palette.js';
import {ENEMY_ICONS} from './enemyIcons.js';
import {sketchRect,drawShape} from './sketch.js';
import {t} from '../data/strings.js';

const SW=16;
const SH=9;
const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const PX=3;
const PY=4.5;
const BOSSES=new Set(['inkBottle','scissors','book','exam','bookFinal','alarm']);

function clamp01(v) {
    return Math.max(0,Math.min(1,v));
}

function seg(k,a,b) {
    return clamp01((k-a)/(b-a));
}

function lerp(a,b,f) {
    return a+(b-a)*f;
}

function easeOut(f) {
    return 1-(1-f)*(1-f);
}

function inOut(f) {
    return f<0.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
}

function hash(i) {
    const x=Math.sin(i*127.1+311.7)*43758.5453;
    return x-Math.floor(x);
}

function bez(a,c,b,f) {
    const u=1-f;
    return [u*u*a[0]+2*u*f*c[0]+f*f*b[0],u*u*a[1]+2*u*f*c[1]+f*f*b[1]];
}

class Stage {
    constructor(ctx,v,s) {
        this.ctx=ctx;
        this.v=v;
        this.s=s;
    }

    circle(x,y,r,color,a=1) {
        if (a<=0||r<=0) {
            return;
        }
        const c=this.ctx;
        c.globalAlpha=a;
        c.fillStyle=color;
        c.beginPath();
        c.arc(x,y,r,0,Math.PI*2);
        c.fill();
        c.globalAlpha=1;
    }

    ring(x,y,r,color,w=0.08,a=1,dash=null,from=0,to=Math.PI*2) {
        if (a<=0||r<=0) {
            return;
        }
        const c=this.ctx;
        c.globalAlpha=a;
        c.strokeStyle=color;
        c.lineWidth=w;
        c.setLineDash(dash||[]);
        c.beginPath();
        c.arc(x,y,r,from,to);
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha=1;
    }

    line(x1,y1,x2,y2,color,w=0.08,a=1,dash=null) {
        if (a<=0) {
            return;
        }
        const c=this.ctx;
        c.globalAlpha=a;
        c.strokeStyle=color;
        c.lineWidth=w;
        c.lineCap='round';
        c.setLineDash(dash||[]);
        c.beginPath();
        c.moveTo(x1,y1);
        c.lineTo(x2,y2);
        c.stroke();
        c.setLineDash([]);
        c.globalAlpha=1;
    }

    path(pts,color,w=0.08,a=1,fill=false) {
        if (a<=0||pts.length<2) {
            return;
        }
        const c=this.ctx;
        c.globalAlpha=a;
        c.beginPath();
        c.moveTo(pts[0][0],pts[0][1]);
        for (let i=1;i<pts.length;i++) {
            c.lineTo(pts[i][0],pts[i][1]);
        }
        if (fill) {
            c.closePath();
            c.fillStyle=color;
            c.fill();
        }
        else {
            c.strokeStyle=color;
            c.lineWidth=w;
            c.lineCap='round';
            c.lineJoin='round';
            c.stroke();
        }
        c.globalAlpha=1;
    }

    rect(x,y,w,h,color,a=1) {
        if (a<=0) {
            return;
        }
        const c=this.ctx;
        c.globalAlpha=a;
        c.fillStyle=color;
        c.fillRect(x,y,w,h);
        c.globalAlpha=1;
    }

    text(str,x,y,px,color,a=1,bold=true) {
        if (a<=0) {
            return;
        }
        const c=this.ctx;
        c.save();
        c.globalAlpha=a;
        c.translate(x,y);
        c.scale(1/this.s,1/this.s);
        c.font=(bold?'bold ':'')+px+'px '+FONT;
        c.textAlign='center';
        c.textBaseline='middle';
        c.fillStyle=color;
        c.fillText(str,0,0);
        c.restore();
    }

    player(x,y,ang=0,o={}) {
        const a=o.alpha??1;
        if (a<=0) {
            return;
        }
        this.circle(x+0.1,y+0.12,0.5,PALETTE.ink,0.12*a);
        this.circle(x,y,0.46,o.ghost?PALETTE.farGray:PALETTE.midGray,a);
        this.ring(x,y,0.46,o.ghost?PALETTE.midGray:PALETTE.ink,0.07,a,o.ghost?[0.15,0.1]:null);
        const cx=Math.cos(ang);
        const cy=Math.sin(ang);
        const pens=o.pens||1;
        for (let i=0;i<pens;i++) {
            const off=pens>1?(i-0.5)*0.55:0;
            const ox=-cy*off;
            const oy=cx*off;
            this.line(x+ox+cx*0.3,y+oy+cy*0.3,x+ox+cx*(0.95-(o.kick||0)*0.2),y+oy+cy*(0.95-(o.kick||0)*0.2),PALETTE.ink,0.17,a);
        }
        this.circle(x,y,0.27,PALETTE.paper,a);
        this.ring(x,y,0.27,PALETTE.ink,0.06,a);
        if (o.flash>0) {
            this.circle(x,y,0.6,PALETTE.red,0.4*o.flash);
        }
    }

    enemy(id,x,y,o={}) {
        const a=o.alpha??1;
        if (a<=0) {
            return;
        }
        const size=o.size??(BOSSES.has(id)?3.2:(id==='blobSmall'?0.9:1.5));
        const c=this.ctx;
        c.save();
        c.globalAlpha=a;
        c.translate(x+(o.shake?Math.sin(o.shake*70)*0.1:0),y);
        c.rotate(o.rot||0);
        const k=size/60;
        c.scale(k*(o.sx||1),k);
        ENEMY_ICONS[id==='blobSmall'?'blob':id](c,this.v);
        c.restore();
        if (o.flash>0) {
            this.circle(x,y,size*0.42,PALETTE.red,0.35*o.flash);
        }
    }

    target(id,x,y,k,kh,o={}) {
        if (kh===null||kh===undefined||k<kh) {
            this.enemy(id,x,y,o);
            return;
        }
        const hit=seg(k,kh,kh+0.12);
        const die=seg(k,kh+0.04,kh+0.22);
        if (die<1) {
            this.enemy(id,x,y,{...o,alpha:1-die,flash:1-hit,shake:hit});
        }
        if (die>0&&die<1) {
            this.burst(x,y,1.4,die,PALETTE.ink);
        }
    }

    burst(x,y,r,k,color) {
        if (k<=0||k>=1) {
            return;
        }
        for (let i=0;i<10;i++) {
            const an=i/10*Math.PI*2+hash(i+x*3)*0.5;
            const r0=r*(0.2+0.5*k);
            const r1=r*(0.45+0.6*k);
            this.line(x+Math.cos(an)*r0,y+Math.sin(an)*r0,x+Math.cos(an)*r1,y+Math.sin(an)*r1,color,0.1,1-k);
        }
    }

    bullet(x,y,kind='enemy',a=1) {
        if (kind==='enemy') {
            this.circle(x,y,0.19,PALETTE.red,a);
            this.ring(x,y,0.19,PALETTE.darkRed,0.05,a);
        }
        else if (kind==='frozen') {
            this.circle(x,y,0.19,PALETTE.paper,a);
            this.ring(x,y,0.19,PALETTE.red,0.06,a);
        }
        else {
            this.circle(x,y,0.14,PALETTE.ink,a);
        }
    }

    fly(x0,y0,x1,y1,k,k0,k1,kind='ink') {
        if (k<k0||k>k1) {
            return;
        }
        const f=(k-k0)/(k1-k0);
        const x=lerp(x0,x1,f);
        const y=lerp(y0,y1,f);
        const l=Math.hypot(x1-x0,y1-y0)||1;
        const tl=Math.min(0.9,f*l);
        this.line(x-(x1-x0)/l*tl,y-(y1-y0)/l*tl,x,y,kind==='ink'?PALETTE.midGray:PALETTE.red,0.09,0.6);
        this.bullet(x,y,kind);
    }

    stream(x0,y0,x1,y1,k,from,to,every,travel,kind='ink') {
        for (let s=from;s<=to;s+=every) {
            this.fly(x0,y0,x1,y1,k,s,s+travel,kind);
        }
    }

    tele(x0,y0,x1,y1,f,a=1) {
        if (f<=0) {
            return;
        }
        this.line(x0,y0,lerp(x0,x1,Math.min(1,f*1.5)),lerp(y0,y1,Math.min(1,f*1.5)),PALETTE.red,0.05+0.1*f,a*0.8,[0.25,0.18]);
    }

    wall(pts,a=1) {
        this.path(pts,PALETTE.ink,0.5,a);
        this.path(pts,PALETTE.farGray,0.32,a);
    }

    box(x,y,w,h,a=1) {
        this.rect(x-w/2+0.12,y-h/2+0.15,w,h,PALETTE.ink,0.15*a);
        this.rect(x-w/2,y-h/2,w,h,PALETTE.midGray,a);
        const c=this.ctx;
        c.globalAlpha=a;
        c.strokeStyle=PALETTE.ink;
        c.lineWidth=0.08;
        c.strokeRect(x-w/2,y-h/2,w,h);
        c.globalAlpha=1;
    }

    num(str,x,y,f,color=PALETTE.ink,px=15) {
        if (f<=0||f>=1) {
            return;
        }
        this.text(str,x,y-0.4-f*0.9,px,color,1-f*f);
    }

    stars(x,y,t) {
        for (let i=0;i<3;i++) {
            const an=t*6+i*2.1;
            this.text('✦',x+Math.cos(an)*0.7,y-0.9+Math.sin(an)*0.25,11,PALETTE.ink);
        }
    }

    inkBottle(x,y,f,a=1) {
        const w=1.6;
        const h=2.0;
        this.rect(x-w/2,y-h/2,w,h,PALETTE.paper,a);
        this.rect(x-w/2,y+h/2-h*f,w,h*f,PALETTE.ink,a);
        const c=this.ctx;
        c.globalAlpha=a;
        c.strokeStyle=PALETTE.ink;
        c.lineWidth=0.1;
        c.strokeRect(x-w/2,y-h/2,w,h);
        c.strokeRect(x-0.35,y-h/2-0.5,0.7,0.5);
        c.globalAlpha=1;
    }
}

function walkX(k,k0,x0,speed,slowFrom,slowTo,slowMul) {
    const steps=40;
    let x=x0;
    const dt=Math.max(0,k-k0)/steps;
    for (let i=0;i<steps;i++) {
        const m=x<slowFrom&&x>slowTo?slowMul:1;
        x-=speed*m*dt;
    }
    return x;
}

function jag(S,x0,y0,x1,y1,seed,color,w,a) {
    const pts=[[x0,y0]];
    const n=6;
    const dx=x1-x0;
    const dy=y1-y0;
    const l=Math.hypot(dx,dy)||1;
    for (let i=1;i<n;i++) {
        const f=i/n;
        const o=(hash(seed*13+i)-0.5)*0.9;
        pts.push([x0+dx*f-dy/l*o,y0+dy*f+dx/l*o]);
    }
    pts.push([x1,y1]);
    S.path(pts,color,w,a);
}

export const CARD_ANIMS={
    scatter:{
        period:2.6,
        draw(S,k) {
            const fire=0.18;
            const angs=[-0.36,-0.18,0,0.18,0.36];
            const kick=seg(k,fire,fire+0.04)*(1-seg(k,fire+0.04,fire+0.2));
            S.player(PX,PY,0,{kick});
            const foes=[['doodle',0],['blob',2],['doodle',4]];
            for (const [id,i] of foes) {
                const a=angs[i];
                S.target(id,PX+Math.cos(a)*8.5,PY+Math.sin(a)*8.5,k,fire+0.36*(7.6/10.6));
            }
            for (let i=0;i<5;i++) {
                const a=angs[i];
                const hitEnemy=i%2===0;
                const end=hitEnemy?8.5:13.6;
                const T=0.36*(end-0.9)/10.6;
                S.fly(PX+Math.cos(a)*0.9,PY+Math.sin(a)*0.9,PX+Math.cos(a)*end,PY+Math.sin(a)*end,k,fire,fire+T);
            }
            S.burst(PX+1.1,PY,0.8,seg(k,fire,fire+0.12),PALETTE.ink);
        }
    },
    pierce:{
        period:2.4,
        draw(S,k) {
            const fire=0.22;
            const rec=seg(k,fire,fire+0.05)*(1-seg(k,fire+0.1,fire+0.4));
            S.player(PX-rec*0.6,PY,0,{kick:rec});
            const xs=[[7.5,'doodle'],[10,'blob'],[12.7,'eraserMonster']];
            const f=seg(k,fire,fire+0.3);
            const lx=lerp(4,17,f);
            for (const [x,id] of xs) {
                S.target(id,x,PY,k,fire+0.3*(x-4)/13);
            }
            if (k>=fire&&f<1) {
                S.line(4,PY,lx,PY,PALETTE.midGray,0.18,0.5);
                S.line(lx-1.4,PY,lx,PY,PALETTE.ink,0.3);
                S.path([[lx,PY-0.25],[lx+0.5,PY],[lx,PY+0.25]],PALETTE.ink,0.1,1,true);
            }
        }
    },
    homing:{
        period:2.8,
        draw(S,k) {
            S.player(PX,PY,0);
            const foes=[['bird',11,1.8,-3.5],['doodle',12.5,4.8,0.5],['blob',10.5,7.6,4]];
            for (let i=0;i<3;i++) {
                const [id,x,y,cy]=foes[i];
                const k0=0.15+i*0.07;
                const k1=k0+0.42;
                S.target(id,x,y,k,k1);
                if (k>=k0&&k<=k1) {
                    const f=inOut((k-k0)/(k1-k0));
                    const p=bez([PX,PY],[5.5,PY+cy],[x,y],f);
                    const q=bez([PX,PY],[5.5,PY+cy],[x,y],Math.max(0,f-0.08));
                    S.line(q[0],q[1],p[0],p[1],PALETTE.midGray,0.1,0.7);
                    S.bullet(p[0],p[1],'ink');
                }
            }
        }
    },
    bomb:{
        period:2.6,
        draw(S,k) {
            const tx=11;
            const ty=4.6;
            S.player(PX,PY,0);
            S.ring(tx,ty,2.2,PALETTE.ink,0.06,0.5*(1-seg(k,0.45,0.5)),[0.25,0.2]);
            const hit=0.5;
            S.circle(tx,ty,2.4,PALETTE.midGray,0.35*seg(k,hit,hit+0.05)*(1-seg(k,0.85,1)));
            for (const [id,x,y] of [['doodle',10.4,3.8],['blob',11.9,5.2],['doodle',10,5.6]]) {
                S.target(id,x,y,k,hit);
            }
            if (k>=0.15&&k<hit) {
                const f=(k-0.15)/(hit-0.15);
                const x=lerp(PX+0.8,tx,f);
                const y=lerp(PY,ty,f);
                S.circle(x,y,0.25,PALETTE.ink,0.2);
                S.circle(x,y-Math.sin(f*Math.PI)*3,0.32,PALETTE.ink);
                S.circle(x-0.08,y-Math.sin(f*Math.PI)*3-0.1,0.1,PALETTE.paper);
            }
            const e=seg(k,hit,hit+0.2);
            if (e>0&&e<1) {
                S.ring(tx,ty,2.4*easeOut(e),PALETTE.ink,0.25*(1-e)+0.05);
                S.burst(tx,ty,3,e,PALETTE.ink);
            }
        }
    },
    rapid:{
        period:2.8,
        draw(S,k) {
            const on=seg(k,0.08,0.16);
            S.player(PX,PY,0,{kick:k>0.2&&k<0.8?(Math.floor(k*60)%2)*0.5:0});
            S.ring(PX,PY,0.8+on*0.5,PALETTE.ink,0.08,on*(1-seg(k,0.16,0.3)));
            S.text('×2',PX,PY-1.3,16,PALETTE.ink,seg(k,0.1,0.18)*(1-seg(k,0.82,0.9)));
            S.stream(PX+0.9,PY,12,PY,k,0.2,0.78,0.025,0.1);
            S.target('eraserMonster',12,PY,k,0.8,{flash:k>0.25&&k<0.8?(Math.floor(k*40)%2):0});
        }
    },
    execute:{
        period:3,
        draw(S,k) {
            const ex=11;
            S.player(PX,PY,0);
            const hit=0.52;
            S.target('eraserMonster',ex,PY,k,hit);
            const c=seg(k,0.08,0.45);
            if (c>0&&k<hit) {
                const r=lerp(2.4,0.9,easeOut(c));
                S.ring(ex,PY,r,PALETTE.red,0.09);
                S.line(ex-r-0.4,PY,ex-r+0.5,PY,PALETTE.red,0.09);
                S.line(ex+r-0.5,PY,ex+r+0.4,PY,PALETTE.red,0.09);
                S.line(ex,PY-r-0.4,ex,PY-r+0.5,PALETTE.red,0.09);
                S.line(ex,PY+r-0.5,ex,PY+r+0.4,PALETTE.red,0.09);
            }
            const inv=seg(k,hit-0.02,hit)*(1-seg(k,hit+0.02,hit+0.12));
            S.rect(0,0,SW,SH,PALETTE.ink,0.75*inv);
            const sl=seg(k,hit,hit+0.06);
            if (sl>0) {
                const a=1-seg(k,0.75,0.9);
                S.line(ex-2,PY+1.6,lerp(ex-2,ex+2,sl),lerp(PY+1.6,PY-1.6,sl),PALETTE.red,0.22,a);
                S.circle(ex,PY,1.4,PALETTE.red,0.25*a);
            }
            const r2=seg(k,hit+0.02,hit+0.25);
            S.ring(ex,PY,2.8*easeOut(r2),PALETTE.red,0.12,1-r2);
        }
    },
    pencilWall:{
        period:3.2,
        draw(S,k) {
            S.player(PX,PY,0);
            const pts=[];
            for (let i=0;i<=20;i++) {
                const f=i/20;
                pts.push([6.4+Math.sin(f*Math.PI*1.3)*0.7,1.2+f*6.6]);
            }
            const d=seg(k,0.05,0.32);
            const n=Math.max(2,Math.round(d*20)+1);
            if (d>0) {
                S.wall(pts.slice(0,n));
                if (d<1) {
                    const h=pts[n-1];
                    S.path([[h[0],h[1]],[h[0]+0.3,h[1]-0.9],[h[0]+0.55,h[1]-0.75]],PALETTE.ink,0.1,1,true);
                }
            }
            S.enemy('doodle',13,PY);
            for (let i=0;i<4;i++) {
                const k0=0.36+i*0.12;
                const y=PY+(i-1.5)*0.9;
                const wx=6.4+Math.sin(((y-1.2)/6.6)*Math.PI*1.3)*0.7+0.35;
                S.fly(12.3,PY,wx,y,k,k0,k0+0.14,'enemy');
                S.burst(wx,y,0.6,seg(k,k0+0.14,k0+0.24),PALETTE.midGray);
            }
        }
    },
    eraser:{
        period:2.8,
        draw(S,k) {
            S.player(PX,PY,0);
            const s0=0.35;
            const s1=0.43;
            const kb=1-Math.pow(1-seg(k,s0,s0+0.15),3);
            S.enemy('doodle',PX+4.8+kb*2.6,PY+0.6,{size:1.5,flash:seg(k,s0,s0+0.02)*(1-seg(k,s0+0.05,s0+0.12))});
            S.num('-5',PX+5.2+kb*2.6,PY-1.2,seg(k,s0,0.8),PALETTE.red,16);
            const sw=seg(k,s0,s1);
            const cur=lerp(-0.7,0.7,sw);
            if (k>=s0&&k<0.75) {
                const a=1-seg(k,s1,0.75);
                const c=S.ctx;
                c.globalAlpha=0.18*a;
                c.fillStyle=PALETTE.ink;
                c.beginPath();
                c.moveTo(PX,PY);
                c.arc(PX,PY,7,-0.7,cur);
                c.closePath();
                c.fill();
                c.globalAlpha=1;
                S.line(PX,PY,PX+Math.cos(cur)*7,PY+Math.sin(cur)*7,PALETTE.ink,0.12,a);
                S.rect(PX+Math.cos(cur)*6.6-0.45,PY+Math.sin(cur)*6.6-0.25,0.9,0.5,PALETTE.farGray,a);
            }
            for (let i=0;i<6;i++) {
                const x0=12+hash(i)*2.4;
                const y0=1.5+i*1.2;
                const x=x0-10*k;
                const y=lerp(y0,PY,k*0.35);
                const an=Math.atan2(y-PY,x-PX);
                const te=an>-0.7&&an<0.7?s0:9;
                const gone=seg(k,te,te+0.05);
                if (k<te||gone<1) {
                    S.bullet(x,y,'enemy',1-gone);
                }
            }
        }
    },
    trap:{
        period:3.4,
        draw(S,k) {
            S.player(PX,PY,0);
            const cx=9.5;
            const d=seg(k,0.03,0.16);
            S.ring(cx,PY,2.1,PALETTE.ink,0.1,1,null,0,Math.PI*2*d);
            for (let i=0;i<3;i++) {
                S.ring(cx,PY,0.5+i*0.5,PALETTE.midGray,0.05,d,null,i,i+Math.PI*1.4);
            }
            const foes=[['doodle',3.9,0.1],['blob',5.3,0.3]];
            for (const [id,y,k0] of foes) {
                const x=walkX(k,k0,16,13,cx+2.1,cx-2.1,0.25);
                const inside=Math.abs(x-cx)<2.1;
                S.enemy(id,x,y);
                if (inside) {
                    S.text('~',x+0.8,y-0.8,14,PALETTE.nearGray);
                }
            }
        }
    },
    paperShield:{
        period:3,
        draw(S,k,t) {
            S.player(PX,PY,0);
            S.enemy('doodle',13,PY);
            const hits=[0.32,0.55,0.78];
            let left=3;
            for (let i=0;i<3;i++) {
                S.fly(12.3,PY,PX+1.1,PY,k,hits[i]-0.2,hits[i],'enemy');
                if (k>=hits[i]) {
                    left--;
                }
            }
            for (let i=0;i<3;i++) {
                const an=t*2.2+i*Math.PI*2/3;
                const lost=i>=left;
                const hitK=lost?seg(k,hits[2-i],hits[2-i]+0.15):0;
                const r=1.15+hitK*1.2;
                const x=PX+Math.cos(an)*r;
                const y=PY+Math.sin(an)*r;
                const c=S.ctx;
                c.save();
                c.globalAlpha=1-hitK;
                c.translate(x,y);
                c.rotate(an+hitK*4);
                c.fillStyle=PALETTE.paper;
                c.fillRect(-0.3,-0.42,0.6,0.84);
                c.strokeStyle=PALETTE.ink;
                c.lineWidth=0.07;
                c.strokeRect(-0.3,-0.42,0.6,0.84);
                c.restore();
            }
        }
    },
    inkDash:{
        period:3,
        draw(S,k) {
            const d=seg(k,0.1,0.22);
            const x=lerp(2.2,9.5,easeOut(d));
            const fade=1-seg(k,0.85,0.95);
            if (d>0) {
                S.line(2.2,PY,x,PY,PALETTE.ink,0.9,0.75*fade);
            }
            S.player(x,PY,0,{alpha:d>0&&d<1?(Math.floor(k*80)%2?0.4:1):1});
            const foes=[[5.2,0.3,1],[7.4,0.45,-1]];
            for (const [ex,k0,dir] of foes) {
                const f=seg(k,k0,k0+0.45);
                const y=dir>0?lerp(0.8,8.2,f):lerp(8.2,0.8,f);
                const on=Math.abs(y-PY)<0.6&&d>=1;
                S.enemy('doodle',ex,y,{flash:on?1:0});
                if (on) {
                    S.num('40',ex,y,((k*40)%1),PALETTE.red);
                }
            }
        }
    },
    timeStop:{
        period:3.4,
        draw(S,k) {
            const fz=0.35;
            const un=0.8;
            const te=k<fz?k:(k<un?fz:k-(un-fz));
            const frozen=k>=fz&&k<un;
            const my=lerp(PY,7.2,seg(k,fz+0.05,un-0.05));
            S.player(PX,my,0);
            S.enemy('compass',13,2.5);
            S.enemy('doodle',13,6.5);
            for (let i=0;i<8;i++) {
                const k0=0.02+i*0.06;
                const sy=i%2?6.5:2.5;
                const f=(te-k0)/0.55;
                if (f<0||f>1) {
                    continue;
                }
                S.bullet(lerp(12.4,PX-2,f),lerp(sy,PY+(hash(i)-0.5)*0.6,f),frozen?'frozen':'enemy');
            }
            const inv=seg(k,fz,fz+0.04)*(1-seg(k,un-0.04,un));
            S.rect(0,0,SW,SH,PALETTE.ink,0.28*inv);
            if (inv>0) {
                S.ring(8,1.2,0.6,PALETTE.paper,0.08,inv);
                S.line(8,1.2,8,0.8,PALETTE.paper,0.08,inv);
                S.line(8,1.2,8.3,1.3,PALETTE.paper,0.08,inv);
            }
        }
    },
    clone:{
        period:3.2,
        draw(S,k) {
            S.player(PX,PY,0);
            const cx=7;
            const cy=7.2;
            const ap=seg(k,0.08,0.18)*(1-seg(k,0.88,0.96));
            if (ap>0) {
                S.ring(cx,cy,0.8+(1-ap),PALETTE.midGray,0.06,ap,[0.2,0.15]);
                const tgt=k<0.62?[11,2.5]:[12.5,5.5];
                S.player(cx,cy,Math.atan2(tgt[1]-cy,tgt[0]-cx),{ghost:true,alpha:ap*0.8});
            }
            S.stream(cx,cy,11,2.5,k,0.2,0.5,0.06,0.1);
            S.stream(cx,cy,12.5,5.5,k,0.62,0.78,0.06,0.1);
            S.target('bird',11,2.5,k,0.62);
            S.target('doodle',12.5,5.5,k,0.86);
        }
    },
    redraw:{
        period:3.4,
        draw(S,k) {
            S.player(PX,PY,0);
            const on=seg(k,0.08,0.16)*(1-seg(k,0.9,0.98));
            S.ring(PX,PY,1.2+seg(k,0.08,0.3)*1.6,PALETTE.red,0.12,on*(1-seg(k,0.08,0.4)));
            S.rect(PX-1.6,PY-2.3,3.2,0.3,PALETTE.farGray,on);
            S.rect(PX-1.6,PY-2.3,3.2*(1-seg(k,0.16,0.9)),0.3,PALETTE.red,on);
            for (let i=0;i<3;i++) {
                const k0=0.25+i*0.2;
                const y=PY+(i-1)*1.8;
                S.fly(PX+0.8,PY,14,y,k,k0,k0+0.18);
                S.num('0',PX+1.2,PY-1.2-i*0.2,seg(k,k0,k0+0.18),PALETTE.red,18);
                S.burst(14,y,0.6,seg(k,k0+0.18,k0+0.3),PALETTE.ink);
            }
            S.text('FREE',PX,PY-3.2,16,PALETTE.red,on);
        }
    },
    whiteout:{
        period:2.6,
        draw(S,k) {
            S.player(PX+2,PY,0);
            const hp=lerp(6,8,seg(k,0.25,0.5));
            const bx=PX+0.5;
            S.rect(bx,PY-1.5,3,0.3,PALETTE.farGray);
            S.rect(bx,PY-1.5,3*hp/10,0.3,PALETTE.ink);
            S.ring(PX+2,PY,0.7+seg(k,0.2,0.5),PALETTE.paper,0.25,1-seg(k,0.2,0.5));
            for (let i=0;i<5;i++) {
                const f=seg(k,0.2+i*0.05,0.6+i*0.05);
                if (f>0&&f<1) {
                    const x=PX+1.2+hash(i)*1.6;
                    const y=PY+0.5-f*2;
                    S.line(x-0.18,y,x+0.18,y,PALETTE.ink,0.08,1-f);
                    S.line(x,y-0.18,x,y+0.18,PALETTE.ink,0.08,1-f);
                }
            }
            S.num('+2',PX+2,PY-1.9,seg(k,0.3,0.9),PALETTE.ink,18);
        }
    },
    shockwave:{
        period:2.8,
        draw(S,k) {
            const hit=0.32;
            S.player(8,PY,0);
            const e=seg(k,hit,hit+0.2);
            S.ring(8,PY,4*easeOut(e),PALETTE.ink,0.2*(1-e)+0.04,e>0&&e<1?1:0);
            const foes=['doodle','blob','doodle','compass'];
            for (let i=0;i<4;i++) {
                const an=i*Math.PI/2+0.5;
                const r=lerp(1.9,4.8,easeOut(e));
                S.enemy(foes[i],8+Math.cos(an)*r,PY+Math.sin(an)*r,{flash:e>0&&e<0.5?1:0});
            }
            for (let i=0;i<6;i++) {
                const an=i*1.05;
                const r=lerp(3.2,1.4,seg(k,0,hit));
                if (k<hit+0.02) {
                    S.bullet(8+Math.cos(an)*r,PY+Math.sin(an)*r,'enemy');
                }
            }
        }
    },
    mark:{
        period:3,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const m=seg(k,0.08,0.22);
            const ex=11.5;
            if (m>0&&k<0.86) {
                S.ring(ex,PY,1.2,PALETTE.ink,0.08,m,[0.3,0.2]);
                const c=S.ctx;
                c.save();
                c.translate(ex,PY-1.6);
                c.rotate(t*2);
                S.path([[0,-0.35],[0.3,0],[0,0.35],[-0.3,0]],PALETTE.red,0.1,m,true);
                c.restore();
            }
            S.stream(PX+0.9,PY,ex,PY,k,0.32,0.72,0.08,0.12);
            for (let i=0;i<6;i++) {
                const kk=0.44+i*0.08;
                S.num('28',ex+(hash(i)-0.5)*0.8,PY-0.5,seg(k,kk,kk+0.25),PALETTE.red,17);
            }
            S.target('compass',ex,PY,k,0.84);
        }
    },
    inkMine:{
        period:3.2,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const mx=8.5;
            const hit=0.62;
            const put=seg(k,0.05,0.12);
            if (put>0&&k<hit) {
                const pu=1+Math.sin(t*10)*0.1;
                S.circle(mx,PY,0.4*pu,PALETTE.ink,put);
                for (let i=0;i<6;i++) {
                    const an=i*Math.PI/3;
                    S.line(mx+Math.cos(an)*0.4,PY+Math.sin(an)*0.4,mx+Math.cos(an)*0.62*pu,PY+Math.sin(an)*0.62*pu,PALETTE.ink,0.08,put);
                }
                S.circle(mx,PY,0.14,PALETTE.red,put*(Math.floor(t*4)%2));
            }
            const ex=Math.max(mx+0.6,lerp(15.5,mx,seg(k,0.2,hit)));
            S.target('blob',ex,PY,k,hit);
            S.target('doodle',9.6,6.2,k,hit);
            const e=seg(k,hit,hit+0.2);
            if (e>0&&e<1) {
                S.ring(mx,PY,2.4*easeOut(e),PALETTE.ink,0.25*(1-e)+0.05);
                S.burst(mx,PY,3,e,PALETTE.ink);
            }
        }
    },
    dualWield:{
        period:3.4,
        draw(S,k) {
            const on=k>0.1&&k<0.78;
            const pop=seg(k,0.06,0.12)*(1-seg(k,0.12,0.2));
            S.player(PX,PY,0,{pens:on?2:1,flash:pop,kick:k>0.18&&k<0.7?(Math.floor(k*50)%2)*0.5:0});
            S.stream(PX+0.9,PY-0.3,12,3.3,k,0.18,0.68,0.04,0.12);
            S.stream(PX+0.9,PY+0.3,12,5.7,k,0.2,0.7,0.04,0.12);
            S.target('doodle',12,3.3,k,0.72);
            S.target('blob',12,5.7,k,0.75);
            S.text(t('card.dualWield.name'),PX+0.4,PY-1.4,Math.max(9,S.s*0.7),PALETTE.red,seg(k,0.08,0.14)*(1-seg(k,0.7,0.78)));
            const toss=seg(k,0.78,0.95);
            if (toss>0&&toss<1) {
                const x=PX-0.3-toss*2.2;
                const y=PY+0.3-Math.sin(toss*Math.PI)*2.4+toss*1.6;
                const a=toss*Math.PI*3;
                S.line(x-Math.cos(a)*0.4,y-Math.sin(a)*0.4,x+Math.cos(a)*0.4,y+Math.sin(a)*0.4,PALETTE.ink,0.17,1-seg(k,0.9,0.95));
            }
        }
    },
    pin:{
        period:3,
        draw(S,k) {
            S.player(PX,PY,0);
            const drop=0.3;
            const px=10.5;
            const pf=seg(k,drop-0.08,drop);
            const foes=[['doodle',2.8,0],['blob',5,0.05],['doodle',6.4,0.1]];
            for (const [id,y,k0] of foes) {
                const moving=k<drop||k>0.88;
                const x=k<drop?lerp(15.5,11,seg(k,k0,drop)):(k>0.88?lerp(11,9.5,seg(k,0.88,1)):11);
                S.enemy(id,x,y,{shake:moving?0:(k*3)%1*0.2});
                if (!moving) {
                    S.line(x-0.3,y+0.5,x+0.3,y+0.9,PALETTE.ink,0.12);
                    S.line(x+0.3,y+0.5,x-0.3,y+0.9,PALETTE.ink,0.12);
                }
            }
            if (pf>0&&k<0.88) {
                const h=(1-pf)*3;
                S.circle(px,PY-h,0.55,PALETTE.nearGray);
                S.ring(px,PY-h,0.55,PALETTE.ink,0.08);
                S.line(px,PY-h+0.5,px,PY-h+1.1,PALETTE.ink,0.1);
                const r=seg(k,drop,drop+0.12);
                S.ring(px,PY,2.6*easeOut(r),PALETTE.ink,0.08,1-r*0.6,[0.25,0.2]);
            }
        }
    },
    chain:{
        period:2.8,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const pts=[[PX,PY],[7,2.8],[10,6.2],[12.5,2.6],[14.2,6.4]];
            const ids=['doodle','blob','bird','doodle'];
            for (let i=0;i<4;i++) {
                const kk=0.2+i*0.1;
                S.target(ids[i],pts[i+1][0],pts[i+1][1],k,0.72,{flash:k>kk&&k<kk+0.1?1:0});
                S.num('25',pts[i+1][0],pts[i+1][1]-0.6,seg(k,kk,kk+0.3),PALETTE.ink,15);
                const a=seg(k,kk,kk+0.02)*(1-seg(k,kk+0.12,kk+0.2));
                if (a>0) {
                    jag(S,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],i+Math.floor(t*20),PALETTE.ink,0.12,a);
                    jag(S,pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],i+7+Math.floor(t*20),PALETTE.midGray,0.06,a);
                }
            }
        }
    },
    inkRain:{
        period:3.2,
        draw(S,k) {
            S.player(PX,PY,0);
            const cx=11;
            S.ring(cx,PY,2.5,PALETTE.ink,0.06,seg(k,0.02,0.08)*(1-seg(k,0.8,0.9)),[0.25,0.2]);
            for (const [id,x,y] of [['doodle',10.3,3.8],['blob',12,5.2],['doodle',10.6,6]]) {
                S.target(id,x,y,k,0.6);
            }
            for (let i=0;i<8;i++) {
                const kk=0.15+i*0.055;
                const an=hash(i)*Math.PI*2;
                const r=Math.sqrt(hash(i+5))*2.2;
                const x=cx+Math.cos(an)*r;
                const y=PY+Math.sin(an)*r;
                const f=seg(k,kk,kk+0.08);
                if (f>0&&f<1) {
                    S.line(x,y-2.5*(1-f)-0.6,x,y-2.5*(1-f),PALETTE.ink,0.14);
                }
                const sp=seg(k,kk+0.08,kk+0.25);
                if (sp>0) {
                    S.circle(x,y,0.45,PALETTE.midGray,0.5*(1-seg(k,0.85,1)));
                    S.ring(x,y,0.3+sp*0.9,PALETTE.ink,0.07,1-sp);
                }
            }
        }
    },
    reflect:{
        period:3,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const on=seg(k,0.05,0.12)*(1-seg(k,0.85,0.95));
            S.ring(PX,PY,1.4,PALETTE.midGray,0.1,on,[0.3,0.2]);
            const c=S.ctx;
            c.save();
            c.translate(PX,PY);
            c.rotate(t);
            S.ring(0,0,1.55,PALETTE.ink,0.05,on*0.6,[0.15,0.35]);
            c.restore();
            const src=[[12.5,2.8],[13,6]];
            for (let i=0;i<4;i++) {
                const s=src[i%2];
                const k0=0.12+i*0.13;
                const an=Math.atan2(s[1]-PY,s[0]-PX);
                const bx=PX+Math.cos(an)*1.5;
                const by=PY+Math.sin(an)*1.5;
                S.fly(s[0],s[1],bx,by,k,k0,k0+0.14,'enemy');
                S.fly(bx,by,s[0],s[1],k,k0+0.14,k0+0.26,'ink');
            }
            S.target('doodle',12.5,2.8,k,0.76);
            S.target('compass',13,6,k,0.88);
        }
    },
    inkWell:{
        period:2.6,
        draw(S,k) {
            S.player(PX,PY,0);
            const f=lerp(0.3,0.6,seg(k,0.25,0.6));
            S.inkBottle(9,PY+0.3,f);
            for (let i=0;i<4;i++) {
                const d=seg(k,0.15+i*0.08,0.3+i*0.08);
                if (d>0&&d<1) {
                    S.circle(9+(hash(i)-0.5)*0.5,lerp(0.5,PY-1,d),0.16,PALETTE.ink);
                }
            }
            S.num('+3',10.6,PY-1,seg(k,0.4,0.95),PALETTE.ink,18);
        }
    },
    tsunami:{
        period:3,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const f=seg(k,0.18,0.72);
            const x=lerp(3.8,17.5,inOut(f));
            const foes=[['doodle',8,2.5],['blob',10.5,5.5],['eraserMonster',13,3.5],['bird',12,7.2]];
            for (const [id,ex,ey] of foes) {
                const px=Math.max(ex,x+0.8);
                const kh=0.18+0.54*Math.max(0,(ex-3.8)/13.7);
                S.target(id,px,ey,k,Math.min(0.7,kh+0.1));
            }
            for (let i=0;i<5;i++) {
                const bx=9+hash(i)*5;
                if (bx>x) {
                    S.bullet(bx,1+i*1.6,'enemy');
                }
            }
            if (f>0&&f<1) {
                const pts=[];
                for (let i=0;i<=18;i++) {
                    const y=0.2+i*0.48;
                    pts.push([x+Math.sin(i*1.3+t*8)*0.25,y]);
                }
                const back=pts.map(p=>[p[0]-1.6,p[1]]).reverse();
                S.path(pts.concat(back),PALETTE.ink,0,0.85,true);
                S.path(pts.map(p=>[p[0]+0.25,p[1]]),PALETTE.midGray,0.12,0.8);
            }
        }
    },
    blackHole:{
        period:3.4,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const hx=10.5;
            const on=seg(k,0.05,0.15);
            const boom=0.72;
            if (k<boom) {
                for (let i=0;i<4;i++) {
                    const c=S.ctx;
                    c.save();
                    c.translate(hx,PY);
                    c.rotate(t*(2+i)+i);
                    S.ring(0,0,(0.6+i*0.55)*on,PALETTE.ink,0.07,on*0.7,null,0,Math.PI*1.3);
                    c.restore();
                }
                S.circle(hx,PY,0.55*on,PALETTE.ink);
            }
            const foes=[['doodle',0,3.6],['blob',1.3,3.2],['bird',2.6,3.9],['doodle',3.9,3],['compass',5.2,3.5]];
            const pull=easeOut(seg(k,0.12,boom));
            for (const [id,a0,r0] of foes) {
                const r=r0*(1-pull*0.85);
                const an=a0+pull*2.5;
                S.target(id,hx+Math.cos(an)*r,PY+Math.sin(an)*r*0.8,k,boom,{size:1.5*(1-pull*0.4)});
            }
            const e=seg(k,boom,boom+0.2);
            if (e>0&&e<1) {
                S.ring(hx,PY,3.5*easeOut(e),PALETTE.ink,0.3*(1-e)+0.05);
                S.burst(hx,PY,4,e,PALETTE.ink);
            }
            S.rect(0,0,SW,SH,PALETTE.ink,0.6*seg(k,boom,boom+0.02)*(1-seg(k,boom+0.04,boom+0.1)));
        }
    },
    barrage:{
        period:3.2,
        draw(S,k) {
            S.player(PX,PY,0);
            const foes=[['doodle',11,1.8],['blob',13,4],['bird',11.5,6.3],['compass',14,7.6]];
            for (let i=0;i<foes.length;i++) {
                S.target(foes[i][0],foes[i][1],foes[i][2],k,0.74+i*0.03);
            }
            for (let j=0;j<24;j++) {
                const k0=0.1+j*0.02;
                const k1=k0+0.28;
                if (k<k0||k>k1) {
                    continue;
                }
                const f=inOut((k-k0)/(k1-k0));
                const tg=foes[j%4];
                const an=hash(j)*Math.PI*2;
                const p=bez([PX,PY],[PX+Math.cos(an)*4,PY+Math.sin(an)*3],[tg[1],tg[2]],f);
                S.bullet(p[0],p[1],'ink');
            }
        }
    },
    giantPen:{
        period:2.8,
        draw(S,k) {
            const ap=seg(k,0.05,0.2);
            S.player(PX,PY,0);
            if (ap>0&&k<0.7) {
                const a=1-seg(k,0.6,0.7);
                const c=S.ctx;
                c.save();
                c.globalAlpha=0.35*ap*a;
                c.fillStyle=PALETTE.nearGray;
                c.fillRect(PX-2.2,PY-0.45,3.2,0.9);
                c.beginPath();
                c.moveTo(PX+1,PY-0.45);
                c.lineTo(PX+2,PY);
                c.lineTo(PX+1,PY+0.45);
                c.fill();
                c.restore();
            }
            const b=seg(k,0.2,0.24);
            const w=1.7*(1-seg(k,0.3,0.62));
            if (b>0&&w>0.01) {
                S.rect(PX+1.5,PY-w/2,lerp(0,SW,b),w,PALETTE.ink);
                S.rect(PX+1.5,PY-w/2-0.2,lerp(0,SW,b),0.08,PALETTE.midGray);
                S.rect(PX+1.5,PY+w/2+0.12,lerp(0,SW,b),0.08,PALETTE.midGray);
            }
            for (const [id,x,y,hitIt] of [['doodle',8,PY+0.4,true],['eraserMonster',11.5,PY-0.3,true],['blob',13.5,PY+0.2,true],['bird',10,1.6,false],['doodle',12.5,7.6,false]]) {
                S.target(id,x,y,k,hitIt?0.24:null);
            }
        }
    },
    sketchLeap:{
        period:2.8,
        draw(S,k) {
            const fire=0.15;
            const tx=10;
            const ty=6.6;
            for (let i=0;i<8;i++) {
                const an=i/8*Math.PI*2;
                S.fly(PX+Math.cos(an)*0.6,PY+Math.sin(an)*0.6,PX+Math.cos(an)*4.2,PY+Math.sin(an)*4.2,k,fire,fire+0.16,'ink');
            }
            S.target('doodle',PX+3.4,PY-2.4,k,fire+0.12);
            S.target('blob',PX+3.6,PY+1.6,k,fire+0.13);
            const f=seg(k,fire+0.05,0.6);
            const x=lerp(PX,tx,f);
            const y=lerp(PY,ty,f)-Math.sin(f*Math.PI)*2.4;
            if (f<1) {
                S.ring(tx,ty,0.9,PALETTE.ink,0.06,0.5,[0.2,0.15]);
            }
            S.circle(lerp(PX,tx,f),lerp(PY,ty,f)+0.5,0.5*(1-Math.sin(f*Math.PI)*0.4),PALETTE.farGray,0.6);
            S.player(x,y,0);
            S.burst(tx,ty,1,seg(k,0.6,0.75),PALETTE.midGray);
        }
    },
    puppet:{
        period:3.4,
        draw(S,k,t) {
            const cx=9;
            const cy=PY;
            const on=seg(k,0.08,0.16)*(1-seg(k,0.86,0.94));
            S.player(PX,PY,0);
            if (on>0) {
                for (let i=0;i<2;i++) {
                    const r=((t*0.9+i*0.5)%1)*2.2;
                    S.ring(cx,cy,r,PALETTE.red,0.07,on*(1-r/2.2));
                }
                S.player(cx,cy,t*2,{ghost:true,alpha:on*0.9});
                const n=3;
                for (let i=0;i<n;i++) {
                    const an=t*0.8+i*Math.PI*2/n;
                    S.rect(PX+Math.cos(an)*1.3-0.12,PY+Math.sin(an)*1.3-0.35,0.24,0.7,PALETTE.paper,on);
                }
            }
            const foes=[['doodle',13.5,1.6],['sprayer',14,7.4],['blob',12.5,4.5]];
            foes.forEach(([id,x,y],i)=>{
                const pull=on*0.35;
                S.enemy(id,lerp(x,cx+2,pull),lerp(y,cy,pull*0.6));
                const k0=0.25+i*0.15;
                S.fly(lerp(x,cx+2,pull)-0.6,lerp(y,cy,pull*0.6),cx+0.4,cy,k,k0,k0+0.12,'enemy');
            });
        }
    },
    bounceBall:{
        period:2.8,
        draw(S,k) {
            const pts=[[PX+0.8,PY],[8,0.4],[12,8.6],[15.4,3.6]];
            let total=0;
            const L=[];
            for (let i=0;i<pts.length-1;i++) {
                const d=Math.hypot(pts[i+1][0]-pts[i][0],pts[i+1][1]-pts[i][1]);
                L.push(d);
                total+=d;
            }
            S.line(0,0.15,SW,0.15,PALETTE.ink,0.2);
            S.line(0,SH-0.15,SW,SH-0.15,PALETTE.ink,0.2);
            S.line(SW-0.15,0,SW-0.15,SH,PALETTE.ink,0.2);
            S.player(PX,PY,-0.6);
            const f=seg(k,0.1,0.8);
            let d=f*total;
            let x=pts[0][0];
            let y=pts[0][1];
            for (let i=0;i<L.length;i++) {
                if (d<=L[i]) {
                    x=lerp(pts[i][0],pts[i+1][0],d/L[i]);
                    y=lerp(pts[i][1],pts[i+1][1],d/L[i]);
                    break;
                }
                d-=L[i];
            }
            for (let i=0;i<pts.length-1;i++) {
                S.line(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],i===0?PALETTE.ink:PALETTE.red,0.05,0.35,[0.25,0.2]);
            }
            S.target('doodle',lerp(PX+0.8,8,0.6),lerp(PY,0.4,0.6),k,0.1+0.7*(L[0]*0.6/total));
            S.target('blob',lerp(8,12,0.5),lerp(0.4,8.6,0.5),k,0.1+0.7*((L[0]+L[1]*0.5)/total));
            if (f>0&&f<1) {
                S.circle(x,y,0.36,PALETTE.paper,1);
                S.ring(x,y,0.36,PALETTE.ink,0.08,1);
            }
        }
    },
    stamp:{
        period:2.6,
        draw(S,k) {
            const tx=10.5;
            const ty=PY;
            S.player(PX,PY,0);
            const hit=0.42;
            S.ring(tx,ty,2.2,PALETTE.red,0.06,0.6*(1-seg(k,hit,hit+0.05)),[0.25,0.2]);
            S.circle(tx,ty,2.2,PALETTE.red,0.35*seg(k,hit,hit+0.04)*(1-seg(k,0.8,0.95)));
            for (const [id,x,y] of [['doodle',9.6,3.6],['blob',11.4,5.2],['sprayer',10.8,3]]) {
                S.target(id,x,y,k,hit);
            }
            const f=seg(k,0.15,hit);
            const lift=k<hit?(1-f*f)*5:seg(k,0.6,0.8)*4;
            if (k>0.15&&k<0.85) {
                S.rect(tx-1.6,ty-1.2-lift,3.2,0.9,PALETTE.red,1);
                S.rect(tx-1.4,ty-2.1-lift,2.8,0.9,PALETTE.paper,1);
                S.rect(tx-0.3,ty-3.6-lift,0.6,1.5,PALETTE.midGray,1);
                S.circle(tx,ty-3.9-lift,0.55,PALETTE.nearGray,1);
            }
            S.burst(tx,ty,2.6,seg(k,hit,hit+0.2),PALETTE.red);
        }
    },
    ruler:{
        period:2.6,
        draw(S,k) {
            const rx=8;
            const on=seg(k,0.05,0.12)*(1-seg(k,0.9,0.97));
            S.rect(rx-0.3,0.8,0.6,7.4,PALETTE.marker,0.35*on);
            for (let i=0;i<=14;i++) {
                S.line(rx-0.3,0.8+i*7.4/14,rx-0.3+(i%5===0?0.45:0.25),0.8+i*7.4/14,PALETTE.ink,0.04,on);
            }
            let kick=0;
            for (let i=0;i<5;i++) {
                const s0=0.18+i*0.12;
                kick=Math.max(kick,seg(k,s0,s0+0.02)*(1-seg(k,s0+0.02,s0+0.06)));
                if (k>=s0&&k<=s0+0.16) {
                    const f=(k-s0)/0.16;
                    const x=lerp(PX+0.9,12,f);
                    const big=x>rx;
                    S.line(x-0.8,PY,x,PY,big?PALETTE.red:PALETTE.midGray,0.09,0.6);
                    S.circle(x,PY,big?0.24:0.14,big?PALETTE.red:PALETTE.ink,1);
                }
            }
            S.player(PX,PY,0,{kick});
            S.target('eraserMonster',12.6,PY,k,0.78);
        }
    },
    inkBarrier:{
        period:3.4,
        draw(S,k,t) {
            S.player(PX,PY,0);
            S.enemy('sprayer',13,PY-1.2);
            S.enemy('doodle',12.5,PY+1.6);
            const on=seg(k,0.12,0.2);
            const off=1-seg(k,0.86,0.9);
            const live=on*off;
            for (let i=0;i<6;i++) {
                const k0=0.18+i*0.1;
                const y0=PY-1.2+(i%2)*2.8;
                if (k>=k0&&k<=k0+0.18) {
                    const f=seg(k,k0,k0+0.18);
                    S.bullet(lerp(12.3,PX+1.5,f),lerp(y0,PY+(y0-PY)*0.3,f),'enemy');
                }
            }
            if (live>0) {
                const c=S.ctx;
                const n=12;
                const blink=k>0.72&&Math.floor(t*10)%2===0;
                for (let i=0;i<n&&!blink;i++) {
                    const an=t*0.8+i*Math.PI*2/n;
                    const r=1.45*(0.5+0.5*live);
                    c.save();
                    c.globalAlpha=live;
                    c.translate(PX+Math.cos(an)*r,PY+Math.sin(an)*r);
                    c.rotate(an);
                    c.fillStyle=PALETTE.paper;
                    c.fillRect(-0.12,-0.42,0.24,0.84);
                    c.strokeStyle=PALETTE.ink;
                    c.lineWidth=0.07;
                    c.strokeRect(-0.12,-0.42,0.24,0.84);
                    c.restore();
                }
            }
        }
    },
    freezeAll:{
        period:3.4,
        draw(S,k) {
            const fz=0.3;
            const un=0.85;
            const te=k<fz?k:(k<un?fz:k-(un-fz));
            const frozen=k>=fz&&k<un;
            S.player(PX,PY,0);
            const ex1=lerp(14,11,seg(te,0,0.6));
            const ex2=lerp(13,10,seg(te,0,0.6));
            const kill=0.72;
            S.target('doodle',ex1,2.6,k,kill,{shake:frozen?0.01:0});
            S.enemy('blob',ex2,6.3);
            for (let i=0;i<5;i++) {
                const k0=0.02+i*0.06;
                const f=(te-k0)/0.5;
                if (f>=0&&f<=1) {
                    S.bullet(lerp(12,PX,f),lerp(2.6+i*0.9,PY,f*0.5),frozen?'frozen':'enemy');
                }
            }
            S.stream(PX+0.9,PY,ex1,2.6,k,0.4,0.66,0.06,0.1);
            const a=seg(k,fz,fz+0.03)*(1-seg(k,un-0.03,un));
            if (a>0) {
                S.rect(0,0,SW,SH,PALETTE.paper,0.25*a);
                const c=S.ctx;
                c.globalAlpha=a;
                c.strokeStyle=PALETTE.ink;
                c.lineWidth=0.35;
                c.strokeRect(0.4,0.4,SW-0.8,SH-0.8);
                c.globalAlpha=1;
                for (let i=0;i<12;i++) {
                    S.rect(0.9+i*1.2,0.1,0.5,0.25,PALETTE.ink,a);
                    S.rect(0.9+i*1.2,SH-0.35,0.5,0.25,PALETTE.ink,a);
                }
            }
        }
    },
    paperBlade:{
        period:2.8,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const f=seg(k,0.12,0.75);
            const out=f<0.5;
            const d=out?(1-Math.pow(1-f*2,2))*9:(1-Math.pow((f-0.5)*2,2))*9;
            const bx=PX+0.8+d;
            const foes=[['doodle',7.5,PY+0.2],['blob',10.8,PY-0.3]];
            for (const [id,x,y] of foes) {
                const hitA=0.12+0.63*0.5*(1-Math.sqrt(1-(x-PX-0.8)/9));
                const flash=(Math.abs(bx-x)<0.9&&f>0&&f<1)?1:0;
                S.enemy(id,x,y,{flash,shake:flash?t:0});
                if (k>hitA&&k<hitA+0.25) {
                    S.num('22',x,y-0.5,seg(k,hitA,hitA+0.25),PALETTE.ink,15);
                }
            }
            if (f>0&&f<1) {
                const c=S.ctx;
                c.save();
                c.translate(bx,PY);
                c.rotate(t*18);
                S.path([[0,-0.5],[0.45,0.3],[-0.45,0.3]],PALETTE.farGray,0,1,true);
                S.path([[0,-0.5],[0.45,0.3],[-0.45,0.3],[0,-0.5]],PALETTE.ink,0.07);
                c.restore();
            }
        }
    },
    blot:{
        period:2.8,
        draw(S,k) {
            S.player(8,PY,0);
            const hit=0.4;
            for (let i=0;i<12;i++) {
                const an=i/12*Math.PI*2+hash(i);
                const r0=3.2+hash(i+3)*0.8;
                const r=k<hit?lerp(r0+1.5,r0,seg(k,0,hit)):lerp(r0,0.3,easeOut(seg(k,hit,hit+0.15)));
                if (k<hit+0.15) {
                    S.bullet(8+Math.cos(an)*r,PY+Math.sin(an)*r*0.8,'enemy',k<hit?1:1-seg(k,hit,hit+0.15));
                }
            }
            S.ring(8,PY,lerp(4.2,0.5,seg(k,hit,hit+0.15)),PALETTE.ink,0.1,k>hit&&k<hit+0.15?1:0);
            S.num('+3',8,PY-0.6,seg(k,hit+0.1,hit+0.6),PALETTE.ink,18);
        }
    },
    inkField:{
        period:3.2,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const cx=10.5;
            const on=seg(k,0.1,0.18)*(1-seg(k,0.85,0.95));
            S.circle(cx,PY,2.4*on,PALETTE.midGray,0.45);
            S.ring(cx,PY,2.4,PALETTE.ink,0.08,on);
            for (let i=0;i<7;i++) {
                const x=cx+(hash(i)-0.5)*3.6;
                const y=PY+(hash(i+9)-0.5)*3;
                const h=0.35+0.25*Math.abs(Math.sin(t*6+i));
                S.path([[x-0.18,y],[x,y-h*on],[x+0.18,y]],PALETTE.ink,0,on,true);
            }
            const ex=lerp(15,6,seg(k,0.15,0.95));
            const inside=Math.abs(ex-cx)<2.4&&on>0.5;
            S.enemy('doodle',ex,PY+0.6,{flash:inside?(Math.floor(t*8)%2):0});
            if (inside) {
                S.num('6',ex,PY,(t*4)%1,PALETTE.red,14);
            }
        }
    },
    clusterBomb:{
        period:3,
        draw(S,k) {
            S.player(PX,PY,0);
            const tx=10.5;
            const hit=0.45;
            if (k>=0.12&&k<hit) {
                const f=(k-0.12)/(hit-0.12);
                S.circle(lerp(PX+0.8,tx,f),PY-Math.sin(f*Math.PI)*3,0.32,PALETTE.ink);
            }
            const e=seg(k,hit,hit+0.15);
            if (e>0&&e<1) {
                S.ring(tx,PY,2*easeOut(e),PALETTE.ink,0.2*(1-e)+0.05);
                S.burst(tx,PY,2.5,e,PALETTE.ink);
            }
            for (let i=0;i<4;i++) {
                const an=i/4*Math.PI*2+0.6;
                const x=tx+Math.cos(an)*2.4;
                const y=PY+Math.sin(an)*2.2;
                const k0=hit+0.1+i*0.06;
                const f=seg(k,hit,k0);
                if (k>hit&&k<k0) {
                    S.circle(lerp(tx,x,f),lerp(PY,y,f)-Math.sin(f*Math.PI)*1.2,0.16,PALETTE.ink);
                }
                const ee=seg(k,k0,k0+0.12);
                if (ee>0&&ee<1) {
                    S.ring(x,y,1.2*easeOut(ee),PALETTE.ink,0.12*(1-ee)+0.04);
                }
                if (k>k0) {
                    S.circle(x,y,0.7,PALETTE.midGray,0.35*(1-seg(k,0.85,1)));
                }
            }
            S.target('blob',tx,PY,k,hit);
            S.target('doodle',tx+2.2,PY-2,k,hit+0.16);
            S.target('bird',tx-2,PY+2.1,k,hit+0.28);
        }
    },
    haste:{
        period:2.8,
        draw(S,k,t) {
            const on=seg(k,0.1,0.15)*(1-seg(k,0.85,0.9));
            const x=lerp(2.5,13.5,inOut(seg(k,0.15,0.85)));
            const y=PY+Math.sin(k*Math.PI*4)*1.5;
            if (on>0) {
                for (let i=1;i<5;i++) {
                    S.line(x-i*0.5,y+(hash(i+Math.floor(t*10))-0.5)*0.6,x-i*0.5-0.8,y,PALETTE.midGray,0.07,on*(1-i*0.2));
                }
            }
            S.player(x,y,0);
            S.text('×1.4',x,y-1.2,14,PALETTE.ink,on);
            S.ring(2.5,PY,0.9+seg(k,0.1,0.25),PALETTE.ink,0.08,1-seg(k,0.1,0.25));
        }
    },
    echo:{
        period:3.4,
        draw(S,k) {
            S.player(PX,PY,0);
            const drop=(k0)=>{
                const f=seg(k,k0,k0+0.25);
                if (f>0&&f<1) {
                    S.circle(lerp(PX+0.8,10.5,f),PY-Math.sin(f*Math.PI)*2.5,0.3,PALETTE.ink);
                }
                const e=seg(k,k0+0.25,k0+0.4);
                if (e>0&&e<1) {
                    S.ring(10.5,PY,2*easeOut(e),PALETTE.ink,0.18*(1-e)+0.04);
                    S.burst(10.5,PY,2.4,e,PALETTE.ink);
                }
            };
            drop(0.08);
            S.ring(PX,PY,0.8+seg(k,0.5,0.62)*1.4,PALETTE.red,0.1,k>0.5&&k<0.62?1-seg(k,0.5,0.62):0);
            S.text('×2',PX,PY-1.3,16,PALETTE.red,seg(k,0.5,0.55)*(1-seg(k,0.85,0.9)));
            drop(0.55);
            S.target('doodle',10.3,PY-0.8,k,0.33);
            S.target('eraserMonster',10.8,PY+0.6,k,0.8);
        }
    },
    inkStorm:{
        period:3.4,
        draw(S,k,t) {
            S.player(PX,PY,0);
            const on=seg(k,0.05,0.12)*(1-seg(k,0.88,0.95));
            S.rect(0,0,SW,SH,PALETTE.ink,0.12*on);
            const foes=[['doodle',9,2.4],['blob',12,4.8],['bird',10,7],['compass',13.5,2.2]];
            const strikes=[[0,0.2],[1,0.32],[2,0.44],[3,0.56],[1,0.68],[0,0.8]];
            const dead=new Set([0]);
            for (let i=0;i<foes.length;i++) {
                const [id,x,y]=foes[i];
                let flash=0;
                for (const [fi,kk] of strikes) {
                    if (fi===i&&k>kk&&k<kk+0.06) {
                        flash=1;
                    }
                }
                S.target(id,x,y,k,dead.has(i)?0.8:null,{flash});
            }
            for (const [fi,kk] of strikes) {
                const a=seg(k,kk,kk+0.02)*(1-seg(k,kk+0.06,kk+0.1));
                if (a>0) {
                    const [,x,y]=foes[fi];
                    jag(S,x+(hash(fi)-0.5)*2,0,x,y,fi+Math.floor(t*30),PALETTE.red,0.14,a);
                    S.ring(x,y,0.9,PALETTE.red,0.08,a);
                    S.num('40',x,y-0.6,seg(k,kk,kk+0.25),PALETTE.red,15);
                }
            }
        }
    }
};

function alarmMeter(S,x,y,k,a=1) {
    S.rect(x-1.3,y-0.17,2.6,0.34,PALETTE.paper,a);
    S.rect(x-1.3,y-0.17,2.6*clamp01(k),0.34,PALETTE.red,a);
    S.line(x-1.3+2.6*0.6,y-0.17,x-1.3+2.6*0.6,y+0.17,PALETTE.ink,0.04,a);
    const c=S.ctx;
    c.globalAlpha=a;
    c.strokeStyle=PALETTE.ink;
    c.lineWidth=0.06;
    c.strokeRect(x-1.3,y-0.17,2.6,0.34);
    c.globalAlpha=1;
}

function alarmRay(S,cx,cy,a,r0,r1,color,w,al=1) {
    S.line(cx+Math.cos(a)*r0,cy+Math.sin(a)*r0,cx+Math.cos(a)*r1,cy+Math.sin(a)*r1,color,w,al);
}

function alarmPad(S,x,y,k,hold,done=0) {
    if (k<=0) {
        return;
    }
    const r=0.9*easeOut(Math.min(1,k));
    S.circle(x,y,r,PALETTE.red,done>0?0.3:0.12+0.1*Math.sin(k*40));
    S.ring(x,y,r,PALETTE.red,0.08,1,[0.25,0.18]);
    if (hold>0) {
        S.ring(x,y,r*1.25,PALETTE.red,0.1,1,null,-Math.PI/2,-Math.PI/2+Math.PI*2*clamp01(hold));
    }
}

export const ENEMY_ATTACKS={
    stampSoldier:[
        {
            key:'stamp',
            dmg:{kind:'hit',n:1},
            period:3.2,
            draw(S,k) {
                S.player(PX+1,PY,0);
                const sx=12;
                const tx=PX+1.6;
                const ring=seg(k,0.1,0.25)*(1-seg(k,0.55,0.58));
                S.ring(tx,PY,1.8,PALETTE.red,0.1,ring,[0.3,0.2]);
                const f=seg(k,0.25,0.55);
                const x=lerp(sx,tx,f);
                const y=PY-Math.sin(f*Math.PI)*3;
                const land=seg(k,0.55,0.6);
                const pud=seg(k,0.55,0.62)*(1-seg(k,0.9,1));
                S.circle(tx,PY,1.8*Math.min(1,pud*1.4),PALETTE.ink,0.3*pud);
                S.ring(tx,PY,1.8,PALETTE.ink,0.06,0.6*pud,[0.2,0.16]);
                S.enemy('stampSoldier',k<0.55?x:tx,k<0.55?y:PY,{size:1.8,sx:land>0&&land<1?1.3:1});
                S.burst(tx,PY,2,seg(k,0.55,0.75),PALETTE.ink);
            }
        },
        {
            key:'elite',
            dmg:{kind:'bullet',n:1},
            period:3.6,
            draw(S,k) {
                S.player(PX,PY,0);
                const pts=[[13,PY],[9,PY-1.5],[6.5,PY+1.2]];
                let x=pts[0][0];
                let y=pts[0][1];
                for (let i=0;i<2;i++) {
                    const f=seg(k,0.1+i*0.35,0.35+i*0.35);
                    if (f>0) {
                        x=lerp(pts[i][0],pts[i+1][0],f);
                        y=lerp(pts[i][1],pts[i+1][1],f)-Math.sin(f*Math.PI)*2.4;
                    }
                    const lk=seg(k,0.35+i*0.35,0.65+i*0.35);
                    if (lk>0&&lk<1) {
                        for (let q=0;q<8;q++) {
                            const a=q/8*Math.PI*2;
                            S.bullet(pts[i+1][0]+Math.cos(a)*(0.6+lk*4),pts[i+1][1]+Math.sin(a)*(0.6+lk*4),'enemy',1-lk);
                        }
                    }
                }
                S.enemy('stampSoldier',x,y,{size:1.9});
                S.ring(x,y+0.2,1.3,PALETTE.darkRed,0.12,1);
            }
        }
    ],
    scissorMinion:[
        {
            key:'cut',
            dmg:{kind:'hit',n:1},
            period:4,
            draw(S,k) {
                const x0=5;
                const x1=11;
                const y0=2;
                const y1=7;
                const cor=[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
                const leave=seg(k,0.45,0.6);
                S.player(lerp(8,13.5,leave),PY,0);
                const a=seg(k,0.03,0.12)*(1-seg(k,0.86,0.9));
                const f=seg(k,0.18,0.82)*4;
                let mx=12.5;
                let my=8;
                for (let i=0;i<4;i++) {
                    const [ax,ay]=cor[i];
                    const [bx,by]=cor[i+1];
                    S.line(ax,ay,bx,by,PALETTE.red,0.08,a,[0.35,0.25]);
                    const p=Math.max(0,Math.min(1,f-i));
                    if (p>0) {
                        S.line(ax,ay,lerp(ax,bx,p),lerp(ay,by,p),PALETTE.ink,0.18,a);
                        if (p<1) {
                            mx=lerp(ax,bx,p);
                            my=lerp(ay,by,p);
                        }
                    }
                }
                const run=seg(k,0.1,0.18);
                if (k<0.18) {
                    mx=lerp(12.5,x0,run);
                    my=lerp(8,y0,run);
                }
                else if (f>=4) {
                    mx=x0;
                    my=y0;
                }
                const piece=seg(k,0.82,0.86)*(1-seg(k,0.9,1));
                S.rect(x0,y0,x1-x0,y1-y0,PALETTE.farGray,0.8*piece);
                S.burst(8,PY,3,seg(k,0.82,0.95),PALETTE.midGray);
                S.enemy('scissorMinion',mx,my,{size:1.8});
            }
        },
        {
            key:'team',
            dmg:{kind:'hit',n:1},
            period:3.4,
            draw(S,k) {
                const x0=5;
                const x1=11;
                const y0=2;
                const y1=7;
                const cor=[[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
                S.player(8,PY,0,{flash:seg(k,0.7,0.73)*(1-seg(k,0.73,0.85))});
                const a=seg(k,0.03,0.12)*(1-seg(k,0.86,0.9));
                const f=seg(k,0.15,0.7)*2;
                const ends=[[x0,y0],[x1,y1]];
                for (let i=0;i<4;i++) {
                    S.line(cor[i][0],cor[i][1],cor[i+1][0],cor[i+1][1],PALETTE.red,0.08,a,[0.35,0.25]);
                }
                for (const st of [0,2]) {
                    for (let i=0;i<2;i++) {
                        const [ax,ay]=cor[st+i];
                        const [bx,by]=cor[st+i+1];
                        const p=Math.max(0,Math.min(1,f-i));
                        if (p>0) {
                            S.line(ax,ay,lerp(ax,bx,p),lerp(ay,by,p),PALETTE.ink,0.18,a);
                            ends[st/2]=[lerp(ax,bx,p),lerp(ay,by,p)];
                        }
                    }
                }
                S.rect(x0,y0,x1-x0,y1-y0,PALETTE.farGray,0.8*seg(k,0.7,0.74)*(1-seg(k,0.8,0.9)));
                S.num('-1',8,PY-0.6,seg(k,0.72,0.95),PALETTE.red,16);
                S.enemy('scissorMinion',ends[0][0],ends[0][1],{size:1.8});
                S.enemy('scissorMinion',ends[1][0],ends[1][1],{size:1.8});
            }
        }
    ],
    exam:[
        {
            key:'zone',
            dmg:{kind:'hit',n:1},
            period:3.4,
            draw(S,k) {
                S.player(PX+1,PY,0);
                S.enemy('exam',13,PY);
                const spots=[[PX+1,PY],[6,2.2],[7.5,6.8],[2.6,7.6]];
                spots.forEach(([x,y],i)=>{
                    const a=seg(k,0.15,0.3);
                    const boom=seg(k,0.55+i*0.06,0.65+i*0.06);
                    S.ring(x,y,1.3,PALETTE.red,0.09,a*(1-boom),[0.25,0.18]);
                    S.burst(x,y,1.6,boom,PALETTE.red);
                });
            }
        },
        {
            key:'quiet',
            dmg:{kind:'bullet',n:1},
            period:3.4,
            draw(S,k) {
                const shoot=k>0.45&&k<0.55;
                S.player(PX,PY,0,{kick:shoot?1:0});
                const spin=seg(k,0.58,0.72);
                S.enemy('exam',12,PY,{rot:-spin*Math.PI*2});
                S.ring(12,PY,2.6,PALETTE.red,0.08,seg(k,0.05,0.2)*(1-seg(k,0.9,1)),[0.3,0.2]);
                S.fly(PX+0.9,PY,11,PY,k,0.46,0.6);
                for (let i=0;i<12;i++) {
                    const a=Math.PI+i/12*Math.PI*2;
                    const k0=0.58+i/12*0.14;
                    S.fly(12+Math.cos(a)*1.2,PY+Math.sin(a)*1.2,12+Math.cos(a)*9,PY+Math.sin(a)*9,k,k0,k0+0.22,'enemy');
                }
                S.text('!',12,PY-2.6,20,PALETTE.red,seg(k,0.55,0.6)*(1-seg(k,0.85,0.9)));
            }
        },
        {
            key:'grade',
            dmg:{kind:'bullet',n:1},
            period:3.2,
            draw(S,k) {
                S.player(PX,PY,0);
                const ex=13;
                S.enemy('exam',ex,PY);
                for (let i=0;i<4;i++) {
                    const a=Math.PI+(i/3-0.5)*1.4;
                    const x1=ex+Math.cos(a)*12;
                    const y1=PY+Math.sin(a)*12;
                    S.tele(ex,PY,x1,y1,seg(k,0.05,0.35),1-seg(k,0.35,0.37));
                    S.stream(ex,PY,x1,y1,k,0.38,0.75,0.05,0.2,'enemy');
                }
            }
        },
        {
            key:'rest',
            dmg:{kind:'none',n:0},
            period:2.6,
            draw(S,k) {
                S.player(PX,PY,0);
                S.enemy('exam',11,PY,{shake:k>0.2?0.02:0});
                S.text('×2',11,PY-2.6,18,PALETTE.red,seg(k,0.1,0.2));
                S.stream(PX+0.9,PY,10,PY,k,0.2,0.8,0.08,0.15);
            }
        },
        {
            key:'tf',
            dmg:{kind:'hit',n:2},
            period:3.6,
            draw(S,k) {
                const cx=8;
                const move=seg(k,0.25,0.42);
                S.player(lerp(11,5,move),PY+1.5,0);
                S.enemy('exam',8,1.2,{size:2});
                const a=seg(k,0.05,0.15)*(1-seg(k,0.85,0.95));
                S.line(cx,0.2,cx,8.8,PALETTE.red,0.08,a);
                S.line(cx+1,1.2,15,8,PALETTE.red,0.12,a*(1-seg(k,0.6,0.62)));
                S.line(cx+1,8,15,1.2,PALETTE.red,0.12,a*(1-seg(k,0.6,0.62)));
                S.ring(4,PY+0.6,2,PALETTE.ink,0.14,a);
                const hit=seg(k,0.6,0.63)*(1-seg(k,0.8,0.9));
                for (let i=0;i<5;i++) {
                    S.line(cx+0.8+i*1.5,0.3,cx+0.8+i*1.5,8.7,PALETTE.ink,1.2,hit);
                }
            }
        },
        {
            key:'blank',
            dmg:{kind:'hit',n:1},
            period:4,
            draw(S,k) {
                const cw=3.6;
                const ch=2.7;
                const x0=0.8;
                const y0=0.45;
                const safe=[2,4,11];
                const order=[0,7,9,1,10,5,3,8,6];
                const pc=seg(k,0.15,0.35);
                S.player(lerp(x0+cw*1.5,x0+cw*0.5,pc),lerp(y0+ch*0.5,y0+ch*1.5,pc),0);
                const a=seg(k,0.03,0.12)*(1-seg(k,0.88,0.96));
                for (let i=0;i<=4;i++) {
                    S.line(x0+i*cw,y0,x0+i*cw,y0+ch*3,PALETTE.red,0.06,a);
                }
                for (let i=0;i<=3;i++) {
                    S.line(x0,y0+i*ch,x0+cw*4,y0+i*ch,PALETTE.red,0.06,a);
                }
                for (const c of safe) {
                    S.ring(x0+(c%4)*cw+cw/2,y0+Math.floor(c/4)*ch+ch/2,ch*0.3,PALETTE.ink,0.12,a);
                }
                order.forEach((c,i)=>{
                    const f=seg(k,0.4+i*0.04,0.43+i*0.04)*(1-seg(k,0.85,0.95));
                    S.rect(x0+(c%4)*cw+0.1,y0+Math.floor(c/4)*ch+0.1,cw-0.2,ch-0.2,PALETTE.ink,0.85*f);
                });
            }
        },
        {
            key:'essay',
            dmg:{kind:'hit',n:1},
            period:3.6,
            draw(S,k) {
                const pts=[];
                for (let i=0;i<=20;i++) {
                    const f=i/20;
                    pts.push([lerp(14,5,f),PY+Math.sin(f*9)*1.4]);
                }
                const f=seg(k,0.05,0.75);
                const n=Math.floor(f*20);
                for (let i=1;i<=n;i++) {
                    const age=f-i/20;
                    const live=age>0.08;
                    S.line(pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1],live?PALETTE.ink:PALETTE.red,live?0.45:0.08,1-seg(k,0.85,0.98));
                }
                const e=pts[Math.min(20,n)];
                S.enemy('exam',e[0],e[1]-0.6,{size:1.8});
                S.player(lerp(10,2.2,f),lerp(7.6,7.8,f),0);
            }
        }
    ],
    alarm:[
        {
            key:'second',
            dmg:{kind:'hit',n:1},
            period:4.2,
            draw(S,k) {
                const cx=11;
                const a0=Math.PI*0.6;
                const dash=seg(k,0.34,0.4);
                S.player(5,lerp(PY+1.3,PY-1.3,easeOut(dash)),-Math.PI/2,{flash:dash>0&&dash<1?0.5:0});
                if (dash>0&&dash<1) {
                    S.line(5,PY+1.3,5,lerp(PY+1.3,PY-1.3,easeOut(dash)),PALETTE.midGray,0.3,0.5);
                }
                S.enemy('alarm',cx,PY,{size:2.6});
                S.tele(cx+Math.cos(a0)*1.4,PY+Math.sin(a0)*1.4,cx+Math.cos(a0)*10,PY+Math.sin(a0)*10,seg(k,0.02,0.15),1-seg(k,0.2,0.22));
                const f=seg(k,0.22,0.9);
                if (f>0&&f<1) {
                    alarmRay(S,cx,PY,a0+Math.PI*2*f,1.4,11,PALETTE.ink,0.14);
                }
            }
        },
        {
            key:'hands',
            dmg:{kind:'hit',n:1},
            period:4.4,
            draw(S,k) {
                const cx=11;
                const g0=4.4;
                const g1=5.9;
                const near=seg(k,0.05,0.2);
                S.player(lerp(PX,cx-5.15,near),PY,0);
                S.enemy('alarm',cx,PY,{size:2.6});
                const f=seg(k,0.25,0.92);
                const a1=Math.PI*0.75+f*2.2;
                const a2=Math.PI*0.25+f*4.2;
                S.ring(cx,PY,(g0+g1)/2,PALETTE.red,0.04,0.5*(1-seg(k,0.92,1)),[0.2,0.2]);
                for (const a of [a1,a2]) {
                    if (k<0.25) {
                        S.tele(cx+Math.cos(a)*1.4,PY+Math.sin(a)*1.4,cx+Math.cos(a)*g0,PY+Math.sin(a)*g0,seg(k,0.05,0.2));
                        S.tele(cx+Math.cos(a)*g1,PY+Math.sin(a)*g1,cx+Math.cos(a)*11,PY+Math.sin(a)*11,seg(k,0.05,0.2));
                    }
                    else if (f<1) {
                        alarmRay(S,cx,PY,a,1.4,g0,PALETTE.ink,0.4);
                        alarmRay(S,cx,PY,a,g1,12,PALETTE.ink,0.4);
                    }
                }
            }
        },
        {
            key:'chime',
            dmg:{kind:'hit',n:1},
            period:3.6,
            draw(S,k) {
                const cx=11;
                const step=easeOut(seg(k,0.22,0.36));
                S.player(5,PY+step*2,0);
                S.enemy('alarm',cx,PY,{size:2.6});
                S.text('9:00',cx,PY-2.2,18,PALETTE.red,seg(k,0.03,0.08)*(1-seg(k,0.7,0.75)));
                const live=seg(k,0.48,0.5)*(1-seg(k,0.66,0.72));
                for (const a of [Math.PI,-Math.PI/2]) {
                    if (live<=0) {
                        S.tele(cx+Math.cos(a)*1.4,PY+Math.sin(a)*1.4,cx+Math.cos(a)*10,PY+Math.sin(a)*10,seg(k,0.08,0.3),k<0.5?1:0);
                    }
                    else {
                        alarmRay(S,cx,PY,a,1.4,11,PALETTE.ink,0.4,live);
                    }
                }
            }
        },
        {
            key:'bells',
            dmg:{kind:'hit',n:1},
            period:3.6,
            draw(S,k) {
                const cx=11;
                const dash=seg(k,0.62,0.7);
                const x=lerp(4,7,easeOut(dash));
                S.player(x,PY,0,{flash:dash>0&&dash<1?0.5:0});
                if (dash>0&&dash<1) {
                    S.line(4,PY,x,PY,PALETTE.midGray,0.3,0.5);
                }
                const tele=k<0.22;
                S.enemy('alarm',cx,PY,{size:2.6,shake:tele?k:0});
                if (tele) {
                    for (let j=0;j<3;j++) {
                        const f=(k/0.1+j/3)%1;
                        S.ring(cx,PY,0.8+f*5,PALETTE.red,0.12,(1-f)*0.8*seg(k,0,0.04));
                    }
                }
                const f=seg(k,0.22,0.85);
                if (f>0&&f<1) {
                    S.ring(cx,PY,0.6+f*9,PALETTE.ink,0.24,1-f*0.6);
                }
            }
        },
        {
            key:'hop',
            dmg:{kind:'hit',n:1},
            period:4.4,
            draw(S,k) {
                const home=[12,PY];
                const pts=[[5,3],[6.5,6.6]];
                const legs=[[home,pts[0],0.08],[pts[0],pts[1],0.4],[pts[1],home,0.72]];
                const px=lerp(5,8,inOut(seg(k,0.2,0.32)));
                const py=lerp(3,3.4,seg(k,0.2,0.32))+lerp(0,3.4,inOut(seg(k,0.5,0.62)));
                S.player(k<0.4?px:lerp(8,9.5,seg(k,0.5,0.62)),k<0.4?py:lerp(3.4,PY,seg(k,0.5,0.62)),0);
                let x=home[0];
                let y=home[1];
                let lift=0;
                for (const [a,b,t0] of legs) {
                    const tele=seg(k,t0,t0+0.14);
                    const air=seg(k,t0+0.14,t0+0.24);
                    if (tele>0&&air<1) {
                        S.ring(b[0],b[1],1.3,PALETTE.red,0.08,0.9,[0.25,0.18]);
                        S.circle(b[0],b[1],1.3*tele,PALETTE.red,0.15);
                    }
                    if (air>0) {
                        x=lerp(a[0],b[0],air);
                        y=lerp(a[1],b[1],air);
                        lift=Math.sin(air*Math.PI)*2;
                    }
                    const w=seg(k,t0+0.24,t0+0.34);
                    if (w>0&&w<1) {
                        S.ring(b[0],b[1],1.3+w*2.5,PALETTE.ink,0.18,1-w);
                    }
                }
                S.circle(x,y+0.9,0.9*(1-lift*0.15),PALETTE.ink,0.12);
                S.enemy('alarm',x,y-lift,{size:2.2});
            }
        },
        {
            key:'burst',
            dmg:{kind:'hit',n:2},
            period:5,
            draw(S,k) {
                const cx=11;
                S.player(4.2,PY+1.6,0);
                const fill=seg(k,0,0.15);
                const on=k>=0.15&&k<0.92;
                S.enemy('alarm',cx,PY,{size:2.6,shake:on?k:0});
                alarmMeter(S,cx,PY-2,lerp(0.7,1,fill),1);
                S.text('!',cx+1.7,PY-2,18,PALETTE.red,on?0.6+0.4*Math.sin(k*60):0);
                const w=seg(k,0.18,0.45);
                if (w>0&&w<1) {
                    S.ring(cx,PY,1.4+w*12,PALETTE.red,0.35,1-w*0.5);
                }
                const f=seg(k,0.62,0.92);
                const n=6;
                for (let i=0;i<n;i++) {
                    const a=i/n*Math.PI*2+f*1.2;
                    if (k<0.62) {
                        S.tele(cx+Math.cos(a)*1.4,PY+Math.sin(a)*1.4,cx+Math.cos(a)*10,PY+Math.sin(a)*10,seg(k,0.5,0.6));
                    }
                    else if (f<1) {
                        alarmRay(S,cx,PY,a,1.4,11,PALETTE.ink,0.3);
                    }
                }
                S.text('×3',cx,PY+2.2,18,PALETTE.red,seg(k,0.62,0.66)*(1-seg(k,0.88,0.92)));
            }
        },
        {
            key:'press',
            dmg:{kind:'none',n:0},
            period:4.6,
            draw(S,k) {
                const cx=11;
                const pad=[3,7.2];
                const bar=lerp(0.45,0.75,seg(k,0,0.2));
                const hit=seg(k,0.45,0.5);
                const walk=inOut(seg(k,0.15,0.35));
                const px=lerp(6,pad[0],walk);
                const py=lerp(3,pad[1],walk);
                S.player(px,py,Math.PI/2);
                alarmPad(S,pad[0],pad[1],seg(k,0.12,0.2)*(1-seg(k,0.55,0.6)),seg(k,0.35,0.5),hit);
                const z=k>=0.5;
                S.enemy('alarm',cx,PY,{size:2.6,rot:z?0.25:0,flash:hit>0&&hit<1?1-hit:0});
                alarmMeter(S,cx,PY-2,z?0:bar);
                S.text('Zzz',cx+1.4,PY-2.6-seg(k,0.5,1)*0.4,16,PALETTE.ink,z?1-seg(k,0.9,1):0);
                S.text('×2',cx,PY+2.2,18,PALETTE.red,z?1-seg(k,0.9,1):0);
                S.num('+1',px,py,seg(k,0.5,0.75),PALETTE.ink,15);
                if (z) {
                    S.stream(px+0.9,py-0.4,cx-0.8,PY+0.4,k,0.55,0.85,0.06,0.12);
                }
            }
        },
        {
            key:'double',
            dmg:{kind:'hit',n:1},
            period:4.6,
            draw(S,k) {
                const cx=11;
                const g0=4.4;
                const g1=5.9;
                const near=seg(k,0.05,0.2);
                S.player(lerp(PX,cx-5.15,near),PY,0);
                const flip=0.58;
                const ding=seg(k,flip-0.08,flip)*(1-seg(k,flip,flip+0.04));
                S.enemy('alarm',cx,PY,{size:2.6,shake:ding>0?k:0});
                S.text('!',cx+1.6,PY-2,18,PALETTE.red,ding);
                S.ring(cx,PY,(g0+g1)/2,PALETTE.red,0.04,0.5*(1-seg(k,0.92,1)),[0.2,0.2]);
                const f=seg(k,0.25,0.92);
                const fwd=Math.min(f,flip-0.25>0?(flip-0.25)/0.67:0);
                const u=fwd-Math.max(0,f-fwd);
                for (let i=0;i<3;i++) {
                    const a=Math.PI*0.75+i*Math.PI*2/3+u*[3,5,-4][i];
                    if (k<0.25) {
                        S.tele(cx+Math.cos(a)*1.4,PY+Math.sin(a)*1.4,cx+Math.cos(a)*g0,PY+Math.sin(a)*g0,seg(k,0.05,0.2));
                        S.tele(cx+Math.cos(a)*g1,PY+Math.sin(a)*g1,cx+Math.cos(a)*11,PY+Math.sin(a)*11,seg(k,0.05,0.2));
                    }
                    else if (f<1) {
                        alarmRay(S,cx,PY,a,1.4,g0,PALETTE.ink,0.4);
                        alarmRay(S,cx,PY,a,g1,12,PALETTE.ink,0.4);
                    }
                }
                S.text('×1.4',cx,PY+2.3,15,PALETTE.red,seg(k,0.25,0.3)*(1-seg(k,0.9,0.95)));
            }
        }
    ],
    bookFinal:[
        {
            key:'flip',
            dmg:{kind:'hit',n:1},
            period:3.4,
            draw(S,k) {
                const step=seg(k,0.25,0.42);
                S.player(5+step*1.6,PY+step*1.4,0);
                S.enemy('bookFinal',12.5,PY,{size:2.6});
                const lines=[[0,PY,16,PY],[5,0,5,9],[0,1.6,16,1.6]];
                lines.forEach((q,i)=>{
                    const tk=seg(k,0.05+i*0.06,0.3+i*0.06);
                    const live=seg(k,0.5,0.53)*(1-seg(k,0.75,0.85));
                    const mx=(q[0]+q[2])/2;
                    const my=(q[1]+q[3])/2;
                    if (live<=0) {
                        S.line(mx+(q[0]-mx)*tk,my+(q[1]-my)*tk,mx+(q[2]-mx)*tk,my+(q[3]-my)*tk,PALETTE.red,0.08,tk>0?1-seg(k,0.48,0.5):0);
                    }
                    else {
                        S.line(q[0],q[1],q[2],q[3],PALETTE.ink,0.45,live);
                    }
                });
            }
        },
        {
            key:'sweep',
            dmg:{kind:'hit',n:1},
            period:3.6,
            draw(S,k) {
                const cx=9.5;
                const near=seg(k,0.15,0.35);
                S.player(lerp(PX,cx-1.5,near),lerp(PY,PY+0.6,near),0);
                S.enemy('bookFinal',cx,PY,{size:2.4});
                S.ring(cx,PY,2.1,PALETTE.red,0.05,0.8*(1-seg(k,0.85,0.95)),[0.2,0.15]);
                const a0=Math.PI*0.62;
                const arc=2.6;
                const tele=seg(k,0.05,0.25)*(1-seg(k,0.4,0.42));
                for (const a of [a0,a0+arc]) {
                    S.line(cx+Math.cos(a)*2.1,PY+Math.sin(a)*2.1,cx+Math.cos(a)*9,PY+Math.sin(a)*9,PALETTE.red,0.07,tele);
                }
                const f=seg(k,0.42,0.8);
                if (f>0&&f<1) {
                    const a=a0+arc*f;
                    S.line(cx+Math.cos(a)*2.1,PY+Math.sin(a)*2.1,cx+Math.cos(a)*9,PY+Math.sin(a)*9,PALETTE.ink,0.4,1);
                }
            }
        },
        {
            key:'seal',
            dmg:{kind:'none',n:0},
            period:4.4,
            draw(S,k) {
                const cx=9;
                S.player(PX,PY,0);
                S.enemy('bookFinal',cx,PY,{size:2.4});
                const marks=[[cx+3.6,1.6],[cx+3.6,7.4],[cx-1.8,1]];
                const all=seg(k,0.7,0.74);
                S.text('50%',cx,PY-2.4,16,PALETTE.red,seg(k,0.25,0.3)*(1-all));
                marks.forEach(([x,y],i)=>{
                    const f=seg(k,0.05,0.22);
                    const lx=lerp(cx,x,f);
                    const ly=lerp(PY,y,f)-Math.sin(f*Math.PI)*2;
                    const hit=0.35+i*0.12;
                    const gone=seg(k,hit+0.08,hit+0.11);
                    const a=(f>0?1:0)*(1-gone);
                    if (f>=1) {
                        S.line(x,y,cx,PY,PALETTE.red,0.05,a*0.8,[0.2,0.15]);
                    }
                    S.rect(lx-0.22,ly-0.7,0.44,1.3,PALETTE.ink,a);
                    S.rect(lx-0.24,ly-0.2,0.48,0.14,PALETTE.red,a);
                    S.stream(PX+0.9,PY,x,y,k,hit-0.1,hit+0.08,0.05,0.1);
                    S.burst(x,y,1,seg(k,hit+0.08,hit+0.25),PALETTE.red);
                });
                for (let q=0;q<5;q++) {
                    const a=Math.PI+(q/4-0.5)*0.8;
                    S.fly(cx,PY,cx+Math.cos(a)*7,PY+Math.sin(a)*7,k,0.3,0.55,'enemy');
                }
            }
        },
        {
            key:'mimic',
            dmg:{kind:'hit',n:1},
            period:3.4,
            draw(S,k) {
                S.player(PX+1,PY,0);
                S.enemy('bookFinal',12.5,PY);
                const spots=[[PX+1,PY],[5.8,2.4],[6.4,6.8]];
                spots.forEach(([x,y],i)=>{
                    S.ring(x,y,1.4,PALETTE.red,0.09,seg(k,0.1,0.2)*(1-seg(k,0.5+i*0.05,0.52+i*0.05)),[0.25,0.18]);
                    S.burst(x,y,2,seg(k,0.5+i*0.05,0.7+i*0.05),PALETTE.ink);
                });
                for (let i=0;i<5;i++) {
                    const a=Math.PI+(i/4-0.5)*0.8;
                    S.fly(11,PY,11+Math.cos(a)*9,PY+Math.sin(a)*9,k,0.72,0.95,'enemy');
                }
            }
        },
        {
            key:'rest',
            dmg:{kind:'none',n:0},
            period:2.6,
            draw(S,k) {
                S.player(PX,PY,0);
                S.enemy('bookFinal',11,PY);
                S.text('×3',11,PY-2.6,18,PALETTE.red,seg(k,0.1,0.2));
                S.stream(PX+0.9,PY,10,PY,k,0.2,0.8,0.08,0.15);
            }
        },
        {
            key:'scribble',
            dmg:{kind:'hit',n:1},
            period:3.8,
            draw(S,k) {
                const pts=[[13,2],[3,4],[12,7.6],[4,7.2]];
                S.player(8,PY+0.2,0);
                let x=pts[0][0];
                let y=pts[0][1];
                for (let i=0;i<3;i++) {
                    const t0=0.08+i*0.25;
                    S.tele(pts[i][0],pts[i][1],pts[i+1][0],pts[i+1][1],seg(k,t0,t0+0.1),1-seg(k,t0+0.1,t0+0.11));
                    const f=seg(k,t0+0.11,t0+0.2);
                    if (f>0) {
                        x=lerp(pts[i][0],pts[i+1][0],f);
                        y=lerp(pts[i][1],pts[i+1][1],f);
                        S.line(pts[i][0],pts[i][1],x,y,PALETTE.ink,0.4,1-seg(k,0.85,0.97));
                    }
                }
                S.enemy('bookFinal',x,y-1,{size:2.6});
            }
        }
    ],
    sprayer:[
        {
            key:'spread',
            dmg:{kind:'bullet',n:1},
            period:2.8,
            draw(S,k) {
                const ex=9.5+Math.sin(k*Math.PI*2)*0.3;
                const ey=PY;
                S.player(PX,PY,0);
                S.enemy('sprayer',ex,ey);
                const tf=seg(k,0.15,0.4);
                const ta=1-seg(k,0.4,0.42);
                for (let i=0;i<3;i++) {
                    const a=Math.PI+(i-1)*0.4;
                    S.tele(ex,ey,ex+Math.cos(a)*5,ey+Math.sin(a)*5,tf,ta);
                }
                for (let i=0;i<5;i++) {
                    const a=Math.PI+(i/4-0.5)*0.8;
                    const f=seg(k,0.42,0.72);
                    if (f>0&&f<1) {
                        S.bullet(ex+Math.cos(a)*(0.8+f*5),ey+Math.sin(a)*(0.8+f*5),'enemy',1-f*f);
                    }
                }
            }
        }
    ],
    doodle:[
        {
            key:'shot',
            dmg:{kind:'bullet',n:1},
            period:2.6,
            draw(S,k) {
                const ex=11.5+Math.sin(k*Math.PI*2)*0.3;
                const ey=3.4+Math.cos(k*Math.PI*2)*0.8;
                S.player(PX,PY,0,{flash:seg(k,0.62,0.66)*(1-seg(k,0.66,0.8))});
                S.enemy('doodle',ex,ey);
                S.tele(ex,ey,PX,PY,seg(k,0.2,0.4),1-seg(k,0.4,0.42));
                S.fly(ex,ey,PX+0.3,PY,k,0.42,0.62,'enemy');
                S.num('-1',PX,PY-0.5,seg(k,0.62,0.95),PALETTE.red,16);
            }
        }
    ],
    blob:[
        {
            key:'hop',
            dmg:{kind:'bullet',n:1},
            period:3.2,
            draw(S,k) {
                S.player(PX,PY,0);
                const hops=[[13.5,11.5],[11.5,9.5],[9.5,7.8]];
                let bx=13.5;
                let lift=0;
                for (let i=0;i<3;i++) {
                    const f=seg(k,0.05+i*0.2,0.2+i*0.2);
                    if (f>0) {
                        bx=lerp(hops[i][0],hops[i][1],f);
                        lift=Math.sin(f*Math.PI)*1.1;
                    }
                }
                S.circle(bx,PY+0.5,0.6*(1-lift*0.3),PALETTE.ink,0.15);
                S.enemy('blob',bx,PY-lift,{sx:1+(lift<0.05?0.15:0)});
                const land=0.65;
                for (let i=0;i<8;i++) {
                    const an=i*Math.PI/4;
                    const f=seg(k,land,land+0.3);
                    if (f>0&&f<1) {
                        S.bullet(7.8+Math.cos(an)*(0.8+f*5),PY+Math.sin(an)*(0.8+f*5),'enemy');
                    }
                }
            }
        },
        {
            key:'split',
            dmg:{kind:'hit',n:1},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const die=0.35;
                S.stream(PX+0.9,PY,10,PY,k,0.05,0.3,0.05,0.1);
                S.target('blob',10,PY,k,die);
                for (const dy of [-1.2,1.2]) {
                    const f=seg(k,die+0.1,0.95);
                    if (k>die+0.08) {
                        S.enemy('blobSmall',lerp(10.3,6,f),PY+dy*(1-f*0.5)-Math.abs(Math.sin(f*Math.PI*4))*0.4);
                    }
                }
            }
        }
    ],
    compass:[
        {
            key:'ring',
            dmg:{kind:'bullet',n:1},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=11;
                S.enemy('compass',cx,PY);
                const d=seg(k,0.1,0.4);
                S.ring(cx,PY,2.2,PALETTE.red,0.1,1-seg(k,0.42,0.5),null,0,Math.PI*2*d);
                for (let i=0;i<12;i++) {
                    const an=i*Math.PI/6;
                    const f=seg(k,0.42,0.9);
                    if (f>0&&f<1) {
                        S.bullet(cx+Math.cos(an)*(2.2+f*6),PY+Math.sin(an)*(2.2+f*6),'enemy');
                    }
                }
            }
        }
    ],
    eraserMonster:[
        {
            key:'charge',
            dmg:{kind:'hit',n:2},
            period:3.2,
            draw(S,k,t) {
                S.player(PX,6.8,0);
                S.box(4.5,PY-1.2,1.4,1.6);
                const tele=seg(k,0.1,0.35);
                const ch=seg(k,0.38,0.52);
                const ex=lerp(13,5.6,easeOut(ch));
                S.tele(13,PY-1.2,5,PY-1.2,tele,1-seg(k,0.36,0.4));
                S.enemy('eraserMonster',ex,PY-1.2,{shake:ch>=1&&k<0.9?0.02:0});
                if (ch>=1&&k<0.9) {
                    S.stars(ex,PY-1.2,t);
                }
                if (ch>0&&ch<1) {
                    S.line(ex+0.8,PY-1.2,ex+2.5,PY-1.2,PALETTE.midGray,0.5,0.4);
                }
            }
        },
        {
            key:'erase',
            dmg:{kind:'hit',n:2},
            period:3.2,
            draw(S,k) {
                S.player(PX,PY,0);
                const pts=[[7,1.5],[7.4,4.5],[7,7.5]];
                const tele=seg(k,0.1,0.3);
                const ch=seg(k,0.32,0.6);
                const ex=lerp(13.5,4.8,easeOut(ch));
                const gone=ex<7.8;
                if (!gone) {
                    S.wall(pts);
                }
                else {
                    S.wall([[7,1.5],[7.2,3.2]],1-seg(k,0.5,0.7));
                    S.wall([[7.2,5.8],[7,7.5]],1-seg(k,0.5,0.7));
                    S.burst(7.3,PY,1.6,seg(k,0.45,0.65),PALETTE.farGray);
                }
                S.tele(13.5,PY,5,PY,tele,1-seg(k,0.3,0.34));
                S.enemy('eraserMonster',ex,PY);
            }
        }
    ],
    bird:[
        {
            key:'swoop',
            dmg:{kind:'hit',n:1},
            period:3.2,
            draw(S,k) {
                S.player(PX+2,PY,0);
                let bx;
                let by;
                if (k<0.45) {
                    const an=k*9;
                    bx=10+Math.cos(an)*3;
                    by=PY+Math.sin(an)*2.4;
                }
                else {
                    const sx=10+Math.cos(0.45*9)*3;
                    const sy=PY+Math.sin(0.45*9)*2.4;
                    const tx=PX+2;
                    const ty=PY;
                    const dx=tx-sx;
                    const dy=ty-sy;
                    S.tele(sx,sy,sx+dx*1.8,sy+dy*1.8,seg(k,0.45,0.6),1-seg(k,0.6,0.62));
                    const f=seg(k,0.62,0.85);
                    bx=sx+dx*1.8*f;
                    by=sy+dy*1.8*f;
                    if (k>0.85) {
                        bx=lerp(sx+dx*1.8,10,seg(k,0.85,1));
                        by=lerp(sy+dy*1.8,PY,seg(k,0.85,1));
                    }
                }
                S.circle(bx,by+1.2,0.5,PALETTE.ink,0.12);
                S.enemy('bird',bx,by);
            }
        }
    ],
    inkCloud:[
        {
            key:'rain',
            dmg:{kind:'hit',n:1},
            period:3.4,
            draw(S,k) {
                const px=PX+1+seg(k,0.3,0.7)*1.6;
                S.player(px,PY,0);
                const swell=seg(k,0.05,0.2)*(1-seg(k,0.2,0.26));
                S.circle(11.5,PY+1.6,0.9,PALETTE.ink,0.1);
                S.enemy('inkCloud',11.5,PY-1.2+Math.sin(k*Math.PI*4)*0.15,{sx:1+swell*0.2});
                const spots=[[PX+2.6,PY],[PX+0.4,PY-2.2],[PX+4,PY+2]];
                for (let i=0;i<spots.length;i++) {
                    const [x,y]=spots[i];
                    const k0=0.26;
                    const k1=0.56+i*0.05;
                    const mark=seg(k,k0,k0+0.04)*(1-seg(k,k1,k1+0.02));
                    const shrink=1-seg(k,k0,k1);
                    S.circle(x,y,0.9,PALETTE.red,0.12*mark);
                    S.ring(x,y,0.9,PALETTE.red,0.08,mark);
                    S.ring(x,y,0.2+0.7*shrink,PALETTE.red,0.05,mark*0.8);
                    const f=seg(k,k1-0.08,k1);
                    if (f>0&&f<1) {
                        S.circle(x,y-(1-f)*3,0.22,PALETTE.ink,1);
                    }
                    const sp=seg(k,k1,k1+0.3);
                    if (sp>0) {
                        S.circle(x,y,1.1,PALETTE.nearGray,0.35*(1-seg(k,0.9,1)));
                        if (sp<1) {
                            S.burst(x,y,1.2,sp,PALETTE.ink);
                        }
                    }
                }
            }
        }
    ],
    inkBottle:[
        {
            key:'spiral',
            dmg:{kind:'bullet',n:1},
            period:3.2,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=11;
                S.enemy('inkBottle',cx,PY);
                for (let j=0;j<40;j++) {
                    const k0=j*0.02;
                    const f=(k-k0)/0.45;
                    if (f<0||f>1) {
                        continue;
                    }
                    for (let a=0;a<2;a++) {
                        const an=j*0.3+a*Math.PI;
                        const r=1.6+f*7;
                        S.bullet(cx+Math.cos(an)*r,PY+Math.sin(an)*r,'enemy');
                    }
                }
            }
        },
        {
            key:'fan',
            dmg:{kind:'bullet',n:1},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=12;
                S.enemy('inkBottle',cx,PY);
                for (let v=0;v<3;v++) {
                    const k0=0.15+v*0.14;
                    const f=seg(k,k0,k0+0.4);
                    if (f<=0||f>=1) {
                        continue;
                    }
                    for (let i=0;i<7;i++) {
                        const an=Math.PI+(i/6-0.5)*0.9;
                        const r=1.6+f*10;
                        S.bullet(cx+Math.cos(an)*r,PY+Math.sin(an)*r,'enemy');
                    }
                }
            }
        },
        {
            key:'ring',
            dmg:{kind:'bullet',n:1},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=10.5;
                S.enemy('inkBottle',cx,PY);
                for (let v=0;v<2;v++) {
                    const f=seg(k,0.15+v*0.15,0.65+v*0.15);
                    if (f<=0||f>=1) {
                        continue;
                    }
                    for (let i=0;i<22;i++) {
                        const an=i/22*Math.PI*2+v*0.14;
                        S.bullet(cx+Math.cos(an)*(1.6+f*8),PY+Math.sin(an)*(1.6+f*8),'enemy');
                    }
                }
            }
        },
        {
            key:'spill',
            dmg:{kind:'slow',n:0},
            period:3.4,
            draw(S,k) {
                const px=lerp(PX,PX+1,seg(k,0.6,0.9));
                S.player(px,PY+0.6,0);
                const cx=12;
                S.enemy('inkBottle',cx,PY);
                const tg=[[PX,PY+0.6],[5,2.8],[5.6,6.6]];
                for (let i=0;i<3;i++) {
                    const k0=0.15+i*0.04;
                    const f=seg(k,k0,k0+0.3);
                    if (f>0&&f<1) {
                        const x=lerp(cx,tg[i][0],f);
                        const y=lerp(PY-1,tg[i][1],f)-Math.sin(f*Math.PI)*3;
                        S.circle(x,y,0.3,PALETTE.ink);
                    }
                    if (f>=1) {
                        S.circle(tg[i][0],tg[i][1],1.4*easeOut(seg(k,k0+0.3,k0+0.4)),PALETTE.nearGray,0.55);
                    }
                }
                S.text('~',px+0.7,PY-0.2,15,PALETTE.nearGray,seg(k,0.5,0.55));
            }
        },
        {
            key:'summon',
            dmg:{kind:'none',n:0},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=11.5;
                S.enemy('inkBottle',cx,PY,{sx:1+seg(k,0.2,0.3)*(1-seg(k,0.3,0.4))*0.15});
                for (const dy of [-2.6,2.6]) {
                    const f=seg(k,0.3,0.5);
                    if (f>0) {
                        S.ring(cx-2.4,PY+dy,1.2*(1-f)+0.2,PALETTE.midGray,0.06,1-f);
                        S.enemy('blob',cx-2.4-seg(k,0.5,1)*2,PY+dy,{alpha:f});
                    }
                }
            }
        },
        {
            key:'weak',
            dmg:{kind:'none',n:0},
            period:3,
            draw(S,k,t) {
                const cx=9;
                const an=k*Math.PI*2;
                const px=cx+Math.cos(an)*5;
                const py=PY+Math.sin(an)*3.4;
                S.enemy('inkBottle',cx,PY);
                const back=Math.cos(an)>0.3;
                S.circle(cx+1.4,PY,0.35,PALETTE.red,0.6+Math.sin(t*8)*0.3);
                S.player(px,py,Math.atan2(PY-py,cx-px));
                if (back&&Math.floor(t*6)%2===0) {
                    S.fly(px,py,cx+1.4,PY,(t*6)%1,0,1,'ink');
                    S.text('×2',cx+2.2,PY-1.6,17,PALETTE.red);
                }
            }
        },
        {
            key:'roll',
            dmg:{kind:'hit',n:1},
            period:3.6,
            draw(S,k) {
                const dodge=seg(k,0.3,0.45);
                S.player(PX+2,PY+dodge*2.4,0);
                const tele=seg(k,0.05,0.3)*(1-seg(k,0.32,0.34));
                S.tele(13,PY,1,PY,tele);
                const f=seg(k,0.34,0.7);
                const x=lerp(13,2,f);
                for (let i=0;i<4;i++) {
                    const px=lerp(13,2,(i+1)/5);
                    const a=f>(i+1)/5?1-seg(k,0.85,1):0;
                    S.circle(px,PY+0.4,0.9,PALETTE.ink,0.25*a);
                    S.ring(px,PY+0.4,0.9,PALETTE.red,0.05,0.7*a,null,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-seg(k,0.7,1)));
                }
                S.enemy('inkBottle',f>0&&f<1?x:(f>=1?2:13),PY,{size:2.6,rot:f>0&&f<1?Math.PI/2+f*20:(f>=1?Math.PI/2:0)});
                S.text('@',2,PY-2.2,16,PALETTE.red,seg(k,0.7,0.75)*(1-seg(k,0.92,1)));
            }
        }
    ],
    scissors:[
        {
            key:'dash',
            dmg:{kind:'hit',n:2},
            period:3.4,
            draw(S,k,t) {
                S.player(PX+1,6.5,0);
                const tele=seg(k,0.05,0.28);
                const d=seg(k,0.3,0.45);
                const sx=13.5;
                const sy=2.8;
                const tx=2.2;
                const ty=6.5;
                const x=lerp(sx,tx,d);
                const y=lerp(sy,ty,d);
                S.tele(sx,sy,tx,ty,tele,1-seg(k,0.28,0.3));
                const pl=Math.hypot(tx-sx,ty-sy);
                const nx=-(ty-sy)/pl;
                const ny=(tx-sx)/pl;
                const go=seg(k,0.62,0.95);
                for (let i=0;i<10;i++) {
                    const f=i/10;
                    if (f<d) {
                        const side=i%2?1:-1;
                        S.bullet(lerp(sx,tx,f)+nx*side*go*5,lerp(sy,ty,f)+ny*side*go*5,'enemy',1-seg(k,0.88,0.95));
                    }
                }
                S.rect(0,5,1.2,3,PALETTE.midGray);
                const stuck=d>=1&&k<0.92;
                S.enemy('scissors',x,y,{shake:stuck?(t*3)%1*0.3:0});
                if (stuck) {
                    S.text('×2',x,y-2,17,PALETTE.red);
                }
            }
        },
        {
            key:'snip',
            dmg:{kind:'bullet',n:1},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=10.5;
                S.enemy('scissors',cx,PY);
                for (let v=0;v<4;v++) {
                    const f=seg(k,0.1+v*0.12,0.55+v*0.12);
                    if (f<=0||f>=1) {
                        continue;
                    }
                    for (let q=0;q<4;q++) {
                        for (let s=-1;s<=1;s++) {
                            const an=Math.PI/4+v*0.22+q*Math.PI/2+s*0.12;
                            S.bullet(cx+Math.cos(an)*(1+f*7),PY+Math.sin(an)*(1+f*7),'enemy');
                        }
                    }
                }
            }
        },
        {
            key:'spin',
            dmg:{kind:'bullet',n:1},
            period:3.2,
            draw(S,k,t) {
                S.player(PX,PY,0);
                const x=lerp(12.5,8,seg(k,0,0.8));
                S.enemy('scissors',x,PY,{rot:t*9});
                for (let j=0;j<36;j++) {
                    const k0=j*0.022;
                    const f=(k-k0)/0.4;
                    if (f<0||f>1) {
                        continue;
                    }
                    const ox=lerp(12.5,8,seg(k0,0,0.8));
                    for (let a=0;a<2;a++) {
                        const an=j*0.31+a*Math.PI;
                        S.bullet(ox+Math.cos(an)*(0.8+f*6),PY+Math.sin(an)*(0.8+f*6),'enemy');
                    }
                }
            }
        },
        {
            key:'orbit',
            dmg:{kind:'bullet',n:1},
            period:3.6,
            draw(S,k) {
                const cx=8;
                S.player(cx,PY,0);
                const a=-Math.PI/2+k*Math.PI*2.2;
                const x=cx+Math.cos(a)*5;
                const y=PY+Math.sin(a)*3.4;
                S.ring(cx,PY,4.2,PALETTE.red,0.05,0.4,[0.25,0.2]);
                S.enemy('scissors',x,y,{size:2.2,rot:a});
                for (let i=0;i<4;i++) {
                    const k0=0.12+i*0.22;
                    const b=-Math.PI/2+k0*Math.PI*2.2;
                    const bx=cx+Math.cos(b)*5;
                    const by=PY+Math.sin(b)*3.4;
                    for (let q=-1;q<=1;q++) {
                        const ang=Math.atan2(PY-by,cx-bx)+q*0.35;
                        S.fly(bx,by,bx+Math.cos(ang)*4,by+Math.sin(ang)*4,k,k0,k0+0.18,'enemy');
                    }
                }
            }
        }
    ],
    book:[
        {
            key:'wall',
            dmg:{kind:'bullet',n:1},
            period:3.2,
            draw(S,k) {
                const gap=5.8;
                S.player(PX,lerp(PY,gap,seg(k,0.1,0.35)),0);
                S.enemy('book',13.8,PY,{size:2.6});
                for (let v=0;v<2;v++) {
                    const f=seg(k,0.15+v*0.3,0.75+v*0.3);
                    if (f<=0||f>=1) {
                        continue;
                    }
                    const x=lerp(12,0,f);
                    for (let y=0.4;y<SH;y+=0.75) {
                        if (Math.abs(y-gap)<1.1) {
                            continue;
                        }
                        S.bullet(x,y,'enemy');
                    }
                }
            }
        },
        {
            key:'rain',
            dmg:{kind:'bullet',n:1},
            period:3.2,
            draw(S,k) {
                S.player(PX+1,PY,0);
                S.enemy('book',13.8,PY,{size:2.6});
                for (let i=0;i<6;i++) {
                    const x=2.5+hash(i)*7;
                    const y=1.2+hash(i+4)*6.6;
                    const kk=0.3+i*0.07;
                    const mark=seg(k,0.08,0.15)*(1-seg(k,kk,kk+0.02));
                    S.ring(x,y,0.8,PALETTE.red,0.1,mark);
                    S.circle(x,y,0.8,PALETTE.red,0.15*mark);
                    const f=seg(k,kk,kk+0.35);
                    if (f>0&&f<1) {
                        for (let j=0;j<8;j++) {
                            const an=j*Math.PI/4+i;
                            S.bullet(x+Math.cos(an)*f*3,y+Math.sin(an)*f*3,'enemy',1-f*0.5);
                        }
                    }
                }
            }
        },
        {
            key:'slam',
            dmg:{kind:'bullet',n:1},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=11;
                S.enemy('book',cx,PY,{size:2.6,sx:1+seg(k,0.1,0.18)*(1-seg(k,0.18,0.3))*0.3});
                S.ring(cx,PY,4,PALETTE.red,0.08,seg(k,0.02,0.1)*(1-seg(k,0.16,0.18)),[0.3,0.2]);
                for (let v=0;v<2;v++) {
                    const f=seg(k,0.18+v*0.18,0.8+v*0.18);
                    if (f<=0||f>=1) {
                        continue;
                    }
                    for (let i=0;i<30;i++) {
                        const an=i/30*Math.PI*2+v*0.1;
                        S.bullet(cx+Math.cos(an)*(1.5+f*9),PY+Math.sin(an)*(1.5+f*9),'enemy');
                    }
                }
            }
        },
        {
            key:'summon',
            dmg:{kind:'none',n:0},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=12.5;
                S.enemy('book',cx,PY,{size:2.6});
                const minions=[['doodle',-0.9],['doodle',0],['bird',0.9]];
                for (const [id,a] of minions) {
                    const an=Math.PI+a;
                    const f=seg(k,0.25,0.45);
                    if (f>0) {
                        const x=cx+Math.cos(an)*3.2-seg(k,0.5,1)*2;
                        const y=PY+Math.sin(an)*3.2;
                        S.ring(x,y,0.3+(1-f),PALETTE.midGray,0.06,1-f);
                        S.enemy(id,x,y,{alpha:f});
                    }
                }
            }
        },
        {
            key:'rest',
            dmg:{kind:'none',n:0},
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=11;
                const open=seg(k,0.1,0.2)*(1-seg(k,0.85,0.95));
                S.enemy('book',cx,PY,{size:2.6,sx:1+open*0.35});
                S.text('×2',cx+2.4,PY-1.6,18,PALETTE.red,open);
                S.stream(PX+0.9,PY,cx-1.2,PY,k,0.25,0.8,0.05,0.1);
                for (let i=0;i<5;i++) {
                    const kk=0.35+i*0.1;
                    S.num('42',cx+(hash(i)-0.5)*1.4,PY-0.8,seg(k,kk,kk+0.25),PALETTE.red,16);
                }
            }
        },
        {
            key:'glide',
            dmg:{kind:'hit',n:1},
            period:3.8,
            draw(S,k) {
                const pts=[[12.5,PY],[6,PY-1.4],[4,PY+1.6]];
                const dodge=seg(k,0.2,0.32);
                S.player(PX+dodge*0.8,PY+1.2-dodge*3,0);
                let x=pts[0][0];
                let y=pts[0][1];
                for (let i=0;i<2;i++) {
                    const tk=seg(k,0.05+i*0.38,0.2+i*0.38)*(1-seg(k,0.42+i*0.38,0.44+i*0.38));
                    S.ring(pts[i+1][0],pts[i+1][1],1.7,PALETTE.red,0.08,tk,[0.3,0.2]);
                    const f=seg(k,0.22+i*0.38,0.42+i*0.38);
                    if (f>0) {
                        x=lerp(pts[i][0],pts[i+1][0],f);
                        y=lerp(pts[i][1],pts[i+1][1],f)-Math.sin(f*Math.PI)*3;
                    }
                    const lk=seg(k,0.42+i*0.38,0.62+i*0.38);
                    if (lk>0&&lk<1) {
                        for (let q=0;q<10;q++) {
                            const a=q/10*Math.PI*2;
                            S.bullet(pts[i+1][0]+Math.cos(a)*(1+lk*4),pts[i+1][1]+Math.sin(a)*(1+lk*4),'enemy',1-lk);
                        }
                    }
                }
                S.enemy('book',x,y,{size:2.6});
            }
        }
    ]
};

export const TUTOR_ANIMS={
    move:{
        period:4.2,
        draw(S,k) {
            const pts=[[PX,PY],[6.5,2.2],[12.5,6.4],[10,2.4]];
            const legs=[[0.06,0.3],[0.36,0.6],[0.66,0.9]];
            let x=pts[0][0];
            let y=pts[0][1];
            let ang=0;
            let walk=false;
            for (let i=0;i<3;i++) {
                if (k<legs[i][0]) {
                    continue;
                }
                const f=inOut(seg(k,legs[i][0],legs[i][1]));
                x=lerp(pts[i][0],pts[i+1][0],f);
                y=lerp(pts[i][1],pts[i+1][1],f);
                ang=Math.atan2(pts[i+1][1]-pts[i][1],pts[i+1][0]-pts[i][0]);
                walk=walk||f<1;
            }
            for (let i=0;i<3;i++) {
                const p=pts[i+1];
                const done=seg(k,legs[i][1],legs[i][1]+0.05);
                const active=k<legs[i][1]&&(i===0||k>=legs[i-1][1]);
                if (!active&&done<=0) {
                    continue;
                }
                S.ring(p[0],p[1],0.85,PALETTE.red,0.1,done>0?1-done*0.6:1,[0.3,0.2]);
                if (done>0) {
                    S.circle(p[0],p[1],0.85*done,PALETTE.red,0.15);
                    S.text('✓',p[0],p[1],Math.max(9,S.s*0.8),PALETTE.red,done);
                }
                if (active) {
                    S.text('▼',p[0],p[1]-1.4+Math.sin(k*40)*0.15,Math.max(7,S.s*0.55),PALETTE.red);
                }
            }
            S.player(x,y-(walk?Math.abs(Math.sin(k*90))*0.12:0),ang);
        }
    },
    dodge:{
        period:3.6,
        draw(S,k) {
            const cx=13.2;
            const px=6.6;
            const R0=2.2;
            const R1=12;
            const a0=Math.PI-1.1;
            const arc=2.2;
            S.enemy('bookFinal',cx,PY,{size:2.2});
            const tele=seg(k,0.02,0.12)*(1-seg(k,0.26,0.28));
            for (const a of [a0,a0+arc]) {
                S.line(cx+Math.cos(a)*R0,PY+Math.sin(a)*R0,cx+Math.cos(a)*R1,PY+Math.sin(a)*R1,PALETTE.red,0.07,tele);
            }
            const sw=seg(k,0.28,0.74);
            if (sw>0&&sw<1) {
                const a=a0+arc*sw;
                S.line(cx+Math.cos(a)*R0,PY+Math.sin(a)*R0,cx+Math.cos(a)*R1,PY+Math.sin(a)*R1,PALETTE.ink,0.4,1);
            }
            const y0=PY-1.7;
            const y1=PY+1.9;
            const d0=0.5;
            const d1=0.58;
            const f=easeOut(seg(k,d0,d1));
            const fade=1-seg(k,d1,d1+0.18);
            if (f>0) {
                for (let g=1;g<=3;g++) {
                    S.player(px,lerp(y0,y1,Math.max(0,f-g*0.22)),Math.PI/2,{ghost:true,alpha:0.55*(1-g/4)*fade});
                }
            }
            S.player(px,lerp(y0,y1,f),Math.PI/2,{flash:f>0&&f<1?1:0});
            const tx=seg(k,d0+0.02,d0+0.08)*(1-seg(k,0.8,0.88));
            S.text(t('tut.invuln'),px-2.6,PY,Math.max(9,S.s*0.8),PALETTE.red,tx);
        }
    }
};

export function drawStage(ctx,x,y,w,h,anim,t,v) {
    const k=(t%anim.period)/anim.period;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x,y,w,h);
    ctx.clip();
    ctx.fillStyle=PALETTE.paper;
    ctx.fillRect(x,y,w,h);
    const s=Math.min(w/SW,h/SH);
    ctx.translate(x+(w-SW*s)/2,y+(h-SH*s)/2);
    ctx.scale(s,s);
    ctx.strokeStyle=rgba('farGray',0.55);
    ctx.lineWidth=0.03;
    ctx.beginPath();
    for (let i=1;i<SW;i++) {
        ctx.moveTo(i,0);
        ctx.lineTo(i,SH);
    }
    for (let i=1;i<SH;i++) {
        ctx.moveTo(0,i);
        ctx.lineTo(SW,i);
    }
    ctx.stroke();
    const S=new Stage(ctx,v,s);
    anim.draw(S,k,t);
    const fade=Math.max(1-seg(k,0,0.04),seg(k,0.95,1));
    if (fade>0) {
        ctx.fillStyle=rgba('paper',fade);
        ctx.fillRect(0,0,SW,SH);
    }
    ctx.restore();
    ctx.save();
    ctx.translate(x,y);
    drawShape(ctx,sketchRect(0,0,Math.round(w),Math.round(h),{width:1.8,seed:2101}),PALETTE.ink,v);
    ctx.restore();
}

export const WEAPON_ANIMS={
    pen:{
        period:2.4,
        draw(S,k) {
            const shots=[0.1,0.22,0.34,0.46];
            let kick=0;
            for (const s of shots) {
                kick=Math.max(kick,seg(k,s,s+0.03)*(1-seg(k,s+0.03,s+0.1)));
                S.fly(PX+0.9,PY,11,PY,k,s,s+0.2);
            }
            S.player(PX,PY,0,{kick});
            S.target('doodle',11.6,PY,k,0.62);
        }
    },
    pencil:{
        period:2.4,
        draw(S,k) {
            let kick=0;
            for (let i=0;i<14;i++) {
                const s=0.06+i*0.035;
                const dy=(hash(i)-0.5)*1.2;
                kick=Math.max(kick,seg(k,s,s+0.02)*(1-seg(k,s+0.02,s+0.05)));
                S.fly(PX+0.9,PY,11,PY+dy,k,s,s+0.16);
            }
            S.player(PX,PY,0,{kick});
            S.target('blob',11.6,PY,k,0.62);
        }
    },
    brush:{
        period:2.4,
        draw(S,k) {
            for (let w=0;w<2;w++) {
                const s=0.12+w*0.4;
                const f=seg(k,s,s+0.28);
                if (f>0&&f<1) {
                    const e=1-Math.pow(1-f,2.4);
                    const r=0.9+e*4.6;
                    const th=0.45+e*1.4;
                    const fade=f<0.7?1:1-(f-0.7)/0.3;
                    const n=12;
                    for (let i=0;i<n;i++) {
                        const u0=i/n;
                        const u1=(i+1)/n;
                        const a0=(w?0.5-u0:u0-0.5)*0.95;
                        const a1=(w?0.5-u1:u1-0.5)*0.95;
                        const rr=r-th*0.5+Math.sin(u0*Math.PI)*th*0.3;
                        const wd=th*Math.min(1,u0*10)*(1-u0*0.8);
                        S.line(PX+Math.cos(a0)*rr,PY+Math.sin(a0)*rr,PX+Math.cos(a1)*rr,PY+Math.sin(a1)*rr,PALETTE.ink,wd,fade*(0.95-u0*0.3));
                    }
                }
            }
            for (let i=0;i<4;i++) {
                const y=PY+(i-1.5)*1.1;
                const x=9-k*14;
                if (k<0.15||x>PX+4.2) {
                    S.bullet(Math.max(PX+4.2,x),y,'enemy',k<0.15?1:1-seg(k,0.15,0.2));
                }
            }
            S.player(PX,PY,0,{kick:seg(k,0.12,0.18)*(1-seg(k,0.18,0.32))});
            S.target('doodle',PX+4.8,PY,k,0.24);
        }
    },
    stapler:{
        period:2.6,
        draw(S,k) {
            let kick=0;
            for (let b=0;b<2;b++) {
                for (let i=0;i<3;i++) {
                    const s=0.1+b*0.3+i*0.03;
                    kick=Math.max(kick,seg(k,s,s+0.02)*(1-seg(k,s+0.02,s+0.05)));
                    S.fly(PX+0.9,PY,10.5,PY,k,s,s+0.18);
                }
            }
            S.player(PX,PY,0,{kick});
            const slow=seg(k,0.28,0.3)*(1-seg(k,0.9,1));
            const x=11.5-k*3*(1-slow*0.7);
            if (slow>0) {
                S.ring(x,PY,0.9,PALETTE.red,0.06,slow,[0.2,0.15]);
            }
            S.target('eraserMonster',x,PY,k,0.72);
        }
    },
    highlighter:{
        period:2.4,
        draw(S,k) {
            const on=seg(k,0.08,0.1)*(1-seg(k,0.7,0.72));
            if (on>0) {
                const wob=1+Math.sin(k*120)*0.08;
                S.line(PX+0.9,PY,11.2,PY,PALETTE.marker,0.6*wob,0.7*on);
                S.line(PX+0.9,PY,11.2,PY,PALETTE.paper,0.18*wob,0.85*on);
                for (let i=0;i<3;i++) {
                    const q=hash(i+Math.floor(k*30));
                    S.circle(11.2-q*0.6,PY+(q-0.5)*0.9,0.08,PALETTE.marker,on);
                }
            }
            const heat=seg(k,0.1,0.7);
            S.rect(PX-0.8,PY+1.1,1.6,0.25,PALETTE.farGray,1);
            S.rect(PX-0.8,PY+1.1,1.6*heat,0.25,heat>0.8?PALETTE.red:PALETTE.ink,1);
            S.player(PX,PY,0,{kick:on*0.3});
            S.target('compass',11.6,PY,k,0.55);
        }
    },
    crayon:{
        period:2.4,
        draw(S,k) {
            const cols=[PALETTE.crayonGreen,PALETTE.crayonBlue,PALETTE.red,PALETTE.crayonGreen,PALETTE.crayonBlue,PALETTE.crayonGreen];
            let kick=0;
            cols.forEach((c,i)=>{
                const s=0.08+i*0.08;
                kick=Math.max(kick,seg(k,s,s+0.02)*(1-seg(k,s+0.02,s+0.06)));
                if (k>=s&&k<=s+0.2) {
                    const f=(k-s)/0.2;
                    const x=PX+0.9+f*(11-PX-0.9);
                    S.line(x-0.8,PY,x,PY,c,0.08,0.6);
                    S.circle(x,PY,c===PALETTE.red?0.2:0.14,c,1);
                }
            });
            S.player(PX,PY,0,{kick});
            S.target('doodle',11.6,PY,k,0.62);
        }
    },
    compass:{
        period:2.8,
        draw(S,k) {
            const f=seg(k,0.1,0.8);
            const out=f<0.5?f*2:2-f*2;
            const x=PX+0.9+out*9;
            const y=PY;
            if (f>0&&f<1) {
                const a=k*40;
                for (const sp of [-0.32,0.32]) {
                    const b=a+sp;
                    S.line(x,y,x+Math.cos(b)*0.75,y+Math.sin(b)*0.75,PALETTE.nearGray,0.1,1);
                }
                S.line(x+Math.cos(a+0.32)*0.75,y+Math.sin(a+0.32)*0.75,x+Math.cos(a+0.32)*0.9,y+Math.sin(a+0.32)*0.9,PALETTE.ink,0.06,1);
                S.circle(x,y,0.14,PALETTE.ink,1);
            }
            const cd=seg(k,0.1,0.1+1.8/2.8);
            S.rect(PX-0.8,PY+1.1,1.6,0.25,PALETTE.farGray,1);
            S.rect(PX-0.8,PY+1.1,1.6*(k<0.1?1:cd),0.25,cd>=1||k<0.1?PALETTE.ink:PALETTE.nearGray,1);
            S.player(PX,PY,0,{kick:seg(k,0.1,0.13)*(1-seg(k,0.13,0.2))});
            S.target('doodle',PX+5.5,PY,k,0.28);
            S.target('blob',PX+8.5,PY,k,0.39);
        }
    }
};
