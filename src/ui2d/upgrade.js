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
        this.play('merge',id,onDone);
    }

    play(mode,id,onDone) {
        this.mode=mode;
        this.open=true;
        this.t=0;
        this.closeK=0;
        this.items=[].concat(id).map(q=>({base:createCard(q),up:createCard(q,true),rare:createCard(q).def.rarity==='rare'}));
        this.base=this.items[0].base;
        this.up=this.items[0].up;
        this.rare=this.items.some(q=>q.rare);
        this.onDone=onDone;
        this.sparks.length=0;
        this.burst=false;
    }

    total() {
        const F=TUNING.cardFx[this.mode];
        return F?F.total:TUNING.upgrade.autoClose;
    }

    down() {
        if (!this.open) {
            return false;
        }
        const F=TUNING.cardFx[this.mode];
        if (F?this.t>=F.skip:this.t>=TUNING.upgrade.merge+TUNING.upgrade.reveal) {
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
        const F=TUNING.cardFx[this.mode];
        const at=F?F.burst:U.merge;
        if (!this.burst&&this.t>=at) {
            this.burst=true;
            const cy=this.height*0.46;
            const n=this.items.length;
            for (let j=0;j<n;j++) {
                const cx=this.itemX(j);
                for (let i=0;i<28;i++) {
                    const a=rng.range(0,Math.PI*2);
                    const sp=rng.range(160,520);
                    this.sparks.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:rng.range(0.4,0.9),len:rng.range(10,26),red:i%4===0});
                }
            }
        }
        if (this.t>=this.total()) {
            this.finish();
        }
    }

    itemX(j) {
        const n=this.items.length;
        const s=Math.max(0.9,Math.min(1.5,this.height/640));
        const spread=Math.min(this.width/n,CARD_W*s*TUNING.upgrade.pairGap);
        return this.width/2+(j-(n-1)/2)*spread;
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
        if (this.mode==='gain'||this.mode==='remove'||this.mode==='downgrade') {
            this.drawFx(ctx,art);
            return;
        }
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
        ctx.fillText(k<U.merge?t(this.mode==='merge'?'upgrade.merging':'upgrade.charging'):t('upgrade.title'),0,0);
        ctx.restore();
        const n=this.items.length;
        const colW=n>1?Math.min(w/n-30,CARD_W*s*TUNING.upgrade.pairGap-24):Math.min(560,w-60);
        const cs=n>1?TUNING.upgrade.pairScale:1;
        if (k<U.merge&&this.mode!=='merge') {
            const p=EASE.easeOutBack(Math.min(1,k/0.45));
            const m=Math.min(1,Math.max(0,(k-U.gather*0.5)/(U.merge-U.gather*0.5)));
            this.items.forEach((it,j)=>{
                const x=this.itemX(j);
                const shake=Math.sin(k*80+j*2)*6*m;
                ctx.strokeStyle=it.rare?rgba('red',0.6*m):rgba('ink',0.5*m);
                ctx.lineWidth=2;
                for (let i=0;i<10;i++) {
                    const a=i/10*Math.PI*2+k*3;
                    const r0=CARD_H*s*cs*(0.9-m*0.25);
                    ctx.beginPath();
                    ctx.moveTo(x+Math.cos(a)*r0,cy+Math.sin(a)*r0);
                    ctx.lineTo(x+Math.cos(a)*(r0-20*m),cy+Math.sin(a)*(r0-20*m));
                    ctx.stroke();
                }
                this.drawCard(ctx,art,it.base,x+shake,cy+(1-p)*h*0.5,s*cs*(0.85+0.15*p)*1.1,0,v,1);
            });
        }
        else if (k<U.merge) {
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
            const ia=Math.min(1,Math.max(0,(k-U.merge-0.3)/0.4));
            const ty=cy+CARD_H*s*cs*0.62+10;
            let most=0;
            this.items.forEach((it,j)=>{
                const x=this.itemX(j);
                ctx.strokeStyle=it.rare?rgba('red',0.35+0.3*glow):rgba('ink',0.25+0.25*glow);
                ctx.lineWidth=3;
                ctx.beginPath();
                ctx.arc(x,cy,CARD_H*s*cs*0.72+glow*6,0,Math.PI*2);
                ctx.stroke();
                this.drawCard(ctx,art,it.up,x,cy,s*cs*(0.7+0.3*e)*1.12,0,v,Math.min(1,r*2));
                ctx.save();
                ctx.globalAlpha*=ia;
                ctx.textAlign='center';
                ctx.textBaseline='top';
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold '+Math.round(20*s)+'px '+FONT;
                ctx.fillText(t(it.base.def.nameKey)+'  →  '+cardName(it.up),x,ty,colW);
                ctx.font=Math.round(15*s)+'px '+FONT;
                ctx.fillStyle=PALETTE.nearGray;
                const c0=cardCost(it.base);
                const c1=cardCost(it.up);
                const text=it.rare?t('upgrade.rare',{from:c0,to:c1}):(c0!==c1?t('upgrade.normal',{from:c0,to:c1})+t('ui.gap'):'')+cardDesc(it.up);
                const lines=wrapText(ctx,text,colW);
                for (let i=0;i<lines.length;i++) {
                    ctx.fillText(lines[i],x,ty+32*s+i*22*s);
                }
                most=Math.max(most,lines.length);
                ctx.restore();
            });
            if (k>=U.merge+U.reveal) {
                ctx.save();
                ctx.globalAlpha*=ia;
                ctx.textAlign='center';
                ctx.textBaseline='top';
                ctx.fillStyle=rgba('ink',0.5+0.4*Math.sin(time.real*5));
                ctx.font='bold '+Math.round(14*s)+'px '+FONT;
                ctx.fillText(t('upgrade.continue'),cx,ty+32*s+most*22*s+18);
                ctx.restore();
            }
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

    drawFx(ctx,art) {
        const F=TUNING.cardFx[this.mode];
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const s=Math.max(0.9,Math.min(1.5,h/640))*F.scale;
        const k=this.t;
        const cx=w/2;
        const cy=h*0.46;
        const fade=Math.min(1,k/0.2,(F.total-k)/0.25);
        ctx.fillStyle=rgba('paper',0.88*Math.max(0,fade));
        ctx.fillRect(0,0,w,h);
        const ta=EASE.easeOutBack(Math.min(1,k/0.35));
        ctx.save();
        ctx.globalAlpha*=Math.max(0,fade);
        ctx.translate(cx,cy-CARD_H*s*0.5-46);
        ctx.scale(ta,ta);
        ctx.fillStyle=this.mode==='gain'?PALETTE.ink:PALETTE.red;
        ctx.font='bold '+Math.round(30*Math.min(1.3,s))+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('cardFx.'+this.mode),0,0);
        ctx.restore();
        if (this.mode==='gain') {
            const pin=EASE.easeOutBack(Math.min(1,k/F.inTime));
            const out=Math.max(0,Math.min(1,(k-F.inTime-F.hold)/F.outTime));
            const eo=EASE.easeInCubic(out);
            const tx=w*F.toX;
            const ty=h*F.toY;
            const x=cx+(tx-cx)*eo;
            const y=cy+(1-pin)*h*0.6+(ty-cy)*eo;
            const rot=(1-pin)*0.6+eo*-0.4;
            this.drawCard(ctx,art,this.base,x,y,s*(0.6+0.4*pin)*(1-eo*0.75),rot,v,1-out*0.6);
        }
        else if (this.mode==='downgrade') {
            const pin=EASE.easeOutBack(Math.min(1,k/F.inTime));
            const sw=Math.max(0,Math.min(1,(k-F.burst)/0.25));
            const shake=k<F.burst?Math.sin(k*70)*5*Math.min(1,(k-F.inTime)/0.3):0;
            this.drawCard(ctx,art,sw<0.5?this.up:this.base,cx+shake,cy+(1-pin)*h*0.5,s*(1-Math.sin(sw*Math.PI)*0.12),0,v,1);
            if (sw>0&&sw<1) {
                ctx.fillStyle=rgba('ink',0.3*(1-sw));
                ctx.fillRect(0,0,w,h);
            }
        }
        else {
            const pin=EASE.easeOutBack(Math.min(1,k/F.inTime));
            const tr=Math.max(0,Math.min(1,(k-F.burst)/F.tearTime));
            if (tr<=0) {
                const shake=k>F.burst-0.35?Math.sin(k*90)*4:0;
                this.drawCard(ctx,art,this.base,cx+shake,cy+(1-pin)*h*0.5,s,0,v,1);
            }
            else {
                this.drawTorn(ctx,art,this.base,cx,cy,s,tr,v);
            }
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

    drawTorn(ctx,art,card,x,y,sc,tr,v) {
        const e=EASE.easeInQuad(tr);
        const teeth=9;
        for (const side of [-1,1]) {
            ctx.save();
            ctx.globalAlpha*=1-e;
            ctx.translate(x+side*e*CARD_W*sc*0.9,y+e*CARD_H*sc*0.9);
            ctx.rotate(side*e*0.7);
            ctx.scale(sc,sc);
            ctx.beginPath();
            ctx.moveTo(0,-CARD_H/2-4);
            for (let j=1;j<=teeth;j++) {
                ctx.lineTo((j%2?1:-1)*CARD_W*0.05,-CARD_H/2+CARD_H*j/teeth);
            }
            ctx.lineTo(side*CARD_W,CARD_H/2+4);
            ctx.lineTo(side*CARD_W,-CARD_H/2-4);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(art.face(card,v),-CARD_W/2,-CARD_H/2,CARD_W,CARD_H);
            ctx.restore();
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
