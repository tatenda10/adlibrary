export function UsersPage() {
  return (
    <section className="space-y-4">
      <h3 className="text-xl font-semibold text-white">Users</h3>
      <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
        <p className="text-sm text-[#9ca3af]">
          User management view is scaffolded. Next step is wiring this page to backend user endpoints
          (list users, roles, status, and subscription insights).
        </p>
      </div>
      <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-4">
        <h4 className="text-sm font-semibold text-white">Planned actions</h4>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#9ca3af]">
          <li>Search and filter users</li>
          <li>View account and subscription status</li>
          <li>Enable/disable access and role changes</li>
        </ul>
      </div>
    </section>
  );
}
