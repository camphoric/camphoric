import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Template } from '../Template';

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

  it('shows a render error as text, so markup the error quotes never runs', () => {
    // A parse error quotes the template around it, this <img> included.
    const { container } = render(<Template markdown="<img src onerror={{}}alert(1)>" />);
    expect(container.textContent).toContain('error with template render');
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders nothing meaningful for an empty template', () => {
    const { container } = render(<Template markdown={undefined} />);
    expect(container.querySelector('.md-template')).not.toBeNull();
  });
});
