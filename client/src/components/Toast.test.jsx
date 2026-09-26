import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TOAST_DURATION, ToastProvider, useToast } from './Toast.jsx';

function Trigger({ message = 'Saved', tone }) {
  const { notify } = useToast();
  return (
    <button type="button" onClick={() => notify(message, tone)}>
      go {message}
    </button>
  );
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Toast', () => {
  it('does nothing outside a provider', async () => {
    render(<Trigger />);
    await userEvent.click(screen.getByRole('button'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows a message as a status notification', async () => {
    render(
      <ToastProvider>
        <Trigger message="Account added" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /go/ }));
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Account added');
    expect(toast).toHaveClass('toast-success');
  });

  it('styles error notifications differently', async () => {
    render(
      <ToastProvider>
        <Trigger message="Failed" tone="error" />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /go/ }));
    expect(screen.getByRole('status')).toHaveClass('toast-error');
  });

  it('dismisses itself after the duration', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button').click());
    expect(screen.getByRole('status')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(TOAST_DURATION - 100));
    expect(screen.getByRole('status')).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('honours a custom duration', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider duration={500}>
        <Trigger />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button').click());
    act(() => vi.advanceTimersByTime(501));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('can be dismissed with its close button', async () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: /go/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps at most three notifications, dropping the oldest', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger message="one" />
        <Trigger message="two" />
        <Trigger message="three" />
        <Trigger message="four" />
      </ToastProvider>,
    );
    for (const name of ['one', 'two', 'three', 'four']) {
      act(() => screen.getByRole('button', { name: `go ${name}` }).click());
    }
    const shown = screen.getAllByRole('status').map((el) => el.textContent);
    expect(shown).toHaveLength(3);
    expect(shown.join(' ')).not.toContain('one');
    expect(shown.join(' ')).toContain('four');
  });

  it('stops its timers when unmounted', () => {
    vi.useFakeTimers();
    const { unmount } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    act(() => screen.getByRole('button').click());
    unmount();
    expect(() => vi.advanceTimersByTime(TOAST_DURATION * 2)).not.toThrow();
  });

  it('announces politely to screen readers', () => {
    const { container } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    expect(container.querySelector('.toast-region')).toHaveAttribute('aria-live', 'polite');
  });
});
