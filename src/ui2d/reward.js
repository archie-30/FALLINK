import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
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
        this.width=1;
        this.height=1;
        this.t=0;
        this.picked=-2;
        this.pickT=0;
        this.hover=-1;
        this.onPick=null;
        this.target={x:0,y:0};
        this.skipRect={x:0,y:0,w:0,h:0};
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    scale() {
        return Math.max(0.9,Math.min(1.6,this.height/620));
    }

    show(cards,title,onPick,target) {
        this.open=true;
        this.items=cards.map((c,i)=>({card:c,i,x:0,y:0,rot:0,s:1,lift:0}));
        this.title=title;
        this.onPick=onPick;
        this.t=0;
        this.picked=-2;
        this.pickT=0;
        this.hover=-1;
        this.target=target||{x:this.width/2,y:this.height};
    }

    slot(i) {
        const n=this.items.length;
        const s=this.scale();
        const gap=CARD_W*s*1.25;
        return {x:this.width/2+(i-(n-1)/2)*gap,y:this.height*0.5,rot:(i-(n-1)/2)*0.06};
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
        if (!this.open||this.picked!==-2) {
            return;
        }
        this.hover=this.hitIndex(x,y);
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        if (this.picked!==-2||this.t<0.5) {
            return true;
        }
        const r=this.skipRect;
        if (x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) {
            this.picked=-1;
            this.pickT=0;
            return true;
        }
        const i=this.hitIndex(x,y);
        if (i>=0&&this.hover!==i) {
            this.hover=i;
            return true;
        }
        if (i>=0) {
            this.picked=i;
            this.pickT=0;
        }
        return true;
    }

    update(dt) {
        if (!this.open) {
            return;
        }
        this.t+=dt;
        if (this.picked!==-2) {
            this.pickT+=dt;
            if (this.pickT>=0.65) {
                const card=this.picked>=0?this.items[this.picked].card:null;
                this.open=false;
                if (this.onPick) {
                    this.onPick(card);
                }
            }
        }
    }

    draw(ctx,art) {
        if (!this.open) {
            return;
        }
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const s=this.scale();
        const fade=this.picked!==-2?Math.max(0,1-this.pickT/0.65):1;
        ctx.fillStyle=rgba('paper',0.82*Math.min(1,this.t/0.25)*fade);
        ctx.fillRect(0,0,w,h);
        const ta=EASE.easeOutBack(Math.min(1,this.t/0.4));
        ctx.save();
        ctx.globalAlpha=fade;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+Math.round(26*s*0.8)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const ty=h*0.5-CARD_H*s*0.5-50*s*0.8;
        ctx.fillText(this.title,w/2,ty-(1-ta)*30);
        const tw=ctx.measureText(this.title).width;
        drawShape(ctx,sketchLine(w/2-tw/2,ty+22*s*0.8,w/2-tw/2+tw*Math.min(1,this.t/0.5),ty+22*s*0.8,{width:2.4,seed:811}),PALETTE.ink,v);
        ctx.restore();
        for (let i=0;i<this.items.length;i++) {
            const it=this.items[i];
            const sl=this.slot(i);
            const p=Math.max(0,Math.min(1,(this.t-0.15-i*0.12)/0.5));
            const e=EASE.easeOutBack(p);
            let x=sl.x;
            let y=sl.y+(1-e)*h*0.7;
            let rot=sl.rot+(1-e)*(i-1)*0.6;
            let sc=s*(0.6+0.4*e);
            let alpha=1;
            const hov=this.hover===i&&this.picked===-2;
            it.lift+=((hov?1:0)-it.lift)*0.25;
            y-=it.lift*24*s;
            sc*=1+it.lift*0.08;
            rot*=1-it.lift;
            if (this.picked!==-2) {
                const k=EASE.easeInCubic(Math.min(1,this.pickT/0.55));
                if (i===this.picked) {
                    x+=(this.target.x-x)*k;
                    y+=(this.target.y-y)*k-Math.sin(k*Math.PI)*80;
                    sc*=1-0.6*k;
                    rot+=k*2;
                }
                else {
                    y+=k*h*0.6;
                    rot+=k*(i<this.picked?-0.8:0.8);
                    alpha=1-k;
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
            ctx.restore();
        }
        const bw=150*Math.min(1.2,s);
        const bh=40;
        const bx=w/2-bw/2;
        const by=h*0.5+CARD_H*s*0.5+40;
        this.skipRect={x:bx,y:by,w:bw,h:bh};
        const ba=Math.min(1,Math.max(0,(this.t-0.6)/0.3))*fade;
        ctx.save();
        ctx.globalAlpha=ba;
        drawShape(ctx,sketchRect(bx,by,bw,bh,{width:1.8,seed:812}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 16px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('reward.skip'),w/2,by+bh/2+1);
        ctx.restore();
        if (this.hover>=0&&this.picked===-2&&this.t>0.6) {
            const it=this.items[this.hover];
            const left=it.x<w/2;
            const ox=CARD_W*s*0.55+150;
            drawCardTooltip(ctx,it.card,left?it.x-ox:it.x+ox,it.y+CARD_H*s*0.45);
        }
    }
}
