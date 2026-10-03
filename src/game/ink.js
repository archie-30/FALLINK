import {TUNING} from '../data/tuning.js';

export class Ink {
    constructor() {
        this.max=TUNING.ink.max;
        this.value=TUNING.ink.start;
        this.events={onChange:null,onFail:null};
    }

    add(v) {
        const before=this.value;
        if (before>=this.max&&v>0) {
            return;
        }
        this.value=Math.min(this.max,this.value+v);
        if (this.value!==before&&this.events.onChange) {
            this.events.onChange(this.value-before);
        }
    }

    addOver(v) {
        if (this.value>this.max) {
            return 0;
        }
        this.value+=v;
        if (this.events.onChange) {
            this.events.onChange(v);
        }
        return v;
    }

    can(cost) {
        return this.value>=cost;
    }

    spend(cost) {
        if (!this.can(cost)) {
            if (this.events.onFail) {
                this.events.onFail(cost);
            }
            return false;
        }
        this.value-=cost;
        if (this.events.onChange) {
            this.events.onChange(-cost);
        }
        return true;
    }
}
