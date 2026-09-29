import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {t} from '../data/strings.js';
import {EASE} from '../core/easing.js';
import {RNG} from '../core/rng.js';
import {time} from '../core/loop.js';
import {CARD_W,CARD_H,drawCost,rareBorderPath} from './cardView.js';
import {sketchPath,sketchRect,drawShape} from './sketch.js';
import {cardCost,cardRange,cardParams} from '../game/card.js';
import {isUlt} from '../data/cards.js';

const C=TUNING.cards;
const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const rng=new RNG(2718);
const RARE=rareBorderPath();
const TEAR_Y=CARD_H*0.2;

const TEAR=(()=>{
    const pts=[];
    const r=new RNG(61);
    for (let i=0;i<=12;i++) {
        pts.push([i/12*CARD_W,TEAR_Y+r.range(-4,4)]);
    }
    const body=new Path2D();
    body.moveTo(0,pts[0][1]);
    for (const p of pts) {
        body.lineTo(p[0],p[1]);
    }
    body.lineTo(CARD_W,CARD_H);
    body.lineTo(0,CARD_H);
    body.closePath();
    const stub=new Path2D();
    stub.moveTo(0,0);
    stub.lineTo(CARD_W,0);
    for (let i=pts.length-1;i>=0;i--) {
        stub.lineTo(pts[i][0],pts[i][1]);
    }
    stub.closePath();
    const line=new Path2D();
    line.moveTo(pts[0][0],pts[0][1]);
    for (const p of pts) {
        line.lineTo(p[0],p[1]);
    }
    return {body,stub,line};
})();

const STROKES=(()=>{
    const out=[];
    const r=new RNG(404);
    for (let i=0;i<8;i++) {
        const len=r.range(10,24);
        const bend=r.range(-6,6);
        out.push(sketchPath([[-len/2,0],[0,bend],[len/2,r.range(-3,3)]],{width:r.range(1.8,3.2),seed:500+i,overshoot:1}));
    }
    return out;
})();

class CardView {
    constructor(card) {
        this.card=card;
        this.x=0;
        this.y=0;
        this.rot=0;
        this.scale=0.6;
        this.sx=1;
        this.skew=0;
        this.face=false;
        this.state='draw';
        this.t=0;
        this.shakeT=0;
        this.flashT=0;
        this.fromX=0;
        this.fromY=0;
        this.tx=0;
        this.ty=0;
        this.trot=0;
        this.tscale=1;
        this.alpha=1;
        this.vx=0;
        this.vy=0;
        this.vr=0;
        this.target=null;
        this.clip=null;
        this.ball=0;
        this.slot=0;
    }
}

export class Hand {
    constructor(api) {
        this.api=api;
        this.views=[];
        this.flying=[];
        this.stubs=[];
        this.strokes=[];
        this.ghosts=[];
        this.hover=null;
        this.press=null;
        this.targetView=null;
        this.path=null;
        this.pointer={x:0,y:0,active:false};
        this.width=1;
        this.height=1;
        this.s=1;
        this.reshuffling=false;
        this.reshuffleT=0;
        this.lockMsgT=0;
        this.burnMsgT=0;
        this.riffleT=0;
        this.lastDiscard=null;
        this.drawRect={x:0,y:0,w:0,h:0};
        this.discardRect={x:0,y:0,w:0,h:0};
        this.stickT=null;
        this._tmp={x:0,y:0};
        this._g={x:0,y:0,z:0};
    }

    reset() {
        this.views.length=0;
        this.flying.length=0;
        this.stubs.length=0;
        this.strokes.length=0;
        this.ghosts.length=0;
        this.hover=null;
        this.press=null;
        this.targetView=null;
        this.path=null;
        this.reshuffling=false;
        this.lastDiscard=null;
        this.api.preview.hide();
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
        this.s=Math.max(0.8,Math.min(1.2,h/900));
        const W=CARD_W*this.s;
        const H=CARD_H*this.s;
        const py=h-H*0.5-18;
        const pw=W*0.62;
        const ph=H*0.62;
        const left=this.slotX(0)-W*0.5;
        const right=this.slotX(2)+W*0.5;
        this.drawRect={x:left-W*0.55-pw,y:py-ph/2,w:pw,h:ph};
        this.discardRect={x:right+W*0.55,y:py-ph/2,w:pw,h:ph};
    }

    pileCenter(r) {
        return [r.x+r.w/2,r.y+r.h/2];
    }

    fieldBottom() {
        return this.height-CARD_H*this.s*C.fieldMargin;
    }

    onDraw(card) {
        const v=new CardView(card);
        const [px,py]=this.pileCenter(this.drawRect);
        v.x=v.fromX=px;
        v.y=v.fromY=py;
        v.scale=0.62;
        v.rot=-0.1;
        v.state='draw';
        v.t=0;
        if (isUlt(card.id)) {
            v.slot=2;
        }
        else {
            v.slot=this.views.some(o=>o.slot===0)?1:0;
        }
        this.views.push(v);
    }

    onReshuffleStart(n) {
        this.reshuffling=true;
        this.reshuffleT=0;
        this.ghosts.length=0;
        const [ax,ay]=this.pileCenter(this.discardRect);
        const [bx,by]=this.pileCenter(this.drawRect);
        const count=Math.min(8,Math.max(1,n));
        for (let i=0;i<count;i++) {
            this.ghosts.push({ax,ay,bx,by,delay:i*0.11,t:0,spin:rng.sign()*rng.range(3,6),h:rng.range(90,150)});
        }
        this.cancelTargeting();
    }

