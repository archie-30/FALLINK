import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {sketchRect,sketchCircle,sketchLine,drawShape} from './sketch.js';
import {FONT,inRect,drawButton,fitText,Panel} from './uiKit.js';
import {wrapText} from './cardView.js';
import {drawRelicIcon,relicTone} from './relicIcons.js';
import {drawCoin,drawLock} from './meta.js';
import {RELIC_ORDER,RELIC_STARTERS,relicParams} from '../data/relics.js';
import {relicOwned,relicLocked,relicPrice,dots} from '../core/meta.js';
import {hash1} from '../core/rng.js';
import {godMode} from '../core/progress.js';

const G=()=>TUNING.gachaUi;

export class RelicGacha extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.sel=RELIC_ORDER[0];
        this.anim=null;
        this.shake=0;
        this.msg=null;
        this.hx=-1;
        this.hy=-1;
        this.tiles=[];
        this.sparks=[];
        this.walletK=0;
        this.pulse={};
    }

    show() {
        super.show();
        this.anim=null;
        this.shake=0;
        this.msg=null;
        this.sparks=[];
        this.pulse={};
        this.sel=RELIC_ORDER.find(id=>relicOwned(id))||RELIC_ORDER[0];
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const pw=Math.min(1060,w-20);
        const ph=Math.min(h-16,small?h-16:660);
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const P=this.P;
        const bh=small?40:48;
        const by=P.y+ph-(small?48:64);
        const hh=small?42:62;
        const rw=Math.min(P.w*0.34,small?240:310);
        const rx=P.x+P.w-20-rw;
        this.backBtn={x:P.x+20,y:by,w:small?120:150,h:bh};
        this.pullBtn={x:rx,y:by,w:rw,h:bh};
        const ch=small?42:56;
        this.coinBox={x:rx,y:by-ch-(small?8:12),w:rw,h:ch};
        this.M={x:rx,y:P.y+hh,w:rw,h:this.coinBox.y-(small?6:12)-(P.y+hh)};
        this.G={x:P.x+20,y:P.y+hh,w:rx-(small?16:28)-(P.x+20),h:by-(small?10:14)-(P.y+hh)};
        this.buttons=[this.backBtn,this.pullBtn];
    }

    hover(x,y) {
        super.hover(x,y);
        this.hx=x;
        this.hy=y;
    }

    say(key,params) {
        this.msg={text:t(key,params),t:0};
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        const A=this.anim;
        if (A) {
            if (A.t<G().reveal) {
                A.t=G().reveal;
            }
            else if (A.t>G().reveal+0.35) {
                this.anim=null;
                this.sel=A.id;
                this.boxPop=1;
                this.pulse[A.id]=1;
                this.actions.select();
            }
            return true;
        }
        if (inRect(this.backBtn,x,y)) {
            this.actions.back();
            return true;
        }
        if (inRect(this.pullBtn,x,y)) {
            this.pull();
            return true;
        }
        if (inRect(this.G,x,y)) {
            this.press={x0:x,y0:y,s0:this.scrollTo||0,moved:false};
        }
        return true;
    }

    pull() {
        if (godMode()) {
            this.anim={id:this.actions.pull(),t:0,boom:false};
            return;
        }
        if (relicLocked().length===0) {
            this.shake=1;
            this.say('gacha.empty');
            this.actions.fail();
            return;
        }
        if (dots()<relicPrice()) {
            this.shake=1;
            this.say('gacha.poor');
            this.actions.fail();
            return;
        }
        const id=this.actions.pull();
        if (!id) {
            this.shake=1;
            this.actions.fail();
            return;
        }
        this.walletK=1;
        this.anim={id,t:0,boom:false};
    }

    update(dt) {
        super.update(dt);
        this.shake=Math.max(0,this.shake-dt*2.5);
        this.walletK=Math.max(0,this.walletK-dt*2);
        this.scroll=(this.scroll||0)+((this.scrollTo||0)-(this.scroll||0))*Math.min(1,dt*14);
        for (const k in this.pulse) {
            this.pulse[k]=Math.max(0,this.pulse[k]-dt*2.5);
        }
        if (this.msg) {
            this.msg.t+=dt;
            if (this.msg.t>2.2) {
                this.msg=null;
            }
        }
        const A=this.anim;
        if (A) {
            A.t+=dt;
            if (!A.crank&&A.t>=G().intro) {
                A.crank=true;
                this.actions.sfx('crank');
            }
            if (!A.drop&&A.t>=G().drop) {
                A.drop=true;
                this.actions.sfx('drop');
            }
            if (!A.boom&&A.t>=G().reveal) {
                A.boom=true;
                this.actions.sfx('reveal');
                const cx=this.width/2;
                const cy=this.height*G().cy;
                const T=relicTone(A.id);
                for (let i=0;i<46;i++) {
                    const a=Math.random()*Math.PI*2;
                    const sp=160+Math.random()*420;
                    this.sparks.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-140,t:0,life:0.7+Math.random()*0.6,r:3+Math.random()*6,c:[T[0],T[1],PALETTE.red,PALETTE.gold][i%4]});
                }
            }
        }
        for (let i=this.sparks.length-1;i>=0;i--) {
            const q=this.sparks[i];
            q.t+=dt;
            q.x+=q.vx*dt;
            q.y+=q.vy*dt;
            q.vy+=520*dt;
            if (q.t>q.life) {
                this.sparks.splice(i,1);
            }
        }
    }

    drawMachine(ctx,v,small) {
        const M=this.M;
        const A=this.anim;
        const now=time.real;
        const cx=M.x+M.w/2;
        const gr=Math.min(M.w*0.34,M.h*0.34);
        const gy=M.y+gr+14;
        const busy=A&&A.t<G().reveal;
        const shk=(busy?Math.sin(A.t*40)*G().shake*(1-A.t/G().reveal):0)+Math.sin(now*40)*this.shake*G().shake;
        ctx.save();
        ctx.translate(shk,0);
        const baseY=gy+gr*0.82;
        const bw=gr*1.9;
        const bh=Math.min(M.h-(baseY-M.y)-4,gr*1.1);
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(cx-bw/2,baseY,bw,bh);
        drawShape(ctx,sketchRect(cx-bw/2,baseY,bw,bh,{width:2.4,seed:4601}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.darkRed;
        ctx.fillRect(cx-bw/2,baseY+bh-8,bw,8);
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.arc(cx,gy,gr,0,Math.PI*2);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx,gy,gr-3,0,Math.PI*2);
        ctx.clip();
        const n=G().balls;
        for (let i=0;i<n;i++) {
            const id=RELIC_ORDER[i%RELIC_ORDER.length];
            const T=relicTone(id);
            const rate=G().bounce*(0.8+hash1(i*3)*0.6)*(busy?2.2:1);
            const hop=Math.abs(Math.sin(now*rate+i*1.7))*gr*(busy?0.3:0.13);
            const jig=Math.sin(now*rate*0.5+i)*gr*(busy?0.06:0.025);
            const bx=cx+(hash1(i*13+1)-0.5)*gr*1.5+jig;
            const by=gy+gr*0.55-Math.floor(i/5)*gr*0.3-(hash1(i*7)*gr*0.12)-hop;
            const br=gr*0.2;
            ctx.fillStyle=T[0];
            ctx.beginPath();
            ctx.arc(bx,by,br,Math.PI,0);
            ctx.fill();
            ctx.fillStyle=T[1];
            ctx.beginPath();
            ctx.arc(bx,by,br,0,Math.PI);
            ctx.fill();
            ctx.strokeStyle=T[2];
            ctx.lineWidth=1.4;
            ctx.beginPath();
            ctx.arc(bx,by,br,0,Math.PI*2);
            ctx.moveTo(bx-br,by);
            ctx.lineTo(bx+br,by);
            ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle=rgba('paper',0.45);
        ctx.beginPath();
        ctx.ellipse(cx-gr*0.42,gy-gr*0.45,gr*0.16,gr*0.32,0.6,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(cx,gy,gr,{width:2.6,seed:4602}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(cx-gr*0.35,gy-gr-10,gr*0.7,12);
        const kx=cx+bw*0.18;
        const ky=baseY+bh*0.38;
        const kr=Math.min(bh*0.24,gr*0.32);
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.arc(kx,ky,kr,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(kx,ky,kr,{width:2,seed:4603}),PALETTE.ink,v);
        const rot=busy?EASE.easeInOutCubic(Math.min(1,A.t/G().drop))*Math.PI*2:0;
        ctx.save();
        ctx.translate(kx,ky);
        ctx.rotate(rot);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(-kr*0.9,-kr*0.22,kr*1.8,kr*0.44);
        ctx.restore();
        const sx=cx-bw*0.24;
        const sy=baseY+bh*0.62;
        const sw=bw*0.3;
        const sh=bh*0.26;
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(sx-sw/2,sy-sh/2,sw,sh);
        ctx.fillStyle=PALETTE.paper;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        fitText(ctx,t('gacha.machine'),cx,baseY+bh*0.82,bw-16,small?11:14,'bold ');
        if (A&&A.t>=G().drop*0.7&&A.t<G().fly) {
            const k=Math.min(1,(A.t-G().drop*0.7)/(G().drop*0.3));
            const T=relicTone(A.id);
            const r=sh*0.55;
            ctx.save();
            ctx.translate(sx,sy-sh*0.6+k*sh*0.6);
            ctx.fillStyle=T[0];
            ctx.beginPath();
            ctx.arc(0,0,r,Math.PI,0);
            ctx.fill();
            ctx.fillStyle=T[1];
            ctx.beginPath();
            ctx.arc(0,0,r,0,Math.PI);
            ctx.fill();
            ctx.restore();
        }
        ctx.restore();
    }

    drawCoins(ctx,v,small) {
        const B=this.coinBox;
        const k=Math.sin(Math.min(1,this.walletK)*Math.PI);
        const poor=!godMode()&&dots()<relicPrice();
        ctx.save();
        ctx.translate(B.x+B.w/2+Math.sin(time.real*40)*this.shake*3,B.y+B.h/2);
        ctx.scale(1+k*0.08,1+k*0.08);
        ctx.translate(-B.w/2,-B.h/2);
        ctx.fillStyle=k>0?rgba('red',0.1*k+0.04):rgba('paper',0.97);
        ctx.fillRect(0,0,B.w,B.h);
        drawShape(ctx,sketchRect(0,0,B.w,B.h,{width:2,seed:4606}),PALETTE.ink,v);
        const r=small?11:15;
        drawCoin(ctx,14+r,B.h/2,r);
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        fitText(ctx,t('gacha.coins'),24+r*2,B.h/2,B.w*0.4,small?12:14,'');
        ctx.fillStyle=poor?PALETTE.red:PALETTE.ink;
        ctx.textAlign='right';
        fitText(ctx,godMode()?'∞':String(dots()),B.w-14,B.h/2+1,B.w*0.4,small?22:30,'bold ');
        ctx.restore();
    }

    gridLayout(small) {
        const Gr=this.G;
        const dh=small?96:140;
        const V={x:Gr.x,y:Gr.y,w:Gr.w,h:Gr.h-dh-(small?8:12)};
        const ts=small?50:66;
        const gapX=small?18:30;
        const gapY=small?12:20;
        const lab=small?16:20;
        const cols=Math.max(3,Math.floor((V.w-24+gapX)/(ts+gapX)));
        const rows=Math.ceil(RELIC_ORDER.length/cols);
        const rowW=cols*ts+(cols-1)*gapX;
        return {V,dh,ts,gapX,gapY,lab,cols,x0:V.x+(V.w-12-rowW)/2,y0:V.y+(small?10:16),content:rows*(ts+lab+gapY)+(small?14:22)};
    }

    clampScroll() {
        const L=this.gridLayout(this.height<600);
        const max=Math.max(0,L.content-L.V.h);
        this.scrollTo=Math.max(0,Math.min(max,this.scrollTo||0));
        return max;
    }

    wheel(dy) {
        if (!this.open||this.anim) {
            return;
        }
        this.scrollTo=(this.scrollTo||0)+dy;
        this.clampScroll();
    }

    move(x,y) {
        const p=this.press;
        if (!p) {
            return;
        }
        if (Math.hypot(x-p.x0,y-p.y0)>8) {
            p.moved=true;
        }
        if (p.moved) {
            this.scrollTo=p.s0-(y-p.y0);
            this.clampScroll();
            this.scroll=this.scrollTo;
        }
    }

    up() {
        const p=this.press;
        this.press=null;
        if (!p||p.moved) {
            return;
        }
        for (const q of this.tiles) {
            if (Math.hypot(p.x0-q.x,p.y0-q.y)<q.r+8) {
                if (q.id!==this.sel) {
                    this.sel=q.id;
                    this.boxPop=1;
                    this.pulse[q.id]=1;
                    this.actions.select();
                }
                return;
            }
        }
    }

    drawGrid(ctx,v,small) {
        const L=this.gridLayout(small);
        const V=L.V;
        const max=this.clampScroll();
        const ts=L.ts;
        ctx.save();
        ctx.beginPath();
        ctx.rect(V.x,V.y,V.w,V.h);
        ctx.clip();
        this.tiles=[];
        const si=Math.max(0,RELIC_ORDER.indexOf(this.sel));
        const sx=L.x0+(si%L.cols)*(ts+L.gapX)+ts/2;
        const sy=L.y0+Math.floor(si/L.cols)*(ts+L.lab+L.gapY)+ts/2;
        const now=time.real;
        const dt=Math.min(0.1,Math.max(0,now-(this.boxAt??now)));
        this.boxAt=now;
        if (this.boxX===undefined||this.t<0.05) {
            this.boxX=sx;
            this.boxY=sy;
        }
        const kk=1-Math.exp(-dt*G().boxFollow);
        this.boxX+=(sx-this.boxX)*kk;
        this.boxY+=(sy-this.boxY)*kk;
        this.boxPop=Math.max(0,(this.boxPop||0)-dt*3);
        const ap=EASE.easeOutBack(Math.max(0,Math.min(1,(this.t-0.1)/0.3)));
        if (ap>0) {
            const pop=1+Math.sin(Math.min(1,this.boxPop)*Math.PI)*0.12;
            const bw=(ts+L.gapX-6)*pop;
            const bh=(ts+(small?28:34))*pop;
            const cy=this.boxY-(this.scroll||0)+(small?8:9);
            const bx=this.boxX-bw/2;
            const top=cy-bh/2;
            const rr=small?8:10;
            ctx.save();
            ctx.globalAlpha*=Math.min(1,ap);
            ctx.beginPath();
            ctx.moveTo(bx+rr,top);
            ctx.arcTo(bx+bw,top,bx+bw,top+bh,rr);
            ctx.arcTo(bx+bw,top+bh,bx,top+bh,rr);
            ctx.arcTo(bx,top+bh,bx,top,rr);
            ctx.arcTo(bx,top,bx+bw,top,rr);
            ctx.closePath();
            ctx.fillStyle=rgba('red',0.08+this.boxPop*0.08);
            ctx.fill();
            ctx.strokeStyle=PALETTE.red;
            ctx.lineWidth=2.2;
            ctx.setLineDash([6,4]);
            ctx.lineDashOffset=-now*16;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.lineDashOffset=0;
            ctx.restore();
        }
        RELIC_ORDER.forEach((id,i)=>{
            const c=i%L.cols;
            const r=Math.floor(i/L.cols);
            const x=L.x0+c*(ts+L.gapX)+ts/2;
            const y=L.y0+r*(ts+L.lab+L.gapY)+ts/2-(this.scroll||0);
            if (y+ts/2+L.lab<V.y||y-ts/2>V.y+V.h) {
                return;
            }
            const own=relicOwned(id);
            const sel=id===this.sel;
            const hv=Math.hypot(this.hx-x,this.hy-y)<ts/2+4;
            const pu=this.pulse[id]||0;
            const ap=EASE.easeOutBack(Math.max(0,Math.min(1,(this.t-0.1-i*0.025)/0.3)));
            if (ap<=0) {
                return;
            }
            ctx.save();
            ctx.translate(x,y);
            const sc=ap*(1+(hv?0.06:0)+Math.sin(pu*Math.PI)*0.2);
            ctx.scale(sc,sc);
            drawRelicIcon(ctx,id,0,own&&sel?Math.sin(time.real*2+i)*2:0,ts/2/50,v,!own);
            if (!own) {
                drawLock(ctx,ts*0.36,ts*0.34,0.8,PALETTE.nearGray);
            }
            ctx.restore();
            ctx.fillStyle=own?(sel?PALETTE.red:PALETTE.ink):PALETTE.midGray;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            fitText(ctx,t('relic.'+id+'.name'),x,y+ts/2+(small?4:6),ts+L.gapX-4,small?11:13,sel?'bold ':'');
            this.tiles.push({id,x,y,r:ts/2});
        });
        ctx.restore();
        if (max>0) {
            const th=Math.max(26,V.h*V.h/L.content);
            const ty=V.y+(V.h-th)*((this.scroll||0)/max);
            ctx.fillStyle=rgba('farGray',0.6);
            ctx.fillRect(V.x+V.w-6,V.y,4,V.h);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(V.x+V.w-7,ty,6,th);
        }
        const gx=V.x;
        const gw=V.w;
        const dh=L.dh;
        const dy=V.y+V.h+(small?8:12);
        const id=this.sel;
        const own=relicOwned(id);
        ctx.fillStyle=rgba('paper',0.96);
        ctx.fillRect(gx,dy,gw,dh);
        drawShape(ctx,sketchRect(gx,dy,gw,dh,{width:1.6,seed:4640}),PALETTE.ink,v);
        const ir=small?20:28;
        drawRelicIcon(ctx,id,gx+12+ir,dy+dh/2,ir/50,v,!own);
        if (!own) {
            drawLock(ctx,gx+12+ir*1.7,dy+dh/2+ir*0.6,0.9,PALETTE.nearGray);
        }
        const tx=gx+26+ir*2;
        ctx.fillStyle=own?PALETTE.ink:PALETTE.nearGray;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        fitText(ctx,t('relic.'+id+'.name')+(RELIC_STARTERS.includes(id)?t('ui.sep')+t('gacha.starter'):''),tx,dy+10,gx+gw-tx-12,small?17:20,'bold ');
        ctx.font=(small?14:17)+'px '+FONT;
        ctx.fillStyle=own?PALETTE.nearGray:PALETTE.midGray;
        const lines=own?wrapText(ctx,t('relic.'+id+'.desc',relicParams(id)),gx+gw-tx-12):[t('gacha.lockedDesc')];
        const lh=small?18:23;
        const mx=Math.max(1,Math.floor((dh-(small?36:44))/lh));
        lines.slice(0,mx).forEach((ln,q)=>ctx.fillText(ln,tx,dy+(small?34:40)+q*lh));
    }

    drawCapsule(ctx,x,y,r,T,rot,crack) {
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(rot);
        if (crack>0) {
            ctx.fillStyle=rgba('paper',0.35*crack);
            ctx.beginPath();
            ctx.arc(0,0,r*(1.25+crack*0.5),0,Math.PI*2);
            ctx.fill();
        }
        ctx.fillStyle=T[0];
        ctx.beginPath();
        ctx.arc(0,0,r,Math.PI,0);
        ctx.fill();
        ctx.fillStyle=T[1];
        ctx.beginPath();
        ctx.arc(0,0,r,0,Math.PI);
        ctx.fill();
        ctx.strokeStyle=T[2];
        ctx.lineWidth=Math.max(2,r*0.05);
        ctx.beginPath();
        ctx.arc(0,0,r,0,Math.PI*2);
        ctx.stroke();
        ctx.strokeStyle=crack>0?rgba('paper',0.5+crack*0.5):T[2];
        ctx.lineWidth=Math.max(2,r*(0.05+crack*0.08));
        ctx.beginPath();
        ctx.moveTo(-r,0);
        for (let q=1;q<=8;q++) {
            ctx.lineTo(-r+q*r/4,(q%2?-1:1)*r*0.08*crack);
        }
        ctx.stroke();
        ctx.fillStyle=rgba('paper',0.5);
        ctx.beginPath();
        ctx.ellipse(-r*0.4,-r*0.45,r*0.14,r*0.26,0.6,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    drawBigMachine(ctx,v,cx,cy,gr,A) {
        const g=G();
        const t=A.t;
        const crank=Math.max(0,Math.min(1,(t-g.intro)/(g.drop-g.intro)));
        const busy=t>=g.intro&&t<g.drop+0.2;
        const now=time.real;
        const baseY=cy+gr*0.82;
        const bw=gr*1.9;
        const bh=gr*1.15;
        ctx.save();
        ctx.translate(busy?Math.sin(t*38)*g.shake*2:0,0);
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(cx-bw/2,baseY,bw,bh);
        drawShape(ctx,sketchRect(cx-bw/2,baseY,bw,bh,{width:3,seed:4651}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.darkRed;
        ctx.fillRect(cx-bw/2,baseY+bh-10,bw,10);
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.arc(cx,cy,gr,0,Math.PI*2);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx,cy,gr-4,0,Math.PI*2);
        ctx.clip();
        for (let i=0;i<g.balls;i++) {
            const T=relicTone(RELIC_ORDER[i%RELIC_ORDER.length]);
            const rate=g.bounce*(0.8+hash1(i*3)*0.6)*(busy?2.6:1);
            const hop=Math.abs(Math.sin(now*rate+i*1.7))*gr*(busy?0.4:0.13);
            const bx=cx+(hash1(i*13+1)-0.5)*gr*1.5+Math.sin(now*rate*0.5+i)*gr*(busy?0.08:0.02);
            const by=cy+gr*0.55-Math.floor(i/5)*gr*0.3-hash1(i*7)*gr*0.12-hop;
            this.drawCapsule(ctx,bx,by,gr*0.2,T,Math.sin(now+i)*0.3,0);
        }
        ctx.restore();
        drawShape(ctx,sketchCircle(cx,cy,gr,{width:3,seed:4652}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(cx-gr*0.35,cy-gr-12,gr*0.7,14);
        const kx=cx+bw*0.2;
        const ky=baseY+bh*0.4;
        const kr=bh*0.26;
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.arc(kx,ky,kr,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(kx,ky,kr,{width:2.4,seed:4653}),PALETTE.ink,v);
        ctx.save();
        ctx.translate(kx,ky);
        ctx.rotate(EASE.easeInOutCubic(crank)*Math.PI*4);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(-kr*0.9,-kr*0.22,kr*1.8,kr*0.44);
        ctx.restore();
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(cx-bw*0.4,baseY+bh*0.5,bw*0.32,bh*0.3);
        ctx.restore();
        return {sx:cx-bw*0.24,sy:baseY+bh*0.65,floor:baseY+bh};
    }

    drawReveal(ctx,v) {
        const A=this.anim;
        const g=G();
        const w=this.width;
        const h=this.height;
        if (!A) {
            return;
        }
        const T=relicTone(A.id);
        const dk=Math.min(1,A.t/0.35);
        ctx.save();
        ctx.fillStyle=rgba('ink',0.88*dk);
        ctx.fillRect(0,0,w,h);
        const cx=w/2;
        const cy=h*g.cy;
        const big=Math.min(w,h)*0.17;
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate(time.real*0.25);
        for (let i=0;i<16;i++) {
            ctx.rotate(Math.PI/8);
            ctx.fillStyle=rgba('paper',0.04*dk);
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(Math.max(w,h),-Math.max(w,h)*0.08);
            ctx.lineTo(Math.max(w,h),Math.max(w,h)*0.08);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        if (A.t<g.reveal) {
            const gr=Math.min(w*0.2,h*0.24);
            const mIn=EASE.easeOutBack(Math.min(1,A.t/g.intro));
            const mOut=EASE.easeInCubic(Math.max(0,Math.min(1,(A.t-g.fly)/0.5)));
            const my=h*0.36+(1-mIn)*h*0.7+mOut*h*0.9;
            const S=this.drawBigMachine(ctx,v,cx,my,gr,A);
            const cr=gr*0.28;
            if (A.t>=g.drop&&A.t<g.fly) {
                const k=Math.min(1,(A.t-g.drop)/(g.fly-g.drop));
                const fall=EASE.easeOutBounce?EASE.easeOutBounce(Math.min(1,k*1.6)):Math.min(1,k*1.6);
                const x=S.sx-k*gr*0.6;
                const y=S.sy+(S.floor+cr*1.1-S.sy)*fall;
                this.drawCapsule(ctx,x,y,cr,T,-k*6,0);
                A.cx=x;
                A.cy=y;
            }
            else if (A.t>=g.fly) {
                const k=EASE.easeInOutCubic(Math.min(1,(A.t-g.fly)/0.55));
                const x0=A.cx??cx;
                const y0=A.cy??cy;
                const wobT=Math.max(0,(A.t-g.fly-0.55)/(g.reveal-g.fly-0.55));
                const wob=Math.sin(A.t*(30+wobT*30))*0.25*wobT;
                const r=cr+(big-cr)*k;
                this.drawCapsule(ctx,x0+(cx-x0)*k,y0+(cy-y0)*k-Math.sin(k*Math.PI)*h*0.12,r,T,wob+(1-k)*-6,wobT);
                if (wobT>0) {
                    for (let q=0;q<6;q++) {
                        const an=time.real*3+q*1.05;
                        ctx.fillStyle=rgba('paper',0.6*wobT);
                        ctx.beginPath();
                        ctx.arc(cx+Math.cos(an)*big*(1.3+wobT*0.4),cy+Math.sin(an)*big*(1.3+wobT*0.4),2+wobT*3,0,Math.PI*2);
                        ctx.fill();
                    }
                }
            }
            ctx.restore();
            return;
        }
        const rt=A.t-g.reveal;
        const k=EASE.easeOutBack(Math.min(1,rt/0.45));
        const open=EASE.easeOutCubic(Math.min(1,rt/0.5));
        for (const sx of [-1,1]) {
            ctx.save();
            ctx.globalAlpha=Math.max(0,1-rt*1.6);
            ctx.translate(cx+sx*open*big*2.4,cy-(sx<0?1:-1)*open*big*0.4);
            ctx.rotate(sx*open*1.4);
            ctx.fillStyle=sx<0?T[0]:T[1];
            ctx.beginPath();
            ctx.arc(0,0,big,sx<0?Math.PI:0,sx<0?0:Math.PI);
            ctx.fill();
            ctx.restore();
        }
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate(time.real*0.6);
        for (let i=0;i<12;i++) {
            ctx.rotate(Math.PI/6);
            ctx.fillStyle=i%2?rgba('paper',0.1*k):rgba('red',0.22*k);
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(big*3.2,-big*0.35);
            ctx.lineTo(big*3.2,big*0.35);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
        ctx.save();
        ctx.translate(cx,cy+Math.sin(time.real*2.4)*4);
        ctx.scale(k,k);
        ctx.rotate(Math.sin(rt*14)*0.12*Math.max(0,1-rt*1.5));
        drawRelicIcon(ctx,A.id,0,0,big/46*1.05,v,false);
        ctx.restore();
        const tk=EASE.easeOutBack(Math.max(0,Math.min(1,(rt-0.25)/0.35)));
        ctx.save();
        ctx.globalAlpha=Math.min(1,tk);
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold '+Math.round(big*0.3)+'px '+FONT;
        ctx.fillText(t('gacha.got'),cx,cy-big*1.45-(1-tk)*20);
        ctx.fillStyle=PALETTE.paper;
        fitText(ctx,t('relic.'+A.id+'.name'),cx,cy+big*1.35,w-40,Math.round(big*0.36),'bold ');
        ctx.font=Math.max(13,Math.round(big*0.15))+'px '+FONT;
        ctx.fillStyle=rgba('paper',0.85);
        const lines=wrapText(ctx,t('relic.'+A.id+'.desc',relicParams(A.id)),Math.min(w-48,560));
        const lh=Math.max(17,Math.round(big*0.2));
        lines.slice(0,4).forEach((ln,i)=>ctx.fillText(ln,cx,cy+big*1.75+i*lh));
        if (rt>0.6) {
            ctx.globalAlpha=0.5+0.5*Math.sin(time.real*4);
            ctx.font='14px '+FONT;
            ctx.fillText(t('gacha.tap'),cx,h-24);
        }
        ctx.restore();
        ctx.restore();
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const P=this.P;
        const small=h<600;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.4));
        ctx.save();
        ctx.fillStyle=rgba('paper',Math.min(0.85,this.t*4));
        ctx.fillRect(0,0,w,h);
        ctx.translate(w/2,h/2);
        ctx.scale(0.9+0.1*a,0.9+0.1*a);
        ctx.translate(-w/2,-h/2);
        ctx.globalAlpha=Math.min(1,this.t*4);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:4600}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?20:28)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        const ty=P.y+(small?20:32);
        ctx.fillText(t('gacha.title'),P.x+20,ty);
        const ttw=ctx.measureText(t('gacha.title')).width;
        const own=RELIC_ORDER.filter(id=>relicOwned(id)).length;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='right';
        fitText(ctx,t('gacha.owned',{n:own,m:RELIC_ORDER.length}),P.x+P.w-20,ty,small?110:150,small?13:15,'bold ');
        ctx.textAlign='left';
        fitText(ctx,t('gacha.hint'),P.x+32+ttw,ty+1,P.w-ttw-(small?180:230),small?11:13,'');
        drawShape(ctx,sketchLine(P.x+16,ty+(small?16:24),P.x+P.w-16,ty+(small?16:24),{width:1.2,seed:4605}),rgba('midGray',0.7),v);
        this.drawGrid(ctx,v,small);
        this.drawMachine(ctx,v,small);
        this.drawCoins(ctx,v,small);
        drawButton(ctx,this.backBtn,t('menu.back'),v,(this.t-0.1)/0.3,this.hoverIdx===0,small?16:18);
        const left=godMode()?1:relicLocked().length;
        const poor=!godMode()&&dots()<relicPrice();
        ctx.save();
        if (left===0||poor) {
            ctx.globalAlpha*=0.55;
        }
        const pb=this.pullBtn;
        ctx.translate(Math.sin(time.real*40)*this.shake*3,0);
        drawButton(ctx,pb,left===0?t('gacha.empty'):t(godMode()?'gacha.pullFree':'gacha.pull',{n:relicPrice()}),v,(this.t-0.15)/0.3,this.hoverIdx===1&&!this.anim,small?16:19);
        ctx.restore();
        if (this.msg) {
            const k=Math.min(1,this.msg.t/0.2,(2.2-this.msg.t)/0.3);
            ctx.save();
            ctx.globalAlpha=Math.max(0,k);
            ctx.font='bold 13px '+FONT;
            const tw=ctx.measureText(this.msg.text).width+24;
            const mx=pb.x+pb.w/2;
            const my=this.coinBox.y-18-(1-k)*8;
            ctx.fillStyle=PALETTE.red;
            ctx.fillRect(mx-tw/2,my-13,tw,26);
            ctx.fillStyle=PALETTE.paper;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(this.msg.text,mx,my+1);
            ctx.restore();
        }
        ctx.restore();
        this.drawReveal(ctx,v);
        for (const q of this.sparks) {
            const f=q.t/q.life;
            ctx.globalAlpha=1-f;
            ctx.fillStyle=q.c;
            ctx.beginPath();
            ctx.arc(q.x,q.y,q.r*(1-f*0.5),0,Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha=1;
    }
}
