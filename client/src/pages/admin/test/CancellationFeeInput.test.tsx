import { fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from 'test/utils';
import { describe, expect, it, vi } from 'vitest';

import { CancellationFeeInput } from '../CancellationFeeInput';

vi.mock('components/JsonEditor', () => ({
  JsonEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="Fee logic" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

const logic = () => screen.getByRole('textbox', { name: 'Fee logic' });

describe('CancellationFeeInput', () => {
  it('offers none to start with, and a percent once switched on', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CancellationFeeInput value={null} onChange={onChange} />);
    expect(screen.queryByRole('textbox', { name: 'Fee logic' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: /Offer a cancellation fee/ }));
    expect(onChange).toHaveBeenCalledWith({ '*': [{ var: 'total' }, 0.1] });
  });

  it('switches off to none', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CancellationFeeInput value={50} onChange={onChange} />);
    expect(logic()).toHaveValue('50');
    await user.click(screen.getByRole('switch', { name: /Offer a cancellation fee/ }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('starts from an example', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(<CancellationFeeInput value={50} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '10%, or 50% within 30 days' }));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ if: expect.any(Array) as unknown }),
    );
  });

  it('keeps what isn’t a fee to itself, says so, and tells the page', () => {
    const onChange = vi.fn();
    const onErrorChange = vi.fn();
    renderWithProviders(
      <CancellationFeeInput value={50} onChange={onChange} onErrorChange={onErrorChange} />,
    );
    fireEvent.change(logic(), { target: { value: '{"*": [' } });
    expect(screen.getByText('Not a fee yet')).toBeInTheDocument();
    expect(onErrorChange).toHaveBeenLastCalledWith(expect.stringMatching(/^Invalid JSON/));
    for (const text of ['null', '"ten"', 'true', '[1]', '{"*": [1, 2], "min": [1, 2]}']) {
      fireEvent.change(logic(), { target: { value: text } });
      expect(logic()).toBeInTheDocument();
    }
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(logic(), { target: { value: '25' } });
    expect(onChange).toHaveBeenCalledWith(25);
    expect(onErrorChange).toHaveBeenLastCalledWith(null);
  });

  it('shows a value changed from outside', () => {
    const { rerender } = renderWithProviders(
      <CancellationFeeInput value={50} onChange={vi.fn()} />,
    );
    rerender(<CancellationFeeInput value={75} onChange={vi.fn()} />);
    expect(logic()).toHaveValue('75');
  });

  it('shows a fee set from outside where there was none', () => {
    const { rerender } = renderWithProviders(
      <CancellationFeeInput value={null} onChange={vi.fn()} />,
    );
    rerender(<CancellationFeeInput value={{ '*': [{ var: 'total' }, 0.2] }} onChange={vi.fn()} />);
    expect(logic()).toHaveValue(JSON.stringify({ '*': [{ var: 'total' }, 0.2] }, null, 2));
  });
});
