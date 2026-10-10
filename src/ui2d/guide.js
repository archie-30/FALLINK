import {PALETTE,rgba} from '../data/palette.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';
import {sketchRect,drawShape} from './sketch.js';
import {FONT,inRect,drawButton,Panel} from './uiKit.js';
import {wrapText} from './cardView.js';
import {COURSES} from '../data/courses.js';
import {drawCourseIcon} from './courseIcons.js';

function lines(prefix,n,params) {
    const out=[];
    for (let i=1;i<=n;i++) {
        out.push({kind:'bullet',text:t(prefix+'.'+i,params)});
    }
    return out;
}

export function courseParams(id) {
    const C=TUNING.courses[id];
    return {off:Math.round((1-(C.off||1))*100),goal:C.goal,speed:Math.round(((C.speed||1)-1)*100),foe:Math.round(((C.foe||1)-1)*100),time:C.time,every:C.every,max:C.max,hp:Math.round((C.hp||1)*100),dash:Math.round((1-(C.dashCd||1))*100),life:C.life};
}

export function rewardLines(id) {
    const R=TUNING.courses[id].reward;
    const out=[];
    if (R.score) {
        out.push({kind:'bullet',text:t('course.rw.score',{n:R.score})});
    }
    if (R.hp) {
        out.push({kind:'bullet',text:t('course.rw.hp',{n:R.hp})});
    }
    if (R.ink) {
        out.push({kind:'bullet',text:t('course.rw.ink')});
    }
    if (R.dots) {
        out.push({kind:'bullet',text:t('course.rw.dots',{n:R.dots})});
    }
    return out;
}

export function courseGuide(id) {
    const D=COURSES[id];
    const p=courseParams(id);
    return {title:t('course.'+id+'.name'),icon:id,blocks:[
        {kind:'text',text:t('course.'+id+'.intro',p)},
        {kind:'head',text:t('course.head.fx')},
        ...lines('course.'+id+'.fx',D.fx,p),
        {kind:'head',text:t('course.head.ch')},
        ...lines('course.'+id+'.ch',D.ch,p),
        {kind:'head',text:t('course.head.rw')},
        ...rewardLines(id)
    ]};
}

export function modeGuide(mode) {
    const n={story:4,endless:5}[mode];
    return {title:t('modeinfo.'+mode+'.title'),icon:null,blocks:[
        {kind:'text',text:t('modeinfo.'+mode+'.intro')},
        {kind:'head',text:t('modeinfo.head')},
        ...lines('modeinfo.'+mode+'.pt',n,{})
    ]};
}

export function relicGuide() {
    return {title:t('tut.relics.title'),icon:null,blocks:t('tut.relics.body').split('|').map(text=>({kind:'bullet',text}))};
}

export function coinGuide() {
    const M=TUNING.meta;
    const G=M.gradeCoins;
    const P={b:G.B,a:G.A,s:G.S,sp:G['S+'],lo:M.dotRange[0],hi:M.dotRange[1],lv:TUNING.levels.chest.dots,every:TUNING.levels.chestEvery};
    return {title:t('coins.title'),icon:null,blocks:[1,2,3,4].map(i=>({kind:'bullet',text:t('coins.src.'+i,P)}))};
}

export function modesGuide() {
    const out=[];
    for (const mode of ['story','endless']) {
        const g=modeGuide(mode);
        out.push({kind:'title',text:g.title},...g.blocks.filter(b=>b.kind!=='head'));
    }
    return {title:t('settings.modes'),icon:null,blocks:out};
}

