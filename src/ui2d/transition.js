import {PALETTE,rgba} from '../data/palette.js';
import {EASE} from '../core/easing.js';
import {sketchLine,sketchRect,hatchFill,rectPoly,drawShape} from './sketch.js';
import {time} from '../core/loop.js';
import {hash1} from '../core/rng.js';
import {TUNING} from '../data/tuning.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export class Transition {
    constructor() {
        this.state='idle';
        this.t=0;
        this.dur=1.0;
        this.mid=null;
        this.onDoorDone=null;
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
            }
            else if (this.state==='hold'&&this.t>=F.hold) {
                this.state='open';
                this.t=0;
            }
            else if (this.state==='open'&&this.t>=F.open) {
                this.state='idle';
                if (this.onDoorDone) {
                    this.onDoorDone();
                }
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

    hatch(ctx,w,h,k) {
        const F=TUNING.doorFx;
        const v=time.boilIndex;
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-10,-10,w+20,h+20);
        ctx.fillStyle=rgba('ink',F.base*k);
        ctx.fillRect(-10,-10,w+20,h+20);
        drawShape(ctx,hatchFill(rectPoly(-20,-20,w+40,h+40),{angle:-0.8,spacing:F.spacing,cross:true,width:F.lineW,jitter:1.2}),PALETTE.ink,v);
        if (k>0.45) {
            ctx.globalAlpha*=Math.min(1,(k-0.45)/0.35);
            drawShape(ctx,hatchFill(rectPoly(-20,-20,w+40,h+40),{angle:0.3,spacing:F.spacing*1.4,width:F.lineW*1.2,jitter:1.4}),PALETTE.ink,v);
        }
    }

    blob(ctx,x,y,r) {
        const F=TUNING.doorFx;
        const n=F.blobPts;
        const seed=time.boilIndex*31;
        ctx.beginPath();
        for (let i=0;i<=n;i++) {
            const a=i/n*Math.PI*2;
            const k=1+F.blobJag*(hash1(seed+i%n)-0.5)+0.08*Math.sin(a*3+this.t*4);
            const px=x+Math.cos(a)*r*k;
            const py=y+Math.sin(a)*r*k;
            if (i===0) {
                ctx.moveTo(px,py);
            }
            else {
                ctx.lineTo(px,py);
            }
        }
        ctx.closePath();
    }

    card(ctx,w,h,pop) {
        if (!this.text) {
            return;
        }
        const F=TUNING.doorFx;
        const v=time.boilIndex;
        const k=pop?EASE.easeOutBack(Math.min(1,this.t/F.cardIn)):1;
        const cw=F.cardW;
        const ch=F.cardH;
        ctx.save();
        ctx.translate(w/2,h/2);
        ctx.rotate(-0.04+(1-k)*0.3);
        ctx.scale(k,k);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-cw/2,-ch/2,cw,ch);
        drawShape(ctx,sketchRect(-cw/2,-ch/2,cw,ch,{width:2.6,seed:2400}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.font='bold 30px '+FONT;
        ctx.fillText(this.text.title,0,this.text.sub?-16:-4,cw-30);
        drawShape(ctx,sketchLine(-cw*0.32,this.text.sub?6:16,cw*0.32,this.text.sub?8:18,{width:3,seed:2401}),PALETTE.red,v);
        if (this.text.sub) {
            ctx.font='17px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(this.text.sub,0,30,cw-30);
        }
        ctx.restore();
    }

    eraser(ctx,x,y,a) {
        const F=TUNING.doorFx;
        const v=time.boilIndex;
        const ew=F.eraserW;
        const eh=F.eraserH;
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(a+0.25);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-ew/2,-eh/2,ew,eh);
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(ew*0.1,-eh/2,ew*0.4,eh);
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=2.4;
        ctx.strokeRect(-ew/2,-eh/2,ew,eh);
        drawShape(ctx,sketchRect(-ew/2-1,-eh/2-1,ew+2,eh+2,{width:2,seed:2410}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(ew*0.1,-eh/2,ew*0.1,eh/2,{width:1.6,seed:2411}),PALETTE.ink,v);
        ctx.restore();
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
            const k=Math.min(1,this.t/F.close);
            const r=R*(F.startR+(1.15-F.startR)*EASE.easeInCubic(k));
            ctx.save();
            this.blob(ctx,this.cx,this.cy,r);
            ctx.clip();
            this.hatch(ctx,w,h,k);
            ctx.restore();
            this.blob(ctx,this.cx,this.cy,r);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=F.edgeW;
            ctx.stroke();
            this.blob(ctx,this.cx,this.cy,r*0.97);
            ctx.lineWidth=F.edgeW*0.5;
            ctx.stroke();
            for (let i=0;i<F.drops;i++) {
                const a=hash1(i*13+7)*Math.PI*2;
                const d=(0.3+hash1(i*7+3)*0.9)*r;
                const s=(2+hash1(i*5+1)*6)*(1-k*0.5);
                ctx.fillStyle=PALETTE.ink;
                ctx.beginPath();
                ctx.arc(this.cx+Math.cos(a)*d,this.cy+Math.sin(a)*d,s,0,Math.PI*2);
                ctx.fill();
            }
        }
        else if (st==='hold') {
            this.hatch(ctx,w,h,1);
            ctx.globalAlpha=1;
            this.card(ctx,w,h,true);
        }
        else {
            const k=EASE.easeInOutQuad(Math.min(1,this.t/F.open));
            const a=F.wipeAngle;
            const nx=Math.cos(a);
            const ny=Math.sin(a);
            const span=Math.abs(nx)*w+Math.abs(ny)*h;
            const s=-span/2-F.eraserW+(span+F.eraserW*2)*k;
            const bx=w/2+nx*s;
            const by=h/2+ny*s;
            ctx.save();
            ctx.translate(bx,by);
            ctx.rotate(a);
            ctx.beginPath();
            ctx.rect(0,-R,R*2,R*2);
            ctx.restore();
            ctx.save();
            ctx.clip();
            this.hatch(ctx,w,h,1);
            ctx.globalAlpha=1;
            this.card(ctx,w,h,false);
            ctx.restore();
            ctx.fillStyle=PALETTE.midGray;
            for (let i=0;i<F.crumbs;i++) {
                const off=(hash1(i*17+3)-0.5)*R;
                const back=hash1(i*11+5)*F.crumbSpread;
                const px=bx-ny*off-nx*back;
                const py=by+nx*off-ny*back;
                ctx.fillRect(px,py,2+hash1(i)*3,2+hash1(i+9)*2);
            }
            const sweep=Math.sin(this.t*F.sweepRate)*Math.min(w,h)*0.35;
            this.eraser(ctx,bx-ny*sweep,by+nx*sweep,a+Math.PI/2);
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
