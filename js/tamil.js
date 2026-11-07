/* Inkwell Tamil — offline phonetic Tamil typing (Tanglish → தமிழ்), script detection and
 * Tamil → Latin romanisation for file names. Pure functions; works in the browser and Node. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Tamil = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const PULLI = '்'; // ்

  // Vowels: [latin, independent letter, vowel sign]. Longest spellings first.
  const VOWELS = [
    ['aa', 'ஆ', 'ா'], ['ai', 'ஐ', 'ை'], ['au', 'ஔ', 'ௌ'], ['ae', 'ஏ', 'ே'],
    ['ee', 'ஈ', 'ீ'], ['ii', 'ஈ', 'ீ'], ['oo', 'ஊ', 'ூ'], ['uu', 'ஊ', 'ூ'], ['oa', 'ஓ', 'ோ'],
    ['A', 'ஆ', 'ா'], ['I', 'ஈ', 'ீ'], ['U', 'ஊ', 'ூ'], ['E', 'ஏ', 'ே'], ['O', 'ஓ', 'ோ'],
    ['a', 'அ', ''], ['i', 'இ', 'ி'], ['u', 'உ', 'ு'], ['e', 'எ', 'ெ'], ['o', 'ஒ', 'ொ'],
  ];

  // Consonant spellings, longest first. A value is the consonant (cluster) a following vowel sign attaches to.
  const CONSONANTS = [
    ['ksh', 'க்ஷ'], ['ndr', 'ன்ற'], ['nth', 'ந்த'], ['ndh', 'ந்த'],
    ['ng', 'ங'], ['nj', 'ஞ'], ['gn', 'ஞ'], ['ch', 'ச'], ['sh', 'ஷ'], ['zh', 'ழ'], ['th', 'த'], ['dh', 'த'],
    ['tr', 'ற்ற'], ['rr', 'ற'], ['kh', 'க'], ['gh', 'க'], ['ph', 'ப'], ['bh', 'ப'],
    ['k', 'க'], ['g', 'க'], ['c', 'க'], ['s', 'ச'], ['S', 'ஸ'], ['j', 'ஜ'], ['J', 'ஜ'],
    ['t', 'ட'], ['T', 'ட'], ['d', 'ட'], ['D', 'ட'], ['N', 'ண'],
    ['p', 'ப'], ['b', 'ப'], ['f', 'ஃப'], ['m', 'ம'], ['y', 'ய'], ['r', 'ர'], ['R', 'ற'],
    ['l', 'ல'], ['L', 'ள'], ['z', 'ழ'], ['v', 'வ'], ['w', 'வ'], ['h', 'ஹ'], ['x', 'க்ஸ'],
  ];

  const isVowelAt = (s, i) => VOWELS.some(([lat]) => s.startsWith(lat, i));

  /** Consonant match at position i, with Tamil-specific context rules. Returns [tamil, length] or null. */
  function consonantAt(s, i) {
    if (s.startsWith('sri', i)) return ['ஸ்ரீ', 3, true];
    // "ng"/"nj" are almost always written ங்க / ஞ்ச when a vowel follows (தங்கம், பஞ்சம்).
    if (s.startsWith('ng', i)) return [isVowelAt(s, i + 2) ? 'ங்க' : 'ங', 2];
    if (s.startsWith('nj', i)) return [isVowelAt(s, i + 2) ? 'ஞ்ச' : 'ஞ', 2];
    if (s[i] === 'n') {
      for (const [lat, ta] of CONSONANTS) if (lat.startsWith('n') && lat.length > 1 && s.startsWith(lat, i)) return [ta, lat.length];
      if (s.startsWith('nn', i)) return ['ன்ன', 2];
      const next = s[i + 1] || '';
      if (i === 0) return ['ந', 1]; // word-initial n: நான், நன்றி
      if (next === 't' || next === 'd') return ['ண', 1]; // ண்ட
      return ['ன', 1];
    }
    if (s.startsWith('NN', i)) return ['ண்ண', 2];
    for (const [lat, ta] of CONSONANTS) if (s.startsWith(lat, i)) return [ta, lat.length];
    return null;
  }

  /** Transliterate one word (or any string) of phonetic Latin into Tamil script. */
  function toTamil(input) {
    const s = String(input || '');
    let out = '';
    let pending = null; // consonant waiting for a vowel sign or a pulli
    const flush = () => { if (pending) { out += pending + PULLI; pending = null; } };
    let i = 0;
    while (i < s.length) {
      // Aytham
      if (s[i] === 'q') { flush(); out += 'ஃ'; i++; continue; }
      const c = consonantAt(s, i);
      if (c) {
        flush();
        if (c[2]) { out += c[0]; i += c[1]; continue; } // complete syllable (ஸ்ரீ)
        pending = c[0];
        i += c[1];
        continue;
      }
      const v = VOWELS.find(([lat]) => s.startsWith(lat, i));
      if (v) {
        if (pending) { out += pending + v[2]; pending = null; } else out += v[1];
        i += v[0].length;
        continue;
      }
      flush();
      out += s[i];
      i++;
    }
    flush();
    return out;
  }

  /** Transliterate free text, word by word, leaving punctuation, digits and spaces alone. */
  function transliterate(text) {
    return String(text || '').replace(/[A-Za-z]+/g, (w) => toTamil(w));
  }

  // ---- script detection -------------------------------------------------------------
  const TAMIL_RE = /[஀-௿]/g;
  const LATIN_RE = /[A-Za-zÀ-ɏ]/g;
  /** Fraction of letters that are Tamil script (0–1). */
  function tamilRatio(text) {
    const t = (String(text).match(TAMIL_RE) || []).length;
    const l = (String(text).match(LATIN_RE) || []).length;
    return t + l ? t / (t + l) : 0;
  }
  const isTamil = (text) => tamilRatio(text) > 0.5;

  // ---- Tamil → Latin (for file names and slugs) ----------------------------------------------
  const LATIN = {
    'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ii', 'உ': 'u', 'ஊ': 'uu', 'எ': 'e', 'ஏ': 'ee', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'oo', 'ஔ': 'au', 'ஃ': 'h',
    'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'nj', 'ட': 't', 'ண': 'n', 'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
    'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n', 'ஜ': 'j', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h',
  };
  const SIGNS = { 'ா': 'aa', 'ி': 'i', 'ீ': 'ii', 'ு': 'u', 'ூ': 'uu', 'ெ': 'e', 'ே': 'ee', 'ை': 'ai', 'ொ': 'o', 'ோ': 'oo', 'ௌ': 'au', '்': '' };
  const CONS_SET = new Set('கஙசஞடணதநபமயரலவழளறனஜஷஸஹ'.split(''));
  function toLatin(text) {
    const chars = Array.from(String(text || ''));
    let out = '';
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (CONS_SET.has(ch)) {
        out += LATIN[ch];
        const next = chars[i + 1];
        if (next in SIGNS) { out += SIGNS[next]; i++; } else out += 'a';
      } else if (ch in LATIN) out += LATIN[ch];
      else if (!(ch in SIGNS)) out += ch;
    }
    return out;
  }

  // A compact reference for the in-app cheat sheet.
  const CHEATSHEET = [
    ['Vowels', [['a', 'அ'], ['aa / A', 'ஆ'], ['i', 'இ'], ['ee / I', 'ஈ'], ['u', 'உ'], ['oo / U', 'ஊ'], ['e', 'எ'], ['E', 'ஏ'], ['ai', 'ஐ'], ['o', 'ஒ'], ['O', 'ஓ'], ['au', 'ஔ'], ['q', 'ஃ']]],
    ['Consonants', [['k / g', 'க'], ['ng', 'ங'], ['s / ch', 'ச'], ['nj', 'ஞ'], ['t / d', 'ட'], ['N', 'ண'], ['th / dh', 'த'], ['n (start)', 'ந'], ['p / b', 'ப'], ['m', 'ம'], ['y', 'ய'], ['r', 'ர'], ['l', 'ல'], ['v / w', 'வ'], ['zh', 'ழ'], ['L', 'ள'], ['R', 'ற'], ['n', 'ன']]],
    ['Grantha & clusters', [['j', 'ஜ'], ['sh', 'ஷ'], ['S', 'ஸ'], ['h', 'ஹ'], ['ksh', 'க்ஷ'], ['sri', 'ஸ்ரீ'], ['tr', 'ற்ற'], ['ndr', 'ன்ற'], ['nth', 'ந்த']]],
    ['Examples', [['vaNakkam', 'வணக்கம்'], ['thamizh', 'தமிழ்'], ['nandri', 'நன்றி'], ['kaatru', 'காற்று'], ['thangam', 'தங்கம்'], ['pOgalaam', 'போகலாம்']]],
  ];

  return { toTamil, transliterate, toLatin, tamilRatio, isTamil, CHEATSHEET };
});
