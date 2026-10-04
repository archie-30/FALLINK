import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {sketchRect,sketchLine,sketchPath,hatchFill,rectPoly,drawShape} from './sketch.js';
import {EASE} from '../core/easing.js';
import {wrapText} from './cardView.js';
import {CARDS} from '../data/cards.js';
import {ACTS,ENDLESS} from '../data/levels.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

function wobblyLine(ctx,x1,y1,x2,y2,seed,amp=0.8) {
    drawShape(ctx,sketchLine(x1,y1,x2,y2,{width:ctx.lineWidth*1.1,jitter:amp,seed,overshoot:1.5}),ctx.strokeStyle);
}

function wobblyRect(ctx,x,y,w,h,seed,amp=0.8) {
    drawShape(ctx,sketchRect(x,y,w,h,{width:ctx.lineWidth*1.1,jitter:amp,seed,overshoot:2}),ctx.strokeStyle);
}

const BOTTLE_W=46;
const BOTTLE_H=60;
const BOTTLE_PTS=[[14,-14],[14,-4],[4,4],[0,14],[0,BOTTLE_H-6],[6,BOTTLE_H],[BOTTLE_W-6,BOTTLE_H],[BOTTLE_W,BOTTLE_H-6],[BOTTLE_W,14],[BOTTLE_W-4,4],[BOTTLE_W-14,-4],[BOTTLE_W-14,-14]];
const BOTTLE_PATH=(()=>{
    const p=new Path2D();
    p.moveTo(BOTTLE_PTS[0][0],BOTTLE_PTS[0][1]);
    for (const q of BOTTLE_PTS) {
        p.lineTo(q[0],q[1]);
    }
    p.closePath();
    return p;
})();

export function fmtInk(v) {
    const r=Math.round(v*10)/10;
    return Number.isInteger(r)?String(r):r.toFixed(1);
}

export class Hud {
    constructor() {
        this.hpShown=TUNING.player.maxHp;
        this.inkShown=0;
        this.slosh=0;
        this.inkShakeT=0;
        this.inkPop=0;
        this.inkPopups=[];
        this.bannerText='';
        this.bannerSub='';
        this.bannerT=0;
        this.bannerDur=0;
        this.bossShown=1;
        this.prog=null;
        this.scoreShown=0;
        this.scorePop=0;
        this.scoreAt=0;
        this.scoreShake=0;
        this.flys=[];
    }

    drawEnemyHp(ctx,enemies,project,tmp) {
        const E=TUNING.hud.enemyHp;
        for (const e of enemies.list) {
            const d=e.def;
            if (d.boss||!e.alive||(e.state==='spawn'&&!e.quick)) {
                continue;
            }
            project(e.renderPos.x,0,e.renderPos.z,tmp);
            const n=Math.max(E.minTicks,Math.min(E.maxTicks,Math.round(d.hp/E.hpPerTick)));
            const r=E.radius+d.radius*E.radiusScale;
            const span=Math.PI*E.span;
            const cx=tmp.x;
            const cy=tmp.y+E.offset+d.radius*E.radiusScale*0.4;
            const f=Math.max(0,e.hp/e.maxHp);
            const shown=e.hpShown??f;
            e.hpShown=shown+(f-shown)*E.follow;
            const lit=f*n;
            const trail=e.hpShown*n;
            for (let i=0;i<n;i++) {
                const a=Math.PI/2+span/2-span*(i+0.5)/n;
                const x=cx+Math.cos(a)*r;
                const y=cy-r+Math.sin(a)*r;
                const filled=i<Math.ceil(lit-0.001);
                const lost=!filled&&i<Math.ceil(trail-0.001);
                ctx.save();
                ctx.translate(x,y);
                ctx.rotate(a-Math.PI/2);
                ctx.fillStyle=PALETTE.paper;
                ctx.fillRect(-E.tickW/2-1.5,-E.tickH/2-1.5,E.tickW+3,E.tickH+3);
                ctx.fillStyle=filled?(e.elite?PALETTE.red:PALETTE.ink):(lost?PALETTE.red:rgba('midGray',0.6));
                ctx.fillRect(-E.tickW/2,-E.tickH/2,E.tickW,E.tickH);
                ctx.restore();
            }
        }
    }

