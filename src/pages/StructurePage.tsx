import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import type { BookSection, SectionType } from "../types/book";
import { useBookStore } from "../stores/bookStore";
import { useT } from "../i18n";
import { epubText } from "../i18n/epub";
import type { UiKey } from "../i18n/ui";

const types: SectionType[] = ["cover", "illustration-opener", "image", "toc", "about", "chapter", "extra"];

function Row({ section }: { section: BookSection }) {
  const t = useT();
  const updateSection = useBookStore((state) => state.updateSection);
  const selectedSectionId = useBookStore((state) => state.selectedSectionId);
  const setSelectedSection = useBookStore((state) => state.setSelectedSection);
  const sortable = useSortable({ id: section.id });
  return (
    <div
      ref={sortable.setNodeRef}
      style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }}
      onClick={() => setSelectedSection(section.id)}
      className={`grid cursor-pointer grid-cols-[32px_1fr_170px_80px_90px] items-center gap-3 border-b border-stone-100 px-3 py-3 text-sm last:border-0 ${
        selectedSectionId === section.id ? "bg-teal-50" : "bg-white"
      }`}
    >
      <button className="text-stone-400" {...sortable.attributes} {...sortable.listeners}>
        <GripVertical size={18} />
      </button>
      <input className="field" value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} />
      <select className="field" value={section.type} onChange={(event) => updateSection(section.id, { type: event.target.value as SectionType })}>
        {types.map((type) => <option key={type} value={type}>{t(`type.${type}` as UiKey)}</option>)}
      </select>
      <input type="checkbox" checked={section.includeInToc} onChange={(event) => updateSection(section.id, { includeInToc: event.target.checked })} />
      <input type="checkbox" checked={section.includeInSpine} onChange={(event) => updateSection(section.id, { includeInSpine: event.target.checked })} />
    </div>
  );
}

export default function StructurePage() {
  const t = useT();
  const language = useBookStore((state) => state.metadata?.language);
  const sections = useBookStore((state) => state.sections);
  const setSections = useBookStore((state) => state.setSections);
  const selected = sections.find((section) => section.id === useBookStore.getState().selectedSectionId) ?? sections[0];
  const updateSection = useBookStore((state) => state.updateSection);
  const sensors = useSensors(useSensor(PointerSensor));

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sections.findIndex((section) => section.id === active.id);
    const newIndex = sections.findIndex((section) => section.id === over.id);
    setSections(arrayMove(sections, oldIndex, newIndex));
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-5">
      <section className="panel overflow-hidden">
        <div className="grid grid-cols-[32px_1fr_170px_80px_90px] gap-3 border-b border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold uppercase text-stone-500">
          <span />
          <span>{t("structure.section")}</span>
          <span>{t("structure.type")}</span>
          <span>{t("structure.toc")}</span>
          <span>{t("structure.spine")}</span>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={sections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
            {sections.map((section) => <Row key={section.id} section={section} />)}
          </SortableContext>
        </DndContext>
      </section>
      <aside className="panel p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">{t("structure.detail")}</h2>
          <button
            className="button-secondary px-3"
            onClick={() => {
              const order = sections.length;
              setSections([
                ...sections,
                {
                  id: `opener-${Date.now()}`,
                  type: "illustration-opener",
                  title: epubText(language).opener,
                  href: `xhtml/opener-${Date.now()}.xhtml`,
                  sourceBlocks: [],
                  includeInToc: true,
                  includeInSpine: true,
                  linear: true,
                  order
                }
              ]);
            }}
          >
            <Plus size={15} /> {t("structure.addOpener")}
          </button>
        </div>
        {selected && (
          <div className="mt-4 space-y-4 text-sm">
            <label>{t("structure.title")}<input className="field mt-1" value={selected.title} onChange={(event) => updateSection(selected.id, { title: event.target.value })} /></label>
            <label>{t("structure.filename")}<input className="field mt-1" value={selected.href} onChange={(event) => updateSection(selected.id, { href: event.target.value })} /></label>
            <label>{t("structure.sectionType")}<select className="field mt-1" value={selected.type} onChange={(event) => updateSection(selected.id, { type: event.target.value as SectionType })}>{types.map((type) => <option key={type} value={type}>{t(`type.${type}` as UiKey)}</option>)}</select></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={selected.includeInToc} onChange={(event) => updateSection(selected.id, { includeInToc: event.target.checked })} /> {t("structure.includeToc")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={selected.includeInSpine} onChange={(event) => updateSection(selected.id, { includeInSpine: event.target.checked })} /> {t("structure.includeSpine")}</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={selected.linear} disabled={selected.type === "toc"} onChange={(event) => updateSection(selected.id, { linear: event.target.checked })} /> {t("structure.linear")}</label>
            <div>
              <div className="mb-1 font-semibold">{t("structure.preview")}</div>
              <pre className="max-h-48 overflow-auto rounded bg-stone-100 p-3 text-xs">{selected.sourceBlocks.map((block) => "text" in block ? block.text : block.filename).join("\n") || selected.title}</pre>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
