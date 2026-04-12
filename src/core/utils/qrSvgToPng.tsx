import { createRoot } from 'react-dom/client';
import QRCode from 'react-qr-code';

/** QRCodePanel と共通: SVG を白背景 PNG に raster 化 */
export async function svgQrToPngBlob(svg: SVGElement): Promise<Blob> {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svg);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const objectUrl = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || svg.clientWidth || 256;
      const h = img.naturalHeight || svg.clientHeight || 256;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('2d context unavailable'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) resolve(blob);
          else reject(new Error('toBlob failed'));
        },
        'image/png',
        1,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('svg image load failed'));
    };
    img.src = objectUrl;
  });
}

/** 一時的に react-qr-code を描画して PNG Blob を生成（書き出しフレーム用） */
export async function renderQrValueToPngBlob(value: string, size: number): Promise<Blob> {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden';
  document.body.appendChild(host);
  const root = createRoot(host);
  root.render(
    <QRCode value={value} size={size} level="M" fgColor="#1f2937" bgColor="#ffffff" />,
  );
  await new Promise<void>((r) => {
    requestAnimationFrame(() => requestAnimationFrame(() => r()));
  });
  const svg = host.querySelector('svg');
  try {
    if (!svg) throw new Error('QR SVG not found');
    return await svgQrToPngBlob(svg);
  } finally {
    root.unmount();
    host.remove();
  }
}