    onReshuffleEnd() {
        this.reshuffling=false;
        this.ghosts.length=0;
        this.riffleT=0.4;
        this.lastDiscard=null;
    }

    slotX(i) {
        const W=CARD_W*this.s;
        const cx=this.width/2;
        if (i===2) {
            return cx+W*C.ultGap;
        }
        return cx-W*(C.ultGap*0.5)+(i-0.5)*W*C.spacing*1.12-W*0.35;
    }

    normals() {
        return this.views.filter(v=>!isUlt(v.card.id));
    }

    ultView() {
        return this.views.find(v=>isUlt(v.card.id))||null;
    }

    slotTargets() {
        const W=CARD_W*this.s;
        const H=CARD_H*this.s;
        const restY=this.height-H*C.restShow+H/2;
        for (const v of this.views) {
            const slot=v.slot;
            const k=slot===2?0.6:(slot-0.5);
            v.tx=this.slotX(slot);
            v.ty=restY+(slot===2?0:Math.abs(k)*C.fanDrop*this.s);
            v.trot=slot===2?0.03:k*C.fanRot;
            v.tscale=1;
            if (this.hover&&v!==this.hover&&slot<2&&!isUlt(this.hover.card.id)) {
                v.tx+=Math.sign(v.tx-this.hover.tx||1)*C.neighborSpread*this.s;
            }
            if (v===this.hover) {
                v.ty=this.height-H*C.hoverScale/2-10;
                v.tscale=C.hoverScale;
                v.trot=Math.max(-C.hoverTilt,Math.min(C.hoverTilt,(this.pointer.x-v.tx)/(W*4)));
            }
            if (v===this.targetView) {
                v.ty=restY-C.targetLift*this.s;
                v.tscale=1.08;
                v.trot=0;
            }
        }
    }

    onBurn(card) {
        const v=new CardView(card);
        const [px,py]=this.pileCenter(this.drawRect);
        v.x=v.fromX=px;
        v.y=v.fromY=py;
        v.scale=0.62;
        v.state='burn';
        v.t=0;
        v.face=false;
        this.flying.push(v);
        this.burnMsgT=1.4;
    }

    hitCard(x,y) {
        const order=this.drawOrder();
        for (let i=order.length-1;i>=0;i--) {
            const v=order[i];
            if (v.state!=='idle'&&v.state!=='draw') {
                continue;
            }
            const W=CARD_W*this.s*v.scale;
            const H=CARD_H*this.s*v.scale;
            const c=Math.cos(-v.rot);
            const s=Math.sin(-v.rot);
            const dx=x-v.x;
            const dy=y-v.y;
            const lx=dx*c-dy*s;
            const ly=dx*s+dy*c;
            if (Math.abs(lx)<=W/2&&Math.abs(ly)<=H/2) {
                return v;
            }
        }
        return null;
    }

    inRect(r,x,y,pad=10) {
        return x>=r.x-pad&&x<=r.x+r.w+pad&&y>=r.y-pad&&y<=r.y+r.h+pad;
    }

    drawOrder() {
        const out=[];
        for (const v of this.views) {
            if (v!==this.hover&&v!==this.targetView&&v.state!=='drag') {
                out.push(v);
            }
        }
        if (this.hover&&this.views.includes(this.hover)) {
            out.push(this.hover);
        }
        for (const v of this.views) {
            if (v.state==='drag'||v===this.targetView) {
                out.push(v);
            }
        }
        return out;
    }

    resolveTarget(card,sx,sy) {
        const api=this.api;
        const p=api.playerPos();
        const aim=api.aimDir();
        const tg=card.def.targeting;
        const out={type:tg,x:p.x,z:p.z,dx:aim.x,dz:aim.z};
        let gx=0;
        let gz=0;
        let has=false;
        if (sx!==undefined&&api.screenToGround(sx,sy,this._g)) {
            gx=this._g.x;
            gz=this._g.z;
            has=true;
        }
        if (tg==='drawPath') {
            if (this.path&&this.path.pts.length>1) {
                out.points=this.path.pts.slice();
            }
            else {
                const cx=p.x+aim.x*2.8;
                const cz=p.z+aim.z*2.8;
                const px=-aim.z;
                const pz=aim.x;
                out.points=[{x:cx-px*2.2,z:cz-pz*2.2},{x:cx,z:cz},{x:cx+px*2.2,z:cz+pz*2.2}];
            }
            out.x=out.points[0].x;
            out.z=out.points[0].z;
            return out;
        }
        if (tg==='direction') {
            if (has) {
                const dx=gx-p.x;
                const dz=gz-p.z;
                const l=Math.hypot(dx,dz);
                if (l>0.3) {
                    out.dx=dx/l;
                    out.dz=dz/l;
                }
            }
            out.x=p.x+out.dx*3;
            out.z=p.z+out.dz*3;
        }
        else if (tg==='point') {
            const range=cardRange(card);
            if (has) {
                out.x=gx;
                out.z=gz;
            }
            else {
                const e=api.nearestEnemy(p.x,p.z,range);
                if (e) {
                    out.x=e.x;
                    out.z=e.z;
                }
                else {
                    out.x=p.x+aim.x*5;
                    out.z=p.z+aim.z*5;
                }
            }
            const dx=out.x-p.x;
            const dz=out.z-p.z;
            const l=Math.hypot(dx,dz);
            if (l>range) {
                out.x=p.x+dx/l*range;
                out.z=p.z+dz/l*range;
            }
            if (l>0.01) {
                out.dx=dx/l;
                out.dz=dz/l;
            }
        }
        return out;
    }

