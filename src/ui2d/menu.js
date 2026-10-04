import {PALETTE,rgba,SKIN_TONES,ACCENTS} from '../data/palette.js';
import {SKIN_PARTS,SKIN_PRESETS,DEFAULT_SKIN} from '../data/skins.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {hash1} from '../core/rng.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';
import {sketchRect,sketchLine,sketchCircle,drawShape} from './sketch.js';
import {settings,STICK_DEFAULTS,device} from '../core/settings.js';
import {CARDS,ALL_CARDS,UNLOCKS,unlockLevel,STARTING_DECK,unlockedCards,TUTORIAL_DECK,TUTORIAL_ULT,TUTORIAL_MERGE} from '../data/cards.js';
import {progress,xpToNext,hasSeen,effectiveLevel,godMode,trainable} from '../core/progress.js';
import {createCard,cardDesc,cardName,cardCost} from '../game/card.js';
import {ENEMIES} from '../data/enemies.js';
import {ENDLESS,TRAINING_MAPS,TRAINING,LAYOUTS,STORY_INTRO,ENEMY_ORDER,ACTS,FINAL_BOSS} from '../data/levels.js';
import {fmtInk} from './hud.js';
import {CARD_ANIMS,ENEMY_ATTACKS,WEAPON_ANIMS,TUTOR_ANIMS,drawStage} from './codexAnim.js';
import {TUTOR_STEPS,goalNeed} from '../game/tutorial.js';
import {WEAPONS,WEAPON_ORDER,weaponUnlocked,unlockedWeapons,RANDOM_WEAPON} from '../data/weapons.js';
import {VERSION} from '../data/version.js';
import {MINIGAMES} from '../data/minigames.js';
import {CARD_W,CARD_H,drawCost,wrapText,cardFacts,drawCardTooltip,cardBrief,cardChips} from './cardView.js';
import {ENEMY_ICONS} from './enemyIcons.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

function inRect(r,x,y) {
    return x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h;
}

function lerp1(a,b,f) {
    return a+(b-a)*Math.max(0,Math.min(1,f));
}

function drawToggle(ctx,r,labels,anim,v,red=false) {
    const c=red?PALETTE.red:PALETTE.ink;
    ctx.fillStyle=PALETTE.paper;
    ctx.fillRect(r.x,r.y,r.w,r.h);
    const hw=r.w/2;
    const k=EASE.easeInOutCubic(Math.max(0,Math.min(1,anim)));
    const squash=1-Math.sin(k*Math.PI)*0.12;
    ctx.fillStyle=c;
    ctx.fillRect(r.x+3+k*hw,r.y+3+(1-squash)*r.h/2,hw-6,(r.h-6)*squash);
    ctx.save();
    ctx.translate(r.x,r.y);
    drawShape(ctx,sketchRect(0,0,Math.round(r.w),Math.round(r.h),{width:1.8,seed:1990}),c,v);
    ctx.restore();
    ctx.font='bold 14px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    for (let i=0;i<2;i++) {
        const on=Math.abs(k-i)<0.5;
        ctx.fillStyle=on?PALETTE.paper:c;
        ctx.fillText(labels[i],r.x+hw*i+hw/2,r.y+r.h/2+1);
    }
}

function drawButton(ctx,b,label,v,appear,hover,size=20,danger=false) {
    if (appear<=0) {
        return;
    }
    const e=EASE.easeOutBack(Math.min(1,appear));
    ctx.save();
    ctx.globalAlpha=Math.min(1,appear*2);
    ctx.translate(b.x+b.w/2,b.y+b.h/2);
    ctx.scale(e*(hover?1.05:1),e*(hover?1.05:1));
    ctx.rotate(hover?-0.015:0);
    ctx.fillStyle=hover?(danger?rgba('red',TUNING.ui.dangerHover):rgba('farGray',0.95)):rgba('paper',0.92);
    ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
    drawShape(ctx,sketchRect(-b.w/2,-b.h/2,b.w,b.h,{width:hover?2.8:2,seed:Math.round(b.y)+label.length}),hover&&danger?PALETTE.red:PALETTE.ink,v);
    ctx.fillStyle=hover&&danger?PALETTE.darkRed:PALETTE.ink;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    fitText(ctx,label,0,1,b.w-16,size,'bold ');
    ctx.restore();
}

function fitText(ctx,text,x,y,maxW,size,weight) {
    ctx.font=weight+size+'px '+FONT;
    const w=ctx.measureText(text).width;
    if (w>maxW) {
        ctx.font=weight+Math.max(8,Math.floor(size*maxW/w))+'px '+FONT;
    }
    ctx.fillText(text,x,y);
}

function fitW(h) {
    const U=TUNING.ui.fit;
    return h<U.smallH?Math.max(U.min,h*U.ratio):9999;
}

class Panel {
    constructor() {
        this.open=false;
        this.t=0;
        this.width=1;
        this.height=1;
        this.hoverIdx=-1;
        this.buttons=[];
        this.closing=false;
        this.outFrom=0.45;
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    show() {
        this.open=true;
        this.closing=false;
        this.t=0;
    }

    hide() {
        if (!this.open) {
            return;
        }
        this.open=false;
        this.closing=true;
        this.t=Math.min(this.t,this.outFrom);
    }

    shown() {
        return this.open||this.closing;
    }

    update(dt) {
        if (this.open) {
            this.t+=dt;
        }
        else if (this.closing) {
            this.t-=dt*this.outFrom/TUNING.ui.closeTime;
            if (this.t<=0) {
                this.t=0;
                this.closing=false;
            }
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

    clearHover() {
        this.hover(TUNING.input.far,TUNING.input.far);
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

function firstSeen(id,e) {
    if (e>0.5) {
        return t('codex.first.elite');
    }
    if (id===FINAL_BOSS) {
        return t('codex.first.final');
    }
    if (ENEMIES[id].boss) {
        return t('codex.first.boss');
    }
    const g=STORY_INTRO[ENEMY_ORDER.indexOf(id)]||0;
    return t('codex.firstAt',{act:Math.floor(g/ACTS[0].rooms)+1,page:g%ACTS[0].rooms+1});
}

function drawNewTag(ctx,b) {
    const bob=Math.sin(time.real*4)*2;
    ctx.save();
    ctx.translate(b.x+b.w-6,b.y+2+bob);
    ctx.rotate(0.12);
    ctx.fillStyle=PALETTE.red;
    ctx.fillRect(-24,-11,48,22);
    ctx.fillStyle=PALETTE.paper;
    ctx.font='bold 12px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(t('tut.new'),0,1);
    ctx.restore();
}

export function starterCount(id) {
    return STARTING_DECK.filter(q=>q===id).length;
}

function drawStarterTag(ctx,id,x,y,px,v) {
    const n=starterCount(id);
    if (n===0) {
        return;
    }
    ctx.save();
    ctx.font='bold '+px+'px '+FONT;
    ctx.textAlign='left';
    ctx.textBaseline='top';
    const label=t('codex.starter',{n});
    const w=ctx.measureText(label).width+14;
    const h=px+8;
    ctx.fillStyle=rgba('red',0.1);
    ctx.fillRect(x,y-3,w,h);
    drawShape(ctx,sketchRect(x,y-3,w,h,{width:1.3,seed:970+id.length}),PALETTE.red,v);
    ctx.fillStyle=PALETTE.red;
    ctx.fillText(label,x+7,y+1);
    ctx.restore();
}

const MENU_ACTS=['start','endless','weapon','training','codex'];

const MENU_SUBS=[0,1,2];

const MENU_EXTRA=['settings','skin'];

const MAX_LEVEL=TUNING.levels.max;

export class MainMenu extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=1.3;
    }

    column() {
        const w=this.width;
        const M=TUNING.menu;
        const cw=Math.min(M.colMax,w*M.colFrac-M.colPad*2);
        return {cx:w*(1-M.colFrac/2),cw};
    }

    layout() {
        const h=this.height;
        const small=h<600;
        const {cx,cw}=this.column();
        const M=TUNING.menu;
        this.buttons=[];
        const bw=Math.min(small?220:260,cw);
        const top=small?h*0.3:h*0.3;
        const subH=small?M.bestGapSmall:M.bestGap;
        const avail=(small?h-top-14:h-top-120)-subH*MENU_SUBS.length;
        const gap=small?6:10;
        const bh=Math.min(small?40:52,avail/MENU_ACTS.length-gap);
        let y=top;
        this.subY=[];
        for (let i=0;i<MENU_ACTS.length;i++) {
            this.buttons.push({x:cx-bw/2,y,w:bw,h:bh});
            y+=bh+gap;
            if (MENU_SUBS.includes(i)) {
                this.subY[i]=y+subH/2-gap/2;
                y+=subH;
            }
        }
        const w=this.width;
        const bar={x:small?M.barXSmall:M.barX,y:small?M.barYSmall:M.barY,w:small?M.barWSmall:M.barW,h:small?M.barHSmall:M.barH};
        this.bar=bar;
        this.settingsBtn={x:bar.x,y:bar.y,w:bar.h*M.gearW,h:bar.h};
        this.levelRect={x:bar.x+this.settingsBtn.w,y:bar.y,w:bar.w-this.settingsBtn.w,h:bar.h};
        const kw=small?168:210;
        const lx=w*(1-M.colFrac)/2;
        this.skinBtn={x:lx-kw/2,y:h*(small?M.skinYSmall:M.skinY),w:kw,h:small?40:52};
        this.buttons.push(this.settingsBtn,this.skinBtn);
    }

    hover(x,y) {
        super.hover(x,y);
        this.levelHover=!!this.levelRect&&inRect(this.levelRect,x,y);
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.levelRect,x,y)) {
            this.actions.levels();
            return true;
        }
        const i=this.hitButton(x,y);
        if (i>=0) {
            this.actions[MENU_ACTS.concat(MENU_EXTRA)[i]]();
        }
        return true;
    }

    drawBar(ctx,v) {
        const B=this.bar;
        const g=this.settingsBtn;
        const L=this.levelRect;
        const hv=this.hoverIdx===MENU_ACTS.length;
        const ap=Math.max(0,Math.min(1,(this.t-0.5)/0.4));
        if (ap<=0) {
            return;
        }
        const e=EASE.easeOutBack(ap);
        ctx.save();
        ctx.globalAlpha=Math.min(1,ap*2);
        ctx.translate(B.x,B.y+B.h/2);
        ctx.scale(1,e);
        ctx.translate(-B.x,-(B.y+B.h/2));
        ctx.fillStyle=rgba('paper',0.92);
        ctx.fillRect(B.x,B.y,B.w,B.h);
        if (hv) {
            ctx.fillStyle=rgba('farGray',0.9);
            ctx.fillRect(g.x,g.y,g.w,g.h);
        }
        if (this.levelHover) {
            ctx.fillStyle=rgba('farGray',0.9);
            ctx.fillRect(L.x,L.y,L.w,L.h);
        }
        drawShape(ctx,sketchRect(B.x,B.y,B.w,B.h,{width:1.8,seed:1380}),PALETTE.ink,v);
        const r=B.h*0.26;
        this.gearA=(this.gearA||0)+(hv?0.06:0.004);
        ctx.save();
        ctx.translate(g.x+g.w/2,g.y+g.h/2);
        ctx.rotate(this.gearA);
        ctx.fillStyle=hv?PALETTE.red:PALETTE.ink;
        for (let i=0;i<8;i++) {
            ctx.save();
            ctx.rotate(i*Math.PI/4);
            ctx.fillRect(-r*0.2,-r*1.35,r*0.4,r*0.5);
            ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(0,0,r,0,Math.PI*2);
        ctx.fill();
        ctx.fillStyle=hv?rgba('farGray',1):PALETTE.paper;
        ctx.beginPath();
        ctx.arc(0,0,r*0.45,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
        if (!settings.tutorialSeen) {
            ctx.fillStyle=PALETTE.red;
            ctx.beginPath();
            ctx.arc(g.x+g.w-7,g.y+7,4+Math.sin(time.real*5),0,Math.PI*2);
            ctx.fill();
        }
        drawShape(ctx,sketchLine(L.x,B.y+B.h*0.2,L.x,B.y+B.h*0.8,{width:1.2,seed:1381}),rgba('midGray',0.6),v);
        const pad=B.h*0.3;
        const small=B.h<46;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?14:17)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        const label=t('menu.level',{level:progress.level});
        ctx.fillText(label,L.x+pad,B.y+B.h*0.36);
        if (godMode()) {
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold '+(small?10:12)+'px '+FONT;
            ctx.fillText(t('menu.god'),L.x+pad+ctx.measureText(label).width*1.25+8,B.y+B.h*0.36);
        }
        const need=xpToNext(progress.level);
        const max=progress.level>=MAX_LEVEL;
        const f=max?1:Math.min(1,progress.xp/need);
        ctx.font=(small?'10px ':'12px ')+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='right';
        ctx.fillText(max?t('menu.xpMax'):progress.xp+' / '+need,L.x+L.w-pad,B.y+B.h*0.36);
        const by=B.y+B.h*0.64;
        const bh=small?6:8;
        const bx=L.x+pad;
        const bw=(L.w-pad*2)*TUNING.menu.xpFrac;
        ctx.fillStyle=rgba('farGray',0.8);
        ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(bx,by,bw*f*Math.min(1,ap*1.5),bh);
        drawShape(ctx,sketchRect(bx,by,bw,bh,{width:1,seed:1361}),PALETTE.ink,v);
        ctx.restore();
    }

    drawBest(ctx) {
        const a=Math.max(0,Math.min(1,(this.t-0.6)/0.4));
        if (a<=0) {
            return;
        }
        const {cx}=this.column();
        const small=this.height<600;
        ctx.save();
        ctx.globalAlpha=a;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font=(small?'11px ':'13px ')+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const wid=settings.weapon||'pen';
        const lines=[t('menu.bestStory',{score:progress.bestStory||0}),t('menu.best',{score:progress.bestScore||0}),t('menu.equipped',{name:t('weapon.'+wid+'.name')})];
        for (const i of MENU_SUBS) {
            ctx.fillStyle=i===2?PALETTE.ink:PALETTE.nearGray;
            ctx.fillText(lines[i],cx,this.subY[i]);
        }
        ctx.restore();
    }

    drawSkinBtn(ctx,v) {
        const b=this.skinBtn;
        const hv=this.hoverIdx===MENU_ACTS.length+1;
        const ap=Math.max(0,Math.min(1,(this.t-0.7)/0.4));
        if (ap<=0) {
            return;
        }
        const e=EASE.easeOutBack(ap);
        const bob=Math.sin(time.real*2)*2;
        const cx=b.x+b.w/2;
        ctx.save();
        ctx.globalAlpha=Math.min(1,ap*2);
        ctx.strokeStyle=rgba('ink',0.35);
        ctx.lineWidth=1.5;
        ctx.setLineDash([4,5]);
        ctx.beginPath();
        ctx.moveTo(cx,b.y-6);
        ctx.lineTo(cx,b.y-26+bob);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(cx,b.y-30+bob);
        ctx.lineTo(cx-6,b.y-20+bob);
        ctx.lineTo(cx+6,b.y-20+bob);
        ctx.closePath();
        ctx.fill();
        ctx.translate(cx,b.y+b.h/2+bob);
        ctx.scale(e*(hv?1.06:1),e*(hv?1.06:1));
        ctx.rotate(hv?-0.02:0.01);
        ctx.translate(-b.w/2,-b.h/2);
        ctx.fillStyle=hv?rgba('farGray',0.95):rgba('paper',0.94);
        ctx.fillRect(0,0,b.w,b.h);
        drawShape(ctx,sketchRect(0,0,b.w,b.h,{width:hv?2.8:2,seed:1390}),PALETTE.ink,v);
        const px=b.h*0.55;
        const py=b.h/2;
        const pr=b.h*0.28;
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.ellipse(px,py,pr*1.15,pr,-0.3,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=2;
        ctx.stroke();
        const cols=[PALETTE.red,'#5E7399','#C49A52','#7A8A5B'];
        for (let i=0;i<4;i++) {
            const an=-2.4+i*0.9+(hv?Math.sin(time.real*6+i)*0.1:0);
            ctx.fillStyle=cols[i];
            ctx.beginPath();
            ctx.arc(px+Math.cos(an)*pr*0.6,py+Math.sin(an)*pr*0.55,pr*0.2,0,Math.PI*2);
            ctx.fill();
        }
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(b.h<46?16:20)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('menu.skin'),b.h*0.55+pr+(b.w-b.h*0.55-pr)/2,b.h/2+1);
        ctx.restore();
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const {cx,cw}=this.column();
        const M=TUNING.menu;
        const pa=EASE.easeOutCubic(Math.min(1,this.t/0.5));
        const px0=w*(1-M.colFrac)+(1-pa)*w*M.colFrac;
        ctx.save();
        const g=ctx.createLinearGradient(px0-60,0,px0+40,0);
        g.addColorStop(0,rgba('paper',0));
        g.addColorStop(1,rgba('paper',0.86));
        ctx.fillStyle=g;
        ctx.fillRect(px0-60,0,w-px0+60,h);
        const D=TUNING.menu.divider;
        const tt=time.real;
        const draw=Math.min(1,this.t/D.drawIn);
        const n=32;
        const edge=[];
        for (let i=0;i<=n;i++) {
            const f=i/n;
            const wave=Math.sin(f*D.freq+tt*D.speed)*D.amp+Math.sin(f*D.freq*2.3-tt*D.speed*0.7)*D.amp*0.45;
            edge.push([px0+10+wave+(hash1(i*7+time.boilIndex*31)-0.5)*D.jitter,f*h*draw]);
        }
        for (const [wd,al,off] of [[2.4,0.6,0],[1,0.3,5]]) {
            ctx.strokeStyle=rgba('ink',al);
            ctx.lineWidth=wd;
            ctx.beginPath();
            ctx.moveTo(edge[0][0]+off,edge[0][1]);
            for (const q of edge) {
                ctx.lineTo(q[0]+off,q[1]);
            }
            ctx.stroke();
        }
        for (let d=0;d<D.drops;d++) {
            const q=((tt*D.dropSpeed+d/D.drops)%1);
            const idx=Math.min(n,Math.floor(q*n));
            const p=edge[idx];
            if (!p||q*h>h*draw) {
                continue;
            }
            const r=D.dropSize*(0.6+0.4*Math.sin(q*Math.PI));
            ctx.fillStyle=d===0?PALETTE.red:PALETTE.ink;
            ctx.beginPath();
            ctx.moveTo(p[0],p[1]-r*2.2);
            ctx.quadraticCurveTo(p[0]+r,p[1]-r*0.3,p[0],p[1]+r);
            ctx.quadraticCurveTo(p[0]-r,p[1]-r*0.3,p[0],p[1]-r*2.2);
            ctx.fill();
        }
        ctx.restore();
        const small=h<600;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.6))*Math.min(small?0.62:1,cw/520);
        ctx.save();
        ctx.translate(cx,small?h*0.14:h*0.15);
        ctx.scale(a,a);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 84px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('game.title'),0,-8);
        const tw=ctx.measureText(t('game.title')).width;
        drawShape(ctx,sketchLine(-tw/2,40,-tw/2+tw*Math.min(1,this.t/1.0),40,{width:3.2,seed:1301}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(tw/2-40,40,tw/2-40+40*Math.min(1,Math.max(0,this.t-0.9)/0.3),40,{width:3.2,seed:1302}),PALETTE.red,v);
        ctx.font='18px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText(t('menu.subtitle'),0,64);
        ctx.restore();
        for (let i=0;i<MENU_ACTS.length;i++) {
            drawButton(ctx,this.buttons[i],t('menu.'+MENU_ACTS[i]),v,(this.t-0.35-i*0.08)/0.45,this.hoverIdx===i,this.buttons[i].h<46?19:22);
        }
        this.drawBar(ctx,v);
        this.drawBest(ctx);
        this.drawSkinBtn(ctx,v);
        ctx.save();
        ctx.globalAlpha=Math.max(0,Math.min(1,(this.t-0.8)/0.4));
        ctx.fillStyle=PALETTE.midGray;
        ctx.font='bold '+TUNING.menu.versionSize+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='bottom';
        ctx.fillText(VERSION.stage+' '+VERSION.number,16,h-12);
        ctx.restore();
    }
}

export class PauseMenu extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
    }

    compact() {
        return this.height<TUNING.pauseUi.compactH;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        this.buttons=[];
        if (this.compact()) {
            const P=TUNING.pauseUi;
            const bw=P.colW;
            const bh=P.rowH;
            const y0=h*P.center-(bh*3+P.gap*2)/2+P.titleGap/2;
            this.buttons.push({x:w/2-bw-P.gap/2,y:y0,w:bw*2+P.gap,h:bh});
            for (let i=1;i<5;i++) {
                const c=(i-1)%2;
                const r=1+Math.floor((i-1)/2);
                this.buttons.push({x:w/2-bw-P.gap/2+c*(bw+P.gap),y:y0+r*(bh+P.gap),w:bw,h:bh});
            }
            return;
        }
        const bw=240;
        const bh=52;
        for (let i=0;i<5;i++) {
            this.buttons.push({x:w/2-bw/2,y:h*0.34+i*(bh+12),w:bw,h:bh});
        }
    }

    hintY() {
        this.layout();
        const b=this.buttons[4];
        return b.y+b.h+TUNING.pauseUi.hintGap;
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        const i=this.hitButton(x,y);
        const acts=['resume','deck','codex','settings','quit'];
        if (i>=0&&this.actions[acts[i]]) {
            this.actions[acts[i]]();
        }
        return true;
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        ctx.fillStyle=rgba('paper',Math.min(0.85,this.t*4));
        ctx.fillRect(0,0,w,h);
        const a=EASE.easeOutBack(Math.min(1,this.t/0.35));
        const cp=this.compact();
        ctx.save();
        ctx.translate(w/2,cp?this.buttons[0].y-TUNING.pauseUi.titleGap:h*0.24);
        ctx.scale(a,a);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(cp?34:44)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('pause.title'),0,0);
        ctx.restore();
        const labels=[t('pause.resume'),t(this.training?'pause.pickCard':'pause.deck'),t('menu.codex'),t('menu.settings'),t(this.training?'pause.leaveTraining':(this.tutorial?'pause.skipTutorial':'pause.quit'))];
        for (let i=0;i<5;i++) {
            drawButton(ctx,this.buttons[i],labels[i],v,(this.t-0.08-i*0.07)/0.35,this.hoverIdx===i,cp?17:20,i===4);
        }
    }
}

const SETTING_KEYS=['volume','music','sfx','quality','fps','jitter','assist','reduced','full','god'];

const SEGS={quality:{opts:['low','mid','high'],label:k=>t('quality.'+k)},fps:{opts:TUNING.loop.fpsOptions,label:k=>String(k)}};

const MUTE_KEYS=['volume','music','sfx','jitter'];

const LANGS=['zh','en'];

const TOUCH_SETTING_KEYS=['stickSize','stickX','stickY','aimRing','skillSize'];

const SLIDERS={volume:'volume',music:'musicVol',sfx:'sfxVol',jitter:'jitter',stickSize:'stickSize',stickX:'stickX',stickY:'stickY',aimRing:'aimRing',skillSize:'skillSize'};

