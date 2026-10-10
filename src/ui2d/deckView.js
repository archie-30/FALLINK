import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {TUNING} from '../data/tuning.js';
import {CARD_W,CARD_H,drawCost,drawCardTooltip} from './cardView.js';
import {sketchRect,sketchLine,drawShape} from './sketch.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export class DeckView {
    constructor() {
        this.open=false;
        this.t=0;
        this.width=1;
        this.height=1;
        this.closeRect={x:0,y:0,w:0,h:0};
        this.rects=[];
        this.hx=-1;
        this.hy=-1;
        this.returnPause=false;
        this.closing=false;
        this.outRate=1;
        this.count=0;
        this.sel=null;
        this.scroll=0;
        this.maxScroll=0;
        this.drag=null;
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
        this.touch=false;
    }

    hovered() {
        if (this.touch) {
            return this.sel?this.rects.find(r=>r.card===this.sel)||null:null;
        }
        for (let i=this.rects.length-1;i>=0;i--) {
            const r=this.rects[i];
            if (this.hx>=r.x&&this.hx<=r.x+r.w&&this.hy>=r.y&&this.hy<=r.y+r.h) {
                return r;
            }
        }
        return null;
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    show() {
        this.open=true;
        this.closing=false;
        this.sel=null;
        this.onClosed=null;
        this.t=0;
        this.scroll=0;
        this.drag=null;
    }

    hit(x,y) {
        for (let i=this.rects.length-1;i>=0;i--) {
            const r=this.rects[i];
            if (x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) {
                return r;
            }
        }
        return null;
    }

    press(x,y) {
        if (!this.open) {
            return false;
        }
        const c=this.closeRect;
        if (x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h) {
            return false;
        }
        this.touch=true;
        this.drag={x,y,s0:this.scroll,moved:false};
        return true;
    }

    move(x,y) {
        const d=this.drag;
        if (!d) {
            return;
        }
        if (Math.abs(y-d.y)>TUNING.ui.deckDrag) {
            d.moved=true;
        }
        if (d.moved) {
            this.scroll=Math.max(0,Math.min(this.maxScroll,d.s0-(y-d.y)));
        }
    }

    up() {
        const d=this.drag;
        this.drag=null;
        if (!d||d.moved) {
            return;
        }
        const r=this.hit(d.x,d.y);
        this.sel=r?r.card:null;
    }

    wheel(dy) {
        if (this.open) {
            this.scroll=Math.max(0,Math.min(this.maxScroll,this.scroll+dy));
        }
    }

    hide() {
        if (!this.open) {
            return;
        }
        this.open=false;
        this.closing=true;
        this.sel=null;
        this.hx=-1;
        this.hy=-1;
        this.t=Math.min(this.t,Math.min(TUNING.ui.deckOutMax,0.4+this.count*0.03));
        this.outRate=this.t/TUNING.ui.deckCloseTime;
    }

    tap(x,y,type) {
        if (!this.open) {
            return false;
        }
        const c=this.closeRect;
        if (x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h) {
            return false;
        }
        const hx=this.hx;
        const hy=this.hy;
        this.touch=type!=='mouse';
        this.hx=x;
        this.hy=y;
        const hit=this.hovered();
        if (type==='mouse') {
            return !!hit;
        }
        if (hit) {
            this.sel=hit.card;
            return true;
        }
        this.hx=-1;
        this.hy=-1;
        if (this.sel) {
            this.sel=null;
            return true;
        }
        this.hx=hx;
        this.hy=hy;
        return false;
    }

    update(dt) {
        if (this.open) {
            this.t+=dt;
        }
        else if (this.closing) {
            this.t-=dt*this.outRate;
            if (this.t<=0) {
                this.t=0;
                this.closing=false;
                const cb=this.onClosed;
                this.onClosed=null;
                if (cb) {
                    cb();
                }
            }
        }
    }

    section(ctx,art,cards,title,x,y,w,variant,startIndex) {
        const sc=Math.min(0.85,w/(CARD_W*4.6));
        const cw=CARD_W*sc;
        const ch=CARD_H*sc;
        const gap=10;
        const cols=Math.max(1,Math.floor((w+gap)/(cw+gap)));
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 18px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(title+t('ui.count',{n:cards.length}),x,y);
        drawShape(ctx,sketchLine(x,y+28,x+w,y+28,{width:1.4,seed:title.length*7}),PALETTE.ink,variant);
        if (cards.length===0) {
            ctx.fillStyle=PALETTE.midGray;
            ctx.font='14px '+FONT;
            ctx.fillText(t('deck.empty'),x,y+40);
            return y+60;
        }
        for (let i=0;i<cards.length;i++) {
            const c=cards[i];
            const col=i%cols;
            const row=Math.floor(i/cols);
            const p=Math.max(0,Math.min(1,(this.t-(startIndex+i)*0.03)/0.35));
            const e=EASE.easeOutBack(p);
            const cx=x+col*(cw+gap)+cw/2;
            const cy=y+40+row*(ch+gap)+ch/2;
            this.rects.push({x:cx-cw/2,y:cy-ch/2,w:cw,h:ch,card:c});
            ctx.save();
            ctx.translate(cx,cy+(1-e)*30);
            ctx.globalAlpha*=Math.min(1,p*2);
            ctx.scale(sc*e,sc*e);
            ctx.translate(-CARD_W/2,-CARD_H/2);
            ctx.drawImage(art.face(c,variant),0,0,CARD_W,CARD_H);
            drawCost(ctx,c,false,variant);
            ctx.restore();
        }
        return y+40+Math.ceil(cards.length/cols)*(ch+gap);
    }

    draw(ctx,art,deck) {
        if (!this.open&&!this.closing) {
            return;
        }
        this.count=deck.drawPile.length+deck.discardPile.length;
        this.drawBody(ctx,art,deck);
    }

    drawBody(ctx,art,deck) {
        const variant=time.boilIndex;
        const w=this.width;
        const h=this.height;
        const a=Math.min(1,this.t/0.2);
        this.rects.length=0;
        ctx.fillStyle=rgba('paper',0.92*a);
        ctx.fillRect(0,0,w,h);
        const pw=Math.min(w-40,1100);
        const px=(w-pw)/2;
        const py=40;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 26px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='top';
        ctx.fillText(t('deck.viewer'),w/2,py-18+(1-EASE.easeOutBack(a))*-20);
        const colW=(pw-40)/2;
        const draw=deck.drawPile.slice().sort((p,q)=>p.id<q.id?-1:1);
        const bw=210;
        const bh=40;
        const bx=w/2-bw/2;
        const by=h-bh-30;
        const top=py+24;
        const bottom=by-34;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0,top,w,bottom-top);
        ctx.clip();
        const y0=py+30-this.scroll;
        const e1=this.section(ctx,art,draw,t('deck.draw'),px,y0,colW,variant,0);
        const e2=this.section(ctx,art,deck.discardPile,t('deck.discard'),px+colW+40,y0,colW,variant,draw.length);
        ctx.restore();
        this.rects=this.rects.filter(r=>r.y+r.h>top&&r.y<bottom);
        this.maxScroll=Math.max(0,Math.max(e1,e2)+this.scroll-bottom);
        this.scroll=Math.min(this.scroll,this.maxScroll);
        if (this.maxScroll>0) {
            const vh=bottom-top;
            const th=Math.max(30,vh*vh/(vh+this.maxScroll));
            const ty=top+(vh-th)*(this.scroll/this.maxScroll);
            ctx.fillStyle=rgba('ink',0.35);
            ctx.fillRect(px+pw+8,ty,4,th);
        }
        this.closeRect={x:bx,y:by,w:bw,h:bh};
        const ba=Math.min(1,this.t/0.3);
        ctx.fillStyle=rgba('paper',0.95*ba);
        ctx.fillRect(bx,by,bw,bh);
        ctx.save();
        ctx.translate(bx,by);
        drawShape(ctx,sketchRect(0,0,bw,bh,{width:this.tutHint==='done'?3:2,seed:77}),this.tutHint==='done'?PALETTE.red:PALETTE.ink,variant);
        ctx.restore();
        ctx.fillStyle=this.tutHint==='done'?PALETTE.red:PALETTE.ink;
        ctx.font='bold 16px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('deck.close'),w/2,by+bh/2+1);
        if (this.tutHint) {
            const done=this.tutHint==='done';
            const pu=0.5+0.5*Math.sin(time.real*(done?8:4));
            ctx.save();
            ctx.font='bold '+(done?19:16)+'px '+FONT;
            ctx.fillStyle=PALETTE.red;
            ctx.globalAlpha=a*(0.7+0.3*pu);
            ctx.fillText(t(done?'tut.deckDone':(this.touch?'tut.deckPick.touch':'tut.deckPick')),w/2,by-18);
            ctx.restore();
        }
        else {
            ctx.font='13px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(t(this.touch?'deck.tapHint':'deck.hoverHint'),w/2,by-16);
        }
        const hv=this.open?this.hovered():null;
        if (hv) {
            ctx.save();
            ctx.strokeStyle=PALETTE.red;
            ctx.lineWidth=2.5;
            ctx.strokeRect(hv.x-3,hv.y-3,hv.w+6,hv.h+6);
            ctx.restore();
            const right=hv.x+hv.w+290<w;
            drawCardTooltip(ctx,hv.card,right?hv.x+hv.w+147:hv.x-147,hv.y+hv.h);
        }
    }
}
