// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { HossiiAboutSection } from './HossiiAboutSection';

describe('HossiiAboutSection', () => {
  afterEach(cleanup);

  it('renders nothing when no links are visible', () => {
    const { container } = render(<HossiiAboutSection links={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders external links with security attributes', () => {
    render(
      <HossiiAboutSection
        links={[
          {
            id: 'feedback',
            label: '質問・不具合を送る',
            url: 'https://example.com/feedback',
            ariaLabel: '質問・不具合を送る（外部サイトで開く）',
          },
        ]}
      />,
    );

    const link = screen.getByRole('link', { name: '質問・不具合を送る（外部サイトで開く）' });
    expect(link.getAttribute('href')).toBe('https://example.com/feedback');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByRole('heading', { name: 'Hossiiについて' })).toBeTruthy();
  });
});
