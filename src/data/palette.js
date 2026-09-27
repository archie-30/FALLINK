export const PALETTE={
    paper:'#F2F0EB',
    farGray:'#D6D3CC',
    midGray:'#9A9892',
    nearGray:'#4A4946',
    ink:'#1A1A1A',
    red:'#D62828',
    darkRed:'#8C1C1C'
};

export function hexToRgb(hex) {
    const n=parseInt(hex.slice(1),16);
    return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}

export function rgba(key,a) {
    const c=hexToRgb(PALETTE[key]);
    return 'rgba('+Math.round(c[0]*255)+','+Math.round(c[1]*255)+','+Math.round(c[2]*255)+','+a+')';
}
