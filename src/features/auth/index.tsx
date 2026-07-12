import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { login, registerAccount } from "../../api/auth";
import { ApiError } from "../../api/errors";
import { isApiError } from "../../api/http-client";
import { Alert, Button, LinkButton, Panel, TextInput } from "../../components/primitives";
import { PageTitle } from "../../components/layout";
import { createPageQueryClient } from "../../api/query-client";
import { sessionKeys } from "../../api/session";
import { PageErrorBoundary, PublicAuthGate, SessionProvider, validateReturnTo } from "../session";

export type AuthMode = "login" | "register";

type AuthFlash = {
  variant: "success" | "warning" | "danger" | "info";
  title: string;
  message: string;
} | null;

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email không được để trống")
  .max(254, "Email quá dài")
  .email("Email không hợp lệ");

const passwordSchema = z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự").max(128, "Mật khẩu quá dài");

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const registerSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp",
  });

function resolveFlashNotice(notice: string | null | undefined, initialEmail: string | null | undefined): AuthFlash {
  if (!notice) return null;
  if (notice === "registration-success") {
    return {
      variant: "success",
      title: "Đăng ký thành công",
      message: initialEmail
        ? `Tài khoản ${initialEmail.trim()} đã được tạo. Hãy đăng nhập để tiếp tục.`
        : "Tài khoản đã được tạo. Hãy đăng nhập để tiếp tục.",
    };
  }
  if (notice === "logout-unconfirmed") {
    return {
      variant: "warning",
      title: "Đăng xuất đã được thực hiện trên trình duyệt",
      message: "Phiên cục bộ đã bị xóa, nhưng máy chủ chưa xác nhận đăng xuất thành công.",
    };
  }
  return {
    variant: "info",
    title: "Thông báo",
    message: notice,
  };
}

function apiErrorMessage(error: ApiError) {
  if (error.status === 429) return "Hệ thống đang bận. Vui lòng thử lại sau.";
  if (error.retryable) return "Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau.";
  return "Đã xảy ra lỗi không mong muốn.";
}

function applyValidationDetails<TField extends string>(
  error: ApiError,
  setError: (name: TField | "root", error: { type: string; message: string }) => void,
  setFocus: (name: TField) => void,
) {
  let firstField: TField | null = null;
  for (const detail of error.details) {
    if (detail.path === "form" || detail.path === "root") {
      setError("root", { type: detail.type, message: detail.message });
      continue;
    }
    const field = detail.path as TField;
    setError(field, { type: detail.type, message: detail.message });
    firstField ??= field;
  }
  if (firstField) {
    setFocus(firstField);
  }
}

function AuthLayout({
  mode,
  brand,
  notice,
  initialEmail,
  returnTo,
}: {
  mode: AuthMode;
  brand: ReactNode;
  notice?: string | null;
  initialEmail?: string | null;
  returnTo?: string | null;
}) {
  const flash = useMemo(() => resolveFlashNotice(notice, initialEmail), [initialEmail, notice]);

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <PageTitle
          eyebrow={mode === "login" ? "Đăng nhập" : "Đăng ký"}
          title={mode === "login" ? `Truy cập tài khoản ${brand}` : `Tạo tài khoản ${brand}`}
          description={mode === "login" ? "Đăng nhập bằng email và mật khẩu để tiếp tục." : "Tạo tài khoản mới bằng email và mật khẩu."}
        />
        {flash ? (
          <Alert variant={flash.variant} title={flash.title}>
            {flash.message}
          </Alert>
        ) : null}
      </div>

      <Panel className="space-y-5">
        {mode === "login" ? <LoginForm initialEmail={initialEmail} returnTo={returnTo} /> : <RegisterForm initialEmail={initialEmail} />}
      </Panel>
    </section>
  );
}

function LoginForm({ initialEmail, returnTo }: { initialEmail?: string | null; returnTo?: string | null }) {
  const queryClient = useQueryClient();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: initialEmail?.trim() ?? "",
      password: "",
    },
    mode: "onSubmit",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setRootMessage(null);
    form.clearErrors();
    try {
      const session = await login({ email: values.email.trim(), password: values.password });
      queryClient.setQueryData(sessionKeys.current, session);
      form.reset({ email: values.email.trim(), password: "" });
      window.location.assign(validateReturnTo(returnTo, session.role));
    } catch (error) {
      handleLoginError(error, form.setError, form.setFocus, setRootMessage);
    }
  });

  return (
    <form className="space-y-5" onSubmit={(event) => void onSubmit(event)} noValidate>
      {rootMessage ? (
        <Alert variant="danger" title="Không thể đăng nhập">
          {rootMessage}
        </Alert>
      ) : null}

      <TextInput
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="ten@domain.com"
        required
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <TextInput
        label="Mật khẩu"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />

      <Button type="submit" size="lg" className="w-full" busy={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Chưa có tài khoản?</span>
        <LinkButton href="/register" variant="ghost" size="sm">
          Đăng ký
        </LinkButton>
      </div>
    </form>
  );
}

