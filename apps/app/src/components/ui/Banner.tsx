export function Banner({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-md mb-4 flex items-center">
      {children}
    </div>
  );
}

Banner.displayName = "Banner";
