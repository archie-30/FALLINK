const DECOR=[
    {type:'pencil',x:-5,z:-16,len:20,r:1.0,rot:0.25},
    {type:'eraser',x:13,z:-18,w:7,h:2.6,d:3.6,rot:-0.4},
    {type:'books',x:-21,z:-9,w:5,d:7,rot:0.2,count:4},
    {type:'crumple',x:3,z:-26,r:3.2},
    {type:'crumple',x:-20,z:5,r:2.2},
    {type:'eraser',x:20,z:3,w:5,h:2,d:2.8,rot:0.9},
    {type:'pencil',x:6,z:13,len:12,r:0.7,rot:-0.2}
];

const EDGE_SPAWNS=[[-12,-7],[13,-2],[-13,8],[12,8],[0,-8.5],[-6,8.5],[8,-7],[-12,1],[13,5],[5,8.5]];

function room(props,extra={}) {
    return {
        size:[30,20],
        spawn:[0,4],
        wallHeight:0.7,
        wallThickness:0.6,
        spawnPoints:EDGE_SPAWNS,
        props:props.concat(DECOR),
        ...extra
    };
}

export const LAYOUTS={
    crossroads:room([
        {type:'wall',x:-8,z:-3,w:5,h:1.1,d:0.8,rot:0.35},
        {type:'wall',x:7.5,z:4.5,w:4,h:1.1,d:0.8,rot:-0.5},
        {type:'pillar',x:5,z:-5,r:0.8,h:2.8},
        {type:'pillar',x:-4,z:5.5,r:0.6,h:2.2},
        {type:'pillar',x:11,z:-6.5,r:0.7,h:3.2},
        {type:'box',x:2.5,z:1.5,w:1.6,h:1.6,d:1.6,rot:0.6},
        {type:'box',x:-11,z:5,w:2.2,h:1.3,d:1.4,rot:-0.2},
        {type:'box',x:-2,z:-7,w:1.2,h:2.4,d:1.2,rot:0.25}
    ]),
    colonnade:room([
        {type:'pillar',x:-9,z:-4,r:0.7,h:3.0},
        {type:'pillar',x:-3,z:-4,r:0.7,h:3.0},
        {type:'pillar',x:3,z:-4,r:0.7,h:3.0},
        {type:'pillar',x:9,z:-4,r:0.7,h:3.0},
        {type:'pillar',x:-9,z:1.5,r:0.7,h:3.0},
        {type:'pillar',x:9,z:1.5,r:0.7,h:3.0},
        {type:'box',x:-4,z:7,w:1.4,h:1.2,d:1.4,rot:0.3},
        {type:'box',x:5,z:7,w:1.4,h:1.2,d:1.4,rot:-0.4}
    ]),
    trenches:room([
        {type:'wall',x:-7,z:-5,w:7,h:1.0,d:0.7,rot:0},
        {type:'wall',x:7,z:-5,w:7,h:1.0,d:0.7,rot:0},
        {type:'wall',x:0,z:-0.5,w:6,h:1.0,d:0.7,rot:0},
        {type:'wall',x:-9,z:3.5,w:5,h:1.0,d:0.7,rot:0.1},
        {type:'wall',x:9,z:3.5,w:5,h:1.0,d:0.7,rot:-0.1},
        {type:'pillar',x:-13,z:-1,r:0.6,h:2.4},
        {type:'pillar',x:13,z:-1,r:0.6,h:2.4}
    ]),
    crates:room([
        {type:'box',x:-9,z:-6,w:1.8,h:1.4,d:1.8,rot:0.3},
        {type:'box',x:-5,z:-1,w:1.4,h:1.8,d:1.4,rot:0.8},
        {type:'box',x:4,z:-6,w:2.0,h:1.2,d:1.4,rot:-0.2},
        {type:'box',x:8,z:-1,w:1.6,h:1.6,d:1.6,rot:0.5},
        {type:'box',x:-10,z:5,w:1.6,h:1.3,d:2.0,rot:-0.3},
        {type:'box',x:10,z:6,w:1.8,h:1.5,d:1.4,rot:0.15},
        {type:'box',x:0,z:-3.5,w:1.2,h:2.2,d:1.2,rot:0.1},
        {type:'box',x:3,z:6.5,w:1.3,h:1.0,d:1.3,rot:0.7}
    ]),
    circle:room([
        {type:'pillar',x:0,z:-6,r:0.7,h:2.8},
        {type:'pillar',x:5.2,z:-3,r:0.7,h:2.8},
        {type:'pillar',x:5.2,z:3,r:0.7,h:2.8},
        {type:'pillar',x:-5.2,z:-3,r:0.7,h:2.8},
        {type:'pillar',x:-5.2,z:3,r:0.7,h:2.8},
        {type:'box',x:0,z:-1,w:1.5,h:1.5,d:1.5,rot:0.78},
        {type:'wall',x:-11,z:-6,w:4,h:1.0,d:0.7,rot:0.6},
        {type:'wall',x:11,z:-6,w:4,h:1.0,d:0.7,rot:-0.6}
    ],{spawn:[0,6.5]}),
    lanes:room([
        {type:'wall',x:-5,z:-2,w:0.8,h:1.2,d:9,rot:0},
        {type:'wall',x:5,z:-2,w:0.8,h:1.2,d:9,rot:0},
        {type:'box',x:-11,z:0,w:1.6,h:1.4,d:1.6,rot:0.4},
        {type:'box',x:11,z:0,w:1.6,h:1.4,d:1.6,rot:-0.4},
        {type:'pillar',x:0,z:-6,r:0.7,h:2.6},
        {type:'pillar',x:-10,z:7,r:0.6,h:2.2},
        {type:'pillar',x:10,z:7,r:0.6,h:2.2}
    ]),
    bossArena:room([
        {type:'pillar',x:-11,z:-6,r:0.8,h:3.2},
        {type:'pillar',x:11,z:-6,r:0.8,h:3.2},
        {type:'pillar',x:-11,z:6,r:0.8,h:3.2},
        {type:'pillar',x:11,z:6,r:0.8,h:3.2},
        {type:'wall',x:-6,z:3.5,w:3,h:1.0,d:0.7,rot:0.4},
        {type:'wall',x:6,z:3.5,w:3,h:1.0,d:0.7,rot:-0.4}
    ],{size:[32,22],spawn:[0,5],bossSpawn:[0,-3]})
};

