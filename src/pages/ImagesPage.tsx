import { Image, Star } from "lucide-react";
import { useBookStore } from "../stores/bookStore";

export default function ImagesPage() {
  const sections = useBookStore((state) => state.sections);
  const updateImage = useBookStore((state) => state.updateImage);
  const setCover = useBookStore((state) => state.setCover);
  const images = sections.filter((section) => section.image);

  return (
    <section className="panel overflow-hidden">
      <div className="grid grid-cols-[64px_1fr_180px_1fr_120px] gap-4 border-b border-stone-200 bg-stone-50 px-4 py-3 text-xs font-bold uppercase text-stone-500">
        <span />
        <span>Output</span>
        <span>Type</span>
        <span>Alt text</span>
        <span>Cover</span>
      </div>
      {images.map((section) => (
        <div key={section.id} className="grid grid-cols-[64px_1fr_180px_1fr_120px] items-center gap-4 border-b border-stone-100 px-4 py-4 text-sm last:border-0">
          <div className="grid h-12 w-12 place-items-center rounded bg-stone-100 text-teal-700"><Image size={22} /></div>
          <div>
            <input className="field" value={section.image!.outputName} onChange={(event) => updateImage(section.id, { outputName: event.target.value })} />
            <div className="mt-1 text-xs text-stone-500">{section.href}</div>
          </div>
          <div>
            {section.type === "cover" ? "Cover" : "Illustration"} · contain ·{" "}
            {section.image!.outputName.toLowerCase().endsWith(".gif") ? "GIF (kept as-is)" : "WebP 90"}
          </div>
          <input className="field" value={section.image!.alt} onChange={(event) => updateImage(section.id, { alt: event.target.value })} />
          <button className={section.type === "cover" ? "button" : "button-secondary"} onClick={() => setCover(section.id)}>
            <Star size={15} /> {section.type === "cover" ? "Cover" : "Set"}
          </button>
        </div>
      ))}
    </section>
  );
}
