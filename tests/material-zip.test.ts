import assert from 'node:assert/strict';
import test from 'node:test';
import { createMaterialZip, normalizeCategory, titleFromFileName, validateCategory, validateMediaLimits } from '../lib/material-zip.ts';

test('category rules match the app format', () => {
  assert.equal(normalizeCategory('  ＡＢＣ  '), 'ABC');
  assert.equal(validateCategory('未分類'), null);
  assert.ok((validateCategory('=SUM(A1)') ?? '').includes('='));
  assert.match(validateCategory('分類,名') ?? '', /カンマ/u);
});

test('file name becomes a material title', () => {
  assert.equal(titleFromFileName('うさぎ.photo.JPG'), 'うさぎ.photo');
});

test('generated archive contains compatible root entries', async () => {
  const archive = await createMaterialZip([{
    title: 'りんご',
    category: '食べ物',
    images: [
      { blob: new Blob([new Uint8Array([1, 2, 3])]), extension: 'jpg' },
      { blob: new Blob([new Uint8Array([4, 5, 6])]), extension: 'png' },
    ],
    taskTypes: ['matching', 'receptive'],
  }]);
  const bytes = new Uint8Array(await archive.arrayBuffer());
  const text = new TextDecoder().decode(bytes);
  assert.equal(new DataView(bytes.buffer).getUint32(0, true), 0x04034b50);
  assert.match(text, /materials\.csv/u);
  assert.match(text, /images\/image-0001-main\.jpg/u);
  assert.match(text, /images\/image-0001-02\.png/u);
  assert.match(text, /README\.txt/u);
  assert.match(text, /additional_image_files/u);
});

test('media limits include additional photos, audio and the two metadata entries', () => {
  const file = (size = 1) => ({ size });
  const images = (count: number) => Array.from({ length: count }, () => file());
  assert.equal(validateMediaLimits([{ images: [file(100 * 1024 * 1024)] }]), null);
  assert.match(validateMediaLimits([{ images: [file(100 * 1024 * 1024 + 1)] }]) ?? '', /100 MiB/);
  assert.equal(validateMediaLimits([{ images: images(997), audio: file() }]), null);
  assert.match(validateMediaLimits([{ images: images(998), audio: file() }]) ?? '', /998/);
  assert.equal(validateMediaLimits(Array.from({ length: 100 }, () => ({ images: [file()] }))), null);
  assert.match(validateMediaLimits(Array.from({ length: 101 }, () => ({ images: [file()] }))) ?? '', /100件/);
  assert.equal(validateMediaLimits([{ images: Array.from({ length: 5 }, () => file(100 * 1024 * 1024)) }]), null);
  assert.match(validateMediaLimits([{ images: Array.from({ length: 5 }, () => file(100 * 1024 * 1024)), audio: file() }]) ?? '', /500 MiB/);
});

test('ZIP generator enforces limits even when called without the UI', async () => {
  await assert.rejects(createMaterialZip([{ title: 'コップ', category: '未分類', images: Array.from({ length: 999 }, () => ({ blob: new Blob(['x']), extension: 'jpg' })), taskTypes: ['matching'] }]), /998/);
});

test('category uses app-compatible grapheme counting', () => {
  assert.equal(validateCategory('🍎'.repeat(30)), null);
  assert.ok(validateCategory('🍎'.repeat(31)));
  assert.equal(validateCategory('👨‍👩‍👧‍👦'.repeat(30)), null);
});
