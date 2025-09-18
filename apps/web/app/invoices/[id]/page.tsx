import Link from 'next/link';
import { getInvoiceDetail } from '@/lib/api';

const API_BASE = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export default async function InvoiceDetail({ params }: { params: { id: string } }) {
  const data = await getInvoiceDetail(params.id);

  if (data.invoice === null) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-slate-600">
        <p>청구서를 찾을 수 없습니다.</p>
        <Link href="/parent" className="mt-4 text-primary underline">
          부모 홈으로 돌아가기
        </Link>
      </main>
    );
  }

  const items = (data.invoice?.lineItems as Array<{ type: string; qty: number; unitPrice: number }>) ?? [];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-8">
      <header className="rounded-lg bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">청구서 #{data.invoice?.id}</h1>
        <p className="mt-1 text-sm text-slate-600">청구 기간: {data.invoice?.period}</p>
        <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">상태: {data.invoice?.status}</p>
      </header>

      <section className="rounded-lg bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">라인 아이템</h2>
        <table className="mt-3 w-full text-sm text-slate-600">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="py-2">유형</th>
              <th className="py-2">수량</th>
              <th className="py-2">단가</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={`${item.type}-${index}`} className="border-t border-slate-100">
                <td className="py-2 capitalize">{item.type}</td>
                <td className="py-2">{item.qty}</td>
                <td className="py-2">${item.unitPrice}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right text-lg font-semibold text-slate-900">총액: ${data.invoice?.total}</p>
      </section>

      <Link
        href={`${API_BASE}/invoices/${params.id}/receipt`}
        className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
      >
        영수증 다운로드
      </Link>

      {data.message ? <p className="text-xs text-amber-600">{data.message}</p> : null}
    </main>
  );
}
