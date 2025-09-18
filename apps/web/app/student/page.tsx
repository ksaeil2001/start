import { DecisionCard } from '@/components/DecisionCard';
import { StatPanel } from '@/components/StatPanel';
import { getStudentDashboard } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

export default async function StudentHome() {
  const data = await getStudentDashboard();
  const nextAssignment = data.pendingAssignments[0];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-8">
      <header className="rounded-lg bg-primary/10 p-6">
        <h1 className="text-2xl font-semibold text-primary">오늘 할 일</h1>
        <p className="mt-1 text-sm text-primary/80">제출 마감까지 남은 시간을 확인하고 한 번에 업로드하세요.</p>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <StatPanel
          label="D-Day"
          value={
            nextAssignment
              ? `${formatDistanceToNow(new Date(nextAssignment.dueAt), { addSuffix: true })}`
              : '다음 과제가 없습니다'
          }
        />
        <StatPanel label="격려 받음" value={data.latestEncouragement ?? '연결 시 최신 메시지가 표시됩니다.'} />
      </section>

      <DecisionCard
        title={nextAssignment ? nextAssignment.title : '과제가 없습니다'}
        description={nextAssignment ? '파일을 업로드하면 튜터에게 바로 전달됩니다.' : '튜터가 새 과제를 만들면 여기에 표시됩니다.'}
        actionLabel={nextAssignment ? '지금 제출하기' : '새로 고침'}
        href={nextAssignment ? `/assignments/${nextAssignment.id}` : undefined}
        onClick={nextAssignment ? undefined : async () => undefined}
        disabled={!nextAssignment}
      />

      {data.message ? (
        <p className="text-sm text-amber-600" role="status">
          {data.message}
        </p>
      ) : null}
    </main>
  );
}
