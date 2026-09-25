import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Status from './Status.jsx';

describe('Status', () => {
  it('shows a loading message', () => {
    render(<Status loading error={null} />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders nothing when idle', () => {
    const { container } = render(<Status loading={false} error={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the error as an alert, in preference to loading', () => {
    render(<Status loading error={new Error('Server down')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Server down');
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('offers a retry button only when a handler is given', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<Status error={new Error('x')} onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<Status error={new Error('x')} />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });
});
