import { redirect } from "next/navigation";
import { PageLayout } from "@/components/layout/PageLayout";
import { Card } from "@/components/ui/Card";
import { readAdminSession } from "@/lib/session";
import { listStaffUsers } from "@/modules/staff/staff.service";
import { AdminNav } from "../AdminNav";
import { StaffPageActions } from "./StaffPageActions";
import { StaffRow } from "./StaffRow";

export default async function AdminStaffPage() {
  const session = await readAdminSession();
  if (!session) {
    redirect("/admin/login");
  }

  const users = await listStaffUsers();

  return (
    <PageLayout
      title="پنل ادمین — کاربران"
      subtitle="مدیریت حساب‌های ادمین و کارشناس فروش."
      showBack
      backHref="/admin/dashboard"
      maxWidth="5xl"
      footer="minimal"
    >
      <AdminNav />
      <StaffPageActions />

      {users.length === 0 ? (
        <Card className="text-center">
          <p className="text-zinc-600">هنوز کاربر داخلی ثبت نشده است.</p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-right">
              <tr>
                <th className="px-4 py-3 font-medium text-zinc-700">نام</th>
                <th className="px-4 py-3 font-medium text-zinc-700">موبایل</th>
                <th className="px-4 py-3 font-medium text-zinc-700">نقش</th>
                <th className="px-4 py-3 font-medium text-zinc-700">وضعیت</th>
                <th className="px-4 py-3 font-medium text-zinc-700">
                  آخرین ورود
                </th>
                <th className="px-4 py-3 font-medium text-zinc-700" aria-label="عملیات" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {users.map((user) => (
                <StaffRow key={user.id} user={user} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageLayout>
  );
}
