import {PALETTE,rgba} from '../data/palette.js';
import {ENEMY_ICONS} from './enemyIcons.js';
import {sketchRect,drawShape} from './sketch.js';

const SW=16;
const SH=9;
const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const PX=3;
const PY=4.5;
const BOSSES=new Set(['inkBottle','scissors','book']);

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
            const s1=0.55;
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
                const te=s0+(s1-s0)*(an+0.7)/1.4;
                const gone=seg(k,te,te+0.06);
                if (k<te||gone<1) {
                    S.bullet(x,y,'enemy',1-gone);
                }
            }
        }
    },
    eraseCover:{
        period:3,
        draw(S,k) {
            S.player(PX,PY,0);
            const e=seg(k,0.15,0.45);
            const bx=8;
            if (e<1) {
                const c=S.ctx;
                c.save();
                c.beginPath();
                c.rect(bx-0.9,PY-1.3+2.6*e,1.8,2.6*(1-e));
                c.clip();
                S.box(bx,PY,1.6,2.4);
                c.restore();
                if (e>0) {
                    const zz=[];
                    for (let i=0;i<8;i++) {
                        zz.push([bx-0.8+(i%2)*1.6,PY-1.2+2.6*e+i*0.08-0.4]);
                    }
                    S.path(zz,PALETTE.farGray,0.18,0.8);
                }
            }
            for (let i=0;i<8;i++) {
                const f=seg(k,0.2+i*0.03,0.5+i*0.03);
                S.circle(bx+(hash(i)-0.5)*2+f*(hash(i+9)-0.5)*2,PY+(hash(i+3)-0.5)*2+f*1.5,0.1,PALETTE.farGray,f>0&&f<1?1-f:0);
            }
            S.stream(PX+0.9,PY,12,PY,k,0.55,0.8,0.05,0.12);
            S.target('compass',12,PY,k,0.84);
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
        period:3,
        draw(S,k) {
            S.player(PX,PY,0);
            const sx=lerp(-1,17,inOut(seg(k,0.3,0.6)));
            for (let i=0;i<16;i++) {
                const x=4.5+hash(i)*11;
                const y=0.8+hash(i+20)*7.4;
                const dx=Math.sin(k*3+i)*0.3;
                if (x+dx>sx) {
                    S.bullet(x+dx,y,'enemy');
                }
                else {
                    S.burst(x+dx,y,0.5,seg(k,0.3+(x/17)*0.3,0.4+(x/17)*0.3),PALETTE.midGray);
                }
            }
            if (k>0.3&&k<0.62) {
                S.rect(sx-0.5,0,0.5,SH,PALETTE.paper,0.9);
                S.line(sx,0,sx,SH,PALETTE.ink,0.12);
            }
            S.num('+5',PX,PY-0.6,seg(k,0.6,1),PALETTE.ink,18);
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
        period:2.8,
        draw(S,k) {
            S.player(PX,PY,0,{pens:2,kick:k>0.15&&k<0.8?(Math.floor(k*50)%2)*0.5:0});
            S.stream(PX+0.9,PY-0.3,12,3.3,k,0.15,0.75,0.04,0.12);
            S.stream(PX+0.9,PY+0.3,12,5.7,k,0.17,0.77,0.04,0.12);
            S.target('doodle',12,3.3,k,0.8);
            S.target('blob',12,5.7,k,0.84);
            S.text('×2',PX,PY-1.3,15,PALETTE.ink,seg(k,0.1,0.18)*(1-seg(k,0.8,0.9)));
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
    }
};

export const ENEMY_ATTACKS={
    doodle:[
        {
            key:'shot',
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
    inkBottle:[
        {
            key:'spiral',
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
                    S.text('×3',cx+2.2,PY-1.6,17,PALETTE.red);
                }
            }
        }
    ],
    scissors:[
        {
            key:'dash',
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
                for (let i=0;i<10;i++) {
                    const f=i/10;
                    if (f<d) {
                        S.circle(lerp(sx,tx,f),lerp(sy,ty,f),0.16,PALETTE.red,1-seg(k,0.7,0.9));
                    }
                }
                S.rect(0,5,1.2,3,PALETTE.midGray);
                const stuck=d>=1&&k<0.92;
                S.enemy('scissors',x,y,{shake:stuck?(t*3)%1*0.3:0});
                if (stuck) {
                    S.text('×3',x,y-2,17,PALETTE.red);
                }
            }
        },
        {
            key:'snip',
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
        }
    ],
    book:[
        {
            key:'wall',
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
            period:3,
            draw(S,k) {
                S.player(PX,PY,0);
                const cx=11;
                const open=seg(k,0.1,0.2)*(1-seg(k,0.85,0.95));
                S.enemy('book',cx,PY,{size:2.6,sx:1+open*0.35});
                S.text('×3',cx+2.4,PY-1.6,18,PALETTE.red,open);
                S.stream(PX+0.9,PY,cx-1.2,PY,k,0.25,0.8,0.05,0.1);
                for (let i=0;i<5;i++) {
                    const kk=0.35+i*0.1;
                    S.num('42',cx+(hash(i)-0.5)*1.4,PY-0.8,seg(k,kk,kk+0.25),PALETTE.red,16);
                }
            }
        }
    ]
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
