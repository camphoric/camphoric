import { changedFields, changedPaths, isEqual, threeWayMerge } from 'utils/merge';

describe('isEqual', () => {
  it('compares JSON deeply, ignoring key order', () => {
    expect(isEqual({ a: [1, { b: 2 }], c: null }, { c: null, a: [1, { b: 2 }] })).toBe(true);
    expect(isEqual({ a: [1, 2] }, { a: [2, 1] })).toBe(false);
    expect(isEqual({ a: 1 }, { a: 1, b: undefined })).toBe(true);
    expect(isEqual(null, {})).toBe(false);
  });
});

describe('changedFields', () => {
  it('keeps only the top-level fields that changed', () => {
    const before = { email: 'a@x.org', attributes: { name: 'Pat', age: 9 }, type: 1 };
    const after = { email: 'a@x.org', attributes: { name: 'Pattie', age: 9 }, type: 1 };
    expect(changedFields(before, after)).toEqual({ attributes: { name: 'Pattie', age: 9 } });
  });
});

describe('changedPaths', () => {
  it('goes down into objects but takes arrays whole', () => {
    const before = { attributes: { name: 'Pat', days: [1, 2] }, email: 'a' };
    const after = { attributes: { name: 'Pat', days: [1, 2, 3] }, email: 'b' };
    expect(changedPaths(before, after)).toEqual(['attributes.days', 'email']);
  });
});

describe('threeWayMerge', () => {
  const base = { email: 'pat@x.org', attributes: { name: 'Pat', diet: 'none', age: 9 } };

  it('keeps both sides when they changed different things', () => {
    const mine = { ...base, attributes: { ...base.attributes, diet: 'vegan' } };
    const theirs = { ...base, email: 'pat@y.org', attributes: { ...base.attributes, age: 10 } };
    expect(threeWayMerge(base, mine, theirs)).toEqual({
      merged: { email: 'pat@y.org', attributes: { name: 'Pat', diet: 'vegan', age: 10 } },
      conflicts: [],
    });
  });

  it('lets mine win where both changed the same thing, and says where', () => {
    const mine = { ...base, attributes: { ...base.attributes, name: 'Pattie' } };
    const theirs = { ...base, attributes: { ...base.attributes, name: 'Patricia' } };
    const { merged, conflicts } = threeWayMerge(base, mine, theirs);
    expect(merged.attributes.name).toBe('Pattie');
    expect(conflicts).toEqual(['attributes.name']);
  });

  it('is no conflict when both made the same change', () => {
    const same = { ...base, email: 'new@x.org' };
    expect(threeWayMerge(base, same, same).conflicts).toEqual([]);
  });

  it('drops a key they removed when I left it alone', () => {
    const theirs = { ...base, attributes: { name: 'Pat', age: 9 } };
    const mine = { ...base, email: 'me@x.org' };
    expect(threeWayMerge(base, mine, theirs).merged).toEqual({
      email: 'me@x.org',
      attributes: { name: 'Pat', age: 9 },
    });
  });
});