export class GuidePopup extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.3;
        this.model=null;
        this.scroll=0;
        this.contentH=0;
        this.press=null;
        this.opts={};
    }

    open2(model,opts={}) {
        this.model=model;
        this.opts=opts;
        this.scroll=0;
        this.contentH=0;
        this.press=null;
        this.noteText='';
        this.noteAt=-9;
        this.show();
    }

    note(text) {
        this.noteText=text;
        this.noteAt=time.real;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const pw=Math.min(620,w-40);
        const bh=small?40:48;
        let ph=Math.min(h-(small?78:130),560);
        if (this.opts.fit&&this.contentH>0) {
            ph=Math.min(ph,(small?58:76)+this.contentH+bh+(small?30:44)+(this.opts.keep?TUNING.ui.guideNote:0));
        }
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const two=!!this.opts.cancel;
        const gap=12;
        const bw=two?(pw-48-gap)/2:Math.min(220,pw-48);
        const by=this.P.y+ph-bh-(small?10:16);
        if (two) {
            this.cancelBtn={x:this.P.x+24,y:by,w:bw,h:bh};
            this.okBtn={x:this.P.x+24+bw+gap,y:by,w:bw,h:bh};
            this.buttons=[this.cancelBtn,this.okBtn];
        }
        else {
            this.cancelBtn=null;
            this.okBtn={x:w/2-bw/2,y:by,w:bw,h:bh};
            this.buttons=[this.okBtn];
        }
        const top=this.P.y+(small?58:76);
        this.V={x:this.P.x+14,y:top,w:pw-28,h:by-8-top-(this.opts.keep?TUNING.ui.guideNote:0)};
    }

    maxScroll() {
        return Math.max(0,this.contentH-this.V.h);
    }

    wheel(dy) {
        if (this.open) {
            this.scroll=Math.max(0,Math.min(this.maxScroll(),this.scroll+dy));
        }
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (inRect(this.okBtn,x,y)) {
            this.actions.ok();
            return true;
        }
        if (this.cancelBtn&&inRect(this.cancelBtn,x,y)) {
            this.actions.cancel();
            return true;
        }
        if (inRect(this.V,x,y)) {
            this.press={y0:y,s0:this.scroll,moved:false};
        }
        else if (!inRect(this.P,x,y)&&this.cancelBtn) {
            this.actions.cancel();
        }
        return true;
    }

    move(x,y) {
        const p=this.press;
        if (!p) {
            return;
        }
        if (Math.abs(y-p.y0)>6) {
            p.moved=true;
        }
        if (p.moved) {
            this.scroll=Math.max(0,Math.min(this.maxScroll(),p.s0-(y-p.y0)));
        }
    }

    up() {
        this.press=null;
    }

    drawBody(ctx,small) {
        const V=this.V;
        const fs=small?17:19;
        const lh=Math.round(fs*1.42);
        let y=0;
        ctx.textBaseline='top';
        ctx.textAlign='left';
        for (const b of this.model.blocks) {
            if (b.kind==='head'||b.kind==='title') {
                y+=y>0?(small?10:14):0;
                ctx.fillStyle=PALETTE.red;
                ctx.fillRect(V.x+2,V.y+y-this.scroll+4,7,fs+2);
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold '+(fs+3)+'px '+FONT;
                ctx.fillText(b.text,V.x+18,V.y+y-this.scroll);
                y+=lh+4;
            }
            else if (b.kind==='bullet') {
                ctx.font=fs+'px '+FONT;
                const ls=wrapText(ctx,b.text,V.w-40);
                ctx.fillStyle=PALETTE.ink;
                ctx.beginPath();
                ctx.arc(V.x+22,V.y+y-this.scroll+lh/2,3.5,0,Math.PI*2);
                ctx.fill();
                ctx.fillStyle=PALETTE.nearGray;
                for (const l of ls) {
                    ctx.fillText(l,V.x+38,V.y+y-this.scroll);
                    y+=lh;
                }
                y+=5;
            }
            else {
                ctx.font=fs+'px '+FONT;
                ctx.fillStyle=PALETTE.nearGray;
                for (const l of wrapText(ctx,b.text,V.w-8)) {
                    ctx.fillText(l,V.x+4,V.y+y-this.scroll);
                    y+=lh;
                }
                y+=6;
            }
        }
        this.contentH=y+6;
    }

    draw(ctx) {
        if (!this.shown()||!this.model) {
            return;
        }
        this.layout();
        const w=this.width;
        const h=this.height;
        const v=time.boilIndex;
        const P=this.P;
        const small=h<600;
        const a=EASE.easeOutBack(Math.min(1,this.t/0.4));
        this.scroll=Math.max(0,Math.min(this.maxScroll(),this.scroll));
        ctx.save();
        ctx.fillStyle=rgba('ink',Math.min(0.4,this.t*1.6));
        ctx.fillRect(0,0,w,h);
        ctx.translate(w/2,h/2);
        ctx.scale(a,a);
        ctx.translate(-w/2,-h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(P.x,P.y,P.w,6);
        drawShape(ctx,sketchRect(P.x,P.y,P.w,P.h,{width:2.2,seed:4301}),PALETTE.ink,v);
        const ir=small?19:24;
        let tx=P.x+24;
        if (this.model.icon) {
            drawCourseIcon(ctx,this.model.icon,P.x+24+ir,P.y+(small?32:42),ir,v,true);
            tx=P.x+24+ir*2+12;
        }
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?24:28)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(this.model.title,tx,P.y+(small?32:42));
        ctx.save();
        ctx.beginPath();
        ctx.rect(this.V.x,this.V.y,this.V.w,this.V.h);
        ctx.clip();
        this.drawBody(ctx,small);
        ctx.restore();
        const ms=this.maxScroll();
        if (ms>0) {
            const V=this.V;
            const bh=Math.max(24,V.h*V.h/this.contentH);
            const by=V.y+(V.h-bh)*(this.scroll/ms);
            ctx.fillStyle=rgba('ink',0.35);
            ctx.fillRect(V.x+V.w-4,by,3,bh);
            if (this.scroll<ms-2) {
                ctx.fillStyle=PALETTE.red;
                ctx.font='bold 12px '+FONT;
                ctx.textAlign='center';
                ctx.textBaseline='bottom';
                ctx.fillText('▼',V.x+V.w/2,V.y+V.h);
            }
        }
        ctx.restore();
        const ap=(this.t-0.15)/0.3;
        if (this.cancelBtn) {
            drawButton(ctx,this.cancelBtn,this.opts.cancel,v,ap,this.hoverIdx===0,small?17:19);
        }
        drawButton(ctx,this.okBtn,this.opts.ok||t('notice.ok'),v,ap,this.hoverIdx===(this.cancelBtn?1:0),small?17:19);
        const nk=time.real-this.noteAt;
        if (this.noteText&&nk<TUNING.ui.guideNoteTime) {
            const pop=1+Math.max(0,1-nk/0.18)*0.25;
            ctx.save();
            ctx.globalAlpha=Math.min(1,(TUNING.ui.guideNoteTime-nk)/0.4);
            ctx.translate(w/2,this.okBtn.y-TUNING.ui.guideNote/2-4);
            ctx.scale(pop,pop);
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold '+(small?14:15)+'px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(this.noteText,0,0);
            ctx.restore();
        }
    }
}
