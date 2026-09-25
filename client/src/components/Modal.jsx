import { useEffect, useRef } from 'react';

export default function Modal({ title, onClose, children }) {
  const ref = useRef(null);
  const pressedOutside = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
  }, []);

  const isOutside = (e) => {
    if (e.target !== ref.current) return false;
    const rect = ref.current.getBoundingClientRect();
    return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
  };

  return (
    <dialog
      ref={ref}
      className="modal"
      onCancel={onClose}
      onMouseDown={(e) => {
        pressedOutside.current = isOutside(e);
      }}
      onClick={(e) => {
        if (pressedOutside.current && isOutside(e)) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button type="button" className="btn-ghost" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      {children}
    </dialog>
  );
}
