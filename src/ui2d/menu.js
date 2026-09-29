import {PALETTE,rgba,SKIN_TONES,ACCENTS} from '../data/palette.js';
import {SKIN_PARTS,SKIN_PRESETS,DEFAULT_SKIN} from '../data/skins.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';
import {sketchRect,sketchLine,sketchCircle,drawShape} from './sketch.js';
import {settings,STICK_DEFAULTS,device} from '../core/settings.js';
import {CARDS,ALL_CARDS,UNLOCKS,unlockLevel,STARTING_DECK,unlockedCards} from '../data/cards.js';
import {progress,xpToNext,hasSeen,effectiveLevel,godMode,trainable} from '../core/progress.js';
import {createCard,cardDesc,cardName,cardCost} from '../game/card.js';
import {ENEMIES} from '../data/enemies.js';
import {ENDLESS,TRAINING_MAPS} from '../data/levels.js';
import {fmtInk,DESKTOP_KEYS,TOUCH_KEYS} from './hud.js';
import {CARD_ANIMS,ENEMY_ATTACKS,drawStage} from './codexAnim.js';
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

const MENU_ACTS=['start','endless','training','skin','settings','codex'];

const MAX_LEVEL=Math.max(...Object.keys(UNLOCKS).map(Number));

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
        this.buttons=[];
        const bw=Math.min(small?220:260,cw);
        const top=small?h*0.3:h*0.3;
        const avail=(small?h-top-14:h-top-190);
        const bh=Math.min(small?40:52,avail/MENU_ACTS.length-(small?6:10));
        for (let i=0;i<MENU_ACTS.length;i++) {
            this.buttons.push({x:cx-bw/2,y:top+i*(bh+(small?6:10)),w:bw,h:bh});
        }
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
        if (this.levelRect&&inRect(this.levelRect,x,y)) {
            this.actions.levels();
            return true;
        }
        const i=this.hitButton(x,y);
        if (i>=0) {
            this.actions[MENU_ACTS[i]]();
        }
        return true;
    }

    drawLevel(ctx,v) {
        const h=this.height;
        const small=h<600;
        const pw=260;
        const ph=140;
        const {cx}=this.column();
        const sc=small?0.72:1;
        const x=small?16:cx-pw/2;
        const y=small?14:h-ph-26;
        this.levelRect={x,y,w:pw*sc,h:ph*sc};
        const a=Math.max(0,Math.min(1,(this.t-0.6)/0.4));
        ctx.save();
        ctx.globalAlpha=a;
        ctx.translate(x,y);
        ctx.scale(sc,sc);
        ctx.translate(-x,-y);
        ctx.fillStyle=this.levelHover?rgba('farGray',0.95):rgba('paper',0.9);
        ctx.fillRect(x,y,pw,ph);
        drawShape(ctx,sketchRect(x,y,pw,ph,{width:this.levelHover?2.6:1.8,seed:1360}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 20px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(t('menu.level',{level:progress.level}),x+14,y+12);
        if (godMode()) {
            const lw=ctx.measureText(t('menu.level',{level:progress.level})).width;
            ctx.save();
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold 13px '+FONT;
            ctx.fillText(t('menu.god'),x+24+lw,y+17);
            ctx.restore();
        }
        const need=xpToNext(progress.level);
        const f=Math.min(1,progress.xp/need);
        ctx.fillStyle=rgba('farGray',0.8);
        ctx.fillRect(x+14,y+42,pw-28,10);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(x+14,y+42,(pw-28)*f,10);
        drawShape(ctx,sketchRect(x+14,y+42,pw-28,10,{width:1.2,seed:1361}),PALETTE.ink,v);
        ctx.font='12px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.textAlign='right';
        ctx.fillText(t('menu.xp',{xp:progress.xp,next:need}),x+pw-14,y+14);
        ctx.textAlign='left';
        const nextCards=UNLOCKS[progress.level+1];
        const lines=wrapText(ctx,nextCards?t('menu.nextUnlock',{cards:nextCards.map(id=>t(CARDS[id].nameKey)).join('、')}):t('menu.allUnlocked'),pw-28);
        for (let i=0;i<lines.length&&i<2;i++) {
            ctx.fillText(lines[i],x+14,y+60+i*16);
        }
        ctx.fillStyle=PALETTE.ink;
        ctx.fillText(t('menu.bestStory',{score:progress.bestStory||0}),x+14,y+ph-38);
        ctx.fillText(t('menu.best',{score:progress.bestScore||0}),x+14,y+ph-20);
        ctx.textAlign='right';
        ctx.fillStyle=this.levelHover?PALETTE.red:PALETTE.midGray;
        ctx.fillText(t('menu.levelMore'),x+pw-14,y+ph-20);
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
        const edge=[];
        for (let i=0;i<=16;i++) {
            edge.push([px0+10+Math.sin(i*1.7)*4,i*h/16]);
        }
        ctx.strokeStyle=rgba('ink',0.55);
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(edge[0][0],edge[0][1]);
        for (const q of edge) {
            ctx.lineTo(q[0],q[1]);
        }
        ctx.stroke();
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
        ctx.fillText('INKFALL',0,-8);
        const tw=ctx.measureText('INKFALL').width;
        drawShape(ctx,sketchLine(-tw/2,40,-tw/2+tw*Math.min(1,this.t/1.0),40,{width:3.2,seed:1301}),PALETTE.ink,v);
        drawShape(ctx,sketchLine(tw/2-40,40,tw/2-40+40*Math.min(1,Math.max(0,this.t-0.9)/0.3),40,{width:3.2,seed:1302}),PALETTE.red,v);
        ctx.font='18px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText(t('menu.subtitle'),0,64);
        ctx.restore();
        for (let i=0;i<MENU_ACTS.length;i++) {
            drawButton(ctx,this.buttons[i],t('menu.'+MENU_ACTS[i]),v,(this.t-0.35-i*0.08)/0.45,this.hoverIdx===i,this.buttons[i].h<46?19:22);
        }
        this.drawLevel(ctx,v);
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
        for (let i=0;i<5;i++) {
            this.buttons.push({x:w/2-bw/2,y:h*0.34+i*(bh+12),w:bw,h:bh});
        }
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
        ctx.save();
        ctx.translate(w/2,h*0.24);
        ctx.scale(a,a);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 44px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('pause.title'),0,0);
        ctx.restore();
        const labels=[t('pause.resume'),t(this.training?'pause.pickCard':'pause.deck'),t('menu.codex'),t('menu.settings'),t(this.training?'pause.leaveTraining':'pause.quit')];
        for (let i=0;i<5;i++) {
            drawButton(ctx,this.buttons[i],labels[i],v,(this.t-0.08-i*0.07)/0.35,this.hoverIdx===i);
        }
    }
}

