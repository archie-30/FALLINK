import {rgba} from '../data/palette.js';
import {EASE} from '../core/easing.js';

export class Transition {
    constructor() {
        this.active=false;
        this.t=0;
        this.dur=0.35;
        this.mid=null;
        this.fired=false;
    }

    run(onMid) {
        this.active=true;
        this.t=0;
        this.mid=onMid;
        this.fired=false;
    }

    update(dt) {
        if (!this.active) {
            return;
        }
        this.t+=dt;
        if (!this.fired&&this.t>=this.dur) {
            this.fired=true;
            if (this.mid) {
                this.mid();
            }
        }
        if (this.t>=this.dur*2+0.1) {
            this.active=false;
        }
    }

    draw(ctx,w,h) {
        if (!this.active) {
            return;
        }
        let a;
        if (this.t<this.dur) {
            a=EASE.easeInOutCubic(this.t/this.dur);
        }
        else {
            a=1-EASE.easeInOutCubic(Math.min(1,(this.t-this.dur-0.1)/this.dur));
        }
        ctx.fillStyle=rgba('paper',Math.max(0,Math.min(1,a)));
        ctx.fillRect(0,0,w,h);
    }
}
