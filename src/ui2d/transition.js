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

    runDoor(onMid,x,y) {
        this.state='close';
        this.mid=onMid;
        this.t=0;
        this.cx=x;
        this.cy=y;
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
            if (this.state==='close'&&this.t>=F.glow) {
                this.state='hold';
                this.t=0;
                if (this.mid) {
                    const m=this.mid;
                    this.mid=null;
                    m();
                }
            }
            else if (this.state==='hold'&&this.t>=F.hold) {
                this.state='open';
                this.t=0;
            }
            else if (this.state==='open'&&this.t>=F.fade) {
                this.state='idle';
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

    drawTop(ctx,w,h) {
        const F=TUNING.doorFx;
        const st=this.state;
        if (st!=='close'&&st!=='hold'&&st!=='open') {
            return;
        }
        ctx.save();
        if (st==='close') {
            const k=Math.min(1,this.t/F.glow);
            const e=EASE.easeInCubic(k);
            const R=Math.hypot(w,h)*(F.startR+(1.3-F.startR)*e);
            ctx.globalCompositeOperation='lighter';
            ctx.translate(this.cx,this.cy);
            ctx.rotate(this.t*F.raySpin);
            ctx.fillStyle=rgba('marker',0.18*k);
            for (let i=0;i<F.rays;i++) {
                const a=i/F.rays*Math.PI*2;
                const sp=0.08+0.04*Math.sin(this.t*5+i);
                ctx.beginPath();
                ctx.moveTo(0,0);
                ctx.lineTo(Math.cos(a-sp)*R*1.4,Math.sin(a-sp)*R*1.4);
                ctx.lineTo(Math.cos(a+sp)*R*1.4,Math.sin(a+sp)*R*1.4);
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
            ctx.save();
            const g=ctx.createRadialGradient(this.cx,this.cy,0,this.cx,this.cy,R);
            g.addColorStop(0,rgba('paper',Math.min(1,0.4+k)));
            g.addColorStop(0.25,rgba('marker',0.55*k+0.2));
            g.addColorStop(0.6,rgba('paper',0.6*e));
            g.addColorStop(1,rgba('paper',e*e));
            ctx.fillStyle=g;
            ctx.fillRect(-10,-10,w+20,h+20);
            ctx.fillStyle=rgba('paper',Math.max(0,(k-0.75)/0.25));
            ctx.fillRect(-10,-10,w+20,h+20);
        }
        else {
            const a=st==='hold'?1:1-EASE.easeOutCubic(Math.min(1,this.t/F.fade));
            ctx.fillStyle=rgba('paper',a);
            ctx.fillRect(-10,-10,w+20,h+20);
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
