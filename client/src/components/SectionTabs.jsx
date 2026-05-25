import { NavLink } from 'react-router-dom';

function SectionTabs({ items }) {
  return (
    <div className="flex h-full items-end gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `relative inline-flex items-center gap-2 px-3 pb-3 text-sm font-medium transition-colors ${
                isActive
                  ? 'text-[var(--app-text)]'
                  : 'text-[var(--app-subtext)] hover:text-[var(--app-text)]'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span className="whitespace-nowrap">{item.label}</span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-3 right-3 h-px transition-opacity"
                  style={{ background: 'var(--app-text)', opacity: isActive ? 1 : 0 }}
                />
              </>
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

export default SectionTabs;
