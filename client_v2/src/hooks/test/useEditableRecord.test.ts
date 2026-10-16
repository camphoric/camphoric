import { act, renderHook } from '@testing-library/react';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEditableRecord } from '../useEditableRecord';

const openEditConflict = vi.hoisted(() => vi.fn());
vi.mock('components/EditConflict', () => ({ openEditConflict }));

interface Camper {
  id: number;
  version: number;
  attributes: Record<string, string>;
  notes: string;
}

const v1: Camper = { id: 1, version: 1, attributes: { name: 'Pat', diet: 'None' }, notes: '' };
const toForm = ({ attributes, notes }: Camper) => ({ attributes, notes });

const conflict = (current: Camper) =>
  new ApiError(412, 'Precondition Failed', { code: 'version_conflict', current });

function setup(saveRecord: (body: object) => Promise<Camper>) {
  return renderHook(
    ({ record }: { record: Camper }) =>
      useEditableRecord(record, { toForm, saveRecord, label: 'camper' }),
    { initialProps: { record: v1 } },
  );
}

const rename = (name: string) => (form: ReturnType<typeof toForm>) => ({
  ...form,
  attributes: { ...form.attributes, name },
});

beforeEach(() => {
  openEditConflict.mockReset();
});

describe('useEditableRecord (SPEC §9.8, DR-109)', () => {
  it('follows the record while there are no edits', () => {
    const { result, rerender } = setup(vi.fn());
    rerender({ record: { ...v1, version: 2, notes: 'Theirs' } });
    expect(result.current.form.notes).toBe('Theirs');
    expect(result.current.isStale).toBe(false);
  });

  it('keeps edits when the record moves on, says so, and can drop them', () => {
    const { result, rerender } = setup(vi.fn());
    act(() => result.current.setForm(rename('Pattie')));
    const theirs = { ...v1, version: 2, notes: 'Theirs' };
    rerender({ record: theirs });
    expect(result.current.form.attributes.name).toBe('Pattie');
    expect(result.current.isDirty).toBe(true);
    expect(result.current.isStale).toBe(true);

    act(() => result.current.loadLatest());
    expect(result.current.form).toEqual(toForm(theirs));
    expect(result.current.isDirty).toBe(false);
  });

  it('saves only what changed, from the version it was edited from', async () => {
    const saved = { ...v1, version: 2, attributes: { name: 'Pattie', diet: 'None' } };
    const saveRecord = vi.fn(() => Promise.resolve(saved));
    const { result, rerender } = setup(saveRecord);
    act(() => result.current.setForm(rename('Pattie')));

    let answer: Camper | undefined;
    await act(async () => {
      answer = await result.current.save();
    });
    expect(saveRecord).toHaveBeenCalledWith({ id: 1, version: 1, attributes: saved.attributes });
    expect(answer).toBe(saved);
    expect(result.current.isDirty).toBe(false);

    // The list still holds the copy from before the save; it isn't news.
    rerender({ record: v1 });
    expect(result.current.form.attributes.name).toBe('Pattie');
  });

  it('puts my changes on top of theirs when I choose to', async () => {
    const theirs = { ...v1, version: 2, attributes: { name: 'Pat', diet: 'Vegan' } };
    const merged = { ...theirs, version: 3, attributes: { name: 'Pattie', diet: 'Vegan' } };
    const saveRecord = vi
      .fn()
      .mockRejectedValueOnce(conflict(theirs))
      .mockResolvedValueOnce(merged);
    openEditConflict.mockResolvedValue('reapply');
    const { result } = setup(saveRecord);
    act(() => result.current.setForm(rename('Pattie')));

    await act(async () => {
      await result.current.save();
    });
    expect(openEditConflict).toHaveBeenCalledWith(
      expect.objectContaining({ base: toForm(v1), theirs: toForm(theirs) }),
    );
    expect(saveRecord).toHaveBeenLastCalledWith({
      id: 1,
      version: 2,
      attributes: { name: 'Pattie', diet: 'Vegan' },
    });
    expect(result.current.form).toEqual(toForm(merged));
  });

  it('saves again from their version, without asking, when they changed nothing I edit', async () => {
    const theirs = { ...v1, version: 2, attributes: { ...v1.attributes } };
    const saved = { ...theirs, version: 3, notes: 'Mine' };
    const saveRecord = vi.fn().mockRejectedValueOnce(conflict(theirs)).mockResolvedValueOnce(saved);
    const { result } = setup(saveRecord);
    act(() => result.current.setField('notes', 'Mine'));

    await act(async () => {
      await result.current.save();
    });
    expect(openEditConflict).not.toHaveBeenCalled();
    expect(saveRecord).toHaveBeenLastCalledWith({ id: 1, version: 2, notes: 'Mine' });
    expect(result.current.isDirty).toBe(false);
  });

  it('sends nothing when nothing changed', async () => {
    const saveRecord = vi.fn();
    const { result } = setup(saveRecord);
    let answer: Camper | undefined;
    await act(async () => {
      answer = await result.current.save();
    });
    expect(saveRecord).not.toHaveBeenCalled();
    expect(answer).toBe(v1);
  });

  it('keeps what was typed while the save was on its way', async () => {
    let finish: (camper: Camper) => void = () => undefined;
    const saveRecord = vi.fn(() => new Promise<Camper>((resolve) => (finish = resolve)));
    const { result } = setup(saveRecord);
    act(() => result.current.setField('notes', 'First'));
    let saving: Promise<unknown> = Promise.resolve();
    act(() => {
      saving = result.current.save();
    });
    act(() => result.current.setField('notes', 'First and second'));
    await act(async () => {
      finish({ ...v1, version: 2, notes: 'First' });
      await saving;
    });
    expect(result.current.form.notes).toBe('First and second');
    expect(result.current.isDirty).toBe(true);
  });

  it('takes theirs when I drop my changes', async () => {
    const theirs = { ...v1, version: 2, notes: 'Theirs' };
    const saveRecord = vi.fn().mockRejectedValue(conflict(theirs));
    openEditConflict.mockResolvedValue('discard');
    const { result } = setup(saveRecord);
    act(() => result.current.setForm(rename('Pattie')));

    let answer: Camper | undefined = v1;
    await act(async () => {
      answer = await result.current.save();
    });
    expect(answer).toBeUndefined();
    expect(saveRecord).toHaveBeenCalledTimes(1);
    expect(result.current.form).toEqual(toForm(theirs));
    expect(result.current.isDirty).toBe(false);
  });

  it('keeps the edits when a save fails for another reason', async () => {
    const saveRecord = vi.fn().mockRejectedValue(new ApiError(400, 'Bad Request', {}));
    const { result } = setup(saveRecord);
    act(() => result.current.setForm(rename('Pattie')));
    await act(async () => {
      expect(await result.current.save()).toBeUndefined();
    });
    expect(openEditConflict).not.toHaveBeenCalled();
    expect(result.current.form.attributes.name).toBe('Pattie');
  });
});