const PEACE_SPAWNS=[[-9,-5],[9,-5],[-10,1],[10,1],[0,-5.5],[-5,-6],[5,-6],[-7,3],[7,3]];

function peace(props,npcs) {
    return {
        size:[24,16],
        spawn:[0,4],
        wallHeight:0.7,
        wallThickness:0.6,
        spawnPoints:PEACE_SPAWNS,
        props:props.concat(DECOR),
        base:props,
        decor:DECOR,
        npcs
    };
}

export const PEACE_VARY={
    spots:[[0,-1],[0,-3],[-5,-2.5],[5,-2.5],[-6.5,0.5],[6.5,0.5],[-3,-0.5],[3,-0.5]],
    trios:[[[-5,-2],[0,-3],[5,-2]],[[-6,-3],[0,-1.5],[6,-3]],[[-7,0],[0,-3],[7,0]],[[-6,-3.5],[-1,-1.5],[4.5,0.5]],[[-4.5,-3.5],[0,-3.5],[4.5,-3.5]],[[-7,-2],[-2,0.5],[3,-3]]],
    slots:[[-9.5,-5],[9.5,-5],[-9.5,-0.5],[9.5,-0.5],[-9,4.5],[9,4.5],[-5,5],[5,5],[-6,1.5],[6,1.5],[-3,-3.8],[3,-3.8],[-2,1.5],[2.5,1]],
    jitter:0.7,
    spin:0.5,
    npcJitter:0.6,
    npcClear:3.4,
    spawnClear:3,
    mirror:0.5
};

