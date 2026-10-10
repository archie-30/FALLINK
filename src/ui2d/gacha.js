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
        const I=this.infoBtn;
        this.infoHover=!!I&&Math.hypot(x-I.x,y-I.y)<=I.r*1.8;
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
            const g=G();
            if (A.phase==='wait') {
                A.phase='charge';
                A.pt=0;
                A.crack=0;
            }
            else if (A.phase==='reveal'&&A.pt>g.closeAfter) {
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
        const I=this.infoBtn;
        if (I&&Math.hypot(x-I.x,y-I.y)<=I.r*1.8) {
            this.actions.info();
            return true;
        }
        if (inRect(this.G,x,y)) {
            this.press={x0:x,y0:y,s0:this.scrollTo||0,moved:false};
        }
        return true;
    }

    pull() {
        if (godMode()) {
            this.start(this.actions.pull());
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
        this.start(id);
    }

    start(id) {
        this.anim={id,t:0,pt:0,phase:'roll',cues:{},crack:0,wob:0,skip:false};
    }

    rolling() {
        return !!this.anim&&this.anim.phase!=='reveal';
    }

    cue(A,key,at,name,pitch=1) {
        if (A.cues[key]||A.t<at) {
            return;
        }
        A.cues[key]=true;
        if (!A.skip) {
            this.actions.sfx(name,pitch);
        }
    }

    stepAnim(A,dt) {
        const g=G();
        A.t+=dt;
        A.pt+=dt;
        if (A.phase==='roll') {
            this.cue(A,'whoosh',0.02,'whoosh');
            this.cue(A,'rise',g.clicks[0],'rise');
            g.clicks.forEach((c,i)=>this.cue(A,'c'+i,c,'click',1+i*0.12));
            this.cue(A,'drop',g.drop,'drop');
            g.bounces.forEach((c,i)=>this.cue(A,'b'+i,c,'bounce',1+i*0.18));
            if (A.t>=g.flyEnd) {
                A.phase='wait';
                A.pt=0;
                this.actions.sfx('hover');
            }
            return;
        }
        if (A.phase==='wait') {
            const w=Math.floor(A.pt/g.wobbleEvery);
            if (w>A.wob) {
                A.wob=w;
                this.actions.sfx('wobble');
            }
            return;
        }
        if (A.phase==='charge') {
            g.cracks.forEach((c,i)=>{
                if (A.pt>=c&&A.crack<=i) {
                    A.crack=i+1;
                    A.kick=1;
                    this.actions.sfx('crack',1+i*0.2);
                }
            });
            A.kick=Math.max(0,(A.kick||0)-dt*5);
            if (A.pt>=g.charge) {
                A.phase='reveal';
                A.pt=0;
                this.actions.sfx('burst');
                this.actions.sfx('fanfare');
                this.boom(A);
            }
        }
    }

    boom(A) {
        const g=G();
        const cx=this.width/2;
        const cy=this.height*g.cy;
        const T=relicTone(A.id);
        const cols=[T[0],T[1],PALETTE.red,PALETTE.gold,PALETTE.paper];
        for (let i=0;i<g.sparks;i++) {
            const a=Math.random()*Math.PI*2;
            const sp=200+Math.random()*520;
            this.sparks.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-160,t:0,life:0.6+Math.random()*0.7,r:2+Math.random()*6,c:cols[i%cols.length]});
        }
        for (let i=0;i<g.confetti;i++) {
            const a=-Math.PI/2+(Math.random()-0.5)*2.4;
            const sp=300+Math.random()*520;
            this.sparks.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:1.6+Math.random()*1.2,r:5+Math.random()*5,c:cols[i%cols.length],conf:true,rot:Math.random()*6,spin:(Math.random()-0.5)*14});
        }
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
        if (this.anim) {
            this.stepAnim(this.anim,dt);
        }
        for (let i=this.sparks.length-1;i>=0;i--) {
            const q=this.sparks[i];
            q.t+=dt;
            q.x+=q.vx*dt;
            q.y+=q.vy*dt;
            if (q.conf) {
                q.vx*=Math.exp(-dt*2.2);
                q.vy=q.vy*Math.exp(-dt*2.2)+260*dt;
                q.rot+=q.spin*dt;
            }
            else {
                q.vy+=520*dt;
            }
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
        const busy=A&&A.phase==='roll';
        const shk=(busy?Math.sin(A.t*40)*G().shake*(1-Math.min(1,A.t/G().flyEnd)):0)+Math.sin(now*40)*this.shake*G().shake;
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

    crankAngle(A) {
        const g=G();
        let a=0;
        g.clicks.forEach(c=>{
            a+=EASE.easeOutBack(Math.max(0,Math.min(1,(A.t-c)/g.clickTime)))*Math.PI/2;
        });
        return a;
    }

    drawBigMachine(ctx,v,cx,cy,gr,A) {
        const g=G();
        const t=A.t;
        const busy=t>=g.clicks[0]&&t<g.drop+0.15;
        const heat=Math.max(0,Math.min(1,(t-g.clicks[0])/(g.drop-g.clicks[0])));
        const now=time.real;
        const baseY=cy+gr*0.82;
        const bw=gr*1.9;
        const bh=gr*1.15;
        ctx.save();
        let kick=0;
        g.clicks.forEach(c=>{
            const d=t-c;
            if (d>=0&&d<0.18) {
                kick=Math.max(kick,1-d/0.18);
            }
        });
        ctx.translate(busy?Math.sin(t*46)*g.shake*(1+heat*3):0,-kick*gr*0.04);
        ctx.fillStyle=rgba('red',0.18*heat);
        ctx.beginPath();
        ctx.arc(cx,cy,gr*(1.15+heat*0.25+Math.sin(now*9)*0.03*heat),0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(cx-bw/2,baseY,bw,bh);
        drawShape(ctx,sketchRect(cx-bw/2,baseY,bw,bh,{width:3,seed:4651}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.darkRed;
        ctx.fillRect(cx-bw/2,baseY+bh-10,bw,10);
        ctx.fillStyle=PALETTE.gold;
        ctx.fillRect(cx-bw/2+8,baseY+8,bw-16,5);
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.arc(cx,cy,gr,0,Math.PI*2);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx,cy,gr-4,0,Math.PI*2);
        ctx.clip();
        const spin=this.crankAngle(A);
        for (let i=0;i<g.balls;i++) {
            const T=relicTone(RELIC_ORDER[i%RELIC_ORDER.length]);
            const rate=g.bounce*(0.8+hash1(i*3)*0.6)*(1+heat*2.2);
            const hop=Math.abs(Math.sin(now*rate+i*1.7))*gr*(0.12+heat*0.4+kick*0.15);
            const sw=spin*0.35+i;
            const bx=cx+(hash1(i*13+1)-0.5)*gr*1.5+Math.sin(sw)*gr*0.12*heat;
            const by=cy+gr*0.55-Math.floor(i/5)*gr*0.3-hash1(i*7)*gr*0.12-hop;
            this.drawCapsule(ctx,bx,by,gr*0.2,T,Math.sin(now*(1+heat*4)+i)*0.4,0);
        }
        ctx.fillStyle=rgba('paper',0.35);
        ctx.beginPath();
        ctx.ellipse(cx-gr*0.45,cy-gr*0.45,gr*0.16,gr*0.32,0.7,0,Math.PI*2);
        ctx.fill();
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
        ctx.rotate(spin);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(-kr*0.95,-kr*0.22,kr*1.9,kr*0.44);
        ctx.fillStyle=PALETTE.gold;
        ctx.beginPath();
        ctx.arc(kr*0.95,0,kr*0.2,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
        if (kick>0) {
            ctx.strokeStyle=rgba('paper',kick*0.8);
            ctx.lineWidth=2;
            for (let q=0;q<3;q++) {
                const an=-0.9+q*0.45;
                ctx.beginPath();
                ctx.moveTo(kx+Math.cos(an)*kr*1.3,ky+Math.sin(an)*kr*1.3);
                ctx.lineTo(kx+Math.cos(an)*kr*(1.6+kick*0.5),ky+Math.sin(an)*kr*(1.6+kick*0.5));
                ctx.stroke();
            }
        }
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(cx-bw*0.4,baseY+bh*0.5,bw*0.32,bh*0.3);
        ctx.restore();
        return {sx:cx-bw*0.24,sy:baseY+bh*0.65,floor:baseY+bh};
    }

    drawRays(ctx,cx,cy,len,n,spin,a,col) {
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate(spin);
        for (let i=0;i<n;i++) {
            ctx.rotate(Math.PI*2/n);
            ctx.fillStyle=i%2?rgba('paper',a):col;
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(len,-len*0.12);
            ctx.lineTo(len,len*0.12);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }

    drawGlow(ctx,x,y,r,col,a) {
        const gr=ctx.createRadialGradient(x,y,r*0.2,x,y,r);
        gr.addColorStop(0,col);
        gr.addColorStop(1,'rgba(0,0,0,0)');
        ctx.save();
        ctx.globalAlpha*=a;
        ctx.fillStyle=gr;
        ctx.beginPath();
        ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
    }

    drawCracks(ctx,x,y,r,n,rot,seed) {
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(rot);
        ctx.strokeStyle=PALETTE.paper;
        ctx.lineWidth=Math.max(2,r*0.05);
        ctx.lineCap='round';
        for (let i=0;i<n*2;i++) {
            const a0=hash1(seed+i*5)*Math.PI*2;
            ctx.beginPath();
            let px=Math.cos(a0)*r*0.15;
            let py=Math.sin(a0)*r*0.15;
            ctx.moveTo(px,py);
            for (let k=1;k<=4;k++) {
                const a=a0+(hash1(seed+i*5+k)-0.5)*0.9;
                px=Math.cos(a)*r*(0.15+k*0.2);
                py=Math.sin(a)*r*(0.15+k*0.2);
                ctx.lineTo(px,py);
            }
            ctx.stroke();
        }
        ctx.restore();
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
        const now=time.real;
        const dk=Math.min(1,A.t/0.3);
        const cx=w/2;
        const cy=h*g.cy;
        const big=Math.min(w,h)*0.15;
        ctx.save();
        ctx.fillStyle=rgba('ink',g.dim*dk);
        ctx.fillRect(0,0,w,h);
        const vg=ctx.createRadialGradient(cx,cy,big,cx,cy,Math.max(w,h)*0.75);
        vg.addColorStop(0,'rgba(0,0,0,0)');
        vg.addColorStop(1,rgba('ink',0.6*dk));
        ctx.fillStyle=vg;
        ctx.fillRect(0,0,w,h);
        if (A.phase==='roll') {
            this.drawRays(ctx,cx,cy,Math.max(w,h),16,now*0.2,0.03*dk,rgba('paper',0.015*dk));
            const gr=Math.min(w*0.2,h*0.24);
            const mIn=EASE.easeOutBack(Math.min(1,A.t/g.intro));
            const mOut=EASE.easeInCubic(Math.max(0,Math.min(1,(A.t-g.fly)/0.45)));
            const my=h*0.36+(1-mIn)*h*0.75+mOut*h*0.95;
            const S=this.drawBigMachine(ctx,v,cx,my,gr,A);
            const cr=gr*0.28;
            if (A.t>=g.drop&&A.t<g.fly) {
                const k=Math.min(1,(A.t-g.drop)/(g.fly-g.drop));
                const fall=EASE.easeOutBounce(k);
                const x=S.sx-k*gr*0.9;
                const y=S.sy+(S.floor+cr*1.1-S.sy)*fall;
                this.drawCapsule(ctx,x,y,cr,T,-k*8,0);
                A.cx=x;
                A.cy=y;
            }
            else if (A.t>=g.fly) {
                const k=EASE.easeInOutCubic(Math.min(1,(A.t-g.fly)/(g.flyEnd-g.fly)));
                const x0=A.cx??cx;
                const y0=A.cy??cy+h*0.3;
                const r=cr+(big-cr)*k;
                this.drawGlow(ctx,x0+(cx-x0)*k,y0+(cy-y0)*k,r*2.2,T[0],k*0.6);
                this.drawCapsule(ctx,x0+(cx-x0)*k,y0+(cy-y0)*k-Math.sin(k*Math.PI)*h*0.14,r,T,(1-k)*-8,0);
            }
            ctx.restore();
            return;
        }
        if (A.phase==='wait'||A.phase==='charge') {
            const charging=A.phase==='charge';
            const ck=charging?Math.min(1,A.pt/g.charge):0;
            this.drawRays(ctx,cx,cy,Math.max(w,h),16,now*(0.25+ck*2.5),0.025+ck*0.07,rgba('red',0.04+ck*0.1));
            const pulse=0.5+0.5*Math.sin(now*3);
            this.drawGlow(ctx,cx,cy,big*(2.1+pulse*0.25+ck*1.2),T[0],0.55+ck*0.4);
            this.drawGlow(ctx,cx,cy,big*(1.5+ck*0.6),rgba('paper',1),0.18+ck*0.5);
            const wobP=charging?0:(A.pt%g.wobbleEvery)/g.wobbleEvery;
            const wob=wobP<0.25?Math.sin(wobP/0.25*Math.PI*3)*0.22*(1-wobP/0.25):0;
            const shake=charging?(ck*ck*10+(A.kick||0)*8):0;
            const bob=charging?0:Math.sin(now*2.2)*big*0.06;
            const sc=1+(A.kick||0)*0.12+ck*0.1;
            const x=cx+(Math.random()-0.5)*shake;
            const y=cy+bob+(Math.random()-0.5)*shake;
            for (let q=0;q<8;q++) {
                const an=now*(1.4+ck*4)+q*Math.PI/4;
                const rr=big*(1.45+0.08*Math.sin(now*3+q));
                ctx.fillStyle=q%2?rgba('paper',0.8):T[0];
                ctx.beginPath();
                ctx.arc(cx+Math.cos(an)*rr,cy+Math.sin(an)*rr*0.9,2+((q*7)%3),0,Math.PI*2);
                ctx.fill();
            }
            this.drawCapsule(ctx,x,y,big*sc,T,wob,ck);
            if (A.crack>0) {
                this.drawCracks(ctx,x,y,big*sc,A.crack,0,A.id.length*31);
                ctx.save();
                ctx.globalAlpha=Math.min(1,A.crack/3);
                ctx.fillStyle=rgba('paper',0.9);
                ctx.fillRect(x-big*sc*1.6,y-big*0.035*A.crack,big*sc*3.2,big*0.07*A.crack);
                ctx.restore();
            }
            if (!charging) {
                const tk=Math.min(1,A.pt/0.4);
                const fs=Math.max(16,Math.round(big*0.19));
                ctx.font='bold '+fs+'px '+FONT;
                const tw=ctx.measureText(t('gacha.open')).width+fs*1.6;
                const ty=cy+big*1.8+Math.sin(now*3)*3;
                ctx.globalAlpha=tk;
                ctx.fillStyle=rgba('ink',0.85);
                ctx.fillRect(cx-tw/2,ty-fs*0.9,tw,fs*1.8);
                ctx.strokeStyle=rgba('paper',0.35+0.35*Math.sin(now*4));
                ctx.lineWidth=2;
                ctx.strokeRect(cx-tw/2,ty-fs*0.9,tw,fs*1.8);
                ctx.fillStyle=PALETTE.paper;
                ctx.textAlign='center';
                ctx.textBaseline='middle';
                ctx.fillText(t('gacha.open'),cx,ty+1);
                ctx.globalAlpha=1;
            }
            if (ck>0.6) {
                ctx.fillStyle=rgba('paper',(ck-0.6)/0.4*0.6);
                ctx.fillRect(0,0,w,h);
            }
            ctx.restore();
            return;
        }
        const rt=A.pt;
        this.drawRays(ctx,cx,cy,Math.max(w,h),14,now*0.5,0.06,rgba('red',0.14));
        this.drawGlow(ctx,cx,cy,big*2.6,T[0],0.7);
        const ring=Math.min(1,rt/0.6);
        if (ring<1) {
            ctx.strokeStyle=rgba('paper',1-ring);
            ctx.lineWidth=10*(1-ring)+2;
            ctx.beginPath();
            ctx.arc(cx,cy,big*(0.8+ring*4),0,Math.PI*2);
            ctx.stroke();
        }
        const open=EASE.easeOutCubic(Math.min(1,rt/0.55));
        for (const sx of [-1,1]) {
            ctx.save();
            ctx.globalAlpha=Math.max(0,1-rt*1.5);
            ctx.translate(cx+sx*open*big*3,cy-(sx<0?1:-1)*open*big*0.6+open*open*big*1.5);
            ctx.rotate(sx*open*2.2);
            ctx.fillStyle=sx<0?T[0]:T[1];
            ctx.beginPath();
            ctx.arc(0,0,big,sx<0?Math.PI:0,sx<0?0:Math.PI);
            ctx.fill();
            ctx.restore();
        }
        const k=EASE.easeOutBack(Math.min(1,Math.max(0,rt-0.08)/0.5));
        ctx.save();
        ctx.translate(cx,cy+Math.sin(now*2.4)*4);
        ctx.scale(k*1.1,k*1.1);
        ctx.rotate(Math.sin(rt*12)*0.1*Math.max(0,1-rt*1.2));
        drawRelicIcon(ctx,A.id,0,0,big/46,v,false);
        ctx.restore();
        const bk=Math.min(1,Math.max(0,rt-0.3)/0.28);
        if (bk>0) {
            const bs=1+(1-EASE.easeOutCubic(bk))*1.3;
            ctx.save();
            ctx.globalAlpha=bk;
            ctx.translate(cx,cy-big*1.55);
            ctx.scale(bs,bs);
            ctx.rotate(-0.04);
            ctx.font='bold '+Math.round(big*0.3)+'px '+FONT;
            const bw=ctx.measureText(t('gacha.got')).width+big*0.6;
            ctx.fillStyle=PALETTE.red;
            ctx.fillRect(-bw/2,-big*0.24,bw,big*0.48);
            ctx.fillStyle=PALETTE.paper;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('gacha.got'),0,1);
            ctx.restore();
        }
        const tk=Math.min(1,Math.max(0,rt-0.55)/0.35);
        ctx.save();
        ctx.globalAlpha=tk;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillStyle=PALETTE.paper;
        fitText(ctx,t('relic.'+A.id+'.name'),cx,cy+big*1.45+(1-tk)*14,w-40,Math.round(big*0.34),'bold ');
        ctx.font=Math.max(13,Math.round(big*0.15))+'px '+FONT;
        ctx.fillStyle=rgba('paper',0.85);
        const lines=wrapText(ctx,t('relic.'+A.id+'.desc',relicParams(A.id)),Math.min(w-48,560));
        const lh=Math.max(17,Math.round(big*0.2));
        lines.slice(0,4).forEach((ln,i)=>ctx.fillText(ln,cx,cy+big*1.85+i*lh+(1-tk)*14));
        if (rt>g.closeAfter) {
            ctx.globalAlpha=0.5+0.5*Math.sin(now*4);
            ctx.font='14px '+FONT;
            ctx.fillText(t('gacha.tap'),cx,h-24);
        }
        ctx.restore();
        const fl=1-Math.min(1,rt/g.flash);
        if (fl>0) {
            ctx.fillStyle=rgba('paper',fl);
            ctx.fillRect(0,0,w,h);
        }
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
        const hmax=P.w-ttw-(small?210:260);
        fitText(ctx,t('gacha.hint'),P.x+32+ttw,ty+1,hmax,small?11:13,'');
        const hw=Math.min(hmax,ctx.measureText(t('gacha.hint')).width);
        const ir=small?9:10;
        this.infoBtn={x:P.x+32+ttw+hw+ir+8,y:ty,r:ir};
        ctx.save();
        ctx.translate(this.infoBtn.x,this.infoBtn.y);
        ctx.fillStyle=this.infoHover?PALETTE.ink:PALETTE.paper;
        ctx.beginPath();
        ctx.arc(0,0,ir,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(0,0,ir,{width:1.6,seed:4607}),PALETTE.ink,v);
        ctx.fillStyle=this.infoHover?PALETTE.paper:PALETTE.ink;
        ctx.font='bold italic '+(ir+4)+'px Georgia,serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('i',0,1);
        ctx.restore();
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
            ctx.globalAlpha=q.conf?Math.min(1,(1-f)*3):1-f;
            ctx.fillStyle=q.c;
            if (q.conf) {
                ctx.save();
                ctx.translate(q.x,q.y);
                ctx.rotate(q.rot);
                ctx.scale(1,Math.cos(q.rot*1.7));
                ctx.fillRect(-q.r,-q.r*0.5,q.r*2,q.r);
                ctx.restore();
                continue;
            }
            ctx.beginPath();
            ctx.arc(q.x,q.y,q.r*(1-f*0.5),0,Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha=1;
    }
}
