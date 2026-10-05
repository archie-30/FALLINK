export const SKIN_PARTS=[
    {key:'coat',label:'skin.part.coat',tones:['gray','paper','charcoal','graphite','vermilion','rose','coral','peach','amber','lemon','moss','mint','teal','sky','indigo','slate','wisteria','plum','kraft','cocoa']},
    {key:'limbs',label:'skin.part.limbs',tones:['charcoal','graphite','gray','vermilion','coral','amber','moss','mint','teal','sky','indigo','slate','wisteria','plum','kraft','cocoa']},
    {key:'hat',label:'skin.part.hat',tones:['charcoal','graphite','gray','paper','vermilion','rose','coral','peach','amber','lemon','moss','mint','teal','sky','indigo','slate','wisteria','plum','kraft','cocoa']},
    {key:'gear',label:'skin.part.gear',tones:['graphite','charcoal','gray','kraft','cocoa','amber','lemon','vermilion','coral','indigo','sky','teal','mint','plum','slate']},
    {key:'face',label:'skin.part.face',tones:['paper','gray','peach','kraft','amber','rose','cocoa']},
    {key:'accent',label:'skin.part.accent',accents:['ink','red','darkRed','navy','forest','grape','umber','gold']}
];

export const SKIN_PRESETS=[
    {id:'original',coat:'gray',limbs:'charcoal',hat:'charcoal',gear:'graphite',face:'paper',accent:'ink',headwear:'drop',eyewear:'none',neckwear:'scarf',backwear:'pouch'},
    {id:'vermilion',coat:'vermilion',limbs:'graphite',hat:'paper',gear:'graphite',face:'paper',accent:'darkRed',headwear:'beret',eyewear:'none',neckwear:'scarf',backwear:'cape'},
    {id:'indigo',coat:'indigo',limbs:'charcoal',hat:'teal',gear:'graphite',face:'paper',accent:'navy',headwear:'headphones',eyewear:'glasses',neckwear:'tie',backwear:'backpack'},
    {id:'moss',coat:'moss',limbs:'kraft',hat:'amber',gear:'graphite',face:'paper',accent:'ink',headwear:'paperBoat',eyewear:'none',neckwear:'beads',backwear:'quiver'},
    {id:'amber',coat:'amber',limbs:'graphite',hat:'vermilion',gear:'kraft',face:'kraft',accent:'red',headwear:'crown',eyewear:'monocle',neckwear:'ruff',backwear:'cape'},
    {id:'wisteria',coat:'wisteria',limbs:'charcoal',hat:'rose',gear:'graphite',face:'paper',accent:'ink',headwear:'catEars',eyewear:'none',neckwear:'bell',backwear:'wings'},
    {id:'teal',coat:'teal',limbs:'indigo',hat:'paper',gear:'indigo',face:'paper',accent:'navy',headwear:'propeller',eyewear:'glasses',neckwear:'bowtie',backwear:'backpack'},
    {id:'shadow',coat:'graphite',limbs:'graphite',hat:'vermilion',gear:'graphite',face:'gray',accent:'red',headwear:'drop',eyewear:'eyepatch',neckwear:'scarf',backwear:'scroll'},
    {id:'sky',coat:'sky',limbs:'slate',hat:'paper',gear:'lemon',face:'peach',accent:'navy',headwear:'paperBoat',eyewear:'none',neckwear:'tie',backwear:'wings'},
    {id:'coral',coat:'coral',limbs:'cocoa',hat:'lemon',gear:'mint',face:'peach',accent:'umber',headwear:'beret',eyewear:'bandage',neckwear:'bowtie',backwear:'pouch'},
    {id:'mint',coat:'mint',limbs:'slate',hat:'plum',gear:'paper',face:'paper',accent:'forest',headwear:'catEars',eyewear:'glasses',neckwear:'beads',backwear:'backpack'},
    {id:'cocoa',coat:'cocoa',limbs:'kraft',hat:'plum',gear:'amber',face:'peach',accent:'gold',headwear:'crown',eyewear:'mustache',neckwear:'bell',backwear:'scroll'}
];

export const DEFAULT_SKIN=(({id,...rest})=>rest)(SKIN_PRESETS[0]);
