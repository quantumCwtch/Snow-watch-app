// The seven millennials. All original characters.
import type { ColourName } from './palette';
import type { PropId } from './props';

export type HairStyle = 'bun' | 'beanie' | 'cap' | 'headphones' | 'headband' | 'curls' | 'side-part';

export interface CastMember {
  id: string;
  name: string;
  gag: string;
  signatureProp: PropId;
  skin: ColourName;
  hair: ColourName;
  hairStyle: HairStyle;
  top: ColourName;
  legs: ColourName;
  shoes: ColourName;
  beard?: boolean;
  glasses?: boolean;
  /** Lines this character says in any weather. */
  catchphrases: string[];
}

/**
 * The seven names. Each day the names rotate around the cast (seeded by the date),
 * so everyone takes a turn as the filmer, the flat-white drinker, the cyclist and so on.
 */
export const NAMES = ['Haydn', 'Sophie', 'Santi', 'Rachel', 'David', 'Sam', 'Div'] as const;

export const CAST: CastMember[] = [
  {
    id: 'saff',
    name: 'Haydn',
    gag: 'films absolutely everything for their followers',
    signatureProp: 'phone-up',
    skin: 'skin1',
    hair: 'gold',
    hairStyle: 'bun',
    top: 'pink',
    legs: 'ink',
    shoes: 'white',
    catchphrases: ['THIS IS CONTENT', 'LIKE AND SUBSCRIBE', 'GOING LIVE!', 'SAY HI, CHAT'],
  },
  {
    id: 'jasper',
    name: 'Sophie',
    gag: 'has an oat milk flat white in all weathers',
    signatureProp: 'cup',
    skin: 'skin2',
    hair: 'brown',
    hairStyle: 'beanie',
    top: 'darkGreen',
    legs: 'slate',
    shoes: 'brown',
    beard: true,
    catchphrases: ['OAT, OBVIOUSLY', 'FLAT WHITE NO. 4', 'IS THIS SINGLE ORIGIN?', 'EXTRA HOT, PLEASE'],
  },
  {
    id: 'kit',
    name: 'Santi',
    gag: 'pushes a fixed-gear bike everywhere but never rides it',
    signatureProp: 'bike',
    skin: 'skin3',
    hair: 'black',
    hairStyle: 'cap',
    top: 'orange',
    legs: 'navy',
    shoes: 'black',
    catchphrases: ['NO GEARS, NO FEARS', 'BRAKES ARE A MINDSET', 'IT IS A LIFESTYLE', 'STEEL FRAME, MATE'],
  },
  {
    id: 'priya',
    name: 'Rachel',
    gag: 'is forever hunting for one bar of phone signal',
    signatureProp: 'phone-high',
    skin: 'skin3',
    hair: 'ink',
    hairStyle: 'headphones',
    top: 'purple',
    legs: 'dark',
    shoes: 'white',
    catchphrases: ['ONE BAR!', 'NO SIGNAL AGAIN', 'CAN YOU HEAR ME NOW?', 'SEARCHING...'],
  },
  {
    id: 'dev',
    name: 'David',
    gag: 'is mid running-app challenge and will not stop',
    signatureProp: 'watch',
    skin: 'skin4',
    hair: 'black',
    hairStyle: 'headband',
    top: 'lime',
    legs: 'black',
    shoes: 'red',
    catchphrases: ['PB INCOMING', '5K BEFORE BRUNCH', 'STREAK DAY 400', 'DID MY WATCH LOG THAT?'],
  },
  {
    id: 'flo',
    name: 'Sam',
    gag: 'carries a tote bag full of sourdough',
    signatureProp: 'tote',
    skin: 'skin1',
    hair: 'orange',
    hairStyle: 'curls',
    top: 'yellow',
    legs: 'blue',
    shoes: 'brown',
    catchphrases: ['MY STARTER IS CALLED KEVIN', 'FRESH FROM THE OVEN', 'CRUMB SHOT!', 'NAMED MY LOAF'],
  },
  {
    id: 'tom',
    name: 'Div',
    gag: 'is still talking about house prices',
    signatureProp: 'none',
    skin: 'skin1',
    hair: 'brown',
    hairStyle: 'side-part',
    top: 'navy',
    legs: 'stoneShade',
    shoes: 'brown',
    glasses: true,
    catchphrases: ['£650K FOR A STUDIO?!', 'MY RENT WENT UP AGAIN', 'BUY OR RENT, THOUGH?', 'HAVE YOU SEEN RIGHTMOVE?'],
  },
];
