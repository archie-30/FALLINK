import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {EASE} from '../core/easing.js';
import {sketchRect,sketchLine,sketchCircle,drawShape} from './sketch.js';
import {settings} from '../core/settings.js';
import {CARDS,ALL_CARDS} from '../data/cards.js';
import {createCard} from '../game/card.js';
import {CARD_W,CARD_H,drawCost} from './cardView.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

function inRect(r,x,y) {
    return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
}

function drawButton(ctx,b,label,v,appear,hover,size=20) {
    if (appear<=0) {
        return;
    }
    const e=EASE.easeOutBack(Math.min(1,appear));
    ctx.save();
    ctx.globalAlpha=Math.min(1,appear*2);
    ctx.translate(b.x+b.w/2,b.y+b.h/2);
    ctx.scale(e*(hover?1.05:1),e*(hover?1.05:1));
    ctx.rotate(hover?-0.015:0);
    ctx.fillStyle=hover?rgba('farGray',0.95):rgba('paper',0.92);
    ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
    drawShape(ctx,sketchRect(-b.w/2,-b.h/2,b.w,b.h,{width:hover?2.8:2,seed:Math.round(b.y)+label.length}),PALETTE.ink,v);
    ctx.fillStyle=PALETTE.ink;
    ctx.font='bold '+size+'px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(label,0,1);
    ctx.restore();
}

class Panel {
    constructor() {
        this.open=false;
        this.t=0;
        this.width=1;
        this.height=1;
        this.hoverIdx=-1;
        this.buttons=[];
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    show() {
        this.open=true;
        this.t=0;
    }

    hide() {
        this.open=false;
    }

    update(dt) {
        if (this.open) {
            this.t+=dt;
        }
    }

    hover(x,y) {
        this.hoverIdx=-1;
        for (let i=0;i<this.buttons.length;i++) {
            if (inRect(this.buttons[i],x,y)) {
                this.hoverIdx=i;
            }
        }
    }

    hitButton(x,y) {
        for (let i=0;i<this.buttons.length;i++) {
            if (inRect(this.buttons[i],x,y)) {
                return i;
            }
        }
        return -1;
    }

    move() {
    }

    up() {
    }
}

export class MainMenu extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const bw=240;
        const bh=54;
        this.buttons=[];
        for (let i=0;i<3;i++) {
            this.buttons.push({x:w/2-bw/2,y:h*0.5+i*(bh+16),w:bw,h:bh});
        }
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        const i=this.hitButton(x,y);
        if (i===0) {
            this.actions.start();
        }
        else if (i===1) {
            this.actions.settings();
        }
        else if (i===2) {
            this.actions.codex();
        }
        return true;
    }

    draw(ctx) {
        if (!this.open) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.6));
        ctx.save();
        ctx.translate(w/2,h*0.27);
        ctx.scale(a,a);
        ctx.fillStyle=rgba('paper',0.8);
        ctx.fillRect(-250,-70,500,150);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 84px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('INKFALL',0,-8);
        const tw=ctx.measureText('INKFALL').width;
        drawShape(ctx,sketchLine(-tw/2,40,-tw/2+tw*Math.min(1,this.t/1.0),40,{width:3.2,seed:1301}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(tw/2-40,40,tw/2-40+40*Math.min(1,Math.max(0,this.t-0.9)/0.3),40,{width:3.2,seed:1302}),PALETTE.red,v);
        ctx.font='18px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText(t('menu.subtitle'),0,64);
        ctx.restore();
        const labels=[t('menu.start'),t('menu.settings'),t('menu.codex')];
        for (let i=0;i<3;i++) {
            drawButton(ctx,this.buttons[i],labels[i],v,(this.t-0.35-i*0.1)/0.45,this.hoverIdx===i,22);
        }
        ctx.font='13px '+FONT;
        ctx.fillStyle=rgba('ink',Math.min(1,Math.max(0,this.t-1)));
        ctx.textAlign='center';
        ctx.fillText(t('menu.hint'),w/2,h-30);
    }
}

