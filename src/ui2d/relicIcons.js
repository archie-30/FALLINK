import {PALETTE,rgba} from '../data/palette.js';
import {sketchRect,sketchCircle,sketchLine,drawShape} from './sketch.js';

const ICONS={
    refill(ctx,v,ink,fill) {
        ctx.save();
        ctx.rotate(-0.5);
        ctx.fillStyle=fill;
        ctx.fillRect(-9,-34,18,52);
        drawShape(ctx,sketchRect(-9,-34,18,52,{width:2,seed:4101}),ink,v);
        ctx.fillStyle=ink;
        ctx.fillRect(-9,-14,18,26);
        ctx.beginPath();
        ctx.moveTo(-9,18);
        ctx.lineTo(9,18);
        ctx.lineTo(0,34);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=fill;
        ctx.fillRect(-3,-8,6,14);
        drawShape(ctx,sketchLine(-9,-24,9,-24,{width:1.6,seed:4102}),ink,v);
        ctx.restore();
    },
    whiteout(ctx,v,ink,fill,accent) {
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-16,-6,32,38);
        drawShape(ctx,sketchRect(-16,-6,32,38,{width:2,seed:4111}),ink,v);
        ctx.fillStyle=accent;
        ctx.fillRect(-16,6,32,14);
        ctx.fillStyle=fill;
        ctx.fillRect(-10,-20,20,14);
        drawShape(ctx,sketchRect(-10,-20,20,14,{width:1.8,seed:4112}),ink,v);
        ctx.fillStyle=ink;
        ctx.fillRect(-2,-34,4,14);
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.ellipse(18,30,12,6,-0.2,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(18,30,7,{width:1.4,seed:4113}),ink,v);
    },
    sharpener(ctx,v,ink,fill,accent) {
        ctx.fillStyle=fill;
        ctx.fillRect(-28,-16,44,34);
        drawShape(ctx,sketchRect(-28,-16,44,34,{width:2,seed:4121}),ink,v);
        ctx.fillStyle=ink;
        ctx.beginPath();
        ctx.arc(-14,1,6,0,Math.PI*2);
        ctx.fill();
        ctx.save();
        ctx.translate(-14,1);
        ctx.rotate(-0.2);
        ctx.fillStyle=accent;
        ctx.fillRect(-34,-4,24,8);
        ctx.fillStyle=ink;
        ctx.fillRect(-36,-4,4,8);
        ctx.restore();
        drawShape(ctx,sketchCircle(24,-2,12,{width:2,seed:4122}),ink,v);
        drawShape(ctx,sketchLine(24,-2,34,-14,{width:2.4,seed:4123}),ink,v);
        ctx.fillStyle=ink;
        ctx.beginPath();
        ctx.arc(35,-15,4,0,Math.PI*2);
        ctx.fill();
    },
    bandage(ctx,v,ink,fill,accent) {
        ctx.save();
        ctx.rotate(-0.6);
        ctx.fillStyle=fill;
        ctx.fillRect(-40,-14,80,28);
        drawShape(ctx,sketchRect(-40,-14,80,28,{width:2,seed:4131}),ink,v);
        ctx.fillStyle=rgba('ink',0.12);
        ctx.fillRect(-14,-14,28,28);
        drawShape(ctx,sketchRect(-14,-14,28,28,{width:1.6,seed:4132}),ink,v);
        ctx.fillStyle=accent;
        ctx.fillRect(-3,-9,6,18);
        ctx.fillRect(-9,-3,18,6);
        ctx.fillStyle=ink;
        for (const [px,py] of [[-30,-6],[-30,6],[30,-6],[30,6],[-24,0],[24,0]]) {
            ctx.beginPath();
            ctx.arc(px,py,1.6,0,Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
    }
};

export function drawRelicIcon(ctx,id,x,y,s,v,locked=false) {
    const f=ICONS[id];
    if (!f) {
        return;
    }
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    if (locked) {
        ctx.globalAlpha*=0.55;
    }
    f(ctx,v,locked?PALETTE.midGray:PALETTE.ink,locked?PALETTE.farGray:PALETTE.paper,locked?PALETTE.midGray:PALETTE.red);
    ctx.restore();
}
