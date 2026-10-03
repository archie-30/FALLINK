import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
import {TUNING} from '../data/tuning.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {CARD_W,CARD_H,drawCost,rareBorderPath,drawCardTooltip} from './cardView.js';
import {sketchRect,sketchLine,drawShape} from './sketch.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const RARE=rareBorderPath();

export class RewardView {
    constructor() {
        this.open=false;
        this.items=[];
        this.groups=[];
        this.width=1;
        this.height=1;
        this.t=0;
        this.picked=false;
        this.pickT=0;
        this.hover=-1;
        this.onPick=null;
        this.counts={};
        this.target={x:0,y:0};
        this.btnRect={x:0,y:0,w:0,h:0};
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    dual() {
        return this.groups.length>1;
    }

    scale() {
        const s=Math.max(0.9,Math.min(1.6,this.height/620));
        if (!this.dual()) {
            return s;
        }
        return Math.min(s,(this.width-80)/(CARD_W*5.6));
    }

    show(groups,title,counts,onPick,target,forced=false) {
        this.open=true;
        this.forced=forced;
        this.groups=groups.map((g,gi)=>({kind:g.kind,sel:-1,gi,skip:false,skipA:0,rect:null}));
        this.items=[];
        for (let gi=0;gi<groups.length;gi++) {
            groups[gi].cards.forEach((c,i)=>this.items.push({card:c,g:gi,i,x:0,y:0,lift:0,selA:0}));
        }
        this.title=title;
        this.counts=counts||{};
        this.onPick=onPick;
        this.t=0;
        this.picked=false;
        this.pickT=0;
        this.hover=-1;
        this.target=target||{x:this.width/2,y:this.height};
    }

    slot(it) {
        const s=this.scale();
        const gap=CARD_W*s*1.22;
        if (!this.dual()) {
            const n=this.items.length;
            return {x:this.width/2+(it.i-(n-1)/2)*gap,y:this.height*0.5,rot:(it.i-(n-1)/2)*0.06};
        }
        const cx=this.width/2+(it.g===0?-1:1)*gap*1.35;
        return {x:cx+(it.i-0.5)*gap,y:this.height*0.52,rot:(it.i-0.5)*0.05};
    }

    hitIndex(x,y) {
        const s=this.scale();
        for (let i=this.items.length-1;i>=0;i--) {
            const it=this.items[i];
            if (Math.abs(x-it.x)<CARD_W*s*0.55&&Math.abs(y-it.y)<CARD_H*s*0.55) {
                return i;
            }
        }
        return -1;
    }

    hoverAt(x,y) {
        if (!this.open||this.picked) {
            return;
        }
        this.hover=this.hitIndex(x,y);
    }

    selected() {
        const out=[];
        for (const g of this.groups) {
            if (g.sel>=0) {
                out.push(this.items.find(it=>it.g===g.gi&&it.i===g.sel).card);
            }
        }
        return out;
    }

    confirm() {
        this.picked=true;
        this.pickT=0;
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        if (this.picked||this.t<0.5) {
            return true;
        }
        if (this.dual()) {
            for (const g of this.groups) {
                const q=g.rect;
                if (q&&x>=q.x&&x<=q.x+q.w&&y>=q.y&&y<=q.y+q.h) {
                    g.skip=!g.skip;
                    if (g.skip) {
                        g.sel=-1;
                    }
                    return true;
                }
            }
        }
        const r=this.btnRect;
        if (!this.forced&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) {
            if (!this.dual()) {
                this.groups[0].sel=-1;
            }
            this.confirm();
            return true;
        }
        const i=this.hitIndex(x,y);
        if (i<0) {
            return true;
        }
        if (this.hover!==i) {
            this.hover=i;
            return true;
        }
        const it=this.items[i];
        const g=this.groups[it.g];
        if (!this.dual()) {
            g.sel=it.i;
            this.confirm();
            return true;
        }
        g.skip=false;
        g.sel=g.sel===it.i?-1:it.i;
        return true;
    }

    update(dt) {
        if (!this.open) {
            return;
        }
        this.t+=dt;
        for (const g of this.groups) {
            g.skipA+=((g.skip?1:0)-g.skipA)*(1-Math.exp(-12*dt));
        }
        for (const it of this.items) {
            const on=this.groups[it.g].sel===it.i?1:0;
            it.selA+=(on-it.selA)*(1-Math.exp(-14*dt));
        }
        if (this.picked) {
            this.pickT+=dt;
            if (this.pickT>=TUNING.reward.pickTime) {
                this.open=false;
                if (this.onPick) {
                    this.onPick(this.selected());
                }
            }
        }
    }

    countLine(card) {
        const c=this.counts[card.id];
        const all=c?c.all:0;
        const base=c?c.base:0;
        const merge=!card.upgraded&&base>=TUNING.cards.mergeCount-1;
        return {text:merge?t('reward.merge'):t('reward.owned',{n:all}),merge};
    }

    draw(ctx,art) {
        if (!this.open) {
            return;
        }
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const s=this.scale();
        const PT=TUNING.reward.pickTime;
        const fade=this.picked?Math.max(0,1-this.pickT/PT):1;
        ctx.fillStyle=rgba('paper',0.84*Math.min(1,this.t/0.25)*fade);
        ctx.fillRect(0,0,w,h);
        const ta=EASE.easeOutBack(Math.min(1,this.t/0.4));
        ctx.save();
        ctx.globalAlpha=fade;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+Math.round(26*s*0.8)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const top=h*0.5-CARD_H*s*0.5-(this.dual()?110:56)*s*0.8;
        ctx.fillText(this.title,w/2,top-(1-ta)*30);
        const tw=ctx.measureText(this.title).width;
        drawShape(ctx,sketchLine(w/2-tw/2,top+22*s*0.8,w/2-tw/2+tw*Math.min(1,this.t/0.5),top+22*s*0.8,{width:2.4,seed:811}),PALETTE.ink,v);
        if (this.dual()) {
            const gap=CARD_W*s*1.22;
            for (let gi=0;gi<2;gi++) {
                const cx=w/2+(gi===0?-1:1)*gap*1.35;
                const ga=Math.min(1,Math.max(0,(this.t-0.2)/0.3));
                ctx.globalAlpha=fade*ga;
                ctx.fillStyle=gi===1?PALETTE.red:PALETTE.ink;
                ctx.font='bold '+Math.round(17*Math.min(1.2,s))+'px '+FONT;
                const gy=h*0.52-CARD_H*s*0.5-50*s;
                const bw=gap*2+CARD_W*s*0.3;
                ctx.textAlign='left';
                ctx.fillText(t(gi===0?'reward.pickNormal':'reward.pickRare'),cx-bw/2+16,gy);
                ctx.textAlign='center';
                const g=this.groups[gi];
                const col=gi===1?PALETTE.red:PALETTE.ink;
                ctx.font='bold 13px '+FONT;
                const lbl=t(g.skip?'reward.unskip':'reward.skipGroup');
                const sw=ctx.measureText(lbl).width+18;
                const sr={x:Math.round(cx+bw/2-sw-10),y:Math.round(gy-13),w:Math.round(sw),h:26};
                g.rect=sr;
                ctx.fillStyle=rgba(gi===1?'red':'ink',0.9*g.skipA);
                ctx.fillRect(sr.x,sr.y,sr.w,sr.h);
                drawShape(ctx,sketchRect(sr.x,sr.y,sr.w,sr.h,{width:1.4,seed:840+gi}),col,v);
                ctx.fillStyle=g.skipA>0.5?PALETTE.paper:col;
                ctx.fillText(lbl,sr.x+sr.w/2,sr.y+sr.h/2+1);
                ctx.font='bold '+Math.round(17*Math.min(1.2,s))+'px '+FONT;
                ctx.save();
                ctx.translate(Math.round(cx-bw/2),Math.round(gy-18*s));
                drawShape(ctx,sketchRect(0,0,Math.round(bw),Math.round(CARD_H*s+116*s),{width:1.4,seed:830+gi}),gi===1?rgba('red',0.5):rgba('ink',0.35),v);
                ctx.restore();
            }
            ctx.globalAlpha=1;
        }
        ctx.restore();
        for (let idx=0;idx<this.items.length;idx++) {
            const it=this.items[idx];
            const sl=this.slot(it);
            const order=it.g*2+it.i;
            const p=Math.max(0,Math.min(1,(this.t-0.15-order*0.1)/0.5));
            const e=EASE.easeOutBack(p);
            let x=sl.x;
            let y=sl.y+(1-e)*h*0.7;
            let rot=sl.rot+(1-e)*(it.i-0.5)*0.8;
            let sc=s*(0.6+0.4*e);
            const skipA=this.groups[it.g].skipA;
            let alpha=1-skipA*0.65;
            const hov=this.hover===idx&&!this.picked;
            const lift=Math.max(hov?1:0,it.selA);
            it.lift+=(lift-it.lift)*0.25;
            y-=it.lift*24*s;
            sc*=1+it.lift*0.08;
            rot*=1-it.lift;
            if (this.picked) {
                const k=EASE.easeInCubic(Math.min(1,this.pickT/(PT*0.85)));
                const chosen=this.groups[it.g].sel===it.i;
                if (chosen) {
                    x+=(this.target.x-x)*k;
                    y+=(this.target.y-y)*k-Math.sin(k*Math.PI)*80;
                    sc*=1-0.6*k;
                    rot+=k*2;
                }
                else {
                    y+=k*h*0.6;
                    rot+=k*(it.i===0?-0.8:0.8);
                    alpha*=1-k;
                }
            }
            it.x=x;
            it.y=y;
            if (p<=0) {
                continue;
            }
            ctx.save();
            ctx.globalAlpha=alpha;
            ctx.translate(x,y);
            ctx.rotate(rot);
            ctx.scale(sc,sc);
            ctx.translate(-CARD_W/2,-CARD_H/2);
            ctx.fillStyle=rgba('ink',hov?0.3:0.15);
            ctx.fillRect(hov?8:4,hov?8:4,CARD_W,CARD_H);
            ctx.drawImage(art.face(it.card,v),0,0,CARD_W,CARD_H);
            drawCost(ctx,it.card,false,v);
            if (it.card.def.rarity==='rare') {
                const q=(time.real*0.55)%2;
                const L=RARE.length;
                ctx.strokeStyle=PALETTE.red;
                ctx.lineWidth=2.4;
                if (q<1) {
                    ctx.setLineDash([q*L,L]);
                }
                else {
                    ctx.setLineDash([0,(q-1)*L,L-(q-1)*L,L]);
                }
                ctx.stroke(RARE.path);
                ctx.setLineDash([]);
            }
            if (it.selA>0.02) {
                ctx.globalAlpha=alpha*it.selA;
                ctx.strokeStyle=it.card.def.rarity==='rare'?PALETTE.red:PALETTE.ink;
                ctx.lineWidth=4;
                ctx.strokeRect(-6,-6,CARD_W+12,CARD_H+12);
                ctx.fillStyle=ctx.strokeStyle;
                ctx.beginPath();
                ctx.arc(CARD_W+2,-2,11,0,Math.PI*2);
                ctx.fill();
                ctx.fillStyle=PALETTE.paper;
                ctx.font='bold 14px '+FONT;
                ctx.textAlign='center';
                ctx.textBaseline='middle';
                ctx.fillText('✓',CARD_W+2,-1);
            }
            ctx.restore();
            if (!this.picked) {
                const cl=this.countLine(it.card);
                ctx.save();
                ctx.globalAlpha=p;
                ctx.font=(cl.merge?'bold ':'')+Math.round(13*Math.min(1.3,s))+'px '+FONT;
                ctx.fillStyle=cl.merge?PALETTE.red:PALETTE.nearGray;
                ctx.textAlign='center';
                ctx.textBaseline='top';
                ctx.fillText(cl.text,sl.x,sl.y+CARD_H*s*0.5+10);
                ctx.restore();
            }
        }
        const dual=this.dual();
        const bw=(dual?190:150)*Math.min(1.2,s);
        const bh=42;
        const bx=w/2-bw/2;
        const by=Math.min(h*0.52+CARD_H*s*0.5+(dual?48*s+14:44*Math.min(1.2,s)),h-bh-(dual?32:12));
        this.btnRect={x:bx,y:by,w:bw,h:bh};
        const ba=this.forced?0:Math.min(1,Math.max(0,(this.t-0.6)/0.3))*fade;
        const label=dual?(this.selected().length>0?t('reward.confirm',{n:this.selected().length}):t('reward.skipAll')):t('reward.skip');
        ctx.save();
        ctx.globalAlpha=ba;
        if (dual&&this.selected().length>0) {
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(bx,by,bw,bh);
        }
        ctx.translate(bx,by);
        drawShape(ctx,sketchRect(0,0,Math.round(bw),bh,{width:1.8,seed:812}),PALETTE.ink,v);
        ctx.fillStyle=dual&&this.selected().length>0?PALETTE.paper:PALETTE.ink;
        ctx.font='bold 16px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(label,bw/2,bh/2+1);
        ctx.restore();
        if (dual&&!this.picked&&this.t>0.6) {
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='13px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            ctx.fillText(t('reward.dualHint'),w/2,by+bh+10);
        }
        if (this.hover>=0&&!this.picked&&this.t>0.6) {
            const it=this.items[this.hover];
            const left=it.x<w/2;
            const ox=CARD_W*s*0.55+150;
            let tx=left?it.x-ox:it.x+ox;
            if (dual) {
                tx=it.x;
            }
            drawCardTooltip(ctx,it.card,tx,dual?it.y-CARD_H*s*0.55-8:it.y+CARD_H*s*0.45);
        }
    }
}