    shake(v,flash) {
        v.shakeT=C.shakeTime;
        if (flash) {
            v.flashT=C.shakeTime+0.2;
        }
    }

    tryPlay(v,target) {
        const api=this.api;
        const card=v.card;
        if (!api.deck.canPlay()) {
            this.shake(v,false);
            this.lockMsgT=1.2;
            v.state='idle';
            return false;
        }
        const cost=cardCost(card);
        if (!api.ink.can(cost)) {
            this.shake(v,true);
            api.ink.spend(cost);
            v.state='idle';
            return false;
        }
        api.ink.spend(cost);
        api.deck.play(card);
        this.removeView(v);
        v.state='tear';
        v.t=0;
        v.target=target;
        v.face=true;
        v.sx=1;
        v.skew=0;
        this.flying.push(v);
        if (api.onPlayStart) {
            api.onPlayStart(card,target);
        }
        return true;
    }

    discardView(v) {
        this.api.deck.discard(v.card);
        this.removeView(v);
        v.state='crumple';
        v.t=0;
        this.flying.push(v);
        this.lastDiscard=v.card;
    }

    keyDiscard() {
        const v=this.targetView;
        if (!v||v.state!=='idle') {
            return false;
        }
        this.cancelTargeting();
        this.discardView(v);
        return true;
    }

    removeView(v) {
        const i=this.views.indexOf(v);
        if (i>=0) {
            this.views.splice(i,1);
        }
        if (this.hover===v) {
            this.hover=null;
        }
        if (this.targetView===v) {
            this.targetView=null;
            this.api.preview.hide();
        }
    }

    enterTargeting(v) {
        this.targetView=v;
        this.hover=null;
    }

    addPathPoint(sx,sy) {
        const path=this.path;
        if (!path||sy>=this.fieldBottom()) {
            return;
        }
        if (!this.api.screenToGround(sx,sy,this._g)) {
            return;
        }
        const pts=path.pts;
        const max=cardParams(path.card).length||8;
        const q={x:this._g.x,z:this._g.z};
        if (pts.length===0) {
            pts.push(q);
            return;
        }
        const last=pts[pts.length-1];
        let d=Math.hypot(q.x-last.x,q.z-last.z);
        if (d<TUNING.terrain.pathStep) {
            return;
        }
        if (path.len+d>max) {
            const f=(max-path.len)/d;
            if (f<=0.05) {
                return;
            }
            q.x=last.x+(q.x-last.x)*f;
            q.z=last.z+(q.z-last.z)*f;
            d=max-path.len;
        }
        path.len+=d;
        pts.push(q);
    }

    cancelTargeting() {
        this.path=null;
        this.stickT=null;
        if (this.targetView) {
            this.targetView=null;
        }
        if (this.press&&this.press.v) {
            this.press.v.state='idle';
        }
        this.press=null;
        this.api.preview.hide();
    }

    keyPlay(i) {
        const v=this.views.find(o=>o.slot===i);
        if (!v||v.state!=='idle') {
            return;
        }
        const m=this.api.mouseScreen();
        if (this.targetView===v&&v.card.def.targeting!=='drawPath') {
            const target=m?this.resolveTarget(v.card,m.x,m.y):this.resolveTarget(v.card);
            this.targetView=null;
            this.api.preview.hide();
            this.tryPlay(v,target);
            return;
        }
        this.cancelTargeting();
        if (v.card.def.targeting!=='none') {
            this.enterTargeting(v);
            return;
        }
        this.tryPlay(v,this.resolveTarget(v.card));
    }

    down(x,y,id,type,button) {
        this.pointer.x=x;
        this.pointer.y=y;
        if (this.targetView) {
            if (button===2) {
                this.cancelTargeting();
                return true;
            }
            const hit=type==='mouse'?null:this.hitCard(x,y);
            if (hit) {
                if (hit===this.targetView) {
                    this.cancelTargeting();
                }
                else {
                    this.enterTargeting(hit);
                }
                return true;
            }
            if (y<this.fieldBottom()&&this.targetView.card.def.targeting==='drawPath') {
                this.path={card:this.targetView.card,pts:[],len:0};
                this.addPathPoint(x,y);
                this.press={id,v:this.targetView,x0:x,y0:y,type,moved:true,pathOnly:true};
                return true;
            }
            if (type!=='mouse') {
                return false;
            }
            if (y<this.fieldBottom()) {
                const v=this.targetView;
                const target=this.resolveTarget(v.card,x,y);
                this.targetView=null;
                this.api.preview.hide();
                this.tryPlay(v,target);
                return true;
            }
            if (type==='mouse') {
                return true;
            }
            this.cancelTargeting();
            return true;
        }
        if (type==='mouse') {
            return false;
        }
        if (this.inRect(this.drawRect,x,y)) {
            this.api.openDeck();
            return true;
        }
        const v=this.hitCard(x,y);
        if (!v||button===2) {
            return false;
        }
        this.press={id,v,x0:x,y0:y,type,moved:false};
        return true;
    }

