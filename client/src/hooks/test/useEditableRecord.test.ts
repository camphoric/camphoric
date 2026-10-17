import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { ApiError } from 'utils/fetch';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  useConflictAwareSave,
  useEditableRecord,
  useLatestWhileUnchanged,
} from '../useEditableRecord';

const openEditConflict = vi.hoisted(() => vi.fn());
vi.mock('components/EditConflict', () => ({ openEditConflict }));
vi.mock('hooks/auth', () => ({ useCurrentUser: () => ({ data: { id: 9 } }) }));

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
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(
    ({ record }: { record: Camper }) =>
      useEditableRecord(record, { toForm, saveRecord, label: 'camper' }),
    { initialProps: { record: v1 }, wrapper },
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

  it('is saved, without asking, when theirs is already just what I wanted', async () => {
    const theirs = { ...v1, version: 2, notes: 'Mine' };
    const saveRecord = vi.fn().mockRejectedValue(conflict(theirs));
    const { result } = setup(saveRecord);
    act(() => result.current.setField('notes', 'Mine'));
    let answer: Camper | undefined;
    await act(async () => {
      answer = await result.current.save();
    });
    expect(openEditConflict).not.toHaveBeenCalled();
    expect(saveRecord).toHaveBeenCalledTimes(1);
    expect(answer).toBe(theirs);
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

describe('useLatestWhileUnchanged (a form showing what someone else saved, §9.8)', () => {
  const v2: Camper = { ...v1, version: 2, notes: 'Theirs' };

  function follow(unchanged: boolean) {
    const show = vi.fn();
    const initialProps: { record?: Camper } = { record: v1 };
    const hook = renderHook(
      ({ record }: { record?: Camper }) => useLatestWhileUnchanged(record, () => unchanged, show),
      { initialProps },
    );
    return { ...hook, show };
  }

  it('shows a newer version while nothing in the form is unsaved', () => {
    const { result, rerender, show } = follow(true);
    rerender({ record: v2 });
    expect(show).toHaveBeenCalledWith(v2);
    expect(result.current[0]).toBe(v2);
  });

  it('keeps the version the edits were made from while some are unsaved', () => {
    const { result, rerender, show } = follow(false);
    rerender({ record: v2 });
    expect(show).not.toHaveBeenCalled();
    expect(result.current[0]).toBe(v1);
  });

  it('measures from the version the user took or saved, shown in the form', () => {
    const { result, rerender, show } = follow(false);
    act(() => result.current[1](v2));
    expect(show).toHaveBeenCalledWith(v2);
    expect(result.current[0]).toBe(v2);
    // The list catching up to it changes nothing.
    rerender({ record: v2 });
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('starts another record (or none) from it as it is, without showing it over the form', () => {
    const { result, rerender, show } = follow(false);
    const other = { ...v1, id: 2 };
    rerender({ record: other });
    expect(result.current[0]).toBe(other);
    rerender({ record: undefined });
    expect(result.current[0]).toBeUndefined();
    expect(show).not.toHaveBeenCalled();
  });
});

describe('useConflictAwareSave from the version shown', () => {
  it('saves from a newer version the form was moved on to', async () => {
    const saveRecord = vi.fn((body: object) => Promise.resolve({ ...v1, ...body, version: 3 }));
    const { result, rerender } = renderHook(
      ({ record }: { record: Camper }) =>
        useConflictAwareSave(record, { toForm, saveRecord, label: 'camper' }, true),
      { initialProps: { record: v1 } },
    );
    const v2 = { ...v1, version: 2, notes: 'Theirs' };
    rerender({ record: v2 });
    await act(() => result.current({ ...toForm(v2), notes: 'Mine' }, vi.fn()));
    // Only my change, from their version: no conflict to ask about.
    expect(saveRecord).toHaveBeenCalledWith({ id: 1, version: 2, notes: 'Mine' });
    expect(openEditConflict).not.toHaveBeenCalled();
  });
});
