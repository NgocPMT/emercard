import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { createPageQueryClient } from "../../api/query-client";
import { Alert, Button, LinkButton, Panel, TextInput } from "../../components/primitives";
import { PageTitle } from "../../components/layout";
import { PageErrorBoundary, PublicAuthGate, SessionProvider } from "../session";

export type AuthMode = "login" | "register";

export function AuthPageRoot({
  mode,
  returnTo,
  brand = "EmerCard",
}: {
  mode: AuthMode;
  returnTo?: string | null;
  brand?: ReactNode;
}) {
  const [queryClient] = useState(() => createPageQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PageErrorBoundary>
        <SessionProvider>
          <PublicAuthGate returnTo={returnTo}>
            <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                <PageTitle
                  eyebrow={mode === "login" ? "Đăng nhập" : "Đăng ký"}
                  title={mode === "login" ? `Truy cập tài khoản ${brand}` : `Tạo tài khoản ${brand}`}
                  description="Biểu mẫu nền tảng này hiện chỉ hiển thị cấu trúc UI và sẽ được nối với luồng xác thực ở giai đoạn sau."
                />
                <Alert variant="info" title="Ghi chú">
                  {mode === "login"
                    ? "Nếu bạn đã đăng nhập, hệ thống sẽ chuyển bạn tới khu vực tương ứng."
                    : "Biểu mẫu đăng ký chưa gửi dữ liệu thật trong giai đoạn nền tảng này."}
                </Alert>
              </div>

              <Panel className="space-y-5">
                <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
                  <TextInput label="Email" type="email" autoComplete="email" placeholder="ten@domain.com" required />
                  <TextInput
                    label="Mật khẩu"
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    required
                  />
                  {mode === "register" ? (
                    <TextInput
                      label="Xác nhận mật khẩu"
                      type="password"
                      autoComplete="new-password"
                      placeholder="••••••••"
                      required
                    />
                  ) : null}
                  <Button type="submit" size="lg" className="w-full">
                    {mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
                  </Button>
                </form>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
                  <span>{mode === "login" ? "Chưa có tài khoản?" : "Đã có tài khoản?"}</span>
                  <LinkButton href={mode === "login" ? "/register" : "/login"} variant="ghost" size="sm">
                    {mode === "login" ? "Đăng ký" : "Đăng nhập"}
                  </LinkButton>
                </div>
              </Panel>
            </section>
          </PublicAuthGate>
        </SessionProvider>
      </PageErrorBoundary>
    </QueryClientProvider>
  );
}
