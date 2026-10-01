import {TUNING} from '../data/tuning.js';
import {settings} from './settings.js';

function makeSkill(slot) {
    return {slot,x:0,y:0,r:30,id:-1,ox:0,oy:0,vx:0,vy:0,mag:0,moved:false,flash:0};
}

export function fireRing() {
    const F=TUNING.input.fireRingRange;
    return F[0]+(F[1]-F[0])*settings.aimRing;
}

function makeStick() {
    return {id:-1,cx:0,cy:0,r:70,ox:0,oy:0,x:0,y:0,vx:0,vy:0,mag:0,maxMag:0,t0:0};
}

export class Input {
    constructor(el) {
        this.el=el;
        this.width=1;
        this.height=1;
        this.keys=new Set();
        this.mouse={x:0,y:0,down:false,inside:false};
        this.lastDevice='mouse';
        this.move=makeStick();
        this.aim=makeStick();
        this.dash={x:0,y:0,r:TUNING.input.dashButtonRadius,id:-1,flash:0};
        this.skills=[makeSkill(0),makeSkill(1),makeSkill(2)];
        this.onSkill=null;
        this.dashQueued=false;
        this.reloadQueued=false;
        this.touches=new Map();
        this.multiTapArmed=true;
        this.onToggleDebug=null;
        this.onCycleQuality=null;
        this.onFirstTouch=null;
        this.onCardKey=null;
        this.onDeckKey=null;
        this.onEscape=null;
        this.onPauseKey=null;
        this.onWheel=null;
        this.onAimRelease=null;
        this.canStick=null;
        this.aimForCard=false;
        this.ui=null;
        this.uiScale=1;
        this.uiPointers=new Set();
        this.bind();
    }

    bind() {
        const el=this.el;
        el.addEventListener('pointerdown',e=>this.pointerDown(e));
        el.addEventListener('pointermove',e=>this.pointerMove(e));
        el.addEventListener('pointerup',e=>this.pointerUp(e));
        el.addEventListener('pointercancel',e=>this.pointerUp(e));
        el.addEventListener('pointerleave',e=>{
            if (e.pointerType==='mouse') {
                this.mouse.inside=false;
                if (this.ui) {
                    this.ui.leave();
                }
            }
        });
        el.addEventListener('contextmenu',e=>e.preventDefault());
        el.addEventListener('wheel',e=>{
            e.preventDefault();
            if (this.onWheel) {
                this.onWheel(e.deltaMode===1?e.deltaY*TUNING.codex.wheelLine:e.deltaY);
            }
        },{passive:false});
        window.addEventListener('keydown',e=>this.keyDown(e));
        window.addEventListener('keyup',e=>this.keys.delete(e.code));
        window.addEventListener('blur',()=>this.clear());
        document.addEventListener('touchmove',e=>{
            if (e.cancelable) {
                e.preventDefault();
            }
        },{passive:false});
        document.addEventListener('gesturestart',e=>e.preventDefault());
        document.addEventListener('dblclick',e=>e.preventDefault());
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
        const I=TUNING.input;
        const S=settings;
        const r=Math.max(I.stickMin,Math.min(I.stickMax,h*I.stickScale))*(I.stickSizeRange[0]+(I.stickSizeRange[1]-I.stickSizeRange[0])*S.stickSize);
        const padX=I.stickXRange[0]+(w*I.stickXRange[1]-I.stickXRange[0])*S.stickX;
        const padY=I.stickYRange[0]+(h*I.stickYRange[1]-I.stickYRange[0])*S.stickY;
        for (const s of [this.move,this.aim]) {
            s.r=r;
            s.cy=h-padY-r;
        }
        this.move.cx=padX+r;
        this.aim.cx=w-padX-r;
        for (const s of [this.move,this.aim]) {
            if (s.id<0) {
                s.ox=s.cx;
                s.oy=s.cy;
            }
        }
        const K=I.skill;
        const sr=r*K.scale*(K.sizeRange[0]+(K.sizeRange[1]-K.sizeRange[0])*S.skillSize);
        const ring=r+K.gap+sr;
        this.dash.r=sr*K.dashMul;
        this.dash.x=this.aim.cx+Math.cos(K.angles[0])*ring;
        this.dash.y=this.aim.cy+Math.sin(K.angles[0])*ring;
        for (const k of this.skills) {
            const big=k.slot===2?K.ultMul:1;
            k.r=sr*big;
            const rr=r+K.gap+k.r;
            k.x=this.aim.cx+Math.cos(K.angles[k.slot+1])*rr;
            k.y=this.aim.cy+Math.sin(K.angles[k.slot+1])*rr;
        }
    }

