import {MUSIC} from '../data/music.js';
import {RNG} from './rng.js';

function midi(n) {
    return 440*Math.pow(2,(n-69)/12);
}

function pitchOf(tr,deg,oct) {
    const S=MUSIC.scales[tr.scale];
    const n=S.length;
    const o=Math.floor(deg/n);
    return midi(tr.root+S[deg-o*n]+12*(o+oct));
}

function compose(tr) {
    const rng=new RNG(tr.seed);
    const L=tr.lead;
    const C=MUSIC.compose;
    const phrase=()=>tr.prog.map(deg=>{
        const notes=[];
        let pos=0;
        let cur=deg;
        while (pos<16) {
            const strong=pos%4===0;
            if (rng.next()<L.density+(strong?C.strong:0)&&rng.next()>L.rest) {
                const len=Math.min(rng.pick(L.len),16-pos);
                cur=strong?deg+rng.pick([0,2,4]):cur+rng.int(-C.leap,C.leap);
                cur=Math.max(deg+C.low,Math.min(deg+C.high,cur));
                notes.push({step:pos,deg:cur,len});
                pos+=len;
            }
            else {
                pos++;
            }
        }
        return notes;
    });
    return {a:phrase(),b:phrase()};
}

export const music={
    ctx:null,
    out:null,
    noise:null,
    cur:null,
    ducked:false,
    songs:{},

    init(ctx,out,noise) {
        this.ctx=ctx;
        this.noise=noise;
        this.out=ctx.createGain();
        this.filter=ctx.createBiquadFilter();
        this.filter.type='lowpass';
        this.filter.frequency.value=MUSIC.death.open;
        this.out.connect(this.filter);
        this.filter.connect(out);
        for (const k in MUSIC.tracks) {
            this.songs[k]=compose(MUSIC.tracks[k]);
        }
    },

    death() {
        const c=this.ctx;
        if (!c||this.halted) {
            return;
        }
        const D=MUSIC.death;
        const now=c.currentTime;
        this.halted=true;
        const f=this.filter.frequency;
        f.cancelScheduledValues(now);
        f.setValueAtTime(f.value,now);
        f.exponentialRampToValueAtTime(D.cut,now+D.time);
        this.filter.Q.setTargetAtTime(D.q,now,D.time/3);
        const g=this.out.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value,now);
        g.linearRampToValueAtTime(D.gain,now+D.time);
    },

    recover() {
        const c=this.ctx;
        if (!c||!this.halted) {
            return;
        }
        const D=MUSIC.death;
        const now=c.currentTime;
        this.halted=false;
        const f=this.filter.frequency;
        f.cancelScheduledValues(now);
        f.setValueAtTime(f.value,now);
        f.exponentialRampToValueAtTime(D.open,now+D.back);
        this.filter.Q.setTargetAtTime(MUSIC.voices.pad.q,now,D.back/3);
        const g=this.out.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value,now);
        g.linearRampToValueAtTime(this.ducked?MUSIC.duck:1,now+D.back);
    },

    setDuck(on) {
        if (!this.ctx||this.ducked===on) {
            return;
        }
        this.ducked=on;
        this.out.gain.setTargetAtTime(on?MUSIC.duck:1,this.ctx.currentTime,MUSIC.duckTime);
    },

    update(name) {
        const c=this.ctx;
        if (!c||c.state!=='running'||!MUSIC.tracks[name]) {
            return;
        }
        if (!this.cur||this.cur.name!==name) {
            this.recover();
            this.switchTo(name);
        }
        if (this.halted) {
            return;
        }
        const p=this.cur;
        const st=60/p.tr.bpm/4;
        if (p.next<c.currentTime) {
            p.next=c.currentTime+MUSIC.compose.start;
        }
        while (p.next<c.currentTime+MUSIC.lookahead) {
            this.step(p,p.step,p.next,st);
            p.step++;
            p.next+=st;
        }
    },

    switchTo(name) {
        const c=this.ctx;
        const now=c.currentTime;
        if (this.cur) {
            const g=this.cur.gain;
            g.gain.cancelScheduledValues(now);
            g.gain.setValueAtTime(g.gain.value,now);
            g.gain.linearRampToValueAtTime(0,now+MUSIC.fade);
            setTimeout(()=>g.disconnect(),(MUSIC.fade+MUSIC.lookahead+MUSIC.compose.cleanup)*1000);
        }
        const gain=c.createGain();
        gain.gain.setValueAtTime(0,now);
        gain.gain.linearRampToValueAtTime(MUSIC.gain,now+MUSIC.fade);
        gain.connect(this.out);
        this.cur={name,tr:MUSIC.tracks[name],song:this.songs[name],gain,step:0,next:now+MUSIC.compose.start};
    },

    step(p,i,t,st) {
        const tr=p.tr;
        const V=MUSIC.voices;
        const C=MUSIC.compose;
        const s=i%16;
        const bar=Math.floor(i/16);
        const n=tr.prog.length;
        const ci=bar%n;
        const deg=tr.prog[ci];
        const sec=MUSIC.form[Math.floor(bar/n)%MUSIC.form.length];
        const out=p.gain;
        if (s===0) {
            for (const k of [0,2,4]) {
                for (const d of [-1,1]) {
                    this.tone(pitchOf(tr,deg+k,tr.pad.oct),t,st*16,V.pad,tr.pad.wave,tr.pad.gain/2,tr.pad.cut,out,d*V.pad.detune);
                }
            }
        }
        if (tr.bass.pattern[s]==='x') {
            this.tone(pitchOf(tr,deg,tr.bass.oct),t,st*V.mix.bassLen,V.bass,tr.bass.wave,tr.bass.gain,tr.bass.cut,out,0);
        }
        if (tr.arp.pattern[s]==='x') {
            const k=C.tones[tr.arp.order[s%tr.arp.order.length]];
            this.tone(pitchOf(tr,deg+k,tr.arp.oct),t,st*V.mix.arpLen,V.arp,tr.arp.wave,tr.arp.gain,tr.arp.cut,out,0);
        }
        for (const q of p.song[sec][ci]) {
            if (q.step===s) {
                const o=this.tone(pitchOf(tr,q.deg,tr.lead.oct),t,st*q.len,V.lead,tr.lead.wave,tr.lead.gain,tr.lead.cut,out,0);
                this.vibrato(o,t,st*q.len+V.lead.release);
            }
        }
        const D=tr.drums;
        if (D.kick[s]==='x') {
            this.kick(t,D.gain,out);
        }
        if (D.snare[s]==='x') {
            this.snare(t,D.gain,out);
        }
        if (D.hat[s]==='x') {
            this.hat(t,D.gain*V.hat.gain,V.hat.dur,out);
        }
        if (D.open[s]==='x') {
            this.hat(t,D.gain*V.hat.openGain,V.hat.open,out);
        }
    },

    tone(freq,t,dur,V,wave,gain,cut,out,detune) {
        const c=this.ctx;
        const o=c.createOscillator();
        o.type=wave;
        o.frequency.setValueAtTime(freq,t);
        o.detune.value=detune;
        const f=c.createBiquadFilter();
        f.type='lowpass';
        f.frequency.value=cut;
        f.Q.value=V.q;
        const g=c.createGain();
        const hold=Math.max(V.attack,dur);
        g.gain.setValueAtTime(0.0001,t);
        g.gain.linearRampToValueAtTime(gain,t+V.attack);
        g.gain.setValueAtTime(gain,t+hold);
        g.gain.exponentialRampToValueAtTime(0.0001,t+hold+V.release);
        o.connect(f);
        f.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t+hold+V.release+0.05);
        return o;
    },

    vibrato(o,t,dur) {
        const c=this.ctx;
        const V=MUSIC.voices.lead;
        const l=c.createOscillator();
        const lg=c.createGain();
        l.frequency.value=V.vibRate;
        lg.gain.value=V.vibDepth;
        l.connect(lg);
        lg.connect(o.detune);
        l.start(t);
        l.stop(t+dur+0.05);
    },

    kick(t,gain,out) {
        const c=this.ctx;
        const K=MUSIC.voices.kick;
        const o=c.createOscillator();
        o.type='sine';
        o.frequency.setValueAtTime(K.f0,t);
        o.frequency.exponentialRampToValueAtTime(K.f1,t+K.sweep);
        const g=c.createGain();
        g.gain.setValueAtTime(gain,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+K.dur);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t+K.dur+0.05);
    },

    burst(t,gain,dur,type,freq,q,out) {
        const c=this.ctx;
        const src=c.createBufferSource();
        src.buffer=this.noise;
        const f=c.createBiquadFilter();
        f.type=type;
        f.frequency.value=freq;
        f.Q.value=q;
        const g=c.createGain();
        g.gain.setValueAtTime(gain,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
        src.connect(f);
        f.connect(g);
        g.connect(out);
        src.start(t,Math.random()*MUSIC.voices.mix.offset,dur+0.05);
    },

    snare(t,gain,out) {
        const S=MUSIC.voices.snare;
        this.burst(t,gain*MUSIC.voices.mix.snareNoise,S.noiseDur,'bandpass',S.band,S.q,out);
        const c=this.ctx;
        const o=c.createOscillator();
        o.type='triangle';
        o.frequency.setValueAtTime(S.tone,t);
        const g=c.createGain();
        g.gain.setValueAtTime(gain*MUSIC.voices.mix.snareTone,t);
        g.gain.exponentialRampToValueAtTime(0.0001,t+S.toneDur);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t+S.toneDur+0.05);
    },

    hat(t,gain,dur,out) {
        this.burst(t,gain,dur,'highpass',MUSIC.voices.hat.band,MUSIC.voices.hat.q,out);
    }
};
