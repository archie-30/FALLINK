import {PALETTE,rgba} from '../data/palette.js';
import {TUNING} from '../data/tuning.js';
import {settings} from '../core/settings.js';

const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';

export class DamageNumbers {
    constructor(cap=48) {
        this.items=[];
        for (let i=0;i<cap;i++) {
            this.items.push({active:false,x:0,y:0,z:0,v:0,t:0,crit:false,ox:0,rot:0,bump:0});
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
                it.bump=1;
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
        it.ox=(Math.random()-0.5)*D.drift;
        it.rot=(Math.random()-0.5)*0.3;
        it.bump=0;
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
                it.bump=Math.max(0,it.bump-dt*6);
                if (it.t>=D.life) {
                    it.active=false;
                }
            }
        }
    }

    draw(ctx,project) {
        const D=TUNING.damageNumbers;
        const calm=settings.reducedMotion;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        for (const it of this.items) {
            if (!it.active) {
                continue;
            }
            project(it.x,it.y,it.z,this.tmp);
            const k=it.t/D.life;
            const big=it.text?0:Math.min(1,Math.max(0,(it.v-D.bigFrom)/D.bigRange));
            const base=it.text?D.size:(it.crit?D.critSize:D.size)*(1+big*D.bigBoost);
            const punch=calm?0:D.punch*Math.exp(-it.t*D.punchDecay)+it.bump*0.35;
            const size=base*(1+punch);
            const up=(1-Math.exp(-it.t*6))*D.rise+(calm?0:Math.max(0,it.t-0.35)*D.fall);
            const x=this.tmp.x+it.ox*(1-Math.exp(-it.t*6));
            const y=this.tmp.y-up;
            const a=k<0.65?1:1-(k-0.65)/0.35;
            const shake=it.crit&&!calm&&it.t<0.2?(Math.random()-0.5)*6*(1-it.t/0.2):0;
            ctx.save();
            ctx.translate(x+shake,y);
            ctx.rotate(calm?0:it.rot*(1-Math.min(1,it.t*3)));
            if ((it.crit||big>0.3)&&!calm&&it.t<D.burstTime) {
                const f=it.t/D.burstTime;
                ctx.strokeStyle=it.crit?rgba('red',1-f):rgba('ink',(1-f)*0.8);
                ctx.lineWidth=3*(1-f)+1;
                for (let i=0;i<8;i++) {
                    const an=i/8*Math.PI*2+it.rot*3;
                    const r0=size*(0.55+f*0.5);
                    const r1=size*(0.8+f*0.9);
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(an)*r0,Math.sin(an)*r0*0.7);
                    ctx.lineTo(Math.cos(an)*r1,Math.sin(an)*r1*0.7);
                    ctx.stroke();
                }
            }
            ctx.font='900 '+Math.round(size)+'px '+FONT;
            const txt=it.text||String(Math.round(it.v))+(it.crit?'!':'');
            ctx.fillStyle=rgba('ink',0.28*a);
            ctx.fillText(txt,2,3);
            ctx.lineWidth=Math.max(4,size*0.22);
            ctx.lineJoin='round';
            ctx.strokeStyle=rgba('paper',a);
            ctx.strokeText(txt,0,0);
            ctx.fillStyle=it.crit?rgba('red',a):(big>0.5?rgba('darkRed',a):rgba('ink',a));
            ctx.fillText(txt,0,0);
            ctx.restore();
        }
    }
}
