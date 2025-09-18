import { DecisionCard } from '@/components/DecisionCard';
import { StatPanel } from '@/components/StatPanel';
import { getTutorDashboard } from '@/lib/api';

export default async function TutorHome() {
  const data = await getTutorDashboard();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-8">
      <header className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">피드백 대기함</h1>
        <p className="mt-1 text-sm text-slate-600">SLA 타이머를 지키기 위해 가장 오래 기다린 제출부터 처리하세요.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <StatPanel label="대기 중" value={`${data.reviewQueue.length}건`} />
        <StatPanel label="오늘 세션" value={`${data.todaysSessions.length}건`} />
      </section>

      <section className="space-y-3">
        {data.reviewQueue.length > 0 ? (
          data.reviewQueue.map((item) => (
            <DecisionCard
              key={item.id}
              title={item.title}
              description={`${item.studentName} · 상태 ${item.status}`}
              actionLabel="1-click 피드백"
              href={`/assignments/${item.id}`}
            />
          ))
        ) : (
          <p className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600" role="status">
            검토 대기 중인 제출이 없습니다.
          </p>
        )}
      </section>

      <DecisionCard
        title="새 과제 생성"
        description="목표와 모범 답안을 지정하고 즉시 공유하세요."
        actionLabel="과제 작성"
        href="/assignments/new"
        variant="secondary"
      />

      {data.message ? <p className="text-sm text-amber-600">{data.message}</p> : null}
    </main>
  );
}
