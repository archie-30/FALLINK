import {TUNING} from './tuning.js';

export const RELIC_ORDER=['refill','sharpener','inkVial','styptic','whiteout','bandage','sneakers','feather','eraserBits','boxCutter','glasses','coupon','metronome','redPact','carbon','phoenix','bigInk','inkDrip','amulet','lastStand','gambler','masochist'];

export const RELIC_STARTERS=['refill','sharpener','inkVial','styptic'];

export const RELIC_TINT={
    refill:'amber',
    sharpener:'slate',
    inkVial:'indigo',
    styptic:'rose',
    whiteout:'sky',
    bandage:'peach',
    sneakers:'teal',
    feather:'mint',
    eraserBits:'coral',
    boxCutter:'gray',
    glasses:'sky',
    coupon:'lemon',
    metronome:'wisteria',
    redPact:'vermilion',
    carbon:'kraft',
    phoenix:'vermilion',
    bigInk:'indigo',
    inkDrip:'slate',
    amulet:'amber',
    lastStand:'plum',
    gambler:'moss',
    masochist:'plum'
};

export function relicParams(id) {
    const R=TUNING.relics;
    const pct=v=>Math.round(Math.abs(v-1)*100);
    const P={
        refill:()=>({...R.refill}),
        sharpener:()=>({pct:pct(R.sharpener.reload)}),
        inkVial:()=>({n:R.inkVial.min}),
        styptic:()=>({s:R.styptic.invuln}),
        bandage:()=>({n:R.bandage.heal,every:R.bandage.every}),
        sneakers:()=>({s:R.sneakers.iframe}),
        feather:()=>({pct:pct(R.feather.speed)}),
        eraserBits:()=>({every:R.eraserBits.every,n:R.eraserBits.ink}),
        boxCutter:()=>({range:R.boxCutter.range,pct:pct(R.boxCutter.mult)}),
        glasses:()=>({pct:pct(R.glasses.slow)}),
        coupon:()=>({pct:pct(R.coupon.mult)}),
        metronome:()=>({s:R.metronome.time,pct:pct(R.metronome.rate)}),
        redPact:()=>({hp:-R.redPact.hp,pct:pct(R.redPact.mult)}),
        carbon:()=>({every:R.carbon.every}),
        phoenix:()=>({hp:R.phoenix.hp,s:R.phoenix.invuln}),
        bigInk:()=>({n:R.bigInk.ink}),
        inkDrip:()=>({every:R.inkDrip.every,n:R.inkDrip.ink}),
        amulet:()=>({n:R.amulet.shields}),
        lastStand:()=>({hp:R.lastStand.hp,pct:pct(R.lastStand.rate)}),
        gambler:()=>({m:R.gambler.mult}),
        masochist:()=>({n:R.masochist.ink})
    };
    return P[id]?P[id]():{};
}
