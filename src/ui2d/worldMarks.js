import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {sketchRect,drawShape} from './sketch.js';
import {drawChoiceIcon,CHOICE_ICONS} from './menu.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export function exitLabel(ex) {
    if (ex.kind==='node') {
        return t('node.'+ex.node);
    }
    if (ex.kind==='act') {
        return t('exit.act',{act:ex.act});
    }
    if (ex.kind==='finish'||ex.kind==='continue') {
        return t('finale.'+ex.kind);
    }
    return t('exit.'+ex.kind);
}

function exitIcon(ex) {
    return CHOICE_ICONS[ex.kind==='node'?ex.node:ex.kind]||'event';
}

export class WorldMarks {
    constructor() {
        this.prompt=null;
        this.p={x:0,y:0};
    }

    hitPrompt(x,y) {
        const r=this.prompt;
        return !!r&&x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
    }

    drawPrompt(ctx,p,label,v,seed,sub=null) {
        const W=TUNING.worldMarks;
        ctx.font='bold 15px '+FONT;
        let bw=ctx.measureText(label).width+30;
        if (sub) {
            ctx.font='13px '+FONT;
            bw=Math.max(bw,Math.min(W.subMaxW,ctx.measureText(sub).width+30));
        }
        const bh=W.promptH+(sub?W.subH:0);
        const x=p.x-bw/2;
        const y=p.y-bh+Math.sin(time.real*W.bobRate)*W.bob;
        ctx.fillStyle=rgba('paper',0.96);
        ctx.fillRect(x,y,bw,bh);
        drawShape(ctx,sketchRect(x,y,bw,bh,{width:2,seed}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 15px '+FONT;
        ctx.fillText(label,p.x,y+W.promptH/2+1);
        if (sub) {
            ctx.font='13px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(sub,p.x,y+W.promptH+W.subH/2-4,bw-20);
        }
        this.prompt={x:x-W.touchPad,y:y-W.touchPad,w:bw+W.touchPad*2,h:bh+W.touchPad*2};
    }

    draw(ctx,game,touch,h) {
        this.prompt=null;
        const W=TUNING.worldMarks;
        const v=time.boilIndex;
        const p=this.p;
        ctx.save();
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const D=TUNING.doors;
        const doors=game.doors;
        for (const d of doors.list) {
            game.project(d.x,W.doorLift,d.z+W.doorIn,p);
            const open=d.open>0.5;
            if (!open) {
                continue;
            }
            const off=p.y<W.edgeTop;
            p.y=Math.max(W.edgeTop,Math.min(h-W.edgeBottom,p.y));
            const bob=Math.sin(time.real*W.bobRate+d.index)*W.bob;
            const red=d.exit.kind==='boss'||d.exit.node==='elite'||d.exit.kind==='finish';
            const label=exitLabel(d.exit);
            ctx.font='bold 15px '+FONT;
            const tw=ctx.measureText(label).width;
            const bw=tw+W.iconR*2+26;
            const bh=W.iconR*2+10;
            const x=p.x-bw/2;
            const y=p.y-bh/2+bob;
            ctx.fillStyle=rgba('paper',0.95);
            ctx.fillRect(x,y,bw,bh);
            drawShape(ctx,sketchRect(x,y,bw,bh,{width:2.2,seed:2300+d.index}),red?PALETTE.red:PALETTE.ink,v);
            drawChoiceIcon(ctx,exitIcon(d.exit),x+W.iconR+6,y+bh/2,W.iconR,v,red);
            ctx.fillStyle=red?PALETTE.red:PALETTE.ink;
            ctx.textAlign='left';
            ctx.fillText(label,x+W.iconR*2+14,y+bh/2+1);
            ctx.textAlign='center';
            if (off) {
                ctx.beginPath();
                ctx.moveTo(p.x-7,y-3);
                ctx.lineTo(p.x,y-11);
                ctx.lineTo(p.x+7,y-3);
                ctx.closePath();
                ctx.fill();
            }
        }
        ctx.globalAlpha=1;
        if (doors.focus>=0&&game.run.canExit()) {
            const d=doors.list[doors.focus];
            game.project(d.x,D.height+W.enterLift,d.z-d.t-D.alcove*0.5,p);
            this.drawPrompt(ctx,p,t(touch?'npc.tap':'npc.press')+'　'+t('door.enter',{name:exitLabel(d.exit)}),v,2340,t('intro.'+(d.exit.kind==='node'?d.exit.node:d.exit.kind)));
        }
        const mp=game.minis.prompt(game.player);
        if (mp) {
            game.project(mp.x,mp.y,mp.z,p);
            this.drawPrompt(ctx,p,t(touch?'npc.tap':'npc.press')+'　'+t(mp.key),v,2360);
        }
        const npcs=game.npcs;
        for (let i=0;i<npcs.list.length;i++) {
            const n=npcs.list[i];
            if (n.used||!game.run.canInteract(i)) {
                continue;
            }
            game.project(n.x,n.h+W.npcLift,n.z,p);
            if (npcs.focus===i&&doors.focus<0) {
                this.drawPrompt(ctx,p,t(touch?'npc.tap':'npc.press')+'　'+t('npc.'+n.model),v,2320+i);
            }
            else {
                const y=p.y-W.bangH+Math.abs(Math.sin(time.real*W.bobRate*0.8+i))*-W.bob*2;
                ctx.fillStyle=PALETTE.red;
                ctx.font='bold 26px '+FONT;
                ctx.fillText('!',p.x,y);
            }
        }
        ctx.restore();
    }
}
