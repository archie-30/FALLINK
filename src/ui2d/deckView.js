import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {CARD_W,CARD_H,drawCost} from './cardView.js';
import {sketchRect,sketchLine,drawShape} from './sketch.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export class DeckView {
    constructor() {
        this.open=false;
        this.t=0;
        this.width=1;
        this.height=1;
        this.closeRect={x:0,y:0,w:0,h:0};
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    show() {
        this.open=true;
        this.t=0;
    }

    hide() {
        this.open=false;
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.hide();
        return true;
    }

    update(dt) {
        if (this.open) {
            this.t+=dt;
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
        ctx.fillText(title+'（'+cards.length+'）',x,y);
        drawShape(ctx,sketchLine(x,y+28,x+w,y+28,{width:1.4,seed:title.length*7}),PALETTE.ink,variant);
        if (cards.length===0) {
            ctx.fillStyle=PALETTE.midGray;
            ctx.font='14px '+FONT;
            ctx.fillText(t('deck.empty'),x,y+40);
            return;
        }
        for (let i=0;i<cards.length;i++) {
            const c=cards[i];
            const col=i%cols;
            const row=Math.floor(i/cols);
            const p=Math.max(0,Math.min(1,(this.t-(startIndex+i)*0.03)/0.35));
            const e=EASE.easeOutBack(p);
            const cx=x+col*(cw+gap)+cw/2;
            const cy=y+40+row*(ch+gap)+ch/2;
            ctx.save();
            ctx.translate(cx,cy+(1-e)*30);
            ctx.globalAlpha=Math.min(1,p*2);
            ctx.scale(sc*e,sc*e);
            ctx.translate(-CARD_W/2,-CARD_H/2);
            ctx.drawImage(art.face(c,variant),0,0,CARD_W,CARD_H);
            drawCost(ctx,c,false,variant);
            ctx.restore();
        }
    }

    draw(ctx,art,deck) {
        if (!this.open) {
            return;
        }
        const variant=time.boilIndex;
        const w=this.width;
        const h=this.height;
        const a=Math.min(1,this.t/0.2);
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
        this.section(ctx,art,draw,t('deck.draw'),px,py+30,colW,variant,0);
        this.section(ctx,art,deck.discardPile,t('deck.discard'),px+colW+40,py+30,colW,variant,draw.length);
        const bw=160;
        const bh=40;
        const bx=w/2-bw/2;
        const by=h-bh-30;
        this.closeRect={x:bx,y:by,w:bw,h:bh};
        drawShape(ctx,sketchRect(bx,by,bw,bh,{width:2,seed:77}),PALETTE.ink,variant);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 16px '+FONT;
        ctx.textBaseline='middle';
        ctx.fillText(t('deck.close'),w/2,by+bh/2+1);
    }
}
