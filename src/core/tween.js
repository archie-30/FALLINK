import {getEase} from './easing.js';

function isVec(v) {
    return v&&(v.isVector2||v.isVector3||v.isVector4);
}

function isCol(v) {
    return v&&v.isColor;
}

class Tween {
    constructor(manager,target,to,opts) {
        this.manager=manager;
        this.target=target;
        this.to=to;
        this.duration=Math.max(0.0001,opts.duration??0.3);
        this.delay=opts.delay??0;
        this.ease=getEase(opts.ease??'easeOutQuad');
        this.onStart=opts.onStart||null;
        this.onUpdate=opts.onUpdate||null;
        this.onComplete=opts.onComplete||null;
        this.unscaled=!!opts.unscaled;
        this.elapsed=0;
        this.started=false;
        this.done=false;
        this.from={};
        this.next=[];
    }

    begin() {
        this.started=true;
        for (const key in this.to) {
            const cur=this.target[key];
            if (typeof cur==='number') {
                this.from[key]=cur;
            }
            else if (isVec(cur)||isCol(cur)) {
                this.from[key]=cur.clone();
                if (isCol(cur)&&!isCol(this.to[key])) {
                    this.to[key]=cur.clone().set(this.to[key]);
                }
            }
        }
        if (this.onStart) {
            this.onStart(this);
        }
    }

    apply(k) {
        for (const key in this.from) {
            const a=this.from[key];
            const b=this.to[key];
            if (typeof a==='number') {
                this.target[key]=a+(b-a)*k;
            }
            else if (isCol(a)) {
                this.target[key].copy(a).lerp(b,k);
            }
            else {
                const out=this.target[key];
                out.x=a.x+(b.x-a.x)*k;
                out.y=a.y+(b.y-a.y)*k;
                if (a.z!==undefined) {
                    out.z=a.z+(b.z-a.z)*k;
                }
                if (a.w!==undefined) {
                    out.w=a.w+(b.w-a.w)*k;
                }
            }
        }
    }

    step(dt) {
        if (this.done) {
            return true;
        }
        if (this.delay>0) {
            this.delay-=dt;
            if (this.delay>0) {
                return false;
            }
            dt=-this.delay;
            this.delay=0;
        }
        if (!this.started) {
            this.begin();
        }
        this.elapsed+=dt;
        const t=Math.min(1,this.elapsed/this.duration);
        this.apply(this.ease(t));
        if (this.onUpdate) {
            this.onUpdate(t,this);
        }
        if (t>=1) {
            this.done=true;
            if (this.onComplete) {
                this.onComplete(this);
            }
            for (const n of this.next) {
                this.manager.add(n);
            }
            return true;
        }
        return false;
    }

    then(target,to,opts={}) {
        const n=new Tween(this.manager,target,to,opts);
        this.next.push(n);
        return n;
    }

    wait(seconds,onComplete) {
        return this.then({},{},{duration:seconds,onComplete});
    }

    kill() {
        this.done=true;
        this.next.length=0;
    }
}

export class TweenManager {
    constructor() {
        this.list=[];
    }

    add(t) {
        this.list.push(t);
        return t;
    }

    to(target,to,opts={}) {
        return this.add(new Tween(this,target,to,opts));
    }

    delay(seconds,onComplete) {
        return this.to({},{},{duration:seconds,onComplete});
    }

    killTweensOf(target) {
        for (const t of this.list) {
            if (t.target===target) {
                t.kill();
            }
        }
    }

    update(dt,unscaledDt=dt) {
        let w=0;
        for (let i=0;i<this.list.length;i++) {
            const t=this.list[i];
            if (!t.step(t.unscaled?unscaledDt:dt)) {
                this.list[w++]=t;
            }
        }
        this.list.length=w;
    }
}

export const tweens=new TweenManager();
