export const SKIN_PARTS=[
    {key:'coat',label:'skin.part.coat',tones:['gray','paper','charcoal','graphite','vermilion','rose','indigo','teal','moss','amber','kraft','wisteria']},
    {key:'limbs',label:'skin.part.limbs',tones:['charcoal','graphite','gray','vermilion','indigo','teal','moss','amber','kraft','wisteria']},
    {key:'face',label:'skin.part.face',tones:['paper','gray','kraft','amber','rose']},
    {key:'accent',label:'skin.part.accent',accents:['ink','red','darkRed','navy']}
];

export const SKIN_PRESETS=[
    {id:'original',coat:'gray',limbs:'charcoal',face:'paper',accent:'ink'},
    {id:'vermilion',coat:'vermilion',limbs:'graphite',face:'paper',accent:'darkRed'},
    {id:'indigo',coat:'indigo',limbs:'charcoal',face:'paper',accent:'navy'},
    {id:'moss',coat:'moss',limbs:'kraft',face:'paper',accent:'ink'},
    {id:'amber',coat:'amber',limbs:'graphite',face:'kraft',accent:'red'},
    {id:'wisteria',coat:'wisteria',limbs:'charcoal',face:'paper',accent:'ink'},
    {id:'teal',coat:'teal',limbs:'indigo',face:'paper',accent:'navy'},
    {id:'shadow',coat:'graphite',limbs:'graphite',face:'gray',accent:'red'}
];

export const DEFAULT_SKIN=SKIN_PRESETS[0];
