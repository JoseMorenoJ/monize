/**
 * SVG chart capture utility for PDF export.
 * Converts Recharts SVG elements to high-resolution PNG images.
 */

export interface CapturedChart {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Captures a Recharts SVG element from a container and converts it to a PNG data URL.
 * Forces a white background regardless of dark mode for print-friendly output.
 */
export async function captureSvgAsImage(
  container: HTMLElement,
  scale: number = 2,
): Promise<CapturedChart | null> {
  const svg = container.querySelector('svg.recharts-surface') as SVGSVGElement | null;
  if (!svg) return null;

  const svgClone = svg.cloneNode(true) as SVGSVGElement;
  const svgRect = svg.getBoundingClientRect();
  const width = svgRect.width;
  const height = svgRect.height;

  // Ensure the clone has explicit dimensions and a white background
  svgClone.setAttribute('width', String(width));
  svgClone.setAttribute('height', String(height));
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

  // Add white background rect as the first child
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('width', '100%');
  bgRect.setAttribute('height', '100%');
  bgRect.setAttribute('fill', 'white');
  svgClone.insertBefore(bgRect, svgClone.firstChild);

  // Force dark-mode text to black for print
  const textElements = svgClone.querySelectorAll('text, tspan');
  textElements.forEach((el) => {
    const elem = el as SVGElement;
    const fill = elem.getAttribute('fill');
    if (fill === 'currentColor' || !fill) {
      elem.setAttribute('fill', '#374151');
    }
  });

  // Force grid lines to light gray
  const lines = svgClone.querySelectorAll('line, path');
  lines.forEach((el) => {
    const elem = el as SVGElement;
    if (elem.classList.contains('stroke-gray-200') || elem.classList.contains('stroke-gray-700')) {
      elem.setAttribute('stroke', '#e5e7eb');
      elem.classList.remove('stroke-gray-200', 'stroke-gray-700');
    }
  });

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgClone);
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise<CapturedChart>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to get canvas 2d context'));
        return;
      }
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve({
        dataUrl: canvas.toDataURL('image/png'),
        width,
        height,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG image'));
    };
    img.src = url;
  });
}
