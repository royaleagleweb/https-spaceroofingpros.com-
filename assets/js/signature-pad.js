/* ============================================================
   Reusable canvas signature pad
   ------------------------------------------------------------
   Used by the operator countersign step and by the client
   signing page. `toDataURL()` trims to the ink bounding box and
   downscales, so a signature costs a few KB instead of tens —
   which matters because signed contracts travel inside a URL.
   ============================================================ */

export function createSignaturePad(canvas, opts) {
  const o = Object.assign({ color: '#222', width: 2.2, maxWidth: 420 }, opts || {});
  const ctx = canvas.getContext('2d');
  let drawing = false;
  let hasInk = false;
  let bounds = null;              // ink bounding box in CSS pixels
  const onChange = o.onChange || (() => {});

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const prev = hasInk ? canvas.toDataURL() : null;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = o.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = o.color;
    if (prev) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = prev;
    }
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function track(p) {
    if (!bounds) bounds = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    else {
      bounds.x1 = Math.min(bounds.x1, p.x);
      bounds.y1 = Math.min(bounds.y1, p.y);
      bounds.x2 = Math.max(bounds.x2, p.x);
      bounds.y2 = Math.max(bounds.y2, p.y);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    drawing = true;
    canvas.setPointerCapture(e.pointerId);
    const p = pos(e);
    track(p);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return;
    const p = pos(e);
    track(p);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    if (!hasInk) {
      hasInk = true;
      canvas.classList.add('is-drawn');
      onChange(true);
    }
  });

  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => {
    canvas.addEventListener(ev, () => { drawing = false; });
  });

  resize();
  window.addEventListener('resize', resize);

  return {
    get hasInk() { return hasInk; },

    clear() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasInk = false;
      bounds = null;
      canvas.classList.remove('is-drawn');
      onChange(false);
    },

    /** Trimmed, downscaled PNG data URL — or '' when nothing was drawn. */
    toDataURL() {
      if (!hasInk || !bounds) return '';
      const pad = 8;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const x1 = Math.max(0, bounds.x1 - pad);
      const y1 = Math.max(0, bounds.y1 - pad);
      const x2 = Math.min(rect.width, bounds.x2 + pad);
      const y2 = Math.min(rect.height, bounds.y2 + pad);
      const w = Math.max(1, x2 - x1);
      const h = Math.max(1, y2 - y1);

      const scale = Math.min(1, o.maxWidth / w);
      const out = document.createElement('canvas');
      out.width = Math.max(1, Math.round(w * scale));
      out.height = Math.max(1, Math.round(h * scale));
      const octx = out.getContext('2d');
      octx.drawImage(
        canvas,
        Math.round(x1 * dpr), Math.round(y1 * dpr),
        Math.round(w * dpr), Math.round(h * dpr),
        0, 0, out.width, out.height
      );
      return out.toDataURL('image/png');
    },
  };
}
