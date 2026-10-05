import {TUNING} from '../data/tuning.js';

export const time={
    real:0,
    game:0,
    tick:0,
    frame:0,
    alpha:0,
    timeScale:1,
    boilStep:0,
    boilIndex:0,
    boilChanged:false,
    fps:60,
    fpsCap:0
};

export function createLoop(update,render) {
    const step=1/TUNING.loop.hz;
    let acc=0;
    let last=-1;
    let raf=0;
    let running=false;
    let fpsAcc=0;
    let fpsFrames=0;
    let budget=0;
    let seen=-1;
    function frame(ts) {
        raf=requestAnimationFrame(frame);
        const now=ts/1000;
        if (time.fpsCap>0&&last>=0) {
            const gap=1/time.fpsCap;
            budget=Math.min(budget+now-(seen<0?now:seen),gap*2);
            seen=now;
            if (budget<gap-TUNING.loop.capSlack) {
                return;
            }
            budget=Math.max(0,budget-gap);
        }
        else {
            seen=now;
            budget=0;
        }
        let dt=last<0?step:now-last;
        last=now;
        if (dt>TUNING.loop.maxFrameTime) {
            dt=TUNING.loop.maxFrameTime;
        }
        if (dt<0) {
            dt=0;
        }
        time.real+=dt;
        time.frame++;
        fpsAcc+=dt;
        fpsFrames++;
        if (fpsAcc>=0.5) {
            time.fps=fpsFrames/fpsAcc;
            fpsAcc=0;
            fpsFrames=0;
        }
        const bs=Math.floor(time.real*TUNING.boil.fps);
        time.boilChanged=!time.freezeBoil&&bs!==time.boilStep;
        time.boilStep=bs;
        time.boilIndex=time.freezeBoil?0:bs%TUNING.boil.variants;
        acc+=dt*time.timeScale;
        let n=0;
        while (acc>=step&&n<TUNING.loop.maxSteps) {
            if (time.timeScale<=0) {
                acc=0;
                break;
            }
            update(step);
            acc-=step;
            time.game+=step;
            time.tick++;
            n++;
        }
        if (n>=TUNING.loop.maxSteps) {
            acc=0;
        }
        time.alpha=acc/step;
        render(dt,time.alpha);
    }
    return {
        start() {
            if (running) {
                return;
            }
            running=true;
            last=-1;
            seen=-1;
            budget=0;
            raf=requestAnimationFrame(frame);
        },
        stop() {
            running=false;
            cancelAnimationFrame(raf);
        }
    };
}
