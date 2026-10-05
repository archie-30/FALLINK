import {PALETTE,rgba,SKIN_TONES,ACCENTS} from '../data/palette.js';
import {SKIN_PARTS,DEFAULT_SKIN} from '../data/skins.js';
import {ACC_SLOTS} from '../data/cosmetics.js';
import {ACHIEVEMENTS} from '../data/achievements.js';
import {t} from '../data/strings.js';
import {time} from '../core/loop.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';
import {sketchRect,sketchCircle,drawShape} from './sketch.js';
import {progress} from '../core/progress.js';
import {dots,price,statValue,chestsReady,bundlePrice} from '../core/meta.js';
import {FONT,inRect,drawButton,fitText,Panel} from './uiKit.js';
import {drawChoiceIcon} from './menu.js';
import {wrapText} from './cardView.js';

const clamp01=x=>Math.max(0,Math.min(1,x));

function tones(skin,k) {
    return SKIN_TONES[skin[k]]||SKIN_TONES[DEFAULT_SKIN[k]];
}

function poly(ctx,pts,fill,stroke=PALETTE.ink,lw=1) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0],pts[0][1]);
    for (let i=1;i<pts.length;i++) {
        ctx.lineTo(pts[i][0],pts[i][1]);
    }
    ctx.closePath();
    if (fill) {
        ctx.fillStyle=fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle=stroke;
        ctx.lineWidth=lw;
        ctx.stroke();
    }
}

function oval(ctx,x,y,rx,ry,rot,fill,stroke=PALETTE.ink,lw=1) {
    ctx.beginPath();
    ctx.ellipse(x,y,Math.max(0.1,rx),Math.max(0.1,ry),rot,0,Math.PI*2);
    if (fill) {
        ctx.fillStyle=fill;
        ctx.fill();
    }
    if (stroke) {
        ctx.strokeStyle=stroke;
        ctx.lineWidth=lw;
        ctx.stroke();
    }
}

function box(ctx,x,y,w,h,fill,stroke=PALETTE.ink,lw=1) {
    ctx.fillStyle=fill;
    ctx.fillRect(x,y,w,h);
    if (stroke) {
        ctx.strokeStyle=stroke;
        ctx.lineWidth=lw;
        ctx.strokeRect(x,y,w,h);
    }
}

export function drawInkDot(ctx,x,y,r,color=PALETTE.ink,shine=true) {
    ctx.save();
    ctx.translate(x,y);
    ctx.fillStyle=color;
    ctx.beginPath();
    ctx.moveTo(0,-r*1.5);
    ctx.quadraticCurveTo(r*1.05,-r*0.2,r*0.95,r*0.25);
    ctx.arc(0,r*0.25,r*0.95,0,Math.PI);
    ctx.quadraticCurveTo(-r*1.05,-r*0.2,0,-r*1.5);
    ctx.fill();
    if (shine) {
        ctx.fillStyle=rgba('paper',0.8);
        ctx.beginPath();
        ctx.ellipse(-r*0.35,r*0.05,r*0.18,r*0.32,-0.4,0,Math.PI*2);
        ctx.fill();
    }
    ctx.restore();
}

export function drawWallet(ctx,x,y,v,align='right',size=15,pulse=0,n=dots()) {
    ctx.save();
    ctx.font='bold '+size+'px '+FONT;
    const label=String(n);
    const tw=ctx.measureText(label).width;
    const h=size+14;
    const w=tw+size*1.6+22;
    const x0=align==='right'?x-w:(align==='center'?x-w/2:x);
    const k=1+Math.sin(clamp01(pulse)*Math.PI)*0.25;
    ctx.translate(x0+w/2,y+h/2);
    ctx.scale(k,k);
    ctx.translate(-w/2,-h/2);
    ctx.fillStyle=pulse>0?rgba('red',0.12*pulse):rgba('paper',0.94);
    ctx.fillRect(0,0,w,h);
    drawShape(ctx,sketchRect(0,0,Math.round(w),Math.round(h),{width:1.5,seed:3101}),PALETTE.ink,v);
    drawInkDot(ctx,10+size*0.45,h/2+1,size*0.42);
    ctx.fillStyle=PALETTE.ink;
    ctx.textAlign='left';
    ctx.textBaseline='middle';
    ctx.fillText(label,16+size*0.9,h/2+1);
    ctx.restore();
    return {x:x0,y,w,h};
}

export function drawLock(ctx,x,y,s,color=PALETTE.ink) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    ctx.strokeStyle=color;
    ctx.lineWidth=2;
    ctx.beginPath();
    ctx.arc(0,-3,4,Math.PI,0);
    ctx.lineTo(4,0);
    ctx.moveTo(-4,0);
    ctx.lineTo(-4,-3);
    ctx.stroke();
    ctx.fillStyle=color;
    ctx.fillRect(-6,-1,12,9);
    ctx.fillStyle=PALETTE.paper;
    ctx.fillRect(-1,2,2,3);
    ctx.restore();
}

function drawBust(ctx,skin) {
    const face=tones(skin,'face');
    const coat=tones(skin,'coat');
    ctx.globalAlpha*=0.35;
    ctx.fillStyle=coat[1];
    ctx.fillRect(-12,-8,24,14);
    ctx.fillStyle=face[0];
    ctx.beginPath();
    ctx.arc(0,-20,11,0,Math.PI*2);
    ctx.fill();
    ctx.strokeStyle=PALETTE.ink;
    ctx.lineWidth=1;
    ctx.stroke();
    ctx.fillStyle=PALETTE.ink;
    ctx.fillRect(-5,-22,2.4,5);
    ctx.fillRect(2.6,-22,2.4,5);
    ctx.globalAlpha/=0.35;
}