    drawAmmo(ctx,player,project,tmp) {
        const W=player.W;
        project(player.renderPos.x,0,player.renderPos.z,tmp);
        const cx=tmp.x;
        const cy=tmp.y+30;
        const n=Math.min(W.magazine,TUNING.hud.ammoMaxTicks);
        const span=Math.PI*0.55;
        const r=46;
        if (player.reloadT>0) {
            const k=1-player.reloadT/W.reloadTime;
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=3;
            ctx.beginPath();
            ctx.arc(cx,cy-r,r,Math.PI/2+span/2,Math.PI/2+span/2-span*k,true);
            ctx.stroke();
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold 12px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            ctx.fillText(t(W.heat?'hud.cool':'hud.reload'),cx,cy+6);
            return;
        }
        if (W.cooldown) {
            const k=1-Math.min(1,(player.cdT||0)/W.cooldown);
            const a0=Math.PI/2+span/2;
            ctx.lineCap='round';
            ctx.lineWidth=5;
            ctx.strokeStyle=rgba('midGray',0.5);
            ctx.beginPath();
            ctx.arc(cx,cy-r,r,a0,a0-span,true);
            ctx.stroke();
            ctx.strokeStyle=k>=1?PALETTE.ink:PALETTE.nearGray;
            ctx.lineWidth=k>=1?5:4;
            if (k>0) {
                ctx.beginPath();
                ctx.arc(cx,cy-r,r,a0,a0-span*k,true);
                ctx.stroke();
            }
            return;
        }
        if (player.rapidT>0) {
            return;
        }
        for (let i=0;i<n;i++) {
            const a=Math.PI/2+span/2-span*(i+0.5)/n;
            const x=cx+Math.cos(a)*r;
            const y=cy-r+Math.sin(a)*r;
            const lit=Math.ceil(player.ammo*n/W.magazine);
            ctx.fillStyle=i<lit?(W.heat&&lit<=n*0.3?PALETTE.red:PALETTE.ink):rgba('midGray',0.5);
            ctx.save();
            ctx.translate(x,y);
            ctx.rotate(a-Math.PI/2);
            ctx.fillRect(-1.5,-4,3,8);
            ctx.restore();
        }
        if (player.ammo<=Math.max(3,W.magazine*0.2)&&!W.heat) {
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='11px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            ctx.fillText(t('hud.reloadHint'),cx,cy+6);
        }
    }

    drawCloneTimers(ctx,clones,project,tmp) {
        const T=TUNING.hud.timer;
        for (const c of clones) {
            if (!c.active||!(c.life>0)) {
                continue;
            }
            const f=c.fig;
            project(f.renderPos.x,0,f.renderPos.z,tmp);
            const left=Math.max(0,c.life-c.t);
            const k=Math.min(1,left/c.life);
            const y=tmp.y+T.cloneOffset;
            ctx.fillStyle=rgba('farGray',0.85);
            ctx.fillRect(tmp.x-T.width/2,y,T.width,T.height);
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillRect(tmp.x-T.width/2,y,T.width*k,T.height);
            ctx.font='10px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            ctx.fillText(t(CARDS.clone.nameKey)+' '+left.toFixed(1)+t('hud.seconds'),tmp.x,y+T.height+2);
        }
    }

    drawTimers(ctx,player,timers,project,tmp) {
        if (!timers||timers.length===0) {
            return;
        }
        let best=timers[0];
        for (const q of timers) {
            if (q.left<best.left) {
                best=q;
            }
        }
        const T=TUNING.hud.timer;
        project(player.renderPos.x,0,player.renderPos.z,tmp);
        const cx=tmp.x;
        const y=tmp.y+T.offset;
        const k=Math.max(0,Math.min(1,best.left/best.full));
        ctx.save();
        ctx.fillStyle=rgba('farGray',0.85);
        ctx.fillRect(cx-T.width/2,y,T.width,T.height);
        ctx.fillStyle=best.left<1.5&&Math.floor(time.real*8)%2===0?PALETTE.red:PALETTE.ink;
        ctx.fillRect(cx-T.width/2,y,T.width*k,T.height);
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font='10px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='top';
        const more=timers.length>1?' +'+(timers.length-1):'';
        ctx.fillText(t(CARDS[best.id].nameKey)+' '+best.left.toFixed(1)+t('hud.seconds')+more,cx,y+T.height+2);
        ctx.restore();
    }

    pauseRect(w) {
        return {x:w-62,y:12,w:46,h:46};
    }

    hitPause(x,y,w) {
        const r=this.pauseRect(w);
        return x>=r.x-6&&x<=r.x+r.w+6&&y>=r.y-6&&y<=r.y+r.h+6;
    }

    drawPause(ctx,w) {
        const r=this.pauseRect(w);
        ctx.fillStyle=rgba('paper',0.75);
        ctx.fillRect(r.x,r.y,r.w,r.h);
        drawShape(ctx,sketchRect(r.x,r.y,r.w,r.h,{width:1.8,seed:760}),PALETTE.ink);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(r.x+15,r.y+13,5,20);
        ctx.fillRect(r.x+26,r.y+13,5,20);
    }

    toast(text,key) {
        const H=TUNING.hud;
        this.toasts=(this.toasts||[]).filter(q=>q.text!==text);
        this.toasts.push({text,key,t:H.toastTime});
        while (this.toasts.length>H.toastMax) {
            this.toasts.shift();
        }
    }

