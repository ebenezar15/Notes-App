/*
 * Inkwell Proofreader — a fully offline, rule-based writing checker.
 *
 * check(text, opts)  -> list of issues { start, end, original, replacement, message, category, rule }
 * fixAll(text, opts) -> text with every auto-fixable issue applied (iterates until stable)
 * stats(text)        -> word / sentence / readability statistics
 *
 * An issue with replacement === null is advisory only (e.g. "long sentence").
 * Works in the browser (window.Proofreader) and in Node (module.exports) for tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Proofreader = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATEGORIES = ['spelling', 'grammar', 'punctuation', 'style', 'typography'];
  const PRIORITY = { spelling: 0, grammar: 1, punctuation: 2, typography: 3, style: 4 };

  // ---------------------------------------------------------------- helpers
  function matchCase(src, rep) {
    if (!rep) return rep;
    if (src.length > 1 && src === src.toUpperCase() && /[A-Z]/.test(src)) return rep.toUpperCase();
    if (/^[A-Z]/.test(src)) return rep.charAt(0).toUpperCase() + rep.slice(1);
    return rep;
  }

  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function protectedRanges(text) {
    const ranges = [];
    const re = /\b(?:https?:\/\/|www\.)[^\s<>"]+|[\w.+-]+@[\w-]+\.[\w.-]+|`[^`]*`|#[\w-]+|@\w+/g;
    let m;
    while ((m = re.exec(text))) ranges.push([m.index, m.index + m[0].length]);
    return ranges;
  }

  const isProtected = (ranges, s, e) => ranges.some(([a, b]) => s < b && e > a);

  // ---------------------------------------------------------------- dictionaries
  const MISSPELLINGS = {
    abscence: 'absence', accross: 'across', acheive: 'achieve', acheived: 'achieved', accomodate: 'accommodate',
    accomodation: 'accommodation', acknowlege: 'acknowledge', adress: 'address', agressive: 'aggressive',
    alot: 'a lot', allready: 'already', amature: 'amateur', apparant: 'apparent',
    apparantly: 'apparently', arguement: 'argument', assasination: 'assassination', athiest: 'atheist',
    awfull: 'awful', basicly: 'basically', becuase: 'because', becasue: 'because', beacuse: 'because',
    begining: 'beginning', beleive: 'believe', beleived: 'believed', belive: 'believe', bizzare: 'bizarre',
    buisness: 'business', calender: 'calendar', carribean: 'Caribbean', catagory: 'category', cemetary: 'cemetery',
    changable: 'changeable', cheif: 'chief', collegue: 'colleague', comming: 'coming', commited: 'committed',
    comittee: 'committee', completly: 'completely', concious: 'conscious', curiousity: 'curiosity',
    definately: 'definitely', definatly: 'definitely', definetly: 'definitely', dilemna: 'dilemma',
    dissapear: 'disappear', dissapoint: 'disappoint', dissapointed: 'disappointed', doesnt: "doesn't",
    dont: "don't", didnt: "didn't", isnt: "isn't", wasnt: "wasn't", werent: "weren't", arent: "aren't",
    havent: "haven't", hasnt: "hasn't", hadnt: "hadn't", couldnt: "couldn't", wouldnt: "wouldn't",
    shouldnt: "shouldn't", cant: "can't", wont: "won't", im: "I'm", ive: "I've", youre: "you're",
    theyre: "they're", thats: "that's", whats: "what's", theres: "there's", wheres: "where's",
    whos: "who's", youve: "you've", youll: "you'll", theyve: "they've", theyll: "they'll", weve: "we've",
    shes: "she's", hes: "he's", eachother: 'each other', embarass: 'embarrass', embarassed: 'embarrassed',
    embarassing: 'embarrassing', enviroment: 'environment', excercise: 'exercise', existance: 'existence',
    experiance: 'experience', familar: 'familiar', finaly: 'finally', florescent: 'fluorescent',
    foriegn: 'foreign', foward: 'forward', freind: 'friend', freinds: 'friends', fullfil: 'fulfil',
    gaurd: 'guard', goverment: 'government', grammer: 'grammar', gratefull: 'grateful', greatful: 'grateful',
    harrass: 'harass', happend: 'happened', heighth: 'height', hieght: 'height', humourous: 'humorous',
    hygene: 'hygiene', ignorence: 'ignorance', immediatly: 'immediately', incase: 'in case',
    independant: 'independent', indispensible: 'indispensable', intresting: 'interesting',
    interupt: 'interrupt', irrelevent: 'irrelevant', jewelery: 'jewelry', 
    knowlege: 'knowledge', liason: 'liaison', libary: 'library', lisence: 'license', maintainance: 'maintenance',
    millenium: 'millennium', mischievious: 'mischievous', mispell: 'misspell', mispelled: 'misspelled',
    neccessary: 'necessary', necessery: 'necessary', neice: 'niece', nieghbor: 'neighbor', noone: 'no one',
    noticable: 'noticeable', occassion: 'occasion', occured: 'occurred', occurence: 'occurrence',
    occuring: 'occurring', ommit: 'omit', oppurtunity: 'opportunity',
    orignal: 'original', paralel: 'parallel', particurly: 'particularly', pasttime: 'pastime',
    peice: 'piece', percieve: 'perceive', perseverence: 'perseverance', persue: 'pursue', posession: 'possession',
    potatos: 'potatoes', prefered: 'preferred', presance: 'presence', privelege: 'privilege',
    probaly: 'probably', proffesional: 'professional', profesional: 'professional', promiss: 'promise',
    pronounciation: 'pronunciation', publically: 'publicly', questionaire: 'questionnaire', realy: 'really',
    reccomend: 'recommend', recomend: 'recommend', reciept: 'receipt', recieve: 'receive', recieved: 'received',
    refered: 'referred', relevent: 'relevant', religous: 'religious', remeber: 'remember', repitition: 'repetition',
    resistence: 'resistance', responsability: 'responsibility', restaraunt: 'restaurant', rythm: 'rhythm',
    scedule: 'schedule', seige: 'siege', sentance: 'sentence', seperate: 'separate', seperately: 'separately',
    sieze: 'seize', similiar: 'similar', sincerly: 'sincerely', speach: 'speech', strenght: 'strength',
    succesful: 'successful', successfull: 'successful', sucess: 'success', supercede: 'supersede',
    suprise: 'surprise', suprised: 'surprised', tatoo: 'tattoo', teh: 'the', tendancy: 'tendency',
    therefor: 'therefore', thier: 'their', threshhold: 'threshold', tommorow: 'tomorrow', tommorrow: 'tomorrow',
    tomorow: 'tomorrow', tounge: 'tongue', truely: 'truly', twelth: 'twelfth', tyrany: 'tyranny',
    underate: 'underrate', untill: 'until', unforseen: 'unforeseen', unfortunatly: 'unfortunately',
    usualy: 'usually', vaccum: 'vacuum', vegatable: 'vegetable', vehical: 'vehicle', visable: 'visible',
    wierd: 'weird', wich: 'which', wellfare: 'welfare', whereever: 'wherever', wether: 'whether',
    writting: 'writing', writen: 'written', yeild: 'yield', youself: 'yourself', recieving: 'receiving',
    begininng: 'beginning', beutiful: 'beautiful', beautifull: 'beautiful', buisiness: 'business',
    acommodate: 'accommodate', accidently: 'accidentally', adn: 'and', hte: 'the', taht: 'that',
    waht: 'what', wiht: 'with', jsut: 'just', thsi: 'this', becomeing: 'becoming', bascially: 'basically',
    comunity: 'community', communtiy: 'community', definitly: 'definitely', diffrent: 'different',
    exellent: 'excellent', excelent: 'excellent', explaination: 'explanation', guarentee: 'guarantee',
    hapen: 'happen', hapened: 'happened', importent: 'important', intrest: 'interest', knowledgable: 'knowledgeable',
    lenght: 'length', liek: 'like', mabye: 'maybe', manuever: 'maneuver', newletter: 'newsletter',
    newsleter: 'newsletter', ocasion: 'occasion', peopel: 'people', poeple: 'people',
    recogize: 'recognize', sterotype: 'stereotype', strategey: 'strategy', subscibe: 'subscribe',
    subcribe: 'subscribe', subscirbe: 'subscribe', techinque: 'technique', thougth: 'thought', throught: 'through',
    togehter: 'together', tradgedy: 'tragedy', unecessary: 'unnecessary', unneccessary: 'unnecessary',
    wanna: 'want to', gonna: 'going to', gotta: 'have to', irregardless: 'regardless',
  };

  const INFORMAL = new Set(['wanna', 'gonna', 'gotta']);

  const PROPER = {
    monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday',
    saturday: 'Saturday', sunday: 'Sunday', january: 'January', february: 'February', april: 'April',
    june: 'June', july: 'July', september: 'September', october: 'October', november: 'November',
    december: 'December', english: 'English', french: 'French', spanish: 'Spanish', german: 'German',
    american: 'American', british: 'British', european: 'European', christmas: 'Christmas',
    substack: 'Substack', youtube: 'YouTube', github: 'GitHub', linkedin: 'LinkedIn', javascript: 'JavaScript',
    iphone: 'iPhone', ipad: 'iPad', macos: 'macOS', google: 'Google', instagram: 'Instagram', facebook: 'Facebook',
  };

  // [pattern, replacement (string|fn), message, category, guard?]
  const PHRASES = [
    [/\b(could|would|should|must|might|may) of\b/gi, (m, a) => `${a} have`, 'Use "have" after modal verbs ("could have").', 'grammar'],
    [/\b(more|less|better|worse|rather|other|greater|fewer|larger|smaller|higher|lower|faster|slower|older|younger|bigger|easier|harder) then\b/gi,
      (m, a) => `${a} than`, 'Use "than" for comparisons.', 'grammar'],
    [/\b(more|less|fewer|better|worse|rather|other) (\w+) then (I|we|you|they|he|she|it|ever|expected|before|usual|anyone|anything|most|last)\b/gi,
      (m, a, b, c) => `${a} ${b} than ${c}`, 'Use "than" for comparisons.', 'grammar'],
    [/\byour welcome\b/gi, () => "you're welcome", 'Did you mean "you\'re" (you are)?', 'grammar'],
    [/\byour (going|doing|being|not|gonna|always|never|probably|definitely)\b/gi, (m, a) => `you're ${a}`, 'Did you mean "you\'re" (you are)?', 'grammar'],
    [/\bits (a|an|the|been|not|going|important|clear|true|hard|easy|okay|just|so|very|really|about|like|never|always|also|still)\b/g,
      (m, a) => `it's ${a}`, 'Did you mean "it\'s" (it is / it has)?', 'grammar'],
    [/\bIts (a|an|the|been|not|going|important|clear|true|hard|easy|okay|just|so|very|really|about|like|never|always|also|still)\b/g,
      (m, a) => `It's ${a}`, 'Did you mean "It\'s" (it is / it has)?', 'grammar'],
    [/\bit's own\b/gi, () => 'its own', 'Possessive "its" has no apostrophe.', 'grammar'],
    [/\btheir (is|are|was|were)\b/gi, (m, a) => `there ${a}`, 'Did you mean "there"?', 'grammar'],
    [/\bthere (own|going|doing)\b/gi, (m, a) => (a.toLowerCase() === 'own' ? 'their own' : `they're ${a}`), 'Did you mean "their" or "they\'re"?', 'grammar'],
    [/\b(he|she|it) don't\b/gi, (m, a) => `${a} doesn't`, 'Use "doesn\'t" with he/she/it.', 'grammar'],
    [/\b(he|she|it) have\b/gi, (m, a) => `${a} has`, 'Use "has" with he/she/it.', 'grammar',
      (text, idx) => !/\b(would|could|should|might|may|must|will|can|did|does|do|to|shall|why)\s+$/i.test(text.slice(Math.max(0, idx - 12), idx))],
    [/\b(he|she|it) are\b/gi, (m, a) => `${a} is`, 'Use "is" with he/she/it.', 'grammar'],
    [/\b(they|we|you) was\b/gi, (m, a) => `${a} were`, 'Use "were" with they/we/you.', 'grammar'],
    [/\b(they|we|you) has\b/gi, (m, a) => `${a} have`, 'Use "have" with they/we/you.', 'grammar'],
    [/\bI has\b/g, () => 'I have', 'Use "have" with "I".', 'grammar'],
    [/\bI is\b/g, () => 'I am', 'Use "am" with "I".', 'grammar'],
    [/\bsuppose to\b/gi, () => 'supposed to', 'Did you mean "supposed to"?', 'grammar',
      (text, idx) => !/\b(I|we|you|they)\s+$/i.test(text.slice(Math.max(0, idx - 6), idx))],
    [/\bin regards to\b/gi, () => 'in regard to', '"In regard to" is the standard form.', 'grammar'],
    [/\bfor all intensive purposes\b/gi, () => 'for all intents and purposes', 'The idiom is "for all intents and purposes".', 'grammar'],
    [/\bcould care less\b/gi, () => "couldn't care less", 'The idiom is "couldn\'t care less".', 'grammar'],
    [/\bbetween you and I\b/gi, () => 'between you and me', 'Use "me" after a preposition.', 'grammar'],
    [/\bless (people|items|things|words|mistakes|errors|options|books|cars|users|posts|days|hours|minutes|times|readers|subscribers|ideas)\b/gi,
      (m, a) => `fewer ${a}`, 'Use "fewer" with countable nouns.', 'grammar'],
    [/\bamount of (people|users|readers|subscribers|things|items|posts|books|ideas)\b/gi, (m, a) => `number of ${a}`, 'Use "number of" with countable nouns.', 'grammar'],
    [/\bthe reason is because\b/gi, () => 'the reason is that', 'Avoid the redundant "reason is because".', 'grammar'],
    [/\bloose (weight|track|sleep|interest|focus)\b/gi, (m, a) => `lose ${a}`, 'Did you mean "lose"?', 'grammar'],
    [/\bdo to the fact\b/gi, () => 'due to the fact', 'Did you mean "due to"?', 'grammar'],
    [/\bshould(?:'ve| have) went\b/gi, (m) => m.replace(/went$/i, 'gone'), 'Use the past participle "gone".', 'grammar'],
    [/\bhave went\b/gi, () => 'have gone', 'Use the past participle "gone".', 'grammar'],
    [/\bvery unique\b/gi, () => 'unique', '"Unique" is absolute — drop "very".', 'style'],
  ];

  const WORDY = {
    'in order to': 'to', 'due to the fact that': 'because', 'at this point in time': 'now', 'in the event that': 'if',
    'a large number of': 'many', 'has the ability to': 'can', 'have the ability to': 'can', 'for the purpose of': 'for',
    'in spite of the fact that': 'although', 'despite the fact that': 'although', 'the majority of': 'most',
    'each and every': 'every', 'first and foremost': 'first', 'end result': 'result', 'past history': 'history',
    'free gift': 'gift', 'absolutely essential': 'essential', 'close proximity': 'proximity',
    'basic fundamentals': 'fundamentals', 'in the near future': 'soon', 'at the present time': 'now',
    'in close proximity to': 'near', 'with regard to': 'about', 'with respect to': 'about', 'on a daily basis': 'daily',
    'a number of': 'several', 'is able to': 'can', 'are able to': 'can', 'make a decision': 'decide',
    'came to the conclusion': 'concluded', 'it is important to note that': 'notably,', 'the fact that': 'that',
    'whether or not': 'whether', 'until such time as': 'until', 'prior to': 'before', 'subsequent to': 'after',
  };

  const VERY = {
    good: 'excellent', bad: 'terrible', big: 'enormous', large: 'huge', small: 'tiny', happy: 'delighted',
    sad: 'miserable', tired: 'exhausted', important: 'crucial', hard: 'difficult', easy: 'effortless',
    fast: 'rapid', quick: 'swift', old: 'ancient', cold: 'freezing', hot: 'scorching', beautiful: 'stunning',
    interesting: 'fascinating', scared: 'terrified', angry: 'furious', clear: 'obvious', smart: 'brilliant',
    often: 'frequently', simple: 'basic', tasty: 'delicious', loud: 'deafening', quiet: 'hushed',
    rich: 'wealthy', poor: 'destitute', strong: 'powerful', weak: 'feeble', different: 'distinct',
    surprised: 'astonished', worried: 'anxious', much: 'greatly', bright: 'brilliant', dark: 'pitch-black',
  };

  const FILLERS = ['really', 'basically', 'actually', 'literally', 'totally', 'definitely', 'honestly', 'simply', 'quite', 'somewhat'];

  const CLICHES = [
    'at the end of the day', 'think outside the box', 'low-hanging fruit', 'game changer', 'game-changer',
    'move the needle', 'circle back', 'it goes without saying', 'needless to say', "in today's world",
    'since the dawn of time', 'only time will tell', 'last but not least', 'avoid it like the plague',
    'when all is said and done', 'paradigm shift', 'a perfect storm', 'tip of the iceberg', 'in this day and age',
  ];

  const INTRO_WORDS = [
    'However', 'Therefore', 'Moreover', 'Furthermore', 'Meanwhile', 'Consequently', 'Nevertheless', 'Nonetheless',
    'Additionally', 'Unfortunately', 'Fortunately', 'Finally', 'Firstly', 'Secondly', 'Lastly', 'Instead',
    'Otherwise', 'Indeed', 'Similarly', 'Likewise', 'Ultimately', 'Interestingly', 'Surprisingly', 'Personally',
    'Of course', 'In fact', 'For example', 'For instance', 'In addition', 'In other words', 'On the other hand',
    'As a result', 'In conclusion', 'In short', 'After all', 'Admittedly', 'Ironically', 'Sadly', 'Luckily',
  ];
  const INTRO_BLOCKERS = /^(much|many|long|far|hard|often|little|few|you|of|than|that|to|is|was|are|were)\b/i;

  const ABBREVIATIONS = /(?:\b(?:e\.g|i\.e|etc|vs|mr|mrs|ms|dr|st|jr|sr|prof|approx|no|fig|vol|inc|ltd|co|a\.m|p\.m|u\.s|ca)\.)$/i;

  const PASSIVE_IRREGULAR = 'written|done|made|given|taken|seen|known|shown|built|chosen|driven|eaten|forgotten|hidden|broken|spoken|stolen|thrown|worn|begun|found|held|told|sold|sent|spent|paid|kept|left|lost|heard|said|thought|taught|bought|brought|caught|fought|won|drawn|grown|understood|forgiven|felt';
  const NOT_PASSIVE = new Set(['interested', 'tired', 'excited', 'bored', 'used', 'supposed', 'married', 'worried',
    'scared', 'pleased', 'satisfied', 'concerned', 'surprised', 'prepared', 'related', 'based', 'located',
    'involved', 'amazed', 'confused', 'convinced', 'determined', 'disappointed', 'embarrassed', 'exhausted',
    'frustrated', 'impressed', 'qualified', 'shocked', 'stressed', 'talented', 'thrilled', 'need', 'feed', 'red',
    'bed', 'shed', 'seed', 'speed', 'indeed', 'hundred', 'kindred', 'sacred', 'naked', 'wicked', 'aged',
    'crowded', 'detailed', 'advanced', 'complicated', 'dedicated', 'experienced', 'limited', 'organized',
    'sophisticated', 'balanced', 'connected', 'focused', 'motivated', 'inspired', 'obsessed', 'overwhelmed',
    'relaxed', 'scattered', 'unexpected', 'unprecedented', 'unrelated', 'unemployed', 'retired', 'closed', 'finished', 'done']);

  // ---------------------------------------------------------------- rules
  function ruleSpacing(text, add) {
    let m;
    const multi = /[  ]{2,}/g;
    while ((m = multi.exec(text))) {
      if (m.index === 0 || m.index + m[0].length === text.length) continue;
      add(m.index, m.index + m[0].length, ' ', 'Remove the extra space.', 'punctuation', 'multiple-spaces');
    }
    const before = /[  ]+(?=[,.;:!?](?:\s|$|["'”’)]))/g;
    while ((m = before.exec(text))) {
      if (m.index === 0 || /\s/.test(text[m.index - 1])) continue;
      if (text.slice(m.index + m[0].length, m.index + m[0].length + 3) === '...') continue;
      add(m.index, m.index + m[0].length, '', 'No space before punctuation.', 'punctuation', 'space-before-punct');
    }
    const floating = /(\w)[ \u00A0]+([,;:!?]|\.(?=[A-Z]))(?=[A-Za-z])/g;
    while ((m = floating.exec(text))) {
      const s = m.index + 1;
      add(s, m.index + m[0].length, m[2] + ' ', 'Punctuation belongs right after the word, followed by a space.', 'punctuation', 'space-before-punct');
    }
    const after = /([,;!?])(?=[A-Za-z])/g;
    while ((m = after.exec(text))) {
      add(m.index, m.index + 1, m[1] + ' ', 'Add a space after punctuation.', 'punctuation', 'space-after-punct');
    }
    const afterPeriod = /([a-z]{2,})\.(?=[A-Z][a-z])/g;
    while ((m = afterPeriod.exec(text))) {
      const i = m.index + m[1].length;
      add(i, i + 1, '. ', 'Add a space after the period.', 'punctuation', 'space-after-punct');
    }
    const afterColon = /([a-z]{2,}):(?=[A-Za-z]{2,})/g;
    while ((m = afterColon.exec(text))) {
      const i = m.index + m[1].length;
      add(i, i + 1, ': ', 'Add a space after the colon.', 'punctuation', 'space-after-punct');
    }
  }

  function rulePunctuation(text, add) {
    let m;
    const repeated = /([!?,;:])\1+/g;
    while ((m = repeated.exec(text))) {
      add(m.index, m.index + m[0].length, m[1], `Repeated "${m[1]}" — one is enough.`, 'punctuation', 'repeated-punct');
    }
    const dots = /\.{4,}/g;
    while ((m = dots.exec(text))) add(m.index, m.index + m[0].length, '...', 'An ellipsis has three dots.', 'punctuation', 'ellipsis');
    const twoDots = /(^|[^.])\.\.(?!\.)/g;
    while ((m = twoDots.exec(text))) {
      const i = m.index + m[1].length;
      add(i, i + 2, '.', 'Double period.', 'punctuation', 'double-period');
    }
    const commaPeriod = /[,;]\./g;
    while ((m = commaPeriod.exec(text))) add(m.index, m.index + 2, '.', 'Conflicting punctuation.', 'punctuation', 'comma-period');
    const etc = /\betc\b(?!\.)/g;
    while ((m = etc.exec(text))) add(m.index, m.index + 3, 'etc.', '"etc." needs a period.', 'punctuation', 'etc');
  }

  function ruleTypography(text, add) {
    let m;
    const dash = /(^|[^-])--(?!-)/g;
    while ((m = dash.exec(text))) {
      const i = m.index + m[1].length;
      add(i, i + 2, '—', 'Use an em dash.', 'typography', 'em-dash');
    }
    const spaced = /(\w) - (\w)/g;
    while ((m = spaced.exec(text))) {
      const i = m.index + 1;
      add(i, i + 3, ' — ', 'Use an em dash between clauses.', 'typography', 'em-dash');
      spaced.lastIndex = i + 2;
    }
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch !== '"' && ch !== "'") continue;
      const prev = i === 0 ? '' : text[i - 1];
      const opening = prev === '' || /[\s([{—–-]/.test(prev);
      let rep;
      if (ch === '"') rep = opening ? '“' : '”';
      else rep = opening ? '‘' : '’';
      add(i, i + 1, rep, 'Use typographic (curly) quotes.', 'typography', 'smart-quotes');
    }
  }

  function ruleCapitalization(text, add, ctx) {
    // Sentence starts.
    const starts = [];
    const first = /^[\s"'“‘([]*([a-z][\w'’-]*)/.exec(text);
    if (first) starts.push([first[0].length - first[1].length, first[1]]);
    const re = /([.!?])(["'”’)\]]*)\s+["'“‘([]*([a-z][\w'’-]*)/g;
    let m;
    while ((m = re.exec(text))) {
      const before = text.slice(0, m.index + 1);
      if (m[1] === '.' && (/\.\.\.$/.test(before) || ABBREVIATIONS.test(before))) continue;
      if (m[1] === '.' && /\b[A-Za-z]\.$/.test(before)) continue; // initials
      const wordStart = m.index + m[0].length - m[3].length;
      starts.push([wordStart, m[3]]);
    }
    for (const [idx, word] of starts) {
      if (/^[a-z]+[A-Z]/.test(word)) continue; // iPhone, eBay
      if (ctx.listItem && idx === 0 && !ctx.strictLists) continue;
      add(idx, idx + 1, word[0].toUpperCase(), 'Capitalize the first word of a sentence.', 'punctuation', 'capitalize-sentence');
    }

    // Lowercase "i".
    const iRe = /\bi\b/g;
    while ((m = iRe.exec(text))) {
      const prev = text[m.index - 1] || '';
      const next = text.slice(m.index + 1, m.index + 3);
      if (/[-./'’]/.test(prev) || /^\.[a-z]/i.test(next) || /^-/.test(next)) continue;
      add(m.index, m.index + 1, 'I', 'The pronoun "I" is always capitalized.', 'punctuation', 'capitalize-i');
    }

    // Proper nouns & brand names.
    const words = /\b[a-z][a-z]+\b/g;
    while ((m = words.exec(text))) {
      const rep = PROPER[m[0]];
      if (rep && rep !== m[0]) add(m.index, m.index + m[0].length, rep, `Capitalize "${rep}".`, 'spelling', 'proper-noun');
    }
  }

  function ruleEndPunctuation(text, add, ctx) {
    if (ctx.heading || ctx.listItem || ctx.code) return;
    const trimmed = text.replace(/\s+$/, '');
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length < 4) return;
    if (/[.!?…:;"'”’)\]]$/.test(trimmed)) return;
    if (!/[A-Za-z0-9]$/.test(trimmed)) return;
    const lastWord = /[\w'’-]+$/.exec(trimmed);
    const s = lastWord.index;
    add(s, trimmed.length, lastWord[0] + '.', 'End the sentence with punctuation.', 'punctuation', 'end-punct');
  }

  function ruleSpelling(text, add) {
    const re = /\b[A-Za-z]+\b/g;
    let m;
    while ((m = re.exec(text))) {
      const lower = m[0].toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(MISSPELLINGS, lower)) continue;
      // Words that are also legitimate when capitalised ("Hes" rarely) / common real words handled conservatively.
      if (lower === 'wont' && /\bas (?:is )?(?:\w+ )?wont\b/i.test(text.slice(Math.max(0, m.index - 12), m.index + 4))) continue;
      if (lower === 'cant' && m[0] === 'Cant') continue;
      let rep = MISSPELLINGS[lower];
      if (!/^I'/.test(rep)) rep = matchCase(m[0], rep);
      const informal = INFORMAL.has(lower);
      add(m.index, m.index + m[0].length, rep,
        informal ? `"${m[0]}" is informal — consider "${rep}".` : `Possible spelling mistake. Did you mean "${rep}"?`,
        informal ? 'style' : 'spelling', informal ? 'informal' : 'spelling');
    }
  }

  function ruleRepeatedWords(text, add) {
    const re = /\b(\w+)(\s+)\1\b/gi;
    let m;
    while ((m = re.exec(text))) {
      const w = m[1].toLowerCase();
      if (w === 'had' || w === 'that' || /^\d+$/.test(w)) continue;
      add(m.index, m.index + m[0].length, m[1], `Repeated word: "${m[1]}".`, 'grammar', 'repeated-word');
    }
  }

  function ruleArticles(text, add) {
    const re = /\b(a|an|A|An|AN)\s+([A-Za-z][\w-]*)/g;
    let m;
    while ((m = re.exec(text))) {
      const art = m[1];
      const word = m[2];
      if (word.length < 2 || (word === word.toUpperCase() && word.length > 1)) continue; // acronyms
      const lw = word.toLowerCase();
      let wantsAn = /^[aeiou]/.test(lw);
      if (/^(uni(?![nm])|use|usu|uti|ura|uri|uro|eu|ewe|one|once|ubiq|uk)/.test(lw)) wantsAn = false;
      if (/^(hour|honest|honou?r|heir)/.test(lw)) wantsAn = true;
      const isAn = art.toLowerCase() === 'an';
      if (wantsAn === isAn) continue;
      const rep = matchCase(art, wantsAn ? 'an' : 'a');
      add(m.index, m.index + art.length, rep,
        wantsAn ? `Use "an" before a vowel sound ("an ${word}").` : `Use "a" before a consonant sound ("a ${word}").`,
        'grammar', 'article');
    }
  }

  function rulePhrases(text, add) {
    for (const [pattern, rep, message, category, guard] of PHRASES) {
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(text))) {
        if (guard && !guard(text, m.index)) continue;
        const replacement = matchCase(m[0], rep(...m));
        add(m.index, m.index + m[0].length, replacement, message, category, 'phrase');
      }
    }
  }

  function ruleIntroComma(text, add) {
    const re = new RegExp(`(^|[.!?]["'”’)]*\\s+)(${INTRO_WORDS.map(escapeRe).join('|')})(?=\\s+([A-Za-z]+))`, 'g');
    let m;
    while ((m = re.exec(text))) {
      const next = m[3];
      if (INTRO_BLOCKERS.test(next)) continue;
      const s = m.index + m[1].length;
      const e = s + m[2].length;
      add(s, e, m[2] + ',', `Add a comma after the introductory "${m[2]}".`, 'punctuation', 'intro-comma');
    }
  }

  function ruleStyle(text, add, ctx) {
    const lower = text.toLowerCase();
    // Wordy phrases.
    for (const [phrase, rep] of Object.entries(WORDY)) {
      const re = new RegExp(`\\b${escapeRe(phrase)}\\b`, 'gi');
      let m;
      while ((m = re.exec(text))) {
        add(m.index, m.index + m[0].length, matchCase(m[0], rep), `Wordy — "${rep}" is tighter.`, 'style', 'wordy');
      }
    }
    // "very X" → stronger word.
    const veryRe = /\bvery\s+([a-z]+)\b/gi;
    let m;
    while ((m = veryRe.exec(text))) {
      const strong = VERY[m[1].toLowerCase()];
      if (strong) add(m.index, m.index + m[0].length, matchCase(m[0], strong), `Use a stronger word: "${strong}".`, 'style', 'very');
    }
    // Filler words.
    const fillerRe = new RegExp(`\\b(${FILLERS.join('|')})\\b\\s`, 'gi');
    while ((m = fillerRe.exec(text))) {
      const atStart = m.index === 0 || /[.!?]\s*$/.test(text.slice(0, m.index));
      if (atStart) {
        add(m.index, m.index + m[0].length, null, `"${m[1]}" is often filler — consider cutting it.`, 'style', 'filler');
      } else {
        add(m.index, m.index + m[0].length, '', `"${m[1]}" is often filler — consider cutting it.`, 'style', 'filler');
      }
    }
    // Clichés (advisory).
    for (const c of CLICHES) {
      let idx = lower.indexOf(c);
      while (idx !== -1) {
        add(idx, idx + c.length, null, 'Cliché — say it in your own words.', 'style', 'cliche');
        idx = lower.indexOf(c, idx + c.length);
      }
    }
    // Passive voice (advisory).
    const passive = new RegExp(`\\b(am|is|are|was|were|be|been|being)\\s+(\\w+ed|${PASSIVE_IRREGULAR})\\b`, 'gi');
    while ((m = passive.exec(text))) {
      if (NOT_PASSIVE.has(m[2].toLowerCase())) continue;
      add(m.index, m.index + m[0].length, null, 'Passive voice — consider an active construction.', 'style', 'passive');
    }
    // Long sentences (advisory).
    if (!ctx.heading && !ctx.code) {
      for (const s of splitSentences(text)) {
        const wc = countWords(s.text);
        if (wc > 32) {
          add(s.start, s.end, null, `Long sentence (${wc} words). Consider splitting it.`, 'style', 'long-sentence');
        }
      }
    }
    // Exclamation overuse.
    const bangs = (text.match(/!/g) || []).length;
    if (bangs >= 3 && countWords(text) < 120) {
      const i = text.indexOf('!');
      add(i, i + 1, null, 'Lots of exclamation marks — save them for real emphasis.', 'style', 'exclamations');
    }
  }

  // ---------------------------------------------------------------- core
  const RULES = [ruleSpelling, rulePhrases, ruleArticles, ruleRepeatedWords, ruleSpacing, rulePunctuation,
    ruleCapitalization, ruleIntroComma, ruleEndPunctuation, ruleTypography, ruleStyle];

  function check(text, opts) {
    opts = opts || {};
    const ctx = {
      heading: !!opts.heading, listItem: !!opts.listItem, code: !!opts.code, strictLists: !!opts.strictLists,
    };
    if (ctx.code || !text || !text.trim()) return [];
    const enabled = new Set(opts.categories || CATEGORIES);
    const protect = protectedRanges(text);
    const raw = [];
    const add = (start, end, replacement, message, category, rule) => {
      if (!enabled.has(category)) return;
      if (isProtected(protect, start, end)) return;
      const original = text.slice(start, end);
      if (replacement !== null && replacement === original) return;
      raw.push({ start, end, original, replacement, message, category, rule });
    };
    for (const rule of RULES) rule(text, add, ctx);

    // Resolve overlapping fixable issues: earlier start wins, then higher priority.
    const fixable = raw.filter((i) => i.replacement !== null)
      .sort((a, b) => a.start - b.start || PRIORITY[a.category] - PRIORITY[b.category] || (b.end - b.start) - (a.end - a.start));
    const kept = [];
    let lastEnd = -1;
    for (const issue of fixable) {
      if (issue.start < lastEnd) {
        const prev = kept[kept.length - 1];
        if (PRIORITY[issue.category] < PRIORITY[prev.category]) {
          kept[kept.length - 1] = issue;
          lastEnd = issue.end;
        }
        continue;
      }
      kept.push(issue);
      lastEnd = issue.end;
    }
    const advisory = raw.filter((i) => i.replacement === null);
    const all = kept.concat(advisory).sort((a, b) => a.start - b.start || PRIORITY[a.category] - PRIORITY[b.category]);
    all.forEach((i) => { i.id = `${i.rule}:${i.start}:${i.original}`; });
    return all;
  }

  function applyIssues(text, issues) {
    const sorted = issues.filter((i) => i.replacement !== null).sort((a, b) => b.start - a.start);
    let out = text;
    let floor = Infinity;
    for (const i of sorted) {
      if (i.end > floor) continue;
      out = out.slice(0, i.start) + i.replacement + out.slice(i.end);
      floor = i.start;
    }
    return out;
  }

  function fixAll(text, opts) {
    let out = text;
    for (let pass = 0; pass < 8; pass++) {
      const issues = check(out, opts).filter((i) => i.replacement !== null);
      if (!issues.length) break;
      const next = applyIssues(out, issues);
      if (next === out) break;
      out = next;
    }
    return out;
  }

  // ---------------------------------------------------------------- stats
  function countWords(text) {
    const m = text.match(/[A-Za-z0-9À-ɏ]+(?:['’-][A-Za-z0-9À-ɏ]+)*/g);
    return m ? m.length : 0;
  }

  function splitSentences(text) {
    const out = [];
    const re = /[^.!?…]+(?:[.!?…]+["'”’)\]]*|$)/g;
    let m;
    while ((m = re.exec(text))) {
      if (!m[0].trim()) { if (re.lastIndex === m.index) re.lastIndex++; continue; }
      const lead = m[0].length - m[0].replace(/^\s+/, '').length;
      out.push({ start: m.index + lead, end: m.index + m[0].replace(/\s+$/, '').length, text: m[0].trim() });
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    return out;
  }

  function syllables(word) {
    let w = word.toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    if (w.length <= 3) return 1;
    w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
    const groups = w.match(/[aeiouy]{1,2}/g);
    return Math.max(1, groups ? groups.length : 1);
  }

  function stats(text) {
    const words = text.match(/[A-Za-z0-9À-ɏ]+(?:['’-][A-Za-z0-9À-ɏ]+)*/g) || [];
    const sentences = splitSentences(text).filter((s) => countWords(s.text) > 0);
    const syl = words.reduce((n, w) => n + syllables(w), 0);
    const wc = words.length;
    const sc = Math.max(1, sentences.length);
    const flesch = wc ? Math.round(206.835 - 1.015 * (wc / sc) - 84.6 * (syl / wc)) : 0;
    const grade = wc ? Math.max(0, Math.round((0.39 * (wc / sc) + 11.8 * (syl / wc) - 15.59) * 10) / 10) : 0;
    let label = 'Very difficult';
    if (flesch >= 90) label = 'Very easy';
    else if (flesch >= 80) label = 'Easy';
    else if (flesch >= 70) label = 'Fairly easy';
    else if (flesch >= 60) label = 'Plain English';
    else if (flesch >= 50) label = 'Fairly difficult';
    else if (flesch >= 30) label = 'Difficult';
    return {
      words: wc,
      characters: text.length,
      sentences: sentences.length,
      sentenceLengths: sentences.map((s) => countWords(s.text)),
      syllables: syl,
      readingMinutes: Math.max(wc ? 1 : 0, Math.round(wc / 238)),
      avgSentence: sentences.length ? Math.round((wc / sentences.length) * 10) / 10 : 0,
      flesch: Math.max(0, Math.min(100, flesch)),
      grade,
      readability: wc ? label : '—',
    };
  }

  function score(issues, words) {
    const weights = { spelling: 3, grammar: 3, punctuation: 1.5, typography: 0.3, style: 0.8 };
    const penalty = issues.reduce((n, i) => n + (weights[i.category] || 1), 0);
    const per100 = penalty / Math.max(1, words / 100);
    return Math.max(0, Math.min(100, Math.round(100 - per100 * 4)));
  }

  return { check, fixAll, applyIssues, stats, score, countWords, splitSentences, CATEGORIES };
});