const ACC_DRAW={
    headwear:{
        drop(ctx,s) {
            const h=tones(s,'hat');
            box(ctx,-8,-31,16,3,h[1],null);
            poly(ctx,[[-5,-30],[5,-30],[1,-40]],h[2],null);
            oval(ctx,1,-40,1.6,1.6,0,PALETTE.ink,null);
        },
        beret(ctx,s) {
            const h=tones(s,'hat');
            oval(ctx,-1,-30,12.5,4.6,-0.15,h[1]);
            ctx.strokeStyle=h[2];
            ctx.lineWidth=1.4;
            ctx.beginPath();
            ctx.ellipse(-1,-29,10,2.2,-0.15,0.2,Math.PI-0.2);
            ctx.stroke();
            box(ctx,-1,-37,2,3.2,h[2],null);
        },
        crown(ctx,s) {
            const g=tones(s,'gear');
            poly(ctx,[[-9,-30],[-9,-39],[-5,-34.5],[0,-41],[5,-34.5],[9,-39],[9,-30]],g[1]);
            box(ctx,-9,-32,18,2,g[2],null);
            oval(ctx,0,-35.5,1.4,1.4,0,PALETTE.ink,null);
        },
        propeller(ctx,s) {
            const h=tones(s,'hat');
            const g=tones(s,'gear');
            ctx.fillStyle=h[1];
            ctx.beginPath();
            ctx.arc(0,-27.5,10.5,Math.PI,Math.PI*2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1;
            ctx.stroke();
            box(ctx,-0.7,-42,1.4,5,PALETTE.ink,null);
            const sp=Math.cos(time.real*12);
            oval(ctx,0,-42,9*Math.abs(sp)+1,1.5,0,g[1],PALETTE.ink,0.8);
            oval(ctx,0,-42,1.5,1.5,0,PALETTE.ink,null);
        },
        headphones(ctx,s) {
            const g=tones(s,'gear');
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=2.2;
            ctx.beginPath();
            ctx.arc(0,-20,13,Math.PI*1.05,Math.PI*1.95);
            ctx.stroke();
            box(ctx,-15.5,-25,5,10,g[1]);
            box(ctx,10.5,-25,5,10,g[1]);
        },
        catEars(ctx,s) {
            const h=tones(s,'hat');
            const f=tones(s,'face');
            for (const sx of [-1,1]) {
                poly(ctx,[[sx*10.5,-25],[sx*9,-37],[sx*2.5,-30]],h[1]);
                poly(ctx,[[sx*8.5,-27.5],[sx*8.2,-33.5],[sx*4.5,-30]],f[1],null);
            }
        },
        paperBoat(ctx) {
            poly(ctx,[[-14,-28],[14,-28],[0,-43]],PALETTE.paper);
            box(ctx,-14,-30,28,3,PALETTE.ink,null);
            ctx.strokeStyle=rgba('ink',0.5);
            ctx.lineWidth=0.8;
            ctx.beginPath();
            ctx.moveTo(0,-43);
            ctx.lineTo(0,-31);
            ctx.stroke();
        }
    },
    eyewear:{
        glasses(ctx) {
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.4;
            for (const sx of [-1,1]) {
                ctx.beginPath();
                ctx.arc(sx*3.8,-19.5,4,0,Math.PI*2);
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(-0.6,-20.5);
            ctx.lineTo(0.6,-20.5);
            ctx.moveTo(-7.8,-20.5);
            ctx.lineTo(-10.5,-21.5);
            ctx.moveTo(7.8,-20.5);
            ctx.lineTo(10.5,-21.5);
            ctx.stroke();
        },
        monocle(ctx) {
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.5;
            ctx.beginPath();
            ctx.arc(3.8,-19.5,4.6,0,Math.PI*2);
            ctx.stroke();
            ctx.setLineDash([1.5,1.5]);
            ctx.lineWidth=1;
            ctx.beginPath();
            ctx.moveTo(8,-17);
            ctx.quadraticCurveTo(11,-12,10,-7);
            ctx.stroke();
            ctx.setLineDash([]);
        },
        eyepatch(ctx) {
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.2;
            ctx.beginPath();
            ctx.moveTo(-10.8,-25);
            ctx.lineTo(10.8,-15);
            ctx.stroke();
            oval(ctx,-3.8,-19.5,4.2,4.4,0,PALETTE.ink,null);
        },
        mustache(ctx,s) {
            const l=tones(s,'limbs');
            oval(ctx,-3.2,-13.8,4,1.7,0.3,l[2],null);
            oval(ctx,3.2,-13.8,4,1.7,-0.3,l[2],null);
        },
        bandage(ctx) {
            for (const r of [-0.6,0.6]) {
                ctx.save();
                ctx.translate(-6.5,-14.5);
                ctx.rotate(r);
                box(ctx,-4,-1.3,8,2.6,PALETTE.paper,PALETTE.ink,0.7);
                ctx.restore();
            }
        }
    },
    neckwear:{
        scarf(ctx,s) {
            const h=tones(s,'hat');
            box(ctx,-10,-11,20,5,h[1],null);
            poly(ctx,[[4,-7],[9,-7],[10,1],[6,1]],h[2],null);
        },
        bowtie(ctx,s) {
            const h=tones(s,'hat');
            poly(ctx,[[0,-8.5],[-7.5,-12],[-7.5,-5]],h[1]);
            poly(ctx,[[0,-8.5],[7.5,-12],[7.5,-5]],h[1]);
            oval(ctx,0,-8.5,1.8,1.8,0,h[2]);
        },
        tie(ctx,s) {
            const h=tones(s,'hat');
            box(ctx,-2.2,-10.5,4.4,3,h[2],PALETTE.ink,0.8);
            poly(ctx,[[-2,-7.5],[2,-7.5],[3,6],[0,9],[-3,6]],h[1]);
        },
        bell(ctx,s) {
            const h=tones(s,'hat');
            const g=tones(s,'gear');
            box(ctx,-10,-10.5,20,2.6,h[1],null);
            oval(ctx,0,-5.5,3.2,3.2,0,g[1]);
            box(ctx,-2,-4.6,4,0.8,PALETTE.ink,null);
        },
        beads(ctx,s) {
            const h=tones(s,'hat');
            for (let i=0;i<7;i++) {
                const f=i/6;
                oval(ctx,-9+f*18,-10+Math.sin(f*Math.PI)*5,1.8,1.8,0,i%3===0?PALETTE.ink:h[1],PALETTE.ink,0.6);
            }
        },
        ruff(ctx) {
            for (let i=0;i<6;i++) {
                oval(ctx,-10+i*4,-9,3.4,2.4,0,PALETTE.paper,PALETTE.ink,0.7);
            }
        }
    },
    backwear:{
        pouch(ctx,s) {
            const g=tones(s,'gear');
            box(ctx,12,-1,3.5,9,g[1],PALETTE.ink,0.8);
        },
        cape(ctx,s) {
            const h=tones(s,'hat');
            const sw=Math.sin(time.real*3)*1.2;
            poly(ctx,[[-11,-9],[11,-9],[16+sw,22],[-16+sw,22]],h[1]);
        },
        wings(ctx) {
            const f=Math.sin(time.real*4)*0.12;
            for (const sx of [-1,1]) {
                ctx.save();
                ctx.translate(sx*10,-3);
                ctx.rotate(sx*f);
                poly(ctx,[[0,0],[sx*16,-10],[sx*12,4]],PALETTE.paper);
                ctx.restore();
            }
        },
        backpack(ctx,s) {
            const g=tones(s,'gear');
            box(ctx,-15.5,-5,4,14,g[1],PALETTE.ink,0.8);
            box(ctx,11.5,-5,4,14,g[1],PALETTE.ink,0.8);
        },
        quiver(ctx,s) {
            const g=tones(s,'gear');
            const h=tones(s,'hat');
            ctx.save();
            ctx.translate(-12,-12);
            ctx.rotate(-0.45);
            box(ctx,-2,-5,3,4,PALETTE.paper,PALETTE.ink,0.6);
            box(ctx,1.5,-6,3,5,h[1],PALETTE.ink,0.6);
            box(ctx,-3,-2,8,10,g[1],PALETTE.ink,0.8);
            ctx.restore();
        },
        scroll(ctx,s) {
            const g=tones(s,'gear');
            ctx.save();
            ctx.translate(0,-4);
            ctx.rotate(-0.22);
            box(ctx,-18,-2.5,36,5,PALETTE.paper,PALETTE.ink,0.8);
            box(ctx,-20,-3.2,2.5,6.4,g[1],PALETTE.ink,0.6);
            box(ctx,17.5,-3.2,2.5,6.4,g[1],PALETTE.ink,0.6);
            ctx.restore();
        }
    }
};

const BACK_ICON={
    pouch(ctx,s) {
        const g=tones(s,'gear');
        const h=tones(s,'hat');
        box(ctx,-9,-9,18,20,g[1]);
        box(ctx,-10,-11,20,6,h[1]);
    },
    cape(ctx,s) {
        const h=tones(s,'hat');
        const sw=Math.sin(time.real*3)*1.5;
        poly(ctx,[[-8,-13],[8,-13],[14+sw,14],[-14+sw,14]],h[1]);
        box(ctx,-9,-15,18,3,PALETTE.ink,null);
    },
    wings(ctx) {
        const f=Math.sin(time.real*4)*0.15;
        for (const sx of [-1,1]) {
            ctx.save();
            ctx.translate(sx*2,0);
            ctx.rotate(sx*f);
            poly(ctx,[[0,0],[sx*17,-11],[sx*13,6]],PALETTE.paper);
            ctx.restore();
        }
    },
    backpack(ctx,s) {
        const g=tones(s,'gear');
        const h=tones(s,'hat');
        box(ctx,-11,-11,22,24,g[1]);
        box(ctx,-12,-13,24,7,h[1]);
        box(ctx,-6,3,12,7,h[1],PALETTE.ink,0.8);
    },
    quiver(ctx,s) {
        const g=tones(s,'gear');
        const h=tones(s,'hat');
        ctx.save();
        ctx.rotate(0.4);
        box(ctx,-4,-16,3,8,PALETTE.paper,PALETTE.ink,0.7);
        box(ctx,-0.5,-18,3,10,h[1],PALETTE.ink,0.7);
        box(ctx,3,-15,3,7,PALETTE.paper,PALETTE.ink,0.7);
        box(ctx,-6,-9,13,24,g[1]);
        ctx.restore();
    },
    scroll(ctx,s) {
        const g=tones(s,'gear');
        const h=tones(s,'hat');
        ctx.save();
        ctx.rotate(-0.25);
        box(ctx,-15,-4,30,8,PALETTE.paper);
        box(ctx,-17,-5,3,10,g[1]);
        box(ctx,14,-5,3,10,g[1]);
        box(ctx,-2,-4.5,4,9,h[1],null);
        ctx.restore();
    }
};

const ICON_AT={headwear:[0,-29],eyewear:[0,-19],neckwear:[0,-6],backwear:[0,0]};

export function drawAcc(ctx,slot,id,skin) {
    const f=ACC_DRAW[slot]&&ACC_DRAW[slot][id];
    if (f) {
        f(ctx,skin);
    }
}

export function drawAccIcon(ctx,slot,id,x,y,s,skin,dim=false) {
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(s,s);
    if (dim) {
        ctx.globalAlpha*=0.45;
    }
    if (id==='none') {
        ctx.strokeStyle=PALETTE.midGray;
        ctx.lineWidth=2;
        ctx.beginPath();
        ctx.arc(0,0,9,0,Math.PI*2);
        ctx.moveTo(-6.4,6.4);
        ctx.lineTo(6.4,-6.4);
        ctx.stroke();
        ctx.restore();
        return;
    }
    if (slot==='backwear') {
        BACK_ICON[id](ctx,skin);
        ctx.restore();
        return;
    }
    const [ax,ay]=ICON_AT[slot];
    ctx.translate(-ax,-ay);
    drawBust(ctx,skin);
    drawAcc(ctx,slot,id,skin);
    ctx.restore();
}

export function itemName(item) {
    if (item.kind==='dots') {
        return t('meta.dots',{n:item.n});
    }
    if (item.kind==='color') {
        return t('tone.'+item.value);
    }
    if (item.kind==='weapon') {
        return t('weapon.'+item.value+'.name');
    }
    return t('acc.'+item.value);
}

export function itemPart(item) {
    if (item.kind==='color') {
        return t(SKIN_PARTS.find(q=>q.key===item.part).label);
    }
    if (item.kind==='acc') {
        return t(ACC_SLOTS.find(q=>q.key===item.part).label);
    }
    return '';
}

export function drawItemIcon(ctx,item,x,y,r,v,skin) {
    if (item.kind==='dots') {
        drawInkDot(ctx,x,y+r*0.1,r*0.55);
        return;
    }
    if (item.kind==='color') {
        const tn=item.part==='accent'?[ACCENTS[item.value]]:SKIN_TONES[item.value];
        ctx.save();
        ctx.beginPath();
        ctx.arc(x,y,r*0.8,0,Math.PI*2);
        ctx.clip();
        for (let i=0;i<tn.length;i++) {
            ctx.fillStyle=tn[i];
            ctx.fillRect(x-r+i*(2*r/tn.length),y-r,2*r/tn.length+1,2*r);
        }
        ctx.restore();
        drawShape(ctx,sketchCircle(x,y,r*0.8,{width:1.6,seed:3150}),PALETTE.ink,v);
        return;
    }
    drawAccIcon(ctx,item.part,item.value,x,y,r/16,{...DEFAULT_SKIN,...skin});
}

function drawChest(ctx,s,lid,v,open=false,glow=0) {
    ctx.save();
    ctx.scale(s,s);
    if (glow>0) {
        ctx.save();
        ctx.globalAlpha*=glow;
        ctx.rotate(time.real*0.6);
        ctx.fillStyle=rgba('marker',0.35);
        for (let i=0;i<TUNING.metaUi.chest.rays;i++) {
            ctx.rotate(Math.PI*2/TUNING.metaUi.chest.rays);
            ctx.beginPath();
            ctx.moveTo(0,0);
            ctx.lineTo(-7,-70);
            ctx.lineTo(7,-70);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.fillStyle=PALETTE.farGray;
    ctx.fillRect(-30,-6,60,34);
    ctx.fillStyle=PALETTE.paper;
    ctx.fillRect(-30,-6,60,8);
    ctx.fillStyle=PALETTE.red;
    ctx.fillRect(-4,-6,8,34);
    drawShape(ctx,sketchRect(-30,-6,60,34,{width:2.2,seed:3201}),PALETTE.ink,v);
    if (open) {
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(-27,-8,54,5);
    }
    ctx.save();
    ctx.translate(lid.x||0,lid.y||0);
    ctx.rotate(lid.r||0);
    ctx.fillStyle=PALETTE.paper;
    ctx.beginPath();
    ctx.moveTo(-32,-6);
    ctx.lineTo(-32,-18);
    ctx.quadraticCurveTo(0,-30,32,-18);
    ctx.lineTo(32,-6);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle=PALETTE.ink;
    ctx.lineWidth=2.2;
    ctx.stroke();
    ctx.fillStyle=PALETTE.red;
    ctx.fillRect(-4,-25,8,19);
    ctx.fillStyle=PALETTE.ink;
    ctx.fillRect(-5,-10,10,9);
    ctx.fillStyle=PALETTE.marker;
    ctx.fillRect(-2,-7,4,4);
    ctx.restore();
    ctx.restore();
}

export function drawMiniChest(ctx,x,y,s,v,state) {
    ctx.save();
    ctx.translate(x,y);
    const ready=state==='ready';
    const bob=ready?Math.abs(Math.sin(time.real*5))*3:0;
    ctx.translate(0,-bob);
    if (ready) {
        ctx.rotate(Math.sin(time.real*18)*0.05);
    }
    ctx.globalAlpha*=state==='locked'?0.45:1;
    drawChest(ctx,s,state==='claimed'?{x:-4,y:-6,r:-0.5}:{},v,state==='claimed',ready?0.8:0);
    ctx.restore();
}

export class BuyPrompt extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.3;
        this.item=null;
        this.done=-1;
        this.shake=0;
        this.sparks=[];
    }

    open2(item,skin,onBuy) {
        this.item=item;
        this.skin=skin;
        this.onBuy=onBuy;
        this.done=-1;
        this.shake=0;
        this.sparks=[];
        this.show();
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const U=TUNING.metaUi.buy;
        const bundle=this.item&&this.item.kind==='bundle';
        const pw=Math.min(w-24,bundle?(small?U.wBundleSmall:U.wBundle):(small?U.wSmall:U.w));
        const rows=bundle?Math.ceil(this.item.items.length/2):0;
        const ph=bundle?Math.min(h-16,(small?150:176)+rows*(small?U.chipSmall:U.chip)):(small?236:268);
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const bh=small?40:46;
        const bw=(pw-54)/2;
        this.noBtn={x:this.P.x+18,y:this.P.y+ph-bh-16,w:bw,h:bh};
        this.yesBtn={x:this.P.x+36+bw,y:this.P.y+ph-bh-16,w:bw,h:bh};
        this.buttons=[this.noBtn,this.yesBtn];
    }

    cost() {
        return this.item.kind==='bundle'?bundlePrice(this.item.items):price(this.item);
    }

    update(dt) {
        super.update(dt);
        this.shake=Math.max(0,this.shake-dt*3);
        if (this.done>=0) {
            this.done+=dt;
            if (this.done>TUNING.metaUi.buy.close&&this.open) {
                this.hide();
            }
        }
        for (let i=this.sparks.length-1;i>=0;i--) {
            const q=this.sparks[i];
            q.t+=dt;
            q.x+=q.vx*dt;
            q.y+=q.vy*dt;
            q.vy+=520*dt;
            if (q.t>q.life) {
                this.sparks.splice(i,1);
            }
        }
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (this.done>=0) {
            return true;
        }
        if (inRect(this.yesBtn,x,y)) {
            if (dots()<this.cost()) {
                this.shake=1;
                this.actions.fail();
                return true;
            }
            if (this.onBuy()) {
                this.done=0;
                const cx=this.P.x+this.P.w/2;
                const cy=this.P.y+this.P.h*0.36;
                for (let i=0;i<18;i++) {
                    const a=Math.random()*Math.PI*2;
                    const sp=90+Math.random()*220;
                    this.sparks.push({x:cx,y:cy,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp-140,t:0,life:0.5+Math.random()*0.4,r:2+Math.random()*4,c:i%3===0?PALETTE.red:PALETTE.ink});
                }
                this.actions.bought();
            }
            return true;
        }
        if (inRect(this.noBtn,x,y)||!inRect(this.P,x,y)) {
            this.actions.cancel();
            this.hide();
        }
        return true;
    }

    draw(ctx) {
        if (!this.shown()||!this.item) {
            return;
        }
        this.layout();
        const v=time.boilIndex;
        const P=this.P;
        const small=this.height<600;
        const a=EASE.easeOutBack(clamp01(this.t/0.3));
        const it=this.item;
        const cost=this.cost();
        const rich=dots()>=cost;
        const bundle=it.kind==='bundle';
        ctx.save();
        ctx.fillStyle=rgba('paper',Math.min(0.7,this.t*3));
        ctx.fillRect(0,0,this.width,this.height);
        ctx.translate(P.x+P.w/2+Math.sin(this.shake*40)*8*this.shake,P.y+P.h/2);
        ctx.scale(a,a);
        ctx.rotate((1-a)*0.08);
        ctx.translate(-P.w/2,-P.h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(0,0,P.w,P.h);
        drawShape(ctx,sketchRect(0,0,Math.round(P.w),Math.round(P.h),{width:2.2,seed:3301}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?17:20)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        drawWallet(ctx,P.w-14,small?10:14,v,'right',small?13:14);
        let py=P.h*0.64;
        if (bundle) {
            fitText(ctx,t('meta.bundleTitle',{name:it.name}),18,small?24:28,P.w-120,small?17:20,'bold ');
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font=(small?'12px ':'13px ')+FONT;
            ctx.fillText(t('meta.bundleHint',{n:it.items.length}),18,small?48:56);
            const U=TUNING.metaUi.buy;
            const ch=small?U.chipSmall:U.chip;
            const cw=(P.w-36-10)/2;
            const y0=small?64:76;
            it.items.forEach((q,i)=>{
                const cx=18+(i%2)*(cw+10);
                const cy=y0+Math.floor(i/2)*ch;
                const ap=EASE.easeOutBack(clamp01((this.t-0.1-i*0.04)/0.3));
                ctx.save();
                ctx.translate(cx+cw/2,cy+ch/2-2);
                ctx.scale(ap,ap);
                ctx.translate(-cw/2,-(ch-4)/2);
                ctx.fillStyle=rgba('farGray',0.35);
                ctx.fillRect(0,0,cw,ch-4);
                const ir=(ch-4)*0.32;
                ctx.save();
                ctx.beginPath();
                ctx.rect(2,0,ir*2+8,ch-4);
                ctx.clip();
                drawItemIcon(ctx,q,ir+6,(ch-4)/2,ir,v,this.skin);
                ctx.restore();
                ctx.textAlign='left';
                ctx.textBaseline='middle';
                ctx.fillStyle=PALETTE.ink;
                fitText(ctx,itemName(q),ir*2+16,(ch-4)*0.34,cw-ir*2-50,small?12:13,'bold ');
                ctx.fillStyle=PALETTE.nearGray;
                fitText(ctx,itemPart(q),ir*2+16,(ch-4)*0.72,cw-ir*2-50,small?9:10,'');
                drawInkDot(ctx,cw-22,(ch-4)/2,4.5);
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold 12px '+FONT;
                ctx.fillText(String(price(q)),cw-14,(ch-4)/2+1);
                ctx.restore();
            });
            py=y0+Math.ceil(it.items.length/2)*ch+(small?14:18);
        }
        else {
            ctx.fillText(t(it.kind==='weapon'?'meta.buyWeapon':'meta.buyTitle'),18,small?24:28);
            const iy=P.h*0.4;
            const r=small?26:32;
            const bob=Math.sin(time.real*3)*2;
            if (it.kind==='weapon') {
                this.actions.weaponIcon(ctx,it.value,48,iy+bob,r/40,v);
            }
            else {
                drawItemIcon(ctx,it,48,iy+bob,r,v,this.skin);
            }
            ctx.textAlign='left';
            ctx.fillStyle=PALETTE.ink;
            fitText(ctx,itemName(it),48+r+14,iy-10,P.w-48-r-30,small?16:18,'bold ');
            ctx.fillStyle=PALETTE.nearGray;
            fitText(ctx,itemPart(it)||t('meta.weaponEarly'),48+r+14,iy+12,P.w-48-r-30,12,'');
        }
        ctx.font='bold '+(small?14:15)+'px '+FONT;
        ctx.textAlign='center';
        ctx.fillStyle=rich?PALETTE.ink:PALETTE.red;
        const label=rich?t('meta.cost',{n:cost}):t('meta.poor',{n:cost});
        const tw=ctx.measureText(label).width;
        drawInkDot(ctx,P.w/2-tw/2-10,py+1,6,rich?PALETTE.ink:PALETTE.red);
        ctx.fillText(label,P.w/2+6,py+1);
        ctx.restore();
        const ap=(this.t-0.1)/0.3;
        drawButton(ctx,this.noBtn,t('meta.cancel'),v,ap,this.hoverIdx===0,small?15:17);
        if (rich) {
            const b=this.yesBtn;
            const e=EASE.easeOutBack(clamp01(ap));
            ctx.save();
            ctx.globalAlpha=clamp01(ap*2);
            ctx.translate(b.x+b.w/2,b.y+b.h/2);
            ctx.scale(e*(this.hoverIdx===1?1.05:1),e*(this.hoverIdx===1?1.05:1));
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
            ctx.fillStyle=PALETTE.paper;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            fitText(ctx,t(bundle?'meta.unlockAll':'meta.unlock'),0,1,b.w-14,small?15:17,'bold ');
            ctx.restore();
        }
        else {
            drawButton(ctx,this.yesBtn,t(bundle?'meta.unlockAll':'meta.unlock'),v,ap,false,small?15:17);
            ctx.save();
            ctx.globalAlpha=0.5;
            ctx.fillStyle=PALETTE.paper;
            ctx.fillRect(this.yesBtn.x,this.yesBtn.y,this.yesBtn.w,this.yesBtn.h);
            ctx.restore();
        }
        if (this.done>=0) {
            const k=clamp01(this.done/TUNING.metaUi.buy.stamp);
            const s=2.2-1.2*EASE.easeOutBack(k);
            ctx.save();
            ctx.translate(P.x+P.w/2,P.y+P.h*0.42);
            ctx.rotate(-0.18);
            ctx.scale(s,s);
            ctx.globalAlpha=k;
            ctx.strokeStyle=PALETTE.red;
            ctx.lineWidth=3;
            ctx.strokeRect(-70,-20,140,40);
            ctx.fillStyle=PALETTE.red;
            ctx.font='bold 22px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('meta.unlocked'),0,2);
            ctx.restore();
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
    }
}

export class ChestView extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.items=[];
        this.k=0;
        this.popped=0;
        this.parts=[];
    }

    open2(items,title,skin,cb) {
        this.items=items;
        this.title=title;
        this.skin=skin;
        this.cb=cb;
        this.k=0;
        this.popped=0;
        this.parts=[];
        this.show();
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const bw=small?150:180;
        const bh=small?40:48;
        this.okBtn={x:w/2-bw/2,y:h-bh-(small?14:28),w:bw,h:bh};
        this.buttons=[this.okBtn];
    }

    openAt() {
        return TUNING.metaUi.chest.shake;
    }

    finished() {
        const C=TUNING.metaUi.chest;
        return this.k>=this.openAt()+C.burst+this.items.length*C.itemGap+C.itemPop;
    }

    update(dt) {
        super.update(dt);
        if (!this.open) {
            return;
        }
        const C=TUNING.metaUi.chest;
        const before=this.k;
        this.k+=dt;
        const o=this.openAt();
        if (before<o&&this.k>=o) {
            this.actions.burst();
            this.spray(this.width/2,this.height*0.5,26);
        }
        while (this.popped<this.items.length&&this.k>=o+C.burst+this.popped*C.itemGap) {
            this.popped++;
            this.actions.pop(this.popped);
        }
        for (let i=this.parts.length-1;i>=0;i--) {
            const q=this.parts[i];
            q.t+=dt;
            q.x+=q.vx*dt;
            q.y+=q.vy*dt;
            q.vy+=480*dt;
            if (q.t>q.life) {
                this.parts.splice(i,1);
            }
        }
    }

    spray(x,y,n) {
        for (let i=0;i<n;i++) {
            const a=-Math.PI/2+(Math.random()-0.5)*2.4;
            const sp=180+Math.random()*320;
            this.parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,t:0,life:0.7+Math.random()*0.5,r:2+Math.random()*5,c:i%4===0?PALETTE.red:(i%4===1?PALETTE.marker:PALETTE.ink)});
        }
    }

    skip() {
        if (!this.finished()) {
            const C=TUNING.metaUi.chest;
            this.k=Math.max(this.k,this.k<this.openAt()?this.openAt()-0.05:this.openAt()+C.burst+this.items.length*C.itemGap+C.itemPop);
            return;
        }
        this.hide();
        if (this.cb) {
            this.cb();
        }
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (!this.finished()) {
            const C=TUNING.metaUi.chest;
            this.k=Math.max(this.k,this.k<this.openAt()?this.openAt()-0.05:this.openAt()+C.burst+this.items.length*C.itemGap+C.itemPop);
            return true;
        }
        if (inRect(this.okBtn,x,y)) {
            this.hide();
            if (this.cb) {
                this.cb();
            }
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
        const C=TUNING.metaUi.chest;
        const small=h<600;
        const fade=clamp01(this.t/0.3);
        ctx.save();
        ctx.fillStyle=rgba('paper',0.9*fade);
        ctx.fillRect(0,0,w,h);
        ctx.globalAlpha=fade;
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?20:26)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(this.title||t('meta.chest'),w/2,small?28:48);
        const o=this.openAt();
        const k=this.k;
        const drop=EASE.easeOutBack(clamp01(k/0.35));
        const cx=w/2;
        const cy=h*(small?0.36:0.38);
        const s=small?1.3:1.7;
        const shakeK=clamp01((k-0.3)/(o-0.3));
        const sh=k<o?Math.sin(k*(30+shakeK*40))*0.08*shakeK:0;
        const ok=clamp01((k-o)/C.burst);
        const lt=Math.max(0,k-o);
        const lid=k>=o?{x:-lt*110,y:-260*lt+420*lt*lt,r:-lt*4}:{};
        ctx.save();
        ctx.translate(cx,cy-(1-drop)*h*0.4+(k<o?0:0));
        ctx.rotate(sh);
        const sq=k<o?1+Math.sin(k*30)*0.03*shakeK:1+Math.sin(ok*Math.PI)*0.12;
        ctx.scale(1/sq,sq);
        drawChest(ctx,s,lid,v,k>=o,k>=o?1-ok*0.4:shakeK*0.4);
        ctx.restore();
        const n=this.items.length;
        const cw=Math.min(small?118:150,(w-40)/Math.max(1,n)-12);
        const ch=small?118:160;
        const total=n*cw+(n-1)*12;
        for (let i=0;i<this.popped;i++) {
            const it=this.items[i];
            const st=k-(o+C.burst+i*C.itemGap);
            const p=clamp01(st/C.itemPop);
            const e=EASE.easeOutBack(p);
            const tx=w/2-total/2+i*(cw+12)+cw/2;
            const ty=h*(small?0.66:0.68);
            const x=cx+(tx-cx)*EASE.easeOutCubic(p);
            const y=cy+(ty-cy)*EASE.easeOutCubic(p)-Math.sin(p*Math.PI)*70+Math.sin(time.real*2+i)*C.float*p;
            ctx.save();
            ctx.translate(x,y);
            ctx.scale(e,e);
            ctx.rotate((1-p)*(i%2?0.6:-0.6)+Math.sin(time.real*1.5+i)*0.02);
            ctx.fillStyle=PALETTE.paper;
            ctx.fillRect(-cw/2,-ch/2,cw,ch);
            drawShape(ctx,sketchRect(-cw/2,-ch/2,Math.round(cw),ch,{width:2,seed:3400+i}),it.kind==='acc'?PALETTE.red:PALETTE.ink,v);
            drawItemIcon(ctx,it,0,-ch*0.14,ch*0.22,v,this.skin);
            ctx.fillStyle=PALETTE.ink;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            fitText(ctx,itemName(it),0,ch*0.2,cw-12,small?13:15,'bold ');
            ctx.fillStyle=PALETTE.nearGray;
            fitText(ctx,itemPart(it),0,ch*0.36,cw-12,small?10:12,'');
            if (it.kind!=='dots') {
                ctx.save();
                ctx.translate(cw/2-8,-ch/2+6);
                ctx.rotate(0.15);
                ctx.fillStyle=PALETTE.red;
                ctx.fillRect(-30,-2,36,17);
                ctx.fillStyle=PALETTE.paper;
                ctx.font='bold 11px '+FONT;
                ctx.fillText(t('meta.new'),-12,7);
                ctx.restore();
            }
            ctx.restore();
        }
        if (k<o) {
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font=(small?'12px ':'14px ')+FONT;
            ctx.textAlign='center';
            ctx.fillText(t('meta.tapChest'),w/2,cy+(small?70:90));
        }
        for (const q of this.parts) {
            const f=q.t/q.life;
            ctx.globalAlpha=fade*(1-f);
            ctx.fillStyle=q.c;
            ctx.beginPath();
            ctx.arc(q.x,q.y,q.r*(1-f*0.5),0,Math.PI*2);
            ctx.fill();
        }
        ctx.restore();
        if (this.finished()) {
            const C2=TUNING.metaUi.chest;
            const ap=(k-(o+C2.burst+n*C2.itemGap+C2.itemPop))/0.3+1;
            drawButton(ctx,this.okBtn,t('meta.take'),v,Math.min(ap,this.open?1:this.t/0.35),this.hoverIdx===0,small?16:18);
        }
    }
}

export class AchievementView extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.35;
        this.scroll=0;
        this.scrollTo=0;
        this.contentH=0;
        this.press=null;
        this.V={x:0,y:0,w:0,h:0};
        this.chestHits=[];
        this.bump=0;
        this.barK=0;
    }

    show() {
        super.show();
        this.scroll=0;
        this.scrollTo=0;
        this.press=null;
        this.barK=0;
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const pw=Math.min(1000,w-20);
        const ph=h-(small?12:40);
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const bh=small?38:46;
        this.backBtn={x:this.P.x+20,y:this.P.y+ph-bh-(small?8:16),w:small?120:150,h:bh};
        this.buttons=[this.backBtn];
    }

    clampScroll() {
        const max=Math.max(0,this.contentH-this.V.h);
        this.scrollTo=Math.max(0,Math.min(max,this.scrollTo));
    }

    wheel(dy) {
        if (this.open) {
            this.scrollTo+=dy;
            this.clampScroll();
        }
    }

    update(dt) {
        super.update(dt);
        this.clampScroll();
        this.scroll+=(this.scrollTo-this.scroll)*Math.min(1,dt*TUNING.metaUi.ach.scrollFollow);
        this.bump=Math.max(0,this.bump-dt*2);
        const f=progress.ach.length/ACHIEVEMENTS.length;
        this.barK+=(f-this.barK)*Math.min(1,dt*4*(this.t>0.3?1:0));
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
        for (const c of this.chestHits) {
            if (Math.hypot(x-c.x,y-c.y)<c.r&&c.state==='ready') {
                this.bump=1;
                this.actions.chest();
                return true;
            }
        }
        if (inRect(this.V,x,y)) {
            this.press={x0:x,y0:y,s0:this.scrollTo,moved:false};
        }
        return true;
    }

    move(x,y) {
        const p=this.press;
        if (!p) {
            return;
        }
        if (Math.hypot(x-p.x0,y-p.y0)>TUNING.metaUi.ach.dragSlop) {
            p.moved=true;
        }
        if (p.moved) {
            this.scrollTo=p.s0-(y-p.y0);
            this.clampScroll();
            this.scroll=this.scrollTo;
        }
    }

    up() {
        this.press=null;
    }

    drawTopBar(ctx,x,y,w,v,small) {
        const n=progress.ach.length;
        const total=ACHIEVEMENTS.length;
        const E=TUNING.meta.chestEvery;
        const U=TUNING.metaUi.ach;
        const bh=U.barH;
        const ready=chestsReady();
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?14:15)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t('ach.progress',{n,total}),x,y);
        ctx.textAlign='right';
        ctx.fillStyle=ready>0?PALETTE.red:PALETTE.nearGray;
        ctx.fillText(ready>0?t('ach.chestReady',{n:ready}):t('ach.chestNext',{n:E-n%E}),x+w,y);
        const by=y+(small?24:30);
        const bx=x+8;
        const bw=w-16;
        ctx.fillStyle=rgba('farGray',0.8);
        ctx.fillRect(bx,by,bw,bh);
        ctx.fillStyle=PALETTE.ink;
        ctx.fillRect(bx,by,bw*this.barK,bh);
        drawShape(ctx,sketchRect(bx,by,Math.round(bw),bh,{width:1.4,seed:3501}),PALETTE.ink,v);
        this.chestHits=[];
        const chests=Math.floor(total/E);
        for (let i=1;i<=chests;i++) {
            const cx=bx+bw*(i*E/total);
            const cy=by+bh/2;
            const state=i<=progress.achChests?'claimed':(i*E<=n?'ready':'locked');
            const r=U.chestR*(small?0.85:1);
            const ap=EASE.easeOutBack(clamp01((this.t-0.2-i*0.06)/0.3));
            ctx.save();
            ctx.translate(cx,cy-2);
            ctx.scale(ap*(state==='ready'?1+this.bump*0.2:1),ap*(state==='ready'?1+this.bump*0.2:1));
            ctx.fillStyle=PALETTE.paper;
            ctx.beginPath();
            ctx.arc(0,0,r,0,Math.PI*2);
            ctx.fill();
            drawShape(ctx,sketchCircle(0,0,r,{width:state==='ready'?2.2:1.3,seed:3510+i}),state==='ready'?PALETTE.red:PALETTE.ink,v);
            drawMiniChest(ctx,0,4,r/36,v,state);
            ctx.restore();
            this.chestHits.push({x:cx,y:cy,r:r+8,state});
        }
        return by+bh+(small?18:24);
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
        const U=TUNING.metaUi.ach;
        const a=EASE.easeOutBack(clamp01(this.t/0.4));
        ctx.save();
        ctx.fillStyle=rgba('paper',Math.min(0.85,this.t*4));
        ctx.fillRect(0,0,w,h);
        ctx.translate(w/2,h/2);
        ctx.scale(0.9+0.1*a,0.9+0.1*a);
        ctx.translate(-w/2,-h/2);
        ctx.globalAlpha=clamp01(this.t*4);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(P.x,P.y,P.w,P.h);
        drawShape(ctx,sketchRect(P.x,P.y,Math.round(P.w),Math.round(P.h),{width:2.2,seed:3520}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?20:28)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t('ach.title'),P.x+22,P.y+(small?22:34));
        drawWallet(ctx,P.x+P.w-18,P.y+(small?8:18),v,'right',small?13:15,this.bump);
        let y=this.drawTopBar(ctx,P.x+22,P.y+(small?50:72),P.w-44,v,small);
        this.V={x:P.x+10,y,w:P.w-20,h:this.backBtn.y-8-y};
        const V=this.V;
        ctx.save();
        ctx.beginPath();
        ctx.rect(V.x,V.y,V.w,V.h);
        ctx.clip();
        const rh=small?U.rowHSmall:U.rowH;
        const cols=P.w>=U.twoCol?2:1;
        const cw=(V.w-20-(cols-1)*14)/cols;
        const order=ACHIEVEMENTS.map((q,i)=>({q,i,done:progress.ach.includes(q.id)}));
        const y0=y-this.scroll;
        for (let k=0;k<order.length;k++) {
            const {q,done}=order[k];
            const rx=V.x+10+(k%cols)*(cw+14);
            const ry=y0+Math.floor(k/cols)*(rh+10);
            if (ry>V.y+V.h||ry+rh<V.y) {
                continue;
            }
            const ap=EASE.easeOutBack(clamp01((this.t-0.15-Math.min(k,16)*U.stagger)/0.3));
            const val=done?q.goal:Math.min(q.goal,statValue(q.stat));
            const f=done?1:val/q.goal;
            ctx.save();
            ctx.translate(rx+cw/2,ry+rh/2);
            ctx.scale(ap,ap);
            ctx.translate(-cw/2,-rh/2);
            ctx.globalAlpha*=clamp01(ap);
            ctx.fillStyle=done?rgba('red',0.06):rgba('paper',0.95);
            ctx.fillRect(0,0,cw,rh);
            drawShape(ctx,sketchRect(0,0,Math.round(cw),rh,{width:done?2:1.2,seed:3530+k}),done?PALETTE.red:PALETTE.nearGray,v);
            const ir=rh*0.28;
            drawChoiceIcon(ctx,q.icon,rh*0.48,rh/2,ir,v,done);
            const tx=rh*0.95;
            const tw=cw-tx-(small?78:92);
            ctx.textAlign='left';
            ctx.textBaseline='middle';
            ctx.fillStyle=done?PALETTE.ink:PALETTE.ink;
            fitText(ctx,t('ach.'+q.id+'.name'),tx,rh*0.26,tw,small?17:18,'bold ');
            ctx.fillStyle=PALETTE.nearGray;
            fitText(ctx,t('ach.'+q.id+'.desc',{n:q.goal}),tx,rh*0.53,tw,small?14:14,'');
            const bx=tx;
            const by=rh*0.74;
            const bw=tw;
            ctx.fillStyle=rgba('farGray',0.8);
            ctx.fillRect(bx,by,bw,7);
            ctx.fillStyle=done?PALETTE.red:PALETTE.ink;
            ctx.fillRect(bx,by,bw*f*clamp01(ap),7);
            ctx.fillStyle=PALETTE.nearGray;
            ctx.font='bold '+(small?14:13)+'px '+FONT;
            ctx.textAlign='right';
            ctx.fillText(val+'/'+q.goal,cw-12,rh*0.78);
            if (done) {
                ctx.save();
                ctx.translate(cw-(small?40:46),rh*0.36);
                ctx.rotate(-0.15);
                ctx.strokeStyle=PALETTE.red;
                ctx.lineWidth=2;
                ctx.strokeRect(-30,-12,60,24);
                ctx.fillStyle=PALETTE.red;
                ctx.font='bold 14px '+FONT;
                ctx.textAlign='center';
                ctx.fillText(t('ach.done'),0,1);
                ctx.restore();
            }
            else {
                drawInkDot(ctx,cw-(small?50:58),rh*0.36,6.5);
                ctx.fillStyle=PALETTE.ink;
                ctx.font='bold 15px '+FONT;
                ctx.textAlign='left';
                ctx.fillText('+1',cw-(small?40:48),rh*0.37);
            }
            ctx.restore();
        }
        this.contentH=Math.ceil(order.length/cols)*(rh+10)+6;
        ctx.restore();
        const max=Math.max(0,this.contentH-V.h);
        if (max>0) {
            const th=Math.max(30,V.h*V.h/this.contentH);
            const ty=V.y+(V.h-th)*(this.scroll/max);
            ctx.fillStyle=rgba('farGray',0.6);
            ctx.fillRect(V.x+V.w-5,V.y,4,V.h);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillRect(V.x+V.w-6,ty,6,th);
        }
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font=(small?'13px ':'14px ')+FONT;
        ctx.textAlign='right';
        ctx.textBaseline='middle';
        ctx.fillText(t('ach.hint'),P.x+P.w-22,this.backBtn.y+this.backBtn.h/2);
        ctx.restore();
        drawButton(ctx,this.backBtn,t('menu.back'),v,(this.t-0.1)/0.3,this.hoverIdx===0,small?15:17);
    }
}

