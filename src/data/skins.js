export const SKIN_PARTS=[
    {key:'coat',label:'skin.part.coat',tones:['gray','paper','charcoal','graphite','vermilion','rose','indigo','teal','moss','amber','kraft','wisteria']},
    {key:'limbs',label:'skin.part.limbs',tones:['charcoal','graphite','gray','vermilion','indigo','teal','moss','amber','kraft','wisteria']},
    {key:'hat',label:'skin.part.hat',tones:['charcoal','graphite','gray','paper','vermilion','rose','indigo','teal','moss','amber','kraft','wisteria']},
    {key:'gear',label:'skin.part.gear',tones:['graphite','charcoal','gray','kraft','amber','indigo','vermilion','teal']},
    {key:'face',label:'skin.part.face',tones:['paper','gray','kraft','amber','rose']},
    {key:'accent',label:'skin.part.accent',accents:['ink','red','darkRed','navy']}
];

export const SKIN_PRESETS=[
    {id:'original',coat:'gray',limbs:'charcoal',hat:'charcoal',gear:'graphite',face:'paper',accent:'ink'},
    {id:'vermilion',coat:'vermilion',limbs:'graphite',hat:'paper',gear:'graphite',face:'paper',accent:'darkRed'},
    {id:'indigo',coat:'indigo',limbs:'charcoal',hat:'teal',gear:'graphite',face:'paper',accent:'navy'},
    {id:'moss',coat:'moss',limbs:'kraft',hat:'amber',gear:'graphite',face:'paper',accent:'ink'},
    {id:'amber',coat:'amber',limbs:'graphite',hat:'vermilion',gear:'kraft',face:'kraft',accent:'red'},
    {id:'wisteria',coat:'wisteria',limbs:'charcoal',hat:'rose',gear:'graphite',face:'paper',accent:'ink'},
    {id:'teal',coat:'teal',limbs:'indigo',hat:'paper',gear:'indigo',face:'paper',accent:'navy'},
    {id:'shadow',coat:'graphite',limbs:'graphite',hat:'vermilion',gear:'graphite',face:'gray',accent:'red'}
];

export const DEFAULT_SKIN=SKIN_PRESETS[0];
