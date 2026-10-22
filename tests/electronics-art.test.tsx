import { strict as assert } from 'node:assert';
import { existsSync, statSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ELECTRONICS_ART, ElectronicsArt, hasElectronicsArt } from '../src/ui/ElectronicsArt';
import { ToyArt, toyPlayHint, toyPlayKindFor } from '../src/ui/ToyArt';
import { ITEM_BY_ID, toysByShelf } from '../src/engine/shop';

const shelf = toysByShelf('phone');
for (const [id, file] of Object.entries(ELECTRONICS_ART)) {
  assert.equal(ITEM_BY_ID[id]?.toy, 'phone');
  assert.ok(shelf.some(item => item.id === id));
  assert.ok(ITEM_BY_ID[id].price > 0);
  const path = `public/electronics/${file}.webp`;
  assert.ok(existsSync(path), path);
  assert.ok(statSync(path).size < 400_000, 'Illustrations stay small for offline use');
  const markup = renderToStaticMarkup(<ToyArt id={id} className="test-art" />);
  assert.ok(markup.includes('electronics-art test-art'));
  assert.ok(markup.includes(`${import.meta.env.BASE_URL}electronics/${file}.webp`));
  assert.ok(!markup.includes('<svg'), 'New electronics must not fall back to retro phone SVG');
}
for (const id of ['phone-smart', 'phone-flip', 'phone-retro']) {
  assert.ok(shelf.some(item => item.id === id), 'Existing purchases remain valid');
  assert.ok(renderToStaticMarkup(<ToyArt id={id} />).includes('phone-face-back'));
  const interactive = renderToStaticMarkup(<ToyArt id={id} interactive />);
  assert.ok(interactive.includes('aria-pressed="false"'));
  assert.ok(interactive.includes('phone-front.webp'));
  assert.ok(existsSync('public/electronics/phone-front.webp'));
}
assert.equal(hasElectronicsArt('toString'), false);
assert.equal(renderToStaticMarkup(<ElectronicsArt id="missing" />), '');

// Игра по нажатию: у каждого вида техники — свой трюк и своя подсказка,
// как поворот у телефонов, но анимации не повторяются между видами.
const playKinds: Record<string, string> = {
  'car-bmw': 'car',
  'ship-sail': 'ship',
  'plane-swift': 'plane',
  'laptop-air': 'laptop',
  'tv-cinema': 'tv',
  'headphones-max': 'headphones',
  'phone-smart': 'phone',
};
const fxMarker: Record<string, string> = {
  car: 'toy-fx-line',
  ship: 'toy-fx-wave',
  plane: 'toy-fx-trail',
  laptop: 'toy-fx-pixel',
  tv: 'toy-fx-scan',
  headphones: 'toy-fx-note',
};
const hints = new Set<string>();
for (const [id, kind] of Object.entries(playKinds)) {
  assert.equal(toyPlayKindFor(id), kind, id);
  const hint = toyPlayHint(id);
  assert.ok(hint, id);
  assert.ok(!hints.has(hint), `hint repeats: ${hint}`);
  hints.add(hint);
  if (kind === 'phone') continue;
  const still = renderToStaticMarkup(<ToyArt id={id} />);
  assert.ok(!still.includes('<button'), `${id}: no button without interactive`);
  assert.ok(!still.includes('toy-play'), `${id}: no play classes without interactive`);
  const playable = renderToStaticMarkup(<ToyArt id={id} interactive />);
  assert.ok(playable.includes('<button'), `${id}: playable is a button`);
  assert.ok(playable.includes(`toy-play--${kind}`), `${id}: own trick class`);
  assert.ok(playable.includes(fxMarker[kind]), `${id}: own fx layer`);
  assert.ok(playable.includes('aria-label='), `${id}: labelled for a11y`);
  for (const [otherKind, marker] of Object.entries(fxMarker)) {
    if (otherKind !== kind) assert.ok(!playable.includes(marker), `${id}: fx of ${otherKind} must not leak in`);
  }
}
console.log('Electronics: catalog, assets, base URL, shared rendering, legacy phones and per-kind play tricks OK');