export class SettingsMenu extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.drag=null;
        this.rows=[];
        this.anim={};
        this.pulse={};
        this.info=null;
        this.page='main';
        this.pageT=0;
    }

    keys() {
        return this.page==='touch'?TOUCH_SETTING_KEYS:SETTING_KEYS;
    }

    closePage() {
        if (this.page!=='touch') {
            return false;
        }
        this.page='main';
        this.pageT=0;
        if (this.actions.select) {
            this.actions.select();
        }
        return true;
    }

    target(key) {
        if (SLIDERS[key]) {
            return settings[SLIDERS[key]];
        }
        if (key==='quality') {
            return SEGS.quality.opts.indexOf(settings.quality);
        }
        if (key==='fps') {
            return Math.max(0,SEGS.fps.opts.indexOf(settings.fpsCap));
        }
        if (key==='reduced') {
            return settings.reducedMotion?1:0;
        }
        if (key==='assist') {
            return settings.aimAssist?1:0;
        }
        if (key==='god') {
            return settings.godMode?1:0;
        }
        return settings.fullscreen?1:0;
    }

    closeKeys() {
        if (this.pw.open) {
            this.pw.open=false;
            return true;
        }
        return this.closePage();
    }

    pwKey(k) {
        const P=this.pw;
        if (!P.open) {
            return false;
        }
        if (k==='del') {
            P.digits=P.digits.slice(0,-1);
        }
        else if (k==='ok') {
            if (P.digits===TUNING.settingsUi.devCode) {
                P.open=false;
                settings.godMode=true;
                this.bump('god');
                if (this.actions.devOn) {
                    this.actions.devOn();
                }
                return true;
            }
            P.err=1;
            P.digits='';
            if (this.actions.wrong) {
                this.actions.wrong();
            }
            return true;
        }
        else if (k==='close') {
            P.open=false;
        }
        else if (P.digits.length<TUNING.settingsUi.devCode.length) {
            P.digits+=k;
        }
        P.press=k;
        P.pressT=1;
        if (this.actions.select) {
            this.actions.select();
        }
        return true;
    }

    show() {
        super.show();
        this.langOpen=false;
        this.infoPin=null;
        this.pw={open:false,t:0,digits:'',err:0,press:null,pressT:0,hits:[]};
        this.page='main';
        this.pageT=0;
        this.lvStage=0;
        this.lvDone=0;
        for (const k of [...SETTING_KEYS,...TOUCH_SETTING_KEYS]) {
            this.anim[k]=this.target(k);
            this.pulse[k]=0;
        }
    }

    update(dt) {
        super.update(dt);
        this.pageT+=dt;
        this.lvDone=Math.max(0,(this.lvDone||0)-dt);
        this.lvPulse=Math.max(0,(this.lvPulse||0)-dt*4);
        if (this.pw) {
            const P=this.pw;
            P.t=Math.max(0,Math.min(1,P.t+(P.open?dt:-dt)/TUNING.ui.closeTime));
            P.err=Math.max(0,P.err-dt*TUNING.settingsUi.pwErrDecay);
            P.pressT=Math.max(0,P.pressT-dt*TUNING.settingsUi.pwPressDecay);
        }
        const k=1-Math.exp(-TUNING.settingsUi.follow*dt);
        this.resetFlash=Math.max(0,(this.resetFlash||0)-dt*2);
        for (const k in this.rowFlash||{}) {
            this.rowFlash[k]=Math.max(0,this.rowFlash[k]-dt*TUNING.settingsUi.resetSpin);
        }
        for (const key in this.anim) {
            this.anim[key]+=(this.target(key)-this.anim[key])*k;
            this.pulse[key]=Math.max(0,this.pulse[key]-dt*TUNING.settingsUi.pulseDecay);
        }
    }

    bump(key) {
        this.pulse[key]=1;
        this.actions.changed(key);
    }

    layout() {
        if (this.page==='touch') {
            this.layoutTouch();
            return;
        }
        const w=this.width;
        const h=this.height;
        const keys=SETTING_KEYS;
        const avail=h-190;
        const cols=w>=TUNING.settingsUi.twoColMin?2:1;
        const per=Math.ceil(keys.length/cols);
        const rh=Math.max(40,Math.min(60,avail/per));
        const colW=Math.min(TUNING.settingsUi.colMax,(w-40)/cols);
        const pw=colW*cols;
        const px=w/2-pw/2;
        const ph=per*rh+160;
        const top=Math.max(90,(h-ph)/2+90);
        this.panel={x:px,y:top-90,w:pw,h:ph};
        this.rows=[];
        for (let i=0;i<keys.length;i++) {
            const c=Math.floor(i/per);
            const x0=px+c*colW;
            this.rows.push({key:keys[i],y:top+(i%per)*rh,lx:x0+28,cx:x0+colW*0.44,cw:colW*0.38});
        }
        const by=top+per*rh+4;
        const gap=12;
        const lv=this.origin==='menu';
        const n=lv?4:2;
        const bw=Math.min(180,(pw-40-gap*(n-1))/n);
        const bx=w/2-(bw*n+gap*(n-1))/2;
        const k=lv?1:0;
        this.tutBtn=lv?{x:bx,y:by,w:bw,h:48}:null;
        this.touchBtn={x:bx+(bw+gap)*k,y:by,w:bw,h:48};
        this.lvBtn=lv?{x:bx+(bw+gap)*2,y:by,w:bw,h:48}:null;
        this.back={x:bx+(bw+gap)*(n-1),y:by,w:bw,h:48};
        this.resetBtn=null;
        this.buttons=lv?[this.back,this.touchBtn,this.tutBtn,this.lvBtn]:[this.back,this.touchBtn];
    }

    layoutTouch() {
        const w=this.width;
        const h=this.height;
        const keys=TOUCH_SETTING_KEYS;
        const small=h<600;
        const pw=Math.min(520,Math.max(380,w-TUNING.settingsUi.touchSide*2));
        const rh=small?Math.max(34,(h-180)/keys.length):52;
        const ph=keys.length*rh+(small?130:166);
        const px=w/2-pw/2;
        const py=small?8:Math.max(20,h*0.08);
        this.panel={x:px,y:py,w:pw,h:ph};
        const top=py+(small?72:98);
        this.rows=[];
        for (let i=0;i<keys.length;i++) {
            this.rows.push({key:keys[i],y:top+i*rh,lx:px+18,cx:px+pw*0.42,cw:pw*0.32,rx:px+pw-28});
        }
        const by=top+keys.length*rh-(small?10:4);
        const bw=Math.min(180,(pw-50)/2);
        const bh=small?40:48;
        this.resetBtn={x:w/2-bw-8,y:by,w:bw,h:bh};
        this.back={x:w/2+8,y:by,w:bw,h:bh};
        this.tutBtn=null;
        this.touchBtn=null;
        this.lvBtn=null;
        this.buttons=[this.back,this.resetBtn];
    }

    sliderSet(row,x) {
        const v=Math.max(0,Math.min(1,(x-row.cx)/row.cw));
        settings[SLIDERS[row.key]]=Math.round(v*20)/20;
        this.bump(row.key);
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (this.pw.open) {
            for (const q of this.pw.hits) {
                if (inRect(q,x,y)) {
                    this.pwKey(q.k);
                    return true;
                }
            }
            if (!inRect(this.pw.box||{x:0,y:0,w:0,h:0},x,y)) {
                this.pwKey('close');
            }
            return true;
        }
        if (this.langDown(x,y)) {
            return true;
        }
        const icon=(this.icons||[]).find(q=>Math.hypot(x-q.x,y-q.y)<TUNING.settingsUi.iconTap);
        const had=this.infoPin;
        this.infoPin=icon&&(!had||had.key!==icon.key)?icon:null;
        if (icon||had) {
            return true;
        }
        if (this.lvBtn&&inRect(this.lvBtn,x,y)) {
            this.lvPulse=1;
            if (this.lvStage<2) {
                this.lvStage++;
                if (this.actions.select) {
                    this.actions.select();
                }
            }
            else {
                this.lvStage=0;
                this.lvDone=TUNING.settingsUi.resetDone;
                this.actions.resetLevel();
            }
            return true;
        }
        this.lvStage=0;
        if (this.page==='touch'&&inRect(this.back,x,y)) {
            this.closePage();
            return true;
        }
        if (this.touchBtn&&inRect(this.touchBtn,x,y)) {
            this.page='touch';
            this.pageT=0;
            if (this.actions.select) {
                this.actions.select();
            }
            return true;
        }
        if (this.tutBtn&&inRect(this.tutBtn,x,y)) {
            this.actions.tutorial();
            return true;
        }
        if (inRect(this.back,x,y)) {
            this.actions.back();
            return true;
        }
        if (this.resetBtn&&inRect(this.resetBtn,x,y)) {
            for (const k in STICK_DEFAULTS) {
                settings[k]=STICK_DEFAULTS[k];
                this.bump(k);
            }
            this.resetFlash=1;
            return true;
        }
        for (const r of this.rows) {
            if (Math.abs(y-r.y)>24) {
                continue;
            }
            if (MUTE_KEYS.includes(r.key)&&Math.hypot(x-this.muteX(r),y-r.y)<=TUNING.settingsUi.muteR+6) {
                settings.mute={...settings.mute,[r.key]:!settings.mute[r.key]};
                this.bump(r.key);
                continue;
            }
            if (r.rx&&Math.hypot(x-r.rx,y-r.y)<=TUNING.settingsUi.resetR+6) {
                settings[r.key]=STICK_DEFAULTS[r.key];
                this.bump(r.key);
                this.rowFlash=this.rowFlash||{};
                this.rowFlash[r.key]=1;
                continue;
            }
            if (SLIDERS[r.key]) {
                if (x>=r.cx-12&&x<=r.cx+r.cw+12) {
                    this.drag=r;
                    this.sliderSet(r,x);
                }
            }
            else if (SEGS[r.key]) {
                const opts=SEGS[r.key].opts;
                const seg=r.cw/opts.length;
                const i=Math.floor((x-r.cx)/seg);
                if (i>=0&&i<opts.length) {
                    if (r.key==='quality') {
                        settings.quality=opts[i];
                    }
                    else {
                        settings.fpsCap=opts[i];
                        settings.fpsAuto=false;
                    }
                    this.bump(r.key);
                }
            }
            else if (x>=r.cx&&x<=r.cx+70) {
                if (r.key==='reduced') {
                    settings.reducedMotion=!settings.reducedMotion;
                }
                else if (r.key==='assist') {
                    settings.aimAssist=!settings.aimAssist;
                    settings.aimGuide=settings.aimAssist;
                }
                else if (r.key==='god') {
                    if (!settings.godMode) {
                        this.pw.open=true;
                        this.pw.digits='';
                        if (this.actions.select) {
                            this.actions.select();
                        }
                        continue;
                    }
                    settings.godMode=false;
                    if (this.actions.devOff) {
                        this.actions.devOff();
                    }
                }
                else if (r.key==='full') {
                    if (!device.fullscreen) {
                        this.pulse[r.key]=1;
                        continue;
                    }
                    settings.fullscreen=!settings.fullscreen;
                }
                this.bump(r.key);
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
        if (!this.shown()) {
            return;
        }
        this.layout();
        const v=time.boilIndex;
        const w=this.width;
        const h=this.height;
        const touch=this.page==='touch';
        ctx.fillStyle=rgba('paper',Math.min(touch?0.55:0.9,this.t*4));
        ctx.fillRect(0,0,w,h);
        const P=this.panel;
        const a=EASE.easeOutBack(Math.min(1,Math.min(this.t,this.pageT)/0.35));
        ctx.save();
        ctx.translate(w/2,P.y+P.h/2);
        ctx.scale(a,a);
        ctx.translate(-w/2,-(P.y+P.h/2));
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:touch?1402:1401}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(touch&&h<600?22:30)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(touch?t('settings.touchTitle'):t('menu.settings'),w/2,P.y+(touch&&h<600?28:42));
        if (touch) {
            ctx.font=(h<600?'11px ':'13px ')+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(t('settings.touchHint'),w/2,P.y+(h<600?48:70));
        }
        this.info=null;
        this.icons=[];
        for (let i=0;i<this.rows.length;i++) {
            const r=this.rows[i];
            const an=this.anim[r.key]??this.target(r.key);
            const pu=this.pulse[r.key]||0;
            ctx.font='18px '+FONT;
            ctx.textAlign='left';
            ctx.fillStyle=PALETTE.ink;
            const label=t('settings.'+r.key);
            const U=TUNING.settingsUi;
            const lim=(MUTE_KEYS.includes(r.key)?this.muteX(r)-U.muteR:r.cx)-r.lx-U.labelPad;
            const lw=ctx.measureText(label).width;
            if (lw>lim) {
                ctx.font=Math.max(U.labelMin,Math.floor(18*lim/lw))+'px '+FONT;
            }
            ctx.fillText(label,r.lx,r.y);
            const ix=r.lx+Math.min(lw,ctx.measureText(label).width)+16;
            const pin=this.infoPin&&this.infoPin.key===r.key;
            const over=pin||Math.hypot((this.hx??-99)-ix,(this.hy??-99)-r.y)<13;
            this.drawInfoIcon(ctx,ix,r.y,over,v);
            this.icons.push({key:r.key,x:ix,y:r.y});
            if (over) {
                this.info={key:r.key,x:ix,y:r.y};
            }
            const muted=MUTE_KEYS.includes(r.key)&&settings.mute[r.key];
            if (MUTE_KEYS.includes(r.key)) {
                this.drawMute(ctx,r,muted,pu,v);
            }
            if (SLIDERS[r.key]) {
                const val=Math.max(0,Math.min(1,an));
                ctx.save();
                if (muted) {
                    ctx.globalAlpha*=TUNING.settingsUi.mutedAlpha;
                }
                const kr=10+pu*4;
                drawShape(ctx,sketchLine(r.cx,r.y,r.cx+r.cw,r.y,{width:2,seed:1410+i,overshoot:1}),PALETTE.midGray,v);
                if (val>0.005) {
                    ctx.fillStyle=PALETTE.ink;
                    ctx.fillRect(r.cx,r.y-2,r.cw*val,4);
                }
                ctx.fillStyle=PALETTE.paper;
                ctx.beginPath();
                ctx.arc(r.cx+r.cw*val,r.y,kr,0,Math.PI*2);
                ctx.fill();
                ctx.save();
                ctx.translate(r.cx+r.cw*val,r.y);
                ctx.scale(kr/10,kr/10);
                drawShape(ctx,sketchCircle(0,0,10,{width:2,seed:1430+i}),PALETTE.ink,v);
                ctx.restore();
                ctx.restore();
                ctx.fillStyle=muted?PALETTE.red:PALETTE.nearGray;
                ctx.font=(pu>0.3?'bold ':'')+'14px '+FONT;
                ctx.textAlign='left';
                ctx.fillText(muted?t(r.key==='jitter'?'settings.jitterOff':'settings.muted'):Math.round(this.target(r.key)*100)+'%',r.cx+r.cw+(r.rx?12:16),r.y);
                if (r.rx) {
                    this.drawRowReset(ctx,r,i,v);
                }
            }
            else if (SEGS[r.key]) {
                const qs=SEGS[r.key].opts;
                const seg=r.cw/qs.length;
                const cur=this.target(r.key);
                const sq=1+pu*0.08;
                ctx.save();
                ctx.translate(r.cx+an*seg+seg/2,r.y);
                ctx.scale(sq,sq);
                ctx.fillStyle=PALETTE.ink;
                ctx.fillRect(-seg/2+4,-16,seg-8,32);
                ctx.restore();
                for (let k=0;k<qs.length;k++) {
                    const bx=r.cx+k*seg;
                    drawShape(ctx,sketchRect(bx+4,r.y-16,seg-8,32,{width:1.6,seed:1440+k}),PALETTE.ink,v);
                    const cover=Math.max(0,1-Math.abs(an-k));
                    ctx.fillStyle=cover>0.5?PALETTE.paper:PALETTE.ink;
                    ctx.font=(k===cur?'bold ':'')+'16px '+FONT;
                    ctx.textAlign='center';
                    ctx.fillText(SEGS[r.key].label(qs[k]),bx+seg/2,r.y+1);
                }
            }
            else {
                const on=this.target(r.key)>0.5;
                const f=Math.max(0,Math.min(1,an));
                const off=r.key==='full'&&!device.fullscreen;
                ctx.save();
                if (off) {
                    ctx.globalAlpha*=0.4;
                }
                ctx.fillStyle=PALETTE.paper;
                ctx.fillRect(r.cx,r.y-15,64,30);
                ctx.fillStyle=rgba('ink',f);
                ctx.fillRect(r.cx,r.y-15,64,30);
                drawShape(ctx,sketchRect(r.cx,r.y-15,64,30,{width:1.8,seed:1450+i}),PALETTE.ink,v);
                const kx=r.cx+16+32*f;
                const squash=1+Math.sin(f*Math.PI)*0.35;
                ctx.fillStyle=f>0.5?PALETTE.paper:PALETTE.ink;
                ctx.beginPath();
                ctx.ellipse(kx,r.y,9*squash,9/squash,0,0,Math.PI*2);
                ctx.fill();
                ctx.restore();
                ctx.fillStyle=off?PALETTE.red:PALETTE.nearGray;
                ctx.font=(pu>0.3?'bold ':'')+'14px '+FONT;
                ctx.textAlign='left';
                ctx.fillText(off?t('settings.unsupported'):(on?t('settings.on'):t('settings.off')),r.cx+80,r.y);
            }
        }
        ctx.restore();
        const bt=Math.min(this.t,this.pageT);
        ctx.save();
        drawButton(ctx,this.back,t('menu.back'),v,(bt-0.1)/0.3,inRect(this.back,this.hx??-1,this.hy??-1));
        if (this.resetBtn) {
            drawButton(ctx,this.resetBtn,t('settings.resetSticks'),v,(bt-0.15)/0.3,inRect(this.resetBtn,this.hx??-1,this.hy??-1)||this.resetFlash>0,16);
        }
        if (this.tutBtn) {
            drawButton(ctx,this.tutBtn,t('menu.tutorial'),v,(bt-0.2)/0.3,inRect(this.tutBtn,this.hx??-1,this.hy??-1),16);
            if (!settings.tutorialSeen&&bt>0.5) {
                drawNewTag(ctx,this.tutBtn);
            }
        }
        if (this.touchBtn) {
            drawButton(ctx,this.touchBtn,t('settings.touch'),v,(bt-0.15)/0.3,inRect(this.touchBtn,this.hx??-1,this.hy??-1),16);
        }
        if (this.lvBtn) {
            const lb=this.lvBtn;
            const label=this.lvDone>0?t('settings.resetDone'):t(['settings.resetLevel','settings.resetConfirm','settings.resetAgain'][this.lvStage]);
            const p=this.lvPulse||0;
            const shake=this.lvStage===2?Math.sin(time.real*30)*1.5:0;
            ctx.save();
            ctx.translate(lb.x+lb.w/2+shake,lb.y+lb.h/2);
            ctx.scale(1-Math.sin(p*Math.PI)*0.08,1-Math.sin(p*Math.PI)*0.08);
            ctx.translate(-(lb.x+lb.w/2),-(lb.y+lb.h/2));
            drawButton(ctx,lb,label,v,(bt-0.25)/0.3,this.lvStage>0||inRect(lb,this.hx??-1,this.hy??-1),this.lvStage>0?14:16,true);
            ctx.restore();
        }
        ctx.restore();
        if (!touch) {
            this.drawLang(ctx,v);
        }
        if (this.info&&this.t>0.35&&!this.pw.open) {
            this.drawInfo(ctx,this.info,v);
        }
        if (this.pw.t>0) {
            this.drawPw(ctx,v);
        }
    }

    langBox() {
        const P=this.panel;
        const L=TUNING.settingsUi.lang;
        const w=Math.min(L.w,P.w*0.4);
        return {x:P.x+P.w-w-L.pad,y:P.y+L.pad,w,h:L.h};
    }

    drawLang(ctx,v) {
        const L=TUNING.settingsUi.lang;
        const b=this.langBox();
        const a=Math.min(1,this.t*4);
        ctx.save();
        ctx.globalAlpha*=a;
        const hv=inRect(b,this.hx??-1,this.hy??-1);
        ctx.fillStyle=hv||this.langOpen?rgba('farGray',0.95):PALETTE.paper;
        ctx.fillRect(b.x,b.y,b.w,b.h);
        drawShape(ctx,sketchRect(b.x,b.y,b.w,b.h,{width:1.8,seed:1490}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 14px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t('settings.lang')+t('ui.colon')+t('lang.'+settings.lang),b.x+10,b.y+b.h/2+1,b.w-34);
        ctx.textAlign='right';
        ctx.fillText(this.langOpen?'▲':'▼',b.x+b.w-10,b.y+b.h/2+1);
        this.langHits=[];
        if (this.langOpen) {
            LANGS.forEach((k,i)=>{
                const r={x:b.x,y:b.y+b.h+i*L.item,w:b.w,h:L.item};
                const on=settings.lang===k;
                const h2=inRect(r,this.hx??-1,this.hy??-1);
                ctx.fillStyle=on?PALETTE.ink:(h2?rgba('farGray',0.95):PALETTE.paper);
                ctx.fillRect(r.x,r.y,r.w,r.h);
                ctx.strokeStyle=PALETTE.ink;
                ctx.lineWidth=1.5;
                ctx.strokeRect(r.x,r.y,r.w,r.h);
                ctx.fillStyle=on?PALETTE.paper:PALETTE.ink;
                ctx.textAlign='left';
                ctx.fillText(t('lang.'+k),r.x+12,r.y+r.h/2+1);
                this.langHits.push({...r,k});
            });
        }
        ctx.restore();
    }

    langDown(x,y) {
        if (this.page==='touch') {
            return false;
        }
        if (this.langOpen) {
            const hit=(this.langHits||[]).find(r=>inRect(r,x,y));
            this.langOpen=false;
            if (hit&&hit.k!==settings.lang) {
                settings.lang=hit.k;
                this.actions.changed('lang');
            }
            if (this.actions.select) {
                this.actions.select();
            }
            return true;
        }
        if (inRect(this.langBox(),x,y)) {
            this.langOpen=true;
            if (this.actions.select) {
                this.actions.select();
            }
            return true;
        }
        return false;
    }

    drawPw(ctx,v) {
        const P=this.pw;
        const w=this.width;
        const h=this.height;
        const k=EASE.easeOutCubic(P.t);
        const small=h<600;
        const kh=small?40:52;
        const kw=small?64:80;
        const gap=small?6:10;
        const bw=kw*3+gap*2+40;
        const bh=(small?92:118)+kh*4+gap*3+20;
        const bx=w/2-bw/2;
        const by=h/2-bh/2+(1-k)*30;
        const shake=Math.sin(P.err*30)*10*P.err;
        P.box={x:bx,y:by,w:bw,h:bh};
        P.hits=[];
        ctx.save();
        ctx.globalAlpha=k;
        ctx.fillStyle=rgba('ink',0.3);
        ctx.fillRect(0,0,w,h);
        ctx.translate(shake,0);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(bx,by,bw,bh);
        drawShape(ctx,sketchRect(bx,by,bw,bh,{width:2.2,seed:1497}),P.err>0?PALETTE.red:PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?17:21)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('dev.title'),w/2,by+(small?22:30));
        ctx.font=(small?'11px ':'13px ')+FONT;
        ctx.fillStyle=P.err>0?PALETTE.red:PALETTE.nearGray;
        ctx.fillText(t(P.err>0?'dev.wrong':'dev.hint'),w/2,by+(small?42:56));
        const n=TUNING.settingsUi.devCode.length;
        const dw=small?20:24;
        const dy=by+(small?68:88);
        for (let i=0;i<n;i++) {
            const x=w/2+(i-(n-1)/2)*(dw+6);
            drawShape(ctx,sketchLine(x-dw/2,dy+10,x+dw/2,dy+10,{width:1.6,seed:1500+i}),PALETTE.ink,v);
            if (i<P.digits.length) {
                ctx.fillStyle=PALETTE.ink;
                ctx.beginPath();
                ctx.arc(x,dy,dw*0.22,0,Math.PI*2);
                ctx.fill();
            }
        }
        const keys=['1','2','3','4','5','6','7','8','9','del','0','ok'];
        const ky=dy+(small?24:30);
        keys.forEach((q,i)=>{
            const r={x:w/2-(kw*3+gap*2)/2+(i%3)*(kw+gap),y:ky+Math.floor(i/3)*(kh+gap),w:kw,h:kh};
            const pr=P.press===q?P.pressT:0;
            ctx.save();
            ctx.translate(r.x+r.w/2,r.y+r.h/2);
            ctx.scale(1-pr*0.08,1-pr*0.08);
            ctx.fillStyle=pr>0.5?PALETTE.ink:(q==='ok'?rgba('red',0.12):PALETTE.paper);
            ctx.fillRect(-r.w/2,-r.h/2,r.w,r.h);
            drawShape(ctx,sketchRect(-r.w/2,-r.h/2,r.w,r.h,{width:1.6,seed:1510+i}),q==='ok'?PALETTE.red:PALETTE.ink,v);
            ctx.fillStyle=pr>0.5?PALETTE.paper:(q==='ok'?PALETTE.red:PALETTE.ink);
            ctx.font='bold '+(q.length>1?(small?14:16):(small?20:24))+'px '+FONT;
            ctx.fillText(q.length>1?t('dev.'+q):q,0,1);
            ctx.restore();
            P.hits.push({...r,k:q});
        });
        ctx.restore();
    }

    drawRowReset(ctx,r,i,v) {
        const R=TUNING.settingsUi.resetR;
        const over=Math.hypot((this.hx??-99)-r.rx,(this.hy??-99)-r.y)<R+4;
        const fl=(this.rowFlash&&this.rowFlash[r.key])||0;
        const off=Math.abs(settings[r.key]-STICK_DEFAULTS[r.key])>0.001;
        ctx.save();
        ctx.translate(r.rx,r.y);
        ctx.rotate(-fl*Math.PI*2);
        ctx.globalAlpha=off||fl>0?1:0.35;
        ctx.fillStyle=over?PALETTE.ink:PALETTE.paper;
        ctx.beginPath();
        ctx.arc(0,0,R,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(0,0,R,{width:1.6,seed:1490+i}),PALETTE.ink,v);
        ctx.strokeStyle=over?PALETTE.paper:PALETTE.ink;
        ctx.fillStyle=ctx.strokeStyle;
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(0,0,R*0.5,-Math.PI*0.2,Math.PI*1.35);
        ctx.stroke();
        const ax=Math.cos(-Math.PI*0.2)*R*0.5;
        const ay=Math.sin(-Math.PI*0.2)*R*0.5;
        ctx.beginPath();
        ctx.moveTo(ax+4,ay-1);
        ctx.lineTo(ax-1,ay-5);
        ctx.lineTo(ax-2,ay+2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    muteX(r) {
        return r.cx-TUNING.settingsUi.muteGap;
    }

    drawMute(ctx,r,muted,pu,v) {
        const R=TUNING.settingsUi.muteR;
        const x=this.muteX(r);
        const over=Math.hypot((this.hx??-99)-x,(this.hy??-99)-r.y)<R+4;
        const s=1+Math.sin(pu*Math.PI)*0.2;
        ctx.save();
        ctx.translate(x,r.y);
        ctx.scale(s,s);
        ctx.fillStyle=over?PALETTE.ink:PALETTE.paper;
        ctx.beginPath();
        ctx.arc(0,0,R,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(0,0,R,{width:1.6,seed:1495}),muted?PALETTE.red:PALETTE.ink,v);
        const col=over?PALETTE.paper:(muted?PALETTE.red:PALETTE.ink);
        ctx.fillStyle=col;
        ctx.strokeStyle=col;
        ctx.lineWidth=2;
        ctx.lineCap='round';
        const u=R/10;
        if (r.key!=='jitter') {
            ctx.beginPath();
            ctx.moveTo(-6*u,-2.5*u);
            ctx.lineTo(-3*u,-2.5*u);
            ctx.lineTo(1*u,-6*u);
            ctx.lineTo(1*u,6*u);
            ctx.lineTo(-3*u,2.5*u);
            ctx.lineTo(-6*u,2.5*u);
            ctx.closePath();
            ctx.fill();
        }
        ctx.beginPath();
        if (r.key==='jitter') {
            ctx.moveTo(-7*u,0);
            for (let i=1;i<=8;i++) {
                ctx.lineTo(-7*u+i*1.75*u,(muted?0:(i%2?-3:3))*u);
            }
            if (muted) {
                ctx.moveTo(-6*u,-6*u);
                ctx.lineTo(6*u,6*u);
            }
            ctx.stroke();
            ctx.restore();
            return;
        }
        if (muted) {
            ctx.moveTo(3.5*u,-3*u);
            ctx.lineTo(8*u,3*u);
            ctx.moveTo(8*u,-3*u);
            ctx.lineTo(3.5*u,3*u);
        }
        else {
            ctx.arc(2*u,0,4*u,-0.9,0.9);
            ctx.moveTo(2*u+Math.cos(-0.9)*7*u,Math.sin(-0.9)*7*u);
            ctx.arc(2*u,0,7*u,-0.9,0.9);
        }
        ctx.stroke();
        ctx.restore();
    }

    drawInfoIcon(ctx,x,y,over,v) {
        ctx.save();
        ctx.translate(x,y);
        ctx.fillStyle=over?PALETTE.ink:PALETTE.paper;
        ctx.beginPath();
        ctx.arc(0,0,10,0,Math.PI*2);
        ctx.fill();
        drawShape(ctx,sketchCircle(0,0,10,{width:1.6,seed:1470}),PALETTE.ink,v);
        ctx.fillStyle=over?PALETTE.paper:PALETTE.ink;
        ctx.font='bold italic 14px Georgia,serif';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('i',0,1);
        ctx.restore();
    }

    drawInfo(ctx,info,v) {
        const maxW=300;
        const pad=14;
        ctx.save();
        ctx.font='14px '+FONT;
        const lines=wrapText(ctx,t('settingsInfo.'+info.key),maxW-pad*2);
        const h=pad*2+lines.length*20;
        const bx=Math.max(8,Math.min(this.width-maxW-8,info.x+18));
        const by=Math.max(8,Math.min(this.height-h-8,info.y-h/2));
        ctx.fillStyle=rgba('paper',0.98);
        ctx.fillRect(bx,by,maxW,h);
        drawShape(ctx,sketchRect(bx,by,maxW,h,{width:1.8,seed:1471}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        for (let i=0;i<lines.length;i++) {
            ctx.fillText(lines[i],bx+pad,by+pad+i*20);
        }
        ctx.restore();
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
    }
}

const FOE_LIST=['doodle','blob','sprayer','stampSoldier','inkCloud','bird','scissorMinion','compass','eraserMonster'];

const BOSS_LIST=['inkBottle','scissors','book','exam','bookFinal'];

export class Codex extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.tab=0;
        const all=ALL_CARDS.map(id=>createCard(id));
        this.lists=[all.filter(c=>c.def.rarity!=='rare'),all.filter(c=>c.def.rarity==='rare')];
        this.upList=this.lists[0].map(c=>createCard(c.id,true));
        this.showUp=false;
        this.upAnim=0;
        this.showElite=false;
        this.eliteAnim=0;
        this.eliteToggle=null;
        this.tabAnim=0;
        this.upToggle=null;
        this.dToggle=null;
        this.scroll=0;
        this.scrollTo=0;
        this.contentH=0;
        this.drag=null;
        this.hits=[];
        this.detail=null;
        this.animT=0;
        this.dScroll=0;
        this.dScrollTo=0;
        this.dContentH=0;
        this.costFilter=[null,null];
        this.filterHits=[];
    }

    show() {
        super.show();
        this.scroll=0;
        this.scrollTo=0;
        this.drag=null;
        this.detail=null;
    }

    isCompact() {
        return device.mobile||this.height<TUNING.codex.compactH;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const C=TUNING.codex;
        const cmp=this.isCompact();
        this.compact=cmp;
        const left=cmp?C.titleW:0;
        const tw=Math.min(130,(w-240-left)/4);
        const ty=cmp?C.compactTop:70;
        const th=cmp?36:40;
        const tx0=cmp?left+20:w/2-(tw*4+36)/2;
        this.tabs=[0,1,2,3].map(i=>({x:tx0+i*(tw+12),y:ty,w:tw,h:th}));
        this.back={x:w/2-90,y:h-(cmp?56:66),w:180,h:cmp?42:48};
        const fy=ty+th+(cmp?8:10);
        this.filterY=fy;
        const vy=fy+(this.tab<2?C.filterH+6:0);
        this.view={x:0,y:vy,w:w,h:Math.max(80,this.back.y-vy-(cmp?12:18))};
        const pw=Math.min(1040,w-32);
        const ph=this.detail&&this.detail.kind==='card'?Math.min(h-40,TUNING.codex.cardPanelH):h-40;
        const py=(h-ph)/2;
        this.dPanel={x:(w-pw)/2,y:py,w:pw,h:ph};
        this.dClose={x:w/2-80,y:py+ph-60,w:160,h:44};
        this.dView={x:this.dPanel.x+10,y:py+10,w:pw-20,h:ph-84};
    }

    maxScroll() {
        return Math.max(0,this.contentH-this.view.h);
    }

    clampScroll() {
        this.scrollTo=Math.max(0,Math.min(this.maxScroll(),this.scrollTo));
        this.dScrollTo=Math.max(0,Math.min(Math.max(0,this.dContentH-this.dView.h),this.dScrollTo));
    }

    wheel(dy) {
        if (!this.open) {
            return;
        }
        if (this.detailOpen()) {
            this.dScrollTo+=dy;
        }
        else {
            this.scrollTo+=dy;
        }
        this.clampScroll();
    }

    filtered(list) {
        const f=this.costFilter[this.tab];
        const out=[];
        list.forEach((c,i)=>{
            if (f===null||cardCost(c)===f) {
                out.push(i);
            }
        });
        return out;
    }

    drawFilter(ctx,v) {
        this.filterHits=[];
        if (this.tab>1) {
            return;
        }
        const C=TUNING.codex;
        const list=this.lists[this.tab];
        const costs=[...new Set(list.map(c=>cardCost(c)))].sort((a,b)=>a-b);
        const opts=[null,...costs];
        const cur=this.costFilter[this.tab];
        const y=this.filterY;
        ctx.save();
        ctx.font='bold 13px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillStyle=PALETTE.nearGray;
        const label=t('codex.filter');
        let x=this.tabs[0].x;
        ctx.fillText(label,x,y+C.filterH/2);
        x+=ctx.measureText(label).width+10;
        for (const o of opts) {
            const txt=o===null?t('codex.filterAll'):t('codex.filterCost',{n:o});
            const cw=Math.max(C.filterH*1.2,ctx.measureText(txt).width+20);
            const r={x,y,w:cw,h:C.filterH};
            const on=o===cur;
            ctx.fillStyle=on?(this.tab===1?PALETTE.red:PALETTE.ink):rgba('paper',0.9);
            ctx.fillRect(r.x,r.y,r.w,r.h);
            drawShape(ctx,sketchRect(r.x,r.y,r.w,r.h,{width:1.3,seed:1890+(o??9)}),this.tab===1?PALETTE.red:PALETTE.ink,v);
            ctx.fillStyle=on?PALETTE.paper:PALETTE.ink;
            ctx.textAlign='center';
            ctx.fillText(txt,r.x+r.w/2,r.y+r.h/2+1);
            ctx.textAlign='left';
            this.filterHits.push({...r,cost:o});
            x+=cw+8;
        }
        ctx.restore();
    }

    setTab(i) {
        if (i!==this.tab&&this.actions.select) {
            this.actions.select();
        }
        this.tab=i;
        this.t=0.3;
        this.scroll=0;
        this.scrollTo=0;
    }

    openDetail(kind,id) {
        const alt=kind==='card'?this.showUp:this.showElite&&!ENEMIES[id].boss;
        this.detail={kind,id,t:0,alt,altAnim:alt?1:0};
        this.animT=0;
        this.dScroll=0;
        this.dScrollTo=0;
        if (this.actions.select) {
            this.actions.select();
        }
    }

    detailOpen() {
        return !!this.detail&&!this.detail.closing;
    }

    closeDetail() {
        if (!this.detailOpen()) {
            return false;
        }
        this.detail.closing=true;
        this.detail.t=Math.min(this.detail.t,0.3);
        return true;
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (this.detail&&this.detail.closing) {
            return true;
        }
        if (this.detail) {
            if (inRect(this.dClose,x,y)||!inRect(this.dPanel,x,y)) {
                this.closeDetail();
                return true;
            }
            if (this.dToggle&&inRect(this.dToggle,x,y)) {
                this.detail.alt=!this.detail.alt;
                if (this.actions.select) {
                    this.actions.select();
                }
                return true;
            }
            this.drag={y0:y,s0:this.dScrollTo,x0:x,moved:false,detail:true};
            return true;
        }
        if (inRect(this.back,x,y)) {
            this.actions.back();
        }
        else if (this.tabs.some(b=>inRect(b,x,y))) {
            this.setTab(this.tabs.findIndex(b=>inRect(b,x,y)));
        }
        else if (this.filterHits.some(b=>inRect(b,x,y))) {
            this.costFilter[this.tab]=this.filterHits.find(b=>inRect(b,x,y)).cost;
            this.scroll=0;
            this.scrollTo=0;
            this.t=Math.min(this.t,0.3);
            if (this.actions.select) {
                this.actions.select();
            }
        }
        else if (this.tab===0&&this.upToggle&&inRect(this.upToggle,x,y)) {
            this.showUp=!this.showUp;
            if (this.actions.select) {
                this.actions.select();
            }
        }
        else if (this.tab===2&&this.eliteToggle&&inRect(this.eliteToggle,x,y)) {
            this.showElite=!this.showElite;
            if (this.actions.select) {
                this.actions.select();
            }
        }
        else if (inRect(this.view,x,y)) {
            this.drag={y0:y,s0:this.scrollTo,x0:x,moved:false,detail:false};
        }
        return true;
    }

    move(x,y) {
        const d=this.drag;
        if (!d) {
            return;
        }
        if (Math.hypot(x-d.x0,y-d.y0)>6) {
            d.moved=true;
        }
        if (d.detail) {
            this.dScrollTo=d.s0-(y-d.y0);
            this.clampScroll();
            this.dScroll=this.dScrollTo;
        }
        else {
            this.scrollTo=d.s0-(y-d.y0);
            this.clampScroll();
            this.scroll=this.scrollTo;
        }
    }

    up(x,y) {
        const d=this.drag;
        this.drag=null;
        if (!d||d.moved||d.detail||x===undefined) {
            return;
        }
        for (const hit of this.hits) {
            if (inRect(hit,x,y)) {
                this.openDetail(hit.kind,hit.id);
                return;
            }
        }
    }

    update(dt) {
        super.update(dt);
        const k=1-Math.exp(-TUNING.codex.follow*dt);
        this.scroll+=(this.scrollTo-this.scroll)*k;
        this.dScroll+=(this.dScrollTo-this.dScroll)*k;
        this.animT+=dt;
        const ka=1-Math.exp(-TUNING.codex.toggleFollow*dt);
        this.upAnim+=((this.showUp?1:0)-this.upAnim)*ka;
        this.eliteAnim+=((this.showElite?1:0)-this.eliteAnim)*ka;
        this.tabAnim+=(this.tab-this.tabAnim)*ka;
        if (this.detail) {
            this.detail.altAnim+=((this.detail.alt?1:0)-this.detail.altAnim)*ka;
            if (this.detail.closing) {
                this.detail.t-=dt*0.3/TUNING.ui.closeTime;
                if (this.detail.t<=0) {
                    this.detail=null;
                }
            }
            else {
                this.detail.t+=dt;
            }
        }
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
    }

    appear(i) {
        return Math.max(0,Math.min(1,(this.t-0.1-Math.min(i,6)*0.05)/0.35));
    }

    hovering(r) {
        return !this.detailOpen()&&inRect(r,this.hx??-1,this.hy??-1)&&inRect(this.view,this.hx??-1,this.hy??-1);
    }

    drawBrief(ctx,card,x,y,w,v,cmp=false) {
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.font=(cmp?'12px ':'14px ')+FONT;
        ctx.fillStyle=PALETTE.ink;
        const lines=wrapText(ctx,cardBrief(card),w-6);
        let yy=y;
        for (let k=0;k<lines.length&&k<(cmp?3:2);k++) {
            ctx.fillText(lines[k],x,yy);
            yy+=cmp?16:19;
        }
        if (cmp) {
            return;
        }
        yy+=8;
        let cx=x;
        const rare=card.def.rarity==='rare';
        const chips=cardChips(card);
        ctx.font='bold 13px '+FONT;
        ctx.textBaseline='middle';
        for (let i=0;i<chips.length;i++) {
            const cw=ctx.measureText(chips[i]).width+16;
            if (cx+cw>x+w) {
                break;
            }
            const hi=i===1;
            ctx.fillStyle=hi?(rare?rgba('red',0.12):rgba('ink',0.08)):rgba('paper',0.9);
            ctx.fillRect(cx,yy,cw,24);
            drawShape(ctx,sketchRect(cx,yy,cw,24,{width:1.2,seed:1800+i*7+card.id.length}),hi&&rare?PALETTE.red:PALETTE.nearGray,v);
            ctx.fillStyle=hi&&rare?PALETTE.red:PALETTE.ink;
            ctx.fillText(chips[i],cx+8,yy+13);
            cx+=cw+8;
        }
        ctx.textBaseline='top';
    }

    drawCards(ctx,art,v,list) {
        const w=this.width;
        const V=this.view;
        const C=TUNING.codex;
        const cmp=this.compact;
        const cols=cmp?C.compactCols:(w>=900?2:1);
        const colW=Math.min(cmp?w:520,(w-40)/cols);
        const sc=cmp?C.compactScale:C.cardScale;
        const rowH=CARD_H*sc+(cmp?C.compactGap:C.rowGap);
        const x0=w/2-colW*cols/2;
        const idx=this.filtered(list);
        this.contentH=Math.ceil(idx.length/cols)*rowH+10;
        const flipList=list===this.lists[0];
        const flip=flipList?Math.abs(Math.cos(this.upAnim*Math.PI)):1;
        if (idx.length===0) {
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='15px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('codex.filterNone'),w/2,V.y+60);
        }
        for (let j=0;j<idx.length;j++) {
            const i=idx[j];
            const c=flipList&&this.upAnim>0.5?this.upList[i]:list[i];
            const cx=x0+(j%cols)*colW;
            const cy=V.y+10+Math.floor(j/cols)*rowH-this.scroll;
            if (cy>V.y+V.h||cy+rowH<V.y) {
                continue;
            }
            const p=this.appear(Math.floor(j/cols));
            if (p<=0) {
                continue;
            }
            const need=unlockLevel(c.id);
            const locked=need>effectiveLevel();
            const r={x:cx+4,y:cy,w:colW-8,h:rowH-12,kind:'card',id:c.id};
            if (!locked) {
                this.hits.push(r);
            }
            const hv=!locked&&this.hovering(r);
            ctx.save();
            ctx.globalAlpha=p;
            if (hv) {
                ctx.fillStyle=rgba('farGray',0.35);
                ctx.fillRect(r.x,r.y-4,r.w,r.h);
            }
            ctx.translate(cx+8,cy+(1-p)*16);
            ctx.save();
            ctx.translate(CARD_W*sc/2,0);
            ctx.scale(sc*Math.max(0.03,locked?1:flip),sc);
            ctx.translate(-CARD_W/2,0);
            ctx.drawImage(locked?art.back(v):art.face(c,v),0,0,CARD_W,CARD_H);
            if (!locked) {
                drawCost(ctx,c,false,v);
            }
            ctx.restore();
            const tx=CARD_W*sc+16;
            const tw=colW-tx-16;
            ctx.textAlign='left';
            ctx.textBaseline='top';
            ctx.fillStyle=c.def.rarity==='rare'?PALETTE.red:PALETTE.ink;
            ctx.font='bold '+(cmp?16:18)+'px '+FONT;
            ctx.fillText(locked?t('ui.unknown'):cardName(c),tx,4,tw);
            if (!locked&&!cmp) {
                drawStarterTag(ctx,c.id,tx+ctx.measureText(cardName(c)).width+10,6,12,v);
            }
            ctx.font=(cmp?'12px ':'13px ')+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            const meta=locked?t('codex.locked',{level:need}):(c.def.rarity==='rare'?t('type.ult'):t('type.'+c.def.type))+' · '+t('codex.unlockAt',{level:need});
            ctx.fillText(meta,tx,cmp?25:28,tw);
            if (!locked) {
                ctx.globalAlpha*=flipList?0.4+0.6*flip:1;
                this.drawBrief(ctx,c,tx,cmp?44:50,tw,v,cmp);
                if (!cmp) {
                    ctx.fillStyle=hv?PALETTE.red:PALETTE.midGray;
                    ctx.font='12px '+FONT;
                    ctx.textAlign='right';
                    ctx.fillText(t('codex.clickCard'),colW-16,8);
                    ctx.textAlign='left';
                }
            }
            ctx.restore();
        }
    }

    drawEnemies(ctx,v,list) {
        const w=this.width;
        const V=this.view;
        const cols=w>=900?2:1;
        const colW=Math.min(540,(w-40)/cols);
        const rowH=110;
        const x0=w/2-colW*cols/2;
        this.contentH=Math.ceil(list.length/cols)*rowH+10;
        for (let i=0;i<list.length;i++) {
            const id=list[i];
            const x=x0+(i%cols)*colW;
            const y=V.y+6+Math.floor(i/cols)*rowH-this.scroll;
            if (y>V.y+V.h||y+rowH<V.y) {
                continue;
            }
            const p=this.appear(Math.floor(i/cols));
            if (p<=0) {
                continue;
            }
            const seen=hasSeen(id);
            const boss=ENEMIES[id].boss;
            const r={x:x+4,y:y,w:colW-8,h:rowH-12,kind:'enemy',id};
            if (seen) {
                this.hits.push(r);
            }
            const hv=seen&&this.hovering(r);
            const C=TUNING.codex.enemyAnim;
            const pop=EASE.easeOutBack(p);
            ctx.save();
            ctx.globalAlpha=p;
            ctx.translate(0,(1-p)*C.slide);
            if (hv) {
                ctx.fillStyle=rgba('farGray',0.35);
                ctx.fillRect(r.x,r.y,r.w,r.h);
            }
            ctx.save();
            ctx.translate(x+51,y+47);
            ctx.scale(pop,pop);
            ctx.rotate((1-p)*C.spin+(hv?Math.sin(time.real*C.hoverFreq)*C.hoverTilt:0));
            ctx.translate(-43,-43);
            ctx.fillStyle=seen?rgba('paper',0.9):PALETTE.nearGray;
            ctx.fillRect(0,0,86,86);
            drawShape(ctx,sketchRect(0,0,86,86,{width:1.6,seed:1800+i}),boss?PALETTE.red:PALETTE.ink,v);
            ctx.restore();
            const el=boss?0:this.eliteAnim;
            ctx.save();
            ctx.translate(x+51,y+47);
            ctx.scale(pop,pop);
            if (seen) {
                const ph=time.real*C.bobFreq+i*1.7;
                ctx.translate(0,Math.sin(ph)*C.bob*(hv?2:1));
                ctx.rotate(Math.sin(ph*0.7)*C.sway*(hv?2.5:1));
                const sq=1+Math.sin(ph*2)*C.squash;
                ctx.scale(1/sq,sq);
                const es=lerp1(1,1.18,el);
                ctx.scale(es,es);
                ENEMY_ICONS[id](ctx,v);
            }
            else {
                ctx.fillStyle=PALETTE.paper;
                ctx.font='bold 44px '+FONT;
                ctx.textAlign='center';
                ctx.textBaseline='middle';
                ctx.fillText('?',0,2);
            }
            ctx.restore();
            const tx=x+108;
            const tw=colW-120;
            ctx.textAlign='left';
            ctx.textBaseline='top';
            ctx.fillStyle=boss?PALETTE.red:PALETTE.ink;
            ctx.font='bold 18px '+FONT;
            ctx.fillText(seen?(el>0.5?t('hud.elite')+' ':'')+t('enemy.'+id)+(boss?t('ui.gap')+t('codex.boss'):''):t('ui.unknown'),tx,y+6);
            if (seen&&el>0.02) {
                ctx.save();
                ctx.globalAlpha*=el;
                ctx.strokeStyle=PALETTE.red;
                ctx.lineWidth=2.5;
                ctx.strokeRect(x+5,y+1,92,92);
                ctx.restore();
            }
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='13px '+FONT;
            const full=seen?t('codex.'+id):t('codex.unseen');
            const cut=full.search(/。|\. /);
            const lines=wrapText(ctx,cut>0?full.slice(0,cut):full,tw);
            for (let k=0;k<lines.length&&k<1;k++) {
                ctx.fillText(lines[k]+(lines.length>1?'…':''),tx,y+32);
            }
            if (seen) {
                const d=ENEMIES[id];
                const E=TUNING.elite;
                const chips=[t('chip.hp',{v:Math.round(d.hp*lerp1(1,E.hp,el))}),t('chip.ink',{v:fmtInk((d.ink||1)*lerp1(1,TUNING.ink.eliteMult,el))}),d.boss?t('codex.type.boss'):(d.flying?t('codex.type.fly'):t('codex.type.ground'))];
                let cx=tx;
                ctx.font='bold 12px '+FONT;
                ctx.textBaseline='middle';
                for (let k=0;k<chips.length;k++) {
                    const cw=ctx.measureText(chips[k]).width+14;
                    ctx.fillStyle=k===0?rgba(boss?'red':'ink',0.08):rgba('paper',0.9);
                    ctx.fillRect(cx,y+54,cw,22);
                    drawShape(ctx,sketchRect(cx,y+54,cw,22,{width:1.1,seed:1850+k+i*3}),PALETTE.nearGray,v);
                    ctx.fillStyle=PALETTE.ink;
                    ctx.fillText(chips[k],cx+7,y+66);
                    cx+=cw+6;
                }
                ctx.textBaseline='top';
            }
            if (seen) {
                ctx.fillStyle=hv?PALETTE.red:PALETTE.midGray;
                ctx.font='12px '+FONT;
                ctx.fillText(t('codex.clickEnemy'),tx,y+86);
            }
            ctx.restore();
        }
    }

    drawScrollbar(ctx,V,scroll,contentH,x) {
        const max=Math.max(0,contentH-V.h);
        if (max<=0) {
            return;
        }
        const th=Math.max(40,V.h*V.h/contentH);
        const ty=V.y+(V.h-th)*(scroll/max);
        ctx.fillStyle=rgba('farGray',0.6);
        ctx.fillRect(x,V.y,6,V.h);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(x-1,ty,8,th);
    }

    drawFades(ctx,V,scroll,contentH) {
        const max=Math.max(0,contentH-V.h);
        const fade=24;
        if (scroll>2) {
            const g=ctx.createLinearGradient(0,V.y,0,V.y+fade);
            g.addColorStop(0,rgba('paper',0.97));
            g.addColorStop(1,rgba('paper',0));
            ctx.fillStyle=g;
            ctx.fillRect(V.x,V.y,V.w-24,fade);
        }
        if (scroll<max-2) {
            const g=ctx.createLinearGradient(0,V.y+V.h-fade,0,V.y+V.h);
            g.addColorStop(0,rgba('paper',0));
            g.addColorStop(1,rgba('paper',0.97));
            ctx.fillStyle=g;
            ctx.fillRect(V.x,V.y+V.h-fade,V.w-24,fade);
        }
    }

    drawCardDetail(ctx,art,v) {
        const P=this.dPanel;
        const d=this.detail;
        const base=createCard(d.id);
        const rare=base.def.rarity==='rare';
        const card=!rare&&d.altAnim>0.5?createCard(d.id,true):base;
        const flip=rare?1:Math.abs(Math.cos(d.altAnim*Math.PI));
        const sc=Math.min(1.3,(P.h-380)/CARD_H);
        const lw=Math.max(260,CARD_W*sc+40);
        const lx=P.x+28;
        let y=P.y+28;
        ctx.save();
        ctx.translate(lx+CARD_W*sc/2,y);
        ctx.scale(sc*Math.max(0.03,flip),sc);
        ctx.translate(-CARD_W/2,0);
        ctx.drawImage(art.face(card,v),0,0,CARD_W,CARD_H);
        drawCost(ctx,card,false,v);
        ctx.restore();
        this.dToggle=null;
        y+=CARD_H*sc+16;
        if (!rare) {
            this.dToggle={x:P.x+P.w-28-150,y:P.y+22,w:150,h:30};
            drawToggle(ctx,this.dToggle,[t('codex.base'),t('codex.plus')],d.altAnim,v);
        }
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillStyle=rare?PALETTE.red:PALETTE.ink;
        ctx.font='bold 26px '+FONT;
        ctx.fillText(cardName(card),lx,y);
        drawStarterTag(ctx,card.id,lx+ctx.measureText(cardName(card)).width+12,y+5,14,v);
        y+=36;
        ctx.font='14px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText((rare?t('type.ult'):t('type.'+card.def.type))+' · '+t('codex.unlockAt',{level:unlockLevel(card.id)}),lx,y);
        y+=26;
        ctx.save();
        ctx.globalAlpha*=0.4+0.6*flip;
        const facts=cardFacts(card,true);
        for (let i=0;i<facts.length;i++) {
            ctx.fillStyle=i===0?PALETTE.ink:PALETTE.nearGray;
            ctx.font=(i===0?'15px ':'14px ')+FONT;
            const ls=wrapText(ctx,facts[i],lw-24);
            for (let k=0;k<ls.length;k++) {
                ctx.fillText((k===0?'• ':'  ')+ls[k],lx,y);
                y+=i===0?21:19;
            }
        }
        ctx.restore();
        y+=10;
        ctx.fillStyle=rare?PALETTE.red:PALETTE.nearGray;
        ctx.font='bold 13px '+FONT;
        for (const line of wrapText(ctx,rare?t('codex.rareMerge'):t('codex.normalMerge'),lw-10)) {
            ctx.fillText(line,lx,y);
            y+=18;
        }
        const sx=lx+lw+20;
        const sw=P.x+P.w-28-sx;
        const sh=Math.min(sw*9/16,P.h-150);
        const sww=sh*16/9;
        const stx=sx+(sw-sww)/2;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 18px '+FONT;
        ctx.textAlign='left';
        ctx.fillText(t('codex.demo'),stx,P.y+28);
        drawStage(ctx,stx,P.y+58,sww,sh,CARD_ANIMS[card.id],this.animT,v);
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font='13px '+FONT;
        ctx.fillText(t('codex.demoHint'),stx,P.y+66+sh);
    }

    enemyStats(id,e) {
        const d=ENEMIES[id];
        const E=TUNING.elite;
        const hp=Math.round(d.hp*lerp1(1,E.hp,e));
        const inkV=(d.ink||1)*lerp1(1,TUNING.ink.eliteMult,e);
        const score=Math.round(ENDLESS.scoreKill*(d.cost||1)*lerp1(1,E.score,e));
        const rows=[
            [t('codex.stat.hp'),String(hp),true],
            [t('codex.stat.speed'),d.speed>0?String(d.speed):t('codex.stat.still'),false],
            [t('codex.stat.contact'),String(d.contactDamage),false],
            [t('codex.stat.ink'),'+'+fmtInk(Math.round(inkV*2)/2),true],
            [t('codex.stat.type'),d.boss?t('codex.type.boss'):(d.flying?t('codex.type.fly'):t('codex.type.ground')),false],
            [t('codex.stat.score'),String(d.boss?ENDLESS.scoreBoss:score),true],
            [t('codex.stat.first'),firstSeen(id,e),e>0.5]
        ];
        if (d.weakMult) {
            rows.push([t('codex.stat.weak'),t('codex.weak.'+id),false]);
        }
        if (!d.boss) {
            rows.push([t('codex.stat.size'),e>0.5?'×'+E.scale:'×1',true]);
            rows.push([t('codex.stat.knock'),e>0.5?t('codex.knock.elite',{n:Math.round((1-E.knock)*100)}):t('codex.knock.normal'),true]);
        }
        return rows;
    }

    drawEnemyDetailCompact(ctx,v) {
        const P=this.dPanel;
        const V=this.dView;
        const C=TUNING.codex.enemyCompact;
        const id=this.detail.id;
        const boss=ENEMIES[id].boss;
        const e=boss?0:this.detail.altAnim;
        const lx=P.x+20;
        const lw=P.w*C.leftFrac;
        let y=P.y+18;
        const ic=C.icon;
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(lx,y,ic,ic);
        ctx.save();
        ctx.translate(lx,y);
        drawShape(ctx,sketchRect(0,0,ic,ic,{width:2,seed:2201}),boss||e>0.5?PALETTE.red:PALETTE.ink,v);
        ctx.translate(ic/2,ic*0.55);
        const isc=ic/94*lerp1(1,TUNING.elite.scale,e);
        ctx.scale(isc,isc);
        ENEMY_ICONS[id](ctx,v);
        ctx.restore();
        const nx=lx+ic+14;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillStyle=boss?PALETTE.red:PALETTE.ink;
        ctx.font='bold 22px '+FONT;
        ctx.fillText(t('enemy.'+id),nx,y+4,lx+lw-nx);
        if (boss||e>0.5) {
            ctx.font='bold 13px '+FONT;
            ctx.fillStyle=PALETTE.red;
            ctx.fillText(boss?t('codex.boss'):t('hud.elite'),nx,y+34);
        }
        y+=ic+10;
        ctx.font='13px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        for (const ln of wrapText(ctx,t('codex.'+id),lw).slice(0,C.descLines)) {
            ctx.fillText(ln,lx,y);
            y+=17;
        }
        y+=6;
        const rows=this.enemyStats(id,e);
        const half=lw/2;
        let col=0;
        let row=0;
        for (let i=0;i<rows.length;i++) {
            ctx.font='bold 13px '+FONT;
            const wide=ctx.measureText(rows[i][1]).width>half*0.48;
            if (wide&&col) {
                col=0;
                row++;
            }
            const cx=lx+col*half;
            const cy=y+row*C.rowH;
            ctx.font='12px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(rows[i][0],cx,cy,half*0.5);
            ctx.fillStyle=rows[i][2]&&e>0.5?PALETTE.red:PALETTE.ink;
            fitText(ctx,rows[i][1],cx+half*0.5,cy,wide?lw-half*0.5:half*0.48,13,'bold ');
            col=wide?2:col+1;
            if (col>1) {
                col=0;
                row++;
            }
        }
        const rx=lx+lw+18;
        const rw=P.x+P.w-20-rx;
        drawShape(ctx,sketchLine(rx-9,P.y+16,rx-9,V.y+V.h-4,{width:1.2,seed:2207}),rgba('midGray',0.6),v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 18px '+FONT;
        ctx.fillText(t('codex.attacks'),rx,P.y+18);
        const top=P.y+50;
        const RV={x:rx,y:top,w:rw,h:V.y+V.h-top};
        this.dScrollView=RV;
        ctx.save();
        ctx.beginPath();
        ctx.rect(RV.x-4,RV.y,RV.w+8,RV.h);
        ctx.clip();
        ctx.translate(0,-this.dScroll);
        const atks=ENEMY_ATTACKS[id];
        const stw=Math.min(C.stageMax,rw*C.stageFrac);
        const sth=stw*9/16;
        let ay=top;
        for (let i=0;i<atks.length;i++) {
            const a=atks[i];
            ctx.font='13px '+FONT;
            const ls=wrapText(ctx,t('atk.'+id+'.'+a.key+'.desc'),rw-stw-14);
            const ih=Math.max(sth,48+ls.length*17)+C.gap;
            if (ay-this.dScroll<RV.y+RV.h&&ay+ih-this.dScroll>RV.y) {
                drawStage(ctx,rx,ay,stw,sth,a,this.animT+i*0.37,v);
                const ax=rx+stw+12;
                ctx.textAlign='left';
                ctx.textBaseline='top';
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold 15px '+FONT;
                ctx.fillText(t('atk.'+id+'.'+a.key),ax,ay+2,rw-stw-14);
                ctx.fillStyle=a.dmg.kind==='none'||a.dmg.kind==='slow'?PALETTE.midGray:PALETTE.red;
                ctx.font='bold 12px '+FONT;
                ctx.fillText(t('codex.dmg.'+a.dmg.kind,{n:a.dmg.n}),ax,ay+24);
                ctx.fillStyle=PALETTE.nearGray;
                ctx.font='13px '+FONT;
                for (let k=0;k<ls.length;k++) {
                    ctx.fillText(ls[k],ax,ay+44+k*17);
                }
            }
            ay+=ih;
        }
        ctx.restore();
        this.dContentH=ay-top+(V.h-RV.h)+C.gap;
        if (!boss) {
            this.dToggle={x:P.x+P.w-20-130,y:P.y+14,w:130,h:28};
            drawToggle(ctx,this.dToggle,[t('codex.normalFoe'),t('hud.elite')],e,v,e>0.5);
        }
        else {
            this.dToggle=null;
        }
        this.drawFades(ctx,RV,this.dScroll,ay-top);
        this.drawScrollbar(ctx,RV,this.dScroll,ay-top,P.x+P.w-12);
    }

    drawEnemyDetail(ctx,v) {
        if (this.compact) {
            this.drawEnemyDetailCompact(ctx,v);
            return;
        }
        this.dScrollView=null;
        const P=this.dPanel;
        const V=this.dView;
        const id=this.detail.id;
        const boss=ENEMIES[id].boss;
        const e=boss?0:this.detail.altAnim;
        ctx.save();
        ctx.beginPath();
        ctx.rect(V.x,V.y,V.w,V.h);
        ctx.clip();
        ctx.translate(0,-this.dScroll);
        const lx=P.x+28;
        let y=P.y+28;
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(lx,y,150,150);
        ctx.save();
        ctx.translate(lx,y);
        drawShape(ctx,sketchRect(0,0,150,150,{width:2,seed:2201}),boss||e>0.5?PALETTE.red:PALETTE.ink,v);
        ctx.translate(75,82);
        const isc=1.6*lerp1(1,TUNING.elite.scale,e);
        ctx.scale(isc,isc);
        ENEMY_ICONS[id](ctx,v);
        ctx.restore();
        if (e>0.02) {
            ctx.save();
            ctx.globalAlpha*=Math.min(1,e*1.5);
            ctx.translate(lx+118,y+22);
            ctx.rotate(0.25);
            ctx.fillStyle=PALETTE.paper;
            ctx.fillRect(-24,-11,48,22);
            drawShape(ctx,sketchRect(-24,-11,48,22,{width:1.6,seed:2205}),PALETTE.red,v);
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold 13px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('hud.elite'),0,1);
            ctx.restore();
        }
        const tx=lx+176;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillStyle=boss?PALETTE.red:PALETTE.ink;
        ctx.font='bold 28px '+FONT;
        ctx.fillText(t('enemy.'+id)+(boss?t('ui.gap')+t('codex.boss'):''),tx,y);
        this.dToggle=null;
        ctx.font='14px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        const dl=wrapText(ctx,t('codex.'+id),P.x+P.w-40-tx);
        for (let i=0;i<dl.length;i++) {
            ctx.fillText(dl[i],tx,y+40+i*19);
        }
        const rows=this.enemyStats(id,e);
        const sy=y+44+dl.length*19+6;
        const colW=Math.min(260,(P.x+P.w-40-tx)/2);
        ctx.font='14px '+FONT;
        const labW=Math.max(92,...rows.map(r=>ctx.measureText(r[0]).width+12));
        let col=0;
        let row=0;
        for (let i=0;i<rows.length;i++) {
            ctx.font='bold 15px '+FONT;
            const wide=ctx.measureText(rows[i][1]).width>colW-labW-8;
            if (wide&&col) {
                col=0;
                row++;
            }
            const cx=tx+col*colW;
            const cy=sy+row*26;
            ctx.font='14px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(rows[i][0],cx,cy);
            ctx.fillStyle=rows[i][2]&&e>0.5?PALETTE.red:PALETTE.ink;
            fitText(ctx,rows[i][1],cx+labW,cy,(wide?colW*2:colW)-labW-8,15,'bold ');
            col=wide?2:col+1;
            if (col>1) {
                col=0;
                row++;
            }
        }
        y=Math.max(y+170,sy+(row+(col?1:0))*26+8);
        ctx.fillStyle=PALETTE.midGray;
        ctx.font='12px '+FONT;
        ctx.fillText(t('codex.statNote'),tx,y-8);
        y+=16;
        drawShape(ctx,sketchLine(lx,y,P.x+P.w-28,y,{width:1.4,seed:2202}),PALETTE.ink,v);
        y+=14;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 20px '+FONT;
        ctx.fillText(t('codex.attacks'),lx,y);
        y+=36;
        const atks=ENEMY_ATTACKS[id];
        const cols=P.w>=860?2:1;
        const cw=(P.w-56)/cols;
        const stw=Math.min(300,cw*0.56);
        const sth=stw*9/16;
        const ch=Math.max(sth,120)+24;
        for (let i=0;i<atks.length;i++) {
            const a=atks[i];
            const cx=lx+(i%cols)*cw;
            const cy=y+Math.floor(i/cols)*ch;
            if (cy-this.dScroll<V.y+V.h&&cy+ch-this.dScroll>V.y) {
                drawStage(ctx,cx,cy,stw,sth,a,this.animT+i*0.37,v);
                const ax=cx+stw+14;
                const aw=cw-stw-28;
                ctx.textAlign='left';
                ctx.textBaseline='top';
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold 17px '+FONT;
                ctx.fillText(t('atk.'+id+'.'+a.key),ax,cy+2);
                ctx.fillStyle=a.dmg.kind==='none'||a.dmg.kind==='slow'?PALETTE.midGray:PALETTE.red;
                ctx.font='bold 13px '+FONT;
                ctx.fillText(t('codex.dmg.'+a.dmg.kind,{n:a.dmg.n}),ax,cy+26);
                ctx.fillStyle=PALETTE.nearGray;
                ctx.font='13px '+FONT;
                const ls=wrapText(ctx,t('atk.'+id+'.'+a.key+'.desc'),aw);
                for (let k=0;k<ls.length&&k<6;k++) {
                    ctx.fillText(ls[k],ax,cy+48+k*18);
                }
            }
        }
        this.dContentH=y+Math.ceil(atks.length/cols)*ch-P.y;
        ctx.restore();
        if (!boss) {
            this.dToggle={x:P.x+P.w-28-150,y:P.y+22,w:150,h:30};
            drawToggle(ctx,this.dToggle,[t('codex.normalFoe'),t('hud.elite')],e,v,e>0.5);
        }
        this.drawFades(ctx,V,this.dScroll,this.dContentH);
        this.drawScrollbar(ctx,V,this.dScroll,this.dContentH,P.x+P.w-16);
    }

    drawDetail(ctx,art,v) {
        const P=this.dPanel;
        const a=EASE.easeOutBack(Math.min(1,this.detail.t/0.3));
        ctx.fillStyle=rgba('ink',0.25*Math.min(1,this.detail.t*5));
        ctx.fillRect(0,0,this.width,this.height);
        ctx.save();
        ctx.translate(P.x+P.w/2,P.y+P.h/2);
        ctx.scale(0.9+0.1*a,0.9+0.1*a);
        ctx.globalAlpha=Math.min(1,this.detail.t*6);
        ctx.translate(-(P.x+P.w/2),-(P.y+P.h/2));
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        ctx.save();
        ctx.translate(P.x,P.y);
        drawShape(ctx,sketchRect(0,0,Math.round(P.w),Math.round(P.h),{width:2.4,seed:2203}),PALETTE.ink,v);
        ctx.restore();
        if (this.detail.kind==='card') {
            this.drawCardDetail(ctx,art,v);
        }
        else {
            this.drawEnemyDetail(ctx,v);
        }
        drawButton(ctx,this.dClose,t('menu.back'),v,1,inRect(this.dClose,this.hx??-1,this.hy??-1));
        ctx.restore();
    }

    draw(ctx,art) {
        if (!this.shown()) {
            return;
        }
        const C=TUNING.codex.open;
        const w=this.width;
        const h=this.height;
        const k=EASE.easeOutCubic(Math.min(1,this.t/C.time));
        ctx.fillStyle=rgba('paper',Math.min(0.97,this.t/C.fade));
        ctx.fillRect(0,0,w,h);
        ctx.save();
        ctx.globalAlpha*=Math.min(1,this.t/C.fade);
        const sc=C.scale+(1-C.scale)*k;
        ctx.translate(w/2,h/2+(1-k)*C.rise);
        ctx.scale(sc,sc);
        ctx.translate(-w/2,-h/2);
        this.drawBody(ctx,art);
        ctx.restore();
    }

    drawBody(ctx,art) {
        this.layout();
        this.clampScroll();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(this.compact?24:32)+'px '+FONT;
        ctx.textAlign=this.compact?'left':'center';
        ctx.textBaseline='middle';
        if (this.compact) {
            fitText(ctx,t('menu.codex'),20,this.tabs[0].y+this.tabs[0].h/2,this.tabs[0].x-28,24,'bold ');
        }
        else {
            ctx.fillText(t('menu.codex'),w/2,36);
        }
        this.drawFilter(ctx,v);
        const tl=[t('codex.normal'),t('codex.ult'),t('codex.enemies'),t('codex.bosses')];
        const ta=this.tabAnim;
        const t0=this.tabs[Math.floor(Math.min(2.999,ta))];
        const t1=this.tabs[Math.min(3,Math.floor(Math.min(2.999,ta))+1)];
        const tf=ta-Math.floor(Math.min(2.999,ta));
        const hxp=t0.x+(t1.x-t0.x)*tf;
        const stretch=1+Math.sin(tf*Math.PI)*0.25;
        ctx.fillStyle=Math.abs(ta-1)<0.5||Math.abs(ta-3)<0.5?PALETTE.red:PALETTE.ink;
        ctx.fillRect(hxp+t0.w*(1-stretch)/2,t0.y,t0.w*stretch,t0.h);
        for (let i=0;i<4;i++) {
            const b=this.tabs[i];
            ctx.save();
            ctx.translate(b.x,b.y);
            drawShape(ctx,sketchRect(0,0,b.w,b.h,{width:1.8,seed:1500+i}),i%2===1?PALETTE.red:PALETTE.ink,v);
            ctx.restore();
            ctx.fillStyle=Math.abs(ta-i)<0.5?PALETTE.paper:(i%2===1?PALETTE.red:PALETTE.ink);
            ctx.font='bold 17px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(tl[i],b.x+b.w/2,b.y+b.h/2+1);
        }
        this.upToggle=null;
        this.eliteToggle=null;
        const tb=this.tabs[3];
        const tr={x:Math.min(w-170,tb.x+tb.w+18),y:tb.y+5,w:150,h:30};
        const a0=Math.max(0,1-Math.abs(this.tabAnim)*1.5);
        const a2=Math.max(0,1-Math.abs(this.tabAnim-2)*1.5);
        if (a0>0) {
            ctx.save();
            ctx.globalAlpha*=a0;
            drawToggle(ctx,tr,[t('codex.base'),t('codex.plus')],this.upAnim,v);
            ctx.restore();
        }
        if (a2>0) {
            ctx.save();
            ctx.globalAlpha*=a2;
            drawToggle(ctx,tr,[t('codex.normalFoe'),t('hud.elite')],this.eliteAnim,v,this.eliteAnim>0.5);
            ctx.restore();
        }
        if (this.tab===0) {
            this.upToggle=tr;
        }
        if (this.tab===2) {
            this.eliteToggle=tr;
        }
        const V=this.view;
        this.hits=[];
        ctx.save();
        ctx.beginPath();
        ctx.rect(V.x,V.y,V.w,V.h);
        ctx.clip();
        if (this.tab<2) {
            this.drawCards(ctx,art,v,this.lists[this.tab]);
        }
        else {
            this.drawEnemies(ctx,v,this.tab===2?FOE_LIST:BOSS_LIST);
        }
        ctx.restore();
        this.drawFades(ctx,V,this.scroll,this.contentH);
        this.drawScrollbar(ctx,V,this.scroll,this.contentH,w-18);
        if (this.maxScroll()>0&&!this.compact) {
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='13px '+FONT;
            ctx.textAlign='right';
            ctx.textBaseline='middle';
            ctx.fillText(t('codex.scrollHint'),w-30,this.back.y+this.back.h/2);
        }
        drawButton(ctx,this.back,t('menu.back'),v,(this.t-0.1)/0.3,!this.detail&&inRect(this.back,this.hx??-1,this.hy??-1));
        if (this.detail) {
            this.drawDetail(ctx,art,v);
        }
    }
}

export class RunSummary {
    constructor() {
        this.open=false;
        this.t=0;
        this.width=1;
        this.height=1;
        this.button={x:0,y:0,w:0,h:0};
        this.closeK=0;
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
    }

    shown() {
        return this.open||this.closeK>0;
    }

    close(toMenu) {
        this.open=false;
        this.closeK=1;
        if (this.onRestart) {
            this.onRestart(toMenu);
        }
    }

    show(victory,stats,quit,onRestart) {
        this.open=true;
        this.closeK=0;
        this.t=0;
        this.victory=victory;
        this.quit=quit;
        this.stats=stats;
        this.onRestart=onRestart;
        this.gradeOpen=false;
        this.gradeRect=null;
        this.detail=false;
        this.detailT=0;
        this.dScroll=0;
        this.dScrollTo=0;
        this.dDrag=null;
    }

    detailRows() {
        const s=this.stats;
        const log=s.log||[];
        return log.map((q,i)=>{
            const e=i+1<log.length?log[i+1].s:s;
            const name=q.node==='boss'?t('hud.bossPage'):q.node==='overtime'?t('summary.overtime'):q.node==='endless'?t('summary.endlessPage'):t('node.'+q.node);
            const sub=q.game?t('event.'+q.game+'.title'):'';
            const group=q.node==='overtime'?'overtime':q.node==='endless'?'endless':'act'+q.act;
            const label=q.node==='overtime'?t('summary.overtime'):q.node==='endless'?t('summary.endlessPage'):t('summary.actN',{n:q.act+1});
            const page=q.node==='overtime'||q.node==='endless'?i+1:q.index+1;
            return {group,label,page:t('summary.pageN',{n:page}),name,sub,kills:e.kills-q.s.kills,cards:e.cards-q.s.cards,time:e.time-q.s.time,dealt:Math.round((e.dealt||0)-(q.s.dealt||0)),taken:Math.round((e.taken||0)-(q.s.taken||0)),score:e.score-q.s.score,total:e.score};
        });
    }

    detailItems() {
        const out=[];
        let last=null;
        for (const r of this.detailRows()) {
            if (r.group!==last) {
                out.push({head:true,label:r.label});
                last=r.group;
            }
            out.push(r);
        }
        return out;
    }

    drawerE() {
        return this.detail?EASE.easeOutBack(this.detailT):EASE.easeOutCubic(this.detailT);
    }

    drawerTop() {
        const D=TUNING.summaryUi.drawer;
        const h=this.height;
        const peek=h<600?D.peekSmall:D.peek;
        const full=h*D.frac;
        return h-peek-(full-peek)*this.drawerE();
    }

    move(x,y) {
        const d=this.dDrag;
        if (!d) {
            return;
        }
        if (Math.abs(y-d.y0)>TUNING.summaryUi.drawer.dragSlop) {
            d.moved=true;
        }
        this.dScrollTo=Math.max(0,Math.min(this.dMax||0,d.s0-(y-d.y0)));
        this.dScroll=this.dScrollTo;
    }

    up() {
        const d=this.dDrag;
        this.dDrag=null;
        if (d&&!d.moved&&d.close) {
            this.detail=false;
        }
    }

    wheel(dy) {
        if (this.open&&this.detail) {
            this.dScrollTo=Math.max(0,Math.min(this.dMax||0,this.dScrollTo+dy));
        }
    }

    drawerRect() {
        const D=TUNING.summaryUi.drawer;
        const pw=Math.min(D.maxW,this.width-24);
        return {x:this.width/2-pw/2,w:pw};
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        const dr=this.drawerRect();
        const top=this.drawerTop();
        if (this.detail) {
            const out=y<top||x<dr.x||x>dr.x+dr.w;
            this.dDrag={y0:y,s0:this.dScrollTo,moved:false,close:out};
            return true;
        }
        if (this.t>1.6&&y>=top&&x>=dr.x&&x<=dr.x+dr.w) {
            this.detail=true;
            this.dScroll=0;
            this.dScrollTo=0;
            return true;
        }
        if (this.gradeRect&&inRect(this.gradeRect,x,y)) {
            this.gradeOpen=!this.gradeOpen;
            return true;
        }
        if (this.gradeOpen) {
            this.gradeOpen=false;
            return true;
        }
        const b=this.button;
        if (this.t>(this.victory||this.quit?1.6:2.4)) {
            if (x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h) {
                this.close(false);
                return true;
            }
            const m=this.menuButton;
            if (m&&x>=m.x&&x<=m.x+m.w&&y>=m.y&&y<=m.y+m.h) {
                this.close(true);
            }
        }
        return true;
    }

    update(dt) {
        if (this.open) {
            this.t+=dt;
        }
        const DR=TUNING.summaryUi.drawer;
        this.detailT=Math.max(0,Math.min(1,this.detailT+(this.detail?dt/DR.time:-dt/DR.closeTime)));
        this.dScroll=(this.dScroll||0)+((this.dScrollTo||0)-(this.dScroll||0))*(1-Math.exp(-DR.follow*dt));
        this.closeK=Math.max(0,this.closeK-dt/TUNING.ui.closeTime);
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        if (this.closeK>0) {
            const k=EASE.easeInCubic(1-this.closeK);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0,this.height*k*0.5,this.width,this.height*(1-k));
            ctx.clip();
            this.drawBody(ctx);
            ctx.restore();
            return;
        }
        this.drawBody(ctx);
    }

    marks() {
        const G=TUNING.summaryUi.grade;
        return this.stats.mode==='endless'?G.endless:G.story;
    }

    drawGradeInfo(ctx,x,y,v) {
        const M=this.marks();
        const cur=this.grade();
        const lines=[t('grade.points',{n:this.stats.score}),t(this.stats.mode==='endless'?'grade.ruleEndless':'grade.rule')];
        const rows=M.slice(0,-1).map(m=>[m[0],t('grade.at',{n:m[1]})]).concat([[M[M.length-1][0],t('grade.below',{n:M[M.length-2][1]})]]);
        const pad=12;
        const bw=280;
        const bh=pad*2+lines.length*20+rows.length*20+6;
        const bx=Math.max(8,Math.min(this.width-bw-8,x-bw/2));
        const by=Math.max(8,Math.min(this.height-bh-8,y));
        ctx.save();
        ctx.fillStyle=rgba('paper',0.98);
        ctx.fillRect(bx,by,bw,bh);
        drawShape(ctx,sketchRect(bx,by,bw,bh,{width:1.8,seed:971}),PALETTE.red,v);
        ctx.textAlign='left';
        ctx.textBaseline='top';
        let yy=by+pad;
        ctx.font='bold 14px '+FONT;
        ctx.fillStyle=PALETTE.ink;
        ctx.fillText(lines[0],bx+pad,yy);
        yy+=20;
        ctx.font='11px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText(lines[1],bx+pad,yy,bw-pad*2);
        yy+=26;
        for (const [g,label] of rows) {
            const on=g===cur;
            if (on) {
                ctx.fillStyle=rgba('red',0.12);
                ctx.fillRect(bx+6,yy-2,bw-12,20);
            }
            ctx.font='italic 900 15px Georgia,serif';
            ctx.fillStyle=PALETTE.red;
            ctx.fillText(g,bx+pad,yy);
            ctx.font=(on?'bold ':'')+'13px '+FONT;
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(label,bx+pad+26,yy+1);
            yy+=20;
        }
        ctx.restore();
    }

    grade() {
        const M=this.marks();
        for (const [g,min] of M) {
            if (this.stats.score>=min) {
                return g;
            }
        }
        return M[M.length-1][0];
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
    }

    drawSplat(ctx,x,y,r,seed,color,k) {
        if (k<=0) {
            return;
        }
        ctx.fillStyle=color;
        ctx.beginPath();
        const n=14;
        for (let i=0;i<=n;i++) {
            const a=i/n*Math.PI*2;
            const rr=r*k*(0.75+hash1(seed+(i%n)*5)*0.5);
            if (i===0) {
                ctx.moveTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);
            }
            else {
                const am=(i-0.5)/n*Math.PI*2;
                const rm=r*k*(0.6+hash1(seed+i*9)*0.35);
                ctx.quadraticCurveTo(x+Math.cos(am)*rm,y+Math.sin(am)*rm,x+Math.cos(a)*rr,y+Math.sin(a)*rr);
            }
        }
        ctx.fill();
        for (let i=0;i<10;i++) {
            const a=hash1(seed+i*13)*Math.PI*2;
            const d=r*(1.1+hash1(seed+i*7)*1.3)*k;
            const rr=r*(0.05+hash1(seed+i*3)*0.16)*k;
            ctx.beginPath();
            ctx.ellipse(x+Math.cos(a)*d,y+Math.sin(a)*d,rr*1.5,rr,a,0,Math.PI*2);
            ctx.fill();
        }
    }

    drawBackdrop(ctx,v) {
        const w=this.width;
        const h=this.height;
        const T=this.t;
        const win=this.victory;
        ctx.fillStyle=win?rgba('paper',Math.min(0.95,T*2)):rgba('paper',Math.min(0.85,T*0.9));
        ctx.fillRect(0,0,w,h);
        ctx.strokeStyle=rgba('farGray',Math.min(0.5,T));
        ctx.lineWidth=1;
        for (let y=60;y<h;y+=28) {
            ctx.beginPath();
            ctx.moveTo(0,y);
            ctx.lineTo(w,y);
            ctx.stroke();
        }
        ctx.strokeStyle=rgba('red',Math.min(0.35,T*0.5));
        ctx.beginPath();
        ctx.moveTo(Math.min(90,w*0.08),0);
        ctx.lineTo(Math.min(90,w*0.08),h);
        ctx.stroke();
        const spots=[[0.08,0.14,1],[0.93,0.12,0.8],[0.05,0.86,0.9],[0.95,0.9,1.1],[0.82,0.5,0.5],[0.16,0.48,0.45]];
        for (let i=0;i<spots.length;i++) {
            const [sx,sy,sz]=spots[i];
            const k=EASE.easeOutBack(Math.max(0,Math.min(1,(T-0.1-i*0.09)/0.35)));
            const col=i%3===1&&(win||!this.quit)?rgba('red',0.75):rgba('ink',0.82);
            this.drawSplat(ctx,sx*w,sy*h,Math.min(w,h)*0.045*sz,4100+i*31,col,k);
        }
        if (win) {
            for (let i=0;i<46;i++) {
                const sp=40+hash1(i*5)*70;
                const x=hash1(i*11)*w+Math.sin(T*1.6+i)*18;
                const y=((T*sp+hash1(i*17)*h*1.2)%(h+40))-20;
                ctx.save();
                ctx.translate(x,y);
                ctx.rotate(T*(1+hash1(i))*3+i);
                ctx.fillStyle=i%4===0?PALETTE.red:(i%4===1?PALETTE.ink:(i%4===2?PALETTE.marker:PALETTE.midGray));
                ctx.globalAlpha=Math.min(1,T*1.5);
                ctx.fillRect(-5,-3,10,6);
                ctx.restore();
            }
        }
        else if (!this.quit) {
            for (let i=0;i<14;i++) {
                const x=hash1(i*23+5)*w;
                const len=Math.min(1,Math.max(0,(T-0.2-hash1(i*3)*0.8)/1.4))*(40+hash1(i*9)*h*0.32);
                if (len<=0) {
                    continue;
                }
                ctx.strokeStyle=rgba('red',0.55);
                ctx.lineWidth=3+hash1(i*13)*5;
                ctx.beginPath();
                ctx.moveTo(x,0);
                ctx.lineTo(x,len);
                ctx.stroke();
                ctx.fillStyle=rgba('red',0.6);
                ctx.beginPath();
                ctx.arc(x,len,ctx.lineWidth*0.9,0,Math.PI*2);
                ctx.fill();
            }
        }
    }

    drawBody(ctx) {
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const U=TUNING.summaryUi;
        const sc=Math.max(0.55,Math.min(1,Math.min(w/900,h/760)));
        const small=h<600;
        this.drawBackdrop(ctx,v);
        const d0=this.victory||this.quit?0.25:1.0;
        const T=this.t-d0;
        const title=this.victory?t('summary.victory'):(this.quit?t('summary.quit'):t('summary.dead'));
        const ty=(small?14:30)+44*sc;
        const st=Math.max(0,Math.min(1,T/U.stampTime));
        if (st>0) {
            const e=st<1?2.4-1.4*EASE.easeOutBack(st):1;
            ctx.save();
            ctx.translate(w/2,ty);
            ctx.rotate(-0.04*(1-st)+(this.victory?-0.03:0.02));
            ctx.scale(e*sc,e*sc);
            ctx.globalAlpha=Math.min(1,st*2);
            ctx.font='bold 60px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            const tw=ctx.measureText(title).width;
            const col=this.victory?PALETTE.red:(this.quit?PALETTE.ink:PALETTE.darkRed);
            drawShape(ctx,sketchRect(-tw/2-26,-44,tw+52,88,{width:4,seed:931}),col,v);
            drawShape(ctx,sketchRect(-tw/2-18,-36,tw+36,72,{width:1.6,seed:932}),col,v);
            ctx.fillStyle=col;
            ctx.fillText(title,0,2);
            ctx.restore();
            if (st>=1&&T<U.stampTime+0.25) {
                const k=(T-U.stampTime)/0.25;
                ctx.save();
                ctx.strokeStyle=rgba('ink',1-k);
                ctx.lineWidth=3;
                for (let i=0;i<14;i++) {
                    const a=i/14*Math.PI*2;
                    const r0=160*sc+k*60*sc;
                    ctx.beginPath();
                    ctx.moveTo(w/2+Math.cos(a)*r0,ty+Math.sin(a)*r0*0.45);
                    ctx.lineTo(w/2+Math.cos(a)*(r0+30*sc),ty+Math.sin(a)*(r0+30*sc)*0.45);
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
        const s=this.stats;
        const sub=(s.mode==='endless'?t('mode.endless'):t('mode.story'))+(s.mode==='endless'?'':' · '+t('summary.actN',{n:s.act+(this.victory?0:1)}));
        ctx.globalAlpha=Math.max(0,Math.min(1,(T-0.3)/0.3));
        ctx.font=(small?'13px ':'16px ')+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const subY=ty+44*sc+(small?12:16);
        ctx.fillText(sub,w/2,subY);
        ctx.globalAlpha=1;
        const sy=subY+(small?14:20)+52*sc;
        const sp=Math.max(0,Math.min(1,(T-0.45)/U.countTime));
        if (T>0.45) {
            const shown=Math.round(s.score*EASE.easeOutCubic(sp));
            const bump=sp<1?0:Math.max(0,1-(T-0.45-U.countTime)*4);
            ctx.save();
            ctx.translate(w/2,sy);
            ctx.scale(sc*(1+bump*0.15),sc*(1+bump*0.15));
            ctx.font='bold 13px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(t('summary.score'),0,-48);
            ctx.font='900 '+(small?58:72)+'px '+FONT;
            ctx.fillStyle=rgba('ink',0.2);
            ctx.fillText(String(shown),4,6);
            ctx.lineWidth=8;
            ctx.lineJoin='round';
            ctx.strokeStyle=PALETTE.paper;
            ctx.strokeText(String(shown),0,2);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(String(shown),0,2);
            ctx.font='14px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(t('summary.best')+' '+s.best,0,46);
            ctx.restore();
            if (s.newBest&&sp>=1) {
                const k=Math.min(1,(T-0.45-U.countTime)/0.3);
                const e=k<1?2-EASE.easeOutBack(k):1;
                ctx.save();
                ctx.translate(w/2+150*sc,sy-34*sc);
                ctx.rotate(0.22);
                ctx.scale(e*sc,e*sc);
                ctx.globalAlpha=Math.min(1,k*2);
                ctx.font='bold 20px '+FONT;
                const nw=ctx.measureText(t('summary.newBest')).width+24;
                ctx.fillStyle=PALETTE.red;
                ctx.fillRect(-nw/2,-17,nw,34);
                ctx.fillStyle=PALETTE.paper;
                ctx.fillText(t('summary.newBest'),0,1);
                ctx.restore();
            }
        }
        const gk=Math.max(0,Math.min(1,(T-0.45-U.countTime-0.2)/0.5));
        if (gk>0) {
            const gx=w/2-170*sc;
            const gy=sy;
            const R=44*sc;
            ctx.save();
            ctx.strokeStyle=PALETTE.red;
            ctx.lineWidth=4*sc;
            ctx.lineCap='round';
            ctx.beginPath();
            ctx.ellipse(gx,gy,R*1.08,R*0.92,-0.2,-1.2,-1.2+Math.PI*2.15*Math.min(1,gk*1.4));
            ctx.stroke();
            const lk=Math.max(0,(gk-0.35)/0.65);
            if (lk>0) {
                const e=2.2-1.2*EASE.easeOutBack(Math.min(1,lk));
                ctx.translate(gx,gy);
                ctx.rotate(-0.12);
                ctx.scale(e*sc,e*sc);
                ctx.globalAlpha=Math.min(1,lk*2);
                ctx.font='italic 900 62px Georgia,serif';
                ctx.fillStyle=PALETTE.red;
                ctx.textAlign='center';
                ctx.textBaseline='middle';
                ctx.fillText(this.grade(),0,3);
            }
            ctx.restore();
            this.gradeRect={x:gx-R*1.2,y:gy-R*1.1,w:R*2.4,h:R*2.2};
            if (lk>=1&&(this.gradeOpen||inRect(this.gradeRect,this.hx??-1,this.hy??-1))) {
                this.gradeInfo={x:gx,y:gy+R*1.1};
            }
            else {
                this.gradeInfo=null;
            }
        }
        const mm=Math.floor(s.time/60);
        const ss=Math.floor(s.time%60);
        const tiles=[
            ['rooms',s.rooms],
            ['kills',s.kills],
            ['cards',s.cards],
            ['bosses',s.bosses],
            ['damage',s.taken??s.damage],
            ['time',mm+':'+(ss<10?'0':'')+ss]
        ];
        const cols=w<520?3:6;
        const rowsN=Math.ceil(tiles.length/cols);
        const gap=10*sc;
        const tw=Math.min(150,(Math.min(w-40,900)-gap*(cols-1))/cols);
        const th=small?52:68*Math.max(0.8,sc);
        const gx0=w/2-(tw*cols+gap*(cols-1))/2;
        const gy0=sy+56*sc+(small?10:14);
        for (let i=0;i<tiles.length;i++) {
            const c=i%cols;
            const r=Math.floor(i/cols);
            const k=Math.max(0,Math.min(1,(T-0.7-i*0.07)/0.35));
            if (k<=0) {
                continue;
            }
            const x=gx0+c*(tw+gap);
            const y=gy0+r*(th+gap);
            const flip=EASE.easeOutBack(k);
            ctx.save();
            ctx.translate(x+tw/2,y+th/2);
            ctx.rotate((hash1(i*29)-0.5)*0.06);
            ctx.scale(1,flip);
            ctx.fillStyle=rgba('paper',0.96);
            ctx.fillRect(-tw/2,-th/2,tw,th);
            ctx.fillStyle=rgba('ink',0.08);
            ctx.fillRect(-tw/2+3,th/2,tw,3);
            drawShape(ctx,sketchRect(-tw/2,-th/2,tw,th,{width:1.6,seed:940+i}),PALETTE.ink,v);
            ctx.fillStyle=rgba('farGray',0.9);
            ctx.fillRect(-14,-th/2-4,28,8);
            ctx.font=(small?'11px ':'13px ')+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('summary.'+tiles[i][0]),0,-th*0.22);
            const val=tiles[i][1];
            const nk=Math.max(0,Math.min(1,(T-0.8-i*0.07)/0.5));
            const txt=typeof val==='number'?String(Math.round(val*EASE.easeOutCubic(nk))):val;
            ctx.font='bold '+(small?18:24)+'px '+FONT;
            ctx.fillStyle=tiles[i][0]==='damage'&&val>0?PALETTE.red:PALETTE.ink;
            ctx.fillText(txt,0,th*0.18);
            ctx.restore();
        }
        let y=gy0+rowsN*(th+gap)+(small?6:16);
        const pr=this.progress;
        if (pr) {
            const k=Math.max(0,Math.min(1,(T-1.2)/0.3));
            ctx.globalAlpha=k;
            const bw=Math.min(460,w-60);
            const bx=w/2-bw/2;
            const bh=small?10:14;
            const fk=Math.max(0,Math.min(1,(T-1.4)/U.xpTime));
            const lvUp=pr.after>pr.before;
            let frac;
            let lv;
            if (!lvUp) {
                frac=pr.xpFrom+(pr.xpTo-pr.xpFrom)*EASE.easeOutCubic(fk);
                lv=pr.before;
            }
            else if (fk<0.5) {
                frac=pr.xpFrom+(1-pr.xpFrom)*EASE.easeInCubic(fk*2);
                lv=pr.before;
            }
            else {
                frac=pr.xpTo*EASE.easeOutCubic((fk-0.5)*2);
                lv=pr.after;
            }
            ctx.font='bold '+(small?13:15)+'px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='middle';
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(t('menu.level',{level:lv}),bx,y);
            ctx.textAlign='right';
            ctx.fillStyle=pr.god?PALETTE.nearGray:PALETTE.ink;
            ctx.fillText(pr.god?t('summary.god'):t('summary.xp',{xp:pr.xp}),bx+bw,y);
            const yb=y+(small?14:18);
            ctx.fillStyle=rgba('farGray',0.8);
            ctx.fillRect(bx,yb,bw,bh);
            ctx.fillStyle=lvUp&&fk>=0.5?PALETTE.red:PALETTE.ink;
            ctx.fillRect(bx,yb,bw*Math.max(0,Math.min(1,frac)),bh);
            drawShape(ctx,sketchRect(bx,yb,bw,bh,{width:1.4,seed:960}),PALETTE.ink,v);
            y=yb+bh+(small?14:20);
            if (lvUp&&fk>=0.5) {
                const lk=Math.min(1,(fk-0.5)*4);
                ctx.save();
                ctx.translate(w/2,yb-(small?14:18));
                const e=2-EASE.easeOutBack(lk);
                ctx.scale(e,e);
                ctx.globalAlpha=k*Math.min(1,lk*2);
                ctx.font='bold '+(small?16:20)+'px '+FONT;
                ctx.fillStyle=PALETTE.red;
                ctx.textAlign='center';
                ctx.fillText(t('summary.levelUp',{level:pr.after}),0,0);
                ctx.restore();
            }
            if (pr.unlocked.length>0&&fk>=1) {
                ctx.font=(small?'12px ':'14px ')+FONT;
                ctx.fillStyle=PALETTE.nearGray;
                ctx.textAlign='center';
                ctx.fillText(t('summary.unlocked',{cards:pr.unlocked.join(t('ui.list'))}),w/2,y);
                y+=small?18:24;
            }
            ctx.globalAlpha=1;
        }
        const bw=small?140:180;
        const bh=small?42:52;
        const D=U.drawer;
        const by=Math.min(h-bh-(small?D.peekSmall:D.peek)-12,y+(small?2:8));
        const bg=14;
        const x0=w/2-(bw*2+bg)/2;
        this.button={x:x0,y:by,w:bw,h:bh};
        this.menuButton={x:x0+bw+bg,y:by,w:bw,h:bh};
        const ba=(T-1.3)/0.35;
        drawButton(ctx,this.button,t('summary.restart'),v,ba,inRect(this.button,this.hx??-1,this.hy??-1),small?17:20);
        drawButton(ctx,this.menuButton,t('summary.menu'),v,ba-0.15,inRect(this.menuButton,this.hx??-1,this.hy??-1),small?17:20,true);
        if (s.newBest) {
            this.drawCelebrate(ctx,T,v);
        }
        if (this.gradeInfo) {
            this.drawGradeInfo(ctx,this.gradeInfo.x,this.gradeInfo.y,v);
        }
        this.drawDetail(ctx,v,T);
    }

    drawCelebrate(ctx,T,v) {
        const U=TUNING.summaryUi.best;
        const w=this.width;
        const h=this.height;
        const k=T-U.at;
        if (k<0) {
            return;
        }
        ctx.save();
        for (let i=0;i<U.bursts;i++) {
            const bt=k-i*U.gap;
            if (bt<0||bt>U.life) {
                continue;
            }
            const f=bt/U.life;
            const bx=w*(0.12+hash1(i*3.7)*0.76);
            const by=h*(0.12+hash1(i*5.3)*0.5);
            const rad=EASE.easeOutCubic(f)*(60+hash1(i*1.9)*80);
            for (let j=0;j<U.sparks;j++) {
                const a=j/U.sparks*Math.PI*2+i;
                const col=j%3===0?'red':(j%3===1?'ink':'marker');
                ctx.fillStyle=rgba(col,1-f);
                ctx.beginPath();
                ctx.arc(bx+Math.cos(a)*rad,by+Math.sin(a)*rad+f*f*30,3.5*(1-f)+1,0,Math.PI*2);
                ctx.fill();
            }
        }
        for (let i=0;i<U.strips;i++) {
            const sp=40+hash1(i*2.3)*70;
            const yy=((k*sp+hash1(i*7.1)*h)%(h+40))-20;
            const xx=w*hash1(i*4.9)+Math.sin(k*2+i)*16;
            ctx.save();
            ctx.globalAlpha=Math.min(1,k*2)*0.85;
            ctx.translate(xx,yy);
            ctx.rotate(k*3+i);
            ctx.fillStyle=i%3===0?PALETTE.red:(i%3===1?PALETTE.ink:rgba('marker',1));
            ctx.fillRect(-5,-2,10,4);
            ctx.restore();
        }
        const sk=Math.min(1,k/U.stampTime);
        const sc=sk<1?2.4-1.4*EASE.easeOutBack(sk):1+Math.sin(time.real*4)*0.03;
        ctx.translate(w*U.x,h*U.y);
        ctx.rotate(U.rot);
        ctx.scale(sc,sc);
        ctx.globalAlpha=Math.min(1,sk*3);
        ctx.font='bold '+(h<600?26:36)+'px '+FONT;
        const tw=ctx.measureText(t('summary.celebrate')).width+36;
        const th=h<600?42:56;
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(-tw/2,-th/2,tw,th);
        drawShape(ctx,sketchRect(-tw/2,-th/2,tw,th,{width:2.2,seed:977}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.paper;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('summary.celebrate'),0,2);
        ctx.restore();
    }

    tornPaper(ctx,x,y,w,h,seed) {
        ctx.beginPath();
        ctx.moveTo(x+(hash1(seed)-0.5)*4,h+20);
        ctx.lineTo(x-3,y+8);
        let xx=x;
        let i=0;
        while (xx<x+w) {
            const step=8+hash1(seed+i*5)*26;
            xx=Math.min(x+w,xx+step);
            const deep=hash1(seed+i*11)>0.8?14:0;
            const jag=(hash1(seed+i*7)-0.5)*16+(i%2?6:-5)+deep;
            ctx.lineTo(xx,y+jag);
            i++;
        }
        ctx.lineTo(x+w+3,y+6);
        ctx.lineTo(x+w+(hash1(seed+1)-0.5)*4,h+20);
        ctx.closePath();
    }

    drawDetail(ctx,v,T) {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const D=TUNING.summaryUi.drawer;
        const k=this.detailT;
        const ek=EASE.easeOutCubic(k);
        const de=this.drawerE();
        const appear=Math.max(0,Math.min(1,(T-1.5)/0.4));
        if (appear<=0) {
            return;
        }
        const {x:px,w:pw}=this.drawerRect();
        const peek=small?D.peekSmall:D.peek;
        const top=this.drawerTop()+(1-EASE.easeOutBack(appear))*peek*1.4;
        const hov=!this.detail&&(this.hy??-1)>=top&&(this.hx??-1)>=px&&(this.hx??-1)<=px+pw;
        const bob=this.detail?0:Math.sin(time.real*3)*2-(hov?4:0);
        const py=top+bob;
        ctx.save();
        if (k>0) {
            ctx.fillStyle=rgba('ink',0.28*ek);
            ctx.fillRect(0,0,w,h);
        }
        const tilt=(this.detail?Math.sin(de*Math.PI)*D.tilt:-Math.sin(k*Math.PI)*D.tilt)*(k<1?1:0);
        ctx.translate(w/2,h);
        ctx.rotate(tilt);
        ctx.translate(-w/2,-h);
        ctx.save();
        ctx.translate(4,6);
        this.tornPaper(ctx,px,py,pw,h,5100);
        ctx.fillStyle=rgba('ink',0.18);
        ctx.fill();
        ctx.restore();
        this.tornPaper(ctx,px,py,pw,h,5100);
        ctx.fillStyle=PALETTE.paper;
        ctx.fill();
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=1.6;
        ctx.stroke();
        ctx.save();
        ctx.clip();
        ctx.strokeStyle=rgba('farGray',0.7);
        ctx.lineWidth=1;
        for (let yy=py+peek;yy<h;yy+=24) {
            ctx.beginPath();
            ctx.moveTo(px,yy);
            ctx.lineTo(px+pw,yy);
            ctx.stroke();
        }
        const head=small?D.headSmall:D.head;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?16:20)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const ty=py+peek*0.5;
        ctx.fillText((k>0.5?t('summary.detailTitle'):t('summary.details'))+' '+(this.detail?'▾':'▴'),w/2,ty);
        ctx.font=(small?'10px ':'12px ')+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='right';
        ctx.fillText(this.detail?t('summary.detailBack'):t('summary.detailHint'),px+pw-16,ty);
        if (k>0) {
            this.drawDetailTable(ctx,v,px,py+head,pw,h-(py+head),small);
        }
        ctx.restore();
        ctx.restore();
    }

    drawDetailTable(ctx,v,px,y0,pw,avail,small) {
        const D=TUNING.summaryUi.drawer;
        const w=this.width;
        const h=this.height;
        const rh=small?D.rowSmall:D.row;
        const gap=D.actGap;
        const items=this.detailItems();
        const cols=[['page',0.02,'left'],['name',0.11,'left'],['kills',0.42,'right'],['cards',0.5,'right'],['time',0.58,'right'],['dealt',0.68,'right'],['taken',0.77,'right'],['score',0.875,'right'],['total',0.98,'right']];
        const fs=Math.max(9,Math.min(small?12:14,pw/62));
        const hy=y0+rh*0.4;
        const ra=EASE.easeOutCubic(Math.max(0,Math.min(1,(this.detailT-D.rowsAt)/(1-D.rowsAt))));
        ctx.save();
        ctx.globalAlpha*=ra;
        ctx.font='bold '+Math.round(fs-1)+'px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textBaseline='middle';
        for (const [key,f,al] of cols) {
            ctx.textAlign=al;
            ctx.fillText(t('summary.col.'+key),px+pw*f,hy,pw*0.1);
        }
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=1.2;
        ctx.beginPath();
        ctx.moveTo(px+12,hy+rh*0.5);
        ctx.lineTo(px+pw-12,hy+rh*0.5);
        ctx.stroke();
        ctx.restore();
        const vt=hy+rh*0.5+2;
        const vh=h-vt-D.bottomPad;
        this.dView={x:px,y:vt,w:pw,h:vh};
        let total=0;
        items.forEach((it,i)=>{
            total+=it.head?rh*0.8+(i>0?gap:0):rh;
        });
        this.dContent=total+D.endPad;
        this.dMax=Math.max(0,this.dContent-vh);
        this.dScrollTo=Math.max(0,Math.min(this.dMax,this.dScrollTo));
        ctx.save();
        ctx.beginPath();
        ctx.rect(px,vt,pw,vh);
        ctx.clip();
        let y=vt-this.dScroll;
        let alt=0;
        let row=0;
        for (let i=0;i<items.length;i++) {
            const it=items[i];
            const ih=it.head?rh*0.8+(i>0?gap:0):rh;
            if (y>h||y+ih<vt) {
                y+=ih;
                alt=it.head?0:alt+1;
                continue;
            }
            const q=EASE.easeOutCubic(Math.max(0,Math.min(1,(this.detailT-D.rowsAt-row*D.rowStagger)/(1-D.rowsAt))));
            row++;
            ctx.save();
            ctx.globalAlpha*=q;
            ctx.translate(0,(1-q)*D.rowRise);
            if (it.head) {
                if (i>0) {
                    ctx.strokeStyle=rgba('ink',0.55);
                    ctx.lineWidth=1;
                    ctx.setLineDash([6,4]);
                    ctx.beginPath();
                    ctx.moveTo(px+12,y+gap/2);
                    ctx.lineTo(px+pw-12,y+gap/2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
                const hy2=y+(i>0?gap:0);
                ctx.font='bold '+Math.round(fs)+'px '+FONT;
                ctx.fillStyle=PALETTE.red;
                ctx.textAlign='left';
                ctx.textBaseline='middle';
                ctx.fillText(it.label,px+pw*0.02,hy2+rh*0.4);
                alt=0;
            }
            else {
                const cy=y+rh*0.5;
                if (alt%2===0) {
                    ctx.fillStyle=rgba('farGray',0.35);
                    ctx.fillRect(px+12,y+1,pw-24,rh-2);
                }
                alt++;
                const vals={page:it.page,name:it.name+(it.sub?'・'+it.sub:''),kills:String(it.kills),cards:String(it.cards),time:Math.round(it.time)+'s',dealt:String(it.dealt),taken:String(it.taken),score:(it.score>0?'+':'')+it.score,total:String(it.total)};
                ctx.textBaseline='middle';
                for (const [key,f,al] of cols) {
                    ctx.textAlign=al;
                    ctx.font=(key==='total'?'bold ':'')+Math.round(fs)+'px '+FONT;
                    let col=PALETTE.ink;
                    if (key==='page') {
                        col=PALETTE.nearGray;
                    }
                    else if (key==='score'&&it.score<0||key==='taken'&&it.taken>0) {
                        col=PALETTE.red;
                    }
                    ctx.fillStyle=col;
                    ctx.fillText(vals[key],px+pw*f,cy,key==='name'?pw*0.29:pw*0.085);
                }
            }
            ctx.restore();
            y+=ih;
        }
        ctx.restore();
        if (items.length===0) {
            ctx.fillStyle=PALETTE.nearGray;
            ctx.textAlign='center';
            ctx.font=Math.round(fs)+'px '+FONT;
            ctx.fillText(t('summary.noDetail'),w/2,hy+rh*2);
        }
        if (this.dMax>0) {
            const th=Math.max(D.barMin,vh*vh/this.dContent);
            const tyy=vt+(vh-th)*(this.dScroll/this.dMax);
            ctx.fillStyle=rgba('midGray',0.55*ra);
            ctx.fillRect(px+pw-8,tyy,4,th);
            if (this.dScroll<this.dMax-2) {
                const fade=ctx.createLinearGradient(0,h-D.fadeH,0,h);
                fade.addColorStop(0,rgba('paper',0));
                fade.addColorStop(1,rgba('paper',0.95));
                ctx.fillStyle=fade;
                ctx.fillRect(px,h-D.fadeH,pw,D.fadeH);
                ctx.fillStyle=rgba('nearGray',ra*(0.6+0.4*Math.sin(time.real*4)));
                ctx.font=(small?'10px ':'12px ')+FONT;
                ctx.textAlign='center';
                ctx.fillText(t('summary.swipe'),w/2,h-D.bottomPad);
            }
        }
    }
}

export class TrainingPicker extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.upgraded=false;
        this.upAnim=0;
        this.scroll=0;
        this.scrollTo=0;
        this.drag=null;
        this.hits=[];
        this.hoverId=null;
        this.contentH=0;
        this.view={x:0,y:0,w:1,h:1};
        this.toggle={x:0,y:0,w:0,h:0};
        this.backBtn={x:0,y:0,w:0,h:0};
        this.okBtn={x:0,y:0,w:0,h:0};
        this.touch=false;
        this.sel=[];
    }

    show() {
        super.show();
        this.scroll=0;
        this.scrollTo=0;
        this.hoverId=null;
        this.drag=null;
        this.sel=[];
    }

    toggleSel(id) {
        const i=this.sel.indexOf(id);
        if (i>=0) {
            this.sel.splice(i,1);
            return;
        }
        const rare=CARDS[id].rarity==='rare';
        const same=this.sel.filter(q=>(CARDS[q].rarity==='rare')===rare);
        if (same.length>=(rare?1:TUNING.deck.handSize)) {
            this.sel.splice(this.sel.indexOf(same[0]),1);
        }
        this.sel.push(id);
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const vw=Math.min(1100,w-40);
        const top=h<600?76:106;
        this.view={x:w/2-vw/2,y:top,w:vw,h:h-top-(h<600?64:84)};
        this.toggle={x:this.view.x+vw-170,y:top-46,w:170,h:32};
        const bh=h<600?44:50;
        const by=h-(h<600?54:68);
        if (this.startMode) {
            const bw=Math.min(180,(w-60)/3);
            const x0=w/2-(bw*3+32)/2;
            this.homeBtn={x:x0,y:by,w:bw,h:bh};
            this.backBtn={x:x0+bw+16,y:by,w:bw,h:bh};
            this.okBtn={x:x0+(bw+16)*2,y:by,w:bw,h:bh};
        }
        else {
            this.backBtn={x:w/2-200,y:by,w:180,h:bh};
            this.okBtn={x:w/2+20,y:by,w:180,h:bh};
            this.homeBtn={x:0,y:0,w:0,h:0};
        }
    }

    lists() {
        const ids=unlockedCards(effectiveLevel());
        return [ids.filter(id=>CARDS[id].rarity!=='rare'),ids.filter(id=>CARDS[id].rarity==='rare')];
    }

    scale() {
        const P=TUNING.trainPicker;
        return Math.max(P.minScale,Math.min(P.maxScale,this.height/P.refH));
    }

    clampScroll() {
        const max=Math.max(0,this.contentH-this.view.h);
        this.scrollTo=Math.max(0,Math.min(max,this.scrollTo));
    }

    wheel(dy) {
        if (!this.open) {
            return;
        }
        this.scrollTo+=dy;
        this.clampScroll();
    }

    hitCard(x,y) {
        if (!inRect(this.view,x,y)) {
            return null;
        }
        for (const q of this.hits) {
            if (inRect(q,x,y)) {
                return q.id;
            }
        }
        return null;
    }

    hover(x,y) {
        super.hover(x,y);
        if (!this.drag) {
            this.hoverId=this.hitCard(x,y);
        }
    }

    clearHover() {
        super.hover(TUNING.input.far,TUNING.input.far);
    }

    down(x,y,type) {
        if (!this.open) {
            return false;
        }
        this.layout();
        this.touch=type!=='mouse';
        if (this.startMode&&inRect(this.homeBtn,x,y)) {
            this.actions.home();
            return true;
        }
        if (inRect(this.backBtn,x,y)) {
            if (this.startMode) {
                this.actions.random();
            }
            else {
                this.actions.back();
            }
            return true;
        }
        if (inRect(this.okBtn,x,y)) {
            if (this.sel.length>0) {
                this.actions.pick(this.sel.slice(),this.upgraded);
            }
            return true;
        }
        if (inRect(this.toggle,x,y)) {
            this.upgraded=!this.upgraded;
            if (this.actions.select) {
                this.actions.select();
            }
            return true;
        }
        if (inRect(this.view,x,y)) {
            this.drag={y0:y,x0:x,s0:this.scrollTo,moved:false};
        }
        else {
            this.hoverId=null;
        }
        return true;
    }

    move(x,y) {
        const d=this.drag;
        if (!d) {
            return;
        }
        if (Math.hypot(x-d.x0,y-d.y0)>8) {
            d.moved=true;
        }
        if (d.moved) {
            this.scrollTo=d.s0-(y-d.y0);
            this.clampScroll();
            this.scroll=this.scrollTo;
        }
    }

    up(x,y) {
        const d=this.drag;
        this.drag=null;
        if (!this.open||!d||d.moved||x===undefined) {
            return;
        }
        const id=this.hitCard(x,y);
        if (!id) {
            this.hoverId=null;
            return;
        }
        if (this.touch&&this.hoverId!==id) {
            this.hoverId=id;
            return;
        }
        this.toggleSel(id);
        if (this.actions.select) {
            this.actions.select();
        }
    }

    update(dt) {
        super.update(dt);
        this.scroll+=(this.scrollTo-this.scroll)*(1-Math.exp(-TUNING.codex.follow*dt));
        this.upAnim+=((this.upgraded?1:0)-this.upAnim)*(1-Math.exp(-TUNING.codex.toggleFollow*dt));
    }

    draw(ctx,art) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const a=Math.min(1,this.t/0.3);
        const V=this.view;
        ctx.save();
        ctx.globalAlpha=a;
        ctx.fillStyle=rgba('paper',0.93);
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(h<600?22:28)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t(this.startMode?'training.startTitle':'training.pickTitle'),V.x,this.toggle.y+this.toggle.h/2);
        ctx.font='13px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='right';
        ctx.fillText(t(this.touch||device.mobile?'training.pickHintTouch':'training.pickHint'),this.toggle.x-16,this.toggle.y+this.toggle.h/2);
        drawToggle(ctx,this.toggle,[t('codex.base'),t('codex.plus')],this.upAnim,v);
        const sc=this.scale();
        const cw=CARD_W*sc;
        const ch=CARD_H*sc;
        const gap=14;
        const cols=Math.max(1,Math.floor((V.w+gap)/(cw+gap)));
        const x0=V.x+(V.w-(cols*cw+(cols-1)*gap))/2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(V.x-10,V.y,V.w+20,V.h);
        ctx.clip();
        this.hits=[];
        let y=V.y-this.scroll;
        let hovered=null;
        const lists=this.lists();
        for (let li=0;li<2;li++) {
            const list=lists[li];
            if (list.length===0) {
                continue;
            }
            ctx.fillStyle=li===1?PALETTE.red:PALETTE.ink;
            ctx.font='bold 17px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='top';
            ctx.fillText(t(li===1?'training.rare':'training.normal',{n:list.length}),V.x,y+6);
            y+=36;
            for (let i=0;i<list.length;i++) {
                const id=list[i];
                const cx=x0+(i%cols)*(cw+gap);
                const cy=y+Math.floor(i/cols)*(ch+gap+6);
                const card=createCard(id,this.upgraded);
                const hov=this.hoverId===id;
                const r={x:cx,y:cy,w:cw,h:ch,id};
                this.hits.push(r);
                if (cy>V.y+V.h||cy+ch<V.y) {
                    continue;
                }
                const p=Math.max(0,Math.min(1,(this.t-0.05-Math.min(i,12)*0.02)/0.3));
                ctx.save();
                ctx.globalAlpha=a*p;
                ctx.translate(cx+cw/2,cy+ch/2-(hov?8:0)+(1-p)*20);
                ctx.scale(sc*(hov?1.06:1),sc*(hov?1.06:1));
                ctx.translate(-CARD_W/2,-CARD_H/2);
                ctx.fillStyle=rgba('ink',hov?0.28:0.14);
                ctx.fillRect(hov?7:4,hov?7:4,CARD_W,CARD_H);
                ctx.drawImage(art.face(card,v),0,0,CARD_W,CARD_H);
                drawCost(ctx,card,false,v);
                const si=this.sel.indexOf(id);
                if (si>=0) {
                    ctx.fillStyle=rgba(li===1?'red':'ink',0.12);
                    ctx.fillRect(0,0,CARD_W,CARD_H);
                    ctx.strokeStyle=li===1?PALETTE.red:PALETTE.ink;
                    ctx.lineWidth=6;
                    ctx.strokeRect(-6,-6,CARD_W+12,CARD_H+12);
                    ctx.fillStyle=ctx.strokeStyle;
                    ctx.beginPath();
                    ctx.arc(CARD_W+2,-2,15,0,Math.PI*2);
                    ctx.fill();
                    ctx.fillStyle=PALETTE.paper;
                    ctx.font='bold 17px '+FONT;
                    ctx.textAlign='center';
                    ctx.textBaseline='middle';
                    ctx.fillText('✓',CARD_W+2,-1);
                }
                if (hov) {
                    ctx.strokeStyle=li===1?PALETTE.red:PALETTE.ink;
                    ctx.lineWidth=3;
                    ctx.strokeRect(-3,-3,CARD_W+6,CARD_H+6);
                    hovered={card,x:cx+cw/2,y:cy};
                }
                ctx.restore();
            }
            y+=Math.ceil(list.length/cols)*(ch+gap+6)+14;
        }
        this.contentH=y+this.scroll-V.y;
        ctx.restore();
        this.clampScroll();
        drawButton(ctx,this.backBtn,t(this.startMode?'training.random':'menu.back'),v,(this.t-0.1)/0.3,this.hoverIdx===0);
        if (this.startMode) {
            drawButton(ctx,this.homeBtn,t('training.home'),v,(this.t-0.15)/0.3,this.hoverIdx===2,h<600?14:16,true);
        }
        const n=this.sel.length;
        if (n>0) {
            ctx.save();
            ctx.globalAlpha*=Math.min(1,(this.t-0.15)/0.3);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(this.okBtn.x,this.okBtn.y,this.okBtn.w,this.okBtn.h);
            drawShape(ctx,sketchRect(this.okBtn.x,this.okBtn.y,this.okBtn.w,this.okBtn.h,{width:2,seed:1502}),PALETTE.ink,v);
            ctx.fillStyle=PALETTE.paper;
            ctx.font='bold 18px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('training.confirm',{n}),this.okBtn.x+this.okBtn.w/2,this.okBtn.y+this.okBtn.h/2+1);
            ctx.restore();
        }
        else {
            ctx.fillStyle=PALETTE.midGray;
            ctx.font='13px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('training.pickNone'),this.okBtn.x+this.okBtn.w/2,this.okBtn.y+this.okBtn.h/2);
        }
        this.buttons=this.startMode?[this.backBtn,this.okBtn,this.homeBtn]:[this.backBtn,this.okBtn];
        if (hovered&&!this.drag) {
            const below=hovered.y<V.y+140;
            drawCardTooltip(ctx,hovered.card,Math.max(150,Math.min(w-150,hovered.x)),below?hovered.y+ch+170:hovered.y-10);
        }
        ctx.restore();
    }
}

