import {TUNING} from '../data/tuning.js';

export class Ink {
    constructor() {
        this.max=TUNING.ink.max;
        this.value=TUNING.ink.start;
        this.events={onChange:null,onFail:null};
    }

    add(v) {
        const before=this.value;
        this.value=Math.min(this.max,this.value+v);
        if (this.value!==before&&this.events.onChange) {
            this.events.onChange(this.value-before);
        }
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