export class RevivePopup extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.3;
        this.n=1;
        this.pulse=0;
        this.hits=[];
    }

    open2(cb) {
        this.cb=cb;
        const R=TUNING.meta.revive;
        this.n=Math.min(R.max,Math.max(R.min,Math.min(dots(),Math.ceil(R.max/2))));
        this.pulse=0;
        this.chosen=false;
        this.show();
    }

    maxN() {
        return Math.max(1,Math.min(TUNING.meta.revive.max,dots()));
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const U=TUNING.metaUi.revive;
        const pw=Math.min(w-24,small?U.wSmall:U.w);
        const ph=small?Math.min(h-20,250):300;
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const bh=small?40:48;
        const bw=(this.P.w-54)/2;
        this.noBtn={x:this.P.x+18,y:this.P.y+ph-bh-14,w:bw,h:bh};
        this.yesBtn={x:this.P.x+36+bw,y:this.P.y+ph-bh-14,w:bw,h:bh};
        const sb=small?40:46;
        const cy=this.P.y+ph*(small?0.5:0.5);
        this.minus={x:this.P.x+20,y:cy-sb/2,w:sb,h:sb};
        this.plus={x:this.P.x+this.P.w-20-sb,y:cy-sb/2,w:sb,h:sb};
        this.buttons=[this.noBtn,this.yesBtn,this.minus,this.plus];
    }

    update(dt) {
        super.update(dt);
        this.pulse=Math.max(0,this.pulse-dt*TUNING.metaUi.revive.pulse);
    }

    set(n) {
        const m=Math.max(TUNING.meta.revive.min,Math.min(this.maxN(),n));
        if (m!==this.n) {
            this.n=m;
            this.pulse=1;
            this.actions.tick();
        }
    }

    down(x,y) {
        if (!this.open||this.chosen) {
            return true;
        }
        this.layout();
        if (inRect(this.minus,x,y)) {
            this.set(this.n-1);
            return true;
        }
        if (inRect(this.plus,x,y)) {
            this.set(this.n+1);
            return true;
        }
        for (const q of this.hits) {
            if (inRect(q,x,y)) {
                this.set(q.n);
                return true;
            }
        }
        if (inRect(this.yesBtn,x,y)) {
            this.chosen=true;
            this.hide();
            this.cb(this.n);
            return true;
        }
        if (inRect(this.noBtn,x,y)) {
            this.chosen=true;
            this.hide();
            this.cb(0);
        }
        return true;
    }

    draw(ctx) {
        if (!this.shown()) {
            return;
        }
        this.layout();
        const v=time.boilIndex;
        const P=this.P;
        const small=this.height<600;
        const a=EASE.easeOutBack(clamp01(this.t/0.35));
        ctx.save();
        ctx.fillStyle=rgba('ink',Math.min(0.35,this.t*1.2));
        ctx.fillRect(0,0,this.width,this.height);
        ctx.translate(P.x+P.w/2,P.y+P.h/2-(1-a)*60);
        ctx.scale(a,a);
        ctx.rotate((1-a)*-0.1);
        ctx.translate(-P.w/2,-P.h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(0,0,P.w,P.h);
        drawShape(ctx,sketchRect(0,0,Math.round(P.w),Math.round(P.h),{width:2.4,seed:3601}),PALETTE.ink,v);
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold '+(small?19:24)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t('revive.title'),18,small?24:32);
        drawWallet(ctx,P.w-14,small?10:16,v,'right',small?13:14);
        ctx.fillStyle=PALETTE.nearGray;
        ctx.font=(small?'12px ':'13px ')+FONT;
        ctx.fillText(t('revive.hint',{max:this.maxN()}),18,small?50:64);
        ctx.restore();
        const cy=this.minus.y+this.minus.h/2;
        const mx=this.minus.x+this.minus.w+12;
        const mw=this.plus.x-12-mx;
        const max=TUNING.meta.revive.max;
        const cell=mw/max;
        const hr=Math.min(cell*0.42,small?11:14);
        this.hits=[];
        ctx.save();
        ctx.globalAlpha=clamp01(this.t*4);
        for (let i=0;i<max;i++) {
            const x=mx+cell*(i+0.5);
            const on=i<this.n;
            const can=i<this.maxN();
            const pk=on&&i===this.n-1?Math.sin(this.pulse*Math.PI)*0.35:0;
            const ap=EASE.easeOutBack(clamp01((this.t-0.15-i*0.03)/0.25));
            ctx.save();
            ctx.translate(x,cy-(small?10:14));
            ctx.scale(ap*(1+pk),ap*(1+pk));
            ctx.fillStyle=on?PALETTE.red:(can?rgba('farGray',0.9):rgba('farGray',0.35));
            ctx.beginPath();
            ctx.moveTo(0,hr*0.9);
            ctx.bezierCurveTo(-hr*1.4,-hr*0.2,-hr*0.6,-hr*1.2,0,-hr*0.4);
            ctx.bezierCurveTo(hr*0.6,-hr*1.2,hr*1.4,-hr*0.2,0,hr*0.9);
            ctx.fill();
            ctx.strokeStyle=can?PALETTE.ink:PALETTE.midGray;
            ctx.lineWidth=1.3;
            ctx.stroke();
            ctx.restore();
            if (can) {
                this.hits.push({x:x-cell/2,y:cy-(small?28:34),w:cell,h:small?40:48,n:i+1});
            }
        }
        const pk=1+Math.sin(this.pulse*Math.PI)*0.2;
        ctx.save();
        ctx.translate(mx+mw/2,cy+(small?20:26));
        ctx.scale(pk,pk);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold '+(small?15:17)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        const label=t('revive.cost',{n:this.n});
        const tw=ctx.measureText(label).width;
        drawInkDot(ctx,-tw/2-10,1,6);
        ctx.fillText(label,6,1);
        ctx.restore();
        ctx.restore();
        const ap=(this.t-0.1)/0.3;
        const minusOk=this.n>TUNING.meta.revive.min;
        const plusOk=this.n<this.maxN();
        drawButton(ctx,this.minus,'−',v,ap,this.hoverIdx===2&&minusOk,22);
        drawButton(ctx,this.plus,'+',v,ap,this.hoverIdx===3&&plusOk,22);
        drawButton(ctx,this.noBtn,t('revive.no'),v,ap,this.hoverIdx===0,small?15:17,true);
        const b=this.yesBtn;
        const e=EASE.easeOutBack(clamp01(ap));
        ctx.save();
        ctx.globalAlpha=clamp01(ap*2);
        ctx.translate(b.x+b.w/2,b.y+b.h/2);
        ctx.scale(e*(this.hoverIdx===1?1.05:1),e*(this.hoverIdx===1?1.05:1));
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
        ctx.fillStyle=PALETTE.paper;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        fitText(ctx,t('revive.yes',{n:this.n}),0,1,b.w-14,small?15:17,'bold ');
        ctx.restore();
    }
}

