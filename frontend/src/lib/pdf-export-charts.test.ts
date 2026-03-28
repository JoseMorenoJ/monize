import { describe, it, expect } from 'vitest';
import { captureSvgAsImage, captureAllChartsAsImages } from './pdf-export-charts';

/**
 * Creates a realistic Recharts DOM structure: .recharts-wrapper > svg.recharts-surface
 */
function createRechartsWrapper(svgAttrs?: Record<string, string>): HTMLDivElement {
  const wrapper = document.createElement('div');
  wrapper.classList.add('recharts-wrapper');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('recharts-surface');
  if (svgAttrs) {
    for (const [key, value] of Object.entries(svgAttrs)) {
      svg.setAttribute(key, value);
    }
  }
  wrapper.appendChild(svg);
  return wrapper;
}

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

describe('captureAllChartsAsImages', () => {
  it('returns empty array when container has no SVGs', async () => {
    const container = document.createElement('div');
    const result = await captureAllChartsAsImages(container);
    expect(result).toEqual([]);
  });

  it('returns empty array when SVGs have wrong class', async () => {
    const container = document.createElement('div');
    const wrapper = document.createElement('div');
    wrapper.classList.add('recharts-wrapper');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('other-class');
    wrapper.appendChild(svg);
    container.appendChild(wrapper);
    const result = await captureAllChartsAsImages(container);
    expect(result).toEqual([]);
  });

  it('returns empty array when chart SVGs have no dimensions', async () => {
    const container = document.createElement('div');
    // Create SVGs in proper Recharts structure but no width/height attributes
    // jsdom returns 0 for getBoundingClientRect, so dimensions will be unresolvable
    for (let i = 0; i < 3; i++) {
      container.appendChild(createRechartsWrapper());
    }
    const result = await captureAllChartsAsImages(container);
    expect(result).toEqual([]);
  });

  it('ignores legend icon SVGs inside recharts-legend-wrapper', async () => {
    const container = document.createElement('div');
    // Main chart SVG (no dimensions, so will be filtered by dimension check)
    container.appendChild(createRechartsWrapper());
    // Legend icon SVG -- nested inside legend wrapper, should not be matched
    const legendWrapper = document.createElement('div');
    legendWrapper.classList.add('recharts-legend-wrapper');
    const legendSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    legendSvg.classList.add('recharts-surface');
    legendSvg.setAttribute('width', '14');
    legendSvg.setAttribute('height', '14');
    legendWrapper.appendChild(legendSvg);
    container.appendChild(legendWrapper);
    const result = await captureAllChartsAsImages(container);
    // Should return empty -- main chart has no dimensions, legend SVG is excluded by selector
    expect(result).toEqual([]);
  });
});
