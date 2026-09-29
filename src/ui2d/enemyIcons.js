import {PALETTE} from '../data/palette.js';
import {sketchLine,sketchRect,sketchCircle,sketchPolygon,sketchPath,hatchFill,rectPoly,drawShape} from './sketch.js';

function fillPoly(ctx,pts,color) {
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for (const p of pts) {
        ctx.lineTo(p[0],p[1]);
    }
    ctx.closePath();
    ctx.fill();
}

function dot(ctx,x,y,r,color) {
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();
}

function xEye(ctx,x,y,v,seed) {
    drawShape(ctx,sketchLine(x-4,y-4,x+4,y+4,{width:1.8,seed,overshoot:0}),PALETTE.ink,v);
    drawShape(ctx,sketchLine(x+4,y-4,x-4,y+4,{width:1.8,seed:seed+1,overshoot:0}),PALETTE.ink,v);
}

export const ENEMY_ICONS={
    sprayer(ctx,v) {
        fillPoly(ctx,rectPoly(-14,-4,28,24),PALETTE.midGray);
        drawShape(ctx,hatchFill(rectPoly(-14,-4,28,24),{spacing:4,seed:1741,width:0.9}),PALETTE.nearGray,v);
        drawShape(ctx,sketchRect(-14,-4,28,24,{width:1.8,seed:1742}),PALETTE.ink,v);
        dot(ctx,0,-16,12,PALETTE.paper);
        drawShape(ctx,sketchCircle(0,-16,12,{width:1.8,seed:1743}),PALETTE.ink,v);
        fillPoly(ctx,[[-17,-22],[17,-22],[17,-19],[-17,-19]],PALETTE.nearGray);
        fillPoly(ctx,[[-9,-22],[-8,-32],[8,-32],[9,-22]],PALETTE.nearGray);
        drawShape(ctx,sketchRect(-17,-23,34,4,{width:1.4,seed:1744}),PALETTE.ink,v);
        xEye(ctx,-5,-13,v,1745);
        xEye(ctx,5,-13,v,1747);
        drawShape(ctx,sketchLine(14,4,26,4,{width:3,seed:1749,overshoot:0}),PALETTE.ink,v);
        fillPoly(ctx,[[25,1],[34,-5],[34,13],[25,7]],PALETTE.ink);
        drawShape(ctx,sketchLine(-8,20,-8,30,{width:3,seed:1750,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(8,20,8,30,{width:3,seed:1751,overshoot:0}),PALETTE.ink,v);
    },
    doodle(ctx,v) {
        fillPoly(ctx,rectPoly(-14,-4,28,24),PALETTE.farGray);
        drawShape(ctx,hatchFill(rectPoly(-14,-4,28,24),{spacing:5,seed:1701,width:0.9}),PALETTE.midGray,v);
        drawShape(ctx,sketchRect(-14,-4,28,24,{width:1.8,seed:1702}),PALETTE.ink,v);
        dot(ctx,0,-16,12,PALETTE.paper);
        drawShape(ctx,sketchCircle(0,-16,12,{width:1.8,seed:1703}),PALETTE.ink,v);
        fillPoly(ctx,[[-13,-18],[-10,-27],[0,-30],[10,-27],[13,-18]],PALETTE.midGray);
        xEye(ctx,-5,-14,v,1704);
        xEye(ctx,5,-14,v,1706);
        drawShape(ctx,sketchLine(14,4,30,4,{width:3,seed:1708,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(-8,20,-8,30,{width:3,seed:1709,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(8,20,8,30,{width:3,seed:1710,overshoot:0}),PALETTE.ink,v);
    },
    blob(ctx,v) {
        dot(ctx,0,4,24,PALETTE.nearGray);
        drawShape(ctx,sketchCircle(0,4,24,{width:2,seed:1720}),PALETTE.ink,v);
        dot(ctx,-8,-2,5,PALETTE.paper);
        dot(ctx,8,-2,5,PALETTE.paper);
        dot(ctx,-8,-1,2.4,PALETTE.ink);
        dot(ctx,8,-1,2.4,PALETTE.ink);
        dot(ctx,16,-18,5,PALETTE.nearGray);
        dot(ctx,-22,26,4,PALETTE.ink);
        dot(ctx,20,28,3,PALETTE.ink);
    },
    compass(ctx,v) {
        drawShape(ctx,sketchLine(0,-20,-16,28,{width:3.2,seed:1730,taper:0.3}),PALETTE.midGray,v);
        drawShape(ctx,sketchLine(0,-20,16,28,{width:3.2,seed:1731,taper:0.3}),PALETTE.midGray,v);
        drawShape(ctx,sketchLine(0,-20,-16,28,{width:1.2,seed:1732}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(0,-20,16,28,{width:1.2,seed:1733}),PALETTE.ink,v);
        dot(ctx,0,-20,7,PALETTE.paper);
        drawShape(ctx,sketchCircle(0,-20,7,{width:1.8,seed:1734}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(0,-27,0,-36,{width:2.4,seed:1735,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchCircle(0,28,22,{width:1,seed:1736}),PALETTE.midGray,v);
    },
    eraserMonster(ctx,v) {
        fillPoly(ctx,rectPoly(-26,-14,32,26),PALETTE.paper);
        fillPoly(ctx,rectPoly(6,-15,18,28),PALETTE.midGray);
        drawShape(ctx,sketchRect(-26,-14,50,26,{width:2,seed:1740}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(-20,-6,-10,-2,{width:2.2,seed:1741,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(-4,-2,4,-6,{width:2.2,seed:1742,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(-16,5,-2,5,{width:2,seed:1743,overshoot:0}),PALETTE.ink,v);
        for (const x of [-20,-8,4,16]) {
            drawShape(ctx,sketchLine(x,12,x,22,{width:2.6,seed:1744+x,overshoot:0}),PALETTE.ink,v);
        }
    },
    bird(ctx,v) {
        fillPoly(ctx,[[-30,4],[0,-4],[26,-22],[6,8]],PALETTE.paper);
        fillPoly(ctx,[[0,-4],[-8,-26],[10,0]],PALETTE.farGray);
        drawShape(ctx,sketchPolygon([[-30,4],[0,-4],[26,-22],[6,8]],{width:1.8,seed:1750,overshoot:1}),PALETTE.ink,v);
        drawShape(ctx,sketchPolygon([[0,-4],[-8,-26],[10,0]],{width:1.6,seed:1751,overshoot:1}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(-30,4,-36,-10,{width:1.8,seed:1752}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(-4,22,20,22,{width:1,seed:1753}),PALETTE.midGray,v);
    },
    inkBottle(ctx,v) {
        const pts=[[-8,-30],[8,-30],[8,-22],[20,-12],[22,26],[-22,26],[-20,-12],[-8,-22]];
        fillPoly(ctx,pts,PALETTE.farGray);
        fillPoly(ctx,rectPoly(-21,-2,42,14),PALETTE.paper);
        drawShape(ctx,sketchPolygon(pts,{width:2,seed:1760,overshoot:1}),PALETTE.ink,v);
        fillPoly(ctx,rectPoly(-10,-38,20,9),PALETTE.nearGray);
        drawShape(ctx,sketchLine(-12,2,-4,6,{width:2,seed:1761,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(12,2,4,6,{width:2,seed:1762,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchPath([[18,14],[14,18],[18,22],[13,25]],{width:2,seed:1763,overshoot:0}),PALETTE.red,v);
    },
    scissors(ctx,v) {
        fillPoly(ctx,[[-2,-2],[-26,-28],[-20,-30],[4,-6]],PALETTE.farGray);
        fillPoly(ctx,[[2,-2],[26,-28],[20,-30],[-4,-6]],PALETTE.midGray);
        drawShape(ctx,sketchPolygon([[-2,-2],[-26,-28],[-20,-30],[4,-6]],{width:1.6,seed:1770,overshoot:1}),PALETTE.ink,v);
        drawShape(ctx,sketchPolygon([[2,-2],[26,-28],[20,-30],[-4,-6]],{width:1.6,seed:1771,overshoot:1}),PALETTE.ink,v);
        drawShape(ctx,sketchCircle(-12,18,10,{width:3,seed:1772}),PALETTE.ink,v);
        drawShape(ctx,sketchCircle(12,18,10,{width:3,seed:1773}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(-4,-4,-9,9,{width:3,seed:1774,overshoot:0}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(4,-4,9,9,{width:3,seed:1775,overshoot:0}),PALETTE.ink,v);
        dot(ctx,0,-2,4,PALETTE.red);
    },
    book(ctx,v) {
        fillPoly(ctx,[[0,-6],[-30,-18],[-30,18],[0,26]],PALETTE.paper);
        fillPoly(ctx,[[0,-6],[30,-18],[30,18],[0,26]],PALETTE.paper);
        drawShape(ctx,sketchPolygon([[0,-6],[-30,-18],[-30,18],[0,26]],{width:1.8,seed:1780,overshoot:1}),PALETTE.ink,v);
        drawShape(ctx,sketchPolygon([[0,-6],[30,-18],[30,18],[0,26]],{width:1.8,seed:1781,overshoot:1}),PALETTE.ink,v);
        for (let i=0;i<3;i++) {
            drawShape(ctx,sketchLine(-24,-6+i*8,-6,-1+i*8,{width:1,seed:1782+i,overshoot:0}),PALETTE.midGray,v);
            drawShape(ctx,sketchLine(6,-1+i*8,24,-6+i*8,{width:1,seed:1786+i,overshoot:0}),PALETTE.midGray,v);
        }
        fillPoly(ctx,[[2,22],[8,22],[8,36],[5,32],[2,36]],PALETTE.red);
    }
};