export class PauseMenu extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const bw=240;
        const bh=52;
        this.buttons=[];
        for (let i=0;i<3;i++) {
            this.buttons.push({x:w/2-bw/2,y:h*0.4+i*(bh+14),w:bw,h:bh});
        }
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        const i=this.hitButton(x,y);
        if (i===0) {
            this.actions.resume();
        }
        else if (i===1) {
            this.actions.settings();
        }
        else if (i===2) {
            this.actions.quit();
        }
        return true;
    }

    draw(ctx) {
        if (!this.open) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        ctx.fillStyle=rgba('paper',Math.min(0.85,this.t*4));
        ctx.fillRect(0,0,w,h);
        const a=EASE.easeOutBack(Math.min(1,this.t/0.35));
        ctx.save();
        ctx.translate(w/2,h*0.28);
        ctx.scale(a,a);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 44px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('pause.title'),0,0);
        ctx.restore();
        const labels=[t('pause.resume'),t('menu.settings'),t('pause.quit')];
        for (let i=0;i<3;i++) {
            drawButton(ctx,this.buttons[i],labels[i],v,(this.t-0.08-i*0.07)/0.35,this.hoverIdx===i);
        }
    }
}

export class SettingsMenu extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.drag=null;
        this.rows=[];
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const pw=Math.min(560,w-40);
        const px=w/2-pw/2;
        const top=Math.max(110,h*0.24);
        this.panel={x:px,y:top-90,w:pw,h:6*62+190};
        this.rows=[];
        const keys=['volume','quality','shake','assist','reduced','fps'];
        for (let i=0;i<keys.length;i++) {
            const y=top+i*62;
            this.rows.push({key:keys[i],y,cx:px+pw*0.4,cw:pw*0.42});
        }
        this.back={x:w/2-90,y:top+6*62+14,w:180,h:48};
        this.buttons=[this.back];
    }

    sliderSet(row,x) {
        const v=Math.max(0,Math.min(1,(x-row.cx)/row.cw));
        if (row.key==='volume') {
            settings.volume=Math.round(v*20)/20;
        }
        else {
            settings.shake=Math.round(v*20)/20;
        }
        this.actions.changed();
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.back,x,y)) {
            this.actions.back();
            return true;
        }
        for (const r of this.rows) {
            if (Math.abs(y-r.y)>24) {
                continue;
            }
            if (r.key==='volume'||r.key==='shake') {
                if (x>=r.cx-12&&x<=r.cx+r.cw+12) {
                    this.drag=r;
                    this.sliderSet(r,x);
                }
            }
            else if (r.key==='quality') {
                const seg=r.cw/3;
                const i=Math.floor((x-r.cx)/seg);
                if (i>=0&&i<3) {
                    settings.quality=['low','mid','high'][i];
                    this.actions.changed();
                }
            }
            else if (x>=r.cx&&x<=r.cx+70) {
                if (r.key==='reduced') {
                    settings.reducedMotion=!settings.reducedMotion;
                }
                else if (r.key==='assist') {
                    settings.aimAssist=!settings.aimAssist;
                }
                else {
                    settings.showFps=!settings.showFps;
                }
                this.actions.changed();
            }
        }
        return true;
    }

    move(x) {
        if (this.drag) {
            this.sliderSet(this.drag,x);
        }
    }

    up() {
        this.drag=null;
    }

    draw(ctx) {
        if (!this.open) {
            return;
        }
        this.layout();
        const v=time.boilIndex;
        const w=this.width;
        const h=this.height;
        ctx.fillStyle=rgba('paper',Math.min(0.9,this.t*4));
        ctx.fillRect(0,0,w,h);
        const P=this.panel;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.35));
        ctx.save();
        ctx.translate(w/2,P.y+P.h/2);
        ctx.scale(a,a);
        ctx.translate(-w/2,-(P.y+P.h/2));
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:1401}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 30px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('menu.settings'),w/2,P.y+42);
        for (let i=0;i<this.rows.length;i++) {
            const r=this.rows[i];
            ctx.font='18px '+FONT;
            ctx.textAlign='left';
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(t('settings.'+r.key),P.x+28,r.y);
            if (r.key==='volume'||r.key==='shake') {
                const val=r.key==='volume'?settings.volume:settings.shake;
                drawShape(ctx,sketchLine(r.cx,r.y,r.cx+r.cw,r.y,{width:2,seed:1410+i,overshoot:1}),PALETTE.midGray,v);
                drawShape(ctx,sketchLine(r.cx,r.y,r.cx+r.cw*val,r.y,{width:4,seed:1420+i,overshoot:0}),PALETTE.ink,v);
                ctx.fillStyle=PALETTE.paper;
                ctx.beginPath();
                ctx.arc(r.cx+r.cw*val,r.y,10,0,Math.PI*2);
                ctx.fill();
                ctx.save();
                ctx.translate(r.cx+r.cw*val,r.y);
                drawShape(ctx,sketchCircle(0,0,10,{width:2,seed:1430+i}),PALETTE.ink,v);
                ctx.restore();
                ctx.fillStyle=PALETTE.nearGray;
                ctx.font='14px '+FONT;
                ctx.textAlign='left';
                ctx.fillText(Math.round(val*100)+'%',r.cx+r.cw+16,r.y);
            }
            else if (r.key==='quality') {
                const seg=r.cw/3;
                const qs=['low','mid','high'];
                for (let k=0;k<3;k++) {
                    const bx=r.cx+k*seg;
                    const on=settings.quality===qs[k];
                    if (on) {
                        ctx.fillStyle=PALETTE.ink;
                        ctx.fillRect(bx+4,r.y-16,seg-8,32);
                    }
                    drawShape(ctx,sketchRect(bx+4,r.y-16,seg-8,32,{width:1.6,seed:1440+k}),PALETTE.ink,v);
                    ctx.fillStyle=on?PALETTE.paper:PALETTE.ink;
                    ctx.font='bold 16px '+FONT;
                    ctx.textAlign='center';
                    ctx.fillText(t('quality.'+qs[k]),bx+seg/2,r.y+1);
                }
            }
            else {
                const on=r.key==='reduced'?settings.reducedMotion:(r.key==='assist'?settings.aimAssist:settings.showFps);
                ctx.fillStyle=on?PALETTE.ink:PALETTE.paper;
                ctx.fillRect(r.cx,r.y-15,64,30);
                drawShape(ctx,sketchRect(r.cx,r.y-15,64,30,{width:1.8,seed:1450+i}),PALETTE.ink,v);
                ctx.fillStyle=on?PALETTE.paper:PALETTE.ink;
                ctx.beginPath();
                ctx.arc(on?r.cx+48:r.cx+16,r.y,9,0,Math.PI*2);
                ctx.fill();
                ctx.fillStyle=PALETTE.nearGray;
                ctx.font='14px '+FONT;
                ctx.textAlign='left';
                ctx.fillText(on?t('settings.on'):t('settings.off'),r.cx+80,r.y);
            }
        }
        ctx.restore();
        drawButton(ctx,this.back,t('menu.back'),v,(this.t-0.1)/0.3,inRect(this.back,this.hx??-1,this.hy??-1));
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
    }
}