export class ConfirmPopup extends Panel {
    constructor(actions) {
        super();
        this.actions=actions;
        this.outFrom=0.3;
        this.done=-1;
        this.fired=false;
    }

    open2(spec) {
        this.spec=spec;
        this.done=-1;
        this.fired=false;
        this.show();
    }

    layout() {
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const U=TUNING.metaUi.confirm;
        const pw=Math.min(w-24,small?U.wSmall:U.w);
        const ph=small?U.hSmall:U.h;
        this.P={x:w/2-pw/2,y:h/2-ph/2,w:pw,h:ph};
        const bh=small?42:48;
        const bw=(pw-54)/2;
        this.noBtn={x:this.P.x+18,y:this.P.y+ph-bh-16,w:bw,h:bh};
        this.yesBtn={x:this.P.x+36+bw,y:this.P.y+ph-bh-16,w:bw,h:bh};
        this.buttons=[this.noBtn,this.yesBtn];
    }

    update(dt) {
        super.update(dt);
        if (this.done>=0) {
            this.done+=dt;
            if (!this.fired&&this.done>=TUNING.metaUi.confirm.flood) {
                this.fired=true;
                this.spec.onYes();
            }
        }
    }

    down(x,y) {
        if (!this.open) {
            return false;
        }
        this.layout();
        if (this.done>=0) {
            return true;
        }
        if (inRect(this.yesBtn,x,y)) {
            this.done=0;
            this.actions.yes();
            return true;
        }
        if (inRect(this.noBtn,x,y)||!inRect(this.P,x,y)) {
            this.actions.no();
            this.hide();
        }
        return true;
    }