    drawToast(ctx,w,dt) {
        const H=TUNING.hud;
        if (!this.toasts||this.toasts.length===0) {
            return;
        }
        ctx.save();
        ctx.font='bold 14px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        let y=this.bannerT<this.bannerDur?H.toastBannerY:H.toastY;
        for (const q of this.toasts) {
            q.t-=dt;
            const a=Math.max(0,Math.min(1,q.t/0.4,(H.toastTime-q.t)/0.2));
            ctx.globalAlpha=a;
            const tx=q.key?t(q.key):q.text;
            const tw=ctx.measureText(tx).width+28;
            ctx.fillStyle=rgba('paper',0.92);
            ctx.fillRect(w/2-tw/2,y,tw,30);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.5;
            ctx.strokeRect(w/2-tw/2,y,tw,30);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(tx,w/2,y+16);
            y+=36*Math.min(1,a*2);
        }
        ctx.restore();
        this.toasts=this.toasts.filter(q=>q.t>0);
    }

    drawFacing(ctx,player,project,guide) {
        const F=TUNING.hud.facing;
        const px=player.renderPos.x;
        const pz=player.renderPos.z;
        const dx=Math.sin(player.aimYaw);
        const dz=Math.cos(player.aimYaw);
        const p=this.fp||(this.fp=[{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0},{x:0,y:0}]);
        if (guide) {
            project(px+dx*F.guideFrom,0.05,pz+dz*F.guideFrom,p[3]);
            project(px+dx*(F.guideFrom+F.guideLen),0.05,pz+dz*(F.guideFrom+F.guideLen),p[4]);
            ctx.save();
            const g=ctx.createLinearGradient(p[3].x,p[3].y,p[4].x,p[4].y);
            g.addColorStop(0,rgba('ink',F.guideAlpha));
            g.addColorStop(1,rgba('ink',0));
            ctx.strokeStyle=g;
            ctx.lineWidth=2;
            ctx.setLineDash([F.dash,F.gap]);
            ctx.beginPath();
            ctx.moveTo(p[3].x,p[3].y);
            ctx.lineTo(p[4].x,p[4].y);
            ctx.stroke();
            ctx.restore();
        }
        const bx=px+dx*F.dist;
        const bz=pz+dz*F.dist;
        project(bx+dx*F.len,0.05,bz+dz*F.len,p[0]);
        project(bx-dz*F.half,0.05,bz+dx*F.half,p[1]);
        project(bx+dz*F.half,0.05,bz-dx*F.half,p[2]);
        ctx.save();
        ctx.globalAlpha=F.alpha;
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(p[0].x,p[0].y);
        ctx.lineTo(p[1].x,p[1].y);
        ctx.lineTo(p[2].x,p[2].y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    showResult(title,lines) {
        const R=TUNING.hud.result;
        this.result={title,lines,t:0,life:R.time+lines.length*R.perLine};
        this.flys=[];
        lines.forEach((l,i)=>{
            if (l.score) {
                this.flys.push({n:l.score,i,t:-(R.lineDelay*i+R.flyDelay),x:0,y:0});
            }
        });
    }

    drawResult(ctx,w,h,dt) {
        const q=this.result;
        if (!q) {
            this.flys=[];
            return;
        }
        const R=TUNING.hud.result;
        const S=TUNING.hud.score;
        q.t+=dt;
        if (q.t>=q.life&&this.flys.length===0) {
            this.result=null;
            return;
        }
        const a=Math.max(0,Math.min(1,q.t/R.fade,(q.life-q.t)/R.fade));
        const x=w-S.right;
        let y=S.y+S.labelSize+S.size+R.gapTop;
        ctx.save();
        ctx.textAlign='right';
        ctx.textBaseline='middle';
        ctx.lineJoin='round';
        ctx.strokeStyle=rgba('paper',0.92);
        ctx.lineWidth=R.halo;
        const tk=EASE.easeOutBack(Math.min(1,q.t/R.fade));
        ctx.globalAlpha=a;
        ctx.font='bold '+R.titleSize+'px '+FONT;
        ctx.save();
        ctx.translate(x+(1-tk)*40,y);
        ctx.strokeText(q.title,0,0,R.maxW);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillText(q.title,0,0,R.maxW);
        ctx.restore();
        y+=R.titleSize*0.6+R.lineGap;
        for (let i=0;i<q.lines.length;i++) {
            const l=q.lines[i];
            const lt=q.t-R.lineDelay*i-0.15;
            const k=Math.max(0,Math.min(1,lt/0.25));
            const lh=R.lineH;
            const ly=y+lh/2;
            y+=lh;
            if (k<=0) {
                continue;
            }
            const txt=(l.bad?'✕ ':'✓ ')+l.text;
            ctx.font='bold '+R.lineSize+'px '+FONT;
            const tw=Math.min(R.maxW,ctx.measureText(txt).width);
            ctx.globalAlpha=a*k;
            const ox=(1-EASE.easeOutCubic(k))*30;
            ctx.strokeText(txt,x+ox,ly,R.maxW);
            ctx.fillStyle=l.bad?PALETTE.red:PALETTE.ink;
            ctx.fillText(txt,x+ox,ly,R.maxW);
            const fl=this.flys.find(f=>f.i===i);
            if (fl) {
                fl.x=x-tw/2;
                fl.y=ly;
            }
        }
        ctx.restore();
        this.drawFlys(ctx,w,dt);
    }

    drawFlys(ctx,w,dt) {
        const R=TUNING.hud.result;
        const S=TUNING.hud.score;
        const tx=w-S.right-S.size;
        const ty=S.y+S.labelSize+S.size*0.5;
        for (const f of this.flys) {
            f.t+=dt;
        }
        for (const f of this.flys.slice()) {
            if (f.t<0) {
                continue;
            }
            const k=Math.min(1,f.t/R.flyTime);
            if (k>=1) {
                this.flys.splice(this.flys.indexOf(f),1);
                this.scorePop=1;
                this.scoreShake=1;
                continue;
            }
            const e=EASE.easeInOutCubic(k);
            const px=f.x+(tx-f.x)*e;
            const py=f.y+(ty-f.y)*e-Math.sin(k*Math.PI)*R.flyArc;
            const sc=1+Math.sin(Math.min(1,k*3)*Math.PI)*0.4-k*0.3;
            ctx.save();
            ctx.translate(px,py);
            ctx.scale(sc,sc);
            ctx.font='bold '+R.flySize+'px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.lineJoin='round';
            ctx.strokeStyle=rgba('paper',0.95);
            ctx.lineWidth=5;
            const txt=(f.n>0?'+':'')+f.n;
            ctx.strokeText(txt,0,0);
            ctx.fillStyle=f.n>0?PALETTE.red:PALETTE.ink;
            ctx.fillText(txt,0,0);
            ctx.restore();
        }
    }

    banner(text,sub,dur=2.2) {
        this.bannerText=text;
        this.bannerSub=sub||'';
        this.bannerT=0;
        this.bannerDur=dur;
    }

    drawBanner(ctx,w,h,dt) {
        if (this.bannerT>=this.bannerDur) {
            return;
        }
        this.bannerT+=dt;
        const k=this.bannerT;
        const inA=EASE.easeOutBack(Math.min(1,k/0.35));
        const out=Math.max(0,Math.min(1,(this.bannerDur-k)/0.35));
        ctx.save();
        ctx.globalAlpha=out;
        ctx.translate(w/2,h*0.2);
        ctx.scale(inA,inA);
        const maxW=Math.min(w-48,760);
        ctx.font='bold 38px '+FONT;
        let tw=ctx.measureText(this.bannerText).width;
        const ts=tw>maxW-48?(maxW-48)/tw:1;
        tw*=ts;
        ctx.font='16px '+FONT;
        const subs=this.bannerSub?wrapText(ctx,this.bannerSub,maxW-48):[];
        let sw=0;
        for (const l of subs) {
            sw=Math.max(sw,ctx.measureText(l).width);
        }
        const bw=Math.round(Math.max(tw,sw)+48);
        const bh=Math.round(68+subs.length*24);
        ctx.fillStyle=rgba('paper',0.85);
        ctx.fillRect(-bw/2,-36,bw,bh);
        ctx.save();
        ctx.translate(-bw/2,-36);
        drawShape(ctx,sketchRect(0,0,bw,bh,{width:2,seed:701}),PALETTE.ink);
        ctx.restore();
        ctx.fillStyle=PALETTE.ink;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.save();
        ctx.scale(ts,ts);
        ctx.font='bold 38px '+FONT;
        ctx.fillText(this.bannerText,0,-2/ts);
        ctx.restore();
        ctx.font='16px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        for (let i=0;i<subs.length;i++) {
            ctx.fillText(subs[i],0,34+i*24);
        }
        ctx.restore();
    }

    drawRunInfo(ctx,w,run,enemies) {
        if (!run||!run.plan) {
            return;
        }
        const p=run.plan;
        if (p.training) {
            return;
        }
        const PB=TUNING.hud.progress;
        if (run.notebook()&&!p.overtime) {
            this.drawProgress(ctx,w,run);
        }
        else {
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold 15px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            ctx.fillText(p.trainGame?t('mg.test')+' · '+t('event.'+p.game+'.title'):p.overtime?t('run.overtimeInfo',{page:p.otPage+1}):t('run.endlessInfo',{act:Math.floor(p.index/ENDLESS.bossEvery)+1,page:p.index%ENDLESS.bossEvery+1}),w/2,14);
        }
        if (!run.training()) {
            this.drawScore(ctx,w,run.stats);
        }
        ctx.textAlign='center';
        ctx.textBaseline='top';
        const by=PB.below;
        const d=run.director;
        if (d&&!p.boss&&run.state==='combat') {
            const wv=Math.max(1,d.wave+1);
            ctx.font='13px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(t('run.wave',{wave:wv,waves:d.totalWaves(),left:enemies.aliveCount()+d.queue.length}),w/2,by);
        }
        const pz=run.puzzleInfo&&run.puzzleInfo();
        if (pz) {
            ctx.font='bold 15px '+FONT;
            ctx.fillStyle=PALETTE.red;
            const tail=pz.params&&pz.params.s!==undefined?t('ui.gap')+t('mg.time',{s:pz.params.s}):'';
            ctx.fillText(t(pz.key,pz.params)+tail,w/2,by+4);
        }
        const ch=p.challenge;
        if (ch&&(run.state==='combat'||run.state==='cleared')) {
            const fail=run.chFail;
            const left=ch.time?Math.max(0,Math.ceil(ch.time-run.chT)):0;
            const txt=t('challenge.'+ch.id,ch)+(ch.time&&!fail?t('challenge.left',{n:left}):'')+t('ui.gap')+t(fail?'challenge.markFail':'challenge.markOk');
            ctx.font='bold 13px '+FONT;
            ctx.fillStyle=fail?PALETTE.midGray:PALETTE.red;
            ctx.fillText(txt,w/2,by+18);
        }
        const boss=enemies.boss();
        if (boss) {
            const f=Math.max(0,boss.hp/boss.maxHp);
            this.bossShown+=(f-this.bossShown)*0.15;
            const bw=Math.min(520,w*0.45);
            const x=w/2-bw/2;
            const y=by+4;
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold 14px '+FONT;
            ctx.textAlign='center';
            ctx.fillText(t(boss.def.nameKey),w/2,y);
            ctx.fillStyle=rgba('paper',0.8);
            ctx.fillRect(x,y+20,bw,14);
            drawShape(ctx,hatchFill(rectPoly(x+2,y+22,Math.max(2,(bw-4)*this.bossShown),10),{spacing:4,cross:true,seed:730,width:1}),PALETTE.ink);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(x+2,y+22,Math.max(0,(bw-4)*f),10);
            drawShape(ctx,sketchRect(x,y+20,bw,14,{width:1.8,seed:731}),PALETTE.ink);
            for (const q of [0.33,0.66]) {
                drawShape(ctx,sketchLine(x+bw*q,y+17,x+bw*q,y+37,{width:1.2,seed:732+q*10,overshoot:0}),PALETTE.nearGray);
            }
            ctx.font='12px '+FONT;
            ctx.fillStyle=PALETTE.red;
            ctx.fillText(t('boss.hint.'+boss.type),w/2,y+40);
        }
    }

    drawProgress(ctx,w,run,force=false,y=TUNING.hud.progress.y) {
        const P=TUNING.hud.progress;
        const p=run.plan;
        const n=ACTS[p.act].rooms+1;
        const pos=p.act*100+p.index;
        const now=time.real;
        let g=this.prog;
        if (!g||g.stats!==run.stats) {
            g=this.prog={stats:run.stats,from:pos,to:pos,at:now};
        }
        if (g.to!==pos) {
            g.from=Math.floor(g.to/100)===p.act?g.to:pos;
            g.to=pos;
            g.at=now;
        }
        const age=now-g.at;
        const alpha=force?1:Math.max(0,Math.min(1,(P.show-age)/P.fade+1));
        if (alpha<=0) {
            return;
        }
        const k=Math.min(1,age/P.anim);
        const segW=Math.max(P.minSeg,Math.min(P.segW,w-P.side*2));
        const x0=w/2-segW/2;
        const dotX=gi=>x0+(gi%100)/(n-1)*segW;
        ctx.save();
        ctx.globalAlpha=alpha;
        ctx.textBaseline='middle';
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=2.4;
        ctx.beginPath();
        ctx.moveTo(x0,y);
        ctx.lineTo(x0+segW,y);
        ctx.stroke();
        ctx.font='bold '+P.actSize+'px '+FONT;
        ctx.fillStyle=PALETTE.ink;
        ctx.textAlign='right';
        ctx.fillText(t('hud.act',{n:p.act+1}),x0-P.actGap,y);
        for (let j=0;j<n;j++) {
            const boss=j===n-1;
            const x=x0+j/(n-1)*segW;
            const r=boss?P.bossR:P.dotR;
            ctx.beginPath();
            if (boss) {
                ctx.moveTo(x,y-r);
                ctx.lineTo(x+r,y);
                ctx.lineTo(x,y+r);
                ctx.lineTo(x-r,y);
                ctx.closePath();
            }
            else {
                ctx.arc(x,y,r,0,Math.PI*2);
            }
            ctx.fillStyle=j<p.index?PALETTE.ink:PALETTE.paper;
            ctx.fill();
            ctx.lineWidth=1.6;
            ctx.strokeStyle=boss?PALETTE.red:PALETTE.ink;
            ctx.stroke();
        }
        const e=EASE.easeInOutCubic(k);
        const mx=dotX(g.from)+(dotX(g.to)-dotX(g.from))*e;
        const my=y-Math.sin(k*Math.PI)*P.hop*(g.from!==g.to?1:0);
        const pulse=1+Math.sin(now*P.pulseRate)*P.pulse;
        ctx.fillStyle=rgba('red',0.25);
        ctx.beginPath();
        ctx.arc(mx,my,P.curR*1.7*pulse,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle=PALETTE.red;
        ctx.beginPath();
        ctx.arc(mx,my,P.curR,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=1.6;
        ctx.stroke();
        const label=p.boss?t('hud.bossPage'):t('node.'+(p.node||'battle'));
        ctx.font='bold '+P.tagSize+'px '+FONT;
        ctx.textAlign='center';
        ctx.fillStyle=PALETTE.red;
        ctx.globalAlpha=alpha*k;
        ctx.fillText(label,mx,y+P.tagY);
        ctx.restore();
    }

    drawScore(ctx,w,stats) {
        const S=TUNING.hud.score;
        const now=time.real;
        const score=stats.score;
        if (stats!==this.scoreStats) {
            this.scoreStats=stats;
            this.scoreShown=score;
            this.scoreTarget=score;
            this.scoreShake=0;
            this.scorePop=0;
        }
        const dt=Math.min(0.1,now-this.scoreAt);
        this.scoreAt=now;
        let pending=0;
        for (const f of this.flys||[]) {
            pending+=f.n;
        }
        const target=score-pending;
        if (target!==this.scoreTarget) {
            if (this.scoreTarget!==undefined) {
                this.scoreShake=1;
                this.scoreDown=target<this.scoreTarget;
                if (!this.scoreDown) {
                    this.scorePop=1;
                }
            }
            this.scoreTarget=target;
        }
        if (Math.round(this.scoreShown)!==target) {
            this.scoreShown+=(target-this.scoreShown)*Math.min(1,dt*S.rate);
            if (Math.abs(target-this.scoreShown)<1) {
                this.scoreShown=target;
            }
        }
        this.scorePop=Math.max(0,this.scorePop-dt*S.popDecay);
        this.scoreShake=Math.max(0,(this.scoreShake||0)-dt*S.shakeDecay);
        const x=w-S.right;
        ctx.save();
        ctx.textAlign='right';
        ctx.textBaseline='top';
        ctx.font=S.labelSize+'px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText(t('hud.score'),x,S.y);
        const s=1+EASE.easeOutQuad(this.scorePop)*S.pop;
        const sh=this.scoreShake*S.shake;
        ctx.translate(x+Math.sin(now*S.shakeRate)*sh,S.y+S.labelSize+2+Math.cos(now*S.shakeRate*1.3)*sh*0.5);
        ctx.rotate(Math.sin(now*S.shakeRate*0.7)*this.scoreShake*0.05);
        ctx.scale(s,s);
        ctx.font='bold '+S.size+'px '+FONT;
        ctx.fillStyle=this.scoreShake>0.3&&this.scoreDown?PALETTE.red:(this.scorePop>0.3?PALETTE.red:PALETTE.ink);
        ctx.fillText(String(Math.round(this.scoreShown)),0,0);
        ctx.restore();
    }

    inkChanged(delta) {
        this.slosh=Math.min(1.5,this.slosh+Math.abs(delta)*0.35+0.15);
        if (delta>0) {
            this.inkPop=1;
        }
        const last=this.inkPopups[this.inkPopups.length-1];
        if (last&&last.t<0.25&&Math.sign(last.v)===Math.sign(delta)) {
            last.v+=delta;
            last.t=0;
            return;
        }
        this.inkPopups.push({v:delta,t:0});
    }

    inkFail() {
        this.inkShakeT=0.4;
        this.slosh=Math.min(1.5,this.slosh+0.5);
    }

    update(dt,player,ink) {
        const k=1-Math.exp(-8*dt);
        this.hpShown+=(player.hp-this.hpShown)*k;
        if (ink) {
            this.inkShown+=(ink.value-this.inkShown)*(1-Math.exp(-6*dt));
        }
        this.slosh*=Math.exp(-1.6*dt);
        this.inkPop=Math.max(0,this.inkPop-dt*2.5);
        for (let i=this.inkPopups.length-1;i>=0;i--) {
            this.inkPopups[i].t+=dt;
            if (this.inkPopups[i].t>=TUNING.ink.popupTime) {
                this.inkPopups.splice(i,1);
            }
        }
        this.inkShakeT=Math.max(0,this.inkShakeT-dt);
    }

    drawInk(ctx,ink) {
        const x0=TUNING.hud.hpPos[0]+2;
        const y0=TUNING.hud.hpPos[1]+TUNING.hud.hpHeight+46;
        const shake=this.inkShakeT>0?Math.sin(this.inkShakeT*60)*5*(this.inkShakeT/0.4):0;
        ctx.save();
        ctx.translate(x0+shake,y0);
        if (this.inkPop>0) {
            const pp=EASE.easeOutQuad(this.inkPop);
            ctx.translate(BOTTLE_W/2,BOTTLE_H/2);
            ctx.scale(1+pp*0.14,1+pp*0.14);
            ctx.translate(-BOTTLE_W/2,-BOTTLE_H/2);
            ctx.fillStyle=rgba('ink',0.12*pp);
            ctx.beginPath();
            ctx.arc(BOTTLE_W/2,BOTTLE_H/2,BOTTLE_H*0.7+(1-pp)*14,0,Math.PI*2);
            ctx.fill();
        }
        ctx.fillStyle=PALETTE.paper;
        ctx.fill(BOTTLE_PATH);
        const frac=Math.max(0,Math.min(1,this.inkShown/ink.max));
        const top=14;
        const level=BOTTLE_H-(BOTTLE_H-top)*frac;
        const amp=1.2+this.slosh*3;
        const tt=time.real;
        ctx.save();
        ctx.clip(BOTTLE_PATH);
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(-2,BOTTLE_H+2);
        for (let x=-2;x<=BOTTLE_W+2;x+=3) {
            const y=level+Math.sin(x*0.22+tt*4.2)*amp+Math.sin(x*0.11-tt*2.6)*amp*0.6;
            ctx.lineTo(x,y);
        }
        ctx.lineTo(BOTTLE_W+2,BOTTLE_H+2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=rgba('paper',0.25);
        ctx.fillRect(6,18,5,BOTTLE_H-28);
        ctx.restore();
        ctx.strokeStyle=PALETTE.midGray;
        ctx.lineWidth=1;
        for (let i=1;i<ink.max;i++) {
            const y=BOTTLE_H-(BOTTLE_H-top)*i/ink.max;
            drawShape(ctx,sketchLine(BOTTLE_W-9,y,BOTTLE_W-2,y,{width:1,seed:600+i,overshoot:0}),i%5===0?PALETTE.nearGray:PALETTE.midGray);
        }
        drawShape(ctx,sketchPath(BOTTLE_PTS.concat([BOTTLE_PTS[0]]),{width:2.2,seed:620,overshoot:1}),PALETTE.ink);
        drawShape(ctx,sketchRect(11,-22,BOTTLE_W-22,9,{width:1.8,seed:621,overshoot:1}),PALETTE.ink);
        ctx.fillStyle=ink.value>ink.max?PALETTE.red:PALETTE.ink;
        ctx.font='bold 26px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='alphabetic';
        const iv=fmtInk(ink.value);
        ctx.fillText(iv,BOTTLE_W+12,BOTTLE_H-14);
        const nw=ctx.measureText(iv).width;
        ctx.font='14px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText('/ '+ink.max,BOTTLE_W+16+nw,BOTTLE_H-14);
        ctx.font='bold 12px '+FONT;
        ctx.fillStyle=this.inkShakeT>0?PALETTE.red:PALETTE.ink;
        ctx.fillText(this.inkShakeT>0?t('deck.noInk'):t('hud.ink'),BOTTLE_W+12,BOTTLE_H+4);
        for (const q of this.inkPopups) {
            const f=q.t/TUNING.ink.popupTime;
            const pop=q.t<0.12?1+(0.12-q.t)*4:1;
            ctx.save();
            ctx.globalAlpha=Math.max(0,1-f*f);
            ctx.translate(BOTTLE_W+24+nw+56,BOTTLE_H-24-EASE.easeOutQuad(Math.min(1,f*1.4))*TUNING.ink.popupRise);
            ctx.scale(pop,pop);
            ctx.font='bold 22px '+FONT;
            ctx.textAlign='left';
            ctx.fillStyle=q.v>0?PALETTE.ink:PALETTE.red;
            ctx.fillText((q.v>0?'+':'−')+fmtInk(Math.abs(q.v)),0,0);
            ctx.restore();
        }
        ctx.restore();
    }

    drawHp(ctx,player) {
        const H=TUNING.hud;
        const max=TUNING.player.maxHp;
        const x=H.hpPos[0];
        const y=H.hpPos[1];
        const h=H.hpHeight;
        const eraser=22;
        const full=H.hpLength;
        const frac=Math.max(0,Math.min(1,this.hpShown/max));
        const len=Math.max(4,full*frac);
        const low=player.hp/max<TUNING.damageFx.lowHp&&player.hp>0;
        const pulse=low?0.5+0.5*Math.sin(time.real*Math.PI*2*TUNING.damageFx.heartRate):0;
        ctx.lineCap='round';
        ctx.lineJoin='round';
        ctx.fillStyle=PALETTE.farGray;
        ctx.fillRect(x,y,eraser,h);
        ctx.fillStyle=PALETTE.midGray;
        ctx.fillRect(x+eraser-6,y,6,h);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(x+eraser,y,len,h);
        ctx.strokeStyle=PALETTE.midGray;
        ctx.lineWidth=1;
        wobblyLine(ctx,x+eraser,y+h/3,x+eraser+len,y+h/3,71,0.5);
        wobblyLine(ctx,x+eraser,y+h*2/3,x+eraser+len,y+h*2/3,72,0.5);
        const tx=x+eraser+len;
        const tipLen=h*1.2;
        ctx.fillStyle=PALETTE.farGray;
        ctx.beginPath();
        ctx.moveTo(tx,y);
        ctx.lineTo(tx+tipLen,y+h/2);
        ctx.lineTo(tx,y+h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=low?PALETTE.red:PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(tx+tipLen*0.62,y+h*0.31);
        ctx.lineTo(tx+tipLen,y+h/2);
        ctx.lineTo(tx+tipLen*0.62,y+h*0.69);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle=low?rgba('red',0.6+0.4*pulse):PALETTE.ink;
        ctx.lineWidth=2;
        wobblyRect(ctx,x,y,eraser+len,h,11);
        wobblyLine(ctx,tx,y,tx+tipLen,y+h/2,41);
        wobblyLine(ctx,tx+tipLen,y+h/2,tx,y+h,42);
        wobblyLine(ctx,x+eraser,y-1,x+eraser,y+h+1,43,0.5);
        ctx.strokeStyle=rgba('ink',0.25);
        ctx.lineWidth=1.5;
        ctx.setLineDash([3,5]);
        ctx.beginPath();
        ctx.moveTo(tx+tipLen+4,y+h/2);
        ctx.lineTo(x+eraser+full+tipLen,y+h/2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 14px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(t('hud.hp')+' '+Math.ceil(player.hp)+' / '+max,x,y+h+8);
    }

    drawTrainingInfo(ctx,st,foes,touch,height) {
        const T=TUNING.training;
        const now=st.clock;
        let win=0;
        for (const q of st.log) {
            if (now-q.t<=T.dpsWindow) {
                win+=q.dmg;
            }
        }
        const span=Math.min(T.dpsWindow,Math.max(1,now-(st.start||now)));
        const rows=[
            [t('trainInfo.total'),String(Math.round(st.total)),true],
            [t('trainInfo.dps',{s:T.dpsWindow}),String(Math.round(win/span)),true],
            [t('trainInfo.max'),String(Math.round(st.max)),false],
            [t('trainInfo.last'),st.last>0?String(Math.round(st.last)):'—',false],
            [t('trainInfo.kills'),String(st.kills),false],
            [t('trainInfo.cards'),String(st.cards),false],
            [t('trainInfo.hurt'),String(st.hurt),st.hurtT>0],
            [t('trainInfo.foes'),String(foes),false]
        ];
        const x=16;
        const y=14;
        const w=236;
        const rh=21;
        const h=40+rows.length*rh+26;
        ctx.save();
        if (height<600) {
            ctx.translate(x,y);
            ctx.scale(0.74,0.74);
            ctx.translate(-x,-y);
        }
        ctx.fillStyle=rgba('paper',0.9);
        ctx.fillRect(x,y,w,h);
        drawShape(ctx,sketchRect(x,y,w,h,{width:1.8,seed:1700}),PALETTE.ink);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 15px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t('trainInfo.title'),x+14,y+20);
        drawShape(ctx,sketchLine(x+10,y+36,x+w-10,y+36,{width:1,seed:1701}),PALETTE.midGray);
        for (let i=0;i<rows.length;i++) {
            const ry=y+48+i*rh;
            const [label,val,hi]=rows[i];
            ctx.font='13px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.textAlign='left';
            ctx.fillText(label,x+14,ry);
            const pop=i===3?Math.max(0,st.lastT):0;
            ctx.font='bold '+Math.round(15+pop*6)+'px '+FONT;
            ctx.fillStyle=i===6&&st.hurtT>0?PALETTE.red:(hi?PALETTE.ink:PALETTE.nearGray);
            ctx.textAlign='right';
            ctx.fillText(val,x+w-14,ry);
        }
        ctx.font='11px '+FONT;
        ctx.fillStyle=PALETTE.midGray;
        ctx.textAlign='left';
        ctx.fillText(t(touch?'trainInfo.hintTouch':'trainInfo.hint'),x+14,y+h-14);
        ctx.restore();
    }
}
