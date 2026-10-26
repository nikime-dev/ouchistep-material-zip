export const TASK_TYPES = ['matching', 'receptive'] as const;
export type TaskType = (typeof TASK_TYPES)[number];

export type MaterialInput = {
  title: string;
  category: string;
  images: Array<{ blob: Blob; extension: string }>;
  audio?: Blob;
  audioExtension?: string;
  taskTypes: TaskType[];
};

type ZipEntry = { name: string; data: Uint8Array };

export const MATERIAL_LIMITS = {
  materials: 100,
  totalBytes: 500 * 1024 * 1024,
  singleFileBytes: 100 * 1024 * 1024,
  fileCount: 1000,
  archiveBytes: 512 * 1024 * 1024,
} as const;

// CSV and README occupy two entries, including when no audio is selected.
export function validateMediaLimits(materials: Array<{ images: Array<{ size: number }>; audio?: { size: number } }>): string | null {
  if (materials.length > MATERIAL_LIMITS.materials) return '一度に作成できる絵カードは100件までです。選択した写真は追加していません。';
  const files = materials.flatMap((material) => [...material.images, ...(material.audio ? [material.audio] : [])]);
  if (files.some((file) => file.size > MATERIAL_LIMITS.singleFileBytes)) return '写真・音声は1ファイル100 MiB以内にしてください。';
  if (files.length + 2 > MATERIAL_LIMITS.fileCount) return '写真と音声は合計998ファイル以内にしてください（CSV・説明書を含めて1,000ファイルまで）。';
  if (files.reduce((sum, file) => sum + file.size, 0) > MATERIAL_LIMITS.totalBytes) return '写真と音声の合計は500 MiB以内にしてください。';
  return null;
}

const forbiddenPunctuation = /[,\u0027\u0022，、‘’‚‛“”„‟＇＂]/u;
const forbiddenDirectionControls = /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;
const forbiddenLeadingCharacters = /^[=+\-@＝＋－＠]/u;

export function normalizeCategory(value: string): string {
  return value.trim().normalize('NFKC');
}

export function validateCategory(value: string): string | null {
  const normalized = normalizeCategory(value);
  if (!normalized) return 'カテゴリー名を入力してください。';
  const segmenter = typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter('ja', { granularity: 'grapheme' })
    : null;
  const length = segmenter ? Array.from(segmenter.segment(normalized)).length : Array.from(normalized).length;
  if (length > 30) return 'カテゴリー名は30文字以内にしてください。';
  if (forbiddenPunctuation.test(normalized) || forbiddenDirectionControls.test(normalized) || /[\u0000-\u001f\u007f-\u009f]/u.test(normalized)) {
    return 'カンマ、引用符、改行、タブ、制御文字は使用できません。';
  }
  if (forbiddenLeadingCharacters.test(normalized)) {
    return 'カテゴリー名を =、+、-、@ から始めることはできません。';
  }
  return null;
}

export function extensionOf(fileName: string, fallback: string): string {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/u);
  return match?.[1] ?? fallback;
}

export function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/u, '').trim() || '名前なし';
}

export async function createMaterialZip(materials: MaterialInput[]): Promise<Blob> {
  if (materials.length === 0) throw new Error('教材を1件以上追加してください。');
  const limitError = validateMediaLimits(materials.map((material) => ({ images: material.images.map((image) => image.blob), audio: material.audio })));
  if (limitError) throw new Error(limitError);

  const csvRows = [['title', 'category', 'image_file', 'audio_file', 'task_types', 'external_id', 'additional_image_files']];
  const entries: ZipEntry[] = [];

  for (const [index, material] of materials.entries()) {
    const number = String(index + 1).padStart(4, '0');
    const title = material.title.trim();
    const category = normalizeCategory(material.category);
    if (!title) throw new Error(`${index + 1}件目の教材名を入力してください。`);
    if (material.images.length === 0) throw new Error(`${index + 1}件目の写真を1枚以上追加してください。`);
    const categoryError = validateCategory(category);
    if (categoryError) throw new Error(`${index + 1}件目: ${categoryError}`);
    if (material.taskTypes.length === 0 || material.taskTypes.some((task) => !TASK_TYPES.includes(task))) throw new Error(`${index + 1}件目で使う練習を1つ以上選んでください。`);

    const imagePath = `images/image-${number}-main.${sanitizeExtension(material.images[0].extension, 'jpg')}`;
    const additionalImagePaths = material.images.slice(1).map((image, photoIndex) =>
      `images/image-${number}-${String(photoIndex + 2).padStart(2, '0')}.${sanitizeExtension(image.extension, 'jpg')}`
    );
    const audioPath = material.audio
      ? `audio/audio-${number}.${sanitizeExtension(material.audioExtension ?? '', 'm4a')}`
      : '';
    entries.push({ name: imagePath, data: new Uint8Array(await material.images[0].blob.arrayBuffer()) });
    for (const [photoIndex, image] of material.images.slice(1).entries()) {
      entries.push({ name: additionalImagePaths[photoIndex], data: new Uint8Array(await image.blob.arrayBuffer()) });
    }
    if (material.audio && audioPath) {
      entries.push({ name: audioPath, data: new Uint8Array(await material.audio.arrayBuffer()) });
    }
    csvRows.push([title, category, imagePath, audioPath, [...new Set(material.taskTypes)].sort().join('|'), `web-${number}`, additionalImagePaths.join('|')]);
  }

  const csv = '\ufeff' + csvRows.map((row) => row.map(csvField).join(',')).join('\r\n') + '\r\n';
  const readme = `おうちステップ PC絵カード作成ツール\r\n\r\n製品版の「データ管理」→「PCで作成したファイルを読み込む」から読み込んでください。\r\n既存の絵カードは上書きせず、新しい絵カードとして追加します。\r\n写真はアプリで中央を正方形に切り抜きます。\r\nZIPは暗号化されません。保存先と共有相手を確認してください。\r\n`;
  entries.unshift({ name: 'materials.csv', data: new TextEncoder().encode(csv) });
  entries.push({ name: 'README.txt', data: new TextEncoder().encode(readme) });

  if (entries.some((entry) => entry.data.byteLength > MATERIAL_LIMITS.singleFileBytes)) throw new Error('CSV・説明書を含め、1ファイル100 MiB以内にしてください。');
  const archiveBytes = 22 + entries.reduce((sum, entry) => sum + entry.data.byteLength + 76 + new TextEncoder().encode(entry.name).length * 2, 0);
  if (archiveBytes > MATERIAL_LIMITS.archiveBytes) throw new Error('完成するZIPは512 MiB以内にしてください。絵カード名や写真・音声を減らしてください。');
  return new Blob([buildStoredZip(entries)], { type: 'application/zip' });
}

function sanitizeExtension(value: string, fallback: string): string {
  return /^[a-z0-9]{1,8}$/u.test(value.toLowerCase()) ? value.toLowerCase() : fallback;
}

function csvField(value: string): string {
  return /[",\r\n]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function buildStoredZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const local = new Uint8Array(30 + name.length + entry.data.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, name.length, true);
    local.set(name, 30);
    local.set(entry.data, 30 + name.length);
    localParts.push(local);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.data.length, true);
    centralView.setUint32(24, entry.data.length, true);
    centralView.setUint16(28, name.length, true);
    centralView.setUint32(42, offset, true);
    central.set(name, 46);
    centralParts.push(central);
    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return concatenate([...localParts, ...centralParts, end]);
}

function concatenate(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let k = 0; k < 8; k += 1) value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[n] = value >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
