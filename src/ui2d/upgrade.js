import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
import {TUNING} from '../data/tuning.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {RNG} from '../core/rng.js';
import {CARD_W,CARD_H,drawCost,wrapText} from './cardView.js';
import {sketchRect,drawShape} from './sketch.js';
import {createCard,cardDesc,cardName,cardCost} from '../game/card.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const rng=new RNG(1717);

export class UpgradeView {
    constructor() {
        this.open=false;
        this.t=0;
        this.closeK=0;
        this.width=1;
        this.height=1;
        this.sparks=[];
        this.onDone=null;
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    show(id,onDone) {
        this.open=true;
        this.t=0;
        this.closeK=0;
        this.base=createCard(id);
        this.up=createCard(id,true);
        this.rare=this.base.def.rarity==='rare';
        this.onDone=onDone;
        this.sparks.length=0;
        this.burst=false;
    }

    down() {
        if (!this.open) {
            return false;
        }
        if (this.t>=TUNING.upgrade.merge+TUNING.upgrade.reveal) {
            this.finish();
        }
        return true;
    }

    finish() {
        if (!this.open) {
            return;
        }
        this.open=false;
        this.closeK=1;
        const cb=this.onDone;
        this.onDone=null;
        if (cb) {
            cb();
        }
    }

    update(dt) {
        const U=TUNING.upgrade;
        this.closeK=Math.max(0,this.closeK-dt/TUNING.ui.closeTime);
        for (let i=this.sparks.length-1;i>=0;i--) {
            const s=this.sparks[i];
            s.t+=dt;
            s.x+=s.vx*dt;
            s.y+=s.vy*dt;
            s.vx*=Math.exp(-3*dt);
            s.vy*=Math.exp(-3*dt);
            if (s.t>=s.life) {
                this.sparks.splice(i,1);
            }
        }
        if (!this.open) {
            return;
        }
        this.t+=dt;
        if (!this.burst&&this.t>=U.merge) {
            this.burst=true;
            const cx=this.width/2;
            const cy=this.height*0.46;
            for (let i=0;i<28;i++) {
                const a=rng.range(0,Math.PI*2);
                const sp=rng.range(160,520);
                this.sparks.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:rng.range(0.4,0.9),len:rng.range(10,26),red:i%4===0});
            }
        }
        if (this.t>=U.autoClose) {
            this.finish();
        }
    }

    draw(ctx,art) {
        if (!this.open&&this.closeK<=0) {
            return;
        }
        ctx.save();
        if (!this.open) {
            ctx.globalAlpha=this.closeK;
        }
        this.drawBody(ctx,art);
        ctx.restore();
    }

    drawBody(ctx,art) {
        const U=TUNING.upgrade;
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const s=Math.max(0.9,Math.min(1.5,h/640));
        const k=this.t;
        ctx.fillStyle=rgba('paper',0.9*Math.min(1,k/0.25));
        ctx.fillRect(0,0,w,h);
        const cx=w/2;
        const cy=h*0.46;
        const gap=CARD_W*s*1.15;
        ctx.fillStyle=this.rare?PALETTE.red:PALETTE.ink;
        ctx.font='bold '+Math.round(30*s)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const ta=EASE.easeOutBack(Math.min(1,k/0.35));
        ctx.save();
        ctx.translate(cx,cy-CARD_H*s*0.5-54*s);
        ctx.scale(ta,ta);
        ctx.fillText(k<U.merge?t('upgrade.merging'):t('upgrade.title'),0,0);
        ctx.restore();
        if (k<U.merge) {
            for (let i=0;i<3;i++) {
                const p=EASE.easeOutBack(Math.min(1,Math.max(0,(k-i*0.1)/0.45)));
                const m=EASE.easeInCubic(Math.min(1,Math.max(0,(k-U.gather)/(U.merge-U.gather))));
                const x=cx+(i-1)*gap*(1-m);
                const y=cy+(1-p)*h*0.6;
                const shake=m>0?Math.sin(k*70+i)*5*m:0;
                this.drawCard(ctx,art,this.base,x+shake,y,s*(1-m*0.15),(i-1)*0.12*(1-m),v,1);
            }
        }
        else {
            const r=Math.min(1,(k-U.merge)/0.45);
            const e=EASE.easeOutBack(r);
            const flash=Math.max(0,1-(k-U.merge)/0.3);
            ctx.fillStyle=rgba('paper',flash);
            ctx.fillRect(0,0,w,h);
            const glow=0.5+0.5*Math.sin(time.real*4);
            ctx.strokeStyle=this.rare?rgba('red',0.35+0.3*glow):rgba('ink',0.25+0.25*glow);
            ctx.lineWidth=3;
            ctx.beginPath();
            ctx.arc(cx,cy,CARD_H*s*0.72+glow*6,0,Math.PI*2);
            ctx.stroke();
            this.drawCard(ctx,art,this.up,cx,cy,s*(0.7+0.3*e)*1.12,0,v,Math.min(1,r*2));
            const ia=Math.min(1,Math.max(0,(k-U.merge-0.3)/0.4));
            ctx.save();
            ctx.globalAlpha*=ia;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            const ty=cy+CARD_H*s*0.62+10;
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold '+Math.round(20*s)+'px '+FONT;
            ctx.fillText(t(this.base.def.nameKey)+'  →  '+cardName(this.up),cx,ty);
            ctx.font=Math.round(15*s)+'px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            const c0=cardCost(this.base);
            const c1=cardCost(this.up);
            const text=this.rare?t('upgrade.rare',{from:c0,to:c1}):(c0!==c1?t('upgrade.normal',{from:c0,to:c1})+'　':'')+cardDesc(this.up);
            const lines=wrapText(ctx,text,Math.min(560,w-60));
            for (let i=0;i<lines.length;i++) {
                ctx.fillText(lines[i],cx,ty+32*s+i*22*s);
            }
            if (k>=U.merge+U.reveal) {
                ctx.fillStyle=rgba('ink',0.5+0.4*Math.sin(time.real*5));
                ctx.font='bold '+Math.round(14*s)+'px '+FONT;
                ctx.fillText(t('upgrade.continue'),cx,ty+32*s+lines.length*22*s+18);
            }
            ctx.restore();
        }
        for (const p of this.sparks) {
            const f=p.t/p.life;
            const l=Math.hypot(p.vx,p.vy)||1;
            ctx.strokeStyle=p.red?rgba('red',1-f):rgba('ink',1-f);
            ctx.lineWidth=3*(1-f)+1;
            ctx.beginPath();
            ctx.moveTo(p.x,p.y);
            ctx.lineTo(p.x-p.vx/l*p.len,p.y-p.vy/l*p.len);
            ctx.stroke();
        }
    }

    drawCard(ctx,art,card,x,y,sc,rot,v,a) {
        ctx.save();
        ctx.globalAlpha*=a;
        ctx.translate(x,y);
        ctx.rotate(rot);
        ctx.scale(sc,sc);
        ctx.translate(-CARD_W/2,-CARD_H/2);
        ctx.fillStyle=rgba('ink',0.18);
        ctx.fillRect(6,6,CARD_W,CARD_H);
        ctx.drawImage(art.face(card,v),0,0,CARD_W,CARD_H);
        drawCost(ctx,card,false,v);
        if (card.upgraded) {
            drawShape(ctx,sketchRect(-4,-4,CARD_W+8,CARD_H+8,{width:2.4,seed:1930}),card.def.rarity==='rare'?PALETTE.red:PALETTE.ink,v);
        }
        ctx.restore();
    }
}