    draw(ctx) {
        if (!this.shown()||!this.spec) {
            return;
        }
        this.layout();
        const v=time.boilIndex;
        const P=this.P;
        const w=this.width;
        const h=this.height;
        const small=h<600;
        const a=EASE.easeOutBack(clamp01(this.t/0.32));
        ctx.save();
        ctx.fillStyle=rgba('ink',Math.min(0.45,this.t*1.6));
        ctx.fillRect(0,0,w,h);
        ctx.translate(P.x+P.w/2,P.y+P.h/2-(1-a)*50);
        ctx.scale(a,a);
        ctx.rotate((1-a)*0.08);
        ctx.translate(-P.w/2,-P.h/2);
        ctx.fillStyle=PALETTE.paper;
        ctx.fillRect(0,0,P.w,P.h);
        drawShape(ctx,sketchRect(0,0,Math.round(P.w),Math.round(P.h),{width:2.6,seed:3801}),PALETTE.red,v);
        const ix=small?40:48;
        const iy=small?40:50;
        const ir=small?20:24;
        ctx.save();
        ctx.translate(ix,iy+Math.sin(time.real*3)*2);
        ctx.rotate(Math.sin(time.real*9)*0.06);
        ctx.fillStyle=PALETTE.red;
        ctx.beginPath();
        ctx.moveTo(0,-ir);
        ctx.lineTo(ir*1.05,ir*0.8);
        ctx.lineTo(-ir*1.05,ir*0.8);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle=PALETTE.paper;
        ctx.font='bold '+Math.round(ir*1.1)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText('!',0,ir*0.25);
        ctx.restore();
        ctx.fillStyle=PALETTE.red;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        fitText(ctx,this.spec.title,ix+ir+18,iy,P.w-ix-ir-36,small?20:24,'bold ');
        ctx.fillStyle=PALETTE.ink;
        ctx.font=(small?'14px ':'16px ')+FONT;
        ctx.textBaseline='top';
        const lines=wrapText(ctx,this.spec.body,P.w-44);
        let ty=iy+ir+(small?14:20);
        for (const ln of lines) {
            ctx.fillText(ln,22,ty);
            ty+=small?20:23;
        }
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold '+(small?14:16)+'px '+FONT;
        ctx.fillText(this.spec.warn,22,ty+(small?4:8));
        ctx.restore();
        const ap=(this.t-0.12)/0.3;
        drawButton(ctx,this.noBtn,this.spec.no,v,ap,this.hoverIdx===0,small?16:18);
        const b=this.yesBtn;
        const e=EASE.easeOutBack(clamp01(ap));
        const hv=this.hoverIdx===1;
        ctx.save();
        ctx.globalAlpha=clamp01(ap*2);
        ctx.translate(b.x+b.w/2+(hv?Math.sin(time.real*30)*1.2:0),b.y+b.h/2);
        ctx.scale(e*(hv?1.05:1),e*(hv?1.05:1));
        ctx.fillStyle=PALETTE.red;
        ctx.fillRect(-b.w/2,-b.h/2,b.w,b.h);
        ctx.fillStyle=PALETTE.paper;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        fitText(ctx,this.spec.yes,0,1,b.w-14,small?16:18,'bold ');
        ctx.restore();
        if (this.done>=0) {
            const k=EASE.easeInOutCubic(clamp01(this.done/TUNING.metaUi.confirm.flood));
            ctx.save();
            ctx.fillStyle=PALETTE.ink;
            ctx.beginPath();
            ctx.moveTo(0,h);
            const top=h*(1-k*1.15);
            for (let i=0;i<=24;i++) {
                const x=w*i/24;
                ctx.lineTo(x,top+Math.sin(i*1.7+this.done*9)*18*(1-k*0.5));
            }
            ctx.lineTo(w,h);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
    }
}

export class AchToast {
    constructor() {
        this.list=[];
    }