export class LevelView extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.scroll=0;
        this.scrollTo=0;
        this.drag=null;
        this.contentH=0;
        this.view={x:0,y:0,w:1,h:1};
        this.backBtn={x:0,y:0,w:0,h:0};
    }

    show() {
        super.show();
        this.jump=true;
        this.scrollTo=0;
        this.scroll=0;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const pw=Math.min(680,w-32);
        const py=Math.max(12,h*0.05);
        this.P={x:w/2-pw/2,y:py,w:pw,h:h-py*2};
        const head=h<600?112:150;
        this.view={x:this.P.x+18,y:this.P.y+head,w:pw-36,h:this.P.h-head-(h<600?62:76)};
        this.backBtn={x:w/2-90,y:this.P.y+this.P.h-(h<600?54:64),w:180,h:h<600?42:48};
        this.buttons=[this.backBtn];
    }

    clampScroll() {
        this.scrollTo=Math.max(0,Math.min(Math.max(0,this.contentH-this.view.h),this.scrollTo));
    }

    wheel(dy) {
        if (!this.open) {
            return;
        }
        this.scrollTo+=dy;
        this.clampScroll();
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.backBtn,x,y)) {
            this.actions.back();
            return true;
        }
        if (inRect(this.view,x,y)) {
            this.drag={y0:y,s0:this.scrollTo};
        }
        return true;
    }

    move(x,y) {
        if (!this.drag) {
            return;
        }
        this.scrollTo=this.drag.s0-(y-this.drag.y0);
        this.clampScroll();
        this.scroll=this.scrollTo;
    }

    up() {
        this.drag=null;
    }

    update(dt) {
        super.update(dt);
        this.scroll+=(this.scrollTo-this.scroll)*(1-Math.exp(-TUNING.codex.follow*dt));
    }

    chips(ctx,ids,x,y,maxW,v,dim) {
        let cx=x;
        let cy=y;
        ctx.font='13px '+FONT;
        ctx.textBaseline='middle';
        ctx.textAlign='left';
        for (const id of ids) {
            const rare=CARDS[id].rarity==='rare';
            const label=t(CARDS[id].nameKey);
            const cw=ctx.measureText(label).width+16;
            if (cx+cw>x+maxW&&cx>x) {
                cx=x;
                cy+=28;
            }
            ctx.fillStyle=dim?rgba('farGray',0.5):(rare?rgba('red',0.1):rgba('paper',0.95));
            ctx.fillRect(cx,cy,cw,22);
            drawShape(ctx,sketchRect(cx,cy,cw,22,{width:1.1,seed:1400+id.length*7}),dim?PALETTE.midGray:(rare?PALETTE.red:PALETTE.ink),v);
            ctx.fillStyle=dim?PALETTE.midGray:(rare?PALETTE.red:PALETTE.ink);
            ctx.fillText(label,cx+8,cy+12);
            cx+=cw+8;
        }
        return cy+22-y;
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const P=this.P;
        const V=this.view;
        const a=Math.min(1,this.t/0.3);
        const e=EASE.easeOutBack(Math.min(1,this.t/0.4));
        ctx.save();
        ctx.globalAlpha=a;
        ctx.fillStyle=rgba('paper',0.8);
        ctx.fillRect(0,0,w,h);
        ctx.translate(w/2,h/2);
        ctx.scale(0.9+0.1*e,0.9+0.1*e);
        ctx.translate(-w/2,-h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:1410}),PALETTE.ink,v);
        const lv=effectiveLevel();
        const real=progress.level;
        ctx.fillStyle=PALETTE.ink;
        ctx.textAlign='center';
        ctx.textBaseline='top';
        ctx.font='bold '+(h<600?22:28)+'px '+FONT;
        ctx.fillText(t('levels.title'),w/2,P.y+(h<600?10:18));
        const need=xpToNext(real);
        const f=Math.min(1,progress.xp/need);
        const by=P.y+(h<600?44:62);
        const bx=P.x+24;
        const bw=P.w-48;
        ctx.font='bold 15px '+FONT;
        ctx.textAlign='left';
        ctx.fillText(real>=MAX_LEVEL?t('levels.max',{level:real}):t('levels.current',{level:real,xp:progress.xp,next:need}),bx,by);
        if (godMode()) {
            ctx.fillStyle=PALETTE.red;
            ctx.textAlign='right';
            ctx.fillText(t('menu.god'),bx+bw,by);
            ctx.textAlign='left';
        }
        ctx.fillStyle=rgba('farGray',0.8);
        ctx.fillRect(bx,by+24,bw,10);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(bx,by+24,bw*f,10);
        drawShape(ctx,sketchRect(bx,by+24,bw,10,{width:1.2,seed:1411}),PALETTE.ink,v);
        const L=TUNING.levels;
        ctx.font='12px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        const src=wrapText(ctx,t('levels.sources',{kill:L.xpKill,room:L.xpRoom,boss:L.xpBoss,act:L.xpAct,win:L.xpVictory}),bw);
        for (let i=0;i<src.length&&i<2;i++) {
            ctx.fillText(src[i],bx,by+42+i*16);
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(V.x-6,V.y,V.w+12,V.h);
        ctx.clip();
        let y=V.y-this.scroll;
        const R=TUNING.levelView;
        let total=0;
        for (let n=1;n<=MAX_LEVEL;n++) {
            if (n>1) {
                total+=xpToNext(n-1);
            }
            const reached=n<=lv;
            const cur=n===real;
            const ids=(UNLOCKS[n]||[]).slice().sort((a,b)=>(CARDS[a].rarity==='rare'?1:0)-(CARDS[b].rarity==='rare'?1:0));
            const tmpH=ids.length>0?R.rowH:48;
            const rowTop=y;
            if (cur) {
                this.curTop=rowTop+this.scroll-V.y;
            }
            ctx.fillStyle=cur?rgba('red',0.07):(reached?rgba('paper',0.9):rgba('farGray',0.35));
            ctx.fillRect(V.x,rowTop,V.w,tmpH-8);
            drawShape(ctx,sketchRect(V.x,rowTop,V.w,tmpH-8,{width:cur?2.2:1.2,seed:1420+n}),cur?PALETTE.red:(reached?PALETTE.ink:PALETTE.midGray),v);
            ctx.fillStyle=reached?PALETTE.ink:PALETTE.midGray;
            ctx.font='bold 18px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='top';
            ctx.fillText(t('menu.level',{level:n}),V.x+14,rowTop+10);
            ctx.font='12px '+FONT;
            ctx.fillStyle=cur?PALETTE.red:PALETTE.nearGray;
            const tag=cur?t('levels.here'):(reached?t('levels.done'):t('levels.need',{xp:total}));
            ctx.fillText(tag,V.x+14,rowTop+34);
            const ch=this.chips(ctx,ids,V.x+120,rowTop+10,V.w-134,v,!reached);
            y+=Math.max(tmpH,ch+26);
        }
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font='13px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(t('levels.beyond',{level:MAX_LEVEL}),V.x+4,y+4);
        y+=30;
        this.contentH=y+this.scroll-V.y;
        ctx.restore();
        if (this.jump) {
            this.jump=false;
            this.scrollTo=(this.curTop||0)-TUNING.levelView.focusPad;
            this.clampScroll();
            this.scroll=this.scrollTo;
        }
        this.clampScroll();
        drawButton(ctx,this.backBtn,t('menu.back'),v,(this.t-0.1)/0.3,this.hoverIdx===0);
        ctx.restore();
    }
}

