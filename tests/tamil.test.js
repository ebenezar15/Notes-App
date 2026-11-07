const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tamil.js');

test('phonetic typing produces correct Tamil for common words', () => {
  const cases = {
    thamizh: 'தமிழ்', naan: 'நான்', vaNakkam: 'வணக்கம்', kavithai: 'கவிதை', nandri: 'நன்றி', endru: 'என்று',
    kaatru: 'காற்று', thangam: 'தங்கம்', veedu: 'வீடு', pOgalaam: 'போகலாம்', sri: 'ஸ்ரீ', ammaa: 'அம்மா',
    paLLi: 'பள்ளி', pazham: 'பழம்', ezhuthu: 'எழுது', inRu: 'இன்று', panjam: 'பஞ்சம்', vandi: 'வண்டி',
    kai: 'கை', oru: 'ஒரு', poo: 'பூ', aiyaa: 'ஐயா', akq: 'அக்ஃ', manam: 'மனம்', ennai: 'என்னை', kaNNan: 'கண்ணன்',
  };
  for (const [latin, tamil] of Object.entries(cases)) assert.equal(T.toTamil(latin), tamil, latin);
});

test('transliterate keeps punctuation, digits and spaces', () => {
  assert.equal(T.transliterate('vaNakkam, ulagam! 2026'), 'வணக்கம், உலகம்! 2026');
});

test('script detection', () => {
  assert.ok(T.isTamil('தமிழ் ஒரு அழகான மொழி'));
  assert.ok(!T.isTamil('Tamil is a beautiful language'));
  assert.ok(T.tamilRatio('Hello வணக்கம்') > 0.3);
});

test('romanisation for file names', () => {
  assert.equal(T.toLatin('தமிழ்'), 'thamizh');
  assert.equal(T.toLatin('வணக்கம்'), 'vanakkam');
});