    stickAt(x,y) {
        for (const s of [this.move,this.aim]) {
            if (s.id<0&&Math.hypot(x-s.cx,y-s.cy)<=s.r*TUNING.input.stickGrab) {
                return s;
            }
        }
        return null;
    }

    clear() {
        this.keys.clear();
        this.mouse.down=false;
        this.uiPointers.clear();
        this.releaseStick(this.move);
        this.releaseStick(this.aim);
        this.dash.id=-1;
        for (const k of this.skills) {
            this.releaseSkill(k);
        }
        this.touches.clear();
    }

    keyDown(e) {
        if (e.code==='F3') {
            e.preventDefault();
            if (this.onToggleDebug) {
                this.onToggleDebug();
            }
            return;
        }
        if (e.code==='F2') {
            e.preventDefault();
            if (this.onCycleQuality) {
                this.onCycleQuality();
            }
            return;
        }
        if (e.code==='Tab') {
            e.preventDefault();
            if (!e.repeat&&this.onDeckKey) {
                this.onDeckKey();
            }
            return;
        }
        if (e.code==='Escape') {
            if (this.onEscape) {
                this.onEscape();
            }
            return;
        }
        const dm=/^Digit([1-4])$/.exec(e.code);
        if (dm&&!e.repeat) {
            if (this.onCardKey) {
                this.onCardKey(Number(dm[1])-1);
            }
            return;
        }
        if (e.code==='KeyP'&&!e.repeat) {
            if (this.onPauseKey) {
                this.onPauseKey();
            }
            return;
        }
        if (e.code==='KeyR'&&!e.repeat) {
            this.reloadQueued=true;
        }
        if (e.code==='Space') {
            e.preventDefault();
            if (!e.repeat) {
                this.dashQueued=true;
            }
        }
        this.keys.add(e.code);
    }

    local(e) {
        const r=this.el.getBoundingClientRect();
        return [e.clientX-r.left,e.clientY-r.top];
    }

    pointerDown(e) {
        e.preventDefault();
        const [x,y]=this.local(e);
        try {
            this.el.setPointerCapture(e.pointerId);
        }
        catch (err) {
        }
        if (e.pointerType==='mouse') {
            this.mouse.x=x;
            this.mouse.y=y;
            this.mouse.inside=true;
            this.lastDevice='mouse';
        }
        else if (this.lastDevice!=='touch'&&this.onFirstTouch) {
            this.onFirstTouch();
        }
        if (e.pointerType!=='mouse'&&this.canStick&&this.canStick()) {
            const sk=this.skillAt(x,y);
            if (sk) {
                this.lastDevice='touch';
                this.touches.set(e.pointerId,{x,y,t:performance.now()});
                sk.id=e.pointerId;
                sk.ox=x;
                sk.oy=y;
                sk.moved=false;
                sk.flash=1;
                if (this.onSkill) {
                    this.onSkill('down',sk.slot);
                }
                return;
            }
            const d=this.dash;
            const st=this.stickAt(x,y);
            const onDash=d.id<0&&Math.hypot(x-d.x,y-d.y)<=d.r*1.2;
            if (st||onDash) {
                this.lastDevice='touch';
                this.touches.set(e.pointerId,{x,y,t:performance.now()});
                if (onDash&&(!st||Math.hypot(x-d.x,y-d.y)<Math.hypot(x-st.cx,y-st.cy))) {
                    d.id=e.pointerId;
                    d.flash=1;
                    this.dashQueued=true;
                    return;
                }
                this.startStick(st,e.pointerId,x,y);
                return;
            }
        }
        if (this.ui&&this.ui.down(x/this.uiScale,y/this.uiScale,e.pointerId,e.pointerType,e.button)) {
            this.uiPointers.add(e.pointerId);
            if (e.pointerType!=='mouse') {
                this.lastDevice='touch';
            }
            return;
        }
        if (e.pointerType==='mouse') {
            this.lastDevice='mouse';
            this.mouse.x=x;
            this.mouse.y=y;
            this.mouse.inside=true;
            if (e.button===0) {
                this.mouse.down=true;
            }
            if (e.button===2) {
                this.dashQueued=true;
            }
            return;
        }
        this.lastDevice='touch';
        this.touches.set(e.pointerId,{x,y,t:performance.now()});
        if (this.touches.size>=3&&this.multiTapArmed) {
            this.multiTapArmed=false;
            if (this.onToggleDebug) {
                this.onToggleDebug();
            }
        }
        const d=this.dash;
        if (d.id<0&&Math.hypot(x-d.x,y-d.y)<=d.r*1.25) {
            d.id=e.pointerId;
            d.flash=1;
            this.dashQueued=true;
            return;
        }
        const st=this.stickAt(x,y);
        if (st) {
            this.startStick(st,e.pointerId,x,y);
        }
    }

