import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('the OAuth terms page’s script', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
  });

  function section(markdown: string): HTMLElement {
    const element = document.createElement('div');
    element.setAttribute('data-terms-markdown', '');
    element.textContent = markdown;
    document.body.append(element);
    return element;
  }

  it('renders each section’s Markdown in place, as the admin does', async () => {
    const waiver = section('**Bold** waiver\n\n<div>You waive all claims.</div>');
    const policy = section('| a | b |\n|---|---|\n| 1 | 2 |');
    await import('../termsMarkdown');
    expect(waiver.querySelector('strong')).toHaveTextContent('Bold');
    // Raw HTML is sanitized, not dropped: its text is still there to agree to.
    expect(waiver).toHaveTextContent('You waive all claims.');
    expect(policy.querySelector('.md-table-scroll table')).not.toBeNull();
    expect(waiver).not.toHaveAttribute('data-terms-markdown');
  });

  it('opens every link in a new tab, this site’s too', async () => {
    const element = section(
      '[policy](/organizations/1/privacy-policy) [site](https://example.com)',
    );
    await import('../termsMarkdown');
    const links = [...element.querySelectorAll('a')];
    expect(links).toHaveLength(2);
    for (const link of links) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('never lets a script or handler through', async () => {
    const element = section(
      '<script>window.pwned = 1</script><img src=x onerror="window.pwned = 1">\n\n' +
        '[a link](javascript:alert(1))',
    );
    await import('../termsMarkdown');
    expect(element.querySelector('script')).toBeNull();
    expect(element.innerHTML).not.toContain('onerror');
    expect(element.querySelector('a')).not.toHaveAttribute('href');
    expect(element).toHaveTextContent('a link');
  });
});
