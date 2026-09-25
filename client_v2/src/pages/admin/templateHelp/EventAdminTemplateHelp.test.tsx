import userEvent from '@testing-library/user-event';
import type { TemplatePreviewResponse } from 'api-types';
import { sampleDescription } from 'components/TemplateEditor/sampleDescription';
import { renderWithProviders, screen } from 'test/utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { EventAdminTemplateHelp } from './EventAdminTemplateHelp';

const { navigate, search, mutate, download } = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: { current: new Map<string, string>() },
  mutate: vi.fn(),
  download: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  useParams: () => ({ organizationId: '1', eventId: '4' }),
  useSearch: () => Object.fromEntries(search.current),
  useNavigate: () => navigate,
}));
vi.mock('store/templates', () => ({
  useTemplateDescription: () => ({ data: sampleDescription, isLoading: false }),
  useRenderTemplateOnce: () => ({ mutate, isPending: false }),
}));
vi.mock('utils/download', () => ({ downloadTextFile: download }));

beforeEach(() => {
  navigate.mockClear();
  mutate.mockReset();
  download.mockClear();
  search.current = new Map();
});

describe('EventAdminTemplateHelp', () => {
  it('follows the context and tab in the URL', () => {
    search.current = new Map([
      ['context', 'invitation_email'],
      ['helpTab', 'guide'],
      ['topic', 'mustache'],
    ]);
    renderWithProviders(<EventAdminTemplateHelp />);
    expect(screen.getByRole('textbox', { name: 'Kind of template' })).toHaveValue(
      sampleDescription.contexts.invitation_email.title,
    );
    expect(screen.getByRole('heading', { name: 'From Mustache emails' })).toBeInTheDocument();
  });

  it('keeps the search in the URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventAdminTemplateHelp />);
    await user.type(screen.getByLabelText('Search help'), 'x');
    const update = navigate.mock.calls.at(-1)?.[0] as { search: (prev: object) => object };
    expect(update.search({ reportId: '2' })).toEqual({ reportId: '2', q: 'x' });
  });

  it('downloads the sample variables', async () => {
    mutate.mockImplementation(
      (
        _request: unknown,
        { onSuccess }: { onSuccess: (result: TemplatePreviewResponse) => void },
      ) =>
        onSuccess({
          output: '{"event": {}}',
          diagnostics: [],
          truncated: false,
          duration_ms: 1,
          sample: null,
        }),
    );
    const user = userEvent.setup();
    renderWithProviders(<EventAdminTemplateHelp />);
    await user.click(screen.getByRole('button', { name: 'Download sample variables' }));

    const [request] = mutate.mock.calls[0] as [
      { context: string; output: string; template: string },
    ];
    expect(request).toMatchObject({ context: 'report', output: 'txt' });
    expect(request.template).toContain('dump(2)');
    expect(download).toHaveBeenCalledWith(
      '{"event": {}}',
      'application/json',
      'report-sample-variables.json',
    );
  });
});