function drawSkinFigure(ctx,x,y,s,skin,v,seed) {
    const T=SKIN_TONES;
    const tone=k=>T[skin[k]]||T[DEFAULT_SKIN[k]];
    const coat=tone('coat');
    const limbs=tone('limbs');
    const hat=tone('hat');
    const gear=tone('gear');
    const face=tone('face');
    const acc=ACCENTS[skin.accent]||ACCENTS.ink;
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    ctx.fillStyle=limbs[1];
    ctx.fillRect(-9,16,7,11);
    ctx.fillRect(2,16,7,11);
    ctx.fillStyle=gear[1];
    ctx.fillRect(-11,26,10,5);
    ctx.fillRect(1,26,10,5);
    ctx.fillStyle=coat[1];
    ctx.fillRect(-19,-6,7,14);
    ctx.fillRect(12,-6,7,14);
    ctx.fillStyle=limbs[2];
    ctx.fillRect(-19,7,7,2);
    ctx.fillRect(12,7,7,2);
    ctx.fillStyle=gear[1];
    ctx.beginPath();
    ctx.arc(-15.5,12,3.6,0,Math.PI*2);
    ctx.arc(15.5,12,3.6,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle=coat[1];
    ctx.fillRect(-12,-8,24,26);
    ctx.fillStyle=coat[0];
    ctx.fillRect(-12,-8,8,26);
    ctx.fillStyle=gear[1];
    ctx.fillRect(-12,8,24,4);
    ctx.fillStyle=face[0];
    ctx.fillRect(-2.5,8,5,4);
    ctx.fillStyle=acc;
    ctx.fillRect(-1,-3,2,2);
    ctx.fillRect(-1,2,2,2);
    ctx.fillStyle=hat[1];
    ctx.fillRect(-10,-11,20,5);
    ctx.fillStyle=face[0];
    ctx.beginPath();
    ctx.arc(0,-20,11,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle=hat[1];
    ctx.fillRect(-8,-31,16,3);
    ctx.fillStyle=hat[2];
    ctx.beginPath();
    ctx.moveTo(-5,-30);
    ctx.lineTo(5,-30);
    ctx.lineTo(1,-40);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle=acc;
    ctx.fillRect(-5,-22,2.4,5);
    ctx.fillRect(2.6,-22,2.4,5);
    drawShape(ctx,sketchRect(-12,-8,24,26,{width:1.4,seed}),PALETTE.ink,v);
    drawShape(ctx,sketchCircle(0,-20,11,{width:1.4,seed:seed+1}),PALETTE.ink,v);
    ctx.restore();
}

function drawTone(ctx,x,y,r,tones,sel,v,seed) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.clip();
    for (let i=0;i<tones.length;i++) {
        ctx.fillStyle=tones[i];
        ctx.fillRect(x-r+i*(2*r/tones.length),y-r,2*r/tones.length+1,2*r);
    }
    ctx.restore();
    drawShape(ctx,sketchCircle(x,y,r,{width:sel?2.6:1.3,seed}),sel?PALETTE.red:PALETTE.ink,v);
    if (sel) {
        drawShape(ctx,sketchCircle(x,y,r+5,{width:1.6,seed:seed+3}),PALETTE.red,v);
    }
}

export class SkinEditor extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.hits=[];
        this.hx=-1;
        this.hy=-1;
        this.dragYaw=0;
        this.drag=null;
        this.pulse={};
        this.spin=0;
        this.sparks=[];
        this.sel={};
        this.scroll=0;
        this.scrollTo=0;
        this.contentH=0;
        this.V={x:0,y:0,w:0,h:0};
        this.press=null;
    }

    show() {
        super.show();
        this.dragYaw=0;
        this.drag=null;
        this.pulse={};
        this.spin=0;
        this.sparks=[];
        this.sel={};
        this.scroll=0;
        this.scrollTo=0;
        this.press=null;
    }

    clampScroll() {
        const max=Math.max(0,this.contentH-this.V.h);
        this.scrollTo=Math.max(0,Math.min(max,this.scrollTo));
    }

    wheel(dy) {
        if (!this.open) {
            return;
        }
        this.scrollTo+=dy;
        this.clampScroll();
    }

    update(dt) {
        super.update(dt);
        const U=TUNING.skinUi;
        for (const k in this.pulse) {
            this.pulse[k]=Math.max(0,this.pulse[k]-dt*U.pulseDecay);
        }
        this.spin=Math.max(0,this.spin-dt/U.spinTime);
        this.clampScroll();
        this.scroll+=(this.scrollTo-this.scroll)*Math.min(1,dt*TUNING.skinUi.scrollFollow);
        const cur=this.skin();
        const kk=1-Math.exp(-U.follow*dt);
        for (const part of SKIN_PARTS) {
            const list=part.tones||part.accents;
            const idx=list.indexOf(cur[part.key]);
            this.sel[part.key]=(this.sel[part.key]??idx)+(idx-(this.sel[part.key]??idx))*kk;
        }
        for (let i=this.sparks.length-1;i>=0;i--) {
            const q=this.sparks[i];
            q.t+=dt;
            q.x+=q.vx*dt;
            q.y+=q.vy*dt;
            q.vy+=U.sparkGrav*dt;
            if (q.t>q.life) {
                this.sparks.splice(i,1);
            }
        }
    }

    spinYaw() {
        return Math.PI*2*EASE.easeInOutCubic(1-this.spin)*(this.spin>0?1:0);
    }

    burst(x,y,colors,n) {
        for (let i=0;i<n;i++) {
            const a=Math.random()*Math.PI*2;
            const sp=80+Math.random()*220;
            this.sparks.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-120,t:0,life:0.5+Math.random()*0.4,r:3+Math.random()*5,c:colors[i%colors.length]});
        }
    }

    move(x,y) {
        if (this.drag) {
            this.dragYaw=this.drag.y0+(x-this.drag.x0)*TUNING.ui.skinDrag;
        }
        const p=this.press;
        if (p) {
            if (Math.hypot(x-p.x0,y-p.y0)>TUNING.skinUi.dragSlop) {
                p.moved=true;
            }
            if (p.moved) {
                this.scrollTo=p.s0-(y-p.y0);
                this.clampScroll();
                this.scroll=this.scrollTo;
            }
        }
    }

    up(x,y) {
        this.drag=null;
        const p=this.press;
        this.press=null;
        if (!this.open||!p||p.moved||x===undefined) {
            return;
        }
        this.pick(x,y);
    }

    skin() {
        return {...DEFAULT_SKIN,...settings.skin};
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const pw=h<760?Math.min(560,w*0.56):Math.min(430,Math.max(300,w*0.4));
        this.P={x:16,y:12,w:pw,h:h-24};
        const bw=(pw-50)/2;
        const by=this.P.y+this.P.h-(h<600?50:62);
        this.resetBtn={x:this.P.x+18,y:by,w:bw,h:h<600?40:46};
        this.backBtn={x:this.P.x+32+bw,y:by,w:bw,h:h<600?40:46};
        this.buttons=[this.resetBtn,this.backBtn];
    }

    hover(x,y) {
        super.hover(x,y);
        this.hx=x;
        this.hy=y;
    }

    set(skin,big=false) {
        settings.skin={...skin};
        if (big) {
            this.spin=1;
        }
        this.actions.changed(this.skin(),big);
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.backBtn,x,y)) {
            this.actions.back();
            return true;
        }
        if (inRect(this.resetBtn,x,y)) {
            this.pulse.reset=1;
            this.set(DEFAULT_SKIN,true);
            this.actions.select();
            return true;
        }
        if (x>this.P.x+this.P.w) {
            this.drag={x0:x,y0:this.dragYaw};
            return true;
        }
        if (inRect(this.V,x,y)) {
            this.press={x0:x,y0:y,s0:this.scrollTo,moved:false};
        }
        return true;
    }

    pick(x,y) {
        if (!inRect(this.V,x,y)) {
            return;
        }
        for (const q of this.hits) {
            if (inRect(q,x,y)) {
                this.pulse[q.key]=1;
                if (q.preset) {
                    const {id,...rest}=q.preset;
                    this.set(rest,true);
                    this.burst(q.x+q.w/2,q.y+q.h/2,[SKIN_TONES[rest.coat][1],SKIN_TONES[rest.hat][1],PALETTE.ink],14);
                }
                else {
                    this.set({...this.skin(),[q.part]:q.value});
                    const tones=q.part==='accent'?[ACCENTS[q.value]]:SKIN_TONES[q.value];
                    this.burst(q.x+q.w/2,q.y+q.h/2,[tones[1]||tones[0],tones[0]],8);
                }
                this.actions.select();
                return;
            }
        }
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const v=time.boilIndex;
        const h=this.height;
        const P=this.P;
        const a=EASE.easeOutCubic(Math.min(1,this.t/0.35));
        const small=h<760;
        const cur=this.skin();
        let row=0;
        const rowIn=()=>EASE.easeOutBack(Math.max(0,Math.min(1,(this.t-0.12-(row++)*0.05)/0.3)));
        ctx.save();
        ctx.translate(-(1-a)*(P.w+40),0);
        ctx.fillStyle=rgba('paper',0.94);
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:1500}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?20:26)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(t('skin.title'),P.x+18,P.y+(small?10:16));
        ctx.font='12px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText(t('skin.hint'),P.x+18,P.y+(small?36:50));
        this.hits=[];
        let y=P.y+(small?56:78);
        this.V={x:P.x,y:y-6,w:P.w,h:this.resetBtn.y-8-(y-6)};
        const V=this.V;
        ctx.save();
        ctx.beginPath();
        ctx.rect(V.x,V.y,V.w,V.h);
        ctx.clip();
        y-=this.scroll;
        const y0=y;
        ctx.font='bold 14px '+FONT;
        ctx.fillStyle=PALETTE.ink;
        ctx.fillText(t('skin.presets'),P.x+18,y);
        y+=22;
        const cols=small?8:4;
        const cw=(P.w-36-(cols-1)*8)/cols;
        const ch=small?56:78;
        for (let i=0;i<SKIN_PRESETS.length;i++) {
            const pr=SKIN_PRESETS[i];
            const cx=P.x+18+(i%cols)*(cw+8);
            const cy=y+Math.floor(i/cols)*(ch+8);
            const sel=SKIN_PARTS.every(q=>pr[q.key]===cur[q.key]);
            const hov=inRect({x:cx,y:cy,w:cw,h:ch},this.hx,this.hy);
            const key='p'+i;
            const pu=this.pulse[key]||0;
            const ap=EASE.easeOutBack(Math.max(0,Math.min(1,(this.t-0.1-i*0.04)/0.3)));
            ctx.save();
            ctx.translate(cx+cw/2,cy+ch/2);
            const sc=ap*(1+(hov?0.06:0)+Math.sin(pu*Math.PI)*0.18);
            ctx.scale(sc,sc);
            ctx.rotate((hov?Math.sin(time.real*8)*0.03:0)+(1-ap)*0.4);
            ctx.translate(-cw/2,-ch/2);
            ctx.fillStyle=sel?rgba('red',0.08):(hov?rgba('farGray',0.6):rgba('paper',0.9));
            ctx.fillRect(0,0,cw,ch);
            drawShape(ctx,sketchRect(0,0,cw,ch,{width:sel?2.4:1.3,seed:1510+i}),sel?PALETTE.red:PALETTE.ink,v);
            const hop=(hov||sel?Math.abs(Math.sin(time.real*(sel?4:7)))*(sel?2:3):0)+pu*8;
            drawSkinFigure(ctx,cw/2,ch*0.44-hop,small?0.6:0.85,pr,v,1520+i*3);
            ctx.fillStyle=sel?PALETTE.red:PALETTE.ink;
            ctx.font=(sel?'bold ':'')+'12px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='bottom';
            ctx.fillText(t('skin.preset.'+pr.id),cw/2,ch-3);
            ctx.restore();
            ctx.textAlign='left';
            ctx.textBaseline='top';
            this.hits.push({x:cx,y:cy,w:cw,h:ch,preset:pr,key});
        }
        y+=Math.ceil(SKIN_PRESETS.length/cols)*(ch+8)+(small?4:10);
        const tiny=h<450;
        const SK=TUNING.skinUi;
        const r=tiny?SK.rTiny:(small?SK.rSmall:SK.r);
        const lw=small?136:0;
        const sp=r*2+(tiny?SK.gapTiny:(small?SK.gapSmall:SK.gap));
        const rowSp=r*2+(small?SK.rowGapSmall:SK.rowGap);
        for (const part of SKIN_PARTS) {
            const ra=rowIn();
            ctx.save();
            ctx.globalAlpha*=Math.min(1,ra);
            ctx.translate(-(1-ra)*40,0);
            ctx.font='bold '+(small?13:14)+'px '+FONT;
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(t(part.label),P.x+18,small?y+r-7:y);
            if (!small) {
                y+=24;
            }
            const list=part.tones||part.accents;
            const per=Math.max(1,Math.floor((P.w-36-lw)/sp));
            for (let i=0;i<list.length;i++) {
                const key=list[i];
                const sx=P.x+18+lw+r+(i%per)*sp;
                const sy=y+r+Math.floor(i/per)*rowSp;
                const tones=part.tones?SKIN_TONES[key]:[ACCENTS[key]];
                const hk=part.key+key;
                const hv=Math.hypot(this.hx-sx,this.hy-sy)<r+4;
                const pu=this.pulse[hk]||0;
                const sc=1+(hv?0.2:0)+Math.sin(pu*Math.PI)*0.45;
                ctx.save();
                ctx.translate(sx,sy);
                ctx.scale(sc,sc);
                drawTone(ctx,0,0,r,tones,false,v,1540+i+part.key.length*13);
                ctx.restore();
                this.hits.push({x:sx-sp/2,y:sy-rowSp/2,w:sp,h:rowSp,part:part.key,value:key,key:hk});
            }
            const si=this.sel[part.key]??0;
            if (si>=0) {
                const fi=Math.round(si);
                const col=Math.min(per-1,si-Math.floor(fi/per)*per);
                const px=P.x+18+lw+r+col*sp;
                const py=y+r+Math.floor(fi/per)*rowSp;
                ctx.save();
                ctx.translate(px,py);
                ctx.rotate(time.real*1.5);
                ctx.strokeStyle=PALETTE.red;
                ctx.lineWidth=2.4;
                ctx.setLineDash([5,4]);
                ctx.beginPath();
                ctx.arc(0,0,r+5,0,Math.PI*2);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.restore();
            }
            y+=Math.ceil(list.length/per)*rowSp+(small?4:10);
            ctx.restore();
        }
        this.contentH=y-y0+6;
        ctx.restore();
        const max=Math.max(0,this.contentH-V.h);
        if (max>0) {
            const th=Math.max(30,V.h*V.h/this.contentH);
            const ty=V.y+(V.h-th)*(this.scroll/max);
            ctx.fillStyle=rgba('farGray',0.6);
            ctx.fillRect(V.x+V.w-9,V.y,4,V.h);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(V.x+V.w-10,ty,6,th);
            const fade=18;
            if (this.scroll<max-2) {
                const g=ctx.createLinearGradient(0,V.y+V.h-fade,0,V.y+V.h);
                g.addColorStop(0,rgba('paper',0));
                g.addColorStop(1,rgba('paper',0.95));
                ctx.fillStyle=g;
                ctx.fillRect(V.x+2,V.y+V.h-fade,V.w-14,fade);
            }
            if (this.scroll>2) {
                const g=ctx.createLinearGradient(0,V.y,0,V.y+fade);
                g.addColorStop(0,rgba('paper',0.95));
                g.addColorStop(1,rgba('paper',0));
                ctx.fillStyle=g;
                ctx.fillRect(V.x+2,V.y,V.w-14,fade);
            }
        }
        for (const q of this.sparks) {
            const f=q.t/q.life;
            ctx.globalAlpha=1-f;
            ctx.fillStyle=q.c;
            ctx.beginPath();
            ctx.arc(q.x,q.y,q.r*(1-f*0.5),0,Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha=1;
        ctx.restore();
        ctx.save();
        ctx.globalAlpha=a*(this.drag?0.4:0.85);
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font='14px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='bottom';
        ctx.fillText(t('skin.drag'),P.x+P.w+(this.width-P.x-P.w)/2,this.height-18);
        ctx.restore();
        ctx.save();
        ctx.translate(-(1-a)*(P.w+40),0);
        const rp=this.pulse.reset||0;
        ctx.save();
        const rb=this.resetBtn;
        ctx.translate(rb.x+rb.w/2,rb.y+rb.h/2);
        ctx.rotate(Math.sin(rp*Math.PI*3)*0.06);
        ctx.translate(-(rb.x+rb.w/2),-(rb.y+rb.h/2));
        drawButton(ctx,this.resetBtn,t('skin.reset'),v,(this.t-0.1)/0.3,this.hoverIdx===0,16);
        ctx.restore();
        drawButton(ctx,this.backBtn,t('menu.back'),v,(this.t-0.15)/0.3,this.hoverIdx===1,18);
        ctx.restore();
    }
}

