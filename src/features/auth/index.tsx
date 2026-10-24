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

const identifierSchema = z
  .string()
  .trim()
  .min(1, "Vui lòng nhập Email hoặc Số điện thoại")
  .max(254, "Thông tin đăng nhập quá dài");

const loginSchema = z.object({
  email: identifierSchema,
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
    <div className="w-full max-w-[420px] mx-auto py-6" data-od-id="board-auth-login">
      <div className="screen-content bg-white border border-[#d3d9e0] rounded-[18px] p-5 sm:p-6 shadow-[0_4px_20px_rgba(30,36,44,0.06)]">
        <div>
          <h2 className="text-xl font-bold text-[#1e242c] mb-1 font-display">Đăng Nhập</h2>
          <p className="text-[13px] text-[#64748b]">Nhập tài khoản để quản lý hồ sơ y tế khẩn cấp và thẻ NFC vật lý của bạn.</p>
        </div>

        {flash ? (
          <Alert variant={flash.variant} title={flash.title}>
            {flash.message}
          </Alert>
        ) : null}

        <LoginForm initialEmail={initialEmail} returnTo={returnTo} />
      </div>
    </div>
  );
}

function LoginForm({ initialEmail, returnTo }: { initialEmail?: string | null; returnTo?: string | null }) {
  const queryClient = useQueryClient();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
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
    <form className="flex flex-col gap-3.5 w-full" onSubmit={(event) => void onSubmit(event)} noValidate>
      {rootMessage ? (
        <Alert variant="danger" title="Không thể đăng nhập">
          {rootMessage}
        </Alert>
      ) : null}

      <div className="field-group">
        <label className="field-label" htmlFor="login-email">
          Email hoặc Số điện thoại
        </label>
        <div className="field-input-wrap">
          <input
            className={`input-text input-mono ${form.formState.errors.email ? "border-[#cc3336]" : ""}`}
            id="login-email"
            type="text"
            autoComplete="username"
            placeholder="ten@domain.com hoặc 0901234567"
            required
            {...form.register("email")}
          />
        </div>
        {form.formState.errors.email ? (
          <span className="text-[12px] text-[#991b1b] mt-0.5 font-medium">{form.formState.errors.email.message}</span>
        ) : null}
      </div>

      <div className="field-group">
        <div className="field-label-row">
          <label className="field-label" htmlFor="login-pwd">
            Mật khẩu
          </label>
          <button
            type="button"
            className="link-subtle"
            onClick={() => alert("Tính năng khôi phục mật khẩu qua SMS OTP đang được nâng cấp.")}
          >
            Quên mật khẩu?
          </button>
        </div>
        <div className="field-input-wrap relative flex items-center">
          <input
            className={`input-text input-mono ${form.formState.errors.password ? "border-[#cc3336]" : ""}`}
            id="login-pwd"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••"
            required
            {...form.register("password")}
          />
          <button
            type="button"
            className="input-icon-btn"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            onClick={() => setShowPassword((prev) => !prev)}
          >
            {showPassword ? (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
              </svg>
            )}
          </button>
        </div>
        {form.formState.errors.password ? (
          <span className="text-[12px] text-[#991b1b] mt-0.5 font-medium">{form.formState.errors.password.message}</span>
        ) : null}
      </div>

      <div className="flex items-center gap-2 text-[13px] text-[#1e242c] select-none py-1">
        <input
          type="checkbox"
          id="remember-me"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
          className="w-4 h-4 rounded text-[#327bb0] focus:ring-[#327bb0] accent-[#327bb0]"
        />
        <label htmlFor="remember-me" className="cursor-pointer">
          Ghi nhớ đăng nhập trên thiết bị này
        </label>
      </div>

      <button
        type="submit"
        className="btn-primary mt-1"
        disabled={form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? "Đang đăng nhập..." : "Đăng Nhập"}
      </button>

      <div className="text-center text-[13px] text-[#64748b] pt-2">
        Chưa có tài khoản?{" "}
        <a href="/register" className="link-subtle font-semibold">
          Đăng ký hồ sơ mới
        </a>
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
      <div className="w-full max-w-md mx-auto" data-od-id="board-register-success">
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
    <div className="w-full max-w-md mx-auto" data-od-id="board-register-form">
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
