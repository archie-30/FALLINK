import {TUNING} from '../data/tuning.js';
import {time} from './loop.js';
import {settings} from './settings.js';

export const fx={
    rig:null,
    post:null,
    stop:0,
    stopCd:0,
    slowScale:1,
    slowTime:0,

    init(rig,post) {
        this.rig=rig;
        this.post=post;
    },

    hitStop(ms,force=false) {
        if (this.stopCd>0&&!force) {
            return;
        }
        this.stop=Math.max(this.stop,ms/1000);
        this.stopCd=TUNING.feel.hitStopCooldown;
        time.timeScale=0;
    },

    cameraShake(trauma) {
        if (this.rig) {
            this.rig.addTrauma(trauma);
        }
    },

    fovPunch(amount) {
        if (this.rig) {
            this.rig.fovPunch(amount);
        }
    },

    flash(colorKey,duration,strength=1) {
        if (this.post) {
            this.post.flash(colorKey,duration,strength*(settings.reducedMotion?0.3:1));
        }
    },

    slowMo(scale,duration) {
        this.slowScale=scale;
        this.slowTime=duration;
    },

    invertFrame(frames=1) {
        if (this.post&&!settings.reducedMotion) {
            this.post.invertFrames=Math.max(this.post.invertFrames,frames);
        }
    },

    update(dt) {
        this.stopCd=Math.max(0,this.stopCd-dt);
        if (this.slowTime>0) {
            this.slowTime-=dt;
            if (this.slowTime<=0) {
                this.slowScale=1;
            }
        }
        if (this.stop>0) {
            this.stop-=dt;
            time.timeScale=0;
            return;
        }
        time.timeScale=this.slowScale;
    }
};
