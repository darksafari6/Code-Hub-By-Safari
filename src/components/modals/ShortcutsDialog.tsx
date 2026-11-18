import { Dialog } from '../ui/Dialog';
import { isMac } from '../../lib/utils';

interface ShortcutsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  items: Array<[string, string]>;
}

function groups(): ShortcutGroup[] {
  const mod = isMac() ? '⌘' : 'Ctrl';
  const shift = isMac() ? '⇧' : 'Shift';
  const alt = isMac() ? '⌥' : 'Alt';

  return [
    {
      title: 'Files',
      items: [
        [`${mod} + S`, 'Save active file'],
        [`${mod} + ${shift} + S`, 'Save all open files'],
        [`${mod} + P`, 'Quick open file'],
        [`${mod} + N`, 'New file (desktop menu)'],
        [`${mod} + ${shift} + N`, 'New folder (desktop menu)'],
        [`${mod} + W`, 'Close active editor (desktop menu)'],
      ],
    },
    {
      title: 'Navigation',
      items: [
        [`${mod} + ${shift} + P`, 'Command palette'],
        [`${mod} + K`, 'Command palette'],
        [`${mod} + ${shift} + E`, 'Explorer'],
        [`${mod} + ${shift} + F`, 'Search in workspace'],
        [`${mod} + ${shift} + G`, 'Source control'],
        [`${mod} + ${shift} + V`, 'Toggle preview'],
      ],
    },
    {
      title: 'Panels',
      items: [
        [`${mod} + B`, 'Toggle sidebar'],
        [`${mod} + J`, 'Toggle bottom panel'],
        [`${mod} + \``, 'Toggle terminal'],
        [`${mod} + ${alt} + A`, 'Toggle AI assistant'],
        [`${mod} + ,`, 'Settings'],
      ],
    },
    {
      title: 'Editor',
      items: [
        [`${mod} + F`, 'Find'],
        [`${mod} + H`, 'Replace'],
        [`${mod} + /`, 'Toggle line comment'],
        [`${shift} + ${alt} + F`, 'Format document'],
        [`${mod} + ${shift} + \\`, 'Go to bracket'],
        [`F12`, 'Go to definition'],
        [`${mod} + ${shift} + O`, 'Go to symbol'],
        [`${mod} + G`, 'Go to line'],
      ],
    },
  ];
}

export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Keyboard shortcuts"
      description="Every shortcut below is bound in the application."
      size="lg"
    >
      <div className="grid max-h-[60vh] grid-cols-1 gap-6 overflow-y-auto p-1 sm:grid-cols-2">
        {groups().map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--text-dim)]">
              {group.title}
            </h3>
            <ul className="space-y-1">
              {group.items.map(([keys, label]) => (
                <li key={keys} className="flex items-center justify-between gap-4 text-[12px]">
                  <span className="text-[color:var(--text-muted)]">{label}</span>
                  <kbd className="shrink-0 rounded border border-[color:var(--border)] bg-[color:var(--bg)] px-1.5 py-0.5 font-mono text-[11px] text-[color:var(--text)]">
                    {keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialog>
  );
}
