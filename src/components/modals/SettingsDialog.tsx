import { Check, CircleAlert } from 'lucide-react';
import type { ProviderInfo, Settings, SystemInfo } from '../../lib/types';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
  providers: ProviderInfo[];
  info: SystemInfo | null;
}

export function SettingsDialog({
  open,
  onClose,
  settings,
  update,
  reset,
  providers,
  info,
}: SettingsDialogProps) {
  return (
    <Dialog
      open={open}
      title="Settings"
      description="Changes apply immediately and are stored in this browser."
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={reset}>
            Reset to defaults
          </Button>
          <Button variant="primary" onClick={onClose}>
            Done
          </Button>
        </>
      }
    >
      <div className="space-y-7">
        <section>
          <SectionTitle title="Appearance" />
          <div className="space-y-3">
            <Row label="Theme" hint="Editor and interface colour scheme">
              <div className="flex gap-1.5">
                {(['dark', 'light'] as const).map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => update('theme', theme)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] capitalize transition-colors',
                      settings.theme === theme
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-line text-muted hover:border-faint hover:text-ink',
                    )}
                  >
                    {settings.theme === theme && <Check size={12} className="text-accent" />}
                    {theme}
                  </button>
                ))}
              </div>
            </Row>

            <Row label="Editor font size" hint={`${settings.fontSize}px`}>
              <NumberStepper
                value={settings.fontSize}
                min={10}
                max={22}
                onChange={(value) => update('fontSize', value)}
              />
            </Row>

            <Row label="Terminal font size" hint={`${settings.terminalFontSize}px`}>
              <NumberStepper
                value={settings.terminalFontSize}
                min={10}
                max={20}
                onChange={(value) => update('terminalFontSize', value)}
              />
            </Row>

            <Row label="Tab size" hint="Indentation width in spaces">
              <div className="flex gap-1.5">
                {[2, 4].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => update('tabSize', size)}
                    className={cn(
                      'h-7 w-9 rounded-md border text-[12px] transition-colors',
                      settings.tabSize === size
                        ? 'border-accent bg-accent-soft text-ink'
                        : 'border-line text-muted hover:border-faint hover:text-ink',
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </Row>
          </div>
        </section>

        <section>
          <SectionTitle title="Editor" />
          <div className="space-y-2">
            <Toggle
              label="Word wrap"
              hint="Wrap long lines instead of scrolling horizontally"
              checked={settings.wordWrap}
              onChange={(value) => update('wordWrap', value)}
            />
            <Toggle
              label="Minimap"
              hint="Show the code overview on the right of the editor"
              checked={settings.minimap}
              onChange={(value) => update('minimap', value)}
            />
            <Toggle
              label="Auto-save"
              hint="Write changes to disk shortly after you stop typing"
              checked={settings.autoSave}
              onChange={(value) => update('autoSave', value)}
            />
          </div>
        </section>

        <section>
          <SectionTitle title="AI provider" />
          <div className="space-y-2">
            {providers.length === 0 ? (
              <p className="text-[12px] text-faint">Loading providers…</p>
            ) : (
              providers.map((provider) => (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => update('provider', provider.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-lg border p-2.5 text-left transition-colors',
                    settings.provider === provider.id
                      ? 'border-accent bg-accent-soft'
                      : 'border-line hover:border-faint hover:bg-elevated',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                      settings.provider === provider.id
                        ? 'border-accent bg-accent text-white'
                        : 'border-line',
                    )}
                  >
                    {settings.provider === provider.id && <Check size={10} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[12.5px] font-medium text-ink">{provider.label}</span>
                      <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">
                        {provider.model}
                      </span>
                      {provider.configured ? (
                        <span className="rounded bg-success/15 px-1.5 py-0.5 text-[10px] text-success">
                          ready
                        </span>
                      ) : (
                        <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                          missing key
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted">
                      {provider.description}
                    </span>
                    {!provider.configured && (
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-warning">
                        <CircleAlert size={11} />
                        Add <code className="font-mono">{provider.envKey}</code> to .env, then restart
                      </span>
                    )}
                  </span>
                </button>
              ))
            )}

            {providers.length > 0 && (
              <div className="space-y-1 rounded-md border border-line p-2.5">
                <label className="block text-[12px] text-ink" htmlFor="settings-model">
                  Model override
                </label>
                <input
                  id="settings-model"
                  value={settings.models[settings.provider] ?? ''}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    const next = { ...settings.models };
                    if (value) next[settings.provider] = value;
                    else delete next[settings.provider];
                    update('models', next);
                  }}
                  placeholder={
                    providers.find((provider) => provider.id === settings.provider)?.model ?? ''
                  }
                  spellCheck={false}
                  className="h-8 w-full rounded-md border border-line bg-app px-2 font-mono text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
                />
                <p className="text-[11px] leading-relaxed text-faint">
                  Leave empty to use the provider default. The assistant can also discover the
                  models your key can reach.
                </p>
              </div>
            )}
          </div>
        </section>

        <section>
          <SectionTitle title="Git identity" />
          <div className="space-y-2.5">
            <label className="block space-y-1">
              <span className="text-[12px] text-ink">Author name</span>
              <input
                value={settings.gitName}
                onChange={(event) => update('gitName', event.target.value)}
                placeholder="Safari Developer"
                spellCheck={false}
                className="h-8 w-full rounded-md border border-line bg-app px-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[12px] text-ink">Author email</span>
              <input
                value={settings.gitEmail}
                onChange={(event) => update('gitEmail', event.target.value)}
                placeholder="developer@example.com"
                spellCheck={false}
                className="h-8 w-full rounded-md border border-line bg-app px-2 text-[12px] text-ink outline-none placeholder:text-faint focus:border-accent"
              />
            </label>
            <p className="text-[11px] leading-relaxed text-faint">
              Sent with each commit so history is attributed correctly. Empty values fall back to
              the repository configuration.
            </p>
          </div>
        </section>

        <section>
          <SectionTitle title="About" />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
            <Detail label="Version" value={info?.version ?? '—'} />
            <Detail label="Workspace" value={info?.workspace ?? '—'} />
            <Detail label="Git repository" value={info?.gitRepository ? 'yes' : 'no'} />
            <Detail label="Access token" value={info?.authEnabled ? 'required' : 'not required'} />
          </dl>
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            Terminal commands run inside the workspace directory. API keys stay on the server —
            they are never sent to the browser.
          </p>
        </section>
      </div>
    </Dialog>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-faint">
      {title}
    </h3>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <div className="min-w-0">
        <div className="text-[12.5px] text-ink">{label}</div>
        <div className="text-[11.5px] text-faint">{hint}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-md px-1 py-1.5 text-left transition-colors hover:bg-elevated/60"
      role="switch"
      aria-checked={checked}
    >
      <span>
        <span className="block text-[12.5px] text-ink">{label}</span>
        <span className="block text-[11.5px] text-faint">{hint}</span>
      </span>
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-line bg-elevated',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-[18px]' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant="secondary"
        className="h-7 w-7 !px-0"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </Button>
      <span className="w-8 text-center text-[12px] tabular-nums text-ink">{value}</span>
      <Button
        size="sm"
        variant="secondary"
        className="h-7 w-7 !px-0"
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </Button>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-faint">{label}</dt>
      <dd className="truncate text-ink">{value}</dd>
    </>
  );
}
