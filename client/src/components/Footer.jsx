import Logo from './Logo';

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-slate-200/70">
      <div className="mx-auto max-w-6xl px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-slate-500">
          <Logo size={28} />
          <span className="font-display font-bold text-slate-700">SpeedNet Arena</span>
        </div>
        <p className="text-sm text-slate-500 text-center">
          Learn networking the playful way — devices, protocols, the OSI model &amp; more.
        </p>
        <p className="text-sm text-slate-400">© {year} SpeedNet Arena</p>
      </div>
    </footer>
  );
}
