// Curated emoji set for the ChatMize composer picker.
// Format per entry: [emoji, name, keywords]. Kept intentionally compact so the
// picker chunk stays small (lazy loaded, never in the initial page load).

export interface EmojiEntry {
  e: string;
  n: string;
  k: string;
}

export interface EmojiCategory {
  id: string;
  label: string;
  icon: string;
  emojis: EmojiEntry[];
}

const sm = (e: string, n: string, k = ''): EmojiEntry => ({ e, n, k: k || n });

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys', label: 'Smileys', icon: '😀',
    emojis: [
      sm('😀', 'grinning face', 'grin smile happy'), sm('😁', 'beaming face', 'grin smile happy teeth'),
      sm('😂', 'laughing', 'lol laugh tears funny'), sm('🤣', 'rolling on the floor laughing', 'rofl lol funny'),
      sm('😊', 'smiling face with smiling eyes', 'smile happy warm'), sm('😍', 'heart eyes', 'love crush'),
      sm('😎', 'cool face', 'sunglasses cool'), sm('🤩', 'star struck', 'excited wow star'),
      sm('😉', 'winking face', 'wink flirt'), sm('😋', 'yummy face', 'tasty delicious yum'),
      sm('🤔', 'thinking face', 'think hmm'), sm('🤗', 'hugging face', 'hug care'),
      sm('🤫', 'shushing face', 'quiet secret'), sm('🫡', 'saluting face', 'salute respect'),
      sm('😴', 'sleeping face', 'sleep tired'), sm('😭', 'loudly crying face', 'cry tears sad'),
      sm('😡', 'angry face', 'mad angry'), sm('🥳', 'partying face', 'party celebrate birthday'),
      sm('🤯', 'mind blown', 'wow shocked'), sm('😇', 'angel', 'innocent halo'),
      sm('🤠', 'cowboy', 'yeehaw'), sm('🥸', 'disguised face', 'incognito'),
      sm('🙂', 'slightly smiling face', 'smile ok'), sm('🙃', 'upside down face', 'silly sarcasm'),
      sm('😌', 'relieved face', 'calm peace'), sm('🤤', 'drooling face', 'drool hungry'),
    ],
  },
  {
    id: 'gestures', label: 'Gestures', icon: '👍',
    emojis: [
      sm('👍', 'thumbs up', 'like approve yes'), sm('👎', 'thumbs down', 'dislike no'),
      sm('👏', 'clapping hands', 'applause bravo'), sm('🙌', 'raising hands', 'celebrate hooray'),
      sm('🤝', 'handshake', 'deal agreement'), sm('🙏', 'folded hands', 'please thanks pray'),
      sm('💪', 'flexed biceps', 'strong muscle'), sm('👋', 'waving hand', 'hello hi bye'),
      sm('✌️', 'victory hand', 'peace'), sm('🤞', 'crossed fingers', 'luck hope'),
      sm('👀', 'eyes', 'look see watch'), sm('💯', 'hundred points', '100 perfect score'),
      sm('✊', 'fist', 'power'), sm('🫶', 'heart hands', 'love care'),
      sm('👇', 'pointing down', 'down below'), sm('👆', 'pointing up', 'up above'),
      sm('👉', 'pointing right', 'right next'), sm('☝️', 'pointing up index', 'one point'),
      sm('🫵', 'pointing at viewer', 'you'), sm('🤙', 'call me hand', 'shaka hang loose'),
    ],
  },
  {
    id: 'hearts', label: 'Hearts', icon: '❤️',
    emojis: [
      sm('❤️', 'red heart', 'love'), sm('🧡', 'orange heart', 'love'), sm('💛', 'yellow heart', 'love'),
      sm('💚', 'green heart', 'love'), sm('💙', 'blue heart', 'love'), sm('💜', 'purple heart', 'love'),
      sm('🖤', 'black heart', 'love'), sm('🤍', 'white heart', 'love'), sm('💔', 'broken heart', 'heartbreak sad'),
      sm('💕', 'two hearts', 'love'), sm('💖', 'sparkling heart', 'love sparkle'), sm('💘', 'heart with arrow', 'cupid love'),
      sm('💝', 'heart with ribbon', 'gift love'), sm('💞', 'revolving hearts', 'love'), sm('❣️', 'heart exclamation', 'love'),
      sm('💟', 'heart decoration', 'love'), sm('♥️', 'heart suit', 'cards love'), sm('🫀', 'anatomical heart', 'heart organ'),
    ],
  },
  {
    id: 'nature', label: 'Nature', icon: '🌿',
    emojis: [
      sm('🌿', 'herb', 'plant nature'), sm('🍀', 'four leaf clover', 'luck'), sm('🌸', 'cherry blossom', 'flower spring'),
      sm('🌹', 'rose', 'flower love'), sm('🌻', 'sunflower', 'flower summer'), sm('🌵', 'cactus', 'desert'),
      sm('🌴', 'palm tree', 'tropical beach'), sm('🐶', 'dog', 'puppy pet'), sm('🐱', 'cat', 'kitten pet'),
      sm('🦁', 'lion', 'king'), sm('🐯', 'tiger', ''), sm('🦊', 'fox', ''), sm('🐼', 'panda', ''),
      sm('🐝', 'bee', 'honey'), sm('🦋', 'butterfly', ''), sm('🐢', 'turtle', 'slow'),
      sm('🌊', 'wave', 'ocean surf'), sm('🔥', 'fire', 'hot lit'), sm('⭐', 'star', 'favorite'),
      sm('🌙', 'crescent moon', 'night'), sm('☀️', 'sun', 'sunny day'), sm('🌈', 'rainbow', 'pride'),
      sm('❄️', 'snowflake', 'winter cold'), sm('⚡', 'lightning', 'fast electric'),
    ],
  },
  {
    id: 'food', label: 'Food', icon: '🍕',
    emojis: [
      sm('🍕', 'pizza', 'food'), sm('🍔', 'burger', 'food'), sm('🌮', 'taco', 'mexican food'),
      sm('🍩', 'donut', 'sweet'), sm('🍰', 'cake', 'birthday dessert'), sm('🧁', 'cupcake', 'dessert'),
      sm('🍦', 'ice cream', 'dessert'), sm('☕', 'coffee', 'morning'), sm('🍵', 'tea', 'matcha'),
      sm('🍷', 'wine', 'cheers'), sm('🍺', 'beer', 'cheers'), sm('🥂', 'clinking glasses', 'cheers toast celebrate'),
      sm('🍾', 'champagne', 'celebrate party'), sm('🥑', 'avocado', 'healthy'), sm('🍓', 'strawberry', 'fruit'),
      sm('🍇', 'grapes', 'fruit wine'), sm('🥐', 'croissant', 'breakfast french'), sm('🍿', 'popcorn', 'movie snack'),
      sm('🎂', 'birthday cake', 'birthday celebrate'), sm('🍫', 'chocolate', 'sweet'),
    ],
  },
  {
    id: 'activity', label: 'Activity', icon: '⚽',
    emojis: [
      sm('⚽', 'soccer', 'football sport'), sm('🏀', 'basketball', 'sport'), sm('🏈', 'american football', 'sport'),
      sm('⚾', 'baseball', 'sport'), sm('🎾', 'tennis', 'sport'), sm('🏊', 'swimming', 'pool sport'),
      sm('🚴', 'cycling', 'bike'), sm('🏃', 'running', 'run jog'), sm('🧘', 'yoga', 'meditate zen'),
      sm('🎮', 'video game', 'gaming'), sm('🎲', 'dice', 'game random'), sm('🎯', 'target', 'bullseye goal'),
      sm('🏆', 'trophy', 'win champion'), sm('🥇', 'gold medal', 'first win'), sm('🎨', 'art', 'paint creative'),
      sm('🎭', 'theater', 'drama'), sm('🎬', 'clapper board', 'movie film'), sm('🎤', 'microphone', 'sing karaoke'),
      sm('🎧', 'headphones', 'music listen'), sm('🎹', 'piano', 'music'),
    ],
  },
  {
    id: 'travel', label: 'Travel', icon: '✈️',
    emojis: [
      sm('✈️', 'airplane', 'travel flight'), sm('🚗', 'car', 'drive'), sm('🚕', 'taxi', ''),
      sm('🚌', 'bus', ''), sm('🚂', 'train', ''), sm('🚢', 'ship', 'cruise'),
      sm('🏝️', 'island', 'tropical vacation'), sm('🏖️', 'beach', 'vacation summer'), sm('🗽', 'statue of liberty', 'nyc'),
      sm('🗼', 'tokyo tower', 'japan'), sm('🏰', 'castle', ''), sm('🎡', 'ferris wheel', 'carnival'),
      sm('🧳', 'luggage', 'travel pack'), sm('🗺️', 'map', 'travel direction'), sm('🧭', 'compass', 'direction'),
      sm('🏕️', 'camping', 'tent outdoors'), sm('⛺', 'tent', 'camping'),
    ],
  },
  {
    id: 'objects', label: 'Objects', icon: '💡',
    emojis: [
      sm('💡', 'light bulb', 'idea'), sm('📱', 'phone', 'mobile iphone'), sm('💻', 'laptop', 'computer work'),
      sm('⌚', 'watch', 'time'), sm('📷', 'camera', 'photo'), sm('🎁', 'gift', 'present'),
      sm('🛍️', 'shopping bags', 'shop retail'), sm('💰', 'money bag', 'cash rich'), sm('💳', 'credit card', 'pay'),
      sm('💎', 'gem', 'diamond luxury'), sm('🔑', 'key', 'access'), sm('🔒', 'lock', 'secure private'),
      sm('🔓', 'unlock', 'open'), sm('📦', 'package', 'delivery box'), sm('🚚', 'truck', 'delivery shipping'),
      sm('✉️', 'envelope', 'email mail'), sm('📣', 'megaphone', 'announce'), sm('📢', 'loudspeaker', 'announce'),
      sm('🔔', 'bell', 'notify alert'), sm('⏰', 'alarm clock', 'time reminder'), sm('📅', 'calendar', 'date schedule'),
      sm('📌', 'pushpin', 'pin'), sm('✂️', 'scissors', 'cut'), sm('🧲', 'magnet', 'attract'),
    ],
  },
  {
    id: 'symbols', label: 'Symbols', icon: '✅',
    emojis: [
      sm('✅', 'check mark', 'done yes correct'), sm('❌', 'cross mark', 'no wrong'), sm('⚠️', 'warning', 'caution alert'),
      sm('❓', 'question mark', 'help'), sm('❗', 'exclamation', 'important'), sm('💬', 'speech bubble', 'chat message'),
      sm('💭', 'thought bubble', 'think'), sm('🗨️', 'left speech bubble', 'chat'), sm('📈', 'chart up', 'growth'),
      sm('📉', 'chart down', 'decline'), sm('💹', 'chart yen', 'stocks'), sm('🎉', 'party popper', 'celebrate congrats'),
      sm('🎊', 'confetti ball', 'celebrate'), sm('✨', 'sparkles', 'shine new magic'), sm('💥', 'collision', 'boom'),
      sm('🚀', 'rocket', 'launch fast growth'), sm('👑', 'crown', 'king vip'), sm('🏅', 'medal', 'award'),
      sm('🎖️', 'military medal', 'honor'), sm('💼', 'briefcase', 'work business'), sm('🤖', 'robot', 'bot ai'),
      sm('👻', 'ghost', 'snapchat'), sm('💀', 'skull', 'dead'), sm('🎃', 'pumpkin', 'halloween'),
      sm('🎄', 'christmas tree', 'holiday'), sm('🙌', 'praise', 'celebrate'), sm('🆕', 'new button', 'new'),
      sm('🆓', 'free button', 'free'), sm('🈹', 'discount', 'sale deal'), sm('💲', 'dollar', 'money price'),
    ],
  },
];

export const ALL_EMOJIS: EmojiEntry[] = EMOJI_CATEGORIES.flatMap((c) => c.emojis);