const ENEMY_LIST=['doodle','blob','compass','eraserMonster','bird','inkBottle'];

export class Codex extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.tab=0;
        this.cards=ALL_CARDS.map(id=>createCard(id));
    }

    layout() {
        const w=this.width;
        this.tabs=[{x:w/2-170,y:78,w:160,h:40},{x:w/2+10,y:78,w:160,h:40}];
        this.back={x:w/2-90,y:this.height-70,w:180,h:48};
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.back,x,y)) {
            this.actions.back();
        }
        else if (inRect(this.tabs[0],x,y)) {
            this.tab=0;
            this.t=0.3;
        }
        else if (inRect(this.tabs[1],x,y)) {
            this.tab=1;
            this.t=0.3;
        }
        return true;
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
    }

    draw(ctx,art) {
        if (!this.open) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        ctx.fillStyle=rgba('paper',Math.min(0.95,this.t*4));
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 32px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('menu.codex'),w/2,40);
        const tl=[t('codex.cards'),t('codex.enemies')];
        for (let i=0;i<2;i++) {
            const b=this.tabs[i];
            if (this.tab===i) {
                ctx.fillStyle=PALETTE.ink;
                ctx.fillRect(b.x,b.y,b.w,b.h);
            }
            drawShape(ctx,sketchRect(b.x,b.y,b.w,b.h,{width:1.8,seed:1500+i}),PALETTE.ink,v);
            ctx.fillStyle=this.tab===i?PALETTE.paper:PALETTE.ink;
            ctx.font='bold 17px '+FONT;
            ctx.fillText(tl[i],b.x+b.w/2,b.y+b.h/2+1);
        }
        const top=138;
        const avail=h-top-90;
        if (this.tab===0) {
            const cols=5;
            const rows=Math.ceil(this.cards.length/cols);
            const sc=Math.min((w-60)/(cols*CARD_W*1.08),avail/(rows*CARD_H*1.08));
            const cw=CARD_W*sc*1.08;
            const ch=CARD_H*sc*1.08;
            const x0=w/2-cols*cw/2;
            for (let i=0;i<this.cards.length;i++) {
                const p=Math.max(0,Math.min(1,(this.t-0.1-i*0.03)/0.35));
                if (p<=0) {
                    continue;
                }
                const e=EASE.easeOutBack(p);
                const cx=x0+(i%cols)*cw+cw/2;
                const cy=top+Math.floor(i/cols)*ch+ch/2;
                ctx.save();
                ctx.translate(cx,cy+(1-e)*20);
                ctx.scale(sc*e,sc*e);
                ctx.translate(-CARD_W/2,-CARD_H/2);
                ctx.drawImage(art.face(this.cards[i],v),0,0,CARD_W,CARD_H);
                drawCost(ctx,this.cards[i],false,v);
                ctx.restore();
            }
        }
        else {
            const rowH=Math.min(84,avail/ENEMY_LIST.length);
            const x=Math.max(30,w/2-340);
            for (let i=0;i<ENEMY_LIST.length;i++) {
                const p=Math.max(0,Math.min(1,(this.t-0.1-i*0.06)/0.35));
                if (p<=0) {
                    continue;
                }
                const y=top+i*rowH;
                ctx.globalAlpha=p;
                ctx.fillStyle=ENEMY_LIST[i]==='inkBottle'?PALETTE.red:PALETTE.ink;
                ctx.font='bold 20px '+FONT;
                ctx.textAlign='left';
                ctx.textBaseline='top';
                ctx.fillText(t('enemy.'+ENEMY_LIST[i]),x+(1-p)*20,y);
                ctx.fillStyle=PALETTE.nearGray;
                ctx.font='15px '+FONT;
                ctx.fillText(t('codex.'+ENEMY_LIST[i]),x+(1-p)*20,y+28);
                drawShape(ctx,sketchLine(x,y+rowH-12,x+680,y+rowH-12,{width:0.9,seed:1520+i,overshoot:0}),PALETTE.farGray,v);
                ctx.globalAlpha=1;
            }
        }
        drawButton(ctx,this.back,t('menu.back'),v,(this.t-0.1)/0.3,inRect(this.back,this.hx??-1,this.hy??-1));
    }
}