const SETTING_KEYS=['volume','quality','shake','assist','reduced','full','fps','god','stickSize','stickX','stickY'];

const SLIDERS={volume:'volume',shake:'shake',stickSize:'stickSize',stickX:'stickX',stickY:'stickY'};

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
    }

    target(key) {
        if (SLIDERS[key]) {
            return settings[SLIDERS[key]];
        }
        if (key==='quality') {
            return ['low','mid','high'].indexOf(settings.quality);
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
        if (key==='full') {
            return settings.fullscreen?1:0;
        }
        return settings.showFps?1:0;
    }

    closeKeys() {
        if (!this.keysOpen) {
            return false;
        }
        this.keysOpen=false;
        return true;
    }

    show() {
        super.show();
        this.keysOpen=false;
        this.keysT=0;
        for (const k of SETTING_KEYS) {
            this.anim[k]=this.target(k);
            this.pulse[k]=0;
        }
    }

    update(dt) {
        super.update(dt);
        this.keysT=Math.max(0,Math.min(1,(this.keysT||0)+(this.keysOpen?dt:-dt)/TUNING.ui.closeTime));
        const k=1-Math.exp(-TUNING.settingsUi.follow*dt);
        this.resetFlash=Math.max(0,(this.resetFlash||0)-dt*2);
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
        const w=this.width;
        const h=this.height;
        const keys=SETTING_KEYS;
        const avail=h-190;
        const cols=keys.length*58>avail&&w>=760?2:1;
        const per=Math.ceil(keys.length/cols);
        const rh=Math.max(40,Math.min(60,avail/per));
        const colW=Math.min(560,(w-40)/cols);
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
        const bw=Math.min(180,(pw-60)/3);
        this.keysBtn={x:w/2-bw*1.5-14,y:by,w:bw,h:48};
        this.resetBtn={x:w/2-bw/2,y:by,w:bw,h:48};
        this.back={x:w/2+bw/2+14,y:by,w:bw,h:48};
        this.buttons=[this.back,this.resetBtn,this.keysBtn];
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
        this.hx=x;
        this.hy=y;
        if (this.keysOpen) {
            this.keysOpen=false;
            if (this.actions.select) {
                this.actions.select();
            }
            return true;
        }
        if (inRect(this.keysBtn,x,y)) {
            this.keysOpen=true;
            if (this.actions.select) {
                this.actions.select();
            }
            return true;
        }
        if (inRect(this.back,x,y)) {
            this.actions.back();
            return true;
        }
        if (inRect(this.resetBtn,x,y)) {
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
            if (SLIDERS[r.key]) {
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
                    this.bump(r.key);
                }
            }
            else if (x>=r.cx&&x<=r.cx+70) {
                if (r.key==='reduced') {
                    settings.reducedMotion=!settings.reducedMotion;
                }
                else if (r.key==='assist') {
                    settings.aimAssist=!settings.aimAssist;
                }
                else if (r.key==='god') {
                    settings.godMode=!settings.godMode;
                }
                else if (r.key==='full') {
                    settings.fullscreen=!settings.fullscreen;
                }
                else {
                    settings.showFps=!settings.showFps;
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
        this.info=null;
        for (let i=0;i<this.rows.length;i++) {
            const r=this.rows[i];
            const an=this.anim[r.key]??this.target(r.key);
            const pu=this.pulse[r.key]||0;
            ctx.font='18px '+FONT;
            ctx.textAlign='left';
            ctx.fillStyle=PALETTE.ink;
            const label=t('settings.'+r.key);
            ctx.fillText(label,r.lx,r.y);
            const ix=r.lx+ctx.measureText(label).width+16;
            const over=Math.hypot((this.hx??-99)-ix,(this.hy??-99)-r.y)<13;
            this.drawInfoIcon(ctx,ix,r.y,over,v);
            if (over) {
                this.info={key:r.key,x:ix,y:r.y};
            }
            if (SLIDERS[r.key]) {
                const val=Math.max(0,Math.min(1,an));
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
                ctx.fillStyle=PALETTE.nearGray;
                ctx.font=(pu>0.3?'bold ':'')+'14px '+FONT;
                ctx.textAlign='left';
                ctx.fillText(Math.round(this.target(r.key)*100)+'%',r.cx+r.cw+16,r.y);
            }
            else if (r.key==='quality') {
                const seg=r.cw/3;
                const qs=['low','mid','high'];
                const cur=this.target(r.key);
                const sq=1+pu*0.08;
                ctx.save();
                ctx.translate(r.cx+an*seg+seg/2,r.y);
                ctx.scale(sq,sq);
                ctx.fillStyle=PALETTE.ink;
                ctx.fillRect(-seg/2+4,-16,seg-8,32);
                ctx.restore();
                for (let k=0;k<3;k++) {
                    const bx=r.cx+k*seg;
                    drawShape(ctx,sketchRect(bx+4,r.y-16,seg-8,32,{width:1.6,seed:1440+k}),PALETTE.ink,v);
                    const cover=Math.max(0,1-Math.abs(an-k));
                    ctx.fillStyle=cover>0.5?PALETTE.paper:PALETTE.ink;
                    ctx.font=(k===cur?'bold ':'')+'16px '+FONT;
                    ctx.textAlign='center';
                    ctx.fillText(t('quality.'+qs[k]),bx+seg/2,r.y+1);
                }
            }
            else {
                const on=this.target(r.key)>0.5;
                const f=Math.max(0,Math.min(1,an));
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
                ctx.fillStyle=PALETTE.nearGray;
                ctx.font=(pu>0.3?'bold ':'')+'14px '+FONT;
                ctx.textAlign='left';
                ctx.fillText(on?t('settings.on'):t('settings.off'),r.cx+80,r.y);
            }
        }
        ctx.restore();
        drawButton(ctx,this.back,t('menu.back'),v,(this.t-0.1)/0.3,inRect(this.back,this.hx??-1,this.hy??-1));
        drawButton(ctx,this.resetBtn,t('settings.resetSticks'),v,(this.t-0.15)/0.3,inRect(this.resetBtn,this.hx??-1,this.hy??-1)||this.resetFlash>0,16);
        drawButton(ctx,this.keysBtn,t('settings.keys'),v,(this.t-0.2)/0.3,inRect(this.keysBtn,this.hx??-1,this.hy??-1),16);
        if (this.info&&this.t>0.35&&!this.keysOpen) {
            this.drawInfo(ctx,this.info,v);
        }
        if (this.keysT>0) {
            this.drawKeys(ctx,v);
        }
    }

    drawKeys(ctx,v) {
        const w=this.width;
        const h=this.height;
        const k=EASE.easeOutCubic(this.keysT);
        const cols=w>=760?2:1;
        const pw=Math.min(cols===2?880:460,w-24);
        const rowH=h<600?21:26;
        const lists=cols===2?[[t('keys.desktop'),DESKTOP_KEYS],[t('keys.touch'),TOUCH_KEYS]]:[[device.mobile?t('keys.touch'):t('keys.desktop'),device.mobile?TOUCH_KEYS:DESKTOP_KEYS]];
        const rows=Math.max(...lists.map(q=>q[1].length));
        const ph=Math.min(h-20,rows*rowH+(h<600?96:124));
        const px=w/2-pw/2;
        const py=h/2-ph/2+(1-k)*30;
        ctx.save();
        ctx.globalAlpha=k;
        ctx.fillStyle=rgba('ink',0.25);
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(px,py,pw,ph);
        drawShape(ctx,sketchRect(px,py,pw,ph,{width:2.2,seed:1480}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(h<600?20:26)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('legend.title'),w/2,py+(h<600?22:34));
        const colW=pw/cols;
        for (let c=0;c<lists.length;c++) {
            const [title,list]=lists[c];
            const x0=px+c*colW+22;
            let y=py+(h<600?50:72);
            ctx.font='bold 15px '+FONT;
            ctx.textAlign='left';
            ctx.fillStyle=PALETTE.red;
            ctx.fillText(title,x0,y);
            y+=rowH;
            ctx.font=(h<600?'12px ':'13px ')+FONT;
            let keyW=0;
            for (const r of list) {
                keyW=Math.max(keyW,ctx.measureText(t(r[0])).width);
            }
            for (let i=0;i<list.length;i++) {
                const ry=y+i*rowH;
                const kw=ctx.measureText(t(list[i][0])).width+12;
                drawShape(ctx,sketchRect(x0,ry-rowH*0.38,kw,rowH*0.76,{width:1.2,seed:1490+i+c*40}),PALETTE.nearGray,v);
                ctx.fillStyle=PALETTE.ink;
                ctx.fillText(t(list[i][0]),x0+6,ry+1);
                ctx.fillStyle=PALETTE.nearGray;
                ctx.fillText(t(list[i][1]),x0+keyW+26,ry+1);
            }
        }
        ctx.fillStyle=PALETTE.midGray;
        ctx.font='12px '+FONT;
        ctx.textAlign='center';
        ctx.fillText(t('keys.close'),w/2,py+ph-14);
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

const FOE_LIST=['doodle','blob','sprayer','inkCloud','bird','compass','eraserMonster'];

const BOSS_LIST=['inkBottle','scissors','book'];

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
    }

    show() {
        super.show();
        this.scroll=0;
        this.scrollTo=0;
        this.drag=null;
        this.detail=null;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const tw=Math.min(130,(w-240)/4);
        this.tabs=[0,1,2,3].map(i=>({x:w/2-(tw*4+36)/2+i*(tw+12),y:70,w:tw,h:40}));
        this.back={x:w/2-90,y:h-66,w:180,h:48};
        this.view={x:0,y:126,w:w,h:Math.max(80,h-126-84)};
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

    drawBrief(ctx,card,x,y,w,v) {
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.font='14px '+FONT;
        ctx.fillStyle=PALETTE.ink;
        const lines=wrapText(ctx,cardBrief(card),w-6);
        let yy=y;
        for (let k=0;k<lines.length&&k<2;k++) {
            ctx.fillText(lines[k],x,yy);
            yy+=19;
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
        const cols=w>=900?2:1;
        const colW=Math.min(520,(w-40)/cols);
        const sc=TUNING.codex.cardScale;
        const rowH=CARD_H*sc+TUNING.codex.rowGap;
        const x0=w/2-colW*cols/2;
        this.contentH=Math.ceil(list.length/cols)*rowH+10;
        const flipList=list===this.lists[0];
        const flip=flipList?Math.abs(Math.cos(this.upAnim*Math.PI)):1;
        for (let i=0;i<list.length;i++) {
            const c=flipList&&this.upAnim>0.5?this.upList[i]:list[i];
            const cx=x0+(i%cols)*colW;
            const cy=V.y+10+Math.floor(i/cols)*rowH-this.scroll;
            if (cy>V.y+V.h||cy+rowH<V.y) {
                continue;
            }
            const p=this.appear(Math.floor(i/cols));
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
            ctx.font='bold 18px '+FONT;
            ctx.fillText(locked?'？？？':cardName(c),tx,4);
            if (!locked) {
                drawStarterTag(ctx,c.id,tx+ctx.measureText(cardName(c)).width+10,6,12,v);
            }
            ctx.font='13px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            const meta=locked?t('codex.locked',{level:need}):(c.def.rarity==='rare'?t('type.ult'):t('type.'+c.def.type))+' · '+t('codex.unlockAt',{level:need});
            ctx.fillText(meta,tx,28);
            if (!locked) {
                ctx.globalAlpha*=flipList?0.4+0.6*flip:1;
                this.drawBrief(ctx,c,tx,50,tw,v);
                ctx.fillStyle=hv?PALETTE.red:PALETTE.midGray;
                ctx.font='12px '+FONT;
                ctx.textAlign='right';
                ctx.fillText(t('codex.clickCard'),colW-16,8);
                ctx.textAlign='left';
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
            ctx.save();
            ctx.globalAlpha=p;
            if (hv) {
                ctx.fillStyle=rgba('farGray',0.35);
                ctx.fillRect(r.x,r.y,r.w,r.h);
            }
            ctx.fillStyle=seen?rgba('paper',0.9):PALETTE.nearGray;
            ctx.fillRect(x+8,y+4,86,86);
            ctx.save();
            ctx.translate(x+8,y+4);
            drawShape(ctx,sketchRect(0,0,86,86,{width:1.6,seed:1800+i}),boss?PALETTE.red:PALETTE.ink,v);
            ctx.restore();
            const el=boss?0:this.eliteAnim;
            ctx.save();
            ctx.translate(x+51,y+47);
            if (seen) {
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
            ctx.fillText(seen?(el>0.5?t('hud.elite')+' ':'')+t('enemy.'+id)+(boss?'　'+t('codex.boss'):''):'？？？',tx,y+6);
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
            const cut=full.indexOf('。');
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
            [t('codex.stat.first'),t(e>0.5?'codex.first.elite':'codex.first.'+id),e>0.5]
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

    drawEnemyDetail(ctx,v) {
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
        ctx.fillText(t('enemy.'+id)+(boss?'　'+t('codex.boss'):''),tx,y);
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
        for (let i=0;i<rows.length;i++) {
            const cx=tx+(i%2)*colW;
            const cy=sy+Math.floor(i/2)*26;
            ctx.font='14px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            ctx.fillText(rows[i][0],cx,cy);
            ctx.font='bold 15px '+FONT;
            ctx.fillStyle=rows[i][2]&&e>0.5?PALETTE.red:PALETTE.ink;
            ctx.fillText(rows[i][1],cx+92,cy);
        }
        y=Math.max(y+170,sy+Math.ceil(rows.length/2)*26+8);
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
        this.layout();
        this.clampScroll();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        ctx.fillStyle=rgba('paper',Math.min(0.97,this.t*4));
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 32px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(t('menu.codex'),w/2,36);
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
        if (this.maxScroll()>0) {
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
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        const b=this.button;
        if (this.t>(this.victory||this.quit?1.0:2.0)) {
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

    drawBody(ctx) {
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        ctx.fillStyle=this.victory?rgba('paper',Math.min(0.94,this.t*2)):rgba('paper',Math.min(0.75,this.t*0.8));
        ctx.fillRect(0,0,w,h);
        const title=this.victory?t('summary.victory'):(this.quit?t('summary.quit'):t('summary.dead'));
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
        drawShape(ctx,sketchLine(-tw/2,40,-tw/2+tw*Math.max(0,Math.min(1,(this.t-0.9)/0.5)),40,{width:3.4,seed:901}),this.victory||this.quit?PALETTE.ink:PALETTE.red,v);
        ctx.restore();
        const s=this.stats;
        const mm=Math.floor(s.time/60);
        const ss=Math.floor(s.time%60);
        const rows=s.mode==='endless'?[
            [t('summary.score'),String(s.score)],
            [t('summary.best'),String(s.best)+(s.newBest?'  '+t('summary.newBest'):'')],
            [t('summary.rooms'),String(s.rooms)],
            [t('summary.kills'),String(s.kills)],
            [t('summary.cards'),String(s.cards)],
            [t('summary.bosses'),String(s.bosses)],
            [t('summary.time'),mm+':'+(ss<10?'0':'')+ss]
        ]:[
            [t('summary.score'),String(s.score)],
            [t('summary.best'),String(s.best)+(s.newBest?'  '+t('summary.newBest'):'')],
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
        const d0=this.victory||this.quit?0.3:1.3;
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
            let line=pr.god?t('summary.god'):t('summary.xp',{xp:pr.xp});
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
        ctx.fillText(t('summary.menu'),m.x+m.w/2,m.y+bh/2+1);
        ctx.globalAlpha=1;
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
        this.backBtn={x:w/2-200,y:h-(h<600?54:68),w:180,h:bh};
        this.okBtn={x:w/2+20,y:h-(h<600?54:68),w:180,h:bh};
    }

    lists() {
        const ids=unlockedCards(effectiveLevel());
        return [ids.filter(id=>CARDS[id].rarity!=='rare'),ids.filter(id=>CARDS[id].rarity==='rare')];
    }

    scale() {
        return Math.max(0.5,Math.min(0.78,this.height/1150));
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

    down(x,y,type) {
        if (!this.open) {
            return false;
        }
        this.layout();
        this.touch=type!=='mouse';
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
        this.buttons=[this.backBtn,this.okBtn];
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
        this.scrollTo=Math.max(0,(effectiveLevel()-2)*TUNING.levelView.rowH);
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
        ctx.fillText(t('levels.current',{level:real,xp:progress.xp,next:need}),bx,by);
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
            const ids=UNLOCKS[n]||[];
            const tmpH=ids.length>0?R.rowH:48;
            const rowTop=y;
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
    }

    show() {
        super.show();
        this.dragYaw=0;
        this.drag=null;
    }

    move(x) {
        if (this.drag) {
            this.dragYaw=this.drag.y0+(x-this.drag.x0)*TUNING.ui.skinDrag;
        }
    }

    up() {
        this.drag=null;
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

    set(skin) {
        settings.skin={...skin};
        this.actions.changed(this.skin());
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
            this.set(DEFAULT_SKIN);
            this.actions.select();
            return true;
        }
        if (x>this.P.x+this.P.w) {
            this.drag={x0:x,y0:this.dragYaw};
            return true;
        }
        for (const q of this.hits) {
            if (inRect(q,x,y)) {
                if (q.preset) {
                    const {id,...rest}=q.preset;
                    this.set(rest);
                }
                else {
                    this.set({...this.skin(),[q.part]:q.value});
                }
                this.actions.select();
                return true;
            }
        }
        return true;
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
            ctx.fillStyle=sel?rgba('red',0.08):(hov?rgba('farGray',0.6):rgba('paper',0.9));
            ctx.fillRect(cx,cy,cw,ch);
            drawShape(ctx,sketchRect(cx,cy,cw,ch,{width:sel?2.4:1.3,seed:1510+i}),sel?PALETTE.red:PALETTE.ink,v);
            drawSkinFigure(ctx,cx+cw/2,cy+ch*0.44,small?0.6:0.85,pr,v,1520+i*3);
            ctx.fillStyle=sel?PALETTE.red:PALETTE.ink;
            ctx.font=(sel?'bold ':'')+'12px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='bottom';
            ctx.fillText(t('skin.preset.'+pr.id),cx+cw/2,cy+ch-3);
            ctx.textAlign='left';
            ctx.textBaseline='top';
            this.hits.push({x:cx,y:cy,w:cw,h:ch,preset:pr});
        }
        y+=Math.ceil(SKIN_PRESETS.length/cols)*(ch+8)+(small?4:10);
        const r=small?9:13;
        const lw=small?136:0;
        for (const part of SKIN_PARTS) {
            ctx.font='bold '+(small?13:14)+'px '+FONT;
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(t(part.label),P.x+18,small?y+r-7:y);
            if (!small) {
                y+=24;
            }
            const list=part.tones||part.accents;
            const per=Math.max(1,Math.floor((P.w-36-lw)/(r*2+(small?10:12))));
            for (let i=0;i<list.length;i++) {
                const key=list[i];
                const sx=P.x+18+lw+r+(i%per)*(r*2+(small?10:12));
                const sy=y+r+Math.floor(i/per)*(r*2+(small?6:10));
                const tones=part.tones?SKIN_TONES[key]:[ACCENTS[key]];
                drawTone(ctx,sx,sy,r,tones,cur[part.key]===key,v,1540+i+part.key.length*13);
                this.hits.push({x:sx-r-4,y:sy-r-4,w:r*2+8,h:r*2+8,part:part.key,value:key});
            }
            y+=Math.ceil(list.length/per)*(r*2+(small?6:10))+(small?4:10);
        }
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
        drawButton(ctx,this.resetBtn,t('skin.reset'),v,(this.t-0.1)/0.3,this.hoverIdx===0,16);
        drawButton(ctx,this.backBtn,t('menu.back'),v,(this.t-0.15)/0.3,this.hoverIdx===1,18);
        ctx.restore();
    }
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
    }

    show() {
        super.show();
        this.pendingRoom=false;
        this.pulse={};
        this.pop={};
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
        const c=settings.training;
        for (const key of ['props','attack','respawn','immortal','ammo','random']) {
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
        const hv=this.fxBegin(ctx,key,r);
        ctx.fillStyle=PALETTE.paper;
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
        const rh=small?(ph-110)/8:52;
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
        this.rowLabel(ctx,t('trainMenu.map'),lx,y);
        const maps=TRAINING_MAPS;
        const mi=Math.max(0,maps.indexOf(c.map));
        const mp=this.pop.map||0;
        ctx.save();
        ctx.translate(cx+cw/2,y);
        ctx.scale(1+mp*0.25,1+mp*0.25);
        ctx.fillStyle=mp>0.1?PALETTE.red:PALETTE.ink;
        ctx.font='bold 14px '+FONT;
        ctx.textAlign='center';
        ctx.fillText(t('map.'+maps[mi]),0,0);
        ctx.restore();
        for (const [dx,dir,ch] of [[0,-1,'‹'],[cw-28,1,'›']]) {
            const r={x:cx+dx,y:y-14,w:28,h:28};
            this.smallBtn(ctx,'map'+dir,r,ch,true,v,1610+dir);
            add(r,()=>{
                c.map=maps[(mi+dir+maps.length)%maps.length];
                this.change('room');
            },'map'+dir,'map');
        }
        ctx.restore();
        y+=rh;
        const toggles=[['props','room'],['attack','attack'],['respawn','foes'],['immortal','immortal'],['ammo','ammo']];
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
            const act=()=>{
                c.refill=modes[i];
                this.change('refill');
            };
            add({x:cx+i*cw/2,y:y-14,w:cw/2,h:28},act,'refill');
        }
        ctx.restore();
        y+=rh;
        rowStart();
        this.rowLabel(ctx,t('trainMenu.bosses'),lx,y);
        const bosses=c.bosses||(c.bosses={});
        const bw=Math.min(64,cw/3-6);
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
        const btns=[['trainMenu.leave','leave'],['trainMenu.pick','pick'],['trainMenu.reset','reset'],['menu.settings','settings'],['trainMenu.resume','resume']];
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
            drawButton(ctx,r,t(btns[i][0]),v,(this.t-0.2-i*0.05)/0.3,inRect(r,this.hx,this.hy),small?14:16);
            ctx.restore();
            add(r,()=>this.actions[btns[i][1]](),key);
        }
        ctx.restore();
    }
}
