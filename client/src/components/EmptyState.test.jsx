import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.jsx';

describe('EmptyState', () => {
  it('shows its message with a decorative icon', () => {
    const { container } = render(<EmptyState icon="pie">Nothing here yet.</EmptyState>);
    expect(screen.getByText('Nothing here yet.')).toBeInTheDocument();
    expect(container.querySelector('.empty-icon svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('falls back to a default icon', () => {
    const { container } = render(<EmptyState>Empty</EmptyState>);
    expect(container.querySelector('.empty-icon svg')).not.toBeNull();
  });
});
