import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.jsx';

function setup(props = {}) {
  const handlers = { onConfirm: vi.fn().mockResolvedValue(undefined), onCancel: vi.fn() };
  render(<ConfirmDialog title="Delete thing" message="Really delete it?" {...handlers} {...props} />);
  return { ...handlers, ...props };
}

describe('ConfirmDialog', () => {
  it('shows the title and message', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Delete thing' })).toBeInTheDocument();
    expect(screen.getByText('Really delete it?')).toBeInTheDocument();
  });

  it('does not confirm until asked', () => {
    const { onConfirm } = setup();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirms with the default Delete label', async () => {
    const { onConfirm } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('supports a custom confirm label', () => {
    setup({ confirmLabel: 'Remove it' });
    expect(screen.getByRole('button', { name: 'Remove it' })).toBeInTheDocument();
  });

  it('cancels from the Cancel button and the close button', async () => {
    const { onCancel } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('disables the confirm button while the action is running', async () => {
    let finish;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    const { onConfirm } = setup({ onConfirm: vi.fn(() => pending) });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    finish();
  });

  it('shows the failure and lets the user try again', async () => {
    const onConfirm = vi.fn().mockRejectedValueOnce(new Error('Server said no')).mockResolvedValueOnce(undefined);
    setup({ onConfirm });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Server said no');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });
});
