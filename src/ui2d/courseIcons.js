import {PALETTE,rgba} from '../data/palette.js';
import {sketchRect,sketchCircle,sketchLine,drawShape} from './sketch.js';
import {FONT} from './uiKit.js';

const GLYPHS={
    math(ctx,k,col,v) {
        ctx.fillRect(-k*0.75,-k*0.5,k*0.9,k*0.22);
        ctx.fillRect(-k*0.41,-k*0.84,k*0.22,k*0.9);
        ctx.fillRect(k*0.05,k*0.2,k*0.8,k*0.2);
        ctx.fillRect(k*0.05,k*0.58,k*0.8,k*0.2);
    },
    pe(ctx,k,col,v) {
        ctx.lineWidth=k*0.2;
        ctx.beginPath();
        ctx.arc(0,k*0.12,k*0.78,0,Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0,k*0.12);
        ctx.lineTo(k*0.38,-k*0.28);
        ctx.moveTo(-k*0.2,-k*0.85);
        ctx.lineTo(k*0.2,-k*0.85);
        ctx.stroke();
    },
    copy(ctx,k,col,v) {
        ctx.lineWidth=k*0.2;
        ctx.strokeRect(-k*0.85,-k*0.85,k*1,k*1.1);
        ctx.fillRect(-k*0.2,-k*0.25,k*1.05,k*1.1);
        ctx.strokeStyle=PALETTE.paper;
        ctx.lineWidth=k*0.12;
        ctx.strokeRect(-k*0.2,-k*0.25,k*1.05,k*1.1);
    },
    dodge(ctx,k,col,v) {
        ctx.lineWidth=k*0.2;
        ctx.beginPath();
        ctx.moveTo(-k*0.9,k*0.5);
        ctx.lineTo(k*0.1,-k*0.5);
        ctx.stroke();
        ctx.save();
        ctx.translate(k*0.35,-k*0.7);
        ctx.rotate(0.8);
        ctx.fillRect(-k*0.25,-k*0.5,k*0.5,k*1.1);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(k*0.55,k*0.55,k*0.28,0,Math.PI*2);
        ctx.fill();
    },
    music(ctx,k,col,v) {
        ctx.lineWidth=k*0.2;
        ctx.beginPath();
        ctx.ellipse(-k*0.35,k*0.55,k*0.42,k*0.3,-0.4,0,Math.PI*2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(k*0.02,k*0.45);
        ctx.lineTo(k*0.02,-k*0.85);
        ctx.lineTo(k*0.75,-k*0.55);
        ctx.stroke();
    }
};

export function drawCourseIcon(ctx,id,x,y,r,v,red=false) {
    const f=GLYPHS[id];
    if (!f) {
        return;
    }
    const col=red?PALETTE.red:PALETTE.ink;
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle=red?rgba('red',0.1):rgba('paper',0.92);
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.fill();
    drawShape(ctx,sketchCircle(0,0,r,{width:1.8,seed:4200+id.length}),col,v);
    ctx.strokeStyle=col;
    ctx.fillStyle=col;
    ctx.lineCap='round';
    ctx.lineJoin='round';
    f(ctx,r*0.5,col,v);
    ctx.restore();
}