function drawMapPreview(ctx,key,props,r,v,mini=false) {
    const L=key==='training'?TRAINING.layout:LAYOUTS[key];
    ctx.save();
    ctx.fillStyle=PALETTE.paper;
    ctx.fillRect(r.x,r.y,r.w,r.h);
    const [sw,sd]=L.size;
    const pad=mini?3:10;
    const k=Math.min((r.w-pad*2)/sw,(r.h-pad*2)/sd);
    const ox=r.x+r.w/2;
    const oy=r.y+r.h/2;
    if (!mini) {
        ctx.strokeStyle=rgba('farGray',0.9);
        ctx.lineWidth=0.6;
        ctx.beginPath();
        for (let gx=-sw/2;gx<=sw/2;gx+=2) {
            ctx.moveTo(ox+gx*k,oy-sd/2*k);
            ctx.lineTo(ox+gx*k,oy+sd/2*k);
        }
        for (let gz=-sd/2;gz<=sd/2;gz+=2) {
            ctx.moveTo(ox-sw/2*k,oy+gz*k);
            ctx.lineTo(ox+sw/2*k,oy+gz*k);
        }
        ctx.stroke();
    }
    ctx.strokeStyle=PALETTE.ink;
    ctx.lineWidth=mini?1.2:2;
    ctx.strokeRect(ox-sw/2*k,oy-sd/2*k,sw*k,sd*k);
    for (const q of L.props) {
        if (Math.abs(q.x)>sw/2||Math.abs(q.z)>sd/2) {
            continue;
        }
        const solid=q.type==='pillar'||q.type==='wall'||q.type==='box';
        if (!solid) {
            continue;
        }
        ctx.save();
        ctx.translate(ox+q.x*k,oy+q.z*k);
        ctx.globalAlpha*=props?1:0.3;
        ctx.fillStyle=q.type==='box'?PALETTE.midGray:PALETTE.ink;
        if (q.type==='pillar') {
            ctx.beginPath();
            ctx.arc(0,0,Math.max(mini?1.5:3,q.r*k),0,Math.PI*2);
            ctx.fill();
        }
        else {
            ctx.rotate(-(q.rot||0));
            const w=Math.max(mini?2:4,q.w*k);
            const d=Math.max(mini?2:4,q.d*k);
            ctx.fillRect(-w/2,-d/2,w,d);
        }
        ctx.restore();
    }
    const sp=L.spawn||[0,4];
    ctx.fillStyle=PALETTE.red;
    ctx.beginPath();
    ctx.arc(ox+sp[0]*k,oy+sp[1]*k,3,0,Math.PI*2);
    ctx.fill();
    ctx.restore();
    drawShape(ctx,sketchRect(r.x,r.y,r.w,r.h,{width:1.4,seed:1690}),PALETTE.ink,v);
}

