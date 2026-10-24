import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { login, registerAccount } from "../../api/auth";
import { ApiError } from "../../api/errors";
import { isApiError } from "../../api/http-client";
import { Alert, Button, LinkButton, Panel, TextInput } from "../../components/primitives";
import { BrandMark, PageTitle } from "../../components/layout";
import { createPageQueryClient } from "../../api/query-client";
import { sessionKeys } from "../../api/session";
import { PageErrorBoundary, PublicAuthGate, SessionProvider, validateReturnTo } from "../session";
import { assignLocation } from "../../lib/navigation";

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

const phoneSchema = z
  .string()
  .trim()
  .refine((val) => !val || /^(0|\+84)[3|5|7|8|9][0-9]{8}$/.test(val), {
    message: "Số điện thoại không hợp lệ",
  })
  .optional();

const registerSchema = z
  .object({
    email: emailSchema,
    phone: phoneSchema,
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

  if (mode === "register") {
    return (
      <div className="w-full max-w-[420px] mx-auto py-6">
        <RegisterForm initialEmail={initialEmail} notice={notice} />
      </div>
    );
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
      <div className="brand-surface flex min-h-[28rem] flex-col justify-between rounded-[2rem] border border-primary/15 p-7 shadow-[var(--shadow-lifted)] sm:p-10">
        <div className="space-y-10">
          <BrandMark />
          <PageTitle
            eyebrow="Tài khoản an toàn"
            title="Thông tin quan trọng, luôn sẵn sàng."
            description="Đăng nhập để quản lý hồ sơ và liên kết khẩn cấp của bạn."
          />
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">EmerCard giúp thông tin y tế quan trọng đi cùng bạn, nhưng chỉ hiển thị khi được cấp quyền.</p>
        {flash ? (
          <Alert variant={flash.variant} title={flash.title}>
            {flash.message}
          </Alert>
        ) : null}
      </div>

      <Panel className="flex items-center justify-center p-6 sm:p-10">
        <LoginForm initialEmail={initialEmail} returnTo={returnTo} />
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

  useEffect(() => {
    if (initialEmail) {
      form.reset({ email: initialEmail.trim(), password: "" });
    }
  }, [form, initialEmail]);

  const onSubmit = form.handleSubmit(async (values) => {
    setRootMessage(null);
    form.clearErrors();
    try {
      const session = await login({ email: values.email.trim(), password: values.password });
      queryClient.setQueryData(sessionKeys.current, session);
      form.reset({ email: values.email.trim(), password: "" });
      assignLocation(validateReturnTo(returnTo, session.role));
    } catch (error) {
      handleLoginError(error, form.setError, form.setFocus, setRootMessage);
    }
  });

  return (
    <form className="w-full max-w-md space-y-5" onSubmit={(event) => void onSubmit(event)} noValidate>
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

function RegisterForm({ initialEmail, notice }: { initialEmail?: string | null; notice?: string | null }) {
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState<boolean>(() => {
    if (notice === "registration-success") return true;
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("notice") === "registration-success";
    }
    return false;
  });
  const [registeredEmail, setRegisteredEmail] = useState<string>(() => {
    if (initialEmail?.trim()) return initialEmail.trim();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("email")?.trim() ?? "";
    }
    return "";
  });

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: initialEmail?.trim() ?? "",
      phone: "",
      password: "",
      confirmPassword: "",
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (initialEmail) {
      form.reset({ email: initialEmail.trim(), phone: "", password: "", confirmPassword: "" });
      setRegisteredEmail(initialEmail.trim());
    }
  }, [form, initialEmail]);

  const onSubmit = form.handleSubmit(async (values) => {
    setRootMessage(null);
    form.clearErrors();
    try {
      await registerAccount({
        email: values.email.trim(),
        phone: values.phone?.trim() || undefined,
        password: values.password,
      });
      setRegisteredEmail(values.email.trim());
      setIsSuccess(true);
      form.reset({ email: values.email.trim(), phone: "", password: "", confirmPassword: "" });
    } catch (error) {
      handleRegisterError(error, form.setError, form.setFocus, setRootMessage);
    }
  });

  if (isSuccess) {
    return (
      <div className="phone-frame w-full max-w-[420px] mx-auto shadow-sm" data-od-id="board-register-success">
        <div className="phone-status-bar">
          <span className="status-time">10:25</span>
          <div className="status-icons">
            <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z"/></svg>
            <svg viewBox="0 0 24 24"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z"/></svg>
            <svg viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
          </div>
        </div>

        <div className="reg-success-wrap">
          <div className="reg-success-content">
            <div className="success-icon-badge">
              <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
            </div>
            <h3 className="reg-success-title">Đăng ký thành công!</h3>
            <p className="reg-success-desc">Tài khoản EmerCard của bạn đã sẵn sàng. Bạn có thể đăng nhập để hoàn thiện hồ sơ y tế.</p>
          </div>

          <button
            className="btn-login-action"
            data-od-id="path-1-6-1-1-1"
            type="button"
            onClick={() => assignLocation(`/login?notice=registration-success&email=${encodeURIComponent(registeredEmail)}`)}
          >
            Đăng Nhập
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-frame w-full max-w-[420px] mx-auto shadow-sm" data-od-id="board-register-form">
      <div className="phone-status-bar">
        <span className="status-time">10:24</span>
        <div className="status-icons">
          <svg viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61L12 22l7.03-4.39C20.26 16.07 21 14.12 21 12c0-4.97-4.03-9-9-9z"/></svg>
          <svg viewBox="0 0 24 24"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4z"/></svg>
          <svg viewBox="0 0 24 24"><path d="M15.67 4H14V2h-4v2H8.33C7.6 4 7 4.6 7 5.33v15.33C7 21.4 7.6 22 8.33 22h7.33c.74 0 1.34-.6 1.34-1.33V5.33C17 4.6 16.4 4 15.67 4z"/></svg>
        </div>
      </div>

      <div className="register-screen-wrap">
        <div className="register-header">
          <h2 className="register-title">Đăng Ký Tài Khoản</h2>
          <p className="register-desc">Tạo tài khoản để quản lý hồ sơ y tế và thẻ EmerCard của bạn.</p>
        </div>

        {rootMessage ? (
          <Alert variant="danger" title="Không thể đăng ký">
            {rootMessage}
          </Alert>
        ) : null}

        <form className="register-form" onSubmit={(event) => void onSubmit(event)} noValidate>
          {/* Trường 1: Email */}
          <div className="input-field-group">
            <label className="input-label" htmlFor="reg-email">Email</label>
            <input
              className={`text-input ${form.formState.errors.email ? "input-invalid" : ""}`}
              id="reg-email"
              type="email"
              autoComplete="email"
              placeholder="ten@domain.com"
              required
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <span className="input-error-text">{form.formState.errors.email.message}</span>
            ) : null}
          </div>

          {/* Trường 2: Số điện thoại */}
          <div className="input-field-group">
            <label className="input-label" htmlFor="reg-phone">Số điện thoại</label>
            <input
              className={`text-input ${form.formState.errors.phone ? "input-invalid" : ""}`}
              id="reg-phone"
              type="tel"
              autoComplete="tel"
              placeholder="0901234567"
              {...form.register("phone")}
            />
            {form.formState.errors.phone ? (
              <span className="input-error-text">{form.formState.errors.phone.message}</span>
            ) : null}
          </div>

          {/* Trường 3: Mật khẩu */}
          <div className="input-field-group">
            <label className="input-label" htmlFor="reg-pwd">Mật khẩu</label>
            <input
              className={`text-input ${form.formState.errors.password ? "input-invalid" : ""}`}
              id="reg-pwd"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <span className="input-error-text">{form.formState.errors.password.message}</span>
            ) : null}
          </div>

          {/* Trường 4: Xác nhận mật khẩu */}
          <div className="input-field-group">
            <label className="input-label" htmlFor="reg-pwd-confirm">Xác nhận mật khẩu</label>
            <input
              className={`text-input ${form.formState.errors.confirmPassword ? "input-invalid" : ""}`}
              id="reg-pwd-confirm"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              required
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <span className="input-error-text">{form.formState.errors.confirmPassword.message}</span>
            ) : null}
          </div>

          <button
            className="btn-submit-reg"
            type="submit"
            disabled={form.formState.isSubmitting}
            aria-label="Tạo tài khoản"
          >
            {form.formState.isSubmitting ? "Đang tạo tài khoản..." : "Đăng Ký"}
          </button>
        </form>

        <p className="register-footer-text">
          Đã có tài khoản?{" "}
          <a href="/login" className="link-login">
            Đăng nhập
          </a>
        </p>
      </div>
    </div>
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
  setError: (name: "email" | "phone" | "password" | "confirmPassword" | "root", error: { type: string; message: string }) => void,
  setFocus: (name: "email" | "phone" | "password" | "confirmPassword") => void,
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

  if (error.code === "auth.phone_already_registered") {
    setError("phone", { type: error.code, message: "Số điện thoại này đã được sử dụng." });
    setRootMessage("Số điện thoại này đã được sử dụng.");
    setFocus("phone");
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

  useEffect(() => {
    document.body.dataset.authHydrated = "true";
    return () => {
      delete document.body.dataset.authHydrated;
    };
  }, []);

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
