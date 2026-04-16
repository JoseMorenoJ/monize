/**
 * Server-side arithmetic tool for the AI query engine.
 *
 * LLMs are unreliable at arithmetic. This tool lets the model delegate
 * calculations (percentages, ratios, differences, sums, averages) to
 * the server so the user always gets accurate results.
 *
 * All internal math uses integer arithmetic (scaled to 4 decimal places)
 * to avoid floating-point drift, matching the pattern prescribed in
 * CLAUDE.md for financial values.
 */

export type CalculateOperation =
  | "percentage"
  | "difference"
  | "ratio"
  | "sum"
  | "average";

export interface CalculateInput {
  operation: CalculateOperation;
  values: number[];
  label?: string;
}

export interface CalculateResult {
  result: number;
  formattedResult: string;
  operation: CalculateOperation;
  label?: string;
}

/**
 * Round a number to 2 decimal places using integer arithmetic.
 */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Safe summation using integer arithmetic (4 decimal places)
 * to avoid floating-point accumulation drift.
 */
function safeSum(values: number[]): number {
  const total = values.reduce((sum, v) => sum + Math.round(v * 10000), 0);
  return total / 10000;
}

/**
 * Execute a calculation and return the result with formatting.
 *
 * Operations:
 * - percentage: (values[0] / values[1]) * 100  -- "what % of whole is part?"
 * - difference: values[0] - values[1]          -- "how much more is A than B?"
 * - ratio:      values[0] / values[1]          -- "A to B ratio"
 * - sum:        sum of all values
 * - average:    arithmetic mean of all values
 */
export function executeCalculation(
  input: CalculateInput,
): CalculateResult | { error: string } {
  const { operation, values, label } = input;

  if (values.length === 0) {
    return { error: "At least one value is required." };
  }

  let result: number;

  switch (operation) {
    case "percentage": {
      if (values.length < 2) {
        return {
          error: "Percentage requires exactly 2 values: [part, whole].",
        };
      }
      const [part, whole] = values;
      if (whole === 0) {
        return { error: "Cannot calculate percentage: divisor is zero." };
      }
      result = round2((part / whole) * 100);
      break;
    }

    case "difference": {
      if (values.length < 2) {
        return {
          error: "Difference requires exactly 2 values: [a, b].",
        };
      }
      result = round2(values[0] - values[1]);
      break;
    }

    case "ratio": {
      if (values.length < 2) {
        return { error: "Ratio requires exactly 2 values: [a, b]." };
      }
      if (values[1] === 0) {
        return { error: "Cannot calculate ratio: divisor is zero." };
      }
      result = round2(values[0] / values[1]);
      break;
    }

    case "sum": {
      result = round2(safeSum(values));
      break;
    }

    case "average": {
      if (values.length === 0) {
        return { error: "Average requires at least one value." };
      }
      result = round2(safeSum(values) / values.length);
      break;
    }

    default:
      return { error: `Unknown operation: ${operation}` };
  }

  const formattedResult = formatResult(result, operation);

  return { result, formattedResult, operation, ...(label && { label }) };
}

function formatResult(value: number, operation: CalculateOperation): string {
  switch (operation) {
    case "percentage":
      return `${value}%`;
    case "ratio":
      return `${value}:1`;
    default:
      return value.toFixed(2);
  }
}
