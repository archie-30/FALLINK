import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {EASE} from '../core/easing.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export class DamageNumbers {
    constructor(cap=48) {
        this.items=[];
        for (let i=0;i<cap;i++) {
            this.items.push({active:false,x:0,y:0,z:0,v:0,t:0,crit:false,ox:0,rot:0});
        }
        this.next=0;
        this.tmp={x:0,y:0};
    }

    spawnText(x,y,z,text) {
        const it=this.items[this.next];
        this.next=(this.next+1)%this.items.length;
        it.active=true;
        it.x=x;
        it.y=y;
        it.z=z;
        it.v=0;
        it.text=text;
        it.t=0;
        it.crit=false;
        it.ox=0;
        it.rot=0;
    }

    spawn(x,y,z,value,crit) {
        const D=TUNING.damageNumbers;
        for (const it of this.items) {
            if (it.active&&!it.text&&it.t<D.mergeTime&&Math.abs(it.x-x)<0.9&&Math.abs(it.z-z)<0.9&&it.crit===crit) {
                it.v+=value;
                it.t=Math.min(it.t,0.05);
                return;
            }
        }
        const it=this.items[this.next];
        this.next=(this.next+1)%this.items.length;
        it.active=true;
        it.x=x;
        it.y=y;
        it.z=z;
        it.v=value;
        it.t=0;
        it.crit=crit;
        it.text=null;
        it.ox=(Math.random()-0.5)*24;
        it.rot=(Math.random()-0.5)*0.25;
    }

    clear() {
        for (const it of this.items) {
            it.active=false;
        }
    }

    update(dt) {
        const D=TUNING.damageNumbers;
        for (const it of this.items) {
            if (it.active) {
                it.t+=dt;
                if (it.t>=D.life) {
                    it.active=false;
                }
            }
        }
    }

    draw(ctx,project) {
        const D=TUNING.damageNumbers;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            project(it.x,it.y,it.z,this.tmp);
            const k=it.t/D.life;
            const pop=EASE.easeOutBack(Math.min(1,it.t/0.18));
            const size=it.text?D.size*(0.6+0.4*pop):(it.crit?D.critSize:D.size)*(0.6+0.4*pop)*(1+Math.min(1.2,Math.log10(Math.max(1,it.v))*0.18));
            const y=this.tmp.y-it.t*D.rise-EASE.easeOutQuad(Math.min(1,it.t/0.3))*16;
            const a=k<0.7?1:1-(k-0.7)/0.3;
            ctx.save();
            ctx.translate(this.tmp.x+it.ox,y);
            ctx.rotate(it.rot);
            ctx.font='bold '+Math.round(size)+'px '+FONT;
            const txt=it.text||String(Math.round(it.v));
            ctx.lineWidth=4;
            ctx.strokeStyle=rgba('paper',a*0.9);
            ctx.strokeText(txt,0,0);
            ctx.fillStyle=it.crit?rgba('red',a):rgba('ink',a);
            ctx.fillText(txt,0,0);
            ctx.restore();
        }
    }
}
