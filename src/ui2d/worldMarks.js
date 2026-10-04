import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {sketchRect,drawShape} from './sketch.js';
import {drawChoiceIcon,CHOICE_ICONS} from './menu.js';
import {NOTEBOOK} from '../data/notebook.js';

const SHOP=NOTEBOOK.shop;

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

    drawSpeech(ctx,p,q,v,foe=false) {
        const W=TUNING.worldMarks;
        const k=Math.min(1,q.t/0.25,(q.dur-q.t)/0.3);
        const e=EASE.easeOutBack(Math.min(1,q.t/0.3));
        ctx.save();
        ctx.globalAlpha*=Math.max(0,k);
        ctx.font='bold '+W.sayFont+'px '+FONT;
        const bw=ctx.measureText(q.text).width+28;
        const bh=W.sayFont+20;
        const m=W.sayMargin;
        const cx=Math.max(bw/2+W.sayLeft,Math.min((this.sw||p.x*2)-bw/2-m,p.x));
        const cy=Math.max(bh/2+W.sayTop,Math.min((this.sh||p.y*2)-bh-m,p.y-W.sayLift));
        const tail=Math.abs(cx-p.x)<bw/2&&Math.abs(cy-(p.y-W.sayLift))<1;
        ctx.translate(cx,cy);
        ctx.scale(e,e);
        ctx.fillStyle=rgba('paper',0.97);
        if (tail) {
            ctx.beginPath();
            ctx.moveTo(-8,bh/2-2);
            ctx.lineTo(0,bh/2+12);
            ctx.lineTo(8,bh/2-2);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillRect(-bw/2,-bh/2,bw,bh);
        drawShape(ctx,sketchRect(-bw/2,-bh/2,bw,bh,{width:2,seed:2380}),foe?PALETTE.red:PALETTE.ink,v);
        if (tail) {
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=2;
            ctx.beginPath();
            ctx.moveTo(-8,bh/2);
            ctx.lineTo(0,bh/2+12);
            ctx.lineTo(8,bh/2);
            ctx.stroke();
        }
        ctx.fillStyle=foe?PALETTE.red:PALETTE.ink;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(q.text,0,1);
        ctx.restore();
    }

    drawPad(ctx,game,pad) {
        const p=this.p;
        const n=TUNING.worldMarks.padSegs;
        const pulse=1+Math.sin(pad.t*5)*0.06;
        const grow=EASE.easeOutBack(Math.min(1,pad.t/0.35));
        ctx.save();
        ctx.beginPath();
        for (let i=0;i<=n;i++) {
            const a=i/n*Math.PI*2;
            game.project(pad.x+Math.cos(a)*pad.r*pulse*grow,0.05,pad.z+Math.sin(a)*pad.r*pulse*grow,p);
            if (i===0) {
                ctx.moveTo(p.x,p.y);
            }
            else {
                ctx.lineTo(p.x,p.y);
            }
        }
        ctx.fillStyle=rgba('red',0.16);
        ctx.fill();
        ctx.strokeStyle=PALETTE.red;
        ctx.lineWidth=3;
        ctx.setLineDash([10,7]);
        ctx.stroke();
        ctx.setLineDash([]);
        game.project(pad.x,TUNING.worldMarks.padLift,pad.z,p);
        const bob=Math.sin(pad.t*6)*5;
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold 16px '+FONT;
        ctx.fillText(t('tut.padHere'),p.x,p.y-22+bob);
        ctx.fillText('▼',p.x,p.y+bob);
        ctx.restore();
    }

    draw(ctx,game,touch,h,w) {
        this.prompt=null;
        this.sw=w;
        this.sh=h;
        const W=TUNING.worldMarks;
        const v=time.boilIndex;
        const p=this.p;
        ctx.save();
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const dir=game.run.tutorial()?game.run.director:null;
        if (dir&&dir.pad) {
            this.drawPad(ctx,game,dir.pad);
        }
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
            this.drawPrompt(ctx,p,t(touch?'npc.tap':'npc.press')+t('ui.gap')+t('door.enter',{name:exitLabel(d.exit)}),v,2340,t('intro.'+(d.exit.kind==='node'?d.exit.node:d.exit.kind)));
        }
        const mp=game.minis.prompt(game.player);
        if (mp) {
            game.project(mp.x,mp.y,mp.z,p);
            this.drawPrompt(ctx,p,t(touch?'npc.tap':'npc.press')+t('ui.gap')+t(mp.key),v,2360);
        }
        for (const e of game.enemies.list) {
            if (e.say&&e.alive) {
                game.project(e.renderPos.x,e.def.height*(e.elite?TUNING.elite.scale:1)+TUNING.taunt.lift,e.renderPos.z,p);
                this.drawSpeech(ctx,p,e.say,v,true);
            }
        }
        const npcs=game.npcs;
        for (const n of npcs.list) {
            if (n.say) {
                game.project(n.x,n.h+W.npcLift,n.z,p);
                this.drawSpeech(ctx,p,n.say,v);
            }
        }
        let focused=-1;
        for (let i=0;i<npcs.list.length;i++) {
            const n=npcs.list[i];
            if (n.used||!game.run.canInteract(i)) {
                continue;
            }
            game.project(n.x,n.h+W.npcLift,n.z,p);
            if (npcs.focus===i&&doors.focus<0) {
                focused=i;
            }
            else if (n.item) {
                const poor=game.run.stats.score<n.price;
                const y=p.y-W.bangH+Math.sin(time.real*W.bobRate+i)*W.bob;
                const label=t('shop.price',{n:n.price});
                ctx.font='bold 14px '+FONT;
                const tw=ctx.measureText(label).width+16;
                ctx.fillStyle=rgba('paper',0.95);
                ctx.fillRect(p.x-tw/2,y-11,tw,22);
                drawShape(ctx,sketchRect(p.x-tw/2,y-11,tw,22,{width:1.4,seed:2390+i}),poor?PALETTE.red:PALETTE.ink,v);
                ctx.fillStyle=poor?PALETTE.red:PALETTE.ink;
                ctx.fillText(label,p.x,y+1);
                ctx.font='12px '+FONT;
                ctx.fillStyle=PALETTE.nearGray;
                ctx.fillText(n.label,p.x,y-22);
            }
            else {
                const y=p.y-W.bangH+Math.abs(Math.sin(time.real*W.bobRate*0.8+i))*-W.bob*2;
                ctx.fillStyle=PALETTE.red;
                ctx.font='bold 26px '+FONT;
                ctx.fillText('!',p.x,y);
            }
        }
        if (focused>=0) {
            const n=npcs.list[focused];
            game.project(n.x,n.h+W.npcLift,n.z,p);
            const sub=n.item?t('shop.'+n.item+'.desc',{price:n.price,n:SHOP.items[n.item].n||0}):null;
            this.drawPrompt(ctx,p,t(touch?'npc.tap':'npc.press')+t('ui.gap')+(n.label||t('npc.'+n.model)),v,2320+focused,sub);
        }
        ctx.restore();
    }
}
