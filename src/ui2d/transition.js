import {PALETTE,rgba} from '../data/palette.js';
import {EASE} from '../core/easing.js';
import {sketchLine,drawShape} from './sketch.js';
import {TUNING} from '../data/tuning.js';

export class Transition {
    constructor() {
        this.state='idle';
        this.t=0;
        this.dur=1.0;
        this.mid=null;
        this.snap=document.createElement('canvas');
        this.sctx=this.snap.getContext('2d');
    }

    get active() {
        return this.state!=='idle';
    }

    run(onMid) {
        this.state='capture';
        this.mid=onMid;
        this.t=0;
    }

    runDoor(onMid,x,y,info) {
        this.state='close';
        this.mid=onMid;
        this.t=0;
        this.cx=x;
        this.cy=y;
        this.info=info;
        this.text=null;
        this.drops=[];
    }

    capture(source,w,h) {
        const dpr=Math.min(2,window.devicePixelRatio||1);
        const cw=Math.floor(w*dpr);
        const ch=Math.floor(h*dpr);
        if (this.snap.width!==cw||this.snap.height!==ch) {
            this.snap.width=cw;
            this.snap.height=ch;
        }
        this.sctx.drawImage(source,0,0,cw,ch);
        this.state='turn';
        this.t=0;
        if (this.mid) {
            const m=this.mid;
            this.mid=null;
            m();
        }
    }

    update(dt) {
        const F=TUNING.doorFx;
        if (this.state==='close'||this.state==='hold'||this.state==='open') {
            this.t+=dt;
            if (this.state==='close'&&this.t>=F.close) {
                this.state='hold';
                this.t=0;
                if (this.mid) {
                    const m=this.mid;
                    this.mid=null;
                    m();
                }
                this.text=this.info?this.info():null;
                for (let i=0;i<F.drops;i++) {
                    this.drops.push({x:Math.random(),y:-Math.random()*0.3,v:0.4+Math.random()*0.8,r:2+Math.random()*5});
                }
            }
            else if (this.state==='hold'&&this.t>=F.hold) {
                this.state='open';
                this.t=0;
            }
            else if (this.state==='open'&&this.t>=F.open) {
                this.state='idle';
            }
            for (const d of this.drops) {
                d.y+=d.v*dt;
            }
            return;
        }
        if (this.state!=='turn') {
            return;
        }
        this.t+=dt;
        if (this.t>=this.dur+0.05) {
            this.state='idle';
        }
    }

    iris(ctx,w,h,x,y,r) {
        const F=TUNING.doorFx;
        ctx.beginPath();
        ctx.rect(-10,-10,w+20,h+20);
        if (r>0.5) {
            const n=40;
            for (let i=0;i<=n;i++) {
                const a=i/n*Math.PI*2;
                const k=1+F.wobble*Math.sin(a*5+this.t*6)+F.wobble*0.6*Math.sin(a*11-this.t*4);
                const px=x+Math.cos(a)*r*k;
                const py=y+Math.sin(a)*r*k;
                if (i===0) {
                    ctx.moveTo(px,py);
                }
                else {
                    ctx.lineTo(px,py);
                }
            }
        }
        ctx.fillStyle=PALETTE.ink;
        ctx.fill('evenodd');
    }

    drawTop(ctx,w,h) {
        const F=TUNING.doorFx;
        const st=this.state;
        if (st!=='close'&&st!=='hold'&&st!=='open') {
            return;
        }
        const R=Math.hypot(w,h);
        ctx.save();
        if (st==='close') {
            const k=EASE.easeInCubic(Math.min(1,this.t/F.close));
            this.iris(ctx,w,h,this.cx,this.cy,R*(1-k));
        }
        else if (st==='open') {
            const k=EASE.easeOutCubic(Math.min(1,this.t/F.open));
            this.iris(ctx,w,h,w/2,h*0.55,R*k);
        }
        else {
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(-10,-10,w+20,h+20);
        }
        if (st!=='close') {
            const a=st==='hold'?Math.min(1,this.t/F.titleIn):Math.max(0,1-this.t/(F.open*0.5));
            ctx.globalAlpha=a;
            ctx.fillStyle=PALETTE.paper;
            for (const d of this.drops) {
                ctx.beginPath();
                ctx.arc(d.x*w,d.y*h,d.r,0,Math.PI*2);
                ctx.fill();
            }
            if (this.text) {
                const s=0.9+0.1*EASE.easeOutBack(Math.min(1,this.t/F.titleIn));
                ctx.translate(w/2,h/2);
                ctx.scale(s,s);
                ctx.textAlign='center';
                ctx.textBaseline='middle';
                ctx.font='bold 40px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
                ctx.fillText(this.text.title,0,-14);
                if (this.text.sub) {
                    ctx.font='18px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
                    ctx.fillStyle=PALETTE.marker;
                    ctx.fillText(this.text.sub,0,26);
                }
            }
        }
        ctx.restore();
    }

    draw(ctx,w,h) {
        if (this.state!=='turn') {
            return;
        }
        const p=EASE.easeInOutCubic(Math.min(1,this.t/this.dur));
        const tilt=h*0.14;
        const fold=w*1.02-(w*1.3)*p;
        const tx=fold+tilt;
        const bx=fold-tilt;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(-10,-10);
        ctx.lineTo(tx,-10);
        ctx.lineTo(bx,h+10);
        ctx.lineTo(-10,h+10);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(this.snap,0,0,w,h);
        ctx.restore();
        const sw=40+60*Math.sin(p*Math.PI);
        const g=ctx.createLinearGradient(fold,0,fold+sw,0);
        g.addColorStop(0,rgba('ink',0.28*(1-p*0.6)));
        g.addColorStop(1,rgba('ink',0));
        ctx.fillStyle=g;
        ctx.beginPath();
        ctx.moveTo(tx,0);
        ctx.lineTo(tx+sw,0);
        ctx.lineTo(bx+sw,h);
        ctx.lineTo(bx,h);
        ctx.closePath();
        ctx.fill();
        const fw=Math.min(w-fold,Math.max(0,fold+tilt))*0.85;
        if (fw>2) {
            const ftx=tx-fw*1.05;
            const fbx=bx-fw*0.85;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(tx,0);
            ctx.lineTo(ftx,0);
            ctx.lineTo(fbx,h);
            ctx.lineTo(bx,h);
            ctx.closePath();
            ctx.fillStyle=PALETTE.paper;
            ctx.fill();
            ctx.clip();
            const fg=ctx.createLinearGradient(fold-fw,0,fold,0);
            fg.addColorStop(0,rgba('farGray',0.9));
            fg.addColorStop(0.7,rgba('paper',0));
            fg.addColorStop(1,rgba('ink',0.12));
            ctx.fillStyle=fg;
            ctx.fillRect(Math.min(ftx,fbx)-4,0,fw+tilt*2+8,h);
            ctx.strokeStyle=rgba('farGray',0.8);
            ctx.lineWidth=1;
            for (let y=36;y<h;y+=36) {
                ctx.beginPath();
                ctx.moveTo(Math.min(ftx,fbx)-4,y);
                ctx.lineTo(tx+4,y);
                ctx.stroke();
            }
            ctx.restore();
            drawShape(ctx,sketchLine(ftx,0,fbx,h,{width:2.2,seed:1201}),PALETTE.ink);
            drawShape(ctx,sketchLine(tx,0,bx,h,{width:1.4,seed:1202}),PALETTE.nearGray);
        }
    }
}
