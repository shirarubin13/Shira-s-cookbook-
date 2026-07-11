export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-bg px-5 pb-10 pt-4">
      {children}
    </main>
  );
}
