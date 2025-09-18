import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <section className="rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-slate-900">Tutor Loop Hub</h1>
        <p className="mt-2 text-slate-600">
          Connect students, parents, and tutors with transparent loops for assignments, schedules, and visibility. Use the role
          dashboards below for “one screen, one decision” control.
        </p>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href="/student"
          className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow transition hover:border-primary hover:shadow-lg"
        >
          <h2 className="text-lg font-semibold">학생 홈</h2>
          <p className="mt-1 text-sm text-slate-500">오늘 할 일과 제출 버튼</p>
        </Link>
        <Link
          href="/tutor"
          className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow transition hover:border-primary hover:shadow-lg"
        >
          <h2 className="text-lg font-semibold">튜터 홈</h2>
          <p className="mt-1 text-sm text-slate-500">피드백 SLA와 세션 보드</p>
        </Link>
        <Link
          href="/parent"
          className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow transition hover:border-primary hover:shadow-lg"
        >
          <h2 className="text-lg font-semibold">부모 홈</h2>
          <p className="mt-1 text-sm text-slate-500">하루 1분 요약과 서명 요청</p>
        </Link>
      </section>
      <p className="text-xs text-slate-400">
        연결된 API 토큰이 없으면 데모 데이터가 표시됩니다. 환경 변수 NEXT_PUBLIC_* 토큰을 설정하여 실데이터를 로드하세요.
      </p>
    </main>
  );
}
