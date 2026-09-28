import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {device,settings} from '../core/settings.js';
import {time} from '../core/loop.js';
import {hash1} from '../core/rng.js';
import {Hud} from './hud.js';
import {sketchCircle,drawShape} from './sketch.js';
import {drawCardTooltip} from './cardView.js';

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

    resize(w,h) {
        this.width=w;
        this.height=h;
        const cap=device.mobile?(settings.quality==='high'?2:1.5):2;
        this.dpr=Math.min(window.devicePixelRatio||1,cap);
        this.canvas.width=Math.floor(w*this.dpr);
        this.canvas.height=Math.floor(h*this.dpr);
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
        ctx.clearRect(0,0,this.width,this.height);
        ctx.lineCap='round';
        ctx.lineJoin='round';
        const touchUi=device.mobile||input.lastDevice==='touch';
        game.transition.draw(ctx,this.width,this.height);
        const dying=game.run.state==='dead';
        if (game.mode==='play'&&dying) {
            game.summary.draw(ctx);
        }
        if (game.mode==='play'&&!dying) {
            game.dmgNums.draw(ctx,game.project);
            this.hud.drawAmmo(ctx,player,game.project,this.tmp||(this.tmp={x:0,y:0}));
            this.drawLock(ctx,game);
            this.hud.drawHp(ctx,player);
            this.hud.drawInk(ctx,game.ink);
            this.hud.drawBuffs(ctx,player);
            if (!touchUi) {
                this.hud.drawLegend(ctx,this.width,this.height,false);
            }
            else {
                this.hud.legendBox={x:0,y:0,w:0,h:0,titleH:0};
            }
            game.hand.draw(ctx,game.art);
            if (touchUi) {
                this.drawSticks(input);
                this.drawDash(input,player);
            }
            this.hud.drawRunInfo(ctx,this.width,game.run,game.enemies);
            this.hud.drawBanner(ctx,this.width,this.height,game.dt);
            this.hud.drawPause(ctx,this.width);
            game.deckView.draw(ctx,game.art,game.deck);
            game.reward.draw(ctx,game.art);
            game.summary.draw(ctx);
            game.pause.draw(ctx);
            if (game.pause.open) {
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
                    ctx.fillText(t('pause.hint'),this.width/2,this.height-game.hand.s*164*0.8-40);
                }
            }
        }
        if (!game.codex.open&&!game.settingsMenu.open) {
            game.mainMenu.draw(ctx);
        }
        game.settingsMenu.draw(ctx);
        game.codex.draw(ctx,game.art);
        if (input.lastDevice==='mouse'&&input.mouse.inside) {
            this.drawCrosshair(input.mouse.x,input.mouse.y,input.mouse.down);
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
            return;
        }
        game.project(e.renderPos.x,e.def.height*0.5,e.renderPos.z,tmp);
        const r=18+e.def.radius*16;
        const k=6;
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=2.4;
        ctx.beginPath();
        for (const [sx,sy] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
            ctx.moveTo(tmp.x+sx*r,tmp.y+sy*(r-k));
            ctx.lineTo(tmp.x+sx*r,tmp.y+sy*r);
            ctx.lineTo(tmp.x+sx*(r-k),tmp.y+sy*r);
        }
        ctx.stroke();
    }

    drawSticks(input) {
        const R=TUNING.input.stickRadius;
        for (const s of [input.move,input.aim]) {
            if (s.id<0) {
                continue;
            }
            this.ring(s.ox,s.oy,R,2,rgba('ink',0.35),s===input.move?11:23);
            const dx=s.x-s.ox;
            const dy=s.y-s.oy;
            const d=Math.hypot(dx,dy);
            const k=d>R?R/d:1;
            this.ring(s.ox+dx*k,s.oy+dy*k,R*0.38,3,rgba('ink',0.7),s===input.move?41:57);
        }
    }

    drawDash(input,player) {
        const d=input.dash;
        const ctx=this.ctx;
        const ready=player.dashCd<=0;
        const pressed=d.id>=0;
        const r=d.r*(pressed?0.92:1);
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

    drawCrosshair(x,y,down) {
        const ctx=this.ctx;
        const r=down?9:12;
        this.ring(x,y,r,2,PALETTE.ink,97);
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=2;
        ctx.beginPath();
        for (let i=0;i<4;i++) {
            const a=i*Math.PI/2+0.08*this.wobble(i+3,1);
            ctx.moveTo(x+Math.cos(a)*(r+3),y+Math.sin(a)*(r+3));
            ctx.lineTo(x+Math.cos(a)*(r+9),y+Math.sin(a)*(r+9));
        }
        ctx.stroke();
        ctx.fillStyle=PALETTE.ink;
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
