import { AdminCard, AdminPageHeader } from '../components/ui/AdminUi.jsx';

export function SettingsPage() {
  return (
    <section className="mx-auto max-w-6xl space-y-6">
      <AdminPageHeader
        eyebrow="Platform"
        title="Settings"
        description="Global admin settings: security, API keys, content moderation, and publishing defaults."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Security</p>
          <h3 className="mt-2 text-base font-semibold text-white">Admin credentials</h3>
          <p className="mt-2 text-sm leading-6 text-[#9ca3af]">
            Rotate admin credentials, session timeout, and audit events.
          </p>
        </AdminCard>
        <AdminCard>
          <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-300">Content</p>
          <h3 className="mt-2 text-base font-semibold text-white">Publishing controls</h3>
          <p className="mt-2 text-sm leading-6 text-[#9ca3af]">
            Review workflow, publishing defaults, and moderation toggles.
          </p>
        </AdminCard>
      </div>
    </section>
  );
}
