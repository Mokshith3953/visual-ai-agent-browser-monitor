import { CAPTURE_JPEG_QUALITY, CAPTURE_MAX_EDGE } from '../lib/config';
import { perceptualHash } from '../lib/phash';

/**
 * Offscreen document: the service worker has no DOM, so all canvas work
 * (decode → downscale → JPEG compress → perceptual hash) happens here.
 */

interface ProcessRequest {
  target: 'offscreen';
  type: 'process-capture';
  dataUrl: string; // PNG data URL from chrome.tabs.captureVisibleTab
}

interface ProcessResponse {
  imageBase64: string;
  width: number;
  height: number;
  phash: string;
}

chrome.runtime.onMessage.addListener((msg: ProcessRequest, _sender, sendResponse) => {
  if (msg?.target !== 'offscreen' || msg.type !== 'process-capture') return;
  processCapture(msg.dataUrl)
    .then((res) => sendResponse({ ok: true, ...res }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // async response
});

async function processCapture(dataUrl: string): Promise<ProcessResponse> {
  const blob = await (await fetch(dataUrl)).blob();
  const bitmap = await createImageBitmap(blob);

  const scale = Math.min(1, CAPTURE_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);

  const jpeg = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: CAPTURE_JPEG_QUALITY,
  });
  const imageBase64 = await blobToBase64(jpeg);
  const phash = await perceptualHash(bitmap);
  bitmap.close();

  return { imageBase64, width: w, height: h, phash };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? ''); // strip data: prefix
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
