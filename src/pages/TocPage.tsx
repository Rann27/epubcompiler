import { useBookStore } from "../stores/bookStore";

export default function TocPage() {
  const sections = useBookStore((state) => state.sections);
  const updateSection = useBookStore((state) => state.updateSection);
  const tocItems = [...sections].sort((a, b) => a.order - b.order).filter((section) => section.includeInToc);

  return (
    <div className="grid grid-cols-[360px_minmax(0,1fr)] gap-5">
      <section className="panel p-5">
        <h2 className="font-bold">ToC Settings</h2>
        <div className="mt-4 space-y-3 text-sm">
          <label>ToC title text<input className="field mt-1" value="Table of Contents" readOnly /></label>
          {sections.map((section) => (
            <label key={section.id} className="flex items-center gap-2 rounded border border-stone-200 p-3">
              <input type="checkbox" checked={section.includeInToc} onChange={(event) => updateSection(section.id, { includeInToc: event.target.checked })} />
              <span className="min-w-0 flex-1 truncate">{section.title}</span>
              <span className="text-xs text-stone-500">{section.type}</span>
            </label>
          ))}
        </div>
        <div className="mt-5 rounded bg-stone-100 p-3 text-xs text-stone-600">
          Placement: after front illustrations. Title uppercase, divider, sans-serif font, and item lines are locked for MVP.
        </div>
      </section>
      <section className="panel bg-white p-8">
        <div className="mx-auto max-w-xl">
          <h1 className="border-b-2 border-stone-300 pb-4 text-center text-2xl font-bold uppercase tracking-[0.15em]">Table of Contents</h1>
          <ol className="mt-6 list-none p-0">
            {tocItems.map((item) => (
              <li key={item.id} className="border-b border-stone-200">
                <div className="block px-2 py-4 text-stone-900">{item.title}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </div>
  );
}
