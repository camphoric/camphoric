export const sortStringCompare = (a: any, b: any) => {
  return a.toString().localeCompare(
    b.toString(),
    undefined,
    { sensitivity: 'accent' },
  );
}

export const sortComparison = (a: any, b: any) => {
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }

  // if both are not numbers, do string coercion and compare
  return sortStringCompare(a, b);
};
