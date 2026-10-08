export const WEAPONS={
    pen:{
        unlock:1,
        sys:'player',
        sound:'shoot',
        fireInterval:0.12,
        magazine:12,
        reloadTime:1.1,
        damage:10,
        bulletSpeed:28,
        bulletLife:0.8,
        spread:0.035,
        pellets:1,
        stats:{dmg:3,rate:3,range:3,mag:2}
    },
    pencil:{
        unlock:3,
        sys:'pencil',
        sound:'wPencil',
        fireInterval:0.09,
        magazine:26,
        reloadTime:1.4,
        damage:5,
        bulletSpeed:34,
        bulletLife:0.7,
        spread:0.06,
        pellets:1,
        kick:0.5,
        flashMul:0.6,
        stats:{dmg:1,rate:4,range:3,mag:5}
    },
    brush:{
        unlock:5,
        sys:'brush',
        sound:'wBrush',
        fireInterval:0.62,
        magazine:6,
        refund:{max:0,streak:2,wait:0.1},
        reloadTime:1.2,
        damage:15,
        bands:[30,20,15],
        bulletSpeed:17,
        bulletLife:0.5,
        spread:0,
        pellets:1,
        fan:0.8,
        swing:true,
        kick:1.6,
        flashMul:1.2,
        stats:{dmg:5,rate:1,range:2,mag:1}
    },
    stapler:{
        unlock:5,
        sys:'staple',
        sound:'wStaple',
        fireInterval:0.5,
        magazine:18,
        reloadTime:1.3,
        damage:12,
        bulletSpeed:30,
        bulletLife:0.7,
        spread:0.025,
        pellets:1,
        burst:3,
        burstGap:0.07,
        slow:{time:0.9,mult:0.45},
        flashColor:'midGray',
        stats:{dmg:3,rate:2,range:3,mag:3}
    },
    highlighter:{
        unlock:8,
        sys:'beam',
        sound:'wMarker',
        fireInterval:0.1,
        magazine:30,
        reloadTime:3.0,
        damage:5,
        bulletSpeed:0,
        bulletLife:0,
        spread:0,
        pellets:1,
        heat:true,
        beam:{range:11,width:0.6,cool:{delay:0.5,rate:8}},
        kick:0.15,
        flashColor:'marker',
        flashMul:0.35,
        stats:{dmg:3,rate:5,range:3,mag:3}
    },
    compass:{
        unlock:10,
        sys:'compass',
        sound:'wCompass',
        fireInterval:0.55,
        cooldown:1.8,
        missCut:0.7,
        magazine:1,
        reloadTime:1.0,
        damage:20,
        bulletSpeed:20,
        bulletLife:0.38,
        spread:0,
        pellets:1,
        boomerang:true,
        kick:1.5,
        stats:{dmg:4,rate:1,range:4,mag:1}
    },
    crayon:{
        unlock:13,
        sys:'crayonG',
        sound:'shoot',
        fireInterval:0.15,
        magazine:16,
        reloadTime:1.2,
        damage:5,
        bulletSpeed:27,
        bulletLife:0.8,
        spread:0.04,
        pellets:1,
        colors:[
            {sys:'crayonR',chance:20,damage:28},
            {sys:'crayonB',chance:30,damage:10},
            {sys:'crayonG',chance:50,damage:5}
        ],
        flashColor:'red',
        stats:{dmg:3,rate:3,range:3,mag:3}
    }
};

export const WEAPON_ORDER=['pen','pencil','brush','stapler','highlighter','compass','crayon'];

export const WEAPON_LIMITS={
    minInterval:0.06
};

export const RANDOM_WEAPON={id:'random',min:2};

export const EARLY_WEAPONS=[];

export const LEGACY_WEAPON_UNLOCKS={pen:1,pencil:2,brush:3,stapler:5,highlighter:7,compass:9};

export function weaponUnlocked(id,level) {
    if (id===RANDOM_WEAPON.id) {
        return unlockedWeapons(level).length>=RANDOM_WEAPON.min;
    }
    return (WEAPONS[id]?.unlock??99)<=level||EARLY_WEAPONS.includes(id);
}

export function unlockedWeapons(level) {
    return WEAPON_ORDER.filter(id=>weaponUnlocked(id,level));
}

export function pickWeapon(level,last) {
    const all=unlockedWeapons(level);
    const pool=all.filter(id=>id!==last);
    const list=pool.length>0?pool:all;
    return list[Math.floor(Math.random()*list.length)]||'pen';
}
