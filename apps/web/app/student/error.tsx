'use client';

export default function StudentError({ error }: { error: Error }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-600">
      <h1 className="text-lg font-semibold text-red-600">학생 화면을 불러오지 못했습니다.</h1>
      <p className="text-sm">{error.message}</p>
    </main>
  );
}