export class TrainingMenu extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.hits=[];
        this.hx=-1;
        this.hy=-1;
        this.pendingRoom=false;
        this.pulse={};
        this.anim={};
        this.pop={};
        this.dd={open:false,t:0,pick:-1,pickT:0,kind:'weapon'};
        this.ddHits=[];
        this.ddInfos={};
        this.gamesOpen=false;
        this.gamesOnly=false;
        this.gamesT=0;
        this.gameHits=[];
    }

    ddBox(ctx,dr,kind,label,icon,v,seed) {
        const wp=this.pop[kind]||0;
        const dhv=inRect(dr,this.hx,this.hy)||(this.dd.open&&this.dd.kind===kind);
        ctx.save();
        ctx.translate(dr.x+dr.w/2,dr.y+dr.h/2);
        ctx.scale(1+wp*0.12,1+wp*0.12);
        ctx.translate(-(dr.x+dr.w/2),-(dr.y+dr.h/2));
        ctx.fillStyle=dhv?PALETTE.farGray:PALETTE.paper;
        ctx.fillRect(dr.x,dr.y,dr.w,dr.h);
        drawShape(ctx,sketchRect(dr.x,dr.y,dr.w,dr.h,{width:dhv?2:1.4,seed}),PALETTE.ink,v);
        const cy=dr.y+dr.h/2;
        if (icon) {
            drawWeaponIcon(ctx,icon,dr.x+22,cy,0.3,v,false);
        }
        ctx.fillStyle=wp>0.1?PALETTE.red:PALETTE.ink;
        ctx.font='bold 14px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(label,dr.x+(icon?44:12),cy);
        ctx.save();
        ctx.translate(dr.x+dr.w-16,cy);
        ctx.rotate(this.dd.kind===kind?EASE.easeOutBack(this.dd.t)*Math.PI:0);
        ctx.fillStyle=PALETTE.ink;
        ctx.beginPath();
        ctx.moveTo(-6,-3);
        ctx.lineTo(6,-3);
        ctx.lineTo(0,4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.restore();
    }

    show(gamesOnly=false) {
        super.show();
        this.gamesOnly=gamesOnly;
        this.gamesOpen=gamesOnly;
        this.gamesT=0;
        this.pendingRoom=false;
        this.pulse={};
        this.pop={};
        this.dd={open:false,t:0,pick:-1,pickT:0,kind:'weapon'};
        this.ddHits=[];
    }

    shown() {
        return super.shown()||this.gamesT>0;
    }

    closeDropdown() {
        if (this.gamesOpen&&!this.gamesOnly) {
            this.gamesOpen=false;
            return true;
        }
        if (!this.dd.open) {
            return false;
        }
        this.dd.open=false;
        return true;
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
    }

    total() {
        const c=settings.training;
        let n=0;
        for (const map of [c.foes,c.elites||{}]) {
            for (const k in map) {
                n+=map[k];
            }
        }
        return n;
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        if (this.gamesOpen) {
            for (const q of this.gameHits) {
                if (inRect(q,x,y)) {
                    q.act();
                    return true;
                }
            }
            this.gamesOpen=false;
            if (this.gamesOnly) {
                this.actions.resume();
            }
            return true;
        }
        if (this.dd.open) {
            for (const q of this.ddHits) {
                if (inRect(q,x,y)) {
                    q.act();
                    break;
                }
            }
            this.dd.open=false;
            if (this.actions.select) {
                this.actions.select();
            }
            return true;
        }
        for (const q of this.hits) {
            if (inRect(q,x,y)) {
                this.pulse[q.key]=1;
                if (q.pop) {
                    this.pop[q.pop]=1;
                }
                q.act();
                if (this.actions.select) {
                    this.actions.select();
                }
                return true;
            }
        }
        return true;
    }

    update(dt) {
        super.update(dt);
        const k=1-Math.exp(-TUNING.settingsUi.follow*dt);
        for (const key in this.pulse) {
            this.pulse[key]=Math.max(0,this.pulse[key]-dt*TUNING.trainUi.pulseDecay);
        }
        for (const key in this.pop) {
            this.pop[key]=Math.max(0,this.pop[key]-dt*TUNING.trainUi.popDecay);
        }
        const D=TUNING.trainUi.dropdown;
        this.dd.t=Math.max(0,Math.min(1,this.dd.t+(this.dd.open?dt/D.openTime:-dt/D.closeTime)));
        this.dd.pickT=Math.max(0,this.dd.pickT-dt*D.pickDecay);
        const G=TUNING.trainUi.games;
        const gd=Math.min(dt,G.maxDt);
        this.gamesT=Math.max(0,Math.min(1,this.gamesT+(this.gamesOpen?gd/G.openTime:-gd/G.closeTime)));
        const c=settings.training;
        for (const key of ['props','attack','immortal','ammo','random']) {
            this.anim[key]=(this.anim[key]??(c[key]?1:0))+(((c[key]?1:0))-(this.anim[key]??0))*k;
        }
        this.anim.refill=(this.anim.refill??(c.refill==='fixed'?0:1))+((c.refill==='fixed'?0:1)-(this.anim.refill??0))*k;
        for (const id of BOSS_LIST) {
            const on=(c.bosses||{})[id]>0?1:0;
            this.anim['b'+id]=(this.anim['b'+id]??on)+(on-(this.anim['b'+id]??on))*k;
        }
    }

    change(kind) {
        if (kind==='room') {
            this.pendingRoom=true;
        }
        this.actions.changed(kind);
    }

    rowIn(i) {
        return EASE.easeOutCubic(Math.max(0,Math.min(1,(this.t-0.08-i*0.035)/0.3)));
    }

    fxBegin(ctx,key,r) {
        const hv=inRect(r,this.hx,this.hy);
        const p=this.pulse[key]||0;
        const sc=1+(hv?TUNING.trainUi.hoverScale:0)+Math.sin(p*Math.PI)*TUNING.trainUi.pressScale;
        ctx.save();
        ctx.translate(r.x+r.w/2,r.y+r.h/2);
        ctx.scale(sc,sc);
        ctx.rotate(hv?-0.02:0);
        ctx.translate(-(r.x+r.w/2),-(r.y+r.h/2));
        return hv;
    }

    rowLabel(ctx,label,x,y) {
        ctx.fillStyle=PALETTE.ink;
        ctx.font='15px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(label,x,y);
    }

    drawSwitch(ctx,key,x,y,v,seed) {
        const f=Math.max(0,Math.min(1,this.anim[key]??0));
        const r={x,y:y-13,w:56,h:26};
        const hv=this.fxBegin(ctx,key,r);
        ctx.fillStyle=hv?PALETTE.farGray:PALETTE.paper;
        ctx.fillRect(r.x,r.y,r.w,r.h);
        ctx.fillStyle=rgba('ink',f);
        ctx.fillRect(r.x,r.y,r.w,r.h);
        drawShape(ctx,sketchRect(r.x,r.y,r.w,r.h,{width:hv?2.2:1.6,seed}),PALETTE.ink,v);
        const squash=1+Math.sin(f*Math.PI)*0.35;
        ctx.fillStyle=f>0.5?PALETTE.paper:PALETTE.ink;
        ctx.beginPath();
        ctx.ellipse(x+15+26*f,y,8*squash,8/squash,0,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font=((this.pulse[key]||0)>0.3?'bold ':'')+'13px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t(f>0.5?'settings.on':'settings.off'),x+66,y);
        return {x:x-4,y:y-16,w:110,h:32};
    }

    drawSeg(ctx,key,x,y,w,labels,v,seed) {
        const seg=w/labels.length;
        const f=this.anim[key]??0;
        const r={x,y:y-13,w,h:26};
        const hv=inRect(r,this.hx,this.hy);
        ctx.save();
        ctx.fillStyle=hv?PALETTE.farGray:PALETTE.paper;
        ctx.fillRect(x,y-13,w,26);
        const sq=1-Math.sin((f%1)*Math.PI)*0.1;
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(x+f*seg+3,y-12*sq,seg-6,24*sq);
        drawShape(ctx,sketchRect(x,y-13,w,26,{width:hv?2:1.4,seed}),PALETTE.ink,v);
        for (let i=0;i<labels.length;i++) {
            const on=Math.abs(f-i)<0.5;
            ctx.fillStyle=on?PALETTE.paper:PALETTE.ink;
            ctx.font=(on?'bold ':'')+'13px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(labels[i],x+i*seg+seg/2,y+1);
        }
        ctx.restore();
    }

    smallBtn(ctx,key,r,label,ok,v,seed,red=false) {
        const hv=ok&&this.fxBegin(ctx,key,r);
        if (!ok) {
            ctx.save();
        }
        const col=ok?(red?PALETTE.red:PALETTE.ink):PALETTE.farGray;
        const p=this.pulse[key]||0;
        ctx.fillStyle=p>0.05?rgba(red?'red':'ink',0.25*p):(hv?rgba('farGray',0.8):rgba('paper',0.9));
        ctx.fillRect(r.x,r.y,r.w,r.h);
        drawShape(ctx,sketchRect(r.x,r.y,r.w,r.h,{width:hv?2:1.3,seed}),col,v);
        ctx.fillStyle=col;
        ctx.font=(hv?'bold ':'')+'15px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(label,r.x+r.w/2,r.y+r.h/2+1);
        ctx.restore();
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const c=settings.training;
        const T=TUNING.training;
        const small=h<600;
        const pw=Math.min(980,w-20);
        const ph=Math.min(h-16,small?h-16:660);
        const px=w/2-pw/2;
        const py=h/2-ph/2;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.35));
        this.hits=[];
        const add=(r,act,key,pop=null)=>this.hits.push({...r,act,key,pop});
        if (this.gamesOnly) {
            this.buttons=[];
            ctx.save();
            this.drawGames(ctx,v);
            ctx.restore();
            return;
        }
        ctx.save();
        ctx.fillStyle=rgba('paper',Math.min(0.8,this.t*4));
        ctx.fillRect(0,0,w,h);
        ctx.translate(w/2,h/2);
        ctx.scale(0.92+0.08*a,0.92+0.08*a);
        ctx.translate(-w/2,-h/2);
        ctx.globalAlpha=Math.min(1,this.t*4);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(px,py,pw,ph);
        drawShape(ctx,sketchRect(px,py,pw,ph,{width:2.2,seed:1600}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?20:28)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('trainMenu.title'),w/2,py+(small?20:34));
        const tw=ctx.measureText(t('trainMenu.title')).width;
        drawShape(ctx,sketchLine(w/2-tw/2,py+(small?34:54),w/2-tw/2+tw*Math.min(1,this.t/0.4),py+(small?34:54),{width:2.4,seed:1601}),PALETTE.red,v);
        const TU=TUNING.trainUi;
        const rh=small?(ph-110)/(8.2+TU.bossGap):TU.rowH;
        const colW=pw*0.46;
        const lx=px+22;
        const cx=px+colW*0.5;
        const cw=colW*0.46;
        let y=py+(small?50:84);
        let row=0;
        const rowStart=()=>{
            const k=this.rowIn(row++);
            ctx.save();
            ctx.globalAlpha*=k;
            ctx.translate(-(1-k)*30,0);
        };
        rowStart();
        const mh=rh;
        this.rowLabel(ctx,t('trainMenu.map'),lx,y);
        const maps=TRAINING_MAPS;
        const mi=Math.max(0,maps.indexOf(c.map));
        const mr={x:cx,y:y-16,w:cw,h:32};
        this.ddBox(ctx,mr,'map',t('map.'+maps[mi]),null,v,1612);
        add(mr,()=>{
            this.dd.kind='map';
            this.dd.open=true;
        },'mdd');
        this.ddInfos.map={r:mr,list:maps,cur:mi};
        ctx.restore();
        y+=mh;
        rowStart();
        this.rowLabel(ctx,t('trainMenu.weapon'),lx,y);
        const wl=WEAPON_ORDER.filter(id=>weaponUnlocked(id,effectiveLevel()));
        const wi=Math.max(0,wl.indexOf(c.weapon||'pen'));
        const dr={x:cx,y:y-16,w:cw,h:32};
        this.ddBox(ctx,dr,'weapon',t('weapon.'+wl[wi]+'.name'),wl[wi],v,1615);
        add(dr,()=>{
            this.dd.kind='weapon';
            this.dd.open=true;
        },'wdd');
        this.ddInfos.weapon={r:dr,list:wl,cur:wi};
        ctx.restore();
        y+=rh;
        const toggles=[['props','room'],['attack','attack'],['immortal','immortal'],['ammo','ammo']];
        for (let i=0;i<toggles.length;i++) {
            const [key,kind]=toggles[i];
            rowStart();
            this.rowLabel(ctx,t('trainMenu.'+key),lx,y);
            const r=this.drawSwitch(ctx,key,cx,y,v,1620+i);
            add(r,()=>{
                c[key]=!c[key];
                this.change(kind);
            },key);
            ctx.restore();
            y+=rh;
        }
        rowStart();
        this.rowLabel(ctx,t('trainMenu.refill'),lx,y);
        this.drawSeg(ctx,'refill',cx,y,cw,[t('trainMenu.fixed'),t('trainMenu.random')],v,1640);
        const modes=['fixed','random'];
        for (let i=0;i<modes.length;i++) {
            if (modes[i]===c.refill) {
                continue;
            }
            add({x:cx,y:y-14,w:cw,h:28},()=>{
                c.refill=modes[i];
                this.change('refill');
            },'refill');
        }
        ctx.restore();
        y+=rh*(1+TU.bossGap);
        rowStart();
        this.rowLabel(ctx,t('trainMenu.bosses'),lx,y);
        const bosses=c.bosses||(c.bosses={});
        const bw=Math.min(64,cw/3-6,rh*TU.bossH/0.84);
        for (let i=0;i<BOSS_LIST.length;i++) {
            const id=BOSS_LIST[i];
            const ok=trainable(id);
            const f=this.anim['b'+id]||0;
            const r={x:cx+i*(bw+8),y:y-bw*0.42,w:bw,h:bw*0.84};
            const key='b'+id;
            const hv=ok&&this.fxBegin(ctx,key,r);
            if (!ok) {
                ctx.save();
            }
            ctx.fillStyle=rgba('red',0.16*f);
            ctx.fillRect(r.x,r.y,r.w,r.h);
            drawShape(ctx,sketchRect(r.x,r.y,r.w,r.h,{width:f>0.5||hv?2.4:1.3,seed:1680+i}),ok?(f>0.5?PALETTE.red:PALETTE.ink):PALETTE.farGray,v);
            ctx.save();
            ctx.globalAlpha*=ok?1:0.35;
            ctx.translate(r.x+r.w/2,r.y+r.h/2);
            const ks=r.h/72*(1+f*0.12);
            ctx.scale(ks,ks);
            ENEMY_ICONS[id](ctx,v);
            ctx.restore();
            if (f>0.02) {
                ctx.fillStyle=PALETTE.red;
                ctx.beginPath();
                ctx.arc(r.x+r.w,r.y,9*f,0,Math.PI*2);
                ctx.fill();
                ctx.fillStyle=PALETTE.paper;
                ctx.font='bold 11px '+FONT;
                ctx.textAlign='center';
                ctx.fillText('✓',r.x+r.w,r.y+1);
            }
            ctx.restore();
            if (ok) {
                add(r,()=>{
                    bosses[id]=bosses[id]>0?0:1;
                    this.change('foes');
                },key);
            }
        }
        ctx.restore();
        const rx=px+colW+14;
        const rw=pw-colW-36;
        let ry=py+(small?50:84);
        const tot=c.random?c.randCount:this.total();
        const stepper=(key,x,yy,val,canDown,canUp,down,up,seed,red)=>{
            for (const [dx,ok,ch,fn,d] of [[0,canDown,'－',down,'-'],[70,canUp,'＋',up,'+']]) {
                const r={x:x+dx,y:yy-13,w:28,h:26};
                this.smallBtn(ctx,key+d,r,ch,ok,v,seed+dx,red);
                if (ok) {
                    add(r,fn,key+d,key);
                }
            }
            const pp=this.pop[key]||0;
            ctx.save();
            ctx.translate(x+49,yy+1);
            ctx.scale(1+pp*0.45,1+pp*0.45);
            ctx.fillStyle=val>0?(red?PALETTE.red:PALETTE.ink):PALETTE.midGray;
            ctx.font='bold 16px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(String(val),0,0);
            ctx.restore();
        };
        let rrow=0;
        const rStart=()=>{
            const k=this.rowIn(rrow++);
            ctx.save();
            ctx.globalAlpha*=k;
            ctx.translate((1-k)*30,0);
        };
        rStart();
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 15px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t('trainMenu.foes',{n:tot,max:T.maxFoes}),rx,ry);
        const clr={x:rx+rw-64,y:ry-14,w:64,h:28};
        this.smallBtn(ctx,'clear',clr,t('trainMenu.clear'),true,v,1650);
        add(clr,()=>{
            c.foes={};
            c.elites={};
            c.bosses={};
            c.random=false;
            this.change('foes');
        },'clear');
        ctx.restore();
        ry+=small?28:38;
        rStart();
        this.rowLabel(ctx,t('trainMenu.randomFoes'),rx,ry);
        const rr=this.drawSwitch(ctx,'random',rx+110,ry,v,1655);
        add(rr,()=>{
            c.random=!c.random;
            this.change('foes');
        },'random');
        const ra=Math.max(0,Math.min(1,this.anim.random||0));
        if (ra>0.02) {
            ctx.save();
            ctx.globalAlpha*=ra;
            const sx=rx+rw-100;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='13px '+FONT;
            ctx.textAlign='right';
            ctx.fillText(t('trainMenu.randCount'),sx-8,ry);
            stepper('randCount',sx,ry,c.randCount,c.random&&c.randCount>1,c.random&&c.randCount<T.maxFoes,()=>{
                c.randCount--;
                this.change('foes');
            },()=>{
                c.randCount++;
                this.change('foes');
            },1656,false);
            ctx.restore();
        }
        ctx.restore();
        ry+=small?26:34;
        rStart();
        if (ra>0.02) {
            ctx.save();
            ctx.globalAlpha*=ra;
            const sx=rx+rw-100;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='13px '+FONT;
            ctx.textAlign='right';
            ctx.fillText(t('trainMenu.randElite'),sx-8,ry);
            const ev=c.randElite;
            stepper('randElite',sx,ry,ev,c.random&&ev>0,c.random&&ev<100,()=>{
                c.randElite=Math.max(0,ev-T.eliteStep);
                this.change('foes');
            },()=>{
                c.randElite=Math.min(100,ev+T.eliteStep);
                this.change('foes');
            },1657,true);
            ctx.fillStyle=PALETTE.red;
            ctx.font='12px '+FONT;
            ctx.textAlign='left';
            ctx.fillText('%',sx+102,ry+1);
            ctx.restore();
        }
        ctx.restore();
        ry+=small?22:30;
        const nx=rx+rw-210;
        const ex=rx+rw-100;
        const dim=1-ra*0.6;
        rStart();
        ctx.font='bold 12px '+FONT;
        ctx.textAlign='center';
        ctx.fillStyle=PALETTE.nearGray;
        ctx.globalAlpha*=dim;
        ctx.fillText(t('trainMenu.normal'),nx+49,ry);
        ctx.fillStyle=PALETTE.red;
        ctx.fillText(t('trainMenu.eliteCol'),ex+49,ry);
        ctx.restore();
        ry+=small?20:26;
        const frh=small?Math.min(32,(py+ph-60-ry)/FOE_LIST.length):Math.min(42,(py+ph-84-ry)/FOE_LIST.length);
        const elites=c.elites||(c.elites={});
        for (let i=0;i<FOE_LIST.length;i++) {
            const id=FOE_LIST[i];
            const ok=trainable(id);
            const n=c.foes[id]||0;
            const m=elites[id]||0;
            rStart();
            ctx.globalAlpha*=ok?dim:0.4;
            const bob=Math.sin(time.real*3+i)*(n+m>0?2:0);
            ctx.save();
            ctx.translate(rx+14,ry+bob);
            const k=(small?20:28)/60;
            ctx.scale(k,k);
            ENEMY_ICONS[id](ctx,v);
            ctx.restore();
            ctx.fillStyle=ok?PALETTE.ink:PALETTE.midGray;
            ctx.font=(n+m>0?'bold ':'')+'14px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='middle';
            ctx.fillText(ok?t('enemy.'+id):t('trainMenu.unseen'),rx+36,ry);
            if (ok&&!c.random) {
                const room=tot<T.maxFoes;
                stepper('n'+id,nx,ry,n,n>0,room,()=>{
                    c.foes[id]=n-1;
                    this.change('foes');
                },()=>{
                    c.foes[id]=n+1;
                    this.change('foes');
                },1660+i*4,false);
                stepper('e'+id,ex,ry,m,m>0,room,()=>{
                    elites[id]=m-1;
                    this.change('foes');
                },()=>{
                    elites[id]=m+1;
                    this.change('foes');
                },1700+i*4,true);
            }
            ctx.restore();
            ry+=frh;
        }
        const by=py+ph-(small?46:64);
        const btns=[['trainMenu.pick','pick'],['trainMenu.reset','reset'],['menu.settings','settings'],['trainMenu.resume','resume']];
        const bw2=Math.min(160,(pw-40-(btns.length-1)*10)/btns.length);
        const bx0=w/2-(btns.length*bw2+(btns.length-1)*10)/2;
        this.buttons=[];
        for (let i=0;i<btns.length;i++) {
            const r={x:bx0+i*(bw2+10),y:by,w:bw2,h:small?38:48};
            this.buttons.push(r);
            const key='btn'+i;
            const p=this.pulse[key]||0;
            ctx.save();
            ctx.translate(r.x+r.w/2,r.y+r.h/2);
            ctx.scale(1-Math.sin(p*Math.PI)*0.08,1-Math.sin(p*Math.PI)*0.08);
            ctx.translate(-(r.x+r.w/2),-(r.y+r.h/2));
            drawButton(ctx,r,t(btns[i][0]),v,(this.t-0.2-i*0.05)/0.3,inRect(r,this.hx,this.hy)&&!this.dd.open,small?14:16);
            ctx.restore();
            add(r,()=>this.actions[btns[i][1]](),key);
        }
        this.drawDropdown(ctx,v);
        this.drawGames(ctx,v);
        ctx.restore();
    }

    drawGames(ctx,v) {
        this.gameHits=[];
        if (this.gamesT<=0) {
            return;
        }
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const G=TUNING.trainUi.games;
        const k=EASE.easeOutCubic(this.gamesT);
        const ids=MINIGAMES.order;
        const cols=4;
        const rows=Math.ceil(ids.length/cols);
        const pw=Math.min(820,w-40);
        const ph=Math.min(h-30,small?h-30:470);
        const px=w/2-pw/2;
        const py=h/2-ph/2;
        ctx.save();
        ctx.globalAlpha*=k;
        ctx.fillStyle=rgba('ink',0.25);
        ctx.fillRect(0,0,w,h);
        ctx.translate(w/2,h/2+(1-k)*G.lift);
        ctx.scale(1-G.scale+G.scale*k,1-G.scale+G.scale*k);
        ctx.translate(-w/2,-h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(px,py,pw,ph);
        drawShape(ctx,sketchRect(px,py,pw,ph,{width:2.2,seed:1680}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?20:22)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        const head=small?40:58;
        ctx.fillText(t('trainMenu.gamesTitle'),px+20,py+head/2+2);
        ctx.font=(small?'12px ':'13px ')+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='right';
        ctx.fillText(t('trainMenu.gamesHint'),px+pw-20,py+head/2+2);
        const gap=10;
        const gw=(pw-40-gap*(cols-1))/cols;
        const gh=(ph-head-20-gap*(rows-1))/rows;
        ids.forEach((id,i)=>{
            const r={x:px+20+(i%cols)*(gw+gap),y:py+head+Math.floor(i/cols)*(gh+gap),w:gw,h:gh};
            const hv=inRect(r,this.hx,this.hy);
            const ik=this.gamesOpen?EASE.easeOutCubic(Math.max(0,Math.min(1,(this.gamesT-i*G.stagger)/G.itemTime))):1;
            ctx.save();
            ctx.globalAlpha*=ik;
            ctx.translate(r.x+r.w/2,r.y+r.h/2+(1-ik)*12);
            ctx.scale(hv?1.04:1,hv?1.04:1);
            ctx.fillStyle=hv?rgba('red',0.1):rgba('paper',0.95);
            ctx.fillRect(-r.w/2,-r.h/2,r.w,r.h);
            drawShape(ctx,sketchRect(-r.w/2,-r.h/2,r.w,r.h,{width:hv?2:1.3,seed:1690+i}),hv?PALETTE.red:PALETTE.ink,v);
            const ts=Math.min(r.h-12,r.w*0.45);
            drawGameThumb(ctx,id,-r.w/2+6,-ts/2,ts,v,hv);
            const tx=-r.w/2+ts+12+(r.w-ts-18)/2;
            const tw=r.w-ts-20;
            ctx.fillStyle=hv?PALETTE.red:PALETTE.ink;
            ctx.font='bold '+(small?16:17)+'px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('event.'+id+'.title'),tx,-r.h*0.12,tw);
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='13px '+FONT;
            ctx.fillText(t('npc.'+MINIGAMES.games[id].model),tx,r.h*0.22,tw);
            ctx.restore();
            const act=()=>{
                this.gamesOpen=false;
                this.actions.testGame(id);
            };
            this.gameHits.push({...r,act});
        });
        ctx.restore();
    }

    drawDropdown(ctx,v) {
        this.ddHits=[];
        const kind=this.dd.kind;
        const info=this.ddInfos[kind];
        if (!info||this.dd.t<=0) {
            return;
        }
        const D=TUNING.trainUi.dropdown;
        const c=settings.training;
        const r=info.r;
        const n=info.list.length;
        const ih=kind==='map'?D.mapItemH:D.itemH;
        const full=ih*n+8;
        const k=EASE.easeOutCubic(this.dd.t);
        const below=r.y+r.h+4+full<this.height-6;
        const y0=below?r.y+r.h+4:Math.max(6,r.y-4-full);
        ctx.save();
        ctx.fillStyle=rgba('ink',0.12*k);
        ctx.fillRect(r.x+4,y0+(below?6:-2),r.w,full*k);
        ctx.beginPath();
        if (below) {
            ctx.rect(r.x-4,y0-2,r.w+8,full*k+4);
        }
        else {
            ctx.rect(r.x-4,y0+full*(1-k)-2,r.w+8,full*k+4);
        }
        ctx.clip();
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(r.x,y0,r.w,full);
        drawShape(ctx,sketchRect(r.x,y0,r.w,full,{width:1.8,seed:1617}),PALETTE.ink,v);
        for (let i=0;i<n;i++) {
            const id=info.list[i];
            const iy=y0+4+i*ih;
            const ir={x:r.x+4,y:iy,w:r.w-8,h:ih};
            const ik=Math.max(0,Math.min(1,(this.dd.t-i*D.stagger)/(1-D.stagger*n+D.stagger)));
            const hv=inRect(ir,this.hx,this.hy);
            const cur=kind==='map'?id===c.map:id===(c.weapon||'pen');
            ctx.save();
            ctx.globalAlpha*=ik;
            ctx.translate((1-ik)*-18,0);
            if (hv||cur) {
                ctx.fillStyle=cur?rgba('ink',0.1):rgba('farGray',0.8);
                ctx.fillRect(ir.x,ir.y,ir.w,ir.h);
            }
            if (cur) {
                ctx.fillStyle=PALETTE.red;
                ctx.fillRect(ir.x,ir.y+4,4,ir.h-8);
            }
            const pk=this.dd.pick===i?this.dd.pickT:0;
            ctx.save();
            if (kind==='map') {
                const tw=ih*1.4;
                const tr={x:ir.x+8,y:iy+3,w:tw,h:ih-6};
                ctx.translate(tr.x+tw/2,iy+ih/2);
                ctx.scale(1+pk*0.2,1+pk*0.2);
                ctx.translate(-(tr.x+tw/2),-(iy+ih/2));
                drawMapPreview(ctx,id,c.props,tr,v,true);
            }
            else {
                ctx.translate(ir.x+22,iy+ih/2);
                ctx.rotate(hv?Math.sin(time.real*10)*0.12:0);
                ctx.scale(1+pk*0.4,1+pk*0.4);
                drawWeaponIcon(ctx,id,0,0,0.28,v,false);
            }
            ctx.restore();
            ctx.fillStyle=cur?PALETTE.red:PALETTE.ink;
            ctx.font=(cur||hv?'bold ':'')+'14px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='middle';
            ctx.fillText(kind==='map'?t('map.'+id):t('weapon.'+id+'.name'),ir.x+(kind==='map'?ih*1.4+18:44),iy+ih/2);
            if (kind!=='map') {
                ctx.fillStyle=PALETTE.nearGray;
                ctx.font='11px '+FONT;
                ctx.textAlign='right';
                ctx.fillText(t('weapon.'+id+'.short'),ir.x+ir.w-6,iy+ih/2);
            }
            ctx.restore();
            const act=()=>{
                this.dd.pick=i;
                this.dd.pickT=1;
                this.pop[kind]=1;
                if (kind==='map') {
                    if (c.map!==id) {
                        c.map=id;
                        this.change('room');
                    }
                }
                else if (c.weapon!==id) {
                    c.weapon=id;
                    this.change('weapon');
                }
            };
            this.ddHits.push({...ir,act});
        }
        ctx.restore();
    }
}

const COACH_ANIMS={move:TUTOR_ANIMS.move,shoot:WEAPON_ANIMS.pen,dodge:TUTOR_ANIMS.dodge,cards:CARD_ANIMS.scatter,ult:CARD_ANIMS.execute,warn:ENEMY_ATTACKS.compass[0]};

const PRACTICE=TUTOR_STEPS.filter(q=>!q.info).length;

function keycap(ctx,x,y,w,h,label,down,red=false) {
    const o=down?3:0;
    ctx.fillStyle=PALETTE.ink;
    ctx.fillRect(x+3,y+3,w,h);
    ctx.fillStyle=down?(red?PALETTE.red:PALETTE.farGray):PALETTE.paper;
    ctx.fillRect(x+o,y+o,w,h);
    ctx.strokeStyle=red?PALETTE.red:PALETTE.ink;
    ctx.lineWidth=2;
    ctx.strokeRect(x+o,y+o,w,h);
    ctx.fillStyle=down&&red?PALETTE.paper:(red?PALETTE.red:PALETTE.ink);
    ctx.font='bold '+Math.round(Math.min(h*0.48,w*0.5))+'px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(label,x+o+w/2,y+o+h/2+1);
}

function roundBtn(ctx,x,y,r,label,down,red=false) {
    ctx.fillStyle=rgba('ink',0.25);
    ctx.beginPath();
    ctx.arc(x+2,y+3,r,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle=down?(red?PALETTE.red:PALETTE.farGray):rgba('paper',0.95);
    ctx.beginPath();
    ctx.arc(x,y,r*(down?0.92:1),0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle=red?PALETTE.red:PALETTE.ink;
    ctx.lineWidth=2.4;
    ctx.stroke();
    if (label) {
        ctx.fillStyle=down&&red?PALETTE.paper:(red?PALETTE.red:PALETTE.ink);
        ctx.font='bold '+Math.round(r*0.62)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(label,x,y+1);
    }
}

export class Coach extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.step=null;
        this.index=0;
        this.animT=0;
        this.strip=null;
        this.merged=false;
        this.touch=false;
        this.hx=-1;
        this.hy=-1;
        this.bits=[];
    }

    reset() {
        this.open=false;
        this.closing=false;
        this.t=0;
        this.step=null;
        this.strip=null;
        this.bits=[];
    }

    intro(step,i) {
        this.step=step;
        this.index=i;
        this.animT=0;
        this.merged=false;
        this.strip=null;
        this.bits=step.key==='end'?this.confetti():[];
        this.show();
    }

    confetti() {
        const C=TUNING.tutorial.confetti;
        const out=[];
        for (let i=0;i<C.count;i++) {
            out.push({x:Math.random(),y:-Math.random(),v:C.speed[0]+Math.random()*(C.speed[1]-C.speed[0]),s:C.size[0]+Math.random()*(C.size[1]-C.size[0]),r:Math.random()*6,w:(Math.random()-0.5)*C.spin,c:i%3});
        }
        return out;
    }

    task(step) {
        this.hide();
        this.strip={step,counts:{},pulse:{},stamp:-1,t:0};
    }

    progress(kind,n) {
        if (this.strip) {
            this.strip.counts[kind]=n;
            this.strip.pulse[kind]=1;
        }
    }

    done() {
        if (this.strip) {
            this.strip.stamp=0;
        }
    }

    hover(x,y) {
        super.hover(x,y);
        this.hx=x;
        this.hy=y;
    }

    label() {
        const s=this.step;
        if (!s) {
            return '';
        }
        if (s.key==='end') {
            return t('tut.finish');
        }
        if (s.merge&&!this.merged) {
            return t('tut.tryMerge');
        }
        return t(s.info?'tut.next':'tut.begin');
    }

    press() {
        const s=this.step;
        if (!this.open||!s||this.t<0.3) {
            return;
        }
        if (s.key==='end') {
            this.actions.finish();
            return;
        }
        if (s.merge&&!this.merged) {
            this.merged=true;
            this.actions.merge();
            return;
        }
        if (s.info) {
            this.actions.next();
            return;
        }
        this.actions.begin();
    }

    small() {
        return this.height<TUNING.tutorial.modal.small;
    }

    layout() {
        const M=TUNING.tutorial.modal;
        const w=this.width;
        const h=this.height;
        const sm=this.small();
        const pw=Math.min(M.w,w-24,fitW(h));
        const ph=Math.min(M.h,h-20);
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const bw=sm?M.btnWSmall:M.btnW;
        const bh=sm?M.btnHSmall:M.btnH;
        this.btn={x:this.P.x+pw-bw-(sm?16:24),y:this.P.y+ph-bh-(sm?12:20),w:bw,h:bh};
        this.buttons=[this.btn];
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.btn,x,y)) {
            this.press();
        }
        return true;
    }

    update(dt) {
        super.update(dt);
        this.animT+=dt;
        const s=this.strip;
        if (s) {
            s.t+=dt;
            for (const k in s.pulse) {
                s.pulse[k]=Math.max(0,s.pulse[k]-dt*3);
            }
            if (s.stamp>=0) {
                s.stamp+=dt;
            }
        }
        for (const b of this.bits) {
            b.y+=b.v*dt/Math.max(1,this.height);
            b.r+=b.w*dt;
            if (b.y>1.05) {
                b.y=-0.05;
                b.x=Math.random();
            }
        }
    }

    drawKeys(ctx,kind,k) {
        if (kind==='move') {
            const keys=t('tut.key.wasd').split('');
            const at=[[34,-70],[0,-36],[34,-36],[68,-36]];
            const on=Math.floor(k*2.5)%4;
            for (let i=0;i<4;i++) {
                keycap(ctx,at[i][0],at[i][1],30,30,keys[i],i===[3,2,1,0][on]);
            }
            return;
        }
        if (kind==='shoot') {
            const press=(k%0.7)<0.4;
            ctx.fillStyle=PALETTE.paper;
            ctx.fillRect(4,-78,40,62);
            ctx.fillStyle=press?PALETTE.red:PALETTE.farGray;
            ctx.fillRect(4,-78,20,26);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=2.2;
            ctx.strokeRect(4,-78,40,62);
            ctx.beginPath();
            ctx.moveTo(24,-78);
            ctx.lineTo(24,-52);
            ctx.moveTo(4,-52);
            ctx.lineTo(44,-52);
            ctx.stroke();
            keycap(ctx,58,-44,30,30,t('tut.key.r'),Math.floor(k/1.4)%3===2);
            return;
        }
        if (kind==='dash') {
            const f=(k%3.2)/3.2;
            keycap(ctx,0,-42,112,32,t('tut.key.space'),f>0.3&&f<0.42);
            return;
        }
        if (kind==='cards') {
            const on=Math.floor(k/0.9)%2;
            keycap(ctx,0,-42,32,32,'1',on===0);
            keycap(ctx,40,-42,32,32,'2',on===1);
            return;
        }
        keycap(ctx,0,-42,32,32,'3',(k%1.2)<0.5,true);
    }

    drawTouch(ctx,kind,k) {
        const cx=40;
        const cy=-40;
        if (kind==='move'||kind==='shoot') {
            ctx.fillStyle=rgba('paper',0.9);
            ctx.beginPath();
            ctx.arc(cx,cy,32,0,Math.PI*2);
            ctx.fill();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=2.2;
            ctx.stroke();
            let r=16;
            let red=false;
            if (kind==='shoot') {
                ctx.setLineDash([4,4]);
                ctx.beginPath();
                ctx.arc(cx,cy,19,0,Math.PI*2);
                ctx.stroke();
                ctx.setLineDash([]);
                const f=(k%1.6)/1.6;
                r=f<0.4?12:27;
                red=f>=0.4;
            }
            const a=kind==='move'?k*2.4:-0.3;
            ctx.fillStyle=red?PALETTE.red:PALETTE.midGray;
            ctx.beginPath();
            ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r,13,0,Math.PI*2);
            ctx.fill();
            ctx.strokeStyle=PALETTE.ink;
            ctx.stroke();
            return;
        }
        if (kind==='dash') {
            const f=(k%3.2)/3.2;
            roundBtn(ctx,cx,cy,28,t('tut.key.dash'),f>0.3&&f<0.42);
            return;
        }
        if (kind==='cards') {
            const f=(k%1.8)/1.8;
            const drag=Math.max(0,Math.min(1,(f-0.15)/0.5));
            roundBtn(ctx,22,-24,20,'',false);
            roundBtn(ctx,68,-24,20,'',drag>0&&drag<1);
            if (drag>0&&drag<1) {
                ctx.strokeStyle=PALETTE.red;
                ctx.lineWidth=2.4;
                ctx.setLineDash([5,4]);
                ctx.beginPath();
                ctx.moveTo(68,-24);
                ctx.lineTo(68+drag*30,-24-drag*44);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle=PALETTE.red;
                ctx.beginPath();
                ctx.arc(68+drag*30,-24-drag*44,7,0,Math.PI*2);
                ctx.fill();
            }
            return;
        }
        roundBtn(ctx,30,-30,24,t('tut.key.ult'),(k%1.2)<0.5,true);
    }

    drawControl(ctx,kind,x,y,size) {
        const u=Math.max(0.6,Math.min(1.2,size/420));
        ctx.save();
        ctx.translate(x,y);
        ctx.scale(u,u);
        ctx.fillStyle=rgba('paper',0.8);
        ctx.fillRect(-6,-88,126,92);
        if (this.touch) {
            this.drawTouch(ctx,kind,this.animT);
        }
        else {
            this.drawKeys(ctx,kind,this.animT);
        }
        ctx.restore();
    }

    drawPages(ctx,x,y,w,h,v,reveal,walker) {
        const n=7;
        const bw=Math.min(80,(w-40)/n-10);
        const bx=x+w/2-(n*(bw+12)-12)/2;
        const cy=y+h*0.46;
        for (let i=0;i<n;i++) {
            const k=reveal?Math.max(0,Math.min(1,(this.animT-i*0.35)/0.3)):1;
            const boss=i===n-1;
            const rx=bx+i*(bw+12);
            ctx.fillStyle=k>=1?rgba(boss?'red':'ink',0.1):rgba('paper',1);
            ctx.fillRect(rx,cy-bw*0.7,bw,bw*1.4);
            drawShape(ctx,sketchRect(rx,cy-bw*0.7,bw,bw*1.4,{width:boss?2.4:1.6,seed:1900+i}),boss?PALETTE.red:PALETTE.ink,v);
            ctx.save();
            ctx.translate(rx+bw/2,cy);
            const sc=bw/90*(0.9+0.1*EASE.easeOutBack(k));
            ctx.scale(sc,sc);
            ENEMY_ICONS[boss?'inkBottle':FOE_LIST[i%FOE_LIST.length]](ctx,v);
            ctx.restore();
            ctx.fillStyle=boss?PALETTE.red:PALETTE.nearGray;
            ctx.font='bold 13px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='top';
            ctx.fillText(t(boss?'tut.bossPage':'tut.page',{n:i+1}),rx+bw/2,cy+bw*0.75);
        }
        if (walker) {
            const f=(this.animT*0.22)%1;
            const px=bx+f*(n*(bw+12)-12);
            const py=cy-bw*0.7-16-Math.abs(Math.sin(this.animT*8))*5;
            ctx.fillStyle=PALETTE.midGray;
            ctx.beginPath();
            ctx.arc(px,py,9,0,Math.PI*2);
            ctx.fill();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=2;
            ctx.stroke();
            ctx.fillStyle=PALETTE.paper;
            ctx.beginPath();
            ctx.arc(px,py,4,0,Math.PI*2);
            ctx.fill();
        }
    }

    drawIllus(ctx,step,x,y,w,h,art,v,ctl=true) {
        const anim=COACH_ANIMS[step.anim];
        if (anim) {
            drawStage(ctx,x,y,w,h,anim,this.animT,v);
            if (step.ctl&&ctl) {
                this.drawControl(ctx,step.ctl,x+10,y+h-8,w);
            }
            return;
        }
        ctx.save();
        ctx.beginPath();
        ctx.rect(x,y,w,h);
        ctx.clip();
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(x,y,w,h);
        if (step.draw==='goal') {
            this.drawPages(ctx,x,y,w,h,v,true,false);
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='12px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='bottom';
            ctx.fillText(t('tut.starNote'),x+w/2,y+h-10);
        }
        else if (step.draw==='merge') {
            const cs=Math.min(w/520,h/300);
            const cx=x+w/2;
            const cy=y+h/2-8;
            const k=(this.animT%3.2)/3.2;
            const gather=EASE.easeInOutCubic(Math.max(0,Math.min(1,(k-0.1)/0.35)));
            const flash=Math.max(0,Math.min(1,(k-0.45)/0.1));
            const card=createCard(TUTORIAL_MERGE,false);
            const up=createCard(TUTORIAL_MERGE,true);
            for (let i=0;i<3&&flash<1;i++) {
                ctx.save();
                ctx.translate(cx+(i-1)*150*cs*(1-gather),cy);
                ctx.rotate((i-1)*0.12*(1-gather));
                ctx.scale(cs*0.9,cs*0.9);
                ctx.drawImage(art.face(card,v),-59,-82,118,164);
                ctx.restore();
            }
            if (flash>0) {
                ctx.save();
                ctx.translate(cx,cy);
                const e=EASE.easeOutBack(Math.min(1,flash*1.2));
                ctx.scale(cs*1.1*e,cs*1.1*e);
                ctx.drawImage(art.face(up,v),-59,-82,118,164);
                ctx.restore();
                ctx.fillStyle=rgba('paper',Math.max(0,0.8-flash));
                ctx.fillRect(x,y,w,h);
            }
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold 15px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='bottom';
            ctx.fillText(t('tut.mergeNote'),cx,y+h-10);
        }
        else if (step.draw==='unlock') {
            const k=(this.animT%4)/4;
            const bw=w*0.62;
            const bx=x+w/2-bw/2;
            const by=y+h*0.18;
            const up=k>0.2;
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold 17px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='bottom';
            ctx.fillText(t('menu.level',{level:up?3:2}),bx,by-6);
            ctx.fillStyle=rgba('farGray',0.8);
            ctx.fillRect(bx,by,bw,12);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(bx,by,bw*(up?(k-0.2)*0.3:0.4+k/0.2*0.6),12);
            drawShape(ctx,sketchRect(bx,by,bw,12,{width:1.4,seed:1950}),PALETTE.ink,v);
            if (up) {
                const q=EASE.easeOutBack(Math.min(1,(k-0.2)/0.12));
                ctx.save();
                ctx.translate(bx+bw,by-14);
                ctx.scale(q,q);
                ctx.fillStyle=PALETTE.red;
                ctx.font='bold 15px '+FONT;
                ctx.textAlign='right';
                ctx.textBaseline='bottom';
                ctx.fillText(t('tut.unlockNote'),0,0);
                ctx.restore();
            }
            const cw=Math.min(w*0.36,170);
            const chh=h*0.5;
            const gy=y+h*0.36;
            const round=Math.floor(this.animT/4);
            const cards=TUTORIAL_DECK.concat([TUTORIAL_ULT]);
            for (let j=0;j<2;j++) {
                const rx=x+w/2+(j?12:-12-cw);
                ctx.fillStyle=rgba('paper',1);
                ctx.fillRect(rx,gy,cw,chh);
                drawShape(ctx,sketchRect(rx,gy,cw,chh,{width:2,seed:2470+j}),PALETTE.ink,v);
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold 16px '+FONT;
                ctx.textAlign='center';
                ctx.textBaseline='bottom';
                ctx.fillText(t(j?'menu.codex':'menu.weapon'),rx+cw/2,gy+chh-6);
                const q=EASE.easeOutBack(Math.max(0,Math.min(1,(k-0.25-j*0.1)/0.12)));
                if (q<=0) {
                    continue;
                }
                ctx.save();
                ctx.translate(rx+cw/2,gy+chh*0.44);
                ctx.scale(q,q);
                if (j===0) {
                    drawWeaponIcon(ctx,WEAPON_ORDER[(round+1)%WEAPON_ORDER.length],0,0,Math.min(cw,chh)/90,v,false);
                }
                else {
                    const s=chh*0.62/164;
                    ctx.scale(s,s);
                    ctx.drawImage(art.face(createCard(cards[round%cards.length]),v),-59,-82,118,164);
                }
                ctx.restore();
                ctx.save();
                ctx.translate(rx+cw-8,gy+8);
                ctx.rotate(0.15);
                ctx.scale(q,q);
                ctx.fillStyle=PALETTE.red;
                ctx.fillRect(-22,-10,44,20);
                ctx.fillStyle=PALETTE.paper;
                ctx.font='bold 12px '+FONT;
                ctx.textAlign='center';
                ctx.textBaseline='middle';
                ctx.fillText(t('tut.newTag'),0,1);
                ctx.restore();
            }
        }
        else if (step.draw==='end') {
            this.drawPages(ctx,x,y-h*0.08,w,h,v,false,true);
            const e=1+Math.sin(this.animT*3)*0.05;
            ctx.save();
            ctx.translate(x+w/2,y+h*0.86);
            ctx.scale(e,e);
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold 22px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('tut.endNote'),0,0);
            ctx.restore();
        }
        else if (step.draw==='deck') {
            this.drawDeckIllus(ctx,x,y,w,h,art,v);
        }
        ctx.restore();
        drawShape(ctx,sketchRect(x,y,w,h,{width:1.8,seed:1960}),PALETTE.ink,v);
        if (step.ctl&&ctl) {
            this.drawControl(ctx,step.ctl,x+10,y+h-8,w);
        }
    }

    drawDeckIllus(ctx,x,y,w,h,art,v) {
        const k=(this.animT%4.2)/4.2;
        const cl=q=>Math.max(0,Math.min(1,q));
        const s=Math.min(w/420,h/236);
        const px=x+w*0.62;
        const py=y+h*0.8;
        const bw=30*s;
        const bh=42*s;
        const press=cl((k-0.14)/0.06)*(1-cl((k-0.2)/0.06));
        for (let i=2;i>=0;i--) {
            ctx.fillStyle=i===0?PALETTE.ink:PALETTE.nearGray;
            ctx.fillRect(px-bw/2+i*3*s,py-bh/2-i*3*s+press*3,bw,bh);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.5;
            ctx.strokeRect(px-bw/2+i*3*s,py-bh/2-i*3*s+press*3,bw,bh);
        }
        if (press>0) {
            ctx.strokeStyle=rgba('red',press);
            ctx.lineWidth=2;
            ctx.beginPath();
            ctx.arc(px,py,bh*(0.6+press*0.5),0,Math.PI*2);
            ctx.stroke();
        }
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font='bold '+Math.round(11*s+2)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='top';
        ctx.fillText(t('deck.draw'),px,py+bh/2+4);
        const open=EASE.easeOutCubic(cl((k-0.22)/0.12))*(1-cl((k-0.9)/0.08));
        const cards=TUTORIAL_DECK.slice(0,5);
        const pw=w*0.86;
        const ph=h*0.6;
        const ox=x+w*0.07;
        const oy=y+h*0.06+(1-open)*h*0.4;
        let tip=null;
        if (open>0) {
            ctx.save();
            ctx.globalAlpha*=open;
            ctx.fillStyle=rgba('paper',0.97);
            ctx.fillRect(ox,oy,pw,ph);
            drawShape(ctx,sketchRect(ox,oy,pw,ph,{width:1.8,seed:2480}),PALETTE.ink,v);
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold '+Math.round(13*s+2)+'px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='top';
            ctx.fillText(t('deck.viewer'),ox+10,oy+6);
            const ch=ph*0.66;
            const cw=ch*118/164;
            const gap=(pw-20-cw*cards.length)/(cards.length-1);
            for (let i=0;i<cards.length;i++) {
                const cx=ox+10+i*(cw+gap);
                const cy=oy+ph-ch-10;
                ctx.drawImage(art.face(createCard(cards[i]),v),cx,cy,cw,ch);
                if (i===1&&k>0.45) {
                    ctx.strokeStyle=PALETTE.red;
                    ctx.lineWidth=2.5;
                    ctx.strokeRect(cx-3,cy-3,cw+6,ch+6);
                    tip={x:cx+cw+8,y:cy+ch*0.2,card:createCard(cards[i])};
                }
            }
            ctx.restore();
        }
        if (tip&&open>0.9) {
            const tw=w*0.36;
            const th=h*0.3;
            const q=EASE.easeOutBack(cl((k-0.45)/0.08));
            ctx.save();
            ctx.translate(tip.x,tip.y);
            ctx.scale(q,q);
            ctx.fillStyle=PALETTE.paper;
            ctx.fillRect(0,0,tw,th);
            drawShape(ctx,sketchRect(0,0,tw,th,{width:1.8,seed:2490}),PALETTE.red,v);
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold '+Math.round(13*s+2)+'px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='top';
            ctx.fillText(cardName(tip.card),8,6,tw-16);
            ctx.fillStyle=rgba('midGray',0.8);
            for (let i=0;i<3;i++) {
                ctx.fillRect(8,th*0.42+i*th*0.18,(tw-16)*(i===2?0.6:1),th*0.07);
            }
            ctx.restore();
        }
        const lerpP=(a,b,f)=>[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f];
        const start=[x+w*0.9,y+h*0.95];
        const card=[ox+10+(pw-20)*0.3,oy+ph*0.7];
        let cur=lerpP(start,[px,py],EASE.easeInOutCubic(cl(k/0.14)));
        if (k>0.3) {
            cur=lerpP([px,py],card,EASE.easeInOutCubic(cl((k-0.3)/0.14)));
        }
        if (this.touch) {
            ctx.fillStyle=rgba('ink',0.35);
            ctx.beginPath();
            ctx.arc(cur[0],cur[1],9*s+3,0,Math.PI*2);
            ctx.fill();
            return;
        }
        ctx.save();
        ctx.translate(cur[0],cur[1]);
        ctx.scale(s*1.2,s*1.2);
        ctx.fillStyle=PALETTE.paper;
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=1.6;
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(0,17);
        ctx.lineTo(4.5,13);
        ctx.lineTo(8,20);
        ctx.lineTo(10.5,19);
        ctx.lineTo(7,12);
        ctx.lineTo(12,12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    drawStrip(ctx,art) {
        const s=this.strip;
        if (!s) {
            return;
        }
        const S=TUNING.tutorial.strip;
        const sm=this.small();
        const v=time.boilIndex;
        const goals=s.step.goals;
        const lh=sm?S.lineSmall:S.line;
        const w=Math.min(sm?S.wSmall:S.w,this.width-24);
        const h=(sm?S.hSmall:S.h)+(goals.length-1)*lh;
        const x=this.width/2-w/2;
        const y=S.top-(1-EASE.easeOutBack(Math.min(1,s.t/0.35)))*(h+S.top);
        ctx.save();
        ctx.fillStyle=rgba('paper',0.95);
        ctx.fillRect(x,y,w,h);
        drawShape(ctx,sketchRect(x,y,w,h,{width:2,seed:2410}),PALETTE.ink,v);
        const ih=Math.min(h-12,(sm?S.hSmall:S.h)-12);
        const iw=Math.min(sm?S.illusSmall:S.illus,ih*16/9);
        this.drawIllus(ctx,s.step,x+6,y+(h-ih)/2,iw,ih,art,v,false);
        const tx=x+iw+16;
        const tw=x+w-tx-10;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold '+(sm?15:13)+'px '+FONT;
        ctx.fillText(t('tut.practice',{n:this.index+1,total:PRACTICE})+t('ui.gap')+t('tut.'+s.step.key+'.title'),tx,y+(sm?6:9),tw);
        const pr=sm?7:6;
        ctx.save();
        ctx.globalAlpha*=s.stamp>=0?1-Math.min(1,s.stamp/0.2)*0.75:1;
        for (let gi=0;gi<goals.length;gi++) {
            const g=goals[gi];
            const need=goalNeed(g);
            const cnt=s.counts[g]||0;
            const gy=y+(sm?30:30)+gi*lh;
            const pw=need*(pr*2+6);
            const ok=cnt>=need;
            ctx.textAlign='left';
            ctx.textBaseline='top';
            ctx.fillStyle=ok?PALETTE.midGray:PALETTE.ink;
            fitText(ctx,t('tut.goal.'+g,{n:need}),tx,gy,tw-pw-10,sm?18:16,'bold ');
            for (let i=0;i<need;i++) {
                const px=x+w-14-pr-(need-1-i)*(pr*2+6);
                const py=gy+(sm?10:9);
                const on=i<cnt;
                const sc=on&&i===cnt-1?1+(s.pulse[g]||0)*0.6:1;
                ctx.fillStyle=on?PALETTE.red:rgba('paper',1);
                ctx.beginPath();
                ctx.arc(px,py,pr*sc,0,Math.PI*2);
                ctx.fill();
                ctx.strokeStyle=on?PALETTE.darkRed:PALETTE.ink;
                ctx.lineWidth=1.8;
                ctx.stroke();
            }
        }
        ctx.restore();
        if (s.stamp>=0) {
            const q=EASE.easeOutBack(Math.min(1,s.stamp/0.25));
            const sc=1+(1-q)*1.5;
            ctx.save();
            ctx.translate(tx+tw/2,y+h/2+(sm?6:4));
            ctx.rotate(-0.18);
            ctx.scale(sc,sc);
            ctx.globalAlpha=Math.min(1,s.stamp/0.12);
            ctx.strokeStyle=PALETTE.red;
            ctx.lineWidth=3;
            ctx.strokeRect(-42,-18,84,36);
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold 22px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('tut.cleared'),0,1);
            ctx.restore();
        }
        ctx.restore();
    }

    drawConfetti(ctx) {
        const cols=[PALETTE.red,PALETTE.ink,PALETTE.midGray];
        for (const b of this.bits) {
            ctx.save();
            ctx.translate(b.x*this.width,b.y*this.height);
            ctx.rotate(b.r);
            ctx.fillStyle=cols[b.c];
            ctx.fillRect(-b.s/2,-b.s/4,b.s,b.s/2);
            ctx.restore();
        }
    }

    draw(ctx,art) {
        if (!this.shown()||!this.step) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const P=this.P;
        const sm=this.small();
        const step=this.step;
        const M=TUNING.tutorial.modal;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.4));
        ctx.save();
        ctx.fillStyle=rgba('paper',Math.min(0.6,this.t*3));
        ctx.fillRect(0,0,w,h);
        ctx.globalAlpha=Math.min(1,this.t*4);
        ctx.translate(w/2,h/2);
        ctx.scale(0.9+0.1*a,0.9+0.1*a);
        ctx.translate(-w/2,-h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:1970}),PALETTE.ink,v);
        const pad=sm?16:26;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold '+(sm?16:15)+'px '+FONT;
        ctx.fillText(t('tut.title')+t('ui.gap')+t('tut.stepOf',{n:this.index+1,total:TUTOR_STEPS.length}),P.x+pad,P.y+(sm?12:20));
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(sm?28:32)+'px '+FONT;
        ctx.fillText(t('tut.'+step.key+'.title'),P.x+pad,P.y+(sm?34:44));
        const cy=P.y+(sm?74:96);
        const ch=this.btn.y-cy-(sm?10:18);
        let iw=P.w*(sm?M.illusSmall:M.illus)-pad;
        let ih=iw*9/16;
        if (ih>ch) {
            ih=ch;
            iw=ih*16/9;
        }
        this.drawIllus(ctx,step,P.x+pad,cy+(ch-ih)/2,iw,ih,art,v);
        const tx=P.x+pad+iw+(sm?18:28);
        const tw=P.x+P.w-pad-tx;
        let ty=cy+(sm?2:8);
        const key='tut.'+step.key+'.body';
        const body=this.touch&&!step.info?t(key+'Touch'):t(key);
        ctx.font=(sm?'19px ':'18px ')+FONT;
        const lh=sm?25:27;
        for (const para of body.split('|')) {
            const lines=wrapText(ctx,para,tw-18);
            ctx.fillStyle=PALETTE.red;
            ctx.fillText('•',tx,ty);
            ctx.fillStyle=PALETTE.ink;
            for (const ln of lines) {
                ctx.fillText(ln,tx+16,ty);
                ty+=lh;
            }
            ty+=sm?5:9;
        }
        if (!step.info) {
            ty+=sm?2:6;
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold '+(sm?19:18)+'px '+FONT;
            ctx.fillText(t('tut.goalLabel'),tx,ty);
            ty+=lh;
            for (const g of step.goals) {
                for (const ln of wrapText(ctx,'✓ '+t('tut.goal.'+g,{n:goalNeed(g)}),tw-16)) {
                    ctx.fillText(ln,tx+16,ty);
                    ty+=lh;
                }
            }
        }
        const n=TUTOR_STEPS.length;
        const dy=this.btn.y+this.btn.h/2;
        const gap=sm?18:22;
        for (let i=0;i<n;i++) {
            const dx=P.x+pad+8+i*gap;
            const cur=i===this.index;
            ctx.fillStyle=cur?PALETTE.red:(i<this.index?PALETTE.ink:rgba('ink',0.2));
            ctx.beginPath();
            ctx.arc(dx,dy,cur?7+Math.sin(this.animT*5):5,0,Math.PI*2);
            ctx.fill();
        }
        drawButton(ctx,this.btn,this.label(),v,(this.t-0.15)/0.3,this.hoverIdx===0,20,false);
        ctx.restore();
        if (this.bits.length>0&&this.open) {
            this.drawConfetti(ctx);
        }
    }
}

