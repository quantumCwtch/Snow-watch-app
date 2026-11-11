// Weather-suitable activity tables. At least 10 per scene category, so the daily
// seed can produce a different arrangement every day. `{n}` is replaced with the
// character's name. `prop` overrides the character's signature prop; omit it to
// keep the signature prop (cup, bike, tote...).
import type { SceneCategory, SceneVariant } from '../lib/types';
import type { PropId } from './props';

export type Anim = 'idle' | 'walk' | 'jog' | 'activity' | 'react' | 'sit' | 'lie' | 'shiver' | 'throw' | 'spin' | 'huddle';
export type Zone = 'steps' | 'portico' | 'fountain-left' | 'fountain-right' | 'lions' | 'plaza' | 'plaza-front' | 'column';

export interface Activity {
  id: string;
  text: string;
  anim: Anim;
  zone: Zone;
  prop?: PropId;
  bubble?: string;
}

const A = (id: string, text: string, anim: Anim, zone: Zone, prop?: PropId, bubble?: string): Activity => ({
  id, text, anim, zone, prop, bubble,
});

export const ACTIVITIES: Record<SceneCategory, Activity[]> = {
  snow: [
    A('snowball-fight', '{n} starts a snowball fight', 'throw', 'plaza', 'snowball', 'INCOMING!'),
    A('snow-angel', '{n} makes a snow angel by the fountain', 'lie', 'fountain-left', 'none', 'I AM AN ANGEL'),
    A('snow-nelson', '{n} builds a tiny snow Nelson', 'activity', 'column', 'none', 'KISS ME, HARDY'),
    A('sledging', '{n} sledges down the gallery steps on a tray', 'walk', 'steps', 'tray', 'WHEEE!'),
    A('filming-everyone', '{n} films everyone filming everyone else', 'activity', 'plaza', 'phone-up', 'POV: SNOW DAY'),
    A('catch-flakes', '{n} tries to catch snowflakes on their tongue', 'react', 'plaza-front', 'none', 'MMM, PIGEON-FLAVOURED'),
    A('lion-hat', '{n} gives a lion a snow hat', 'activity', 'lions', 'none', 'LOOKS SMART'),
    A('cancel-plans', '{n} cancels every plan "because of the weather"', 'idle', 'portico', 'phone-up', 'SO SORRY, SNOWED IN'),
    A('snow-dance', '{n} does a victory snow dance', 'spin', 'plaza', undefined, 'IT ACTUALLY SNOWED!'),
    A('pigeon-tracks', '{n} photographs pigeon footprints in the snow', 'activity', 'fountain-right', 'phone-up', 'SO AESTHETIC'),
    A('slip', '{n} slips over very gently', 'react', 'plaza-front', undefined, 'I MEANT THAT'),
    A('snowman-selfie', '{n} takes a selfie with a lopsided snowman', 'activity', 'plaza', 'phone-up', 'HIS NAME IS GARY'),
  ],
  'sleet-hail': [
    A('sleet-confusion', '{n} cannot decide if this counts as snow', 'idle', 'plaza', undefined, 'IS THIS SNOW?'),
    A('hood-up', '{n} hides under their hood', 'shiver', 'portico', 'none', 'BRRRR'),
    A('hail-dodge', '{n} dodges hailstones like a video game', 'jog', 'plaza', 'none', 'DODGE! DODGE!'),
    A('umbrella-huddle', '{n} huddles under an umbrella', 'huddle', 'portico', 'umbrella', 'MOVE UP'),
    A('slushy-shoes', '{n} mourns their suede trainers', 'idle', 'plaza-front', undefined, 'MY SUEDE!'),
    A('angry-forecast', '{n} argues with a weather app', 'activity', 'steps', 'phone-up', 'IT SAID SNOW!'),
    A('sleet-video', '{n} films "snow" for the group chat', 'activity', 'fountain-left', 'phone-up', 'IT COUNTS'),
    A('shelter-lion', '{n} shelters next to a lion', 'shiver', 'lions', undefined, 'GOOD KITTY'),
    A('hail-collect', '{n} collects hailstones in a cup', 'activity', 'fountain-right', 'cup', 'ARTISAN ICE'),
    A('wet-dog', '{n} shakes off like a wet dog', 'spin', 'plaza', undefined, 'SO DAMP'),
  ],
  thunder: [
    A('portico-shelter', '{n} shelters under the gallery portico', 'shiver', 'portico', undefined, 'NOPE NOPE NOPE'),
    A('lightning-photo', '{n} tries to photograph the lightning', 'activity', 'steps', 'phone-up', 'MISSED IT AGAIN'),
    A('count-seconds', '{n} counts the seconds after each flash', 'idle', 'plaza', undefined, 'ONE MISSISSIPPI...'),
    A('jump-scare', '{n} jumps at every rumble', 'react', 'plaza-front', undefined, 'AAARGH'),
    A('dramatic-pose', '{n} strikes a dramatic pose in the storm', 'react', 'column', undefined, 'I AM THE STORM'),
    A('cancel-picnic', '{n} cancels the picnic', 'idle', 'portico', 'phone-up', 'RAIN CHECK. LITERALLY'),
    A('umbrella-no', '{n} decides an umbrella is a bad idea', 'idle', 'steps', 'none', 'NOT TODAY, METAL STICK'),
    A('run-for-it', '{n} makes a run for the Tube', 'jog', 'plaza-front', 'none', 'SEE YOU!'),
    A('storm-watch', '{n} watches the storm with a hot drink', 'sit', 'portico', 'cup', 'COSY'),
    A('soaked-selfie', '{n} takes a soaked selfie', 'activity', 'fountain-left', 'phone-up', 'NATURAL LOOK'),
  ],
  'heavy-rain': [
    A('inside-out', "{n}'s umbrella turns inside out", 'react', 'plaza', 'umbrella-inside', 'NOOOO'),
    A('puddle-leap', '{n} attempts a heroic puddle leap', 'jog', 'plaza-front', undefined, 'I CAN MAKE IT'),
    A('portico-shelter', '{n} shelters under the gallery portico', 'huddle', 'portico', undefined, 'SCOOCH'),
    A('sodden-brunch', '{n} photographs a sodden brunch', 'activity', 'steps', 'phone-up', 'STILL CONTENT'),
    A('fountain-overflow', '{n} wonders which bit is the fountain now', 'idle', 'fountain-left', 'umbrella', 'IS IT ALL FOUNTAIN?'),
    A('wringing', '{n} wrings out a sock', 'activity', 'lions', 'none', 'SQUELCH'),
    A('bin-bag-coat', '{n} wears a bin bag as a raincoat', 'idle', 'plaza', 'bin-bag', 'IT IS FASHION'),
    A('lion-shelter', '{n} hides under a lion', 'shiver', 'lions', undefined, 'COSY LION'),
    A('splashed', '{n} gets splashed by the bus', 'react', 'plaza-front', 'umbrella', 'THANKS, NUMBER 24'),
    A('dash', '{n} dashes between shelters', 'jog', 'plaza', 'umbrella', 'NEARLY THERE'),
    A('rain-dance', '{n} gives up and dances in the rain', 'spin', 'column', 'none', 'ALREADY WET!'),
  ],
  'light-rain': [
    A('umbrella-stroll', '{n} strolls under an umbrella', 'walk', 'plaza', 'umbrella', 'SO LONDON'),
    A('puddle-dodge', '{n} dodges puddles', 'walk', 'plaza-front', undefined, 'LEFT, RIGHT, LEFT'),
    A('drizzle-denial', '{n} insists it is not really raining', 'idle', 'steps', undefined, 'THIS IS JUST MIST'),
    A('hood-up', '{n} puts their hood up and down repeatedly', 'activity', 'plaza', 'none', 'UP. DOWN. UP.'),
    A('portico-chat', '{n} chats under the portico', 'idle', 'portico', undefined, 'SHALL WE GET A COFFEE?'),
    A('wet-bench', '{n} sits on a wet bench by mistake', 'react', 'fountain-right', undefined, 'OH NO'),
    A('raindrop-video', '{n} films raindrops in the fountain', 'activity', 'fountain-left', 'phone-up', 'SO CALMING'),
    A('weather-app', '{n} checks the radar every 30 seconds', 'activity', 'lions', 'phone-up', 'STOPS AT 3, APPARENTLY'),
    A('shared-umbrella', '{n} shares an umbrella, badly', 'huddle', 'plaza', 'umbrella', 'YOU HAVE ALL OF IT'),
    A('soggy-loaf', '{n} protects the sourdough at all costs', 'shiver', 'steps', 'tote', 'NOT THE BREAD'),
    A('jog-anyway', '{n} jogs in the drizzle', 'jog', 'plaza-front', undefined, 'REFRESHING!'),
  ],
  fog: [
    A('bump', '{n} bumps into someone in the fog', 'react', 'plaza', undefined, 'OOF, SORRY'),
    A('phone-torch', '{n} navigates by phone torch', 'walk', 'plaza', 'torch', 'HELLO?'),
    A('lost', '{n} is completely lost', 'walk', 'plaza-front', undefined, 'WHERE IS THE COLUMN?'),
    A('where-nelson', '{n} cannot see Nelson at all', 'idle', 'column', undefined, 'NELSON? YOU UP?'),
    A('moody-photos', '{n} takes moody fog photos', 'activity', 'fountain-left', 'phone-up', 'VERY GOTHIC'),
    A('foghorn', '{n} does a foghorn impression', 'react', 'steps', undefined, 'BWAAAAMP'),
    A('hold-hands', '{n} forms a human chain', 'walk', 'plaza', 'none', 'NOBODY LET GO'),
    A('lion-surprise', '{n} is startled by a lion', 'react', 'lions', undefined, 'WHO PUT THAT THERE?'),
    A('marco-polo', '{n} plays Marco Polo', 'walk', 'fountain-right', 'none', 'MARCO!'),
    A('ghost-story', '{n} tells a ghost story', 'idle', 'portico', undefined, 'AND THEN...'),
  ],
  wind: [
    A('hat-chase', '{n} chases a runaway hat', 'jog', 'plaza', 'hat-flying', 'COME BACK!'),
    A('kite-fail', "{n}'s kite will not fly (somehow)", 'activity', 'plaza', 'kite', 'IT IS LITERALLY WINDY'),
    A('tote-escape', "{n}'s tote bag makes a break for it", 'jog', 'plaza-front', 'bag-escaping', 'MY SOURDOUGH!'),
    A('hair-chaos', "{n}'s hair has a mind of its own", 'shiver', 'steps', undefined, 'I CANNOT SEE'),
    A('lean', '{n} leans into the wind at 45 degrees', 'walk', 'plaza', undefined, 'WALKING ON THE MOON'),
    A('umbrella-flip', "{n}'s umbrella flips instantly", 'react', 'plaza-front', 'umbrella-inside', 'FOUR POUNDS, WASTED'),
    A('fountain-spray', '{n} gets sprayed by the fountain', 'react', 'fountain-right', undefined, 'WRONG SIDE!'),
    A('lion-hold', '{n} holds on to a lion', 'shiver', 'lions', undefined, 'HOLD ME, LION'),
    A('scarf-flap', "{n}'s scarf slaps them in the face", 'react', 'steps', 'scarf', 'RUDE'),
    A('wind-selfie', '{n} attempts a windswept selfie', 'activity', 'column', 'phone-up', 'EDITORIAL!'),
  ],
  overcast: [
    A('complain', '{n} complains about the weather', 'idle', 'plaza', undefined, 'SO GREY, THOUGH'),
    A('weather-app', '{n} stares at a weather app', 'activity', 'steps', 'phone-up', 'IT SAYS 0% SUN'),
    A('refill', '{n} gets a flat white refill', 'walk', 'plaza', 'cup', 'REFILL O CLOCK'),
    A('brunch-debate', '{n} debates where to get brunch', 'idle', 'portico', undefined, 'IS THERE A QUEUE?'),
    A('gallery-visit', '{n} pops into the gallery "for culture"', 'walk', 'steps', undefined, 'MOSTLY FOR THE CAFE'),
    A('pigeon-chat', '{n} has a chat with a pigeon', 'idle', 'fountain-left', undefined, 'HEY, BUDDY'),
    A('laptop', '{n} answers emails on the steps', 'sit', 'steps', 'laptop', 'PER MY LAST EMAIL'),
    A('lion-photo', '{n} poses with a lion', 'activity', 'lions', 'phone-up', 'GRR'),
    A('people-watch', '{n} people-watches by the fountain', 'sit', 'fountain-right', undefined, 'NICE TRAINERS'),
    A('lap', '{n} does laps of the column', 'jog', 'column', undefined, 'LAP 12'),
    A('vitamin-d', '{n} explains vitamin D supplements', 'idle', 'plaza-front', undefined, 'TAKE 1000 IU'),
  ],
  'partly-cloudy': [
    A('sun-chase', '{n} follows a patch of sunshine', 'walk', 'plaza', undefined, 'IT MOVED AGAIN'),
    A('cloud-shapes', '{n} spots shapes in the clouds', 'idle', 'fountain-left', undefined, 'THAT ONE IS A CROISSANT'),
    A('picnic-maybe', '{n} lays out a cautious picnic', 'sit', 'steps', 'blanket', 'IS IT WARM ENOUGH?'),
    A('photo-wait', '{n} waits for the sun to come out for a photo', 'activity', 'column', 'phone-up', 'COME ON, SUN'),
    A('frisbee', '{n} throws a frisbee', 'throw', 'plaza', 'frisbee', 'CATCH!'),
    A('jacket-on-off', '{n} puts a jacket on, then off, then on', 'activity', 'plaza-front', undefined, 'LAYERS'),
    A('busker', '{n} watches a busker', 'idle', 'portico', undefined, 'THIS IS A BOP'),
    A('fountain-sit', '{n} sits on the fountain edge', 'sit', 'fountain-right', undefined, 'NICE AND BREEZY'),
    A('lion-climb', '{n} considers climbing a lion', 'idle', 'lions', undefined, 'IS THIS ALLOWED?'),
    A('jog', '{n} jogs between clouds', 'jog', 'plaza', undefined, 'SUN LAP!'),
  ],
  sunny: [
    A('picnic', '{n} has a picnic on the steps', 'sit', 'steps', 'blanket', 'PASS THE HOUMOUS'),
    A('lion-selfie', '{n} takes a selfie with the lions', 'activity', 'lions', 'phone-up', 'SQUAD'),
    A('iced-queue', '{n} queues for an iced coffee', 'idle', 'portico', 'iced', 'OAT, ICED, LARGE'),
    A('frisbee', '{n} plays frisbee', 'throw', 'plaza', 'frisbee', 'MINE!'),
    A('sunbathe', '{n} sunbathes on the fountain edge', 'lie', 'fountain-left', 'sunglasses', 'GLOWING'),
    A('golden-hour', '{n} chases the perfect light', 'activity', 'column', 'phone-up', 'GOLDEN HOUR!'),
    A('ice-cream', '{n} eats an ice cream too fast', 'react', 'plaza-front', 'ice-cream', 'BRAIN FREEZE'),
    A('fountain-feet', '{n} dangles their feet in the fountain', 'sit', 'fountain-right', 'none', 'HEAVEN'),
    A('sunnies', '{n} wears sunglasses indoors and out', 'idle', 'plaza', 'sunglasses', 'SUMMER MODE'),
    A('run-club', '{n} leads a run club', 'jog', 'plaza', undefined, 'KEEP UP!'),
    A('reading', '{n} reads a very thick novel on the steps', 'sit', 'steps', 'none', 'CHAPTER 2 OF 80'),
  ],
  unknown: [
    A('look-up', '{n} looks up, unsure what the sky is doing', 'idle', 'plaza', undefined, 'IS THAT CLOUD?'),
    A('weather-app', '{n} refreshes a weather app', 'activity', 'steps', 'phone-up', 'LOADING...'),
    A('jacket-debate', '{n} cannot decide on a jacket', 'activity', 'plaza-front', undefined, 'COAT OR NO COAT?'),
    A('people-watch', '{n} people-watches', 'sit', 'fountain-right', undefined, 'NICE TRAINERS'),
    A('pigeon-chat', '{n} chats with a pigeon', 'idle', 'fountain-left', undefined, 'WHAT IS IT DOING UP THERE?'),
    A('lap', '{n} does laps of the column', 'jog', 'column', undefined, 'LAP 7'),
    A('gallery', '{n} heads into the gallery', 'walk', 'steps', undefined, 'CULTURE TIME'),
    A('lion-photo', '{n} poses with a lion', 'activity', 'lions', 'phone-up', 'GRR'),
    A('brunch', '{n} debates brunch spots', 'idle', 'portico', undefined, 'BOTTOMLESS?'),
    A('stroll', '{n} strolls about', 'walk', 'plaza', undefined, 'LOVELY DAY. PROBABLY.'),
  ],
};

/** Extra activities for sunny sub-variants, mixed into the sunny table. */
export const VARIANT_EXTRAS: Partial<Record<SceneVariant, Activity[]>> = {
  hot: [
    A('fan', '{n} fans themself dramatically', 'shiver', 'portico', 'fan', 'I AM MELTING'),
    A('shade', '{n} hides in the shade of the column', 'sit', 'column', undefined, 'SHADE IS FREE'),
    A('fountain-paddle', '{n} considers getting in the fountain', 'idle', 'fountain-left', undefined, 'JUST MY TOES?'),
  ],
  'cold-bright': [
    A('breath-clouds', '{n} makes dragon breath clouds', 'activity', 'plaza', undefined, 'RAWR'),
    A('hand-warm', '{n} warms their hands on a coffee', 'shiver', 'steps', 'cup', 'CRISP!'),
    A('scarf', '{n} is 80% scarf', 'idle', 'lions', 'scarf', 'BRACING'),
  ],
};