    move(x,y,id,type) {
        this.pointer.x=x;
        this.pointer.y=y;
        this.pointer.active=true;
        const p=this.press;
        if (!p||p.id!==id) {
            return;
        }
        if (!p.moved&&Math.hypot(x-p.x0,y-p.y0)>C.dragThreshold) {
            p.moved=true;
            p.v.state='drag';
            this.hover=null;
        }
        if (p.moved&&p.v.card.def.targeting==='drawPath'&&y<this.fieldBottom()&&(p.type==='mouse'||p.pathOnly)) {
            if (!this.path) {
                this.path={card:p.v.card,pts:[],len:0};
            }
            this.addPathPoint(x,y);
        }
    }

    hoverAt(x,y,allow=true) {
        this.pointer.x=x;
        this.pointer.y=y;
        this.pointer.active=true;
        if (!allow) {
            this.hover=null;
            return;
        }
        if (this.press||this.targetView) {
            return;
        }
        const v=this.hitCard(x,y);
        this.hover=v&&v.state==='idle'?v:null;
    }

    leave() {
        this.pointer.active=false;
        if (!this.press) {
            this.hover=null;
        }
    }

    up(x,y,id,type) {
        const p=this.press;
        if (!p||p.id!==id) {
            return;
        }
        this.press=null;
        const v=p.v;
        if (p.type!=='mouse'&&!p.pathOnly) {
            this.api.preview.hide();
            if (p.moved) {
                v.state='idle';
                if (this.inRect(this.discardRect,x,y,20)) {
                    this.discardView(v);
                }
                return;
            }
            this.enterTargeting(v);
            return;
        }
        if (v.card.def.targeting==='drawPath'&&p.moved) {
            this.api.preview.hide();
            const path=this.path;
            this.path=null;
            if (p.pathOnly) {
                this.targetView=null;
            }
            if (this.inRect(this.discardRect,x,y,20)&&!p.pathOnly) {
                this.discardView(v);
                return;
            }
            v.state='idle';
            if (path&&path.len>=TUNING.terrain.minPath) {
                this.path=path;
                const target=this.resolveTarget(v.card);
                this.path=null;
                this.tryPlay(v,target);
            }
            return;
        }
        if (p.moved) {
            this.api.preview.hide();
            if (this.inRect(this.discardRect,x,y,20)) {
                this.discardView(v);
                return;
            }
            if (y<this.fieldBottom()) {
                v.state='idle';
                this.tryPlay(v,this.resolveTarget(v.card,x,y));
                return;
            }
            v.state='idle';
            return;
        }
        if (v.card.def.targeting!=='none') {
            this.enterTargeting(v);
            return;
        }
        this.tryPlay(v,this.resolveTarget(v.card));
    }

    stickTarget(card,vx,vy,mag) {
        const api=this.api;
        const p=api.playerPos();
        const tg=card.def.targeting;
        const range=cardRange(card);
        const l=Math.hypot(vx,vy);
        let dx=0;
        let dz=0;
        let dist=0;
        if (l>0.01) {
            dx=vx/l;
            dz=vy/l;
            dist=Math.max(1.2,Math.min(1,mag)*range);
        }
        else {
            const e=api.nearestEnemy(p.x,p.z,range*1.4);
            if (e) {
                const ex=e.x-p.x;
                const ez=e.z-p.z;
                const el=Math.hypot(ex,ez)||1;
                dx=ex/el;
                dz=ez/el;
                dist=Math.min(range,el);
            }
            else {
                const a=api.aimDir();
                dx=a.x;
                dz=a.z;
                dist=Math.min(range,5);
            }
        }
        const out={type:tg,x:p.x+dx*3,z:p.z+dz*3,dx,dz};
        if (tg==='point') {
            out.x=p.x+dx*dist;
            out.z=p.z+dz*dist;
        }
        else if (tg==='drawPath') {
            const d=l>0.01?Math.max(2.2,Math.min(1,mag)*6.5):2.8;
            const cx=p.x+dx*d;
            const cz=p.z+dz*d;
            const half=Math.min(cardParams(card).length||8,7)/2;
            out.points=[];
            for (let i=0;i<=6;i++) {
                const f=(i/6-0.5)*2*half;
                out.points.push({x:cx-dz*f,z:cz+dx*f});
            }
            out.x=out.points[0].x;
            out.z=out.points[0].z;
        }
        return out;
    }

    stickAim(vx,vy,mag,active,touch) {
        const v=this.targetView;
        if (!v||!touch||this.path) {
            this.stickT=null;
            return;
        }
        const on=active&&mag>0;
        this.stickT=this.stickTarget(v.card,on?vx:0,on?vy:0,on?mag:0);
    }

    tooltipAnchor() {
        const v=this.targetView;
        if (!v) {
            return null;
        }
        const y=this.height-CARD_H*this.s*C.restShow-18*this.s-C.targetLift*this.s-40*this.s;
        return {card:v.card,x:v.x,y};
    }