function thumbLine(ctx,pts,color,w=2,close=false) {
    ctx.strokeStyle=color;
    ctx.lineWidth=w;
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for (let i=1;i<pts.length;i++) {
        ctx.lineTo(pts[i][0],pts[i][1]);
    }
    if (close) {
        ctx.closePath();
    }
    ctx.stroke();
}

function thumbDot(ctx,x,y,r,color,stroke=null) {
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.arc(x,y,r,0,Math.PI*2);
    ctx.fill();
    if (stroke) {
        ctx.strokeStyle=stroke;
        ctx.lineWidth=0.02;
        ctx.stroke();
    }
}

function thumbText(ctx,str,x,y,size,color) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(0.01,0.01);
    ctx.fillStyle=color;
    ctx.font='bold '+Math.round(size*100)+'px '+FONT;
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    ctx.fillText(str,0,0);
    ctx.restore();
}

const GAME_THUMBS={
    bells(ctx,T) {
        const on=Math.floor(T*2)%4;
        for (let i=0;i<4;i++) {
            const x=-0.33+i*0.22;
            const sw=i===on?Math.sin(T*14)*0.06:0;
            ctx.save();
            ctx.translate(x,-0.12);
            ctx.rotate(sw);
            ctx.fillStyle=i===on?PALETTE.red:PALETTE.paper;
            ctx.beginPath();
            ctx.moveTo(-0.05,0);
            ctx.lineTo(0.05,0);
            ctx.lineTo(0.09,0.22);
            ctx.lineTo(-0.09,0.22);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=0.02;
            ctx.stroke();
            ctx.restore();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=0.02;
            ctx.beginPath();
            ctx.ellipse(x,0.2,0.1,0.04,0,0,Math.PI*2);
            ctx.stroke();
        }
    },
    range(ctx,T) {
        for (let r=3;r>=1;r--) {
            thumbDot(ctx,0.12,0,r*0.09,r%2?PALETTE.paper:PALETTE.farGray,PALETTE.ink);
        }
        thumbDot(ctx,0.12,0,0.04,PALETTE.red);
        const f=(T*0.8)%1;
        thumbDot(ctx,-0.38+f*0.5,0.02-Math.sin(f*Math.PI)*0.15,0.035,PALETTE.ink);
    },
    trace(ctx,T) {
        const pts=[];
        for (let i=0;i<=20;i++) {
            const u=i/20;
            pts.push([-0.4+u*0.8,Math.sin(u*Math.PI*2)*0.18]);
        }
        ctx.setLineDash([0.05,0.04]);
        thumbLine(ctx,pts,PALETTE.midGray,0.025);
        ctx.setLineDash([]);
        const u=(T*0.4)%1;
        thumbLine(ctx,pts.slice(0,Math.max(2,Math.round(u*20)+1)),PALETTE.red,0.03);
        thumbDot(ctx,-0.4+u*0.8,Math.sin(u*Math.PI*2)*0.18,0.045,PALETTE.ink);
    },
    push(ctx,T) {
        ctx.strokeStyle=PALETTE.red;
        ctx.lineWidth=0.025;
        ctx.setLineDash([0.04,0.03]);
        ctx.beginPath();
        ctx.arc(0.25,0,0.14,0,Math.PI*2);
        ctx.stroke();
        ctx.setLineDash([]);
        const x=-0.2+((T*0.3)%1)*0.42;
        ctx.fillStyle=PALETTE.farGray;
        ctx.fillRect(x-0.1,-0.07,0.2,0.14);
        ctx.strokeStyle=PALETTE.ink;
        ctx.strokeRect(x-0.1,-0.07,0.2,0.14);
        thumbDot(ctx,x-0.18,0,0.05,PALETTE.midGray,PALETTE.ink);
    },
    pour(ctx,T) {
        const lv=(T*0.25)%1;
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-0.12,-0.28,0.24,0.5);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(-0.12,0.22-lv*0.5,0.24,lv*0.5);
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=0.025;
        ctx.strokeRect(-0.12,-0.28,0.24,0.5);
        thumbLine(ctx,[[-0.2,-0.14],[0.2,-0.14]],PALETTE.red,0.025);
    },
    tiles(ctx,T) {
        const n=Math.floor(T*2)%9;
        for (let i=0;i<9;i++) {
            const x=-0.27+(i%3)*0.18;
            const y=-0.27+Math.floor(i/3)*0.18;
            ctx.fillStyle=i===4?PALETTE.paper:(i<=n?PALETTE.ink:PALETTE.paper);
            ctx.fillRect(x,y,0.16,0.16);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=0.015;
            ctx.strokeRect(x,y,0.16,0.16);
        }
        thumbLine(ctx,[[-0.06,-0.06],[0.06,0.06]],PALETTE.red,0.03);
        thumbLine(ctx,[[0.06,-0.06],[-0.06,0.06]],PALETTE.red,0.03);
    },
    diff(ctx,T) {
        for (let k=0;k<2;k++) {
            const x=k?0.03:-0.4;
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=0.02;
            ctx.strokeRect(x,-0.2,0.37,0.4);
            thumbDot(ctx,x+0.1,-0.06,0.04,PALETTE.midGray);
            ctx.fillStyle=PALETTE.midGray;
            ctx.fillRect(x+0.2,0.04,k?0.05:0.1,0.08);
        }
        if (Math.floor(T*1.5)%2) {
            ctx.strokeStyle=PALETTE.red;
            ctx.lineWidth=0.025;
            ctx.beginPath();
            ctx.arc(0.27,0.08,0.09,0,Math.PI*2);
            ctx.stroke();
        }
    },
    pairs(ctx,T) {
        const up=Math.floor(T*1.2)%3;
        for (let i=0;i<6;i++) {
            const x=-0.33+(i%3)*0.24;
            const y=-0.22+Math.floor(i/3)*0.25;
            const face=i===up||i===up+3;
            ctx.fillStyle=face?PALETTE.paper:PALETTE.ink;
            ctx.fillRect(x,y,0.18,0.21);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=0.015;
            ctx.strokeRect(x,y,0.18,0.21);
            if (face) {
                thumbDot(ctx,x+0.09,y+0.105,0.04,PALETTE.red);
            }
        }
    },
    rain(ctx,T) {
        ctx.fillStyle=PALETTE.midGray;
        for (const [x,r] of [[-0.12,0.1],[0.02,0.13],[0.15,0.09]]) {
            thumbDot(ctx,x,-0.24,r,PALETTE.midGray);
        }
        for (let i=0;i<3;i++) {
            const f=(T*0.9+i*0.33)%1;
            const x=-0.2+i*0.2;
            ctx.fillStyle=rgba('ink',0.15+f*0.3);
            ctx.beginPath();
            ctx.ellipse(x,0.24,0.04+f*0.06,0.02+f*0.025,0,0,Math.PI*2);
            ctx.fill();
            thumbDot(ctx,x,-0.12+f*0.34,0.025,PALETTE.ink);
        }
    },
    dice(ctx,T) {
        const n=Math.floor(T*2)%6+1;
        ctx.save();
        ctx.rotate(Math.sin(T*3)*0.1);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(-0.17,-0.17,0.34,0.34);
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=0.025;
        ctx.strokeRect(-0.17,-0.17,0.34,0.34);
        const P={1:[[0,0]],2:[[-1,-1],[1,1]],3:[[-1,-1],[0,0],[1,1]],4:[[-1,-1],[1,-1],[-1,1],[1,1]],5:[[-1,-1],[1,-1],[0,0],[-1,1],[1,1]],6:[[-1,-1],[1,-1],[-1,0],[1,0],[-1,1],[1,1]]};
        for (const [a,b] of P[n]) {
            thumbDot(ctx,a*0.09,b*0.09,0.03,n===1?PALETTE.red:PALETTE.ink);
        }
        ctx.restore();
    },
    plane(ctx,T) {
        const f=(T*0.5)%1;
        ctx.fillStyle=PALETTE.midGray;
        ctx.fillRect(0.22,0.02,0.16,0.2);
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=0.02;
        ctx.strokeRect(0.22,0.02,0.16,0.2);
        const x=-0.35+f*0.6;
        const y=0.05-Math.sin(f*Math.PI)*0.25;
        ctx.save();
        ctx.translate(x,y);
        ctx.rotate(-0.3+f*0.6);
        ctx.fillStyle=PALETTE.paper;
        ctx.beginPath();
        ctx.moveTo(0.1,0);
        ctx.lineTo(-0.08,-0.06);
        ctx.lineTo(-0.04,0);
        ctx.lineTo(-0.08,0.06);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },
    maze(ctx,T) {
        const L=[[[-0.3,-0.3],[0.3,-0.3],[0.3,0.3],[-0.3,0.3],[-0.3,-0.1]],[[-0.15,-0.3],[-0.15,0.1]],[[0,0.3],[0,-0.1],[0.15,-0.1]],[[0.15,0.15],[0.3,0.15]]];
        for (const pts of L) {
            thumbLine(ctx,pts,PALETTE.ink,0.035);
        }
        thumbText(ctx,'★',0.22,0.04,0.16,PALETTE.red);
        thumbDot(ctx,-0.22,-0.2+Math.sin(T*2)*0.02,0.035,PALETTE.midGray,PALETTE.ink);
    },
    rhythm(ctx,T) {
        for (let i=0;i<3;i++) {
            const x=-0.25+i*0.25;
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=0.02;
            ctx.beginPath();
            ctx.ellipse(x,0.2,0.09,0.04,0,0,Math.PI*2);
            ctx.stroke();
            const f=(T*0.8+i*0.37)%1;
            thumbText(ctx,'♪',x,-0.25+f*0.42,0.16,i===1?PALETTE.red:PALETTE.ink);
        }
    },
    shadow(ctx,T) {
        const x=Math.sin(T*1.6)*0.25;
        ctx.fillStyle=PALETTE.midGray;
        ctx.beginPath();
        ctx.arc(x,-0.08,0.1,Math.PI,0);
        ctx.lineTo(x+0.1,0.08);
        ctx.lineTo(x+0.05,0.04);
        ctx.lineTo(x,0.08);
        ctx.lineTo(x-0.05,0.04);
        ctx.lineTo(x-0.1,0.08);
        ctx.closePath();
        ctx.fill();
        for (const [mx,my] of [[-0.3,0.2],[0.05,0.24],[0.3,0.18]]) {
            thumbLine(ctx,[[mx-0.04,my-0.04],[mx+0.04,my+0.04]],PALETTE.red,0.025);
            thumbLine(ctx,[[mx+0.04,my-0.04],[mx-0.04,my+0.04]],PALETTE.red,0.025);
        }
    },
    marble(ctx,T) {
        for (const [x,y] of [[-0.2,-0.15],[0.25,0.1],[-0.05,0.22]]) {
            thumbDot(ctx,x,y,0.07,PALETTE.ink);
        }
        const f=(T*0.5)%1;
        thumbDot(ctx,-0.35+f*0.6,-0.1+Math.sin(f*Math.PI*2)*0.12,0.05,PALETTE.paper,PALETTE.ink);
        thumbDot(ctx,0.3,-0.22,0.04,PALETTE.red);
    },
    cups(ctx,T) {
        const sw=Math.sin(T*2)*0.5+0.5;
        const xs=[-0.27+sw*0.27,0,0.27-sw*0.27];
        thumbDot(ctx,0,0.16,0.035,PALETTE.red);
        for (const x of xs) {
            ctx.fillStyle=PALETTE.farGray;
            ctx.beginPath();
            ctx.moveTo(x-0.07,-0.12);
            ctx.lineTo(x+0.07,-0.12);
            ctx.lineTo(x+0.1,0.14);
            ctx.lineTo(x-0.1,0.14);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=0.02;
            ctx.stroke();
        }
    }
};

function drawGameThumb(ctx,id,x,y,s,v,hot) {
    ctx.save();
    ctx.fillStyle=hot?rgba('red',0.06):rgba('farGray',0.35);
    ctx.fillRect(x,y,s,s);
    drawShape(ctx,sketchRect(x,y,s,s,{width:1.2,seed:1700+id.length}),PALETTE.midGray,v);
    ctx.beginPath();
    ctx.rect(x,y,s,s);
    ctx.clip();
    ctx.translate(x+s/2,y+s/2);
    ctx.scale(s,s);
    ctx.lineCap='round';
    ctx.lineJoin='round';
    const f=GAME_THUMBS[id];
    if (f) {
        f(ctx,time.real);
    }
    ctx.restore();
}

function drawWeaponIcon(ctx,id,x,y,s,v,locked) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    ctx.rotate(-0.6);
    const ink=locked?PALETTE.midGray:PALETTE.ink;
    const fill=locked?PALETTE.farGray:PALETTE.paper;
    const shape=(pts,f)=>{
        ctx.fillStyle=f;
        ctx.beginPath();
        ctx.moveTo(pts[0][0],pts[0][1]);
        for (const p of pts) {
            ctx.lineTo(p[0],p[1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle=ink;
        ctx.lineWidth=2.4;
        ctx.stroke();
    };
    if (id==='pen') {
        shape([[-30,-6],[14,-6],[14,6],[-30,6]],locked?fill:PALETTE.midGray);
        shape([[14,-6],[30,0],[14,6]],ink);
        shape([[-36,-7],[-28,-7],[-28,7],[-36,7]],fill);
    }
    else if (id==='pencil') {
        shape([[-30,-6],[14,-6],[14,6],[-30,6]],locked?fill:'#C49A52');
        shape([[14,-6],[28,0],[14,6]],fill);
        shape([[24,-2],[30,0],[24,2]],ink);
        shape([[-38,-6],[-30,-6],[-30,6],[-38,6]],locked?fill:PALETTE.red);
    }
    else if (id==='brush') {
        shape([[-34,-3],[8,-4],[8,4],[-34,3]],locked?fill:'#AC8E64');
        shape([[8,-6],[14,-6],[14,6],[8,6]],fill);
        shape([[14,-7],[34,0],[14,7]],ink);
    }
    else if (id==='stapler') {
        shape([[-30,2],[28,2],[28,10],[-30,10]],locked?fill:PALETTE.nearGray);
        shape([[-30,-10],[24,-6],[26,2],[-30,2]],locked?fill:PALETTE.midGray);
        shape([[24,-2],[32,-2],[32,4],[24,4]],ink);
    }
    else if (id==='highlighter') {
        shape([[-28,-9],[14,-9],[14,9],[-28,9]],locked?fill:'#EDD6A6');
        shape([[-36,-10],[-26,-10],[-26,10],[-36,10]],locked?fill:PALETTE.red);
        shape([[14,-7],[26,-3],[26,3],[14,7]],ink);
    }
    else {
        shape([[-4,-30],[4,-30],[4,-20],[-4,-20]],fill);
        shape([[-3,-20],[3,-20],[-16,26],[-20,24]],locked?fill:PALETTE.midGray);
        shape([[-3,-20],[3,-20],[20,24],[16,26]],locked?fill:PALETTE.midGray);
        shape([[16,24],[22,24],[19,32]],ink);
    }
    ctx.restore();
}

function weaponValue(def,key) {
    if (key==='dmg') {
        if (def.bands) {
            return t('weapon.val.dmgRange',{a:Math.min(...def.bands),b:Math.max(...def.bands)});
        }
        return (def.pellets||1)>1?t('weapon.val.dmgN',{d:def.damage,n:def.pellets}):String(def.damage);
    }
    if (key==='rate') {
        return def.cooldown?t('weapon.val.cd',{s:def.cooldown}):t('weapon.val.rate',{n:(1/def.fireInterval*(def.burst||1)).toFixed(1)});
    }
    if (key==='range') {
        if (def.beam) {
            return t('weapon.val.range',{n:def.beam.range});
        }
        const fx=TUNING.weaponFx[def.sys]||{};
        const r=fx.drag?def.bulletSpeed/fx.drag*(1-Math.exp(-fx.drag*def.bulletLife)):def.bulletSpeed*def.bulletLife;
        return t('weapon.val.range',{n:r.toFixed(1)});
    }
    return def.cooldown?t('weapon.val.none'):t('weapon.val.mag',{n:def.magazine,s:def.reloadTime});
}

export class WeaponView extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.sel='pen';
        this.animT=0;
        this.hits=[];
        this.hx=-1;
        this.hy=-1;
        this.pop=0;
        this.bars={};
    }

    show() {
        super.show();
        this.sel=settings.weapon||'pen';
        this.animT=0;
        this.pop=0;
    }

    hover(x,y) {
        super.hover(x,y);
        this.hx=x;
        this.hy=y;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const pw=Math.min(1060,w-20,fitW(h));
        const ph=Math.min(h-16,small?h-16:640);
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const bh=small?40:48;
        const by=this.P.y+ph-(small?48:64);
        this.backBtn={x:this.P.x+24,y:by,w:small?130:160,h:bh};
        this.equipBtn={x:this.P.x+pw-24-(small?170:200),y:by,w:small?170:200,h:bh};
        this.buttons=[this.backBtn,this.equipBtn];
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.backBtn,x,y)) {
            this.actions.back();
            return true;
        }
        if (inRect(this.equipBtn,x,y)) {
            if (weaponUnlocked(this.sel,effectiveLevel())&&settings.weapon!==this.sel) {
                this.pop=1;
                this.equipT=0;
                this.equipId=this.sel;
                this.actions.equip(this.sel);
            }
            return true;
        }
        for (const q of this.hits) {
            if (inRect(q,x,y)) {
                if (q.id!==this.sel) {
                    this.sel=q.id;
                    this.animT=0;
                    this.actions.select();
                }
                return true;
            }
        }
        return true;
    }

    update(dt) {
        super.update(dt);
        this.animT+=dt;
        this.pop=Math.max(0,this.pop-dt*2.5);
        this.equipT=(this.equipT??9)+dt;
        const st=WEAPONS[this.sel]?.stats;
        const k=1-Math.exp(-10*dt);
        for (const key of WEAPON_STATS) {
            this.bars[key]=(this.bars[key]??0)+((st?st[key]:0)-(this.bars[key]??0))*k;
        }
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const P=this.P;
        const small=h<600;
        const lv=effectiveLevel();
        const a=EASE.easeOutBack(Math.min(1,this.t/0.4));
        ctx.save();
        ctx.fillStyle=rgba('paper',Math.min(0.85,this.t*4));
        ctx.fillRect(0,0,w,h);
        ctx.translate(w/2,h/2);
        ctx.scale(0.9+0.1*a,0.9+0.1*a);
        ctx.translate(-w/2,-h/2);
        ctx.globalAlpha=Math.min(1,this.t*4);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:2000}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?20:28)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t('weapon.title'),P.x+24,P.y+(small?22:34));
        ctx.font='13px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='right';
        ctx.fillText(t('weapon.hint'),P.x+P.w-24,P.y+(small?23:36));
        const gx=P.x+24;
        const gy=P.y+(small?46:70);
        const gw=P.w*0.42;
        const cols=2;
        const cg=12;
        const cw=(gw-cg)/cols;
        const rows=WEAPON_ORDER.length/cols;
        const U=TUNING.weaponUi;
        const randH=small?U.randHSmall:U.randH;
        const ch=Math.min(small?78:120,(this.backBtn.y-gy-16-randH-cg-(rows-1)*cg)/rows);
        this.hits=[];
        this.drawRandomTile(ctx,{x:gx,y:gy+rows*(ch+cg),w:gw,h:randH,id:RANDOM_WEAPON.id},lv,small,v);
        for (let i=0;i<WEAPON_ORDER.length;i++) {
            const id=WEAPON_ORDER[i];
            const x=gx+(i%cols)*(cw+cg);
            const y=gy+Math.floor(i/cols)*(ch+cg);
            const r={x,y,w:cw,h:ch,id};
            this.hits.push(r);
            const locked=!weaponUnlocked(id,lv);
            const sel=id===this.sel;
            const eq=id===settings.weapon;
            const hv=inRect(r,this.hx,this.hy);
            const ap=EASE.easeOutBack(Math.max(0,Math.min(1,(this.t-0.08-i*0.05)/0.3)));
            if (ap<=0) {
                continue;
            }
            const Q=TUNING.weaponUi.equip;
            const et=id===this.equipId?this.equipT:9;
            const eqOn=et<Q.time;
            const jolt=eqOn?Math.sin(Math.min(1,et/Q.jolt)*Math.PI)*Q.joltScale:0;
            ctx.save();
            ctx.translate(x+cw/2,y+ch/2);
            ctx.scale(ap*(hv||sel?1.03:1)*(1+jolt),ap*(hv||sel?1.03:1)*(1+jolt));
            ctx.rotate(eqOn?Math.sin(et*40)*Q.shake*(1-et/Q.time):0);
            ctx.translate(-cw/2,-ch/2);
            ctx.fillStyle=sel?rgba('ink',0.08):(hv?rgba('farGray',0.6):rgba('paper',0.95));
            ctx.fillRect(0,0,cw,ch);
            if (eqOn) {
                ctx.fillStyle=rgba('red',0.25*(1-et/Q.time));
                ctx.fillRect(0,0,cw,ch);
            }
            drawShape(ctx,sketchRect(0,0,cw,ch,{width:sel?2.8:1.5,seed:2010+i}),eqOn?PALETTE.red:(sel?PALETTE.ink:PALETTE.nearGray),v);
            const bob=sel?Math.sin(this.animT*3)*3:0;
            if (eqOn) {
                const sk=Math.min(1,et/Q.spinTime);
                ctx.save();
                ctx.translate(ch*0.5,ch*0.5+bob-Math.sin(sk*Math.PI)*ch*Q.lift);
                ctx.rotate((1-EASE.easeOutCubic(sk))*Math.PI*2*Q.spins);
                ctx.scale(1+Math.sin(sk*Math.PI)*Q.grow,1+Math.sin(sk*Math.PI)*Q.grow);
                drawWeaponIcon(ctx,id,0,0,ch/110,v,locked);
                ctx.restore();
            }
            else {
                drawWeaponIcon(ctx,id,ch*0.5,ch*0.5+bob,ch/110,v,locked);
            }
            ctx.fillStyle=locked?PALETTE.midGray:PALETTE.ink;
            ctx.textAlign='left';
            ctx.textBaseline='middle';
            const tw=cw-ch*0.98-14;
            fitText(ctx,t('weapon.'+id+'.name'),ch*0.98,ch*0.38,tw,small?15:19,'bold ');
            ctx.fillStyle=locked?PALETTE.red:PALETTE.nearGray;
            fitText(ctx,locked?t('codex.locked',{level:WEAPONS[id].unlock}):t('weapon.'+id+'.short'),ch*0.98,ch*0.66,tw,12,'');
            if (eqOn) {
                const k=et/Q.time;
                for (let d=0;d<Q.drops;d++) {
                    const an=hash1(d*7+i)*Math.PI*2;
                    const dist=EASE.easeOutCubic(Math.min(1,et/Q.dropTime))*(cw*0.35+hash1(d*3)*cw*0.3);
                    ctx.fillStyle=d%3===0?rgba('red',1-k):rgba('ink',1-k);
                    ctx.beginPath();
                    ctx.arc(ch*0.5+Math.cos(an)*dist,ch*0.5+Math.sin(an)*dist*0.6,2+hash1(d*5)*4,0,Math.PI*2);
                    ctx.fill();
                }
            }
            if (eq) {
                const sk=eqOn?Math.min(1,Math.max(0,(et-Q.stampDelay)/Q.stampTime)):1;
                ctx.save();
                ctx.translate(cw-10,10);
                ctx.rotate(0.12+(1-sk)*0.4);
                const s=sk<1?Q.stampFrom-(Q.stampFrom-1)*EASE.easeOutBack(sk):1;
                ctx.globalAlpha*=sk;
                ctx.scale(s,s);
                ctx.fillStyle=PALETTE.red;
                ctx.fillRect(-40,-2,44,20);
                ctx.fillStyle=PALETTE.paper;
                ctx.font='bold 12px '+FONT;
                ctx.textAlign='center';
                ctx.fillText(t('weapon.equipped'),-18,8);
                ctx.restore();
            }
            ctx.restore();
        }
        const dx=gx+gw+24;
        const dw=P.x+P.w-24-dx;
        const locked=!weaponUnlocked(this.sel,lv);
        const rnd=this.sel===RANDOM_WEAPON.id;
        const def=rnd?{unlock:0}:WEAPONS[this.sel];
        const sh=Math.min(dw*9/16,small?(this.backBtn.y-gy)*0.46:230);
        if (rnd) {
            this.drawRandomStage(ctx,dx,gy,dw,sh,lv,v);
        }
        else {
            drawStage(ctx,dx,gy,dw,sh,WEAPON_ANIMS[this.sel],this.animT,v);
        }
        drawShape(ctx,sketchRect(dx,gy,dw,sh,{width:1.6,seed:2030}),PALETTE.ink,v);
        if (locked) {
            ctx.fillStyle=rgba('paper',0.55);
            ctx.fillRect(dx,gy,dw,sh);
        }
        let y=gy+sh+(small?10:18);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?18:24)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(t('weapon.'+this.sel+'.name'),dx,y);
        y+=small?26:34;
        ctx.font=(small?'12px ':'14px ')+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        const lines=wrapText(ctx,t('weapon.'+this.sel+'.desc'),dw);
        for (let i=0;i<lines.length&&i<3;i++) {
            ctx.fillText(lines[i],dx,y);
            y+=small?16:20;
        }
        y+=small?6:10;
        const bw=dw*0.46;
        if (rnd) {
            const names=unlockedWeapons(lv).map(id=>t('weapon.'+id+'.name')).join(t('ui.list'));
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold '+(small?12:14)+'px '+FONT;
            ctx.fillText(t('weapon.random.pool',{list:names}),dx,y);
            const last=settings.lastWeapon;
            if (WEAPONS[last]) {
                ctx.fillStyle=PALETTE.red;
                ctx.font=(small?'12px ':'13px ')+FONT;
                ctx.fillText(t('weapon.random.last',{name:t('weapon.'+last+'.name')}),dx,y+(small?18:24));
            }
        }
        for (let i=0;i<WEAPON_STATS.length&&!rnd;i++) {
            const key=WEAPON_STATS[i];
            const bx=dx+(i%2)*(dw/2);
            const U=TUNING.weaponUi;
            const byy=y+Math.floor(i/2)*(small?U.rowS:U.row);
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold 13px '+FONT;
            ctx.textAlign='left';
            ctx.textBaseline='middle';
            const lab=t('weapon.stat.'+key);
            ctx.fillText(lab,bx,byy+6);
            const vx=bx+ctx.measureText(lab).width+8;
            ctx.fillStyle=PALETTE.nearGray;
            fitText(ctx,weaponValue(def,key),vx,byy+6,bw-(vx-bx),small?11:12,'');
            const bh=small?U.barS:U.bar;
            for (let s=0;s<5;s++) {
                const f=Math.max(0,Math.min(1,(this.bars[key]||0)-s));
                const sx=bx+s*(bw/5);
                ctx.fillStyle=rgba('farGray',0.7);
                ctx.fillRect(sx,byy+15,bw/5-4,bh);
                ctx.fillStyle=key==='dmg'?PALETTE.red:PALETTE.ink;
                ctx.fillRect(sx,byy+15,(bw/5-4)*f,bh);
            }
        }
        drawButton(ctx,this.backBtn,t('menu.back'),v,(this.t-0.1)/0.3,this.hoverIdx===0,small?15:17);
        const eq=settings.weapon===this.sel;
        const label=locked?(rnd?t('weapon.random.locked',{n:RANDOM_WEAPON.min}):t('codex.locked',{level:def.unlock})):(eq?t('weapon.equipped'):t(rnd?'weapon.random.equip':'weapon.equip'));
        const eb=this.equipBtn;
        if (!locked&&!eq) {
            ctx.save();
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(eb.x,eb.y,eb.w,eb.h);
            drawShape(ctx,sketchRect(eb.x,eb.y,eb.w,eb.h,{width:2,seed:2040}),PALETTE.ink,v);
            ctx.fillStyle=PALETTE.paper;
            ctx.font='bold '+(small?15:18)+'px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            const s=this.hoverIdx===1?1.05:1;
            ctx.translate(eb.x+eb.w/2,eb.y+eb.h/2);
            ctx.scale(s,s);
            ctx.fillText(label,0,1);
            ctx.restore();
        }
        else {
            ctx.save();
            drawShape(ctx,sketchRect(eb.x,eb.y,eb.w,eb.h,{width:1.6,seed:2041}),locked?PALETTE.midGray:PALETTE.red,v);
            ctx.fillStyle=locked?PALETTE.midGray:PALETTE.red;
            ctx.font='bold '+(small?14:16)+'px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(label,eb.x+eb.w/2,eb.y+eb.h/2+1);
            ctx.restore();
        }
        ctx.restore();
    }

    drawRandomTile(ctx,r,lv,small,v) {
        this.hits.push(r);
        const locked=!weaponUnlocked(r.id,lv);
        const sel=this.sel===r.id;
        const eq=settings.weapon===r.id;
        const hv=inRect(r,this.hx,this.hy);
        const ap=EASE.easeOutBack(Math.max(0,Math.min(1,(this.t-0.08-WEAPON_ORDER.length*0.05)/0.3)));
        if (ap<=0) {
            return;
        }
        ctx.save();
        ctx.translate(r.x+r.w/2,r.y+r.h/2);
        ctx.scale(ap*(hv||sel?1.02:1),ap*(hv||sel?1.02:1));
        ctx.translate(-r.w/2,-r.h/2);
        ctx.fillStyle=sel?rgba('ink',0.08):(hv?rgba('farGray',0.6):rgba('paper',0.95));
        ctx.fillRect(0,0,r.w,r.h);
        drawShape(ctx,sketchRect(0,0,r.w,r.h,{width:sel?2.8:1.5,seed:2025}),eq?PALETTE.red:(sel?PALETTE.ink:PALETTE.nearGray),v);
        const d=r.h*0.62;
        const spin=sel&&!locked?Math.sin(this.animT*4)*0.25:0;
        ctx.save();
        ctx.translate(r.h*0.62,r.h/2);
        ctx.rotate(spin-0.12);
        ctx.fillStyle=locked?PALETTE.farGray:PALETTE.paper;
        ctx.fillRect(-d/2,-d/2,d,d);
        drawShape(ctx,sketchRect(-d/2,-d/2,d,d,{width:1.8,seed:2026}),locked?PALETTE.midGray:PALETTE.ink,v);
        ctx.fillStyle=locked?PALETTE.midGray:PALETTE.red;
        for (const [px,py] of [[-0.22,-0.22],[0.22,0.22],[0,0],[0.22,-0.22],[-0.22,0.22]]) {
            ctx.beginPath();
            ctx.arc(px*d,py*d,d*0.08,0,Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle=locked?PALETTE.midGray:PALETTE.ink;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        const x0=r.h*1.25;
        fitText(ctx,t('weapon.random.name'),x0,r.h/2,r.w*0.3,small?15:19,'bold ');
        const rx=x0+ctx.measureText(t('weapon.random.name')).width+12;
        ctx.fillStyle=locked?PALETTE.red:PALETTE.nearGray;
        fitText(ctx,locked?t('weapon.random.locked',{n:RANDOM_WEAPON.min}):t('weapon.random.short'),rx,r.h/2+1,r.w-rx-10-(eq?58:0),12,'');
        if (eq) {
            ctx.save();
            ctx.translate(r.w-10,r.h/2-10);
            ctx.rotate(0.08);
            ctx.fillStyle=PALETTE.red;
            ctx.fillRect(-46,0,44,20);
            ctx.fillStyle=PALETTE.paper;
            ctx.font='bold 12px '+FONT;
            ctx.textAlign='center';
            ctx.fillText(t('weapon.equipped'),-24,10);
            ctx.restore();
        }
        ctx.restore();
    }

    drawRandomStage(ctx,x,y,w,h,lv,v) {
        const U=TUNING.weaponUi;
        const list=unlockedWeapons(lv);
        const pool=list.length>0?list:WEAPON_ORDER;
        const step=Math.floor(this.animT/U.randStep);
        const f=(this.animT%U.randStep)/U.randStep;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x,y,w,h);
        ctx.clip();
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(x,y,w,h);
        const cx=x+w/2;
        const cy=y+h/2;
        const s=h/150;
        const e=EASE.easeInOutCubic(f);
        const items=[];
        for (let k=-2;k<=3;k++) {
            const dp=k-e;
            items.push({k,dp,id:pool[((step+k)%pool.length+pool.length)%pool.length]});
        }
        items.sort((p,q)=>Math.abs(q.dp)-Math.abs(p.dp));
        for (const q of items) {
            const near=Math.max(0,1-Math.abs(q.dp));
            ctx.globalAlpha=Math.max(0,1-Math.abs(q.dp)*0.45);
            drawWeaponIcon(ctx,q.id,cx+q.dp*h*0.55,cy,s*(0.8+0.45*near*near),v,false);
        }
        ctx.globalAlpha=1;
        ctx.strokeStyle=PALETTE.red;
        ctx.lineWidth=2.5;
        ctx.strokeRect(cx-h*0.3,cy-h*0.36,h*0.6,h*0.72);
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold '+Math.round(h*0.18)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('?',cx+h*0.36,cy-h*0.3);
        ctx.restore();
    }
}

