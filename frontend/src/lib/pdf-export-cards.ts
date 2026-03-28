/**
 * Summary card rendering utility for PDF export.
 * Draws a row of styled metric cards using jsPDF drawing primitives.
 */

import type jsPDF from 'jspdf';

export interface PdfSummaryCard {
  label: string;
  value: string;
  color?: string;
}

interface CardLayoutOptions {
  startY: number;
  pageWidth: number;
  margin: number;
}

const CARD_HEIGHT = 18;
const CARD_GAP = 4;
const CARD_PADDING = 4;
const CARD_RADIUS = 2;
const LABEL_FONT_SIZE = 8;
const VALUE_FONT_SIZE = 12;
const DEFAULT_VALUE_COLOR = '#111827';
const FILL_COLOR: [number, number, number] = [249, 250, 251]; // gray-50
const BORDER_COLOR: [number, number, number] = [229, 231, 235]; // gray-200
const LABEL_COLOR: [number, number, number] = [107, 114, 128]; // gray-500

/**
 * Parses a hex color string to RGB tuple.
 */
function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '');
  return [
    parseInt(cleaned.substring(0, 2), 16),
    parseInt(cleaned.substring(2, 4), 16),
    parseInt(cleaned.substring(4, 6), 16),
  ];
}

/**
 * Adds a row of summary cards to a jsPDF document.
 * Returns the Y position after the cards for subsequent content.
 */
export function addSummaryCardsToPdf(
  doc: jsPDF,
  cards: PdfSummaryCard[],
  options: CardLayoutOptions,
): number {
  if (cards.length === 0) return options.startY;

  const { startY, pageWidth, margin } = options;
  const availableWidth = pageWidth - margin * 2;
  const cardWidth = (availableWidth - CARD_GAP * (cards.length - 1)) / cards.length;

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    const x = margin + i * (cardWidth + CARD_GAP);

    // Card background
    doc.setFillColor(...FILL_COLOR);
    doc.setDrawColor(...BORDER_COLOR);
    doc.setLineWidth(0.25);
    doc.roundedRect(x, startY, cardWidth, CARD_HEIGHT, CARD_RADIUS, CARD_RADIUS, 'FD');

    // Label
    doc.setFontSize(LABEL_FONT_SIZE);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...LABEL_COLOR);
    doc.text(card.label, x + CARD_PADDING, startY + 6);

    // Value
    const valueColor = hexToRgb(card.color || DEFAULT_VALUE_COLOR);
    doc.setFontSize(VALUE_FONT_SIZE);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...valueColor);
    doc.text(card.value, x + CARD_PADDING, startY + 14);
  }

  return startY + CARD_HEIGHT + CARD_GAP;
}
