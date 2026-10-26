'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import Image from 'next/image';
import { openSquareCrop } from '../lib/square-crop.js';
import './square-crop.css';
import {
  createMaterialZip,
  extensionOf,
  normalizeCategory,
  TaskType,
  titleFromFileName,
  validateCategory,
  validateMediaLimits,
} from '../lib/material-zip';

type Draft = {
  id: string;
  photos: Array<{ id: string; file: File; previewURL: string }>;
  title: string;
  category: string;
  audio?: File;
  tasks: Record<TaskType, boolean>;
};

const taskOptions: Array<{ key: TaskType; label: string }> = [
  { key: 'matching', label: 'おなじもの' },
  { key: 'receptive', label: 'きいてえらぶ' },
];

export default function Home() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const totalBytes = useMemo(
    () => drafts.reduce((sum, draft) => sum + draft.photos.reduce((photoSum, photo) => photoSum + photo.file.size, 0) + (draft.audio?.size ?? 0), 0),
    [drafts],
  );

  function addImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    setError(null);
    setStatus(null);
    const fileIssue = validateMediaLimits([...mediaForDrafts(drafts), ...files.map((file) => ({ images: [file] }))]);
    if (fileIssue) { setError(fileIssue); return; }
    const additions = files.map((file) => ({
      id: crypto.randomUUID(),
      photos: [{ id: crypto.randomUUID(), file, previewURL: URL.createObjectURL(file) }],
      title: titleFromFileName(file.name),
      category: '未分類',
      tasks: { matching: true, receptive: true },
    }));
    setDrafts((current) => [...current, ...additions]);
  }

  function updateDraft(id: string, update: Partial<Draft>) {
    const next = drafts.map((draft) => draft.id === id ? { ...draft, ...update } : draft);
    const issue = validateMediaLimits(mediaForDrafts(next));
    if (issue) {
      if (update.photos) update.photos.filter((photo) => !drafts.some((draft) => draft.photos.includes(photo))).forEach((photo) => URL.revokeObjectURL(photo.previewURL));
      setError(issue); return false;
    }
    setDrafts(next);
    setError(null);
    setStatus(null);
    return true;
  }

  async function cropPhoto(id: string, photo: Draft['photos'][number]) {
    try {
      const file = await openSquareCrop(photo.file);
      if (!file) return;
      const draft = drafts.find((draft) => draft.id === id);
      if (!draft) return;
      const replacement = { ...photo, file, previewURL: URL.createObjectURL(file) };
      if (updateDraft(id, { photos: draft.photos.map((item) => item === photo ? replacement : item) })) {
        URL.revokeObjectURL(photo.previewURL);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '写真を処理できませんでした。');
    }
  }

  function removeDraft(id: string) {
    setDrafts((current) => {
      const target = current.find((draft) => draft.id === id);
      if (target) target.photos.forEach((photo) => URL.revokeObjectURL(photo.previewURL));
      return current.filter((draft) => draft.id !== id);
    });
    setError(null);
    setStatus(null);
  }

  async function downloadZip() {
    setError(null);
    setStatus(null);
    const issue = firstValidationIssue(drafts);
    if (issue) { setError(issue); return; }
    setIsCreating(true);
    try {
      const zip = await createMaterialZip(drafts.map((draft) => ({
        title: draft.title,
        category: draft.category,
        images: draft.photos.map((photo) => ({
          blob: photo.file,
          extension: extensionOf(photo.file.name, 'jpg'),
        })),
        audio: draft.audio,
        audioExtension: draft.audio ? extensionOf(draft.audio.name, 'm4a') : undefined,
        taskTypes: taskOptions.filter(({ key }) => draft.tasks[key]).map(({ key }) => key),
      })));
      const url = URL.createObjectURL(zip);
      const link = document.createElement('a');
      link.href = url;
      link.download = `おうちステップ-家庭絵カード-${dateStamp()}.zip`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setStatus(`${drafts.length}件の絵カードZIPを作成しました。ダウンロード先を確認してください。`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ZIPを作成できませんでした。');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <div className="header-inner">
          <p className="product-name">おうちステップ</p>
          <p className="tool-name">PC絵カード作成ツール</p>
        </div>
      </header>

      <div className="content">
        <section className="privacy-notice" aria-labelledby="privacy-title">
          <span className="privacy-mark" aria-hidden="true">✓</span>
          <div>
            <h1 id="privacy-title">写真・音声はこの端末内だけで処理します</h1>
            <p>
              選んだファイルや入力内容は、サーバーなど外部へ一切送信しません。
              ZIPファイルもこのブラウザ内で作成します。
            </p>
          </div>
        </section>

        <section className="intro">
          <p className="eyebrow">かんたん3ステップ</p>
          <h2>写真を選んで、絵カードZIPを作りましょう</h2>
          <ul className="intro-notes">
            <li>アプリへの読み込みは製品版の機能です。</li>
            <li>既存の絵カードは上書きせず、新しく追加します。</li>
            <li>一度に最大100件作成できます。写真と音声は合計998ファイル／500 MBまで、1ファイル100 MBまで。</li>
          </ul>
        </section>

        <ol className="steps" aria-label="作成手順">
          <li className={drafts.length ? 'complete' : 'current'}><span>1</span><strong>写真を選ぶ</strong><small>複数まとめて選べます</small></li>
          <li className={drafts.length ? 'current' : ''}><span>2</span><strong>絵カードの内容を確認</strong><small>名前・カテゴリ・課題を設定</small></li>
          <li><span>3</span><strong>ZIPを作成</strong><small>おうちステップで読み込みます</small></li>
        </ol>

        <div aria-live="polite">
          {error && <p className="message error-message" role="alert">{error}</p>}
          {status && <p className="message success-message">{status}</p>}
        </div>

        {drafts.length === 0 ? (
          <section className="upload-card">
            <div className="upload-symbol" aria-hidden="true">+</div>
            <h2>まず、絵カードの写真を選びます</h2>
            <p>JPEG・PNG・HEICなどの画像を複数選択できます。</p>
            <FileButton onChange={addImages} label="写真を選ぶ" />
            <p className="upload-note">音声は写真を選んだ後に追加できます。</p>
          </section>
        ) : (
          <>
            <div className="list-heading">
              <div><h2>絵カードの内容</h2><p>{drafts.length}件・{formatBytes(totalBytes)}</p></div>
              <FileButton onChange={addImages} label="写真を追加" secondary />
            </div>
            <div className="material-list">
              {drafts.map((draft, index) => (
                <MaterialCard key={draft.id} draft={draft} index={index} onUpdate={updateDraft} onRemove={removeDraft} onCrop={cropPhoto} isCreating={isCreating} />
              ))}
            </div>
            <section className="download-panel">
              <div>
                <h2>{drafts.length}件の絵カードZIPを作成</h2>
                <p>作成後、おうちステップの「データ管理」→「PCで作成したファイルを読み込む」から読み込みます。</p>
              </div>
              <button className="primary-button" type="button" onClick={downloadZip} disabled={isCreating}>
                {isCreating ? '作成中…' : 'ZIPを作成する'}
              </button>
            </section>
          </>
        )}

        <footer>
          <strong>プライバシーについて</strong>
          <p>作成したZIPは暗号化されません。保存先と共有相手を確認してください。</p>
          <p>このツールにログイン・保存・送信機能はありません。画面を閉じると、選択した写真・音声と入力内容はブラウザから破棄されます。</p>
        </footer>
      </div>
    </main>
  );
}

function FileButton({ onChange, label, secondary = false }: { onChange: (event: ChangeEvent<HTMLInputElement>) => void; label: string; secondary?: boolean }) {
  return <label className={secondary ? 'secondary-button' : 'primary-button'}>{label}<input type="file" accept="image/*" multiple onChange={onChange} /></label>;
}

function MaterialCard({ draft, index, onUpdate, onRemove, onCrop, isCreating }: { draft: Draft; index: number; onUpdate: (id: string, update: Partial<Draft>) => void; onRemove: (id: string) => void; onCrop: (id: string, photo: Draft['photos'][number]) => void; isCreating: boolean }) {
  const categoryError = validateCategory(draft.category);
  const noTasks = !Object.values(draft.tasks).some(Boolean);
  return (
    <article className="material-card">
      <div className="photo-column">
        <div className="material-preview"><Image src={draft.photos[0].previewURL} alt="" fill unoptimized sizes="(max-width: 460px) 160px, 190px" /></div>
        <p className="photo-count">写真 {draft.photos.length}枚</p>
      </div>
      <div className="material-fields">
        <div className="card-title"><h3>絵カード {index + 1}</h3><button type="button" className="remove-button" onClick={() => onRemove(draft.id)}>この絵カードを削除</button></div>
        <div className="photo-editor">
          <strong>写真（先頭がメイン）</strong>
          <div className="photo-strip">{draft.photos.map((photo, photoIndex) => (
            <div className="photo-item" key={photo.id}>
              <Image src={photo.previewURL} alt="" width={72} height={72} unoptimized />
              <small>{photoIndex === 0 ? 'メイン' : `${photoIndex + 1}枚目`}</small>
              <button type="button" className="crop-photo-button" disabled={isCreating} aria-label={`${index + 1}件目の${photoIndex + 1}枚目を正方形にトリミング`} onClick={() => onCrop(draft.id, photo)}>正方形にトリミング</button>
              <div>
                <button type="button" disabled={photoIndex === 0} onClick={() => movePhoto(draft, photoIndex, -1, onUpdate)}>前へ</button>
                <button type="button" disabled={photoIndex === draft.photos.length - 1} onClick={() => movePhoto(draft, photoIndex, 1, onUpdate)}>後へ</button>
                <button type="button" disabled={draft.photos.length === 1} onClick={() => removePhoto(draft, photoIndex, onUpdate)}>削除</button>
              </div>
            </div>
          ))}</div>
          <label className="add-photo-button">この絵カードに写真を追加<input type="file" accept="image/*" multiple onChange={(event) => addPhotos(draft, event, onUpdate)} /></label>
        </div>
        <label>絵カード名<input value={draft.title} maxLength={100} onChange={(event) => onUpdate(draft.id, { title: event.target.value })} aria-invalid={!draft.title.trim()} /></label>
        {!draft.title.trim() && <p className="field-error">絵カード名を入力してください。</p>}
        <label>カテゴリー<input value={draft.category} onBlur={() => onUpdate(draft.id, { category: normalizeCategory(draft.category) })} onChange={(event) => onUpdate(draft.id, { category: event.target.value })} aria-invalid={Boolean(categoryError)} /></label>
        {categoryError && <p className="field-error">{categoryError}</p>}
        <fieldset className={noTasks ? 'invalid' : ''}><legend>使う課題（1つ以上）</legend><div className="task-grid">{taskOptions.map(({ key, label }) => <label className="check-label" key={key}><input type="checkbox" checked={draft.tasks[key]} onChange={(event) => onUpdate(draft.id, { tasks: { ...draft.tasks, [key]: event.target.checked } })} />{label}</label>)}</div></fieldset>
        {noTasks && <p className="field-error">使う課題を1つ以上選んでください。</p>}
        <label className="audio-field">音声（任意）<input type="file" accept="audio/*" onChange={(event) => onUpdate(draft.id, { audio: event.target.files?.[0] })} />{draft.audio && <span>{draft.audio.name}</span>}</label>
      </div>
    </article>
  );
}

function addPhotos(draft: Draft, event: ChangeEvent<HTMLInputElement>, onUpdate: (id: string, update: Partial<Draft>) => void) {
  const files = Array.from(event.target.files ?? []);
  event.target.value = '';
  if (!files.length) return;
  onUpdate(draft.id, { photos: [...draft.photos, ...files.map((file) => ({ id: crypto.randomUUID(), file, previewURL: URL.createObjectURL(file) }))] });
}

function movePhoto(draft: Draft, index: number, direction: -1 | 1, onUpdate: (id: string, update: Partial<Draft>) => void) {
  const destination = index + direction;
  if (destination < 0 || destination >= draft.photos.length) return;
  const photos = [...draft.photos];
  [photos[index], photos[destination]] = [photos[destination], photos[index]];
  onUpdate(draft.id, { photos });
}

function removePhoto(draft: Draft, index: number, onUpdate: (id: string, update: Partial<Draft>) => void) {
  if (draft.photos.length === 1) return;
  URL.revokeObjectURL(draft.photos[index].previewURL);
  onUpdate(draft.id, { photos: draft.photos.filter((_, photoIndex) => photoIndex !== index) });
}

function mediaForDrafts(drafts: Draft[]) {
  return drafts.map((draft) => ({
    images: draft.photos.map((photo) => photo.file),
    audio: draft.audio,
  }));
}

function firstValidationIssue(drafts: Draft[]): string | null {
  if (!drafts.length) return '絵カードの写真を選んでください。';
  const issue = validateMediaLimits(mediaForDrafts(drafts));
  if (issue) return issue;
  for (const [index, draft] of drafts.entries()) {
    if (!draft.title.trim()) return `${index + 1}件目の絵カード名を入力してください。`;
    const categoryError = validateCategory(draft.category);
    if (categoryError) return `${index + 1}件目: ${categoryError}`;
    if (!Object.values(draft.tasks).some(Boolean)) return `${index + 1}件目で使う課題を1つ以上選んでください。`;
  }
  return null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function dateStamp() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
