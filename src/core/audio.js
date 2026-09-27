import {settings} from './settings.js';

const DEFS={
    shoot:{type:'noise',dur:0.05,freq:2400,q:1.2,gain:0.12,gap:0.05},
    hit:{type:'tone',dur:0.07,freq:220,to:120,wave:'triangle',gain:0.22,gap:0.03},
    kill:{type:'noise',dur:0.22,freq:900,q:0.7,gain:0.35,gap:0.05},
    hurt:{type:'tone',dur:0.25,freq:140,to:60,wave:'sawtooth',gain:0.25,gap:0.1},
    card:{type:'noise',dur:0.16,freq:3200,q:0.6,gain:0.18,gap:0.05},
    draw:{type:'noise',dur:0.07,freq:4200,q:0.9,gain:0.08,gap:0.04},
    fail:{type:'tone',dur:0.12,freq:180,to:150,wave:'square',gain:0.1,gap:0.1},
    ui:{type:'tone',dur:0.05,freq:880,to:660,wave:'triangle',gain:0.12,gap:0.03},
    boss:{type:'tone',dur:0.9,freq:70,to:45,wave:'sawtooth',gain:0.3,gap:0.5},
    death:{type:'tone',dur:1.2,freq:220,to:40,wave:'triangle',gain:0.35,gap:1},
    clear:{type:'tone',dur:0.35,freq:520,to:880,wave:'triangle',gain:0.16,gap:0.3},
    page:{type:'noise',dur:0.5,freq:1800,q:0.4,gain:0.2,gap:0.3},
    wall:{type:'noise',dur:0.3,freq:700,q:1.5,gain:0.15,gap:0.1},
    erase:{type:'noise',dur:0.35,freq:1200,q:0.5,gain:0.16,gap:0.1}
};

export const audio={
    ctx:null,
    master:null,
    noise:null,
    last:{},

    unlock() {
        if (this.ctx) {
            if (this.ctx.state==='suspended') {
                this.ctx.resume();
            }
            return;
        }
        const AC=window.AudioContext||window.webkitAudioContext;
        if (!AC) {
            return;
        }
        try {
            this.ctx=new AC();
        }
        catch (e) {
            this.ctx=null;
            return;
        }
        this.master=this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.setVolume(settings.volume);
        const len=this.ctx.sampleRate;
        this.noise=this.ctx.createBuffer(1,len,this.ctx.sampleRate);
        const d=this.noise.getChannelData(0);
        for (let i=0;i<len;i++) {
            d[i]=Math.random()*2-1;
        }
    },

    setVolume(v) {
        if (this.master) {
            this.master.gain.value=v*v*0.8;
        }
    },

    play(name,pitch=1) {
        const c=this.ctx;
        const def=DEFS[name];
        if (!c||!def||c.state!=='running') {
            return;
        }
        const now=c.currentTime;
        if (this.last[name]!==undefined&&now-this.last[name]<def.gap) {
            return;
        }
        this.last[name]=now;
        const g=c.createGain();
        g.gain.setValueAtTime(def.gain,now);
        g.gain.exponentialRampToValueAtTime(0.0001,now+def.dur);
        g.connect(this.master);
        if (def.type==='noise') {
            const src=c.createBufferSource();
            src.buffer=this.noise;
            const f=c.createBiquadFilter();
            f.type='bandpass';
            f.frequency.value=def.freq*pitch;
            f.Q.value=def.q;
            src.connect(f);
            f.connect(g);
            src.start(now,Math.random()*0.5,def.dur+0.02);
            return;
        }
        const o=c.createOscillator();
        o.type=def.wave;
        o.frequency.setValueAtTime(def.freq*pitch,now);
        o.frequency.exponentialRampToValueAtTime(Math.max(20,def.to*pitch),now+def.dur);
        o.connect(g);
        o.start(now);
        o.stop(now+def.dur+0.02);
    }
};
