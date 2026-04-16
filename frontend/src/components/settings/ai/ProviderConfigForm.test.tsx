import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/render';
import { ProviderConfigForm } from './ProviderConfigForm';
import type { AiProviderConfig } from '@/types/ai';

const mockTestDraft = vi.fn();
const mockCreateConfig = vi.fn();
const mockUpdateConfig = vi.fn();

vi.mock('@/lib/ai', () => ({
  aiApi: {
    testDraft: (...args: unknown[]) => mockTestDraft(...args),
    createConfig: (...args: unknown[]) => mockCreateConfig(...args),
    updateConfig: (...args: unknown[]) => mockUpdateConfig(...args),
  },
}));

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();

vi.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock('@/lib/errors', () => ({
  getErrorMessage: (_e: unknown, fallback: string) => fallback,
}));

vi.mock('@/components/ui/Modal', () => ({
  Modal: ({ children, isOpen }: any) => (isOpen ? <div data-testid="modal">{children}</div> : null),
}));

const existingConfig: AiProviderConfig = {
  id: 'existing-1',
  provider: 'anthropic',
  displayName: 'My Claude',
  isActive: true,
  priority: 0,
  model: 'claude-sonnet-4-20250514',
  apiKeyMasked: '****abcd',
  baseUrl: null,
  config: {},
  inputCostPer1M: null,
  outputCostPer1M: null,
  costCurrency: 'USD',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('ProviderConfigForm — inline Test button', () => {
  const noop = async () => undefined;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a Test button next to the Model input', () => {
    render(
      <ProviderConfigForm isOpen={true} onClose={noop} onSubmit={noop} />,
    );
    expect(screen.getByRole('button', { name: /test model/i })).toBeInTheDocument();
  });

  it('sends the current form values to testDraft when clicked', async () => {
    mockTestDraft.mockResolvedValueOnce({
      available: true,
      modelAvailable: true,
      model: 'claude-sonnet-4-20250514',
    });

    const { container } = render(
      <ProviderConfigForm isOpen={true} onClose={noop} onSubmit={noop} />,
    );

    // Fill in a model and API key so the draft body mirrors what the
    // user typed (anthropic is the default provider).
    const modelInput = container.querySelector('input[name="model"]') as HTMLInputElement;
    const apiKeyInput = container.querySelector('input[name="apiKey"]') as HTMLInputElement;
    fireEvent.change(modelInput, { target: { value: 'claude-sonnet-4-20250514' } });
    fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test' } });

    fireEvent.click(screen.getByRole('button', { name: /test model/i }));

    await waitFor(() => {
      expect(mockTestDraft).toHaveBeenCalledWith({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        apiKey: 'sk-ant-test',
      });
    });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        'Model "claude-sonnet-4-20250514" is ready.',
      );
    });
  });

  it('surfaces modelError when the server is reachable but the model is missing', async () => {
    mockTestDraft.mockResolvedValueOnce({
      available: true,
      modelAvailable: false,
      model: 'typo-4o',
      modelError: 'Model "typo-4o" was not found.',
    });

    render(
      <ProviderConfigForm isOpen={true} onClose={noop} onSubmit={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /test model/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Model "typo-4o" was not found.',
        expect.objectContaining({ duration: 7000 }),
      );
    });
  });

  it('surfaces a connection error when the provider itself is unreachable', async () => {
    mockTestDraft.mockResolvedValueOnce({
      available: false,
      error: 'Connection test failed. Check your provider settings.',
    });

    render(
      <ProviderConfigForm isOpen={true} onClose={noop} onSubmit={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /test model/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        'Connection test failed. Check your provider settings.',
        expect.objectContaining({ duration: 6000 }),
      );
    });
  });

  it('passes configId (not apiKey) when editing without retyping the stored key', async () => {
    mockTestDraft.mockResolvedValueOnce({ available: true, modelAvailable: true, model: existingConfig.model });

    render(
      <ProviderConfigForm
        isOpen={true}
        onClose={noop}
        onSubmit={noop}
        editConfig={existingConfig}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /test model/i }));

    await waitFor(() => {
      expect(mockTestDraft).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'anthropic',
          model: 'claude-sonnet-4-20250514',
          configId: 'existing-1',
        }),
      );
    });
    // The user didn't type a new key, so apiKey must NOT be sent.
    expect(mockTestDraft.mock.calls[0][0]).not.toHaveProperty('apiKey');
  });

  it('prefers a newly-typed apiKey over the configId fallback', async () => {
    mockTestDraft.mockResolvedValueOnce({ available: true, modelAvailable: true, model: existingConfig.model });

    const { container } = render(
      <ProviderConfigForm
        isOpen={true}
        onClose={noop}
        onSubmit={noop}
        editConfig={existingConfig}
      />,
    );
    const apiKeyInput = container.querySelector('input[name="apiKey"]') as HTMLInputElement;
    fireEvent.change(apiKeyInput, { target: { value: 'sk-new-key' } });

    fireEvent.click(screen.getByRole('button', { name: /test model/i }));

    await waitFor(() => {
      expect(mockTestDraft).toHaveBeenCalled();
    });
    const payload = mockTestDraft.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.apiKey).toBe('sk-new-key');
    // When the user has typed a new key the configId fallback is not needed.
    expect(payload.configId).toBeUndefined();
  });

  it('falls back to the generic fetch-failed toast when testDraft throws', async () => {
    mockTestDraft.mockRejectedValueOnce(new Error('Network error'));

    render(
      <ProviderConfigForm isOpen={true} onClose={noop} onSubmit={noop} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /test model/i }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Model test failed');
    });
  });

  it('disables the Test button while a test is in flight', async () => {
    let resolveTest: (v: unknown) => void;
    mockTestDraft.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveTest = resolve;
      }),
    );

    render(
      <ProviderConfigForm isOpen={true} onClose={noop} onSubmit={noop} />,
    );
    const button = screen.getByRole('button', { name: /test model/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(button).toBeDisabled();
    });

    resolveTest!({ available: true });
    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });
});
