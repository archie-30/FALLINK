import {PALETTE,rgba,SKIN_TONES} from '../data/palette.js';
import {RELIC_TINT,RELIC_ORDER as RELIC_KEYS} from '../data/relics.js';
import {sketchRect,sketchCircle,sketchLine,sketchPath,sketchPolygon,drawShape} from './sketch.js';

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
    },
    inkVial(ctx,v,ink,fill,accent) {
        ctx.fillStyle=fill;
        ctx.fillRect(-14,-6,28,34);
        drawShape(ctx,sketchRect(-14,-6,28,34,{width:2,seed:4141}),ink,v);
        ctx.fillStyle=accent;
        ctx.fillRect(-14,8,28,20);
        ctx.fillStyle=ink;
        ctx.fillRect(-8,-18,16,12);
        ctx.fillRect(-10,-24,20,6);
        drawShape(ctx,sketchLine(-8,0,8,0,{width:1.4,seed:4142}),ink,v);
    },
    styptic(ctx,v,ink,fill,accent) {
        ctx.save();
        ctx.rotate(0.6);
        ctx.fillStyle=fill;
        ctx.beginPath();
        ctx.arc(-24,0,12,Math.PI/2,Math.PI*1.5);
        ctx.arc(24,0,12,-Math.PI/2,Math.PI/2);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle=ink;
        ctx.lineWidth=2.2;
        ctx.stroke();
        ctx.fillStyle=accent;
        ctx.fillRect(-10,-12,20,24);
        drawShape(ctx,sketchRect(-10,-12,20,24,{width:1.4,seed:4151}),ink,v);
        ctx.restore();
        ctx.fillStyle=PALETTE.red;
        ctx.beginPath();
        ctx.moveTo(22,-34);
        ctx.quadraticCurveTo(30,-22,22,-18);
        ctx.quadraticCurveTo(14,-22,22,-34);
        ctx.fill();
    },
    sneakers(ctx,v,ink,fill,accent) {
        ctx.fillStyle=fill;
        ctx.beginPath();
        ctx.moveTo(-30,14);
        ctx.lineTo(-30,-14);
        ctx.lineTo(-10,-14);
        ctx.lineTo(4,0);
        ctx.lineTo(28,6);
        ctx.quadraticCurveTo(36,10,32,18);
        ctx.lineTo(-30,18);
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchPath([[-30,18],[-30,-14],[-10,-14],[4,0],[28,6],[34,14],[32,18],[-30,18]],{width:2,seed:4161}),ink,v);
        ctx.fillStyle=accent;
        ctx.fillRect(-32,14,66,7);
        ctx.strokeStyle=ink;
        ctx.lineWidth=2;
        for (const q of [-12,-6,0]) {
            ctx.beginPath();
            ctx.moveTo(q-4,q*0.5-6);
            ctx.lineTo(q+6,q*0.5-2);
            ctx.stroke();
        }
        for (const q of [-8,0,8]) {
            drawShape(ctx,sketchLine(-44,q,-36,q,{width:1.6,seed:4162+q}),ink,v);
        }
    },
    feather(ctx,v,ink,fill,accent) {
        ctx.save();
        ctx.rotate(-0.7);
        ctx.fillStyle=fill;
        ctx.beginPath();
        ctx.moveTo(0,-36);
        ctx.quadraticCurveTo(18,-10,6,26);
        ctx.lineTo(-6,26);
        ctx.quadraticCurveTo(-18,-10,0,-36);
        ctx.fill();
        ctx.fillStyle=accent;
        ctx.beginPath();
        ctx.moveTo(0,-36);
        ctx.quadraticCurveTo(18,-10,6,26);
        ctx.lineTo(0,26);
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchPath([[0,-36],[12,-14],[6,26],[-6,26],[-12,-14],[0,-36]],{width:1.8,seed:4171}),ink,v);
        drawShape(ctx,sketchLine(0,-30,0,38,{width:2,seed:4172}),ink,v);
        for (const q of [-16,-4,8]) {
            drawShape(ctx,sketchLine(0,q,-9,q-8,{width:1.2,seed:4173+q}),ink,v);
            drawShape(ctx,sketchLine(0,q+4,9,q-4,{width:1.2,seed:4174+q}),ink,v);
        }
        ctx.restore();
    },
    eraserBits(ctx,v,ink,fill,accent) {
        ctx.save();
        ctx.rotate(-0.3);
        ctx.fillStyle=fill;
        ctx.fillRect(-26,-14,32,26);
        ctx.fillStyle=accent;
        ctx.fillRect(6,-14,18,26);
        drawShape(ctx,sketchRect(-26,-14,50,26,{width:2,seed:4181}),ink,v);
        ctx.restore();
        ctx.fillStyle=ink;
        for (const [x,y,r] of [[18,24,3],[26,18,2.4],[10,30,2],[30,28,2.8],[22,32,1.8]]) {
            ctx.beginPath();
            ctx.arc(x,y,r,0,Math.PI*2);
            ctx.fill();
        }
    },
    boxCutter(ctx,v,ink,fill,accent) {
        ctx.save();
        ctx.rotate(-0.6);
        ctx.fillStyle=accent;
        ctx.fillRect(-34,-9,44,18);
        drawShape(ctx,sketchRect(-34,-9,44,18,{width:2,seed:4191}),ink,v);
        ctx.fillStyle=fill;
        ctx.beginPath();
        ctx.moveTo(10,-7);
        ctx.lineTo(38,-7);
        ctx.lineTo(28,7);
        ctx.lineTo(10,7);
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchPath([[10,-7],[38,-7],[28,7],[10,7]],{width:1.8,seed:4192}),ink,v);
        for (const q of [16,24]) {
            drawShape(ctx,sketchLine(q,-7,q-4,7,{width:1,seed:4193+q}),ink,v);
        }
        ctx.fillStyle=ink;
        ctx.fillRect(-20,-12,8,4);
        ctx.restore();
    },
    glasses(ctx,v,ink,fill,accent) {
        for (const sx of [-1,1]) {
            ctx.fillStyle=rgba('paper',0.9);
            ctx.beginPath();
            ctx.arc(sx*17,2,13,0,Math.PI*2);
            ctx.fill();
            ctx.fillStyle=accent;
            ctx.globalAlpha*=0.5;
            ctx.beginPath();
            ctx.arc(sx*17-3,-2,5,0,Math.PI*2);
            ctx.fill();
            ctx.globalAlpha*=2;
            drawShape(ctx,sketchCircle(sx*17,2,13,{width:2.6,seed:4201+sx}),ink,v);
            drawShape(ctx,sketchLine(sx*30,0,sx*40,-8,{width:2.2,seed:4203+sx}),ink,v);
        }
        drawShape(ctx,sketchPath([[-5,0],[0,-4],[5,0]],{width:2.2,seed:4205}),ink,v);
    },
    coupon(ctx,v,ink,fill,accent) {
        ctx.save();
        ctx.rotate(-0.2);
        ctx.fillStyle=fill;
        ctx.beginPath();
        ctx.moveTo(-34,-18);
        ctx.lineTo(34,-18);
        ctx.lineTo(34,-6);
        ctx.arc(34,0,6,-Math.PI/2,Math.PI/2,true);
        ctx.lineTo(34,18);
        ctx.lineTo(-34,18);
        ctx.lineTo(-34,6);
        ctx.arc(-34,0,6,Math.PI/2,-Math.PI/2,true);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle=ink;
        ctx.lineWidth=2;
        ctx.stroke();
        ctx.setLineDash([3,3]);
        ctx.beginPath();
        ctx.moveTo(14,-16);
        ctx.lineTo(14,16);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=accent;
        ctx.font='bold 20px sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('%',-10,1);
        ctx.fillStyle=ink;
        ctx.beginPath();
        ctx.arc(24,0,3,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
    },
    metronome(ctx,v,ink,fill,accent) {
        ctx.fillStyle=fill;
        ctx.beginPath();
        ctx.moveTo(-10,-30);
        ctx.lineTo(10,-30);
        ctx.lineTo(22,28);
        ctx.lineTo(-22,28);
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchPath([[-10,-30],[10,-30],[22,28],[-22,28],[-10,-30]],{width:2,seed:4211}),ink,v);
        ctx.fillStyle=accent;
        ctx.fillRect(-22,18,44,10);
        drawShape(ctx,sketchLine(0,20,14,-26,{width:2.6,seed:4212}),ink,v);
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(6,-10,8,7);
        for (const sx of [-1,1]) {
            drawShape(ctx,sketchPath([[sx*30,-20],[sx*36,-12],[sx*30,-4]],{width:1.6,seed:4213+sx}),ink,v);
        }
    },
    redPact(ctx,v,ink,fill,accent) {
        ctx.fillStyle=fill;
        ctx.fillRect(-22,-28,44,52);
        drawShape(ctx,sketchRect(-22,-28,44,52,{width:2,seed:4221}),ink,v);
        ctx.fillStyle=ink;
        ctx.fillRect(-26,-32,52,7);
        ctx.fillRect(-26,22,52,7);
        for (const q of [-16,-8,0]) {
            drawShape(ctx,sketchLine(-14,q,14,q,{width:1.2,seed:4222+q}),ink,v);
        }
        ctx.fillStyle=PALETTE.red;
        ctx.beginPath();
        ctx.moveTo(0,4);
        ctx.quadraticCurveTo(10,16,0,20);
        ctx.quadraticCurveTo(-10,16,0,4);
        ctx.fill();
    },
    carbon(ctx,v,ink,fill,accent) {
        ctx.fillStyle=accent;
        ctx.fillRect(-14,-28,36,46);
        drawShape(ctx,sketchRect(-14,-28,36,46,{width:1.8,seed:4231}),ink,v);
        ctx.fillStyle=fill;
        ctx.fillRect(-24,-18,36,46);
        drawShape(ctx,sketchRect(-24,-18,36,46,{width:2,seed:4232}),ink,v);
        for (const q of [-8,0,8,16]) {
            drawShape(ctx,sketchLine(-18,q,6,q,{width:1.2,seed:4233+q}),ink,v);
        }
    },
    phoenix(ctx,v,ink,fill,accent) {
        ctx.fillStyle=accent;
        ctx.beginPath();
        ctx.moveTo(0,-32);
        ctx.quadraticCurveTo(22,-6,12,22);
        ctx.quadraticCurveTo(0,32,-12,22);
        ctx.quadraticCurveTo(-22,-6,0,-32);
        ctx.fill();
        drawShape(ctx,sketchPath([[0,-32],[16,-8],[12,22],[0,28],[-12,22],[-16,-8],[0,-32]],{width:2,seed:4241}),ink,v);
        ctx.fillStyle=PALETTE.red;
        ctx.beginPath();
        ctx.moveTo(0,-6);
        ctx.quadraticCurveTo(10,8,4,20);
        ctx.lineTo(-4,20);
        ctx.quadraticCurveTo(-10,8,0,-6);
        ctx.fill();
        for (const sx of [-1,1]) {
            ctx.fillStyle=fill;
            ctx.beginPath();
            ctx.moveTo(sx*12,0);
            ctx.quadraticCurveTo(sx*36,-14,sx*40,-30);
            ctx.quadraticCurveTo(sx*30,-4,sx*14,10);
            ctx.closePath();
            ctx.fill();
            drawShape(ctx,sketchPath([[sx*12,0],[sx*34,-16],[sx*40,-30],[sx*28,-6],[sx*14,10]],{width:1.6,seed:4242+sx}),ink,v);
        }
    },
    bigInk(ctx,v,ink,fill,accent) {
        ctx.fillStyle=fill;
        ctx.fillRect(-24,-12,48,42);
        ctx.fillStyle=accent;
        ctx.fillRect(-24,6,48,24);
        drawShape(ctx,sketchRect(-24,-12,48,42,{width:2.4,seed:4251}),ink,v);
        ctx.fillStyle=ink;
        ctx.fillRect(-12,-26,24,14);
        ctx.fillRect(-15,-32,30,7);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-12,-4,24,12);
        ctx.fillStyle=ink;
        ctx.font='bold 11px sans-serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('INK',0,2);
    },
    inkDrip(ctx,v,ink,fill,accent) {
        ctx.fillStyle=fill;
        ctx.beginPath();
        ctx.moveTo(-18,-30);
        ctx.lineTo(18,-30);
        ctx.lineTo(3,0);
        ctx.lineTo(18,30);
        ctx.lineTo(-18,30);
        ctx.lineTo(-3,0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=accent;
        ctx.beginPath();
        ctx.moveTo(-10,-14);
        ctx.lineTo(10,-14);
        ctx.lineTo(2,0);
        ctx.lineTo(-2,0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=ink;
        ctx.beginPath();
        ctx.moveTo(-14,30);
        ctx.quadraticCurveTo(0,14,14,30);
        ctx.fill();
        drawShape(ctx,sketchPath([[-18,-30],[18,-30],[3,0],[18,30],[-18,30],[-3,0],[-18,-30]],{width:2,seed:4261}),ink,v);
        ctx.fillRect(-22,-34,44,5);
        ctx.fillRect(-22,30,44,5);
        ctx.beginPath();
        ctx.arc(0,12,2.4,0,Math.PI*2);
        ctx.fill();
    },
    amulet(ctx,v,ink,fill,accent) {
        ctx.fillStyle=fill;
        ctx.fillRect(-16,-26,32,54);
        drawShape(ctx,sketchRect(-16,-26,32,54,{width:2,seed:4271}),ink,v);
        ctx.strokeStyle=PALETTE.red;
        ctx.lineWidth=2.6;
        ctx.beginPath();
        ctx.moveTo(-8,-14);
        ctx.lineTo(8,-14);
        ctx.moveTo(0,-20);
        ctx.lineTo(0,18);
        ctx.moveTo(-8,0);
        ctx.quadraticCurveTo(0,8,8,0);
        ctx.moveTo(-6,14);
        ctx.lineTo(6,14);
        ctx.stroke();
        ctx.fillStyle=accent;
        ctx.beginPath();
        ctx.arc(0,-32,6,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(0,-32,6,{width:1.6,seed:4272}),ink,v);
    },
    lastStand(ctx,v,ink,fill,accent) {
        drawShape(ctx,sketchLine(-18,34,-18,-32,{width:3,seed:4281}),ink,v);
        ctx.fillStyle=accent;
        ctx.beginPath();
        ctx.moveTo(-16,-30);
        ctx.quadraticCurveTo(4,-38,24,-28);
        ctx.lineTo(20,-14);
        ctx.lineTo(28,-2);
        ctx.quadraticCurveTo(6,-10,-16,-4);
        ctx.closePath();
        ctx.fill();
        drawShape(ctx,sketchPath([[-16,-30],[4,-36],[24,-28],[20,-14],[28,-2],[6,-8],[-16,-4]],{width:1.8,seed:4282}),ink,v);
        ctx.fillStyle=PALETTE.red;
        ctx.beginPath();
        ctx.moveTo(8,30);
        ctx.bezierCurveTo(-4,20,-2,8,8,12);
        ctx.bezierCurveTo(18,8,20,20,8,30);
        ctx.fill();
        drawShape(ctx,sketchPath([[8,14],[5,20],[10,22],[7,28]],{width:1.4,seed:4283}),PALETTE.paper,v);
    },
    gambler(ctx,v,ink,fill,accent) {
        const die=(x,y,r,n,seed)=>{
            ctx.save();
            ctx.translate(x,y);
            ctx.rotate(r);
            ctx.fillStyle=n===6?accent:fill;
            ctx.fillRect(-15,-15,30,30);
            drawShape(ctx,sketchRect(-15,-15,30,30,{width:2,seed}),ink,v);
            ctx.fillStyle=ink;
            const P={1:[[0,0]],6:[[-7,-8],[-7,0],[-7,8],[7,-8],[7,0],[7,8]],3:[[-8,-8],[0,0],[8,8]]};
            for (const [px,py] of P[n]) {
                ctx.beginPath();
                ctx.arc(px,py,3,0,Math.PI*2);
                ctx.fill();
            }
            ctx.restore();
        };
        die(-12,8,-0.25,6,4291);
        die(14,-10,0.3,3,4292);
    },
    masochist(ctx,v,ink,fill,accent) {
        ctx.fillStyle=accent;
        ctx.beginPath();
        ctx.moveTo(0,30);
        ctx.bezierCurveTo(-36,6,-24,-30,0,-14);
        ctx.bezierCurveTo(24,-30,36,6,0,30);
        ctx.fill();
        drawShape(ctx,sketchPath([[0,30],[-26,6],[-20,-22],[0,-14],[20,-22],[26,6],[0,30]],{width:2,seed:4301}),ink,v);
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.moveTo(4,-16);
        ctx.lineTo(-8,4);
        ctx.lineTo(2,4);
        ctx.lineTo(-4,22);
        ctx.lineTo(10,-2);
        ctx.lineTo(0,-2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=ink;
        ctx.beginPath();
        ctx.moveTo(30,-30);
        ctx.quadraticCurveTo(36,-22,30,-18);
        ctx.quadraticCurveTo(24,-22,30,-30);
        ctx.fill();
    },
};

export function relicTone(id) {
    return SKIN_TONES[RELIC_TINT[id]]||SKIN_TONES.gray;
}

const FRAMES={refill:'hex',sharpener:'square',inkVial:'drop',styptic:'circle',whiteout:'shield',bandage:'square',sneakers:'scallop',feather:'drop',eraserBits:'octagon',boxCutter:'diamond',glasses:'circle',coupon:'ticket',metronome:'shield',redPact:'diamond',carbon:'square',phoenix:'flame',bigInk:'hex',inkDrip:'octagon',amulet:'shield',lastStand:'star',gambler:'scallop',masochist:'star'};

function ring(n,r,rot=0,f=null) {
    const out=[];
    for (let i=0;i<n;i++) {
        const a=rot+i/n*Math.PI*2;
        const k=f?f(i):1;
        out.push([Math.cos(a)*r*k,Math.sin(a)*r*k]);
    }
    return out;
}

function framePts(shape,R) {
    if (shape==='hex') {
        return ring(6,R*1.02,Math.PI/6);
    }
    if (shape==='octagon') {
        return ring(8,R*1.02,Math.PI/8);
    }
    if (shape==='diamond') {
        return [[0,-R*1.12],[R*0.95,0],[0,R*1.12],[-R*0.95,0]];
    }
    if (shape==='square') {
        const q=R*0.86;
        return [[-q,-q+8],[-q+8,-q],[q-8,-q],[q,-q+8],[q,q-8],[q-8,q],[-q+8,q],[-q,q-8]];
    }
    if (shape==='shield') {
        return [[-R*0.88,-R*0.82],[0,-R*0.98],[R*0.88,-R*0.82],[R*0.84,R*0.1],[R*0.5,R*0.68],[0,R*1.02],[-R*0.5,R*0.68],[-R*0.84,R*0.1]];
    }
    if (shape==='scallop') {
        return ring(24,R*0.98,0,i=>i%2?0.9:1.04);
    }
    if (shape==='star') {
        return ring(16,R*1.02,-Math.PI/2,i=>i%2?0.82:1.06);
    }
    if (shape==='ticket') {
        const w=R*1.02;
        const h=R*0.74;
        return [[-w,-h],[w,-h],[w,-h*0.3],[w*0.86,0],[w,h*0.3],[w,h],[-w,h],[-w,h*0.3],[-w*0.86,0],[-w,-h*0.3]];
    }
    if (shape==='drop') {
        const out=[[0,-R*1.08]];
        for (let i=0;i<=12;i++) {
            const a=-Math.PI*0.15+i/12*Math.PI*1.3;
            out.push([Math.cos(a)*R*0.86,R*0.2+Math.sin(a)*R*0.78]);
        }
        return out;
    }
    if (shape==='flame') {
        return [[0,-R*1.1],[R*0.36,-R*0.62],[R*0.62,-R*0.86],[R*0.9,-R*0.2],[R*0.82,R*0.42],[R*0.44,R*0.9],[0,R*1.0],[-R*0.44,R*0.9],[-R*0.82,R*0.42],[-R*0.9,-R*0.2],[-R*0.62,-R*0.86],[-R*0.36,-R*0.62]];
    }
    return ring(28,R);
}

export function relicFrame(id) {
    return FRAMES[id]||'circle';
}

export function drawRelicIcon(ctx,id,x,y,s,v,locked=false,badge=true) {
    const f=ICONS[id];
    if (!f) {
        return;
    }
    const T=relicTone(id);
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    if (locked) {
        ctx.globalAlpha*=0.55;
    }
    if (badge) {
        const pts=framePts(relicFrame(id),46);
        const seed=4400+RELIC_KEYS.indexOf(id)*7;
        ctx.fillStyle=locked?PALETTE.farGray:T[0];
        ctx.beginPath();
        pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
        ctx.closePath();
        ctx.fill();
        ctx.save();
        ctx.scale(0.8,0.8);
        ctx.setLineDash([5,5]);
        ctx.strokeStyle=locked?rgba('midGray',0.5):T[1];
        ctx.lineWidth=2;
        ctx.beginPath();
        pts.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
        drawShape(ctx,sketchPolygon(pts,{width:2.8,seed}),locked?PALETTE.midGray:T[2],v);
        if (!locked) {
            ctx.fillStyle=T[2];
            for (const p of pts.filter((q,i)=>i%Math.max(1,Math.floor(pts.length/4))===0).slice(0,4)) {
                ctx.beginPath();
                ctx.arc(p[0]*0.88,p[1]*0.88,2.4,0,Math.PI*2);
                ctx.fill();
            }
        }
        ctx.scale(0.74,0.74);
    }
    if (locked==='hidden') {
        ctx.restore();
        return;
    }
    f(ctx,v,locked?PALETTE.midGray:PALETTE.ink,locked?PALETTE.farGray:PALETTE.paper,locked?PALETTE.midGray:T[1]);
    ctx.restore();
}
