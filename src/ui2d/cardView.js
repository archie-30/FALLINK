import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {sketchLine,sketchRect,sketchCircle,sketchPath,sketchPolygon,hatchFill,rectPoly,drawShape} from './sketch.js';
import {cardName,cardDesc,cardCost,cardKey,cardParams,freeCards} from '../game/card.js';
import {unlockLevel} from '../data/cards.js';
import {RNG} from '../core/rng.js';

export const CARD_W=TUNING.cards.width;
export const CARD_H=TUNING.cards.height;
const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const VARIANTS=TUNING.boil.variants;

const NO_START='。，、；：）」』！？…%;:,!?)”';

export function wrapText(ctx,text,maxW) {
    const lines=[];
    let cur='';
    const tokens=text.match(/[A-Za-z0-9.%×+'’\-]+|[\s\S]/gu)||[];
    for (const ch of tokens) {
        const test=cur+ch;
        if (ctx.measureText(test).width>maxW&&cur.length>0&&!NO_START.includes(ch)) {
            lines.push(cur.trimEnd());
            cur=ch===' '?'':ch;
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

function fillTri(ctx,pts,color) {
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for (const p of pts) {
        ctx.lineTo(p[0],p[1]);
    }
    ctx.closePath();
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
    whiteout(ctx,v,cx,cy) {
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate(-0.5);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-10,-26,20,42);
        drawShape(ctx,sketchRect(-10,-26,20,42,{width:1.8,seed:201}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.midGray;
        ctx.fillRect(-6,-36,12,10);
        drawShape(ctx,sketchRect(-6,-36,12,10,{width:1.4,seed:202}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(-4,-6,4,-6,{width:2,seed:203}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(0,-10,0,-2,{width:2,seed:204}),PALETTE.ink,v);
        ctx.restore();
        drawShape(ctx,sketchPath([[cx-30,cy+26],[cx-10,cy+20],[cx+14,cy+28],[cx+34,cy+22]],{width:5,seed:205,taper:0.7}),PALETTE.farGray,v);
    },
    shockwave(ctx,v,cx,cy) {
        dot(ctx,cx,cy,7,PALETTE.ink);
        for (let i=1;i<=3;i++) {
            drawShape(ctx,sketchCircle(cx,cy,7+i*9,{width:2.6-i*0.5,seed:210+i}),i===3?PALETTE.midGray:PALETTE.ink,v);
        }
        for (let i=0;i<6;i++) {
            const a=i/6*Math.PI*2+0.3;
            drawShape(ctx,sketchLine(cx+Math.cos(a)*38,cy+Math.sin(a)*38,cx+Math.cos(a)*44,cy+Math.sin(a)*44,{width:1.6,seed:215+i,overshoot:0}),PALETTE.nearGray,v);
        }
    },
    mark(ctx,v,cx,cy) {
        drawShape(ctx,sketchCircle(cx,cy,24,{width:2,seed:220}),PALETTE.ink,v);
        drawShape(ctx,sketchCircle(cx,cy,10,{width:1.6,seed:221}),PALETTE.ink,v);
        for (let i=0;i<4;i++) {
            const a=i*Math.PI/2;
            drawShape(ctx,sketchLine(cx+Math.cos(a)*16,cy+Math.sin(a)*16,cx+Math.cos(a)*32,cy+Math.sin(a)*32,{width:2,seed:222+i,overshoot:0}),PALETTE.ink,v);
        }
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 13px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('×2',cx+30,cy-26);
    },
    inkMine(ctx,v,cx,cy) {
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.arc(cx,cy+10,20,Math.PI,0);
        ctx.closePath();
        ctx.fill();
        ctx.fillRect(cx-4,cy-18,8,10);
        drawShape(ctx,sketchLine(cx-34,cy+11,cx+34,cy+11,{width:2,seed:230}),PALETTE.ink,v);
        for (let i=0;i<5;i++) {
            const a=-Math.PI*0.9+i*0.45;
            drawShape(ctx,sketchLine(cx+Math.cos(a)*24,cy+10+Math.sin(a)*24,cx+Math.cos(a)*32,cy+10+Math.sin(a)*32,{width:1.4,seed:231+i,overshoot:0}),PALETTE.nearGray,v);
        }
    },
    dualWield(ctx,v,cx,cy) {
        for (const oy of [-10,10]) {
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(cx-30,cy+oy-4,34,8);
            ctx.beginPath();
            ctx.moveTo(cx+4,cy+oy-4);
            ctx.lineTo(cx+16,cy+oy);
            ctx.lineTo(cx+4,cy+oy+4);
            ctx.closePath();
            ctx.fill();
            dot(ctx,cx+28,cy+oy,3.5,PALETTE.ink);
            drawShape(ctx,sketchLine(cx+20,cy+oy,cx+40,cy+oy,{width:1,seed:240+oy,overshoot:0}),PALETTE.midGray,v);
        }
    },
    pin(ctx,v,cx,cy) {
        drawShape(ctx,sketchCircle(cx,cy+14,20,{width:1.4,seed:250}),PALETTE.midGray,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.arc(cx,cy-18,9,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchLine(cx,cy-10,cx,cy+18,{width:2.6,seed:251,overshoot:0,taper:0.1}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(cx-20,cy+2,cx-10,cy+10,{width:1.2,seed:252}),PALETTE.nearGray,v);
        drawShape(ctx,sketchLine(cx+20,cy+2,cx+10,cy+10,{width:1.2,seed:253}),PALETTE.nearGray,v);
    },
    chain(ctx,v,cx,cy) {
        const pts=[[cx-30,cy+16],[cx-8,cy-14],[cx+10,cy+12],[cx+32,cy-16]];
        drawShape(ctx,sketchPath(pts,{width:2.2,seed:260,overshoot:0}),PALETTE.ink,v);
        for (const p of pts) {
            drawShape(ctx,sketchCircle(p[0],p[1],6,{width:1.6,seed:261+p[0]}),PALETTE.ink,v);
            dot(ctx,p[0],p[1],2.5,PALETTE.ink);
        }
    },
    inkRain(ctx,v,cx,cy) {
        const r=new RNG(270);
        for (let i=0;i<7;i++) {
            const x=cx-30+i*10+r.range(-3,3);
            const y=cy-24+r.range(0,24);
            ctx.fillStyle=PALETTE.ink;
            ctx.beginPath();
            ctx.moveTo(x,y-6);
            ctx.quadraticCurveTo(x+4,y+2,x,y+4);
            ctx.quadraticCurveTo(x-4,y+2,x,y-6);
            ctx.fill();
            drawShape(ctx,sketchLine(x,y-16,x,y-9,{width:1,seed:271+i,overshoot:0}),PALETTE.midGray,v);
        }
        drawShape(ctx,sketchPath([[cx-34,cy+24],[cx,cy+20],[cx+34,cy+24]],{width:2,seed:279}),PALETTE.ink,v);
    },
    reflect(ctx,v,cx,cy) {
        ctx.save();
        ctx.translate(cx+6,cy);
        ctx.rotate(0.35);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-4,-28,10,56);
        drawShape(ctx,sketchRect(-4,-28,10,56,{width:1.8,seed:280}),PALETTE.ink,v);
        ctx.restore();
        drawShape(ctx,sketchPath([[cx-34,cy-18],[cx+2,cy-2],[cx-30,cy+18]],{width:1.6,seed:281,overshoot:0}),PALETTE.nearGray,v);
        dot(ctx,cx-32,cy+18,4,PALETTE.ink);
    },
    inkWell(ctx,v,cx,cy) {
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(cx-16,cy-6,32,30);
        ctx.fillRect(cx-8,cy-16,16,10);
        drawShape(ctx,sketchRect(cx-16,cy-6,32,30,{width:1.8,seed:290}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.paper;
        ctx.font='bold 14px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('+3',cx,cy+10);
        dot(ctx,cx+26,cy-18,4,PALETTE.ink);
        dot(ctx,cx+32,cy-6,2.5,PALETTE.ink);
    },
    tsunami(ctx,v,cx,cy) {
        const pts=[];
        for (let i=0;i<=10;i++) {
            const x=cx-36+i*7.2;
            pts.push([x,cy+6+Math.sin(i*0.9)*8]);
        }
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(cx-36,cy+30);
        for (const p of pts) {
            ctx.lineTo(p[0],p[1]);
        }
        ctx.lineTo(cx+36,cy+30);
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchPath([[cx-28,cy-4],[cx-10,cy-26],[cx+14,cy-24],[cx+20,cy-8],[cx+8,cy-4]],{width:3,seed:300}),PALETTE.ink,v);
        dot(ctx,cx+30,cy-20,3,PALETTE.red);
    },
    blackHole(ctx,v,cx,cy) {
        const pts=[];
        for (let i=0;i<=30;i++) {
            const a=i*0.5;
            const r=30-i*0.95;
            pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r*0.8]);
        }
        drawShape(ctx,sketchPath(pts,{width:2,seed:310,overshoot:0}),PALETTE.ink,v);
        dot(ctx,cx,cy,7,PALETTE.ink);
        dot(ctx,cx+2,cy-1,2,PALETTE.red);
    },
    barrage(ctx,v,cx,cy) {
        for (let i=0;i<7;i++) {
            const a=-Math.PI*0.9+i*Math.PI*0.3;
            const x0=cx+Math.cos(a)*8;
            const y0=cy+10+Math.sin(a)*8;
            const x1=cx+Math.cos(a)*34;
            const y1=cy+10+Math.sin(a)*34;
            drawShape(ctx,sketchLine(x0,y0,x1,y1,{width:1.4,seed:320+i,overshoot:0}),PALETTE.midGray,v);
            dot(ctx,x1,y1,3.5,PALETTE.ink);
        }
        dot(ctx,cx,cy+10,8,PALETTE.ink);
        dot(ctx,cx,cy+10,2.5,PALETTE.red);
    },
    giantPen(ctx,v,cx,cy) {
        ctx.save();
        ctx.translate(cx,cy);
        ctx.rotate(-0.6);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(-40,-7,52,14);
        ctx.beginPath();
        ctx.moveTo(12,-7);
        ctx.lineTo(32,0);
        ctx.lineTo(12,7);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=PALETTE.red;
        ctx.beginPath();
        ctx.moveTo(26,-2);
        ctx.lineTo(32,0);
        ctx.lineTo(26,2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        drawShape(ctx,sketchLine(cx-36,cy+30,cx+36,cy+24,{width:5,seed:330,taper:0.15}),PALETTE.ink,v);
    },
    freezeAll(ctx,v,cx,cy) {
        ctx.save();
        ctx.translate(cx,cy);
        drawShape(ctx,sketchRect(-30,-24,60,48,{width:2.2,seed:340}),PALETTE.ink,v);
        drawShape(ctx,sketchRect(-22,-16,44,32,{width:1.2,seed:341}),PALETTE.midGray,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(-10,-9,7,18);
        ctx.fillRect(3,-9,7,18);
        ctx.restore();
        dot(ctx,cx+30,cy-24,3,PALETTE.red);
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
    },
    paperBlade(ctx,v,cx,cy) {
        const tri=[[cx-6,cy-16],[cx+14,cy+8],[cx-14,cy+10]];
        fillTri(ctx,tri,PALETTE.farGray);
        drawShape(ctx,sketchPolygon(tri,{width:1.8,seed:2001,overshoot:1}),PALETTE.ink,v);
        const arc=[];
        for (let i=0;i<=12;i++) {
            const a=-2.6+i/12*2.2;
            arc.push([cx+Math.cos(a)*32,cy+6+Math.sin(a)*22]);
        }
        drawShape(ctx,sketchPath(arc,{width:1.6,seed:2002,overshoot:0}),PALETTE.midGray,v);
        const e=arc[arc.length-1];
        fillTri(ctx,[[e[0]+6,e[1]-2],[e[0]-3,e[1]-8],[e[0]-1,e[1]+5]],PALETTE.midGray);
        for (let i=0;i<3;i++) {
            drawShape(ctx,sketchLine(cx-34+i*4,cy+22+i*3,cx-22+i*4,cy+16+i*3,{width:1.2,seed:2003+i}),PALETTE.midGray,v);
        }
    },
    blot(ctx,v,cx,cy) {
        drawShape(ctx,sketchCircle(cx,cy,26,{width:1.4,seed:2011}),PALETTE.midGray,v);
        dot(ctx,cx,cy,9,PALETTE.ink);
        for (let i=0;i<6;i++) {
            const a=i/6*Math.PI*2+0.3;
            const x0=cx+Math.cos(a)*30;
            const y0=cy+Math.sin(a)*30;
            const x1=cx+Math.cos(a)*15;
            const y1=cy+Math.sin(a)*15;
            drawShape(ctx,sketchLine(x0,y0,x1,y1,{width:1.4,seed:2012+i,overshoot:0}),PALETTE.ink,v);
            dot(ctx,x0,y0,3,PALETTE.red);
        }
    },
    inkField(ctx,v,cx,cy) {
        ctx.fillStyle=rgba('midGray',0.5);
        ctx.beginPath();
        ctx.ellipse(cx,cy+12,36,13,0,0,Math.PI*2);
        ctx.fill();
        for (let i=0;i<5;i++) {
            const x=cx-26+i*13;
            const h=14+(i%2)*8;
            fillTri(ctx,[[x-5,cy+14],[x,cy+14-h],[x+5,cy+14]],PALETTE.ink);
        }
        drawShape(ctx,sketchCircle(cx,cy+12,34,{width:1.2,seed:2021}),PALETTE.nearGray,v);
    },
    clusterBomb(ctx,v,cx,cy) {
        dot(ctx,cx,cy,11,PALETTE.ink);
        for (let i=0;i<4;i++) {
            const a=i/4*Math.PI*2+0.78;
            const x=cx+Math.cos(a)*26;
            const y=cy+Math.sin(a)*22;
            drawShape(ctx,sketchLine(cx+Math.cos(a)*13,cy+Math.sin(a)*11,x-Math.cos(a)*6,y-Math.sin(a)*6,{width:1.4,seed:2031+i,overshoot:0}),PALETTE.midGray,v);
            dot(ctx,x,y,5.5,PALETTE.ink);
        }
        drawShape(ctx,sketchCircle(cx,cy,12,{width:1.6,seed:2035}),PALETTE.ink,v);
    },
    haste(ctx,v,cx,cy) {
        for (let k=0;k<2;k++) {
            const x=cx-4+k*18;
            drawShape(ctx,sketchPath([[x-10,cy-16],[x+6,cy],[x-10,cy+16]],{width:3.2,seed:2041+k}),PALETTE.ink,v);
        }
        for (let i=0;i<3;i++) {
            drawShape(ctx,sketchLine(cx-38,cy-10+i*10,cx-16,cy-10+i*10,{width:1.4,seed:2044+i}),PALETTE.midGray,v);
        }
    },
    echo(ctx,v,cx,cy) {
        drawShape(ctx,sketchRect(cx-24,cy-20,26,34,{width:1.4,seed:2051}),PALETTE.midGray,v);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(cx-8,cy-12,26,34);
        drawShape(ctx,sketchRect(cx-8,cy-12,26,34,{width:1.8,seed:2052}),PALETTE.ink,v);
        const arc=[];
        for (let i=0;i<=10;i++) {
            const a=-0.4+i/10*4.4;
            arc.push([cx+5+Math.cos(a)*8,cy+5+Math.sin(a)*8]);
        }
        drawShape(ctx,sketchPath(arc,{width:1.8,seed:2053,overshoot:0}),PALETTE.red,v);
        const e=arc[arc.length-1];
        fillTri(ctx,[[e[0]+5,e[1]],[e[0]-3,e[1]-5],[e[0]-2,e[1]+5]],PALETTE.red);
    },
    inkStorm(ctx,v,cx,cy) {
        ctx.fillStyle=PALETTE.nearGray;
        for (const [x,y,r] of [[cx-14,cy-14,11],[cx,cy-20,13],[cx+14,cy-13,11],[cx,cy-10,12]]) {
            ctx.beginPath();
            ctx.arc(x,y,r,0,Math.PI*2);
            ctx.fill();
        }
        const bolt=[[cx+2,cy-6],[cx-8,cy+10],[cx,cy+10],[cx-6,cy+28],[cx+10,cy+6],[cx+2,cy+6],[cx+8,cy-6]];
        fillTri(ctx,bolt,PALETTE.red);
        drawShape(ctx,sketchPolygon(bolt,{width:1.2,seed:2061,overshoot:0}),PALETTE.darkRed,v);
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

function drawUpgradeFrame(ctx,v,seed,color) {
    const W=CARD_W;
    const H=CARD_H;
    const g=TUNING.cards.upFrame;
    drawShape(ctx,sketchRect(g,g,W-g*2,H-g*2,{width:1.3,jitter:0.6,seed:seed+21}),color,v);
    drawShape(ctx,sketchRect(g-4,g-4,W-g*2+8,H-g*2+8,{width:0.8,jitter:0.8,seed:seed+33}),color,v);
    const c=g+11;
    for (const [x,y,sx,sy] of [[g,H-g,1,-1],[W-g,H-g,-1,-1]]) {
        ctx.fillStyle=color;
        ctx.beginPath();
        ctx.moveTo(x,y);
        ctx.lineTo(x+sx*c,y);
        ctx.lineTo(x,y+sy*c);
        ctx.closePath();
        ctx.fill();
    }
    ctx.save();
    ctx.translate(g+14,H-g-14);
    ctx.fillStyle=color;
    ctx.beginPath();
    for (let i=0;i<10;i++) {
        const r=i%2===0?8:3.5;
        const a=-Math.PI/2+i*Math.PI/5;
        ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function renderIcon(card,v,scale) {
    const c=document.createElement('canvas');
    c.width=Math.ceil(64*scale);
    c.height=Math.ceil(64*scale);
    const ctx=c.getContext('2d');
    ctx.scale(scale,scale);
    ctx.translate(32,36);
    ctx.scale(0.62,0.62);
    const icon=ICONS[card.id];
    if (icon) {
        icon(ctx,v,0,0);
    }
    return c;
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
        ctx.save();
        ctx.translate(W/2+2,92);
        ctx.scale(1.3,1.3);
        icon(ctx,v,0,0);
        ctx.restore();
    }
    ctx.fillStyle=PALETTE.ink;
    ctx.font='bold 16px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    const nm=cardName(card);
    const nw=ctx.measureText(nm).width;
    if (nw>W-48) {
        ctx.font='bold '+Math.max(9,Math.floor(16*(W-48)/nw))+'px '+FONT;
    }
    ctx.fillText(nm,W/2+10,23);
    ctx.font='11px '+FONT;
    ctx.fillStyle=PALETTE.nearGray;
    ctx.fillText(card.def.rarity==='rare'?t('type.ult'):t('type.'+card.def.type),W/2,H-18);
    drawShape(ctx,sketchLine(W/2-26,H-29,W/2+26,H-29,{width:0.9,seed:seed+14,overshoot:1}),PALETTE.midGray,v);
    drawShape(ctx,sketchRect(3,3,W-6,H-6,{width:2.2,jitter:0.9,seed:seed+11}),PALETTE.ink,v);
    drawShape(ctx,sketchLine(W-18,H-4,W-4,H-18,{width:1.2,seed:seed+12}),PALETTE.midGray,v);
    if (card.upgraded) {
        drawUpgradeFrame(ctx,v,seed,card.def.rarity==='rare'?PALETTE.red:PALETTE.ink);
    }
    if (card.def.rarity==='rare') {
        ctx.save();
        ctx.translate(W-24,48);
        ctx.rotate(0.28);
        drawShape(ctx,sketchRect(-21,-8,42,16,{width:1.5,seed:seed+13,overshoot:1}),PALETTE.red,v);
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold 10px '+FONT;
        ctx.textAlign='center';
        ctx.fillText(t('type.ult'),0,1);
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

    icon(card,v) {
        return this.get('i|'+cardKey(card)+'|'+v,()=>renderIcon(card,v,this.scale));
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
    const free=freeCards.left>0&&card.def.rarity!=='rare';
    ctx.fillStyle=flash||free?PALETTE.red:PALETTE.paper;
    ctx.font='bold '+(free?17:15)+'px '+FONT;
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

const FACT_KEYS=['dps','radius','range','width','duration','heal','ink','hits','jumps','mult','hp','length','push','ramp'];

export function cardBrief(card) {
    const d=cardDesc(card);
    const cut=d.search(/[，。；：]|[.,;:] /);
    return cut>4?d.slice(0,cut):d;
}

export function cardChips(card) {
    const p=cardParams(card);
    const mode=card.def.mode;
    const out=[t('chip.cost',{v:cardCost(card)})];
    if (p.damage!==undefined) {
        out.push(p.count&&(mode==='shoot'||mode==='drop')?t('chip.damageEach',{v:p.damage,n:p.count}):t('chip.damage',{v:p.damage}));
    }
    else {
        const k=FACT_KEYS.find(q=>p[q]!==undefined);
        if (k) {
            out.push(t('fact.'+k,{v:p[k]}).replace(/：|: /,' '));
        }
    }
    out.push(t('cardMode.'+mode));
    return out;
}

export function cardFacts(card,withDesc=true) {
    const p=cardParams(card);
    const mode=card.def.mode;
    const out=[];
    if (withDesc) {
        out.push(t('fact.effect',{v:cardDesc(card)}));
    }
    out.push(t('fact.cost',{v:cardCost(card)}));
    out.push(t('fact.mode',{v:t('cardMode.'+mode)}));
    if (p.damage!==undefined) {
        if (p.count&&(mode==='shoot'||mode==='drop')) {
            out.push(t('fact.damageEach',{v:p.damage,n:p.count}));
        }
        else {
            out.push(t('fact.damage',{v:p.damage}));
        }
    }
    for (const k of FACT_KEYS) {
        if (p[k]!==undefined&&!(k==='ink'&&card.id==='echo')) {
            out.push(t('fact.'+k,{v:p[k]}));
        }
    }
    if (p.pct!==undefined) {
        out.push(t('fact.slow',{v:p.pct}));
    }
    out.push(t('fact.unlock',{v:unlockLevel(card.id)}));
    return out;
}

export function drawCardTooltip(ctx,card,x,y,maxW=270,k=1) {
    const pad=14*k;
    const W=maxW*k;
    const f=n=>Math.round(n*k)+'px '+FONT;
    ctx.save();
    ctx.font=f(13);
    const lines=wrapText(ctx,cardDesc(card),W-pad*2);
    const lh=19*k;
    const h=pad*2+44*k+lines.length*lh;
    let bx=x-W/2;
    let by=y-h;
    bx=Math.max(8,Math.min(ctx.canvas.width/(ctx.getTransform().a||1)-W-8,bx));
    by=Math.max(8,by);
    ctx.fillStyle=rgba('paper',0.97);
    ctx.fillRect(bx,by,W,h);
    drawShape(ctx,sketchRect(bx,by,W,h,{width:1.8,seed:1601}),card.def.rarity==='rare'?PALETTE.red:PALETTE.ink);
    ctx.fillStyle=PALETTE.ink;
    ctx.font='bold '+f(17);
    ctx.textAlign='left';
    ctx.textBaseline='top';
    ctx.fillText(cardName(card),bx+pad,by+pad);
    ctx.font='bold '+f(13);
    ctx.textAlign='right';
    ctx.fillText(t('tooltip.cost',{cost:cardCost(card)}),bx+W-pad,by+pad+3*k);
    ctx.textAlign='left';
    ctx.font=f(12);
    ctx.fillStyle=card.def.rarity==='rare'?PALETTE.red:PALETTE.nearGray;
    ctx.fillText(card.def.rarity==='rare'?t('type.ult'):t('type.'+card.def.type),bx+pad,by+pad+24*k);
    ctx.fillStyle=PALETTE.ink;
    ctx.font=f(13);
    for (let i=0;i<lines.length;i++) {
        ctx.fillText(lines[i],bx+pad,by+pad+44*k+i*lh);
    }
    ctx.restore();
}
