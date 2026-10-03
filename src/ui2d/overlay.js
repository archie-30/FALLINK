import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {device,settings} from '../core/settings.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {hash1} from '../core/rng.js';
import {Hud} from './hud.js';
import {sketchCircle,drawShape} from './sketch.js';
import {drawCardTooltip} from './cardView.js';
import {fireRing} from '../core/input.js';
import {cardCost} from '../game/card.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export class Overlay {
    constructor(canvas) {
        this.canvas=canvas;
        this.ctx=canvas.getContext('2d');
        this.width=1;
        this.height=1;
        this.dpr=1;
        this.showDebug=false;
        this.hud=new Hud();
    }

    refresh() {
        this.resize(this.cssW,this.cssH,this.us);
    }

    resize(w,h,us=1) {
        this.cssW=w;
        this.cssH=h;
        this.us=us;
        this.width=w/us;
        this.height=h/us;
        const cap=device.mobile?(settings.quality==='high'?2:(settings.quality==='mid'?1.25:1)):2;
        this.dpr=Math.min(window.devicePixelRatio||1,cap);
        this.canvas.width=Math.floor(w*this.dpr);
        this.canvas.height=Math.floor(h*this.dpr);
    }

    screenSpace(on) {
        const d=this.dpr*(on?1:this.us);
        this.ctx.setTransform(d,0,0,d,0,0);
    }

    wobble(i,amp) {
        return (hash1(i*31+time.boilIndex*977)-0.5)*2*amp;
    }

    ring(x,y,r,width,color,seed) {
        const ctx=this.ctx;
        ctx.save();
        ctx.translate(x,y);
        drawShape(ctx,sketchCircle(0,0,r,{width:width*1.2,seed,jitter:1}),color);
        ctx.restore();
    }

    draw(input,player,debug,game) {
        const ctx=this.ctx;
        ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
        ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
        ctx.setTransform(this.dpr*this.us,0,0,this.dpr*this.us,0,0);
        ctx.lineCap='round';
        ctx.lineJoin='round';
        game.transition.draw(ctx,this.width,this.height);
        const dying=game.run.state==='dead';
        if (game.mode==='play'&&dying) {
            game.summary.draw(ctx);
        }
        if (game.mode==='play'&&!dying) {
            this.hud.drawEnemyHp(ctx,game.enemies,game.project,this.tmp3||(this.tmp3={x:0,y:0}));
            game.dmgNums.draw(ctx,game.project);
            const training=game.run.mode==='training';
            if (!training||!settings.training.ammo) {
                this.hud.drawAmmo(ctx,player,game.project,this.tmp||(this.tmp={x:0,y:0}));
            }
            this.hud.drawTimers(ctx,player,game.effects.timers,game.project,this.tmp||(this.tmp={x:0,y:0}));
            this.hud.drawCloneTimers(ctx,game.clones,game.project,this.tmp);
            this.drawLock(ctx,game);
            if (training&&!(game.run.plan&&game.run.plan.trainGame)) {
                this.hud.drawTrainingInfo(ctx,game.trainStats,game.enemies.aliveCount(),device.mobile||input.lastDevice==='touch',this.height);
            }
            else {
                this.hud.drawHp(ctx,player);
                this.hud.drawInk(ctx,game.ink);
            }
            this.hud.drawFacing(ctx,player,game.project,input.lastDevice==='touch'&&settings.aimGuide);
            game.marks.draw(ctx,game,input.lastDevice==='touch',this.height,this.width);
            game.hand.draw(ctx,game.art);
            if (input.lastDevice==='touch') {
                this.screenSpace(true);
                this.drawSticks(input,!!game.hand.targetView);
                this.screenSpace(false);
                this.screenSpace(true);
                this.drawDash(input,player);
                if (game.hand.visible()) {
                    this.drawSkills(input,game.hand,game.ink,game.art);
                }
                this.screenSpace(false);
            }
            this.hud.drawRunInfo(ctx,this.width,game.run,game.enemies);
            this.hud.drawBanner(ctx,this.width,this.height,game.dt);
            game.ultCutin.draw(ctx,this.width,this.height,game.art);
            this.hud.drawPause(ctx,this.width);
            game.deckView.draw(ctx,game.art,game.deck);
            game.trainingMenu.draw(ctx);
            game.trainingPicker.draw(ctx,game.art);
            game.reward.draw(ctx,game.art);
            game.choice.draw(ctx);
            game.deckPick.draw(ctx,game.art);
            game.upgradeView.draw(ctx,game.art);
            game.summary.draw(ctx);
            game.pause.draw(ctx);
            if (game.pause.open) {
                const rn=game.run;
                if (rn.plan&&rn.notebook()&&!rn.plan.overtime&&!rn.plan.training) {
                    this.hud.drawProgress(ctx,this.width,rn,true,TUNING.hud.progress.pauseY);
                }
                game.hand.draw(ctx,game.art);
                const hv=game.hand.hover;
                if (hv) {
                    drawCardTooltip(ctx,hv.card,hv.x,hv.y-120*game.hand.s);
                }
                else {
                    ctx.font='14px "Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
                    ctx.fillStyle=PALETTE.nearGray;
                    ctx.textAlign='center';
                    ctx.textBaseline='middle';
                    ctx.fillText(t(input.lastDevice==='touch'?'pause.hintTouch':'pause.hint'),this.width/2,game.pause.compact()?game.pause.hintY():this.height-game.hand.s*164*0.8-100*game.hand.s);
                }
            }
        }
        if (game.mode!=='play') {
            game.summary.draw(ctx);
        }
        if (!game.codex.open&&!game.settingsMenu.open) {
            game.mainMenu.draw(ctx);
        }
        game.levelView.draw(ctx);
        game.tutorial.draw(ctx,game.art);
        game.weaponView.draw(ctx);
        game.levelUp.draw(ctx,game.art);
        game.skinEditor.draw(ctx);
        game.settingsMenu.draw(ctx);
        if (game.settingsMenu.open&&game.settingsMenu.page==='touch') {
            this.screenSpace(true);
            this.drawSticks(input,false);
            this.drawDash(input,player);
            this.drawSkills(input,null,null,game.art);
            this.screenSpace(false);
        }
        game.codex.draw(ctx,game.art);
        game.popup.draw(ctx);
        this.hud.drawToast(ctx,this.width,game.dt);
        this.hud.drawResult(ctx,this.width,this.height,game.dt);
        game.transition.drawTop(ctx,this.width,this.height);
        if (input.lastDevice==='mouse'&&input.mouse.inside) {
            const play=game.mode==='play'&&game.run.state!=='dead';
            const lock=play&&!game.frozen&&!!game.aimTarget&&game.aimTarget.alive;
            const reload=play&&!game.frozen&&player.reloadT>0?1-player.reloadT/player.W.reloadTime:0;
            this.drawCrosshair(input.mouse.x/this.us,input.mouse.y/this.us,input.mouse.down,lock,reload);
        }
        if (this.showDebug&&debug) {
            this.drawDebug(debug);
        }
    }

    drawLock(ctx,game) {
        const e=game.aimTarget;
        const tmp=this.tmp2||(this.tmp2={x:0,y:0});
        for (const q of game.enemies.list) {
            if (q.elite&&q.state!=='spawn') {
                game.project(q.renderPos.x,q.def.height*1.45,q.renderPos.z,tmp);
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold 12px "Noto Sans TC",sans-serif';
                ctx.textAlign='center';
                ctx.textBaseline='bottom';
                ctx.fillText(t('hud.elite'),tmp.x,tmp.y-14);
            }
            if (q.vulnT>0||q.stunT>0) {
                game.project(q.renderPos.x,q.def.height*1.15,q.renderPos.z,tmp);
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold 14px '+'"Noto Sans TC",sans-serif';
                ctx.textAlign='center';
                ctx.textBaseline='bottom';
                ctx.fillText(q.vulnT>0?'×'+q.vulnMult:'✱',tmp.x,tmp.y);
            }
        }
        if (!e||!e.alive) {
            this.lockUid=-1;
            return;
        }
        if (this.lockUid!==e.uid) {
            this.lockUid=e.uid;
            this.lockT=0;
        }
        this.lockT+=game.dt;
        const L=TUNING.hud.lock;
        game.project(e.renderPos.x,e.def.height*0.5,e.renderPos.z,tmp);
        const snap=EASE.easeOutBack(Math.min(1,this.lockT/L.snapTime));
        const r=(L.base+e.def.radius*L.perRadius)*(1+(1-snap)*L.snapGrow)*(1+Math.sin(time.real*L.pulse)*0.05);
        const k=r*0.4;
        ctx.save();
        ctx.translate(tmp.x,tmp.y);
        ctx.rotate(time.real*L.spin);
        ctx.globalAlpha=Math.min(1,this.lockT/0.08);
        ctx.strokeStyle=PALETTE.paper;
        ctx.lineWidth=6;
        ctx.lineCap='round';
        for (let pass=0;pass<2;pass++) {
            ctx.beginPath();
            for (const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
                ctx.moveTo(sx*r,sy*(r-k));
                ctx.lineTo(sx*r,sy*r);
                ctx.lineTo(sx*(r-k),sy*r);
            }
            ctx.stroke();
            ctx.strokeStyle=PALETTE.red;
            ctx.lineWidth=3;
        }
        ctx.restore();
        ctx.fillStyle=PALETTE.red;
        ctx.beginPath();
        const dy=tmp.y-r-10-Math.abs(Math.sin(time.real*4))*4;
        ctx.moveTo(tmp.x,dy+6);
        ctx.lineTo(tmp.x-6,dy-4);
        ctx.lineTo(tmp.x+6,dy-4);
        ctx.closePath();
        ctx.fill();
    }

    drawSticks(input,casting) {
        const ctx=this.ctx;
        for (const s of [input.move,input.aim]) {
            const R=s.r;
            const act=s.id>=0;
            const card=s===input.aim&&casting;
            ctx.fillStyle=rgba(card?'red':'paper',card?0.12:(act?0.5:0.32));
            ctx.beginPath();
            ctx.arc(s.cx,s.cy,R,0,Math.PI*2);
            ctx.fill();
            this.ring(s.cx,s.cy,R,act?2.4:1.6,card?PALETTE.red:rgba('ink',act?0.55:0.3),s===input.move?11:23);
            if (s===input.aim&&!card) {
                const fk=fireRing();
                const fr=R*fk;
                const firing=act&&(s.raw||0)>=fk;
                ctx.save();
                ctx.beginPath();
                ctx.arc(s.cx,s.cy,R,0,Math.PI*2);
                ctx.arc(s.cx,s.cy,fr,0,Math.PI*2,true);
                ctx.fillStyle=rgba('red',firing?0.22:0.07);
                ctx.fill();
                ctx.setLineDash([6,5]);
                ctx.strokeStyle=rgba('ink',act?0.6:0.35);
                ctx.lineWidth=1.6;
                ctx.beginPath();
                ctx.arc(s.cx,s.cy,fr,0,Math.PI*2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle=firing?PALETTE.red:rgba('ink',0.45);
                ctx.font='bold 11px '+FONT;
                ctx.textAlign='center';
                ctx.textBaseline='middle';
                ctx.fillText(t('ui.aimOnly'),s.cx,s.cy-fr*0.62);
                ctx.fillText(t('ui.fireZone'),s.cx,s.cy-(fr+R)/2);
                ctx.restore();
            }
            const kx=act?s.x:s.cx;
            const ky=act?s.y:s.cy;
            ctx.fillStyle=card?rgba('red',0.35):rgba('ink',act?0.3:0.14);
            ctx.beginPath();
            ctx.arc(kx,ky,R*0.4,0,Math.PI*2);
            ctx.fill();
            this.ring(kx,ky,R*0.4,3,card?PALETTE.red:rgba('ink',act?0.8:0.45),s===input.move?41:57);
            ctx.fillStyle=card?PALETTE.red:rgba('ink',0.55);
            ctx.font='bold 13px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            ctx.fillText(s===input.move?t('ui.move'):(card?t('ui.cast'):t('ui.fireDual')),s.cx,s.cy+R+6);
        }
    }

    drawSkills(input,hand,ink,art) {
        const ctx=this.ctx;
        const v=time.boilIndex;
        for (const k of input.skills) {
            const view=hand?hand.views.find(o=>o.slot===k.slot):null;
            const card=view&&view.state==='idle'?view.card:null;
            const ult=k.slot===2;
            const sel=!!(hand&&view&&hand.targetView===view);
            const cost=card?cardCost(card):0;
            const poor=!!(card&&ink&&!ink.can(cost));
            const N=TUNING.input.nudge;
            const idle=hand?(hand.idleT||0)-N.idle:-1;
            const ph=idle>0?(idle+k.slot*N.stagger)%N.every:9;
            const nudge=card&&!poor&&ph<N.dur?Math.sin(ph*N.rate)*N.amp*(1-ph/N.dur):0;
            const shake=(view&&view.shakeT>0?Math.sin(view.shakeT*70)*5*view.shakeT/0.35:0)+nudge;
            const pressed=k.id>=0;
            const r=k.r*(pressed?0.92:1)*(sel?1.06+Math.sin(time.real*8)*0.03:1);
            const x=k.x+shake;
            const y=k.y;
            ctx.save();
            ctx.globalAlpha=card||!hand?(poor?0.5:1):0.45;
            ctx.fillStyle=sel?rgba('red',0.18):rgba('paper',0.72);
            ctx.beginPath();
            ctx.arc(x,y,r,0,Math.PI*2);
            ctx.fill();
            if (card&&art) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x,y,r-3,0,Math.PI*2);
                ctx.clip();
                const img=art.icon(card,v);
                ctx.drawImage(img,x-r*0.95,y-r*0.95,r*1.9,r*1.9);
                ctx.restore();
            }
            this.ring(x,y,r,sel?3.4:(ult?2.8:2.2),sel||ult?PALETTE.red:rgba('ink',0.75),91+k.slot*7);
            if (pressed&&k.moved&&sel) {
                ctx.strokeStyle=rgba('red',0.5);
                ctx.lineWidth=3;
                ctx.setLineDash([5,4]);
                ctx.beginPath();
                ctx.moveTo(x,y);
                ctx.lineTo(x+k.vx*r*1.8,y+k.vy*r*1.8);
                ctx.stroke();
                ctx.setLineDash([]);
            }
            const bx=x-r*0.72;
            const by=y-r*0.72;
            ctx.fillStyle=card?(poor?PALETTE.red:PALETTE.ink):PALETTE.midGray;
            ctx.beginPath();
            ctx.arc(bx,by,10,0,Math.PI*2);
            ctx.fill();
            ctx.fillStyle=PALETTE.paper;
            ctx.font='bold 12px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(card?String(cost):String(k.slot+1),bx,by+1);
            if (ult) {
                ctx.fillStyle=PALETTE.red;
                ctx.font='bold 11px '+FONT;
                ctx.fillText(t('type.ult'),x,y-r-9);
            }
            ctx.restore();
        }
    }

    drawDash(input,player) {
        const d=input.dash;
        const ctx=this.ctx;
        const ready=player.dashCd<=0;
        const pressed=d.id>=0;
        const r=d.r*(pressed?0.92:1);
        if (input.skillHeld()) {
            const hov=input.skillCancelHover();
            const rr=r*(hov?1.15:1);
            ctx.fillStyle=hov?rgba('red',0.3):rgba('paper',0.7);
            ctx.beginPath();
            ctx.arc(d.x,d.y,rr,0,Math.PI*2);
            ctx.fill();
            this.ring(d.x,d.y,rr,3,PALETTE.red,72);
            const k=rr*0.38;
            ctx.strokeStyle=PALETTE.red;
            ctx.lineWidth=hov?6:4;
            ctx.lineCap='round';
            ctx.beginPath();
            ctx.moveTo(d.x-k,d.y-k);
            ctx.lineTo(d.x+k,d.y+k);
            ctx.moveTo(d.x+k,d.y-k);
            ctx.lineTo(d.x-k,d.y+k);
            ctx.stroke();
            return;
        }
        if (input.interactReady) {
            const N=TUNING.input.nudge;
            const pulse=1+Math.sin(performance.now()/180)*0.04;
            const ph=(time.real%N.interactEvery);
            const wig=ph<N.interactDur?Math.sin(ph*N.rate)*(1-ph/N.interactDur):0;
            ctx.save();
            ctx.translate(d.x+wig*N.interactAmp,d.y);
            ctx.rotate(wig*N.interactTilt);
            ctx.fillStyle=rgba('paper',0.85);
            ctx.beginPath();
            ctx.arc(0,0,r*pulse,0,Math.PI*2);
            ctx.fill();
            this.ring(0,0,r*pulse,3,PALETTE.ink,73);
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold 17px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('ui.interact'),0,1);
            ctx.restore();
            return;
        }
        ctx.fillStyle=rgba('paper',0.55);
        ctx.beginPath();
        ctx.arc(d.x,d.y,r,0,Math.PI*2);
        ctx.fill();
        this.ring(d.x,d.y,r,ready?3:2,ready?PALETTE.ink:rgba('ink',0.4),71);
        if (!ready) {
            const f=1-player.dashCd/TUNING.player.dashCooldown;
            ctx.strokeStyle=PALETTE.nearGray;
            ctx.lineWidth=4;
            ctx.beginPath();
            ctx.arc(d.x,d.y,r+7,-Math.PI/2,-Math.PI/2+f*Math.PI*2);
            ctx.stroke();
        }
        ctx.fillStyle=ready?PALETTE.ink:PALETTE.midGray;
        ctx.font='bold 18px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('ui.dash'),d.x,d.y+1);
    }

    drawCrosshair(x,y,down,locked=false,reload=0) {
        const ctx=this.ctx;
        const r=down?9:12;
        const col=locked?PALETTE.red:PALETTE.ink;
        if (reload>0) {
            const R=r+TUNING.hud.reloadRing;
            ctx.strokeStyle=rgba('ink',0.18);
            ctx.lineWidth=4;
            ctx.beginPath();
            ctx.arc(x,y,R,0,Math.PI*2);
            ctx.stroke();
            const a0=-Math.PI/2;
            const a1=a0+reload*Math.PI*2;
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=4;
            ctx.beginPath();
            ctx.arc(x,y,R,a0,a1);
            ctx.stroke();
            ctx.fillStyle=PALETTE.red;
            ctx.beginPath();
            ctx.arc(x+Math.cos(a1)*R,y+Math.sin(a1)*R,3.5,0,Math.PI*2);
            ctx.fill();
        }
        if (locked) {
            ctx.fillStyle=rgba('red',0.15);
            ctx.beginPath();
            ctx.arc(x,y,r+4,0,Math.PI*2);
            ctx.fill();
        }
        this.ring(x,y,r,2,col,97);
        ctx.strokeStyle=col;
        ctx.lineWidth=2;
        ctx.beginPath();
        for (let i=0;i<4;i++) {
            const a=i*Math.PI/2+0.08*this.wobble(i+3,1);
            ctx.moveTo(x+Math.cos(a)*(r+3),y+Math.sin(a)*(r+3));
            ctx.lineTo(x+Math.cos(a)*(r+9),y+Math.sin(a)*(r+9));
        }
        ctx.stroke();
        ctx.fillStyle=col;
        ctx.fillRect(x-1.5,y-1.5,3,3);
    }

    drawDebug(d) {
        const ctx=this.ctx;
        const lines=[
            t('debug.fps')+' '+d.fps.toFixed(0),
            t('debug.calls')+' '+d.calls,
            t('debug.tris')+' '+d.triangles,
            t('debug.quality')+' '+t('quality.'+d.quality)+' ('+d.pixelRatio.toFixed(2)+'x)',
            t('debug.resolution')+' '+d.resolution,
            t('debug.hint')
        ];
        ctx.font='14px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        const w=230;
        const h=lines.length*19+14;
        const x=this.width-w-10;
        ctx.fillStyle=rgba('paper',0.85);
        ctx.fillRect(x,70,w,h);
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=1.5;
        ctx.strokeRect(x,70,w,h);
        ctx.fillStyle=PALETTE.ink;
        for (let i=0;i<lines.length;i++) {
            ctx.fillText(lines[i],x+10,78+i*19);
        }
    }
}