    stickCast(vx,vy,mag,tap) {
        const v=this.targetView;
        this.stickT=null;
        if (!v||v.state!=='idle') {
            return false;
        }
        if (!tap&&mag<=0) {
            return false;
        }
        const target=this.stickTarget(v.card,tap?0:vx,tap?0:vy,mag);
        this.targetView=null;
        this.path=null;
        this.api.preview.hide();
        this.tryPlay(v,target);
        return true;
    }

    updatePreview() {
        const api=this.api;
        if (this.stickT&&this.targetView) {
            const tg=this.stickT;
            if (tg.points) {
                api.preview.showPath(tg.points,this.targetView.card);
            }
            else {
                api.preview.show(this.targetView.card,tg,api.playerPos());
            }
            return;
        }
        if (this.path) {
            api.preview.showPath(this.path.pts,this.path.card);
            return;
        }
        let v=null;
        let sx=0;
        let sy=0;
        if (this.targetView&&this.pointer.active) {
            v=this.targetView;
            sx=this.pointer.x;
            sy=this.pointer.y;
        }
        else if (this.press&&this.press.moved) {
            v=this.press.v;
            sx=this.pointer.x;
            sy=this.pointer.y;
            if (sy>=this.fieldBottom()) {
                v=null;
            }
        }
        if (!v) {
            if (!this.targetView) {
                api.preview.hide();
            }
            return;
        }
        api.preview.show(v.card,this.resolveTarget(v.card,sx,sy),api.playerPos());
    }

    update(dt,frozen=false) {
        const k=1-Math.exp(-C.follow*dt);
        this.slotTargets();
        this.lockMsgT=Math.max(0,this.lockMsgT-dt);
        this.burnMsgT=Math.max(0,this.burnMsgT-dt);
        this.riffleT=Math.max(0,this.riffleT-dt);
        if (this.reshuffling) {
            this.reshuffleT+=dt;
        }
        for (const v of this.views) {
            v.shakeT=Math.max(0,v.shakeT-dt);
            v.flashT=Math.max(0,v.flashT-dt);
            if (v.state==='draw') {
                v.t+=dt;
                const p=Math.min(1,v.t/C.drawDuration);
                const e=EASE.easeOutBack(p);
                v.x=v.fromX+(v.tx-v.fromX)*e;
                v.y=v.fromY+(v.ty-v.fromY)*e-Math.sin(p*Math.PI)*40*this.s;
                v.rot=-0.1+(v.trot+0.1)*e;
                v.scale=0.62+(v.tscale-0.62)*EASE.easeOutQuad(p);
                const fp=Math.max(0,Math.min(1,(p-0.1)/0.45));
                v.sx=Math.max(0.02,Math.abs(Math.cos(fp*Math.PI)));
                v.face=fp>0.5;
                v.skew=Math.sin(fp*Math.PI)*0.28;
                if (p>=1) {
                    v.state='idle';
                    v.sx=1;
                    v.skew=0;
                    v.face=true;
                }
            }
            else if (v.state==='drag') {
                const kk=1-Math.exp(-28*dt);
                const nx=v.x+(this.pointer.x-v.x)*kk;
                v.rot+=(Math.max(-0.35,Math.min(0.35,(nx-v.x)*0.02))-v.rot)*kk;
                v.x=nx;
                v.y+=(this.pointer.y-v.y)*kk;
                const over=this.pointer.y<this.fieldBottom();
                const ts=over?(v.card.def.targeting==='drawPath'?0.35:0.55):0.9;
                v.scale+=(ts-v.scale)*kk;
            }
            else {
                v.x+=(v.tx-v.x)*k;
                v.y+=(v.ty-v.y)*k;
                v.rot+=(v.trot-v.rot)*k;
                v.scale+=(v.tscale-v.scale)*k;
            }
        }
        for (let i=this.flying.length-1;i>=0;i--) {
            const v=this.flying[i];
            if (frozen&&v.state!=='ball'&&v.state!=='crumple') {
                continue;
            }
            v.t+=dt;
            v.flashT=Math.max(0,v.flashT-dt);
            if (v.state==='burn') {
                const p=Math.min(1,v.t/0.7);
                const e=EASE.easeInOutCubic(p);
                const [dx,dy]=this.pileCenter(this.discardRect);
                v.x=v.fromX+(dx-v.fromX)*e;
                v.y=v.fromY+(dy-v.fromY)*e-Math.sin(p*Math.PI)*110*this.s;
                v.scale=0.62+Math.sin(p*Math.PI)*0.3;
                v.rot=Math.sin(p*Math.PI)*0.25;
                const fp=Math.min(1,p/0.35);
                v.sx=Math.max(0.02,Math.abs(Math.cos(fp*Math.PI)));
                v.face=fp>0.5;
                if (p>=1) {
                    this.flying.splice(i,1);
                }
                continue;
            }
            if (v.state==='tear') {
                v.shakeT=0.05;
                if (v.t>=C.tearTime) {
                    v.state='fly';
                    v.t=0;
                    v.fromX=v.x;
                    v.fromY=v.y;
                    v.clip='body';
                    this.stubs.push({card:v.card,x:v.x,y:v.y,rot:v.rot,scale:v.scale,vx:rng.range(-60,60),vy:-rng.range(60,140),vr:rng.range(-4,4),t:0});
                }
            }
            else if (v.state==='fly') {
                const tg=v.target;
                this.api.worldToScreen(tg.x,1.0,tg.z,this._tmp);
                const p=Math.min(1,v.t/C.flyTime);
                const e=EASE.easeInCubic(p);
                v.x=v.fromX+(this._tmp.x-v.fromX)*e;
                v.y=v.fromY+(this._tmp.y-v.fromY)*e-Math.sin(p*Math.PI)*50*this.s;
                v.scale=1-0.55*e;
                v.rot+=dt*4*(v.fromX<this._tmp.x?1:-1);
                if (p>=1) {
                    this.dissolve(v);
                    this.flying.splice(i,1);
                }
            }
            else if (v.state==='crumple') {
                const p=Math.min(1,v.t/0.2);
                v.scale=1-0.55*EASE.easeInQuad(p);
                v.rot+=dt*10;
                v.ball=p;
                if (p>=1) {
                    v.state='ball';
                    v.t=0;
                    v.vx=rng.range(180,320)*(v.x<this.width/2?-1:1)*this.s;
                    v.vy=-rng.range(380,520)*this.s;
                    v.vr=rng.range(-8,8);
                }
            }
            else if (v.state==='ball') {
                v.vy+=1600*this.s*dt;
                v.x+=v.vx*dt;
                v.y+=v.vy*dt;
                v.rot+=v.vr*dt;
                const floor=this.height-14;
                if (v.y>floor&&v.vy>0) {
                    v.y=floor;
                    v.vy*=-0.5;
                    v.vx*=0.85;
                }
                if (v.x<-80||v.x>this.width+80||v.t>3) {
                    this.flying.splice(i,1);
                }
            }
        }
        for (let i=this.stubs.length-1;i>=0;i--) {
            const s=this.stubs[i];
            s.t+=dt;
            s.vy+=900*dt;
            s.x+=s.vx*dt;
            s.y+=s.vy*dt;
            s.rot+=s.vr*dt;
            if (s.t>0.6) {
                this.stubs.splice(i,1);
            }
        }
        for (let i=this.strokes.length-1;i>=0;i--) {
            const s=this.strokes[i];
            s.t+=dt;
            s.x+=s.vx*dt;
            s.y+=s.vy*dt;
            s.vx*=Math.exp(-4*dt);
            s.vy*=Math.exp(-4*dt);
            s.rot+=s.vr*dt;
            if (s.t>=s.life) {
                this.strokes.splice(i,1);
            }
        }
        for (const g of this.ghosts) {
            g.t+=dt;
        }
        this.updatePreview();
    }

