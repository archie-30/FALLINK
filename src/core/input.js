import {TUNING} from '../data/tuning.js';

function makeStick() {
    return {id:-1,ox:0,oy:0,x:0,y:0,vx:0,vy:0,mag:0};
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
        this.dashQueued=false;
        this.touches=new Map();
        this.multiTapArmed=true;
        this.onToggleDebug=null;
        this.onCycleQuality=null;
        this.onFirstTouch=null;
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
            }
        });
        el.addEventListener('contextmenu',e=>e.preventDefault());
        window.addEventListener('keydown',e=>this.keyDown(e));
        window.addEventListener('keyup',e=>this.keys.delete(e.code));
        window.addEventListener('blur',()=>this.clear());
        document.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
        document.addEventListener('gesturestart',e=>e.preventDefault());
        document.addEventListener('dblclick',e=>e.preventDefault());
    }

    resize(w,h) {
        this.width=w;
        this.height=h;
        const o=TUNING.input.dashButtonOffset;
        this.dash.x=w-o[0];
        this.dash.y=h-o[1];
    }

    clear() {
        this.keys.clear();
        this.mouse.down=false;
        this.releaseStick(this.move);
        this.releaseStick(this.aim);
        this.dash.id=-1;
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
        if (this.lastDevice!=='touch'&&this.onFirstTouch) {
            this.onFirstTouch();
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
        if (x<this.width*0.5) {
            if (this.move.id<0) {
                this.startStick(this.move,e.pointerId,x,y);
            }
        }
        else if (this.aim.id<0) {
            this.startStick(this.aim,e.pointerId,x,y);
        }
    }

    pointerMove(e) {
        const [x,y]=this.local(e);
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
    }

    pointerUp(e) {
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
            this.releaseStick(this.aim);
        }
        if (e.pointerId===this.dash.id) {
            this.dash.id=-1;
        }
    }

    startStick(s,id,x,y) {
        s.id=id;
        s.ox=x;
        s.oy=y;
        s.x=x;
        s.y=y;
        s.vx=0;
        s.vy=0;
        s.mag=0;
    }

    dragStick(s,x,y) {
        const R=TUNING.input.stickRadius;
        let dx=x-s.ox;
        let dy=y-s.oy;
        let d=Math.hypot(dx,dy);
        if (d>R) {
            s.ox+=dx*(1-R/d);
            s.oy+=dy*(1-R/d);
            dx=x-s.ox;
            dy=y-s.oy;
            d=R;
        }
        s.x=x;
        s.y=y;
        const m=d/R;
        s.mag=m<TUNING.input.deadZone?0:(m-TUNING.input.deadZone)/(1-TUNING.input.deadZone);
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
        if (this.aim.id>=0&&this.aim.mag>0) {
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
            return true;
        }
        return this.lastDevice==='mouse'&&this.mouse.down;
    }

    consumeDash() {
        const q=this.dashQueued;
        this.dashQueued=false;
        return q;
    }
}
