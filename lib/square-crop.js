// Also embedded in the offline HTML by scripts/sync-pc-square-crop.mjs.
const cropEdits = new WeakMap();

/** @param {number} width @param {number} height @param {number} zoom @param {number} x @param {number} y */
export function squareCropRect(width, height, zoom, x, y) {
  if (![width, height, zoom, x, y].every(Number.isFinite) || width <= 0 || height <= 0) {
    throw new Error('写真の大きさを確認できませんでした。');
  }
  const size = Math.min(width, height) / Math.max(1, Math.min(4, zoom));
  return { x: (width - size) * Math.max(0, Math.min(1, x)), y: (height - size) * Math.max(0, Math.min(1, y)), size };
}

/** @param {number} size */
export function squareOutputSize(size) {
  return Math.max(1, Math.min(2048, Math.round(size)));
}

/** Opens a local-only editor. Cancellation leaves the caller's file unchanged.
 * @param {File} file
 * @returns {Promise<File | null>}
 */
export function openSquareCrop(file) {
  const previous = cropEdits.get(file);
  const original = previous?.original ?? file;
  const state = { ...(previous?.state ?? { zoom: 1, x: 0.5, y: 0.5 }) };
  const opener = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = 'square-crop-dialog';
  const titleID = `square-crop-${crypto.randomUUID()}`;
  dialog.setAttribute('aria-labelledby', titleID);
  dialog.innerHTML = `
    <h2 id="${titleID}">正方形にトリミング</h2>
    <p class="crop-help">写真をドラッグするか、スライダーで位置と拡大率を調整します。</p>
    <div class="crop-stage"><canvas width="600" height="600" role="img" aria-label="切り抜く範囲のプレビュー"></canvas><span aria-hidden="true"></span></div>
    <div class="crop-controls">
      <label>拡大率 <output></output><input aria-label="拡大率" class="crop-zoom" type="range" min="1" max="4" step="0.01" value="1" disabled></label>
      <label>左右の位置<input class="crop-x" type="range" min="0" max="1" step="0.01" value="0.5" disabled></label>
      <label>上下の位置<input class="crop-y" type="range" min="0" max="1" step="0.01" value="0.5" disabled></label>
    </div>
    <p class="crop-error" role="alert"></p>
    <div class="crop-actions"><button type="button" class="crop-reset">中央に戻す</button><button type="button" class="crop-cancel">キャンセル</button><button type="button" class="crop-apply" disabled>切り抜きを使う</button></div>`;
  const canvas = dialog.querySelector('canvas');
  const context = canvas.getContext('2d');
  const zoom = dialog.querySelector('.crop-zoom');
  const x = dialog.querySelector('.crop-x');
  const y = dialog.querySelector('.crop-y');
  const apply = dialog.querySelector('.crop-apply');
  const reset = dialog.querySelector('.crop-reset');
  const error = dialog.querySelector('.crop-error');
  const image = new Image();
  const url = URL.createObjectURL(original);
  let loaded = false;
  let closed = false;
  let saving = false;
  let drag = null;

  function draw() {
    if (!loaded || closed) return;
    const rect = squareCropRect(image.naturalWidth, image.naturalHeight, state.zoom, state.x, state.y);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, canvas.width, canvas.height);
    zoom.value = String(state.zoom);
    x.value = String(state.x);
    y.value = String(state.y);
    dialog.querySelector('output').value = `${state.zoom.toFixed(2)}倍`;
    zoom.disabled = saving;
    x.disabled = saving || image.naturalWidth === rect.size;
    y.disabled = saving || image.naturalHeight === rect.size;
  }

  return new Promise((resolve, reject) => {
    function finish(result) {
      if (closed) return;
      closed = true;
      image.onload = image.onerror = null;
      URL.revokeObjectURL(url);
      dialog.close();
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      resolve(result);
    }
    dialog.querySelector('.crop-cancel').onclick = () => finish(null);
    dialog.oncancel = (event) => { event.preventDefault(); finish(null); };
    dialog.onclose = () => finish(null);
    reset.onclick = () => { Object.assign(state, { zoom: 1, x: 0.5, y: 0.5 }); draw(); };
    for (const [input, key] of [[zoom, 'zoom'], [x, 'x'], [y, 'y']]) {
      input.oninput = () => { state[key] = Number(input.value); draw(); };
    }
    canvas.onpointerdown = (event) => {
      if (!loaded || saving || (event.pointerType === 'mouse' && event.button !== 0)) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
    };
    canvas.onpointermove = (event) => {
      if (!drag || drag.id !== event.pointerId || saving) return;
      const rect = squareCropRect(image.naturalWidth, image.naturalHeight, state.zoom, state.x, state.y);
      const scale = rect.size / canvas.getBoundingClientRect().width;
      const horizontal = image.naturalWidth - rect.size;
      const vertical = image.naturalHeight - rect.size;
      if (horizontal > 0) state.x = Math.max(0, Math.min(1, state.x - (event.clientX - drag.x) * scale / horizontal));
      if (vertical > 0) state.y = Math.max(0, Math.min(1, state.y - (event.clientY - drag.y) * scale / vertical));
      drag.x = event.clientX; drag.y = event.clientY;
      draw();
    };
    canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = () => { drag = null; };
    apply.onclick = async () => {
      if (!loaded || saving) return;
      saving = true;
      apply.disabled = reset.disabled = true;
      apply.textContent = '処理中…';
      error.textContent = '';
      draw();
      try {
        const rect = squareCropRect(image.naturalWidth, image.naturalHeight, state.zoom, state.x, state.y);
        const output = document.createElement('canvas');
        output.width = output.height = squareOutputSize(rect.size);
        const outputContext = output.getContext('2d');
        if (!outputContext) throw new Error('写真を処理できませんでした。');
        outputContext.drawImage(image, rect.x, rect.y, rect.size, rect.size, 0, 0, output.width, output.height);
        const blob = await new Promise((done) => output.toBlob(done, 'image/png'));
        if (closed) return;
        if (!blob) throw new Error('写真を処理できませんでした。');
        const cropped = new File([blob], `${original.name.replace(/\.[^.]+$/u, '')}-square.png`, { type: 'image/png' });
        cropEdits.set(cropped, { original, state: { ...state } });
        finish(cropped);
      } catch (caught) {
        if (closed) return;
        error.textContent = caught instanceof Error ? caught.message : '写真を処理できませんでした。';
        saving = false;
        apply.disabled = reset.disabled = false;
        apply.textContent = '切り抜きを使う';
        draw();
      }
    };
    image.onload = () => {
      if (closed) return;
      if (!context || !image.naturalWidth || !image.naturalHeight) { image.onerror(); return; }
      loaded = true;
      apply.disabled = false;
      draw();
    };
    image.onerror = () => {
      if (closed) return;
      error.textContent = 'この写真はブラウザで開けません。JPEGまたはPNGの写真を選んでください。キャンセルすると元の写真を保てます。';
      reset.disabled = true;
    };
    document.body.appendChild(dialog);
    try { dialog.showModal(); image.src = url; }
    catch (caught) { reject(caught); finish(null); }
  });
}
