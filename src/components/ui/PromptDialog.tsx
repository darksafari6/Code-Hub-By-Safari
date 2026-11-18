import { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface PromptDialogProps {
  open: boolean;
  title: string;
  description?: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
}

export function PromptDialog({
  open,
  title,
  description,
  label,
  defaultValue = '',
  placeholder,
  confirmLabel = 'Create',
  onCancel,
  onConfirm,
}: PromptDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      const timer = window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 40);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [open, defaultValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={onCancel}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!value.trim()}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <label className="block space-y-1.5">
        <span className="text-[12px] font-medium text-muted">{label}</span>
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submit();
            }
          }}
          className="w-full rounded-md border border-line bg-app px-3 py-2 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
      </label>
    </Dialog>
  );
}