    pointerMove(e) {
        const [x,y]=this.local(e);
        if (this.uiPointers.has(e.pointerId)) {
            if (e.pointerType==='mouse') {
                this.mouse.x=x;
                this.mouse.y=y;
            }
            this.ui.move(x/this.uiScale,y/this.uiScale,e.pointerId,e.pointerType);
            return;
        }
        if (e.pointerType==='mouse'&&this.ui) {
            this.ui.hover(x/this.uiScale,y/this.uiScale);
        }
        if (e.pointerType==='mouse') {
            if (this.lastDevice!=='mouse'&&Math.hypot(x-this.mouse.x,y-this.mouse.y)<2) {
                return;
            }
            this.lastDevice='mouse';
            this.mouse.x=x;
            this.mouse.y=y;
            this.mouse.inside=true;
            return;
        }
        const tt=this.touches.get(e.pointerId);
        if (tt) {
            tt.x=x;
            tt.y=y;
        }
        if (e.pointerId===this.move.id) {
            this.dragStick(this.move,x,y);
        }
        else if (e.pointerId===this.aim.id) {
            this.dragStick(this.aim,x,y);
        }
        for (const k of this.skills) {
            if (k.id===e.pointerId) {
                this.dragSkill(k,x,y);
            }
        }
    }

    skillAt(x,y) {
        for (const k of this.skills) {
            if (k.id<0&&Math.hypot(x-k.x,y-k.y)<=k.r*TUNING.input.skill.grab) {
                return k;
            }
        }
        return null;
    }

    dragSkill(k,x,y) {
        const K=TUNING.input.skill;
        const R=this.aim.r*K.dragRadius;
        let dx=x-k.ox;
        let dy=y-k.oy;
        const d=Math.hypot(dx,dy);
        if (d>K.moveSlop) {
            k.moved=true;
        }
        const m=Math.min(1,d/R);
        k.mag=k.moved?Math.max(0.05,m):0;
        if (d>1e-4) {
            k.vx=dx/d*k.mag;
            k.vy=dy/d*k.mag;
        }
    }

    releaseSkill(k) {
        k.id=-1;
        k.vx=0;
        k.vy=0;
        k.mag=0;
        k.moved=false;
    }

    skillDrag() {
        for (const k of this.skills) {
            if (k.id>=0&&k.moved) {
                return k;
            }
        }
        return null;
    }