const EVENT_ROOMS=[
    peace([
        {type:'pillar',x:-8,z:-4,r:0.6,h:2.4},
        {type:'pillar',x:8,z:-4,r:0.6,h:2.4},
        {type:'crumple',x:-5,z:4,r:0.7},
        {type:'shavings',x:5,z:3.5,count:8}
    ],[[0,-1.5]]),
    peace([
        {type:'wall',x:-7,z:0,w:3,h:1,d:0.7,rot:0.5},
        {type:'wall',x:7,z:0,w:3,h:1,d:0.7,rot:-0.5},
        {type:'notes',x:-8,z:4,s:1.2,count:4,rot:-0.3},
        {type:'clip',x:7,z:4.5,r:0.4,len:2,rot:0.6}
    ],[[0,-2]]),
    peace([
        {type:'box',x:-9,z:-5,w:1.6,h:2.2,d:1.6,rot:0.2},
        {type:'box',x:9,z:-5,w:1.6,h:2.2,d:1.6,rot:-0.2},
        {type:'books',x:-5,z:3,w:1.4,d:2,rot:-0.2,count:5},
        {type:'books',x:6,z:3,w:1.4,d:2,rot:0.4,count:3}
    ],[[0,-1]])
];

export const PEACE_LAYOUTS={
    shop:[
        peace([
            {type:'box',x:-8,z:-3,w:2.6,h:1.6,d:1.1,rot:0.1},
            {type:'box',x:8,z:-3,w:2.6,h:1.6,d:1.1,rot:-0.1},
            {type:'books',x:-9,z:3,w:1.4,d:2,rot:0.3,count:3},
            {type:'notes',x:8.5,z:3,s:1.2,count:3,rot:0.2},
            {type:'pin',x:-4,z:-6,r:0.3},
            {type:'crumple',x:4,z:4.5,r:0.6}
        ],[[0,-1]]),
        peace([
            {type:'pillar',x:-9,z:-5,r:0.5,h:2.2},
            {type:'pillar',x:9,z:-5,r:0.5,h:2.2},
            {type:'box',x:-6,z:2,w:1.4,h:1.1,d:1.4,rot:0.4},
            {type:'box',x:7,z:2.5,w:1.6,h:1.2,d:1.2,rot:-0.3},
            {type:'sheet',x:-3,z:4,w:2.4,d:3,rot:0.2},
            {type:'shavings',x:3,z:-5.5,count:7}
        ],[[0,-0.5]])
    ],
    event:EVENT_ROOMS,
    encounter:EVENT_ROOMS,
    rest:[
        peace([
            {type:'sheet',x:-6,z:1,w:3,d:3.6,rot:0.3},
            {type:'sheet',x:6,z:-1,w:2.6,d:3.2,rot:-0.4},
            {type:'pin',x:-8,z:-5,r:0.3},
            {type:'crumple',x:8,z:4,r:0.6}
        ],[[0,-1.5]]),
        peace([
            {type:'pillar',x:-7,z:-3,r:0.5,h:2},
            {type:'pillar',x:7,z:-3,r:0.5,h:2},
            {type:'shavings',x:-5,z:4,count:6},
            {type:'notes',x:6,z:4,s:1,count:3,rot:0.5}
        ],[[0,-1]])
    ],
    treasure:[
        peace([
            {type:'pillar',x:-9.5,z:-5,r:0.6,h:2.6},
            {type:'pillar',x:9.5,z:-5,r:0.6,h:2.6},
            {type:'crumple',x:-7,z:4,r:0.6},
            {type:'crumple',x:7,z:4,r:0.5}
        ],[[-5,-2],[0,-3],[5,-2]]),
        peace([
            {type:'wall',x:-3,z:2,w:2.4,h:1,d:0.7,rot:0.3},
            {type:'wall',x:3,z:2,w:2.4,h:1,d:0.7,rot:-0.3},
            {type:'books',x:-9,z:3,w:1.4,d:2,rot:0.3,count:4},
            {type:'shavings',x:9,z:-5,count:6}
        ],[[-6,-3],[0,-1.5],[6,-3]])
    ]
};

export const TRAINING={
    layout:room([
        {type:'pillar',x:-12,z:-6.5,r:0.7,h:2.8},
        {type:'pillar',x:12,z:-6.5,r:0.7,h:2.8},
        {type:'pillar',x:-12,z:7,r:0.7,h:2.8},
        {type:'pillar',x:12,z:7,r:0.7,h:2.8},
        {type:'wall',x:-5,z:5.5,w:3,h:1.0,d:0.7,rot:0.3},
        {type:'wall',x:5,z:5.5,w:3,h:1.0,d:0.7,rot:-0.3}
    ],{spawn:[0,4]}),
    solid:['wall','pillar','box'],
    barrels:2,
    crates:2
};

