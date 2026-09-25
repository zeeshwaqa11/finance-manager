import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal.jsx';

function setup() {
  const onClose = vi.fn();
  const { container } = render(
    <Modal title="Edit thing" onClose={onClose}>
      <input aria-label="field" />
    </Modal>,
  );
  const dialog = container.querySelector('dialog');
  dialog.getBoundingClientRect = () => ({ left: 100, right: 300, top: 100, bottom: 300 });
  return { onClose, dialog };
}

describe('Modal', () => {
  it('opens as a modal dialog with its title and content', () => {
    const { dialog } = setup();
    expect(dialog).toHaveAttribute('open');
    expect(screen.getByRole('heading', { name: 'Edit thing' })).toBeInTheDocument();
    expect(screen.getByLabelText('field')).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the dialog is cancelled with Escape', () => {
    const { onClose, dialog } = setup();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is pressed and released', () => {
    const { onClose, dialog } = setup();
    fireEvent.mouseDown(dialog, { clientX: 20, clientY: 20 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the dialog, including its padding', () => {
    const { onClose, dialog } = setup();
    fireEvent.mouseDown(dialog, { clientX: 110, clientY: 110 });
    fireEvent.click(dialog, { clientX: 110, clientY: 110 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close when a drag starts inside and is released over the backdrop', () => {
    const { onClose, dialog } = setup();
    fireEvent.mouseDown(dialog, { clientX: 200, clientY: 200 });
    fireEvent.click(dialog, { clientX: 20, clientY: 20 });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not close on a click that had no mouse press (keyboard activation)', () => {
    const { onClose, dialog } = setup();
    fireEvent.click(dialog, { clientX: 0, clientY: 0 });
    expect(onClose).not.toHaveBeenCalled();
  });
});