const WEAPON_STATS=['dmg','rate','range','mag'];

export class LevelUpView extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.cards=[];
        this.weapons=[];
        this.sounded=0;
    }

    open2(from,to,cards,weapons) {
        this.from=from;
        this.to=to;
        this.cards=cards.map(id=>createCard(id));
        this.weapons=weapons;
        this.sounded=0;
        this.show();
    }

    doneAt() {
        const U=TUNING.levelUp;
        return U.cardsAt+this.cards.length*U.cardGap+U.cardTime;
    }

    down() {
        if (!this.open) {
            return false;
        }
        if (this.t>=this.doneAt()) {
            this.actions.close();
        }
        else {
            this.t=this.doneAt();
        }
        return true;
    }

    update(dt) {
        super.update(dt);
        if (!this.open) {
            return;
        }
        const U=TUNING.levelUp;
        if (this.sounded===0&&this.t>U.stampAt) {
            this.sounded=1;
            this.actions.sound('clear',1);
        }
        const k=Math.floor((this.t-U.cardsAt)/U.cardGap)+2;
        if (this.sounded>=1&&this.sounded<k&&this.sounded<=this.cards.length) {
            this.sounded++;
            this.actions.sound('page',1.2+this.sounded*0.05);
        }
    }

    draw(ctx,art) {
        if (!this.shown()) {
            return;
        }
        const U=TUNING.levelUp;
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const tt=this.t;
        const small=h<600;
        ctx.save();
        ctx.globalAlpha=Math.min(1,this.t*4);
        ctx.fillStyle=rgba('paper',0.88);
        ctx.fillRect(0,0,w,h);
        const sy=h*(this.cards.length>0?U.titleY:0.42);
        const sk=Math.max(0,Math.min(1,(tt-U.stampAt)/U.stampTime));
        if (sk>0) {
            const sc=sk<1?U.stampFrom-(U.stampFrom-1)*EASE.easeOutBack(sk):1;
            for (let i=0;i<U.drops;i++) {
                const an=hash1(i*7.3)*Math.PI*2;
                const d=EASE.easeOutCubic(sk)*(120+hash1(i*3.1)*180);
                ctx.fillStyle=i%3===0?rgba('red',0.7*(1-sk*0.6)):rgba('ink',0.6*(1-sk*0.6));
                ctx.beginPath();
                ctx.arc(w/2+Math.cos(an)*d,sy+Math.sin(an)*d*0.5,3+hash1(i)*6,0,Math.PI*2);
                ctx.fill();
            }
            ctx.save();
            ctx.translate(w/2,sy);
            ctx.rotate(-0.06+(1-sk)*0.3);
            ctx.scale(sc,sc);
            ctx.globalAlpha*=Math.min(1,sk*3);
            ctx.font='bold '+(small?38:56)+'px '+FONT;
            const tw=ctx.measureText(t('levelUp.title')).width+48;
            const th=small?60:84;
            ctx.fillStyle=PALETTE.red;
            ctx.fillRect(-tw/2,-th/2,tw,th);
            drawShape(ctx,sketchRect(-tw/2,-th/2,tw,th,{width:2.4,seed:2400}),PALETTE.ink,v);
            ctx.fillStyle=PALETTE.paper;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('levelUp.title'),0,2);
            ctx.restore();
        }
        const lk=Math.max(0,Math.min(1,(tt-U.levelAt)/0.4));
        if (lk>0) {
            ctx.globalAlpha=lk;
            ctx.fillStyle=PALETTE.ink;
            ctx.font='bold '+(small?20:26)+'px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            const shown=lk<1?this.from:this.to;
            ctx.fillText(t('levelUp.levels',{from:this.from,to:shown}),w/2,sy+(small?52:72));
            ctx.globalAlpha=1;
        }
        const n=this.cards.length;
        if (n>0) {
            const cs=Math.min(small?0.62:0.95,(w-80)/(n*(CARD_W+18)));
            const cw=CARD_W*cs;
            const ch=CARD_H*cs;
            const row=n*cw+(n-1)*18*cs;
            const cy=h*U.cardsY;
            const lab=Math.max(0,Math.min(1,(tt-U.cardsAt+0.2)/0.3));
            ctx.globalAlpha=lab;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='bold '+(small?14:17)+'px '+FONT;
            ctx.textAlign='center';
            ctx.fillText(t('levelUp.cards'),w/2,cy-ch/2-(small?16:24));
            ctx.globalAlpha=1;
            this.cards.forEach((c,i)=>{
                const k=Math.max(0,Math.min(1,(tt-U.cardsAt-i*U.cardGap)/U.cardTime));
                if (k<=0) {
                    return;
                }
                const x=w/2-row/2+cw/2+i*(cw+18*cs);
                const e=EASE.easeOutBack(k);
                const fy=cy+(1-EASE.easeOutCubic(k))*h*0.6;
                const flip=Math.cos(Math.min(1,k*1.4)*Math.PI);
                ctx.save();
                ctx.translate(x,fy);
                ctx.rotate((1-e)*(i%2?0.5:-0.5));
                ctx.scale(Math.max(0.04,Math.abs(flip))*(0.7+0.3*e),0.7+0.3*e);
                const img=flip>0?art.back(v):art.face(c,v);
                ctx.drawImage(img,-cw/2,-ch/2,cw,ch);
                if (k>=1) {
                    const glow=Math.max(0,1-(tt-U.cardsAt-i*U.cardGap-U.cardTime)*2);
                    if (glow>0) {
                        ctx.strokeStyle=rgba('red',glow);
                        ctx.lineWidth=4;
                        ctx.strokeRect(-cw/2-4,-ch/2-4,cw+8,ch+8);
                    }
                }
                ctx.restore();
            });
        }
        if (this.weapons.length>0) {
            const wk=Math.max(0,Math.min(1,(tt-U.levelAt-0.3)/0.4));
            ctx.globalAlpha=wk;
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold '+(small?15:18)+'px '+FONT;
            ctx.textAlign='center';
            ctx.fillText(t('levelUp.weapons',{names:this.weapons.map(id=>t('weapon.'+id+'.name')).join(t('ui.list'))}),w/2,h*U.weaponY);
            ctx.globalAlpha=1;
        }
        if (tt>=this.doneAt()) {
            ctx.globalAlpha=0.6+0.4*Math.sin(time.real*4);
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font=(small?'13px ':'15px ')+FONT;
            ctx.textAlign='center';
            ctx.fillText(t('levelUp.tap'),w/2,h-(small?22:34));
        }
        ctx.restore();
    }
}

export class InfoPopup extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.title='';
        this.body='';
    }

    open2(title,body) {
        this.title=title;
        this.body=body;
        this.show();
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const pw=Math.min(500,w-32);
        const ph=Math.min(h-24,260);
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const bw=Math.min(200,pw-60);
        this.okBtn={x:w/2-bw/2,y:this.P.y+ph-66,w:bw,h:48};
        this.buttons=[this.okBtn];
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.okBtn,x,y)) {
            this.actions.close();
        }
        return true;
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const P=this.P;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.4));
        ctx.save();
        ctx.fillStyle=rgba('ink',Math.min(0.35,this.t*1.5));
        ctx.fillRect(0,0,w,h);
        ctx.translate(w/2,h/2);
        ctx.scale(a,a);
        ctx.translate(-w/2,-h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(P.x,P.y,P.w,6);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:2101}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 22px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(this.title,P.x+28,P.y+44);
        ctx.font='15px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textBaseline='top';
        const lines=wrapText(ctx,this.body,P.w-56);
        for (let i=0;i<lines.length;i++) {
            ctx.fillText(lines[i],P.x+28,P.y+74+i*22);
        }
        ctx.restore();
        drawButton(ctx,this.okBtn,t('notice.ok'),v,(this.t-0.15)/0.3,this.hoverIdx===0,18);
    }
}

export const CHOICE_ICONS={battle:'battle',elite:'elite',challenge:'challenge',treasure:'treasure',shop:'shop',event:'event',encounter:'event',start:'next',swap:'pen',home:'leave',games:'event',back:'leave',rest:'rest',heal:'heal',upgrade:'upgrade',buy:'card',remove:'remove',leave:'leave',finish:'flag',continue:'pen',boss:'boss',next:'next',act:'book'};

export function drawChoiceIcon(ctx,kind,x,y,r,v,red) {
    const col=red?PALETTE.red:PALETTE.ink;
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle=red?rgba('red',0.1):rgba('ink',0.06);
    ctx.beginPath();
    ctx.arc(0,0,r,0,Math.PI*2);
    ctx.fill();
    drawShape(ctx,sketchCircle(0,0,r,{width:1.8,seed:2200+kind.length}),col,v);
    ctx.strokeStyle=col;
    ctx.fillStyle=col;
    ctx.lineWidth=3;
    ctx.lineCap='round';
    ctx.lineJoin='round';
    const k=r*0.5;
    ctx.beginPath();
    if (kind==='battle') {
        ctx.moveTo(-k,-k);
        ctx.lineTo(k,k);
        ctx.moveTo(k,-k);
        ctx.lineTo(-k,k);
        ctx.stroke();
    }
    else if (kind==='elite') {
        ctx.moveTo(-k,k*0.6);
        ctx.lineTo(-k,-k*0.5);
        ctx.lineTo(-k*0.4,0);
        ctx.lineTo(0,-k);
        ctx.lineTo(k*0.4,0);
        ctx.lineTo(k,-k*0.5);
        ctx.lineTo(k,k*0.6);
        ctx.closePath();
        ctx.fill();
    }
    else if (kind==='shop'||kind==='pen') {
        ctx.save();
        ctx.rotate(-0.7);
        ctx.strokeRect(-k*1.1,-k*0.25,k*1.6,k*0.5);
        ctx.moveTo(k*0.5,-k*0.25);
        ctx.lineTo(k*1.1,0);
        ctx.lineTo(k*0.5,k*0.25);
        ctx.stroke();
        ctx.restore();
    }
    else if (kind==='rest') {
        ctx.strokeRect(-k*0.45,-k*0.4,k*0.9,k*1.3);
        ctx.fillRect(-k*0.25,-k*0.85,k*0.5,k*0.45);
    }
    else if (kind==='heal') {
        ctx.fillRect(-k*0.2,-k*0.8,k*0.4,k*1.6);
        ctx.fillRect(-k*0.8,-k*0.2,k*1.6,k*0.4);
    }
    else if (kind==='card'||kind==='upgrade'||kind==='remove') {
        ctx.strokeRect(-k*0.6,-k*0.85,k*1.2,k*1.7);
        ctx.beginPath();
        if (kind==='card') {
            ctx.moveTo(0,-k*0.4);
            ctx.lineTo(0,k*0.4);
            ctx.moveTo(-k*0.35,0);
            ctx.lineTo(k*0.35,0);
        }
        else if (kind==='upgrade') {
            ctx.moveTo(0,k*0.45);
            ctx.lineTo(0,-k*0.45);
            ctx.moveTo(-k*0.3,-k*0.15);
            ctx.lineTo(0,-k*0.45);
            ctx.lineTo(k*0.3,-k*0.15);
        }
        else {
            ctx.moveTo(-k*0.35,-k*0.35);
            ctx.lineTo(k*0.35,k*0.35);
            ctx.moveTo(k*0.35,-k*0.35);
            ctx.lineTo(-k*0.35,k*0.35);
        }
        ctx.stroke();
    }
    else if (kind==='flag') {
        ctx.moveTo(-k*0.6,k);
        ctx.lineTo(-k*0.6,-k);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-k*0.6,-k);
        ctx.lineTo(k*0.8,-k*0.55);
        ctx.lineTo(-k*0.6,-k*0.1);
        ctx.closePath();
        ctx.fill();
    }
    else if (kind==='leave') {
        ctx.moveTo(-k,0);
        ctx.lineTo(k,0);
        ctx.moveTo(k*0.4,-k*0.5);
        ctx.lineTo(k,0);
        ctx.lineTo(k*0.4,k*0.5);
        ctx.stroke();
    }
    else if (kind==='next') {
        ctx.moveTo(0,k);
        ctx.lineTo(0,-k);
        ctx.moveTo(-k*0.5,-k*0.4);
        ctx.lineTo(0,-k);
        ctx.lineTo(k*0.5,-k*0.4);
        ctx.stroke();
    }
    else if (kind==='challenge') {
        ctx.arc(0,0,k*0.95,0,Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0,0,k*0.45,0,Math.PI*2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0,0,k*0.12,0,Math.PI*2);
        ctx.fill();
    }
    else if (kind==='treasure') {
        ctx.strokeRect(-k,-k*0.2,k*2,k*1.1);
        ctx.moveTo(-k,-k*0.2);
        ctx.quadraticCurveTo(0,-k*1.2,k,-k*0.2);
        ctx.stroke();
        ctx.fillRect(-k*0.15,-k*0.05,k*0.3,k*0.45);
    }
    else if (kind==='boss') {
        ctx.arc(0,-k*0.15,k*0.85,Math.PI*0.85,Math.PI*2.15);
        ctx.lineTo(k*0.5,k*0.9);
        ctx.lineTo(-k*0.5,k*0.9);
        ctx.closePath();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(-k*0.35,-k*0.15,k*0.2,0,Math.PI*2);
        ctx.arc(k*0.35,-k*0.15,k*0.2,0,Math.PI*2);
        ctx.fill();
    }
    else if (kind==='book') {
        ctx.strokeRect(-k*0.8,-k*0.9,k*1.6,k*1.8);
        ctx.moveTo(-k*0.45,-k*0.9);
        ctx.lineTo(-k*0.45,k*0.9);
        ctx.stroke();
    }
    else {
        ctx.font='bold '+Math.round(r*1.1)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('?',0,2);
    }
    ctx.restore();
}

export class ChoicePanel extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.spec=null;
        this.onPick=null;
        this.picked=-1;
        this.pickT=0;
        this.cards=[];
        this.hx=-1;
        this.hy=-1;
    }

    open2(spec,onPick) {
        this.spec=spec;
        this.onPick=onPick;
        this.picked=-1;
        this.pickT=0;
        this.show();
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
    }

    keys(o) {
        const s=this.spec;
        if (s.kind==='swap') {
            return ['weapon.'+o.id+'.name','weapon.'+o.id+'.short'];
        }
        const base=s.kind==='event'?'event.'+s.id+'.'+o.id:s.kind+'.'+o.id;
        return [base,base+'.desc'];
    }

    title() {
        const s=this.spec;
        return t(s.kind==='event'?'event.'+s.id+'.title':s.kind+'.title');
    }

    body() {
        const s=this.spec;
        return t(s.kind==='event'?'event.'+s.id+'.body':s.kind+'.body',s);
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const C=TUNING.choiceUi;
        const n=this.spec.options.length;
        const pw=Math.min(C.maxW,w-32,fitW(h));
        const gap=C.gap;
        const cw=Math.min(C.cardMaxW,(pw-48-gap*(n-1))/n);
        const cx0=w/2-(cw*n+gap*(n-1))/2;
        const ch=Math.min(C.cardH,h-C.head-60);
        const ph=ch+C.head+30;
        const px=w/2-pw/2;
        const py=h/2-ph/2;
        this.P={x:px,y:py,w:pw,h:ph};
        this.cards=[];
        for (let i=0;i<n;i++) {
            this.cards.push({x:cx0+i*(cw+gap),y:py+C.head,w:cw,h:ch});
        }
    }

    down(x,y) {
        if (!this.open||this.picked>=0) {
            return this.open;
        }
        this.layout();
        for (let i=0;i<this.cards.length;i++) {
            if (inRect(this.cards[i],x,y)&&!this.spec.options[i].disabled) {
                this.picked=i;
                this.pickT=0;
                if (this.actions.select) {
                    this.actions.select();
                }
                return true;
            }
        }
        return true;
    }

    update(dt) {
        super.update(dt);
        if (this.picked>=0&&this.open) {
            this.pickT+=dt;
            if (this.pickT>=TUNING.choiceUi.pickTime) {
                const i=this.picked;
                const cb=this.onPick;
                this.hide();
                cb(i);
            }
        }
    }

    draw(ctx) {
        if (!this.shown()||!this.spec) {
            return;
        }
        this.layout();
        const v=time.boilIndex;
        const P=this.P;
        const C=TUNING.choiceUi;
        const w=this.width;
        const h=this.height;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.35));
        ctx.save();
        ctx.fillStyle=rgba('ink',Math.min(0.25,this.t));
        ctx.fillRect(0,0,w,h);
        ctx.globalAlpha=Math.min(1,this.t*4);
        ctx.translate(w/2,h/2);
        ctx.rotate(C.tilt);
        ctx.scale(0.9+0.1*a,0.9+0.1*a);
        ctx.translate(-w/2,-h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        ctx.strokeStyle=rgba('farGray',0.9);
        ctx.lineWidth=1;
        for (let y=P.y+C.rule;y<P.y+P.h-6;y+=C.rule) {
            ctx.beginPath();
            ctx.moveTo(P.x+4,y);
            ctx.lineTo(P.x+P.w-4,y);
            ctx.stroke();
        }
        ctx.strokeStyle=rgba('red',0.45);
        ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(P.x+C.margin,P.y+2);
        ctx.lineTo(P.x+C.margin,P.y+P.h-2);
        ctx.stroke();
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.4,seed:2210}),PALETTE.ink,v);
        for (const [tx,rot] of [[P.x+P.w*0.18,-0.12],[P.x+P.w*0.82,0.1]]) {
            ctx.save();
            ctx.translate(tx,P.y);
            ctx.rotate(rot);
            ctx.fillStyle=rgba('farGray',0.85);
            ctx.fillRect(-C.tapeW/2,-10,C.tapeW,20);
            ctx.restore();
        }
        const kind=this.spec.kind==='event'?'event':this.spec.kind;
        const ix=P.x+C.margin+C.iconR+14;
        const iy=P.y+C.titleY;
        drawChoiceIcon(ctx,CHOICE_ICONS[kind]||'event',ix,iy,C.iconR,v,false);
        ctx.fillStyle=PALETTE.ink;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        fitText(ctx,this.title(),ix+C.iconR+14,iy,P.w-(ix-P.x)-C.iconR-40,C.titleSize,'bold ');
        ctx.font=C.bodySize+'px '+FONT;
        const bx=P.x+C.margin+14;
        const bw=P.w-C.margin-40;
        const bl=wrapText(ctx,this.body(),bw-28).slice(0,C.bodyLines);
        const by=iy+C.iconR+12;
        const bh=bl.length*C.bodyLine+18;
        ctx.fillStyle=rgba('paper',0.96);
        ctx.fillRect(bx,by,bw,bh);
        drawShape(ctx,sketchRect(bx,by,bw,bh,{width:1.6,seed:2215}),PALETTE.ink,v);
        ctx.beginPath();
        ctx.moveTo(ix-6,by+1);
        ctx.lineTo(ix+2,by-12);
        ctx.lineTo(ix+10,by+1);
        ctx.closePath();
        ctx.fillStyle=PALETTE.paper;
        ctx.fill();
        ctx.strokeStyle=PALETTE.ink;
        ctx.lineWidth=1.6;
        ctx.beginPath();
        ctx.moveTo(ix-6,by);
        ctx.lineTo(ix+2,by-12);
        ctx.lineTo(ix+10,by);
        ctx.stroke();
        ctx.fillStyle=PALETTE.nearGray;
        for (let i=0;i<bl.length;i++) {
            ctx.fillText(bl[i],bx+14,by+9+C.bodyLine/2+i*C.bodyLine);
        }
        for (let i=0;i<this.cards.length;i++) {
            const o=this.spec.options[i];
            const r=this.cards[i];
            const ap=EASE.easeOutBack(Math.max(0,Math.min(1,(this.t-0.1-i*0.08)/0.3)));
            if (ap<=0) {
                continue;
            }
            const hv=!o.disabled&&this.picked<0&&inRect(r,this.hx,this.hy);
            const sel=this.picked===i;
            const fade=this.picked>=0&&!sel?Math.max(0.25,1-this.pickT*4):1;
            const red=o.id==='elite'||o.id==='finish';
            const [lk,dk]=this.keys(o);
            ctx.save();
            ctx.globalAlpha*=(o.disabled?0.4:1)*fade;
            ctx.translate(r.x+r.w/2,r.y+r.h/2+(1-ap)*30-(hv?6:0));
            const s=ap*(sel?1+Math.sin(Math.min(1,this.pickT/C.pickTime)*Math.PI)*0.08:(hv?1.04:1));
            ctx.scale(s,s);
            ctx.rotate(hv?0:(i%2===0?-1:1)*C.cardTilt);
            ctx.translate(-r.w/2,-r.h/2);
            ctx.fillStyle=rgba('ink',0.12);
            ctx.fillRect(4,5,r.w,r.h);
            ctx.fillStyle=sel?rgba('red',0.12):(hv?PALETTE.farGray:PALETTE.paper);
            ctx.fillRect(0,0,r.w,r.h);
            drawShape(ctx,sketchRect(0,0,r.w,r.h,{width:hv||sel?2.6:1.8,seed:2220+i}),red||sel?PALETTE.red:PALETTE.ink,v);
            ctx.fillStyle=PALETTE.red;
            ctx.beginPath();
            ctx.arc(r.w/2,8,6,0,Math.PI*2);
            ctx.fill();
            if (this.spec.kind==='swap') {
                drawWeaponIcon(ctx,o.id,r.w/2,C.iconY,C.cardIconR/55,v,false);
            }
            else {
                drawChoiceIcon(ctx,CHOICE_ICONS[o.id]||'event',r.w/2,C.iconY,C.cardIconR,v,red);
            }
            ctx.fillStyle=red?PALETTE.red:PALETTE.ink;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            fitText(ctx,t(lk,o),r.w/2,C.iconY+C.cardIconR+24,r.w-C.textPad*2,C.labelSize,'bold ');
            ctx.font=C.descSize+'px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.textBaseline='top';
            const dl=t(dk,o).split('\n').flatMap(q=>wrapText(ctx,q,r.w-C.textPad*2));
            for (let k=0;k<dl.length&&k<C.descMax;k++) {
                ctx.fillText(dl[k],r.w/2,C.iconY+C.cardIconR+44+k*C.descLine);
            }
            if (o.disabled) {
                ctx.fillStyle=PALETTE.red;
                ctx.font='bold 14px '+FONT;
                ctx.fillText(t(o.reason?'choice.'+o.reason:'choice.disabled'),r.w/2,r.h-24);
            }
            ctx.restore();
        }
        ctx.restore();
    }
}

export class DeckPicker extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.mode='upgrade';
        this.list=[];
        this.onPick=null;
        this.sel=-1;
        this.slots=[];
        this.hx=-1;
        this.hy=-1;
    }

    open2(mode,list,onPick) {
        this.mode=mode;
        this.list=list.map((c,i)=>({i,card:createCard(c.id,c.upgraded),ok:mode!=='upgrade'||!c.upgraded}));
        const ult=q=>q.card.def.rarity==='rare'?1:0;
        this.list.sort((a,b)=>ult(a)-ult(b)||(a.card.id<b.card.id?-1:(a.card.id>b.card.id?1:0)));
        this.onPick=onPick;
        this.sel=-1;
        this.show();
    }

    hover(x,y) {
        this.hx=x;
        this.hy=y;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const D=TUNING.deckPick;
        const pw=Math.min(D.maxW,w-24);
        let sc=D.scale;
        let cw=CARD_W*sc;
        let ch=CARD_H*sc;
        let cols=Math.max(1,Math.floor((pw-40+D.gap)/(cw+D.gap)));
        let rows=Math.ceil(this.list.length/cols);
        while (sc>D.minScale&&rows*(CARD_H*sc+D.gap)+D.head+D.foot>h-16) {
            sc-=0.05;
            cw=CARD_W*sc;
            ch=CARD_H*sc;
            cols=Math.max(1,Math.floor((pw-40+D.gap)/(cw+D.gap)));
            rows=Math.ceil(this.list.length/cols);
        }
        const gh=rows*(ch+D.gap);
        const ph=Math.min(h-16,gh+D.head+D.foot);
        const px=w/2-pw/2;
        const py=h/2-ph/2;
        this.P={x:px,y:py,w:pw,h:ph};
        const x0=w/2-(Math.min(cols,this.list.length)*(cw+D.gap)-D.gap)/2;
        this.slots=this.list.map((q,k)=>({x:x0+(k%cols)*(cw+D.gap),y:py+D.head+Math.floor(k/cols)*(ch+D.gap),w:cw,h:ch}));
        const bw=Math.min(220,pw-40);
        this.okBtn={x:w/2-bw/2,y:py+ph-D.btnH-14,w:bw,h:D.btnH};
        this.gridEnd=py+D.head+gh;
        this.sc=sc;
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (this.sel>=0&&inRect(this.okBtn,x,y)) {
            const idx=this.list[this.sel].i;
            const cb=this.onPick;
            this.hide();
            if (this.actions.confirm) {
                this.actions.confirm(this.mode);
            }
            cb(idx);
            return true;
        }
        for (let k=0;k<this.slots.length;k++) {
            if (inRect(this.slots[k],x,y)&&this.list[k].ok) {
                this.sel=k;
                if (this.actions.select) {
                    this.actions.select();
                }
                return true;
            }
        }
        return true;
    }

    draw(ctx,art) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const v=time.boilIndex;
        const P=this.P;
        const w=this.width;
        const h=this.height;
        const D=TUNING.deckPick;
        ctx.save();
        ctx.fillStyle=rgba('paper',Math.min(0.75,this.t*3));
        ctx.fillRect(0,0,w,h);
        ctx.globalAlpha=Math.min(1,this.t*4);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:2240}),this.mode==='remove'?PALETTE.red:PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 24px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('pick.'+this.mode+'.title'),w/2,P.y+30);
        ctx.font='13px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText(t('pick.'+this.mode+'.hint'),w/2,P.y+56);
        for (let k=0;k<this.slots.length;k++) {
            const q=this.list[k];
            const r=this.slots[k];
            const ap=EASE.easeOutBack(Math.max(0,Math.min(1,(this.t-0.05-k*0.02)/0.3)));
            if (ap<=0) {
                continue;
            }
            const hv=q.ok&&inRect(r,this.hx,this.hy);
            const sel=this.sel===k;
            ctx.save();
            ctx.globalAlpha*=q.ok?1:0.35;
            ctx.translate(r.x+r.w/2,r.y+r.h/2-(sel?8:(hv?4:0)));
            ctx.scale(ap*this.sc*(sel?1.08:1),ap*this.sc*(sel?1.08:1));
            ctx.translate(-CARD_W/2,-CARD_H/2);
            ctx.drawImage(art.face(q.card,v),0,0,CARD_W,CARD_H);
            drawCost(ctx,q.card,false,v);
            if (q.card.def.rarity==='rare') {
                drawShape(ctx,sketchRect(-3,-3,CARD_W+6,CARD_H+6,{width:3,seed:2250+k}),PALETTE.red,v);
                ctx.fillStyle=PALETTE.red;
                ctx.fillRect(CARD_W/2-24,-14,48,18);
                ctx.fillStyle=PALETTE.paper;
                ctx.font='bold 12px '+FONT;
                ctx.textAlign='center';
                ctx.textBaseline='middle';
                ctx.fillText(t('type.ult'),CARD_W/2,-5);
            }
            if (sel) {
                ctx.strokeStyle=this.mode==='remove'?PALETTE.red:PALETTE.ink;
                ctx.lineWidth=5;
                ctx.strokeRect(-5,-5,CARD_W+10,CARD_H+10);
            }
            ctx.restore();
        }
        if (this.sel>=0) {
            const q=this.list[this.sel];
            const shown=this.mode==='upgrade'?createCard(q.card.id,true):q.card;
            ctx.font='13px '+FONT;
            ctx.fillStyle=this.mode==='remove'?PALETTE.red:PALETTE.ink;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            const line=(this.mode==='upgrade'?t('pick.upgrade.preview'):'')+cardName(shown)+t('ui.colon')+cardDesc(shown);
            ctx.font='14px '+FONT;
            const lines=wrapText(ctx,line,Math.min(P.w-60,720)).slice(0,D.maxLines);
            const top=this.gridEnd+(this.okBtn.y-this.gridEnd-lines.length*D.lineH)/2;
            const lw=Math.min(P.w-30,Math.max(...lines.map(q=>ctx.measureText(q).width))+30);
            ctx.fillStyle=rgba('paper',0.95);
            ctx.fillRect(w/2-lw/2,top-8,lw,lines.length*D.lineH+16);
            drawShape(ctx,sketchRect(w/2-lw/2,top-8,lw,lines.length*D.lineH+16,{width:1.2,seed:2260}),this.mode==='remove'?PALETTE.red:PALETTE.midGray,v);
            ctx.fillStyle=this.mode==='remove'?PALETTE.red:PALETTE.ink;
            lines.forEach((q,i)=>ctx.fillText(q,w/2,top+D.lineH*(i+0.5)));
            drawButton(ctx,this.okBtn,t('pick.'+this.mode+'.ok'),v,1,inRect(this.okBtn,this.hx,this.hy),17,this.mode==='remove');
        }
        else {
            ctx.font='13px '+FONT;
            ctx.fillStyle=PALETTE.midGray;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('pick.choose'),w/2,this.okBtn.y+D.btnH/2);
        }
        ctx.restore();
    }
}

export class LangPicker extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.pick=null;
        this.pickT=0;
    }

    show() {
        super.show();
        this.pick=null;
        this.pickT=0;
    }

    layout() {
        const L=TUNING.langPick;
        const w=this.width;
        const h=this.height;
        const bw=Math.min(L.btnW,(w-60)/2);
        const cy=h*L.y;
        this.opts=LANGS.map((k,i)=>({k,x:w/2+(i===0?-bw-L.gap/2:L.gap/2),y:cy,w:bw,h:L.btnH}));
        this.go={x:w/2-L.goW/2,y:cy+L.btnH+L.goGap,w:L.goW,h:L.goH};
        this.buttons=this.opts.concat(this.pick?[this.go]:[]);
    }

    update(dt) {
        super.update(dt);
        if (this.pick) {
            this.pickT+=dt;
        }
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        const o=this.opts.find(q=>inRect(q,x,y));
        if (o) {
            if (this.pick!==o.k) {
                this.pick=o.k;
                this.pickT=0;
                this.actions.choose(o.k);
            }
            return true;
        }
        if (this.pick&&inRect(this.go,x,y)) {
            this.actions.done(this.pick);
        }
        return true;
    }

    confirm() {
        if (this.open&&this.pick) {
            this.actions.done(this.pick);
        }
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const a=Math.min(1,this.t*3);
        ctx.save();
        ctx.globalAlpha*=a;
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 30px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('game.title'),w/2,h*0.18);
        ctx.font='bold 20px '+FONT;
        ctx.fillText(t('langPick.title'),w/2,h*0.3);
        this.opts.forEach((o,i)=>{
            const on=this.pick===o.k;
            const e=EASE.easeOutBack(Math.min(1,(this.t-0.1-i*0.08)/0.35));
            if (e<=0) {
                return;
            }
            ctx.save();
            ctx.translate(o.x+o.w/2,o.y+o.h/2);
            ctx.scale(e*(on?1.06:1),e*(on?1.06:1));
            ctx.fillStyle=on?PALETTE.ink:(this.hoverIdx===i?rgba('farGray',0.95):rgba('paper',0.95));
            ctx.fillRect(-o.w/2,-o.h/2,o.w,o.h);
            drawShape(ctx,sketchRect(-o.w/2,-o.h/2,o.w,o.h,{width:on?3:2,seed:1600+i}),on?PALETTE.red:PALETTE.ink,v);
            ctx.fillStyle=on?PALETTE.paper:PALETTE.ink;
            ctx.font='bold 24px '+FONT;
            ctx.fillText(t('lang.'+o.k),0,1);
            ctx.restore();
        });
        if (this.pick) {
            const q=EASE.easeOutCubic(Math.min(1,this.pickT/0.3));
            ctx.globalAlpha*=q;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='16px '+FONT;
            ctx.fillText(t('langPick.note'),w/2,this.opts[0].y+this.opts[0].h+TUNING.langPick.noteGap);
            drawButton(ctx,this.go,t('langPick.go'),v,q*1.2,this.hoverIdx===this.opts.length,20);
        }
        ctx.restore();
    }
}