function RegisterForm({ initialEmail }: { initialEmail?: string | null }) {
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: initialEmail?.trim() ?? "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setRootMessage(null);
    form.clearErrors();
    try {
      await registerAccount({ email: values.email.trim(), password: values.password });
      form.reset({ email: values.email.trim(), password: "", confirmPassword: "" });
      window.location.assign(`/login?notice=registration-success&email=${encodeURIComponent(values.email.trim())}`);
    } catch (error) {
      handleRegisterError(error, form.setError, form.setFocus, setRootMessage);
    }
  });

  return (
    <form className="space-y-5" onSubmit={(event) => void onSubmit(event)} noValidate>
      {rootMessage ? (
        <Alert variant="danger" title="Không thể đăng ký">
          {rootMessage}
        </Alert>
      ) : null}

      <TextInput
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="ten@domain.com"
        required
        error={form.formState.errors.email?.message}
        {...form.register("email")}
      />
      <TextInput
        label="Mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        error={form.formState.errors.password?.message}
        {...form.register("password")}
      />
      <TextInput
        label="Xác nhận mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        error={form.formState.errors.confirmPassword?.message}
        {...form.register("confirmPassword")}
      />

      <Button type="submit" size="lg" className="w-full" busy={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? "Đang tạo tài khoản..." : "Tạo tài khoản"}
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>Đã có tài khoản?</span>
        <LinkButton href="/login" variant="ghost" size="sm">
          Đăng nhập
        </LinkButton>
      </div>
    </form>
  );
}

function handleLoginError(
  error: unknown,
  setError: (name: "email" | "password" | "root", error: { type: string; message: string }) => void,
  setFocus: (name: "email" | "password") => void,
  setRootMessage: (value: string | null) => void,
) {
  if (!isApiError(error)) {
    setRootMessage("Không thể kết nối tới máy chủ.");
    return;
  }

  if (error.code === "validation_error") {
    applyValidationDetails(error, setError, setFocus);
    if (!error.details.length) {
      setRootMessage("Dữ liệu đăng nhập không hợp lệ.");
    }
    return;
  }

  if (error.code === "auth.invalid_credentials") {
    setError("root", { type: error.code, message: "Email hoặc mật khẩu không đúng." });
    setRootMessage("Email hoặc mật khẩu không đúng.");
    setFocus("password");
    return;
  }

  if (error.status === 401) {
    setRootMessage("Email hoặc mật khẩu không đúng.");
    return;
  }

  setRootMessage(apiErrorMessage(error));
}

function handleRegisterError(
  error: unknown,
  setError: (name: "email" | "password" | "confirmPassword" | "root", error: { type: string; message: string }) => void,
  setFocus: (name: "email" | "password" | "confirmPassword") => void,
  setRootMessage: (value: string | null) => void,
) {
  if (!isApiError(error)) {
    setRootMessage("Không thể kết nối tới máy chủ.");
    return;
  }

  if (error.code === "validation_error") {
    applyValidationDetails(error, setError, setFocus);
    if (!error.details.length) {
      setRootMessage("Dữ liệu đăng ký không hợp lệ.");
    }
    return;
  }

  if (error.code === "auth.email_already_registered") {
    setError("email", { type: error.code, message: "Email này đã được sử dụng." });
    setRootMessage("Email này đã được sử dụng.");
    setFocus("email");
    return;
  }

  setRootMessage(apiErrorMessage(error));
}

export function AuthPageRoot({
  mode,
  returnTo,
  initialEmail,
  notice,
  brand = "EmerCard",
}: {
  mode: AuthMode;
  returnTo?: string | null;
  initialEmail?: string | null;
  notice?: string | null;
  brand?: ReactNode;
}) {
  const [queryClient] = useState(() => createPageQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <PageErrorBoundary>
        <SessionProvider>
          <PublicAuthGate returnTo={returnTo}>
            <AuthLayout mode={mode} brand={brand} notice={notice} initialEmail={initialEmail} returnTo={returnTo} />
          </PublicAuthGate>
        </SessionProvider>
      </PageErrorBoundary>
    </QueryClientProvider>
  );
}
