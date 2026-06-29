import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Template } from './Template';

describe('Template', () => {
  it('renders a markdown template to HTML', () => {
    const { container } = render(<Template markdown="**hi**" />);
    expect(container.querySelector('strong')?.textContent).toBe('hi');
  });

  it('shows an error block instead of crashing on a render failure', () => {
    // {{count}} on a non-array throws inside Handlebars; the component catches it.
    const { container } = render(<Template markdown="{{count 5}}" />);
    expect(container.textContent).toContain('error with template render');
    expect(container.querySelector('pre')).not.toBeNull();
  });

  it('renders nothing meaningful for an empty template', () => {
    const { container } = render(<Template markdown={undefined} />);
    expect(container.querySelector('.md-template')).not.toBeNull();
  });
});
