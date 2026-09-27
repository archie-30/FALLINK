export class Pool {
    constructor(create,reset,initial=0) {
        this.create=create;
        this.reset=reset||null;
        this.free=[];
        this.active=[];
        for (let i=0;i<initial;i++) {
            this.free.push(create());
        }
    }

    get() {
        const o=this.free.length>0?this.free.pop():this.create();
        this.active.push(o);
        return o;
    }

    release(o) {
        const i=this.active.indexOf(o);
        if (i<0) {
            return;
        }
        this.active[i]=this.active[this.active.length-1];
        this.active.pop();
        if (this.reset) {
            this.reset(o);
        }
        this.free.push(o);
    }

    releaseAll() {
        while (this.active.length>0) {
            this.release(this.active[this.active.length-1]);
        }
    }
}
