export function SettingsPage() {
  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-white">Settings</h3>
      <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
        <p className="text-sm text-[#9ca3af]">
          Global admin settings can live here (security, API keys, content moderation rules, and workspace defaults).
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
          <h4 className="text-sm font-semibold text-white">Security</h4>
          <p className="mt-2 text-sm text-[#9ca3af]">Rotate admin credentials, session timeout, and audit events.</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
          <h4 className="text-sm font-semibold text-white">Content Controls</h4>
          <p className="mt-2 text-sm text-[#9ca3af]">Review workflow, publishing defaults, and moderation toggles.</p>
        </div>
      </div>
    </section>
  );
}
