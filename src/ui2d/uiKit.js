import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';
import {sketchRect,drawShape} from './sketch.js';

export const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export function inRect(r,x,y) {
    return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
}

export function drawButton(ctx,b,label,v,appear,hover,size=20,danger=false) {
    if (appear<=0) {
        return;
    }
    const e=EASE.easeOutBack(Math.min(1,appear));
    ctx.save();
    ctx.globalAlpha=Math.min(1,appear*2);
    ctx.translate(b.x+b.w/2,b.y+b.h/2);
    ctx.scale(e*(hover?1.05:1),e*(hover?1.05:1));
    ctx.rotate(hover?-0.015:0);
    ctx.fillStyle=hover?(danger?rgba('red',TUNING.ui.dangerHover):rgba('farGray',0.95)):rgba('paper',0.92);
    ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
    drawShape(ctx,sketchRect(-b.w/2,-b.h/2,b.w,b.h,{width:hover?2.8:2,seed:Math.round(b.y)+label.length}),hover&&danger?PALETTE.red:PALETTE.ink,v);
    ctx.fillStyle=hover&&danger?PALETTE.darkRed:PALETTE.ink;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    fitText(ctx,label,0,1,b.w-16,size,'bold ');
    ctx.restore();
}

export function fitText(ctx,text,x,y,maxW,size,weight) {
    ctx.font=weight+size+'px '+FONT;
    const w=ctx.measureText(text).width;
    if (w>maxW) {
        ctx.font=weight+Math.max(8,Math.floor(size*maxW/w))+'px '+FONT;
    }
    ctx.fillText(text,x,y);
}

export class Panel {
    constructor() {
        this.open=false;
        this.t=0;
        this.width=1;
        this.height=1;
        this.hoverIdx=-1;
        this.buttons=[];
        this.closing=false;
        this.outFrom=0.45;
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    show() {
        this.open=true;
        this.closing=false;
        this.t=0;
    }

    hide() {
        if (!this.open) {
            return;
        }
        this.open=false;
        this.closing=true;
        this.t=Math.min(this.t,this.outFrom);
    }

    shown() {
        return this.open||this.closing;
    }

    update(dt) {
        if (this.open) {
            this.t+=dt;
        }
        else if (this.closing) {
            this.t-=dt*this.outFrom/TUNING.ui.closeTime;
            if (this.t<=0) {
                this.t=0;
                this.closing=false;
            }
        }
    }

    hover(x,y) {
        this.hoverIdx=-1;
        for (let i=0;i<this.buttons.length;i++) {
            if (inRect(this.buttons[i],x,y)) {
                this.hoverIdx=i;
            }
        }
    }

    clearHover() {
        this.hover(TUNING.input.far,TUNING.input.far);
    }

    hitButton(x,y) {
        for (let i=0;i<this.buttons.length;i++) {
            if (inRect(this.buttons[i],x,y)) {
                return i;
            }
        }
        return -1;
    }

    move() {
    }

    up() {
    }
}