    dissolve(v) {
        const n=C.inkStrokes;
        const rare=v.card.def.rarity==='rare';
        for (let i=0;i<n;i++) {
            const a=rng.range(0,Math.PI*2);
            const sp=rng.range(80,260)*this.s;
            this.strokes.push({
                x:v.x+rng.range(-12,12),
                y:v.y+rng.range(-16,16),
                vx:Math.cos(a)*sp,
                vy:Math.sin(a)*sp,
                rot:a,
                vr:rng.range(-6,6),
                shape:STROKES[i%STROKES.length],
                t:0,
                life:C.dissolveTime*rng.range(0.7,1.2),
                color:rare&&i%3===0?PALETTE.red:PALETTE.ink,
                scale:rng.range(0.8,1.4)*this.s
            });
        }
        this.api.execute(v.card,v.target);
    }

    drawCardView(ctx,v,art,variant) {
        const s=this.s;
        let ox=0;
        if (v.shakeT>0) {
            ox=Math.sin(v.shakeT*70)*7*s*(v.shakeT/C.shakeTime);
        }
        ctx.save();
        ctx.translate(v.x+ox,v.y);
        ctx.rotate(v.rot);
        if (v.skew) {
            ctx.transform(1,v.skew*0.5,0,1,0,0);
        }
        ctx.scale(s*v.scale*v.sx,s*v.scale);
        if (v.state==='ball'||(v.state==='crumple'&&v.ball>0.6)) {
            const img=art.ball(variant);
            ctx.drawImage(img,-28,-28,56,56);
            ctx.restore();
            return;
        }
        ctx.translate(-CARD_W/2,-CARD_H/2);
        const lifted=v===this.hover||v===this.targetView||v.state==='drag';
        ctx.fillStyle=rgba('ink',lifted?0.28:0.13);
        const so=lifted?9:4;
        ctx.fillRect(so,so,CARD_W,CARD_H);
        if (v.clip==='body') {
            ctx.save();
            ctx.clip(TEAR.body);
        }
        const img=v.face?art.face(v.card,variant):art.back(variant);
        ctx.drawImage(img,0,0,CARD_W,CARD_H);
        if (v.face) {
            drawCost(ctx,v.card,v.flashT>0&&Math.floor(v.flashT*12)%2===0,variant);
            if (v.card.def.rarity==='rare') {
                this.drawRare(ctx);
            }
            if (this.reshuffling&&this.views.includes(v)) {
                ctx.fillStyle=rgba('midGray',0.4);
                ctx.fillRect(0,0,CARD_W,CARD_H);
            }
            else if (this.views.includes(v)&&!this.api.ink.can(cardCost(v.card))) {
                ctx.fillStyle=rgba('paper',0.35);
                ctx.fillRect(0,0,CARD_W,CARD_H);
            }
        }
        if (v.clip==='body') {
            ctx.restore();
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.4;
            ctx.stroke(TEAR.line);
        }
        if (v.state==='tear'&&v.t>C.tearTime*0.5) {
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.2;
            ctx.setLineDash([3,3]);
            ctx.stroke(TEAR.line);
            ctx.setLineDash([]);
        }
        ctx.restore();
    }

