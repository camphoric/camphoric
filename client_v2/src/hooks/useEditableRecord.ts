/**
 * The form state of an admin edit screen over one record (SPEC §9.8, DR-109).
 *
 * - The form starts from the record, and follows it while it has no unsaved
 *   edits, so someone else's saved change shows up. Once edited, it stays as
 *   the user left it: a refetch never wipes their edits. If the record moves on
 *   underneath (someone else saved it), `isStale` says so, and `loadLatest`
 *   drops the edits for the record as it is now.
 * - `save` sends only the fields that changed, with the version they were
 *   edited from as `If-Match`. When someone else saved first, the server
 *   refuses (412) and the edit conflict asks the user whether to put their
 *   changes on top of the other person's, or drop them.
 *
 * - With `lease` (the record's kind, e.g. `registration`), it also holds the
 *   record's edit lease while there are unsaved edits, and says when someone
 *   else is editing it (hooks/useEditLease, DR-110).
 *
 * The form is the record's editable fields (`toForm`), sent back as they are.
 * Pass the entity's `useUpdate({ handlesVersionConflict: true }).mutateAsync`
 * as `saveRecord`.
 */

import type { Scalar } from 'api-types';
import { openEditConflict } from 'components/EditConflict';
import { type EditLeaseState, useEditLease } from 'hooks/useEditLease';
import { useCallback, useEffect, useRef, useState } from 'react';
import { versionConflict } from 'utils/fetch';
import { changedFields, isEqual, threeWayMerge } from 'utils/merge';

export interface VersionedRecord {
  id: Scalar;
  version?: number;
}

/** The changed fields, the record's id, and the version they were edited from. */
export type SaveBody<R extends VersionedRecord, F> = Partial<F> &
  Pick<R, 'id'> & { version?: number };

export interface EditableRecordOptions<R extends VersionedRecord, F extends object> {
  /** The record's editable fields. */
  toForm: (record: R) => F;
  /** Saves the changed fields; rejects with the API's error. */
  saveRecord: (body: SaveBody<R, F>) => Promise<R>;
  /** What's being edited, for the conflict, e.g. "registration". */
  label: string;
  fieldLabels?: Record<string, string>;
}

export interface EditableRecordWithLease<
  R extends VersionedRecord,
  F extends object,
> extends EditableRecordOptions<R, F> {
  /** Hold the record's edit lease, naming its kind (`registration`, `camper`, …). */
  lease?: string;
  /** The page has unsaved changes that belong with this record's (Home's email drafts). */
  unsavedElsewhere?: boolean;
  /** Their entities, fetched afresh with the record when someone else's lease ends. */
  alsoRefresh?: string[];
}

export interface EditableRecord<R, F> {
  form: F;
  setForm: (form: F | ((form: F) => F)) => void;
  setField: <K extends keyof F>(key: K, value: F[K]) => void;
  /** The form differs from the record it was opened with. */
  isDirty: boolean;
  /** Someone else saved the record since, while this form has unsaved edits. */
  isStale: boolean;
  /** Drop the edits for the record as it is now. */
  loadLatest: () => void;
  /**
   * Save the changes. Resolves to the saved record, or undefined when nothing
   * was saved (the user dropped their changes, or the save failed: the API's
   * error is reported by the mutation, as for any save).
   */
  save: () => Promise<R | undefined>;
  /** Who else is editing the record (with `lease`). */
  lease: EditLeaseState;
}

export function useEditableRecord<R extends VersionedRecord, F extends object>(
  record: R,
  {
    toForm,
    saveRecord,
    label,
    fieldLabels,
    lease: model,
    unsavedElsewhere = false,
    alsoRefresh,
  }: EditableRecordWithLease<R, F>,
): EditableRecord<R, F> {
  const fromRecord = (from: R): Edit<R, F> => {
    const fields = toForm(from);
    return { id: from.id, base: fields, version: from.version, form: fields };
  };
  const [state, setState] = useState<Edit<R, F>>(() => fromRecord(record));
  // `save` works across awaits; it reads the latest state from here.
  const latest = useRef(state);
  latest.current = state;

  const isDirty = !isEqual(state.base, state.form);
  const lease = useEditLease(model, record.id, isDirty || unsavedElsewhere, alsoRefresh);

  // Follow the record while there's nothing to lose. Only a newer version is
  // news: a refetch of the same one isn't, nor is an older copy still cached
  // just after this form saved.
  const isNewer = isNewerVersion(record.version, state.version);
  useEffect(() => {
    if (record.id !== latest.current.id || (isNewer && !isDirty)) setState(fromRecord(record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record.id, isNewer, isDirty]);

  const setForm = useCallback((next: F | ((form: F) => F)) => {
    setState((s) => ({ ...s, form: typeof next === 'function' ? next(s.form) : next }));
  }, []);

  const setField = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setState((s) => ({ ...s, form: { ...s.form, [key]: value } }));
  }, []);

  const loadLatest = () => setState(fromRecord(record));

  const save = async (): Promise<R | undefined> => {
    // Nothing to send: saving it would only make it look edited to others.
    if (!isDirty) return record;
    // What's being saved, so typing that goes on meanwhile is kept.
    let sent = latest.current.form;
    const outcome = await saveResolvingConflicts(latest.current, {
      toForm,
      saveRecord,
      label,
      fieldLabels,
      onRebase: (edit) => {
        sent = edit.form;
        setState(edit);
      },
    });
    const { saved, discarded } = outcome ?? {};
    if (saved) {
      const fields = toForm(saved);
      setState((s) => ({
        id: s.id,
        base: fields,
        version: saved.version,
        form: s.form === sent ? fields : s.form,
      }));
    }
    if (discarded) setState(fromRecord(discarded));
    return saved;
  };

  return {
    form: state.form,
    setForm,
    setField,
    isDirty,
    isStale: isDirty && isNewer,
    loadLatest,
    save,
    lease,
  };
}

