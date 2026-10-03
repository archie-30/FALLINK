import {settings} from './settings.js';
import {SOUNDS,AUDIO} from '../data/sounds.js';
import {MUSIC} from '../data/music.js';
import {music} from './music.js';

export const audio={
    ctx:null,
    master:null,
    sfx:null,
    musicBus:null,
    wet:null,
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
        const c=this.ctx;
        this.master=c.createGain();
        const comp=c.createDynamicsCompressor();
        comp.threshold.value=AUDIO.compThreshold;
        comp.ratio.value=AUDIO.compRatio;
        this.master.connect(comp);
        comp.connect(c.destination);
        this.sfx=c.createGain();
        this.sfx.connect(this.master);
        this.musicBus=c.createGain();
        this.musicBus.connect(this.master);
        this.applyVolumes();
        const len=c.sampleRate;
        this.noise=c.createBuffer(1,len,c.sampleRate);
        const d=this.noise.getChannelData(0);
        for (let i=0;i<len;i++) {
            d[i]=Math.random()*2-1;
        }
        const rl=Math.floor(c.sampleRate*AUDIO.reverbTime);
        const ir=c.createBuffer(2,rl,c.sampleRate);
        for (let ch=0;ch<2;ch++) {
            const q=ir.getChannelData(ch);
            for (let i=0;i<rl;i++) {
                q[i]=(Math.random()*2-1)*Math.pow(1-i/rl,AUDIO.reverbDecay);
            }
        }
        const conv=c.createConvolver();
        conv.buffer=ir;
        this.wet=c.createGain();
        this.wet.gain.value=1;
        this.wet.connect(conv);
        conv.connect(this.sfx);
        const mconv=c.createConvolver();
        mconv.buffer=ir;
        const send=c.createGain();
        send.gain.value=MUSIC.reverb;
        this.musicBus.connect(send);
        send.connect(mconv);
        mconv.connect(this.master);
        music.init(c,this.musicBus,this.noise);
    },

    level(key,slider) {
        const m=settings.mute||{};
        const v=m[key]?0:settings[slider];
        return v*v;
    },

    applyVolumes() {
        if (!this.master) {
            return;
        }
        const now=this.ctx.currentTime;
        this.master.gain.setTargetAtTime(this.level('volume','volume')*AUDIO.masterGain,now,AUDIO.volumeTime);
        this.sfx.gain.setTargetAtTime(this.level('sfx','sfxVol'),now,AUDIO.volumeTime);
        this.musicBus.gain.setTargetAtTime(this.level('music','musicVol'),now,AUDIO.volumeTime);
    },

    layer(L,now,pitch,out) {
        const c=this.ctx;
        const t0=now+(L.delay||0);
        const dur=L.dur;
        const att=L.attack??0.004;
        const g=c.createGain();
        g.gain.setValueAtTime(0.0001,t0);
        g.gain.linearRampToValueAtTime(L.gain,t0+att);
        g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);
        let node=g;
        if (L.trem) {
            const lfo=c.createOscillator();
            const lg=c.createGain();
            lfo.frequency.value=L.trem.rate;
            lg.gain.value=L.gain*L.trem.depth;
            lfo.connect(lg);
            lg.connect(g.gain);
            lfo.start(t0);
            lfo.stop(t0+dur+0.05);
        }
        let src;
        if (L.kind==='noise') {
            src=c.createBufferSource();
            src.buffer=this.noise;
            src.playbackRate.value=L.rate||1;
        }
        else {
            src=c.createOscillator();
            src.type=L.wave||'sine';
            src.frequency.setValueAtTime(L.f0*pitch,t0);
            if (L.f1) {
                src.frequency.exponentialRampToValueAtTime(Math.max(20,L.f1*pitch),t0+(L.sweep||dur));
            }
        }
        let head=src;
        if (L.filter) {
            const f=c.createBiquadFilter();
            f.type=L.filter.type;
            f.Q.value=L.filter.q??0.8;
            f.frequency.setValueAtTime(L.filter.f0*pitch,t0);
            if (L.filter.f1) {
                f.frequency.exponentialRampToValueAtTime(L.filter.f1*pitch,t0+(L.filter.time||dur));
            }
            head.connect(f);
            head=f;
        }
        head.connect(node);
        node.connect(out);
        if (L.kind==='noise') {
            src.start(t0,Math.random()*0.6,dur+0.05);
        }
        else {
            src.start(t0);
            src.stop(t0+dur+0.05);
        }
    },

    play(name,pitch=1) {
        const c=this.ctx;
        const def=SOUNDS[name];
        if (!c||!def||c.state!=='running') {
            return;
        }
        const now=c.currentTime;
        if (this.last[name]!==undefined&&now-this.last[name]<def.gap) {
            return;
        }
        this.last[name]=now;
        const bus=c.createGain();
        bus.gain.value=def.gain??1;
        bus.connect(this.sfx);
        if (def.rev) {
            const send=c.createGain();
            send.gain.value=def.rev;
            bus.connect(send);
            send.connect(this.wet);
        }
        const jitter=1+(Math.random()-0.5)*(def.vary||0);
        for (const L of def.layers) {
            this.layer(L,now,pitch*jitter,bus);
        }
    }
};
