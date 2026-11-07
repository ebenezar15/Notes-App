const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../js/tools.js');

test('headline scoring rewards specific, emotional, well-sized titles', () => {
  const weak = T.headline('Thoughts');
  const strong = T.headline('7 honest lessons I learned after quitting my job to write');
  assert.ok(strong.score > weak.score + 30, `${strong.score} vs ${weak.score}`);
  assert.ok(strong.score >= 70);
  assert.equal(T.headline('').score, 0);
  const caps = T.headline('THIS IS ALL CAPS AND IT IS LOUD');
  assert.ok(caps.checks.some((c) => c.label === 'Clean style' && !c.ok));
  assert.ok(T.headline("You won't believe this one trick").checks.some((c) => c.label === 'Clean style' && !c.ok));
});

test('thesaurus finds synonyms and keeps capitalisation', () => {
  assert.ok(T.synonyms('important').includes('crucial'));
  assert.ok(T.synonyms('Important')[0].match(/^[A-Z]/));
  assert.ok(T.synonyms('mistakes').length > 0); // plural falls back to singular
  assert.deepEqual(T.synonyms('zxqv'), []);
});

test('fuzzy matching ranks prefix and substring matches first', () => {
  assert.ok(T.fuzzy('new', 'New post') > T.fuzzy('new', 'Renew subscription'));
  assert.ok(T.fuzzy('npst', 'New post') > 0);
  assert.equal(T.fuzzy('xyz', 'New post'), 0);
});

test('every template has a title hint, subtitle and structured body', () => {
  for (const t of T.TEMPLATES) {
    assert.ok(t.name && t.emoji && t.subtitle);
    assert.match(t.content, /<h[23]>/);
  }
});