/**
 * For an editor that keeps its own form state (raw JSON, say): remembers the
 * record's fields and version as the edit started, and saves the form from
 * them as `saveResolvingConflicts` does. `onRebase` gets the form after the
 * user put their changes on top of someone else's; the editor shows it.
 */
export function useConflictAwareSave<R extends VersionedRecord, F extends object>(
  record: R | undefined,
  options: EditableRecordOptions<R, F>,
) {
  const startFrom = (from: R) => ({
    id: from.id,
    base: options.toForm(from),
    version: from.version,
  });
  const [start, setStart] = useState(() => record && startFrom(record));
  // A form opened again, or for another record, starts from the record as it is.
  useEffect(() => {
    setStart(record && startFrom(record));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);
  /** Resolves as `saveResolvingConflicts` does; undefined without a record. */
  return async (form: F, onRebase: (form: F) => void) => {
    if (!record) return undefined;
    const from = start?.id === record.id ? start : startFrom(record);
    // Nothing to send: saving it would only make it look edited to others.
    if (isEqual(from.base, form)) return { saved: record };
    const outcome = await saveResolvingConflicts(
      { ...from, form },
      {
        ...options,
        onRebase: (edit) => {
          setStart({ id: edit.id, base: edit.base, version: edit.version });
          onRebase(edit.form);
        },
      },
    );
    const latest = outcome?.saved ?? outcome?.discarded;
    if (latest) setStart(startFrom(latest));
    return outcome;
  };
}

export interface Edit<R extends VersionedRecord, F> {
  id: R['id'];
  /** The record's fields as the edit started from them. */
  base: F;
  /** The version `base` is. */
  version: number | undefined;
  form: F;
}

/**
 * Save an edit's changed fields from the version it was made from. When
 * someone else saved first: if they changed none of the fields this edit
 * covers, save again from their version; otherwise ask the user (the edit
 * conflict) whether their changes go on top of the other person's — and are
 * saved again — or are dropped. `onRebase` gets the edit as it stands before
 * each new attempt. Resolves to what was saved, or the
 * record the user took instead of their changes; undefined if the save failed
 * otherwise (the mutation reports why).
 */
export async function saveResolvingConflicts<R extends VersionedRecord, F extends object>(
  edit: Edit<R, F>,
  {
    toForm,
    saveRecord,
    label,
    fieldLabels,
    onRebase,
  }: EditableRecordOptions<R, F> & { onRebase: (edit: Edit<R, F>) => void },
): Promise<{ saved?: R; discarded?: R } | undefined> {
  let { base, version, form } = edit;
  for (;;) {
    try {
      const saved = await saveRecord({
        ...changedFields(base, form),
        id: edit.id,
        ...(version === undefined ? {} : { version }),
      });
      return { saved };
    } catch (error) {
      const current = versionConflict<R>(error);
      if (!current) return undefined;
      const theirs = toForm(current);
      // It already holds just what this edit wanted.
      if (isEqual(theirs, form)) return { saved: current };
      if (!isEqual(theirs, base)) {
        const choice = await openEditConflict({ label, base, mine: form, theirs, fieldLabels });
        if (choice === 'discard') return { discarded: current };
      }
      form = threeWayMerge(base, form, theirs).merged;
      base = theirs;
      version = current.version;
      onRebase({ id: edit.id, base, version, form });
    }
  }
}

function isNewerVersion(version: number | undefined, than: number | undefined) {
  return version !== undefined && (than === undefined || version > than);
}
