import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {hash1} from '../core/rng.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

const DESKTOP_KEYS=[
    ['legend.move.key','legend.move'],
    ['legend.aim.key','legend.aim'],
    ['legend.fire.key','legend.fire'],
    ['legend.dash.key','legend.dash'],
    ['legend.quality.key','legend.quality'],
    ['legend.debug.key','legend.debug'],
    ['legend.hide.key','legend.hide']
];

const TOUCH_KEYS=[
    ['legend.touch.move.key','legend.touch.move'],
    ['legend.touch.aim.key','legend.touch.aim'],
    ['legend.touch.dash.key','legend.touch.dash'],
    ['legend.touch.debug.key','legend.touch.debug'],
    ['legend.touch.hide.key','legend.touch.hide']
];

function j(seed,amp) {
    return (hash1(seed*131+time.boilIndex*7919)-0.5)*2*amp;
}

function wobblyLine(ctx,x1,y1,x2,y2,seed,amp=0.8) {
    ctx.beginPath();
    ctx.moveTo(x1+j(seed,amp),y1+j(seed+1,amp));
    const mx=(x1+x2)/2+j(seed+2,amp);
    const my=(y1+y2)/2+j(seed+3,amp);
    ctx.quadraticCurveTo(mx,my,x2+j(seed+4,amp),y2+j(seed+5,amp));
    ctx.stroke();
}

function wobblyRect(ctx,x,y,w,h,seed,amp=0.8) {
    wobblyLine(ctx,x-2,y,x+w+2,y,seed,amp);
    wobblyLine(ctx,x+w,y-2,x+w,y+h+2,seed+10,amp);
    wobblyLine(ctx,x+w+2,y+h,x-2,y+h,seed+20,amp);
    wobblyLine(ctx,x,y+h+2,x,y-2,seed+30,amp);
}

export class Hud {
    constructor() {
        this.hpShown=TUNING.player.maxHp;
        this.legendOpen=true;
        this.legendBox={x:0,y:0,w:0,h:0,titleH:0};
        this.touchCollapsedOnce=false;
    }

    toggleLegend() {
        this.legendOpen=!this.legendOpen;
    }

    hitLegendTitle(x,y) {
        const b=this.legendBox;
        return x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.titleH;
    }

    update(dt,player) {
        const k=1-Math.exp(-8*dt);
        this.hpShown+=(player.hp-this.hpShown)*k;
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