    pointerUp(e) {
        if (this.uiPointers.has(e.pointerId)) {
            this.uiPointers.delete(e.pointerId);
            const [x,y]=this.local(e);
            this.ui.up(x/this.uiScale,y/this.uiScale,e.pointerId,e.pointerType,e.button);
            return;
        }
        if (e.pointerType==='mouse') {
            if (e.button===0||e.type==='pointercancel') {
                this.mouse.down=false;
            }
            return;
        }
        this.touches.delete(e.pointerId);
        if (this.touches.size===0) {
            this.multiTapArmed=true;
        }
        if (e.pointerId===this.move.id) {
            this.releaseStick(this.move);
        }
        if (e.pointerId===this.aim.id) {
            const a=this.aim;
            if (this.onAimRelease) {
                this.onAimRelease(a.vx,a.vy,a.mag,a.maxMag<=0&&performance.now()-a.t0<TUNING.input.tapTime);
            }
            this.releaseStick(a);
        }
        if (e.pointerId===this.dash.id) {
            this.dash.id=-1;
        }
        for (const k of this.skills) {
            if (k.id===e.pointerId) {
                if (this.onSkill) {
                    this.onSkill('up',k.slot,k.vx,k.vy,k.mag,k.moved);
                }
                this.releaseSkill(k);
            }
        }
    }

    startStick(s,id,x,y) {
        s.id=id;
        s.ox=s.cx;
        s.oy=s.cy;
        s.maxMag=0;
        s.t0=performance.now();
        this.dragStick(s,x,y);
    }

    dragStick(s,x,y) {
        const R=s.r;
        let dx=x-s.ox;
        let dy=y-s.oy;
        let d=Math.hypot(dx,dy);
        if (d>R) {
            dx*=R/d;
            dy*=R/d;
            d=R;
        }
        s.x=s.ox+dx;
        s.y=s.oy+dy;
        const m=d/R;
        s.raw=m;
        s.mag=m<TUNING.input.deadZone?0:(m-TUNING.input.deadZone)/(1-TUNING.input.deadZone);
        s.maxMag=Math.max(s.maxMag,s.mag);
        if (d>1e-4) {
            s.vx=dx/d*s.mag;
            s.vy=dy/d*s.mag;
        }
        else {
            s.vx=0;
            s.vy=0;
        }
    }

    releaseStick(s) {
        s.id=-1;
        s.x=s.cx;
        s.y=s.cy;
        s.vx=0;
        s.vy=0;
        s.mag=0;
    }

    getMove(out) {
        const k=this.keys;
        let x=0;
        let z=0;
        if (k.has('KeyD')||k.has('ArrowRight')) {
            x+=1;
        }
        if (k.has('KeyA')||k.has('ArrowLeft')) {
            x-=1;
        }
        if (k.has('KeyS')||k.has('ArrowDown')) {
            z+=1;
        }
        if (k.has('KeyW')||k.has('ArrowUp')) {
            z-=1;
        }
        if (this.move.id>=0) {
            x+=this.move.vx;
            z+=this.move.vy;
        }
        const l=Math.hypot(x,z);
        if (l>1) {
            x/=l;
            z/=l;
        }
        out.x=x;
        out.z=z;
        return out;
    }

    getAim(out) {
        if (this.aim.id>=0&&this.aim.mag>0&&!this.aimForCard) {
            out.mode='dir';
            const l=Math.hypot(this.aim.vx,this.aim.vy);
            out.dx=this.aim.vx/l;
            out.dz=this.aim.vy/l;
            return out;
        }
        if (this.lastDevice==='mouse'&&this.mouse.inside) {
            out.mode='point';
            out.sx=this.mouse.x;
            out.sy=this.mouse.y;
            return out;
        }
        out.mode='none';
        return out;
    }

    isFiring() {
        if (this.aim.id>=0&&this.aim.mag>0) {
            return !this.aimForCard&&(this.aim.raw||0)>=fireRing();
        }
        return this.lastDevice==='mouse'&&this.mouse.down;
    }

    consumeReload() {
        const q=this.reloadQueued;
        this.reloadQueued=false;
        return q;
    }

    consumeDash() {
        const q=this.dashQueued;
        this.dashQueued=false;
        return q;
    }
}
