import { DecisionCard } from '@/components/DecisionCard';
import { getParentDashboard } from '@/lib/api';

export default async function ParentHome() {
  const data = await getParentDashboard();
  const digest = data.digest;
  const dueSoon = Array.isArray(digest?.risks?.due_in_48h_without_submission)
    ? (digest?.risks?.due_in_48h_without_submission as Array<Record<string, unknown>>)[0]
    : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="rounded-lg bg-accent/10 p-6">
        <h1 className="text-2xl font-semibold text-accent">하루 1분 요약</h1>
        <p className="mt-1 text-sm text-accent/80">마감과 출결 리스크를 한눈에 보고 바로 조치하세요.</p>
      </header>

      <section className="space-y-4">
        <DecisionCard
          title={dueSoon ? `마감 임박: ${dueSoon.title ?? '과제'}` : '마감 임박 과제 없음'}
          description={dueSoon ? `제출 마감일: ${dueSoon.dueAt ?? '알수없음'}` : '현재 48시간 내 마감 예정 과제가 없습니다.'}
          actionLabel={dueSoon ? '학생 독려하기' : '좋아요'}
          href="/student"
        />
        <DecisionCard
          title="서명 요청"
          description="출결/결제 승인 대기 항목을 바로 처리합니다."
          actionLabel="1-click 서명"
          href="/invoices/pending"
        />
        <DecisionCard
          title="격려 보내기"
          description="맞춤 메시지로 학생 동기 부여."
          actionLabel="격려 작성"
          href="/encourage"
          variant="secondary"
        />
      </section>

      {digest ? (
        <section className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">요약</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>
              <strong>하이라이트:</strong> {JSON.stringify(digest.highlights)}
            </p>
            <p>
              <strong>리스크:</strong> {JSON.stringify(digest.risks)}
            </p>
            <p>
              <strong>Next:</strong> {JSON.stringify(digest.next)}
            </p>
          </div>
        </section>
      ) : null}

      {data.message ? <p className="text-sm text-amber-600">{data.message}</p> : null}
    </main>
  );
}
