import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {sketchRect,sketchLine,sketchPath,drawShape} from './sketch.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

const DESKTOP_KEYS=[
    ['legend.move.key','legend.move'],
    ['legend.aim.key','legend.aim'],
    ['legend.fire.key','legend.fire'],
    ['legend.dash.key','legend.dash'],
    ['legend.card.key','legend.card'],
    ['legend.drag.key','legend.drag'],
    ['legend.discard.key','legend.discard'],
    ['legend.cancel.key','legend.cancel'],
    ['legend.deck.key','legend.deck'],
    ['legend.quality.key','legend.quality'],
    ['legend.debug.key','legend.debug'],
    ['legend.hide.key','legend.hide']
];

const TOUCH_KEYS=[
    ['legend.touch.move.key','legend.touch.move'],
    ['legend.touch.aim.key','legend.touch.aim'],
    ['legend.touch.dash.key','legend.touch.dash'],
    ['legend.touch.card.key','legend.touch.card'],
    ['legend.touch.drag.key','legend.touch.drag'],
    ['legend.touch.discard.key','legend.touch.discard'],
    ['legend.touch.deck.key','legend.touch.deck'],
    ['legend.touch.debug.key','legend.touch.debug'],
    ['legend.touch.hide.key','legend.touch.hide']
];

function wobblyLine(ctx,x1,y1,x2,y2,seed,amp=0.8) {
    drawShape(ctx,sketchLine(x1,y1,x2,y2,{width:ctx.lineWidth*1.1,jitter:amp,seed,overshoot:1.5}),ctx.strokeStyle);
}

function wobblyRect(ctx,x,y,w,h,seed,amp=0.8) {
    drawShape(ctx,sketchRect(x,y,w,h,{width:ctx.lineWidth*1.1,jitter:amp,seed,overshoot:2}),ctx.strokeStyle);
}

const BOTTLE_W=46;
const BOTTLE_H=60;
const BOTTLE_PTS=[[14,-14],[14,-4],[4,4],[0,14],[0,BOTTLE_H-6],[6,BOTTLE_H],[BOTTLE_W-6,BOTTLE_H],[BOTTLE_W,BOTTLE_H-6],[BOTTLE_W,14],[BOTTLE_W-4,4],[BOTTLE_W-14,-4],[BOTTLE_W-14,-14]];
const BOTTLE_PATH=(()=>{
    const p=new Path2D();
    p.moveTo(BOTTLE_PTS[0][0],BOTTLE_PTS[0][1]);
    for (const q of BOTTLE_PTS) {
        p.lineTo(q[0],q[1]);
    }
    p.closePath();
    return p;
})();

export class Hud {
    constructor() {
        this.hpShown=TUNING.player.maxHp;
        this.legendOpen=true;
        this.legendBox={x:0,y:0,w:0,h:0,titleH:0};
        this.touchCollapsedOnce=false;
        this.inkShown=0;
        this.slosh=0;
        this.inkShakeT=0;
    }

    inkChanged(delta) {
        this.slosh=Math.min(1.5,this.slosh+Math.abs(delta)*0.35+0.15);
    }

    inkFail() {
        this.inkShakeT=0.4;
        this.slosh=Math.min(1.5,this.slosh+0.5);
    }

    toggleLegend() {
        this.legendOpen=!this.legendOpen;
    }

    hitLegendTitle(x,y) {
        const b=this.legendBox;
        return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.titleH;
    }

    update(dt,player,ink) {
        const k=1-Math.exp(-8*dt);
        this.hpShown+=(player.hp-this.hpShown)*k;
        if (ink) {
            this.inkShown+=(ink.value-this.inkShown)*(1-Math.exp(-6*dt));
        }
        this.slosh*=Math.exp(-1.6*dt);
        this.inkShakeT=Math.max(0,this.inkShakeT-dt);
    }

