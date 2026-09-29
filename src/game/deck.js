import {TUNING} from '../data/tuning.js';
import {createCard} from './card.js';
import {isUlt} from '../data/cards.js';
import {RNG} from '../core/rng.js';

export class Deck {
    constructor(ids,seed=7) {
        this.rng=new RNG(seed);
        this.drawPile=ids.map(id=>createCard(id));
        this.shuffle(this.drawPile);
        this.hand=[];
        this.discardPile=[];
        this.timers=[];
        this.locked=false;
        this.reshuffleT=0;
        this.provider=null;
        this.events={onDraw:null,onBurn:null,onReshuffleStart:null,onReshuffleEnd:null};
    }

    reset(list) {
        this.drawPile=this.shuffle(list.map(c=>createCard(c.id,c.upgraded)));
        this.hand=[];
        this.discardPile=[];
        this.timers=[];
        this.locked=false;
        this.reshuffleT=0;
    }

    shuffle(a) {
        for (let i=a.length-1;i>0;i--) {
            const j=Math.floor(this.rng.next()*(i+1));
            const tmp=a[i];
            a[i]=a[j];
            a[j]=tmp;
        }
        return a;
    }

    start() {
        const D=TUNING.deck;
        for (let i=0;i<D.handSize;i++) {
            this.requestDraw(0.3+i*D.startStagger);
        }
    }

    normalCount() {
        let n=0;
        for (const c of this.hand) {
            if (!isUlt(c.id)) {
                n++;
            }
        }
        return n;
    }

    ultCard() {
        return this.hand.find(c=>isUlt(c.id))||null;
    }

    hasNormalLeft() {
        return this.drawPile.some(c=>!isUlt(c.id))||this.discardPile.some(c=>!isUlt(c.id));
    }

    requestDraw(delay) {
        this.timers.push(delay);
        this.timers.sort((a,b)=>a-b);
    }

    pendingDraws() {
        return this.timers.length;
    }

    canPlay() {
        return !this.locked;
    }

    remove(card) {
        const i=this.hand.indexOf(card);
        if (i<0) {
            return false;
        }
        this.hand.splice(i,1);
        this.discardPile.push(card);
        if (!isUlt(card.id)||this.provider) {
            this.requestDraw(TUNING.deck.replaceDelay);
        }
        return true;
    }

    play(card) {
        return this.remove(card);
    }

    discard(card) {
        return this.remove(card);
    }

    startReshuffle() {
        this.locked=true;
        this.reshuffleT=TUNING.deck.reshuffleTime;
        if (this.events.onReshuffleStart) {
            this.events.onReshuffleStart(this.discardPile.length);
        }
    }

    finishReshuffle() {
        this.drawPile=this.shuffle(this.discardPile.splice(0));
        this.locked=false;
        if (this.events.onReshuffleEnd) {
            this.events.onReshuffleEnd();
        }
    }

    drawOne() {
        const card=this.drawPile.pop();
        if (isUlt(card.id)) {
            if (!this.ultCard()) {
                this.hand.push(card);
                if (this.events.onDraw) {
                    this.events.onDraw(card);
                }
            }
            else {
                this.discardPile.push(card);
                if (this.events.onBurn) {
                    this.events.onBurn(card);
                }
            }
            return false;
        }
        this.hand.push(card);
        if (this.events.onDraw) {
            this.events.onDraw(card);
        }
        return true;
    }

    update(dt) {
        if (this.locked) {
            this.reshuffleT-=dt;
            if (this.reshuffleT<=0) {
                this.finishReshuffle();
            }
            return;
        }
        for (let i=0;i<this.timers.length;i++) {
            this.timers[i]-=dt;
        }
        let guard=0;
        while (this.timers.length>0&&this.timers[0]<=0&&guard<40) {
            guard++;
            const forced=this.provider?this.provider():null;
            if (forced) {
                this.timers.shift();
                this.hand.push(forced);
                if (this.events.onDraw) {
                    this.events.onDraw(forced);
                }
                continue;
            }
            if (this.normalCount()>=TUNING.deck.handSize||!this.hasNormalLeft()) {
                this.timers.shift();
                continue;
            }
            if (this.drawPile.length===0) {
                this.startReshuffle();
                return;
            }
            if (this.drawOne()) {
                this.timers.shift();
            }
            else {
                this.timers[0]=Math.max(this.timers[0],-0.001)+TUNING.deck.burnDelay;
                return;
            }
        }
    }
}
