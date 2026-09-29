import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';
import {sketchRect,sketchLine,sketchCircle,drawShape} from './sketch.js';
import {settings,STICK_DEFAULTS} from '../core/settings.js';
import {CARDS,ALL_CARDS,UNLOCKS,unlockLevel} from '../data/cards.js';
import {progress,xpToNext,hasSeen} from '../core/progress.js';
import {createCard,cardDesc,cardName,cardCost} from '../game/card.js';
import {ENEMIES} from '../data/enemies.js';
import {ENDLESS} from '../data/levels.js';
import {fmtInk} from './hud.js';
import {CARD_ANIMS,ENEMY_ATTACKS,drawStage} from './codexAnim.js';
import {CARD_W,CARD_H,drawCost,wrapText} from './cardView.js';
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

export class MainMenu extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=1.3;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const bw=240;
        const bh=50;
        this.buttons=[];
        for (let i=0;i<4;i++) {
            this.buttons.push({x:w/2-bw/2,y:h*0.46+i*(bh+12),w:bw,h:bh});
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
            this.actions.endless();
        }
        else if (i===2) {
            this.actions.settings();
        }
        else if (i===3) {
            this.actions.codex();
        }
        return true;
    }

    drawLevel(ctx,v) {
        const w=this.width;
        const pw=260;
        const ph=140;
        const x=w-pw-24;
        const y=24;
        const a=Math.max(0,Math.min(1,(this.t-0.6)/0.4));
        ctx.save();
        ctx.globalAlpha=a;
        ctx.fillStyle=rgba('paper',0.9);
        ctx.fillRect(x,y,pw,ph);
        drawShape(ctx,sketchRect(x,y,pw,ph,{width:1.8,seed:1360}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 20px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='top';
        ctx.fillText(t('menu.level',{level:progress.level}),x+14,y+12);
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
        const labels=[t('menu.start'),t('menu.endless'),t('menu.settings'),t('menu.codex')];
        for (let i=0;i<4;i++) {
            drawButton(ctx,this.buttons[i],labels[i],v,(this.t-0.35-i*0.1)/0.45,this.hoverIdx===i,22);
        }
        this.drawLevel(ctx,v);
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
        const labels=[t('pause.resume'),t('pause.deck'),t('menu.codex'),t('menu.settings'),t('pause.quit')];
        for (let i=0;i<5;i++) {
            drawButton(ctx,this.buttons[i],labels[i],v,(this.t-0.08-i*0.07)/0.35,this.hoverIdx===i);
        }
    }
}

const SETTING_KEYS=['volume','quality','shake','assist','reduced','fps','stickSize','stickX','stickY'];

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
        return settings.showFps?1:0;
    }

    show() {
        super.show();
        for (const k of SETTING_KEYS) {
            this.anim[k]=this.target(k);
            this.pulse[k]=0;
        }
    }

    update(dt) {
        super.update(dt);
        const k=1-Math.exp(-TUNING.settingsUi.follow*dt);
        this.resetFlash=Math.max(0,(this.resetFlash||0)-dt*2);
        for (const key in this.anim) {
            this.anim[key]+=(this.target(key)-this.anim[key])*k;
            this.pulse[key]=Math.max(0,this.pulse[key]-dt*TUNING.settingsUi.pulseDecay);
        }
    }

    bump(key) {
        this.pulse[key]=1;
        this.actions.changed();
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
        this.back={x:w/2+10,y:top+per*rh+4,w:180,h:48};
        this.resetBtn={x:w/2-200,y:top+per*rh+4,w:190,h:48};
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
        this.hx=x;
        this.hy=y;
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
        if (this.info&&this.t>0.35) {
            this.drawInfo(ctx,this.info,v);
        }
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

const FOE_LIST=['doodle','blob','sprayer','bird','compass','eraserMonster'];

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
            const locked=need>progress.level;
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
            ctx.font='13px '+FONT;
            ctx.fillStyle=PALETTE.nearGray;
            const meta=locked?t('codex.locked',{level:need}):(c.def.rarity==='rare'?t('type.ult'):t('type.'+c.def.type))+' · '+t('tooltip.cost',{cost:cardCost(c)})+' · '+t('codex.unlockAt',{level:need});
            ctx.fillText(meta,tx,28);
            if (!locked) {
                ctx.fillStyle=PALETTE.ink;
                ctx.font='14px '+FONT;
                ctx.globalAlpha*=flipList?0.4+0.6*flip:1;
                const lines=wrapText(ctx,c.def.rarity==='rare'?cardDesc(c)+'　'+t('codex.rareMerge'):cardDesc(c),tw);
                for (let k=0;k<lines.length&&k<4;k++) {
                    ctx.fillText(lines[k],tx,50+k*19);
                }
                ctx.fillStyle=hv?PALETTE.red:PALETTE.midGray;
                ctx.font='12px '+FONT;
                ctx.fillText(t('codex.clickCard'),tx,CARD_H*sc-16);
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
            const lines=wrapText(ctx,seen?t('codex.'+id):t('codex.unseen'),tw);
            for (let k=0;k<lines.length&&k<3;k++) {
                ctx.fillText(lines[k],tx,y+32+k*18);
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
        const sc=Math.min(1.55,(P.h-330)/CARD_H);
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
        y+=36;
        ctx.font='14px '+FONT;
        ctx.fillStyle=PALETTE.nearGray;
        ctx.fillText((rare?t('type.ult'):t('type.'+card.def.type))+' · '+t('tooltip.cost',{cost:cardCost(card)})+' · '+t('codex.unlockAt',{level:unlockLevel(card.id)}),lx,y);
        y+=26;
        ctx.save();
        ctx.globalAlpha*=0.4+0.6*flip;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='15px '+FONT;
        for (const line of wrapText(ctx,cardDesc(card),lw-10)) {
            ctx.fillText(line,lx,y);
            y+=21;
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
        ctx.fillStyle=Math.abs(ta-1)<0.5?PALETTE.red:PALETTE.ink;
        ctx.fillRect(hxp+t0.w*(1-stretch)/2,t0.y,t0.w*stretch,t0.h);
        for (let i=0;i<4;i++) {
            const b=this.tabs[i];
            ctx.save();
            ctx.translate(b.x,b.y);
            drawShape(ctx,sketchRect(0,0,b.w,b.h,{width:1.8,seed:1500+i}),i===1?PALETTE.red:PALETTE.ink,v);
            ctx.restore();
            ctx.fillStyle=Math.abs(ta-i)<0.5?PALETTE.paper:(i===1?PALETTE.red:PALETTE.ink);
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
        ctx.fillText(t('summary.menu'),m.x+m.w/2,m.y+bh/2+1);
        ctx.globalAlpha=1;
    }
}
