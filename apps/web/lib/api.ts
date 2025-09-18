const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

type FetchOptions = {
  token?: string;
  cache?: RequestCache;
};

async function safeFetch<T>(path: string, options: FetchOptions = {}): Promise<{ data: T | null; error?: string }> {
  try {
    const res = await fetch(`${API_URL}${path}`, {
      cache: options.cache ?? 'no-store',
      headers: options.token
        ? {
            Authorization: `Bearer ${options.token}`
          }
        : undefined
    });
    if (!res.ok) {
      return { data: null, error: `${res.status} ${res.statusText}` };
    }
    const data = (await res.json()) as T;
    return { data };
  } catch (error) {
    return { data: null, error: (error as Error).message };
  }
}

type StudentDashboard = {
  pendingAssignments: Array<{ id: string; title: string; dueAt: string }>;
  latestEncouragement?: string;
  message?: string;
};

export async function getStudentDashboard(): Promise<StudentDashboard> {
  const studentId = process.env.NEXT_PUBLIC_STUDENT_ID;
  const token = process.env.NEXT_PUBLIC_STUDENT_TOKEN;

  if (!studentId || !token) {
    return {
      pendingAssignments: [
        { id: 'demo-assignment', title: 'Write reflection on chapter 3', dueAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString() }
      ],
      latestEncouragement: '부모님: 오늘도 파이팅! (Demo)',
      message: 'Connect API credentials to view live submissions.'
    };
  }

  const assignments = await safeFetch<{ assignments: Array<{ assignment: { id: string; title: string; dueAt: string } }> }>(
    `/assignments/students/${studentId}`,
    { token }
  );

  if (!assignments.data) {
    return {
      pendingAssignments: [],
      message: assignments.error ?? 'Unable to reach API'
    };
  }

  return {
    pendingAssignments: assignments.data.assignments.map((entry) => ({
      id: entry.assignment.id,
      title: entry.assignment.title,
      dueAt: entry.assignment.dueAt
    })),
    latestEncouragement: 'Keep going! 연결된 격려는 API 활성화 시 표시됩니다.'
  };
}

type TutorDashboard = {
  reviewQueue: Array<{ id: string; title: string; studentName: string; status: string }>;
  todaysSessions: Array<{ id: string; start: string; end: string }>;
  message?: string;
};

export async function getTutorDashboard(): Promise<TutorDashboard> {
  const tutorToken = process.env.NEXT_PUBLIC_TUTOR_TOKEN;
  const studentId = process.env.NEXT_PUBLIC_STUDENT_ID;
  if (!tutorToken || !studentId) {
    return {
      reviewQueue: [
        { id: 'demo', title: 'Essay draft', studentName: 'Student S', status: 'Waiting 3h' }
      ],
      todaysSessions: [],
      message: 'Add NEXT_PUBLIC_TUTOR_TOKEN to stream live SLA timers.'
    };
  }

  const assignments = await safeFetch<{ assignments: Array<{ assignment: { id: string; title: string; status: string }; scope: string }> }>(
    `/assignments/students/${studentId}`,
    { token: tutorToken }
  );

  const reviewQueue = assignments.data
    ? assignments.data.assignments
        .filter((entry) => entry.assignment.status !== 'Finalized')
        .map((entry) => ({ id: entry.assignment.id, title: entry.assignment.title, studentName: 'Your student', status: entry.assignment.status }))
    : [];

  return {
    reviewQueue,
    todaysSessions: [],
    message: assignments.error
  };
}

type ParentDashboard = {
  digest?: {
    highlights: unknown;
    risks: unknown;
    next: unknown;
  };
  message?: string;
};

export async function getParentDashboard(): Promise<ParentDashboard> {
  const parentToken = process.env.NEXT_PUBLIC_PARENT_TOKEN;
  const studentId = process.env.NEXT_PUBLIC_STUDENT_ID;
  if (!parentToken || !studentId) {
    return {
      digest: {
        highlights: {
          demo: '최신 제출과 세션 요약은 API 연결 시 노출됩니다.'
        },
        risks: {
          due_in_48h_without_submission: ['Demo Essay']
        },
        next: {
          next_due: { title: 'Vocabulary quiz', dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }
        }
      },
      message: 'Set NEXT_PUBLIC_PARENT_TOKEN and NEXT_PUBLIC_STUDENT_ID for live visibility.'
    };
  }

  const digest = await safeFetch<{ highlights: unknown; risks: unknown; next: unknown }>(
    `/daily-digest?relationship=S-P&studentId=${studentId}`,
    { token: parentToken }
  );

  if (!digest.data) {
    return { message: digest.error };
  }

  return { digest: digest.data };
}

export async function getAssignmentDetail(assignmentId: string) {
  const studentId = process.env.NEXT_PUBLIC_STUDENT_ID;
  const token = process.env.NEXT_PUBLIC_STUDENT_TOKEN ?? process.env.NEXT_PUBLIC_TUTOR_TOKEN;

  if (!studentId || !token) {
    return {
      assignment: {
        id: assignmentId,
        title: 'Demo Assignment',
        goal: '환경 설정 후 API 연결',
        status: 'Open',
        submissions: []
      },
      message: 'API 토큰을 설정하면 실제 데이터가 표시됩니다.'
    };
  }

  const assignments = await safeFetch<{ assignments: Array<{ assignment: Record<string, unknown> }> }>(`/assignments/students/${studentId}`, {
    token
  });

  const match = assignments.data?.assignments.find((entry) => entry.assignment.id === assignmentId)?.assignment;
  if (!match) {
    return { message: 'Assignment not found', assignment: null };
  }

  return { assignment: match, message: assignments.error };
}

export async function getInvoiceDetail(invoiceId: string) {
  const token = process.env.NEXT_PUBLIC_PARENT_TOKEN ?? process.env.NEXT_PUBLIC_TUTOR_TOKEN;
  if (!token) {
    return {
      invoice: {
        id: invoiceId,
        period: '2024-05',
        status: 'Issued',
        lineItems: [{ type: 'tuition', qty: 180, unitPrice: 1.2 }],
        total: '216.00'
      },
      message: 'API 토큰을 설정하면 실제 청구서가 표시됩니다.'
    };
  }

  const invoice = await safeFetch<{ invoice: Record<string, unknown> }>(`/invoices/${invoiceId}`, { token });
  if (!invoice.data) {
    return { invoice: null, message: invoice.error };
  }

  return { invoice: invoice.data.invoice, message: invoice.error };
}