    drawRare(ctx) {
        const q=(time.real*0.55)%2;
        const L=RARE.length;
        ctx.save();
        ctx.strokeStyle=PALETTE.red;
        ctx.lineWidth=2.4;
        ctx.lineCap='round';
        if (q<1) {
            ctx.setLineDash([q*L,L]);
        }
        else {
            const a=(q-1)*L;
            ctx.setLineDash([0,a,L-a,L]);
        }
        ctx.stroke(RARE.path);
        ctx.restore();
    }

    drawPiles(ctx,art,variant) {
        const s=this.s;
        const api=this.api;
        const drawN=api.deck.drawPile.length;
        const discN=api.deck.discardPile.length;
        const d=this.drawRect;
        const [dx,dy]=this.pileCenter(d);
        const sc=0.62*s;
        const riffle=this.riffleT>0?Math.sin(this.riffleT*40)*0.08:0;
        const layers=Math.min(3,drawN);
        for (let i=0;i<layers;i++) {
            ctx.save();
            ctx.translate(dx-i*2.5,dy-i*2.5);
            ctx.rotate(-0.05+i*0.03+riffle*(i%2?1:-1));
            ctx.scale(sc,sc);
            ctx.drawImage(art.back(variant),-CARD_W/2,-CARD_H/2,CARD_W,CARD_H);
            ctx.restore();
        }
        if (drawN===0) {
            drawShape(ctx,sketchRect(d.x,d.y,d.w,d.h,{width:1.4,seed:901}),rgba('ink',0.35),variant);
        }
        const [ex,ey]=this.pileCenter(this.discardRect);
        const r=this.discardRect;
        if (discN>0&&!this.reshuffling) {
            const top=api.deck.discardPile[discN-1];
            ctx.save();
            ctx.translate(ex,ey);
            ctx.rotate(0.06);
            ctx.scale(sc,sc);
            ctx.drawImage(art.face(top,variant),-CARD_W/2,-CARD_H/2,CARD_W,CARD_H);
            ctx.fillStyle=rgba('paper',0.35);
            ctx.fillRect(-CARD_W/2,-CARD_H/2,CARD_W,CARD_H);
            ctx.restore();
        }
        else {
            drawShape(ctx,sketchRect(r.x,r.y,r.w,r.h,{width:1.4,seed:902}),rgba('ink',0.35),variant);
        }
        if (this.press&&this.press.moved) {
            const over=this.inRect(r,this.pointer.x,this.pointer.y,20);
            drawShape(ctx,sketchRect(r.x-8,r.y-8,r.w+16,r.h+16,{width:over?3:1.6,seed:903}),over?PALETTE.ink:rgba('ink',0.5),variant);
        }
        ctx.font='bold '+Math.round(12*s)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='top';
        ctx.fillStyle=PALETTE.ink;
        ctx.fillText(t('deck.draw')+' '+drawN,dx,d.y+d.h+6);
        ctx.fillText(t('deck.discard')+' '+discN,ex,r.y+r.h+6);
        for (const g of this.ghosts) {
            const p=Math.max(0,Math.min(1,(g.t-g.delay)/0.55));
            if (p<=0||p>=1) {
                continue;
            }
            const e=EASE.easeInOutCubic(p);
            ctx.save();
            ctx.translate(g.ax+(g.bx-g.ax)*e,g.ay+(g.by-g.ay)*e-Math.sin(p*Math.PI)*g.h*s);
            ctx.rotate(g.spin*p);
            ctx.scale(sc,sc);
            ctx.drawImage(art.back(variant),-CARD_W/2,-CARD_H/2,CARD_W,CARD_H);
            ctx.restore();
        }
    }

    drawLabels(ctx) {
        const s=this.s;
        const y=this.height-CARD_H*s*C.restShow-18*s;
        ctx.font='bold '+Math.round(16*s)+'px '+FONT;
        ctx.textAlign='center';
        ctx.textBaseline='bottom';
        if (this.reshuffling) {
            const a=0.6+0.4*Math.sin(time.real*8);
            ctx.fillStyle=rgba('ink',a);
            ctx.fillText(t('deck.reshuffle'),this.width/2,y);
        }
        else if (this.lockMsgT>0) {
            ctx.fillStyle=rgba('ink',Math.min(1,this.lockMsgT));
            ctx.fillText(t('deck.locked'),this.width/2,y);
        }
        else if (this.burnMsgT>0) {
            ctx.fillStyle=rgba('ink',Math.min(1,this.burnMsgT));
            ctx.fillText(t('deck.burn'),this.width/2,y);
        }
        else if (this.targetView&&!(this.api.showKeys&&this.api.showKeys())) {
            const txt=t(this.targetView.card.def.targeting==='drawPath'?'hand.touchHintPath':'hand.touchHint');
            ctx.font='bold '+Math.round(14*s)+'px '+FONT;
            const hy=y-C.targetLift*s-8*s;
            const w=ctx.measureText(txt).width+24*s;
            ctx.fillStyle=rgba('paper',0.85);
            ctx.fillRect(this.width/2-w/2,hy-22*s,w,26*s);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(txt,this.width/2,hy);
        }
        else if (this.targetView&&this.api.showKeys&&this.api.showKeys()) {
            const v=this.targetView;
            const hy=y-C.targetLift*s-(C.keycap.size+C.keycap.gap)*s-8*s;
            const key=v.card.def.targeting==='drawPath'?'hand.hintPath':'hand.hint';
            ctx.font='bold '+Math.round(15*s)+'px '+FONT;
            const txt=t(key,{key:v.slot+1});
            const w=ctx.measureText(txt).width+24*s;
            ctx.fillStyle=rgba('paper',0.85);
            ctx.fillRect(this.width/2-w/2,hy-24*s,w,28*s);
            ctx.fillStyle=PALETTE.ink;
            ctx.fillText(txt,this.width/2,hy);
        }
    }