export const TRAINING_MAPS=['training','crossroads','colonnade','trenches','crates','circle','lanes','bossArena'];

export const NORMAL_LAYOUTS=['crossroads','colonnade','trenches','crates','circle','lanes'];

export const ENEMY_ORDER=['doodle','blob','sprayer','inkCloud','bird','compass','eraserMonster'];

export const STORY_INTRO=[0,3,6,8,11,14,16];

export const ENEMY_COST={doodle:1,blob:2,sprayer:2,inkCloud:2,compass:2,bird:1,eraserMonster:2};

export const ACTS=[
    {rooms:6,budget:[5,5,6,7,7,8],waves:[2,2,2,2,3,3],pool:{doodle:4,blob:2,sprayer:2,bird:1,compass:1},hpMult:1,bossMult:1,bossHp:1.35,modChance:[0,0,0.2,0.3,0.3,0.3],elite:false},
    {rooms:6,budget:[8,8,9,10,10,11],waves:[2,2,3,3,3,3],pool:{doodle:3,blob:2,sprayer:2,inkCloud:2,compass:1,bird:2,eraserMonster:1},hpMult:1.12,bossMult:1.3,bossHp:1.35,modChance:[0.3,0.3,0.4,0.4,0.5,0.5],elite:true},
    {rooms:6,budget:[10,11,12,13,14,15],waves:[2,3,3,3,3,3],pool:{doodle:2,blob:2,sprayer:2,inkCloud:2,compass:2,bird:2,eraserMonster:2},hpMult:1.28,bossMult:1.65,bossHp:1.35,modChance:[0.4,0.4,0.5,0.5,0.6,0.6],elite:true}
];

export const ENDLESS={
    bossEvery:5,
    hpPerPage:0.05,
    bossHpPerPage:0.09,
    budgetBase:5,
    budgetPerPage:0.85,
    budgetMax:24,
    modFrom:3,
    modChance:0.4,
    eliteFrom:10,
    scoreKill:100,
    scoreBoss:3000,
    scoreRoom:500,
    scorePerPage:0.1,
    scorePerAct:0.5,
    scoreVictory:5000,
    pagesPerType:3
};

const MENU_DECOR=[
    {type:'sheet',x:-6,z:-1,w:4,d:5,rot:0.3},
    {type:'sheet',x:8.5,z:1,w:3.5,d:4.5,rot:-0.5},
    {type:'notes',x:9.5,z:-5,s:1.6,count:4,rot:0.3},
    {type:'pin',x:-9,z:-6.5,r:0.35},
    {type:'pin',x:12,z:7,r:0.3,tilt:0.3},
    {type:'shavings',x:-3,z:7,count:9},
    {type:'clip',x:4,z:7.5,r:0.5,len:2.4,rot:0.4},
    {type:'crumple',x:-12.5,z:-8,r:0.7},
    {type:'crumple',x:13,z:-8.5,r:0.55},
    {type:'mug',x:-23,z:12,r:2.6,h:4.2},
    {type:'lamp',x:23,z:-15,s:2.0,rot:2.6},
    {type:'ruler',x:-7,z:15.5,len:14,w:2.2,rot:0.05},
    {type:'sharpener',x:24,z:11,s:2.2,rot:-0.5},
    {type:'notes',x:-19,z:15,s:3,count:5,rot:-0.2},
    {type:'pin',x:18,z:16,r:0.9},
    {type:'clip',x:-14,z:-20,r:1.4,len:6,rot:-0.3},
    {type:'shavings',x:10,z:-24,count:12}
];

export const MENU_SCENE={
    layout:{...LAYOUTS.crossroads,props:LAYOUTS.crossroads.props.filter(q=>Math.hypot(q.x,q.z-1.5)>5).concat(MENU_DECOR)},
    seed:77,
    barrels:0,
    crates:0,
    enemies:[['doodle',-6,-5,2.4],['blob',7,-3,0],['compass',-8,5,0.8]],
    decals:[[-3,2,2.6],[6,-5,3.2],[-8,-6,2.2],[9,3,1.8],[1,6.5,2.4],[-6,7,1.6]]
};

export const LEVELS={test:LAYOUTS.crossroads};
