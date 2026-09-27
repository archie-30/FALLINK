export class RNG {
    constructor(seed=1) {
        this.s=seed>>>0;
    }

    next() {
        this.s=(this.s+0x6D2B79F5)>>>0;
        let t=this.s;
        t=Math.imul(t^(t>>>15),t|1);
        t^=t+Math.imul(t^(t>>>7),t|61);
        return ((t^(t>>>14))>>>0)/4294967296;
    }

    range(a,b) {
        return a+(b-a)*this.next();
    }

    int(a,b) {
        return a+Math.floor(this.next()*(b-a+1));
    }

    sign() {
        return this.next()<0.5?-1:1;
    }

    pick(arr) {
        return arr[Math.floor(this.next()*arr.length)];
    }
}

export function hash1(n) {
    let x=Math.imul((n|0)^0x27d4eb2d,0x165667b1);
    x^=x>>>15;
    x=Math.imul(x,0x85ebca6b);
    x^=x>>>13;
    return (x>>>0)/4294967296;
}

export function noise1(x,seed=0) {
    const i=Math.floor(x);
    const f=x-i;
    const u=f*f*(3-2*f);
    const a=hash1(i+seed*1013)*2-1;
    const b=hash1(i+1+seed*1013)*2-1;
    return a+(b-a)*u;
}

export const rng=new RNG(20240917);