    push(a) {
        this.list.push({a,t:0});
    }

    draw(ctx,w,dt,v) {
        if (this.list.length===0) {
            return;
        }
        const U=TUNING.metaUi.toast;
        const small=w<700;
        const tw=small?U.wSmall:U.w;
        const th=small?U.hSmall:U.h;
        const q=this.list[0];
        q.t+=dt;
        if (q.t>U.time) {
            this.list.shift();
            return;
        }
        const k=Math.min(clamp01(q.t/U.slide),clamp01((U.time-q.t)/U.slide));
        const e=q.t<U.slide?EASE.easeOutBack(k):EASE.easeOutCubic(k);
        const x=w/2-tw/2;
        const y=U.top-(1-e)*(th+U.top+10);
        ctx.save();
        ctx.translate(x,y);
        ctx.fillStyle=rgba('paper',0.97);
        ctx.fillRect(0,0,tw,th);
        drawShape(ctx,sketchRect(0,0,tw,th,{width:2,seed:3701}),PALETTE.red,v);
        const sp=clamp01((q.t-U.slide)/0.4);
        ctx.save();
        ctx.translate(th*0.5,th/2);
        ctx.rotate((1-EASE.easeOutBack(sp))*-1.2);
        ctx.scale(0.6+0.4*EASE.easeOutBack(sp),0.6+0.4*EASE.easeOutBack(sp));
        drawChoiceIcon(ctx,q.a.icon,0,0,th*0.32,v,true);
        ctx.restore();
        ctx.fillStyle=PALETTE.red;
        ctx.font='bold '+(small?10:11)+'px '+FONT;
        ctx.textAlign='left';
        ctx.textBaseline='middle';
        ctx.fillText(t('ach.unlocked'),th*0.95,th*0.3);
        ctx.fillStyle=PALETTE.ink;
        fitText(ctx,t('ach.'+q.a.id+'.name'),th*0.95,th*0.62,tw-th*0.95-60,small?14:16,'bold ');
        const dk=clamp01((q.t-U.slide-0.2)/0.3);
        ctx.save();
        ctx.translate(tw-34,th/2-(1-dk)*10);
        ctx.globalAlpha*=dk;
        drawInkDot(ctx,-8,0,6);
        ctx.fillStyle=PALETTE.ink;
        ctx.font='bold 14px '+FONT;
        ctx.fillText('+1',0,1);
        ctx.restore();
        ctx.restore();
    }
}
