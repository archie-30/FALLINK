export const PALETTE={
    paper:'#F2F0EB',
    farGray:'#D6D3CC',
    midGray:'#9A9892',
    nearGray:'#4A4946',
    ink:'#1A1A1A',
    red:'#D62828',
    darkRed:'#8C1C1C',
    marker:'#E0B43C'
};

export const SKIN_TONES={
    paper:['#F2F0EB','#D6D3CC','#9A9892'],
    gray:['#D6D3CC','#9A9892','#1A1A1A'],
    charcoal:['#9A9892','#4A4946','#1A1A1A'],
    graphite:['#6E6D69','#3A3937','#121212'],
    vermilion:['#EBA59C','#C8554A','#5E1B16'],
    rose:['#F0C4C0','#D08A86','#6E3A38'],
    indigo:['#B3C0D6','#5E7399','#222C45'],
    teal:['#B5D1CB','#5E948A','#23403B'],
    moss:['#C3CCA8','#7A8A5B','#323A22'],
    amber:['#EDD6A6','#C49A52','#5A4019'],
    kraft:['#DECBAA','#AC8E64','#4E3E28'],
    wisteria:['#D0C1DC','#8D72A6','#3B2A4B'],
    sky:['#C6DDEE','#6E9CC2','#26405A'],
    mint:['#CDE8D8','#6FAE8C','#264A38'],
    coral:['#F4C7B4','#E07A5F','#6A2A1C'],
    lemon:['#F3E7A6','#D6BC45','#5E5016'],
    plum:['#D9B8CC','#8E4D72','#40202F'],
    cocoa:['#D2B8A3','#7E5A44','#35241A'],
    slate:['#C3C9D1','#6B7683','#262C33'],
    peach:['#F6DCC8','#E0A784','#6B4330']
};

export const ACCENTS={
    ink:'#1A1A1A',
    red:'#D62828',
    darkRed:'#8C1C1C',
    navy:'#1E2A4A',
    forest:'#1F4A30',
    grape:'#4B2350',
    umber:'#5A3820',
    gold:'#B8902A'
};

export function hexToRgb(hex) {
    const n=parseInt(hex.slice(1),16);
    return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255];
}

export function rgba(key,a) {
    const c=hexToRgb(PALETTE[key]);
    return 'rgba('+Math.round(c[0]*255)+','+Math.round(c[1]*255)+','+Math.round(c[2]*255)+','+a+')';
}
