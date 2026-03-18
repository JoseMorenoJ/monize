import { describe, it, expect } from 'vitest';
import { captureSvgAsImage } from './pdf-export-charts';

describe('captureSvgAsImage', () => {
  it('returns null when no SVG element is found', async () => {
    const container = document.createElement('div');
    const result = await captureSvgAsImage(container);
    expect(result).toBeNull();
  });

  it('returns null for empty container', async () => {
    const container = document.createElement('div');
    container.innerHTML = '<div>No chart here</div>';
    const result = await captureSvgAsImage(container);
    expect(result).toBeNull();
  });

  it('returns null when SVG has wrong class', async () => {
    const container = document.createElement('div');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('other-class');
    container.appendChild(svg);
    const result = await captureSvgAsImage(container);
    expect(result).toBeNull();
  });
});