export class RunSummary {
    constructor() {
        this.open=false;
        this.t=0;
        this.width=1;
        this.height=1;
        this.button={x:0,y:0,w:0,h:0};
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    show(victory,stats,onRestart) {
        this.open=true;
        this.t=0;
        this.victory=victory;
        this.stats=stats;
        this.onRestart=onRestart;
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        const b=this.button;
        if (this.t>(this.victory?1.0:2.0)) {
            if (x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h) {
                this.open=false;
                if (this.onRestart) {
                    this.onRestart(false);
                }
            }
            const m=this.menuButton;
            if (m&&x>=m.x&&x<=m.x+m.w&&y>=m.y&&y<=m.y+m.h) {
                this.open=false;
                if (this.onRestart) {
                    this.onRestart(true);
                }
            }
        }
        return true;
    }

    update(dt) {
        if (this.open) {
            this.t+=dt;
        }
    }

    draw(ctx) {
        if (!this.open) {
            return;
        }
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        ctx.fillStyle=this.victory?rgba('paper',Math.min(0.94,this.t*2)):rgba('paper',Math.min(0.75,this.t*0.8));
        ctx.fillRect(0,0,w,h);
        const title=this.victory?t('summary.victory'):t('summary.dead');
        ctx.save();
        ctx.translate(w/2,h*0.24);
        ctx.font='bold 56px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const tw=ctx.measureText(title).width;
        const reveal=Math.min(1,this.t/1.1);
        ctx.save();
        ctx.beginPath();
        ctx.rect(-tw/2-10,-50,(tw+20)*reveal,100);
        ctx.clip();
        ctx.fillStyle=PALETTE.ink;
        const jx=Math.sin(time.boilIndex*2.1)*0.8;
        ctx.fillText(title,jx,0);
        ctx.restore();
        if (reveal<1) {
            const px=-tw/2+tw*reveal;
            ctx.fillStyle=PALETTE.ink;
            ctx.beginPath();
            ctx.moveTo(px,-6+Math.sin(this.t*40)*10);
            ctx.lineTo(px+30,-46);
            ctx.lineTo(px+36,-40);
            ctx.lineTo(px+6,0+Math.sin(this.t*40)*10);
            ctx.closePath();
            ctx.fill();
        }
        drawShape(ctx,sketchLine(-tw/2,40,-tw/2+tw*Math.max(0,Math.min(1,(this.t-0.9)/0.5)),40,{width:3.4,seed:901}),this.victory?PALETTE.ink:PALETTE.red,v);
        ctx.restore();
        const s=this.stats;
        const mm=Math.floor(s.time/60);
        const ss=Math.floor(s.time%60);
        const rows=[
            [t('summary.act'),String(s.act+(this.victory?0:1))],
            [t('summary.rooms'),String(s.rooms)],
            [t('summary.kills'),String(s.kills)],
            [t('summary.cards'),String(s.cards)],
            [t('summary.damage'),String(s.damage)],
            [t('summary.bosses'),String(s.bosses)],
            [t('summary.time'),mm+':'+(ss<10?'0':'')+ss]
        ];
        ctx.font='20px '+FONT;
        ctx.textBaseline='middle';
        const top=h*0.36;
        const d0=this.victory?0.3:1.3;
        for (let i=0;i<rows.length;i++) {
            const p=Math.max(0,Math.min(1,(this.t-d0-i*0.08)/0.35));
            if (p<=0) {
                continue;
            }
            const y=top+i*34;
            ctx.globalAlpha=p;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.textAlign='right';
            ctx.fillText(rows[i][0],w/2-20+(1-p)*-30,y);
            ctx.fillStyle=PALETTE.ink;
            ctx.textAlign='left';
            ctx.font='bold 20px '+FONT;
            ctx.fillText(rows[i][1],w/2+20+(1-p)*30,y);
            ctx.font='20px '+FONT;
            drawShape(ctx,sketchLine(w/2-160,y+16,w/2+160,y+16,{width:0.8,seed:910+i,overshoot:0}),PALETTE.farGray,v);
        }
        ctx.globalAlpha=1;
        const pr=this.progress;
        let extra=0;
        if (pr) {
            const p2=Math.max(0,Math.min(1,(this.t-d0-0.65)/0.35));
            ctx.globalAlpha=p2;
            ctx.textAlign='center';
            ctx.font='bold 18px '+FONT;
            ctx.fillStyle=PALETTE.ink;
            let line=t('summary.xp',{xp:pr.xp});
            if (pr.after>pr.before) {
                line+='　'+t('summary.levelUp',{level:pr.after});
            }
            ctx.fillText(line,w/2,top+rows.length*34+8);
            extra=26;
            if (pr.unlocked.length>0) {
                ctx.font='15px '+FONT;
                ctx.fillStyle=PALETTE.nearGray;
                ctx.fillText(t('summary.unlocked',{cards:pr.unlocked.join('、')}),w/2,top+rows.length*34+34);
                extra=52;
            }
            ctx.globalAlpha=1;
        }
        const bw=190;
        const bh=48;
        const bx=w/2-bw-10;
        const by=top+rows.length*34+30+extra;
        this.button={x:bx,y:by,w:bw,h:bh};
        this.menuButton={x:w/2+10,y:by,w:bw,h:bh};
        const ba=Math.max(0,Math.min(1,(this.t-d0-0.7)/0.3));
        ctx.globalAlpha=ba;
        drawShape(ctx,sketchRect(bx,by,bw,bh,{width:2.2,seed:920}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 20px '+FONT;
        ctx.textAlign='center';
        ctx.fillText(t('summary.restart'),bx+bw/2,by+bh/2+1);
        const m=this.menuButton;
        drawShape(ctx,sketchRect(m.x,m.y,m.w,m.h,{width:2.2,seed:921}),PALETTE.ink,v);
        ctx.fillText(t('pause.quit'),m.x+m.w/2,m.y+bh/2+1);
        ctx.globalAlpha=1;
    }
}
