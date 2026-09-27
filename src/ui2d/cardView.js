import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {sketchLine,sketchRect,sketchCircle,sketchPath,sketchPolygon,hatchFill,rectPoly,drawShape} from './sketch.js';
import {cardName,cardDesc,cardCost,cardKey} from '../game/card.js';
import {RNG} from '../core/rng.js';

export const CARD_W=TUNING.cards.width;
export const CARD_H=TUNING.cards.height;
const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const VARIANTS=TUNING.boil.variants;

function wrapText(ctx,text,maxW) {
    const lines=[];
    let cur='';
    for (const ch of text) {
        const test=cur+ch;
        if (ctx.measureText(test).width>maxW&&cur.length>0) {
            lines.push(cur);
            cur=ch;
        }
        else {
            cur=test;
        }
    }
    if (cur) {
        lines.push(cur);
    }
    return lines;
}

function dot(ctx,x,y,r,color) {
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();
}

const ICONS={
    scatter(ctx,v,cx,cy) {
        const ox=cx-24;
        const oy=cy+16;
        for (let i=0;i<5;i++) {
            const a=-0.55-0.9+i*0.45;
            const ex=ox+Math.cos(a)*44;
            const ey=oy+Math.sin(a)*44;
            drawShape(ctx,sketchLine(ox,oy,ex,ey,{width:2,seed:10+i,overshoot:1}),PALETTE.ink,v);
            dot(ctx,ex,ey,3.2,PALETTE.ink);
        }
        dot(ctx,ox,oy,5,PALETTE.ink);
    },
    pierce(ctx,v,cx,cy) {
        drawShape(ctx,sketchCircle(cx-10,cy+6,11,{width:1.6,seed:21}),PALETTE.nearGray,v);
        drawShape(ctx,sketchCircle(cx+14,cy-8,9,{width:1.6,seed:22}),PALETTE.nearGray,v);
        drawShape(ctx,sketchLine(cx-38,cy+24,cx+34,cy-20,{width:2.4,seed:23}),PALETTE.ink,v);
        const nib=[[cx+20,cy-12],[cx+40,cy-26],[cx+30,cy-6]];
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(nib[0][0],nib[0][1]);
        ctx.lineTo(nib[1][0],nib[1][1]);
        ctx.lineTo(nib[2][0],nib[2][1]);
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchPolygon(nib,{width:1.4,seed:24,overshoot:1.5}),PALETTE.ink,v);
    },
    homing(ctx,v,cx,cy) {
        const tx=cx+30;
        const ty=cy-4;
        drawShape(ctx,sketchLine(tx-7,ty-7,tx+7,ty+7,{width:2.2,seed:31}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(tx+7,ty-7,tx-7,ty+7,{width:2.2,seed:32}),PALETTE.ink,v);
        for (let i=0;i<3;i++) {
            const sx=cx-32;
            const sy=cy-18+i*18;
            const pts=[];
            for (let k=0;k<=8;k++) {
                const f=k/8;
                pts.push([sx+(tx-10-sx)*f,sy+(ty-sy)*f+Math.sin(f*Math.PI)*(i-1)*14]);
            }
            drawShape(ctx,sketchPath(pts,{width:1.3,seed:33+i,overshoot:0}),PALETTE.midGray,v);
            dot(ctx,sx,sy,4.5,PALETTE.ink);
        }
    },
    bomb(ctx,v,cx,cy) {
        dot(ctx,cx,cy+4,15,PALETTE.ink);
        const r=new RNG(41);
        for (let i=0;i<9;i++) {
            const a=i/9*Math.PI*2+r.range(-0.2,0.2);
            const d=r.range(22,30);
            drawShape(ctx,sketchLine(cx+Math.cos(a)*17,cy+4+Math.sin(a)*17,cx+Math.cos(a)*d,cy+4+Math.sin(a)*d,{width:2,seed:42+i,overshoot:0}),PALETTE.ink,v);
            dot(ctx,cx+Math.cos(a)*(d+4),cy+4+Math.sin(a)*(d+4),r.range(1.5,3),PALETTE.ink);
        }
        drawShape(ctx,sketchCircle(cx,cy+4,16,{width:1.8,seed:52}),PALETTE.ink,v);
    },
    rapid(ctx,v,cx,cy) {
        for (let i=0;i<3;i++) {
            const x=cx-22+i*20;
            ctx.fillStyle=PALETTE.ink;
            ctx.beginPath();
            ctx.moveTo(x-7,cy-5);
            ctx.lineTo(x+8,cy);
            ctx.lineTo(x-7,cy+5);
            ctx.closePath();
            ctx.fill();
            drawShape(ctx,sketchLine(x-18,cy-12+i*2,x-9,cy-12+i*2,{width:1.2,seed:60+i}),PALETTE.midGray,v);
            drawShape(ctx,sketchLine(x-18,cy+12-i*2,x-9,cy+12-i*2,{width:1.2,seed:63+i}),PALETTE.midGray,v);
        }
        drawShape(ctx,sketchPath([[cx-30,cy+22],[cx,cy+18],[cx+30,cy+22]],{width:1.6,seed:66}),PALETTE.nearGray,v);
    },
    execute(ctx,v,cx,cy) {
        drawShape(ctx,sketchCircle(cx,cy,20,{width:1.6,seed:71}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(cx-26,cy-26,cx+26,cy+26,{width:4.5,seed:72,taper:0.1}),PALETTE.red,v);
        drawShape(ctx,sketchLine(cx+22,cy-24,cx-20,cy+22,{width:3,seed:73,taper:0.1}),PALETTE.red,v);
        const r=new RNG(74);
        for (let i=0;i<6;i++) {
            dot(ctx,cx+r.range(-30,30),cy+r.range(-26,26),r.range(1.2,2.6),PALETTE.red);
        }
    },
    pencilWall(ctx,v,cx,cy) {
        const wall=[[cx-38,cy+20],[cx-18,cy+8],[cx+4,cy+14],[cx+26,cy+2]];
        ctx.fillStyle=PALETTE.midGray;
        ctx.beginPath();
        ctx.moveTo(wall[0][0],wall[0][1]);
        for (const p of wall) {
            ctx.lineTo(p[0],p[1]);
        }
        for (let i=wall.length-1;i>=0;i--) {
            ctx.lineTo(wall[i][0],wall[i][1]-12);
        }
        ctx.fill();
        drawShape(ctx,sketchPath(wall,{width:2,seed:101}),PALETTE.ink,v);
        drawShape(ctx,sketchPath(wall.map(p=>[p[0],p[1]-12]),{width:2,seed:102}),PALETTE.ink,v);
        const pen=[[cx+26,cy+2],[cx+33,cy-10],[cx+48,cy-34],[cx+42,cy-38],[cx+27,cy-14]];
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.moveTo(pen[0][0],pen[0][1]);
        for (const p of pen) {
            ctx.lineTo(p[0],p[1]);
        }
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchPolygon(pen,{width:1.6,seed:103,overshoot:1}),PALETTE.ink,v);
        dot(ctx,cx+27,cy-1,2.4,PALETTE.ink);
    },
    eraser(ctx,v,cx,cy) {
        for (let i=0;i<5;i++) {
            const a=-1.1+i*0.35-Math.PI/2+Math.PI/2;
            const x=cx-26+Math.cos(a)*44;
            const y=cy+18+Math.sin(a)*44*-1;
            drawShape(ctx,sketchLine(cx-26,cy+18,x,y,{width:1,seed:110+i,overshoot:0}),PALETTE.farGray,v);
            drawShape(ctx,sketchCircle(x,y,3,{width:1,seed:115+i}),PALETTE.midGray,v);
        }
        ctx.save();
        ctx.translate(cx-6,cy+2);
        ctx.rotate(-0.5);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-18,-9,24,18);
        ctx.fillStyle=PALETTE.midGray;
        ctx.fillRect(6,-10,14,20);
        drawShape(ctx,sketchRect(-18,-9,38,18,{width:1.8,seed:120,overshoot:1}),PALETTE.ink,v);
        ctx.restore();
    },
    eraseCover(ctx,v,cx,cy) {
        ctx.fillStyle=PALETTE.midGray;
        ctx.fillRect(cx-30,cy-16,26,32);
        drawShape(ctx,sketchRect(cx-30,cy-16,26,32,{width:2,seed:130}),PALETTE.ink,v);
        ctx.setLineDash([3,4]);
        ctx.strokeStyle=PALETTE.midGray;
        ctx.lineWidth=1.5;
        ctx.strokeRect(cx-4,cy-16,26,32);
        ctx.setLineDash([]);
        const r=new RNG(131);
        for (let i=0;i<8;i++) {
            dot(ctx,cx+r.range(0,34),cy+r.range(-18,18),r.range(1,2.2),PALETTE.midGray);
        }
        ctx.save();
        ctx.translate(cx+20,cy-18);
        ctx.rotate(0.6);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-12,-7,24,14);
        drawShape(ctx,sketchRect(-12,-7,24,14,{width:1.5,seed:132,overshoot:1}),PALETTE.ink,v);
        ctx.restore();
    },
    trap(ctx,v,cx,cy) {
        drawShape(ctx,hatchFill([[cx-24,cy],[cx-17,cy-17],[cx,cy-24],[cx+17,cy-17],[cx+24,cy],[cx+17,cy+17],[cx,cy+24],[cx-17,cy+17]],{spacing:5,seed:140,width:0.9}),PALETTE.midGray,v);
        drawShape(ctx,sketchCircle(cx,cy,27,{width:2.4,seed:141}),PALETTE.ink,v);
        const pts=[];
        for (let i=0;i<=16;i++) {
            const a=i/16*Math.PI*3;
            const rr=4+i*0.9;
            pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);
        }
        drawShape(ctx,sketchPath(pts,{width:1.6,seed:142,overshoot:0}),PALETTE.ink,v);
    },
    paperShield(ctx,v,cx,cy) {
        for (let i=0;i<3;i++) {
            const a=-2.2+i*1.1;
            const pts=[];
            for (let k=0;k<=6;k++) {
                const b=a-0.4+k*0.8/6;
                pts.push([cx+Math.cos(b)*28,cy+6+Math.sin(b)*28]);
            }
            drawShape(ctx,sketchPath(pts,{width:5,seed:150+i,taper:0.6,overshoot:0}),PALETTE.midGray,v);
            drawShape(ctx,sketchPath(pts,{width:1.4,seed:153+i,overshoot:1}),PALETTE.ink,v);
        }
        dot(ctx,cx,cy+2,7,PALETTE.ink);
        dot(ctx,cx,cy+18,9,PALETTE.ink);
    },
    inkDash(ctx,v,cx,cy) {
        const r=new RNG(160);
        ctx.fillStyle=PALETTE.ink;
        for (let i=0;i<7;i++) {
            const x=cx-36+i*9;
            ctx.beginPath();
            ctx.ellipse(x,cy+14+r.range(-2,2),6+i*0.4,3.5,0,0,Math.PI*2);
            ctx.fill();
        }
        dot(ctx,cx+30,cy-4,8,PALETTE.ink);
        for (let i=0;i<3;i++) {
            drawShape(ctx,sketchLine(cx-8,cy-14+i*8,cx+16,cy-14+i*8,{width:1.3,seed:161+i}),PALETTE.midGray,v);
        }
    },
    timeStop(ctx,v,cx,cy) {
        drawShape(ctx,sketchCircle(cx,cy,24,{width:2.2,seed:170}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(cx,cy,cx,cy-16,{width:2.2,seed:171,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(cx,cy,cx+11,cy+5,{width:2.2,seed:172,overshoot:0}),PALETTE.ink,v);
        for (let i=0;i<12;i++) {
            const a=i/12*Math.PI*2;
            dot(ctx,cx+Math.cos(a)*19,cy+Math.sin(a)*19,1.2,PALETTE.nearGray);
        }
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(cx+26,cy-22,5,16);
        ctx.fillRect(cx+34,cy-22,5,16);
    },
    clone(ctx,v,cx,cy) {
        dot(ctx,cx-14,cy-12,8,PALETTE.ink);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(cx-22,cy-2,16,22);
        drawShape(ctx,sketchCircle(cx+16,cy-12,8,{width:1.4,seed:180}),PALETTE.nearGray,v);
        drawShape(ctx,hatchFill(rectPoly(cx+8,cy-2,16,22),{spacing:4,seed:181,width:0.9}),PALETTE.nearGray,v);
        drawShape(ctx,sketchRect(cx+8,cy-2,16,22,{width:1.3,seed:182}),PALETTE.nearGray,v);
    },
    redraw(ctx,v,cx,cy) {
        const pts=[];
        for (let i=0;i<=14;i++) {
            const a=-0.3+i/14*Math.PI*1.6;
            pts.push([cx+Math.cos(a)*24,cy+Math.sin(a)*24]);
        }
        drawShape(ctx,sketchPath(pts,{width:2.4,seed:190}),PALETTE.ink,v);
        const e=pts[pts.length-1];
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(e[0]+8,e[1]-2);
        ctx.lineTo(e[0]-4,e[1]-9);
        ctx.lineTo(e[0]-2,e[1]+6);
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchLine(cx-34,cy+28,cx+34,cy+28,{width:2.6,seed:191}),PALETTE.red,v);
        dot(ctx,cx,cy,5,PALETTE.red);
    }
};

function drawPaper(ctx,v,seed) {
    const W=CARD_W;
    const H=CARD_H;
    ctx.fillStyle=PALETTE.paper;
    ctx.fillRect(2,2,W-4,H-4);
    for (let y=44;y<H-8;y+=13) {
        drawShape(ctx,sketchLine(8,y,W-8,y,{width:0.8,jitter:0.4,seed:seed+y,overshoot:0,taper:0.8}),PALETTE.farGray,v);
    }
    drawShape(ctx,sketchLine(16,34,16,H-6,{width:0.9,jitter:0.4,seed:seed+3,overshoot:0,taper:0.8}),PALETTE.farGray,v);
}

function renderFace(card,v,scale) {
    const W=CARD_W;
    const H=CARD_H;
    const c=document.createElement('canvas');
    c.width=Math.ceil(W*scale);
    c.height=Math.ceil(H*scale);
    const ctx=c.getContext('2d');
    ctx.scale(scale,scale);
    const seed=card.id.length*37+(card.upgraded?5:0);
    drawPaper(ctx,v,seed);
    ctx.save();
    ctx.translate(W/2,6);
    ctx.rotate(-0.07);
    ctx.fillStyle=rgba('farGray',0.75);
    ctx.fillRect(-20,-5,40,12);
    ctx.restore();
    const icon=ICONS[card.id];
    if (icon) {
        icon(ctx,v,W/2+4,70);
    }
    ctx.fillStyle=PALETTE.ink;
    ctx.font='bold 15px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(cardName(card),W/2+10,22);
    ctx.font='10px '+FONT;
    ctx.fillStyle=PALETTE.nearGray;
    ctx.textAlign='center';
    ctx.fillText(t('type.'+card.def.type),W/2+10,38);
    ctx.textAlign='left';
    ctx.font='11px '+FONT;
    ctx.fillStyle=PALETTE.ink;
    const lines=wrapText(ctx,cardDesc(card),W-28);
    for (let i=0;i<lines.length&&i<4;i++) {
        ctx.fillText(lines[i],20,112+i*14);
    }
    drawShape(ctx,sketchRect(3,3,W-6,H-6,{width:2.2,jitter:0.9,seed:seed+11}),PALETTE.ink,v);
    drawShape(ctx,sketchLine(W-18,H-4,W-4,H-18,{width:1.2,seed:seed+12}),PALETTE.midGray,v);
    if (card.def.rarity==='rare') {
        ctx.save();
        ctx.translate(W-26,44);
        ctx.rotate(0.28);
        drawShape(ctx,sketchRect(-17,-8,34,16,{width:1.5,seed:seed+13,overshoot:1}),PALETTE.red,v);
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold 10px '+FONT;
        ctx.textAlign='center';
        ctx.fillText(t('rarity.rare'),0,1);
        ctx.restore();
    }
    return c;
}

function renderBack(v,scale) {
    const W=CARD_W;
    const H=CARD_H;
    const c=document.createElement('canvas');
    c.width=Math.ceil(W*scale);
    c.height=Math.ceil(H*scale);
    const ctx=c.getContext('2d');
    ctx.scale(scale,scale);
    ctx.fillStyle=PALETTE.nearGray;
    ctx.fillRect(2,2,W-4,H-4);
    drawShape(ctx,hatchFill(rectPoly(8,8,W-16,H-16),{spacing:7,cross:true,seed:3,width:1}),PALETTE.ink,v);
    ctx.fillStyle=PALETTE.paper;
    ctx.beginPath();
    ctx.moveTo(W/2,H/2-26);
    ctx.bezierCurveTo(W/2+6,H/2-10,W/2+18,H/2,W/2+18,H/2+12);
    ctx.arc(W/2,H/2+12,18,0,Math.PI);
    ctx.bezierCurveTo(W/2-18,H/2,W/2-6,H/2-10,W/2,H/2-26);
    ctx.fill();
    drawShape(ctx,sketchRect(3,3,W-6,H-6,{width:2.2,seed:5}),PALETTE.ink,v);
    return c;
}

function renderBall(v,scale) {
    const S=56;
    const c=document.createElement('canvas');
    c.width=Math.ceil(S*scale);
    c.height=Math.ceil(S*scale);
    const ctx=c.getContext('2d');
    ctx.scale(scale,scale);
    const r=new RNG(90+v);
    const pts=[];
    for (let i=0;i<11;i++) {
        const a=i/11*Math.PI*2;
        const rr=r.range(17,24);
        pts.push([S/2+Math.cos(a)*rr,S/2+Math.sin(a)*rr]);
    }
    ctx.fillStyle=PALETTE.paper;
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for (const p of pts) {
        ctx.lineTo(p[0],p[1]);
    }
    ctx.closePath();
    ctx.fill();
    for (let i=0;i<6;i++) {
        const a=pts[r.int(0,10)];
        const b=[S/2+r.range(-8,8),S/2+r.range(-8,8)];
        drawShape(ctx,sketchLine(a[0],a[1],b[0],b[1],{width:1,seed:i+1,overshoot:0}),PALETTE.midGray,v);
    }
    drawShape(ctx,sketchPolygon(pts,{width:1.8,seed:7,overshoot:1}),PALETTE.ink,v);
    return c;
}

export class CardArt {
    constructor() {
        this.cache=new Map();
        this.scale=2;
    }

    setScale(s) {
        const q=Math.min(3.5,Math.max(1,Math.round(s*4)/4));
        if (q!==this.scale) {
            this.scale=q;
            this.cache.clear();
        }
    }

    get(key,make) {
        let c=this.cache.get(key);
        if (!c) {
            c=make();
            this.cache.set(key,c);
        }
        return c;
    }

    face(card,v) {
        return this.get('f|'+cardKey(card)+'|'+v,()=>renderFace(card,v,this.scale));
    }

    back(v) {
        return this.get('b|'+v,()=>renderBack(v,this.scale));
    }

    ball(v) {
        return this.get('ball|'+v,()=>renderBall(v,this.scale));
    }

    warm(cards) {
        for (const c of cards) {
            for (let v=0;v<VARIANTS;v++) {
                this.face(c,v);
            }
        }
        for (let v=0;v<VARIANTS;v++) {
            this.back(v);
            this.ball(v);
        }
    }
}

const DROP=(()=>{
    const p=new Path2D();
    p.moveTo(0,-15);
    p.bezierCurveTo(4,-8,12,-2,12,5);
    p.arc(0,5,12,0,Math.PI);
    p.bezierCurveTo(-12,-2,-4,-8,0,-15);
    return p;
})();

export function drawCost(ctx,card,flash,v) {
    ctx.save();
    ctx.translate(17,21);
    ctx.fillStyle=PALETTE.ink;
    ctx.fill(DROP);
    drawShape(ctx,sketchPath([[0,-17],[7,-8],[13,3],[11,12],[0,18],[-11,12],[-13,3],[-7,-8],[0,-17]],{width:1.4,seed:88,overshoot:1}),PALETTE.ink,v);
    ctx.fillStyle=flash?PALETTE.red:PALETTE.paper;
    ctx.font='bold 15px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(String(cardCost(card)),0,6);
    ctx.restore();
}

export function rareBorderPath() {
    const W=CARD_W;
    const H=CARD_H;
    const p=new Path2D();
    p.moveTo(6,6);
    p.lineTo(W-6,6);
    p.lineTo(W-6,H-6);
    p.lineTo(6,H-6);
    p.closePath();
    return {path:p,length:(W-12+H-12)*2};
}