    drawInk(ctx,ink) {
        const x0=TUNING.hud.hpPos[0]+2;
        const y0=TUNING.hud.hpPos[1]+TUNING.hud.hpHeight+46;
        const shake=this.inkShakeT>0?Math.sin(this.inkShakeT*60)*5*(this.inkShakeT/0.4):0;
        ctx.save();
        ctx.translate(x0+shake,y0);
        ctx.fillStyle=PALETTE.paper;
        ctx.fill(BOTTLE_PATH);
        const frac=Math.max(0,Math.min(1,this.inkShown/ink.max));
        const top=14;
        const level=BOTTLE_H-(BOTTLE_H-top)*frac;
        const amp=1.2+this.slosh*3;
        const tt=time.real;
        ctx.save();
        ctx.clip(BOTTLE_PATH);
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(-2,BOTTLE_H+2);
        for (let x=-2;x<=BOTTLE_W+2;x+=3) {
            const y=level+Math.sin(x*0.22+tt*4.2)*amp+Math.sin(x*0.11-tt*2.6)*amp*0.6;
            ctx.lineTo(x,y);
        }
        ctx.lineTo(BOTTLE_W+2,BOTTLE_H+2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=rgba('paper',0.25);
        ctx.fillRect(6,18,5,BOTTLE_H-28);
        ctx.restore();
        ctx.strokeStyle=PALETTE.midGray;
        ctx.lineWidth=1;
        for (let i=1;i<ink.max;i++) {
            const y=BOTTLE_H-(BOTTLE_H-top)*i/ink.max;
            drawShape(ctx,sketchLine(BOTTLE_W-9,y,BOTTLE_W-2,y,{width:1,seed:600+i,overshoot:0}),i%5===0?PALETTE.nearGray:PALETTE.midGray);
        }
        drawShape(ctx,sketchPath(BOTTLE_PTS.concat([BOTTLE_PTS[0]]),{width:2.2,seed:620,overshoot:1}),PALETTE.ink);
        drawShape(ctx,sketchRect(11,-22,BOTTLE_W-22,9,{width:1.8,seed:621,overshoot:1}),PALETTE.ink);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 26px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='alphabetic';
        ctx.fillText(String(Math.floor(ink.value)),BOTTLE_W+12,BOTTLE_H-14);
        const nw=ctx.measureText(String(Math.floor(ink.value))).width;
        ctx.font='14px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText('/ '+ink.max,BOTTLE_W+16+nw,BOTTLE_H-14);
        ctx.font='bold 12px '+FONT;
        ctx.fillStyle=this.inkShakeT>0?PALETTE.red:PALETTE.ink;
        ctx.fillText(this.inkShakeT>0?t('deck.noInk'):t('hud.ink'),BOTTLE_W+12,BOTTLE_H+4);
        ctx.restore();
    }

    drawBuffs(ctx,player) {
        if (player.rapidT<=0) {
            return;
        }
        const x=TUNING.hud.hpPos[0];
        const y=TUNING.hud.hpPos[1]+TUNING.hud.hpHeight+130;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 13px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(t('hud.rapid')+' ×'+player.rapidMult+'  '+player.rapidT.toFixed(1)+t('hud.seconds'),x,y);
        const w=120*Math.min(1,player.rapidT/4);
        drawShape(ctx,sketchLine(x,y+20,x+Math.max(2,Math.round(w)),y+20,{width:3,seed:640,overshoot:0}),PALETTE.ink);
    }

    drawHp(ctx,player) {
        const H=TUNING.hud;
        const max=TUNING.player.maxHp;
        const x=H.hpPos[0];
        const y=H.hpPos[1];
        const h=H.hpHeight;
        const eraser=22;
        const full=H.hpLength;
        const frac=Math.max(0,Math.min(1,this.hpShown/max));
        const len=Math.max(4,full*frac);
        const low=player.hp/max<TUNING.damageFx.lowHp&&player.hp>0;
        const pulse=low?0.5+0.5*Math.sin(time.real*Math.PI*2*TUNING.damageFx.heartRate):0;
        ctx.lineCap='round';
        ctx.lineJoin='round';
        ctx.fillStyle=PALETTE.farGray;
        ctx.fillRect(x,y,eraser,h);
        ctx.fillStyle=PALETTE.midGray;
        ctx.fillRect(x+eraser-6,y,6,h);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(x+eraser,y,len,h);
        ctx.strokeStyle=PALETTE.midGray;
        ctx.lineWidth=1;
        wobblyLine(ctx,x+eraser,y+h/3,x+eraser+len,y+h/3,71,0.5);
        wobblyLine(ctx,x+eraser,y+h*2/3,x+eraser+len,y+h*2/3,72,0.5);
        const tx=x+eraser+len;
        const tipLen=h*1.2;
        ctx.fillStyle=PALETTE.farGray;
        ctx.beginPath();
        ctx.moveTo(tx,y);
        ctx.lineTo(tx+tipLen,y+h/2);
        ctx.lineTo(tx,y+h);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=low?PALETTE.red:PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(tx+tipLen*0.62,y+h*0.31);
        ctx.lineTo(tx+tipLen,y+h/2);
        ctx.lineTo(tx+tipLen*0.62,y+h*0.69);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle=low?rgba('red',0.6+0.4*pulse):PALETTE.ink;
        ctx.lineWidth=2;
        wobblyRect(ctx,x,y,eraser+len,h,11);
        wobblyLine(ctx,tx,y,tx+tipLen,y+h/2,41);
        wobblyLine(ctx,tx+tipLen,y+h/2,tx,y+h,42);
        wobblyLine(ctx,x+eraser,y-1,x+eraser,y+h+1,43,0.5);
        ctx.strokeStyle=rgba('ink',0.25);
        ctx.lineWidth=1.5;
        ctx.setLineDash([3,5]);
        ctx.beginPath();
        ctx.moveTo(tx+tipLen+4,y+h/2);
        ctx.lineTo(x+eraser+full+tipLen,y+h/2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 14px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(t('hud.hp')+' '+Math.ceil(player.hp)+' / '+max,x,y+h+8);
    }

    drawLegend(ctx,width,height,touch) {
        const P=TUNING.hud.legendPad;
        const rows=touch?TOUCH_KEYS:DESKTOP_KEYS;
        const title=t('legend.title')+(touch?'':'（H）');
        ctx.font='13px '+FONT;
        ctx.textBaseline='middle';
        ctx.textAlign='left';
        let keyW=0;
        let labW=0;
        for (const r of rows) {
            keyW=Math.max(keyW,ctx.measureText(t(r[0])).width);
            labW=Math.max(labW,ctx.measureText(t(r[1])).width);
        }
        ctx.font='bold 14px '+FONT;
        const titleW=ctx.measureText(title).width+(touch?24:0);
        const rowH=24;
        const titleH=30;
        const w=Math.max(titleW+P*2,keyW+labW+P*2+26);
        const h=this.legendOpen?titleH+rows.length*rowH+P*0.6:titleH;
        const x=16;
        const y=height-16-h;
        this.legendBox={x,y,w,h,titleH};
        ctx.fillStyle=rgba('paper',0.88);
        ctx.fillRect(x,y,w,h);
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=1.8;
        wobblyRect(ctx,x,y,w,h,201,0.7);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillText(title,x+P,y+titleH/2+1);
        if (touch) {
            const cx=x+w-P-6;
            const cy=y+titleH/2;
            ctx.lineWidth=2;
            ctx.beginPath();
            if (this.legendOpen) {
                ctx.moveTo(cx-5,cy-2);
                ctx.lineTo(cx,cy+3);
                ctx.lineTo(cx+5,cy-2);
            }
            else {
                ctx.moveTo(cx-5,cy+2);
                ctx.lineTo(cx,cy-3);
                ctx.lineTo(cx+5,cy+2);
            }
            ctx.stroke();
        }
        if (!this.legendOpen) {
            return;
        }
        ctx.strokeStyle=PALETTE.midGray;
        ctx.lineWidth=1;
        wobblyLine(ctx,x+8,y+titleH,x+w-8,y+titleH,301,0.5);
        ctx.font='13px '+FONT;
        for (let i=0;i<rows.length;i++) {
            const ry=y+titleH+P*0.3+i*rowH+rowH/2;
            const kw=ctx.measureText(t(rows[i][0])).width+12;
            ctx.strokeStyle=PALETTE.nearGray;
            ctx.lineWidth=1.3;
            wobblyRect(ctx,x+P,ry-9,kw,18,400+i*7,0.5);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(t(rows[i][0]),x+P+6,ry+1);
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(t(rows[i][1]),x+P+keyW+26,ry+1);
        }
    }
}
