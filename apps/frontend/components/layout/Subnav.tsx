"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Subnav({ base, items }: { base:string; items:{slug:string; label:string}[] }) {
  const path = usePathname();
  return (
    <div className="flex gap-2 mb-4">
      {items.map(i=>{
        const href = `${base}/${i.slug}`;
        const active = path === href;
        return (
          <Link key={i.slug} href={href as any}
            className={`px-3 py-1.5 rounded-full text-sm border ${active ? "bg-indigo-600 text-white border-indigo-600" : "bg-white hover:bg-slate-50"}`}>
            {i.label}
          </Link>
        );
      })}
    </div>
  );
}
