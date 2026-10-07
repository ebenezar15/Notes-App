const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../js/proofreader.js');

const core = { categories: ['spelling', 'grammar', 'punctuation'] };
const fix = (t, o = core) => P.fixAll(t, o);

test('fixes spacing and punctuation', () => {
  assert.equal(fix('Hello ,world.  This is fine'), 'Hello, world. This is fine.');
  assert.equal(fix('Wait!!! Really??'), 'Wait! Really?');
  assert.equal(fix('The end....'), 'The end...');
  assert.equal(fix('I like apples,oranges and pears.'), 'I like apples, oranges and pears.');
});

test('capitalizes sentences and the pronoun I', () => {
  assert.equal(fix('i went home. then i slept.'), 'I went home. Then I slept.');
  assert.equal(fix("i'm sure. it works."), "I'm sure. It works.");
  assert.equal(fix('We met Dr. smith at 5 p.m. today.'), 'We met Dr. smith at 5 p.m. today.');
  assert.equal(fix('Buy apples, pears, etc. and more.'), 'Buy apples, pears, etc. and more.');
});

test('fixes common misspellings with case preserved', () => {
  assert.equal(fix('Teh results were definately wierd.'), 'The results were definitely weird.');
  assert.equal(fix('I dont think thier plan will work.'), "I don't think their plan will work.");
  assert.equal(fix('im ready.'), "I'm ready.");
});

test('fixes grammar patterns', () => {
  assert.equal(fix('I could of done better then that.'), 'I could have done better than that.');
  assert.equal(fix('She dont care and he have no idea.'), "She doesn't care and he has no idea.");
  assert.equal(fix('Would he have known?'), 'Would he have known?');
  assert.equal(fix('They was late.'), 'They were late.');
  assert.equal(fix('It was a error in a hour.'), 'It was an error in an hour.');
  assert.equal(fix('It is an university and a apple.'), 'It is a university and an apple.');
  assert.equal(fix('This is the the best.'), 'This is the best.');
  assert.equal(fix('Its a good day.'), "It's a good day.");
  assert.equal(fix('The cat licked its paw.'), 'The cat licked its paw.');
});

test('adds commas after introductory words', () => {
  assert.equal(fix('However the plan failed.'), 'However, the plan failed.');
  assert.equal(fix('However much I try, it fails.'), 'However much I try, it fails.');
  assert.equal(fix('It rained. For example the roads flooded.'), 'It rained. For example, the roads flooded.');
});

test('adds end punctuation only to real sentences', () => {
  assert.equal(fix('This sentence has no ending'), 'This sentence has no ending.');
  assert.equal(P.fixAll('Short title here now', { ...core, heading: true }), 'Short title here now');
  assert.equal(fix('Two words'), 'Two words');
});

test('leaves URLs, emails and correct text alone', () => {
  const ok = 'Visit https://example.com/a,b?x=1 or mail me@site.com today. It works well.';
  assert.equal(fix(ok), ok);
  const clean = 'The quick brown fox jumps over the lazy dog. Nothing here is wrong.';
  assert.deepEqual(P.check(clean, core), []);
});

test('typography: smart quotes and em dashes', () => {
  const o = { categories: ['typography'] };
  assert.equal(P.fixAll('She said "hi" -- then left.', o), 'She said “hi” — then left.');
  assert.equal(P.fixAll("It's John's.", o), 'It’s John’s.');
});

test('style suggestions', () => {
  const o = { categories: ['style'] };
  assert.equal(P.fixAll('It was very good in order to win.', o), 'It was excellent to win.');
  const issues = P.check('The ball was thrown by the boy.', o);
  assert.ok(issues.some((i) => i.rule === 'passive' && i.replacement === null));
  const long = Array(40).fill('word').join(' ') + '.';
  assert.ok(P.check(long, o).some((i) => i.rule === 'long-sentence'));
});

test('issue offsets match the original text', () => {
  const text = 'teh cat  sat ,quietly.';
  for (const i of P.check(text)) assert.equal(text.slice(i.start, i.end), i.original);
});

test('stats', () => {
  const s = P.stats('The cat sat on the mat. It was happy!');
  assert.equal(s.words, 9);
  assert.equal(s.sentences, 2);
  assert.ok(s.flesch > 80);
  assert.equal(P.stats('').words, 0);
});

test('fixes floating punctuation and "then" in longer comparisons', () => {
  assert.equal(fix('I think out loud .It works.'), 'I think out loud. It works.');
  assert.equal(fix('Wait ,what happened here?'), 'Wait, what happened here?');
  assert.equal(fix('I have more drafts then I expected.'), 'I have more drafts than I expected.');
  assert.equal(fix('We ate more food then left.'), 'We ate more food then left.');
  assert.equal(fix('Install it with npm .Then run it.'), 'Install it with npm. Then run it.');
});
