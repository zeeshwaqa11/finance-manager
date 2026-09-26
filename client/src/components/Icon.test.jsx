import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Icon, { ICON_NAMES, Logo, accountIcon } from './Icon.jsx';

describe('Icon', () => {
  it('renders a decorative svg at the requested size', () => {
    const { container } = render(<Icon name="plus" size={30} className="extra" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '30');
    expect(svg).toHaveAttribute('height', '30');
    expect(svg).toHaveClass('icon', 'extra');
  });

  it('defaults to 20px', () => {
    const { container } = render(<Icon name="check" />);
    expect(container.querySelector('svg')).toHaveAttribute('width', '20');
  });

  it('draws something for every named icon', () => {
    expect(ICON_NAMES.length).toBeGreaterThan(20);
    for (const name of ICON_NAMES) {
      const { container, unmount } = render(<Icon name={name} />);
      expect(container.querySelector('svg').children.length, name).toBeGreaterThan(0);
      unmount();
    }
  });

  it('includes every icon the app uses', () => {
    for (const name of [
      'dashboard', 'wallet', 'swap', 'pie', 'sun', 'moon', 'plus', 'edit', 'trash', 'arrow-down-left',
      'arrow-up-right', 'bank', 'card', 'cash', 'check', 'alert', 'x', 'chevron-left', 'chevron-right',
      'chevron-up', 'chevron-down', 'receipt', 'target', 'copy',
    ]) {
      expect(ICON_NAMES, name).toContain(name);
    }
  });

  it('does not crash for an unknown name', () => {
    const { container } = render(<Icon name="nope" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('accountIcon', () => {
  it.each([
    ['Cash', 'cash'],
    ['cash in hand', 'cash'],
    ['Credit Card', 'card'],
    ['Debit card', 'card'],
    ['Bank', 'bank'],
    ['Savings', 'bank'],
    ['Current account', 'bank'],
    ['Brokerage', 'wallet'],
    ['', 'wallet'],
  ])('maps %s to %s', (type, icon) => {
    expect(accountIcon(type)).toBe(icon);
  });

  it('handles a missing type', () => {
    expect(accountIcon()).toBe('wallet');
  });
});

describe('Logo', () => {
  it('renders a decorative svg', () => {
    const { container } = render(<Logo size={40} />);
    const svg = container.querySelector('svg.logo');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '40');
  });
});
