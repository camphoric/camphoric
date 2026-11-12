import { describe, expect, it } from 'vitest';

import { reportFileName } from '../reportFileName';

describe('reportFileName', () => {
  it('puts the event name and category in front of the title', () => {
    expect(reportFileName('Lark Camp 2026', 'Staff', 'Crew, Office, Camp 1', 'csv')).toBe(
      'Lark Camp 2026, Staff, Crew, Office, Camp 1.csv',
    );
  });

  it('leaves out a blank category, with no empty segment', () => {
    expect(reportFileName('Lark Camp 2026', '', 'Crew, Office, Camp 1', 'csv')).toBe(
      'Lark Camp 2026, Crew, Office, Camp 1.csv',
    );
    expect(reportFileName('Lark Camp 2026', '   ', 'Roster', 'md')).toBe(
      'Lark Camp 2026, Roster.md',
    );
  });

  it('replaces characters that are not allowed in file names', () => {
    expect(reportFileName('Lark: 2026', 'Rooms/Cabins', 'Cabins 1/2', 'txt')).toBe(
      'Lark- 2026, Rooms-Cabins, Cabins 1-2.txt',
    );
    expect(reportFileName('A\\B', 'C*D?', '"E" <F> |G|', 'html')).toBe(
      'A-B, C-D-, -E- -F- -G-.html',
    );
    expect(reportFileName('Lark\tCamp\n2026', '', 'Roster', 'csv')).toBe(
      'Lark-Camp-2026, Roster.csv',
    );
    expect(reportFileName('Lark\u0085Camp', '', 'Roster\u007f', 'csv')).toBe(
      'Lark-Camp, Roster-.csv',
    );
  });

  it('leaves out the event name until it is known', () => {
    expect(reportFileName(undefined, 'Staff', 'Roster', 'csv')).toBe('Staff, Roster.csv');
  });

  it('still has a name when every part is blank', () => {
    expect(reportFileName('', '', '', 'csv')).toBe('report.csv');
  });
});
