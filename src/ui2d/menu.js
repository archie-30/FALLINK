import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {sketchRect,sketchLine,drawShape} from './sketch.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export class RunSummary {
    constructor() {
        this.open=false;
        this.t=0;
        this.width=1;
        this.height=1;
        this.button={x:0,y:0,w:0,h:0};
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    show(victory,stats,onRestart) {
        this.open=true;
        this.t=0;
        this.victory=victory;
        this.stats=stats;
        this.onRestart=onRestart;
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        const b=this.button;
        if (this.t>1.0&&x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h) {
            this.open=false;
            if (this.onRestart) {
                this.onRestart();
            }
        }
        return true;
    }

    update(dt) {
        if (this.open) {
            this.t+=dt;
        }
    }

    draw(ctx) {
        if (!this.open) {
            return;
        }
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        ctx.fillStyle=rgba('paper',Math.min(0.94,this.t*2));
        ctx.fillRect(0,0,w,h);
        const title=this.victory?t('summary.victory'):t('summary.dead');
        const a=EASE.easeOutBack(Math.min(1,this.t/0.5));
        ctx.save();
        ctx.translate(w/2,h*0.24);
        ctx.scale(a,a);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 48px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(title,0,0);
        const tw=ctx.measureText(title).width;
        drawShape(ctx,sketchLine(-tw/2,34,-tw/2+tw*Math.min(1,this.t/0.8),34,{width:3,seed:901}),this.victory?PALETTE.ink:PALETTE.red,v);
        ctx.restore();
        const s=this.stats;
        const mm=Math.floor(s.time/60);
        const ss=Math.floor(s.time%60);
        const rows=[
            [t('summary.act'),String(s.act+(this.victory?0:1))],
            [t('summary.rooms'),String(s.rooms)],
            [t('summary.kills'),String(s.kills)],
            [t('summary.cards'),String(s.cards)],
            [t('summary.damage'),String(s.damage)],
            [t('summary.bosses'),String(s.bosses)],
            [t('summary.time'),mm+':'+(ss<10?'0':'')+ss]
        ];
        ctx.font='20px '+FONT;
        ctx.textBaseline='middle';
        const top=h*0.36;
        for (let i=0;i<rows.length;i++) {
            const p=Math.max(0,Math.min(1,(this.t-0.3-i*0.08)/0.35));
            if (p<=0) {
                continue;
            }
            const y=top+i*34;
            ctx.globalAlpha=p;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.textAlign='right';
            ctx.fillText(rows[i][0],w/2-20+(1-p)*-30,y);
            ctx.fillStyle=PALETTE.ink;
            ctx.textAlign='left';
            ctx.font='bold 20px '+FONT;
            ctx.fillText(rows[i][1],w/2+20+(1-p)*30,y);
            ctx.font='20px '+FONT;
            drawShape(ctx,sketchLine(w/2-160,y+16,w/2+160,y+16,{width:0.8,seed:910+i,overshoot:0}),PALETTE.farGray,v);
        }
        ctx.globalAlpha=1;
        const bw=200;
        const bh=48;
        const bx=w/2-bw/2;
        const by=top+rows.length*34+30;
        this.button={x:bx,y:by,w:bw,h:bh};
        const ba=Math.max(0,Math.min(1,(this.t-1.0)/0.3));
        ctx.globalAlpha=ba;
        drawShape(ctx,sketchRect(bx,by,bw,bh,{width:2.2,seed:920}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 20px '+FONT;
        ctx.textAlign='center';
        ctx.fillText(t('summary.restart'),w/2,by+bh/2+1);
        ctx.globalAlpha=1;
    }
}
