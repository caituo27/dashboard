interface Tab<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  tabs: Tab<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Pill-style segmented control on a soft grey track. */
export function ModeTabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  return (
    <div className="inline-flex gap-0.5 rounded-full bg-[#f2f2f0] p-[3px]">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={
              "rounded-full px-4 py-[7px] text-[13px] transition-all duration-150 " +
              (active
                ? "bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-ink-soft hover:text-ink")
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