    drawSlots(ctx,variant) {
        const s=this.s;
        const W=CARD_W*s;
        const H=CARD_H*s;
        const restY=this.height-H*C.restShow+H/2;
        const ux=this.slotX(2);
        if (!this.ultView()) {
            ctx.fillStyle=rgba('paper',0.55);
            ctx.fillRect(ux-W/2,restY-H/2,W,H);
            drawShape(ctx,sketchRect(ux-W/2,restY-H/2,W,H,{width:1.6,seed:951}),rgba('red',0.55),variant);
            ctx.fillStyle=rgba('red',0.7);
            ctx.font='bold '+Math.round(15*s)+'px '+FONT;
            ctx.textAlign='center';
            ctx.textBaseline='middle';
            ctx.fillText(t('type.ult'),ux,restY-H*0.18);
        }
        if (!this.api.showKeys||!this.api.showKeys()) {
            return;
        }
        const K=C.keycap;
        for (let i=0;i<3;i++) {
            const v=this.views.find(o=>o.slot===i);
            const lift=v&&v===this.targetView?C.targetLift*s:0;
            const x=this.slotX(i);
            const y=restY-H/2-(K.gap+K.size/2)*s-lift;
            this.drawKeycap(ctx,x,y,String(i+1),v===this.targetView&&!!v,i===2,!v,variant);
        }
        const [dx]=this.pileCenter(this.drawRect);
        const [ex]=this.pileCenter(this.discardRect);
        const py=this.drawRect.y-(K.gap+K.size/2)*s;
        this.drawKeycap(ctx,dx,py,t('key.tab'),false,false,false,variant);
        this.drawKeycap(ctx,ex,py,t('key.q'),!!this.targetView,false,!this.targetView,variant);
    }

    drawKeycap(ctx,x,y,label,active,red,dim,variant) {
        const s=this.s;
        const K=C.keycap;
        ctx.font='bold '+Math.round(K.font*s)+'px '+FONT;
        const w=Math.max(K.size*s,ctx.measureText(label).width+K.pad*2*s);
        const h=K.size*s;
        ctx.save();
        ctx.translate(x,y);
        ctx.globalAlpha=dim?K.dimAlpha:1;
        ctx.fillStyle=rgba('ink',0.25);
        ctx.fillRect(-w/2+3*s,-h/2+4*s,w,h);
        ctx.fillStyle=active?(red?PALETTE.red:PALETTE.ink):PALETTE.paper;
        ctx.fillRect(-w/2,-h/2,w,h);
        ctx.translate(-w/2,-h/2);
        drawShape(ctx,sketchRect(0,0,Math.round(w),Math.round(h),{width:2.2,seed:960}),red?PALETTE.red:PALETTE.ink,variant);
        ctx.translate(w/2,h/2);
        ctx.fillStyle=active?PALETTE.paper:(red?PALETTE.red:PALETTE.ink);
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillText(label,0,1*s);
        ctx.restore();
    }

    draw(ctx,art) {
        const variant=time.boilIndex;
        this.drawPiles(ctx,art,variant);
        this.drawSlots(ctx,variant);
        for (const v of this.drawOrder()) {
            this.drawCardView(ctx,v,art,variant);
        }
        for (const st of this.stubs) {
            const a=Math.max(0,1-st.t/0.6);
            ctx.save();
            ctx.globalAlpha=a;
            ctx.translate(st.x,st.y);
            ctx.rotate(st.rot);
            ctx.scale(this.s*st.scale,this.s*st.scale);
            ctx.translate(-CARD_W/2,-CARD_H/2);
            ctx.clip(TEAR.stub);
            ctx.drawImage(art.face(st.card,variant),0,0,CARD_W,CARD_H);
            ctx.strokeStyle=PALETTE.ink;
            ctx.lineWidth=1.4;
            ctx.stroke(TEAR.line);
            ctx.restore();
        }
        for (const v of this.flying) {
            this.drawCardView(ctx,v,art,variant);
        }
        for (const s of this.strokes) {
            const f=s.t/s.life;
            ctx.save();
            ctx.globalAlpha=Math.max(0,1-f*f);
            ctx.translate(s.x,s.y);
            ctx.rotate(s.rot);
            const sc=s.scale*(1-f*0.5);
            ctx.scale(sc,sc);
            drawShape(ctx,s.shape,s.color,variant);
            ctx.restore();
        }
        this.drawLabels(ctx);
    }
}
