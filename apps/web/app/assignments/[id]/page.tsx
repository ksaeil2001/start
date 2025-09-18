import Link from 'next/link';
import { getAssignmentDetail } from '@/lib/api';
import { DecisionCard } from '@/components/DecisionCard';

export default async function AssignmentDetail({ params }: { params: { id: string } }) {
  const data = await getAssignmentDetail(params.id);

  if (data.assignment === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-600">
        <p>해당 과제를 찾을 수 없습니다.</p>
        <Link href="/student" className="mt-4 text-primary underline">
          학생 홈으로 돌아가기
        </Link>
      </main>
    );
  }

  const submissions = (data.assignment?.submissions as Array<Record<string, unknown>>) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">{data.assignment?.title}</h1>
        <p className="mt-2 text-sm text-slate-600">목표: {data.assignment?.goal}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">상태: {data.assignment?.status}</p>
      </header>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">제출 기록</h2>
        {submissions.length > 0 ? (
          <ol className="mt-3 space-y-3 text-sm text-slate-600">
            {submissions.map((submission) => (
              <li key={submission.id as string} className="rounded-md border border-slate-200 p-3">
                <p className="font-semibold">버전 {submission.version as number}</p>
                <p className="text-xs text-slate-500">상태: {submission.status as string}</p>
                {submission.comment ? <p className="mt-1">코멘트: {submission.comment as string}</p> : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-slate-500">아직 제출한 파일이 없습니다.</p>
        )}
      </section>

      <DecisionCard
        title="파일 재제출"
        description="보완 요청이 있다면 한 번의 클릭으로 다시 업로드하세요."
        actionLabel="재제출 준비"
        href="/student"
        variant="secondary"
      />

      {data.message ? <p className="text-xs text-amber-600">{data.message}</p> : null}
    </main>
  );
}
