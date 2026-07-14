import React, { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, type FieldPath, type UseFormSetError, type UseFormSetFocus } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Panel, Select, StatusBadge, Textarea, TextInput } from "../../components/primitives";
import { EmptyState, PageLoadingState, RetryState, ServiceUnavailableState } from "../../components/feedback";
import { BrandMark } from "../../components/layout";
import {
  getCurrentProfile,
  profileKeys,
  profileMissingFieldLabel,
  profileReadinessLabel,
  saveCurrentProfile,
  type ProfileUpsertInput,
  type ProfileView,
} from "../../api/profile";
import { ApiError } from "../../api/errors";
import { isApiError } from "../../api/http-client";
import { assignLocation } from "../../lib/navigation";
import { bloodTypeLabel, genderLabel } from "../../lib/profile-labels";
import { PageApplicationRoot, useSession } from "../session";

const userNavigation = [
  { href: "/app", label: "Tổng quan" },
  { href: "/app/profile", label: "Hồ sơ y tế" },
  { href: "/app/cards", label: "Thẻ của tôi" },
];

const appBrand = <BrandMark />;

const genderOptions = [
  { value: "female", label: "Nữ" },
  { value: "male", label: "Nam" },
  { value: "other", label: "Khác" },
  { value: "prefer_not_to_say", label: "Không muốn nói" },
] as const;

const bloodTypeOptions = [
  { value: "A+", label: "A+" },
  { value: "A-", label: "A-" },
  { value: "B+", label: "B+" },
  { value: "B-", label: "B-" },
  { value: "AB+", label: "AB+" },
  { value: "AB-", label: "AB-" },
  { value: "O+", label: "O+" },
  { value: "O-", label: "O-" },
  { value: "unknown", label: "Không rõ" },
] as const;

type ProfileGender = (typeof genderOptions)[number]["value"];
type ProfileBloodType = (typeof bloodTypeOptions)[number]["value"];
type ProfilePreviewContact = NonNullable<NonNullable<ProfileView["profile"]>["emergency_contacts"]>[number];

type ProfileContactRow = {
  name: string;
  relationship: string;
  phone: string;
};

export type ProfileFormValues = {
  display_name: string;
  birth_year: string;
  gender: ProfileGender | "";
  blood_type: ProfileBloodType | "";
  critical_allergies: string;
  important_conditions: string;
  critical_medications: string;
  emergency_note: string;
  emergency_contacts: ProfileContactRow[];
};

const emptyContact = (): ProfileContactRow => ({ name: "", relationship: "", phone: "" });

function joinLines(values: string[]) {
  return values.join("\n");
}

function splitLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function profileViewToFormValues(profile: ProfileView["profile"]): ProfileFormValues {
  return {
    display_name: profile?.display_name ?? "",
    birth_year: profile?.birth_year?.toString() ?? "",
    gender: (profile?.gender ?? "") as ProfileGender | "",
    blood_type: (profile?.blood_type ?? "") as ProfileBloodType | "",
    critical_allergies: joinLines(profile?.critical_allergies ?? []),
    important_conditions: joinLines(profile?.important_conditions ?? []),
    critical_medications: joinLines(profile?.critical_medications ?? []),
    emergency_note: profile?.emergency_note ?? "",
    emergency_contacts:
      profile?.emergency_contacts.length && profile.emergency_contacts.length > 0
        ? profile.emergency_contacts.map((contact) => ({
            name: contact.name,
            relationship: contact.relationship,
            phone: contact.phone,
          }))
        : [emptyContact()],
  };
}

export function profileFormValuesToPayload(values: ProfileFormValues): ProfileUpsertInput {
  const birthYear = values.birth_year.trim();
  const parsedBirthYear = birthYear === "" ? null : Number(birthYear);
  return {
    display_name: values.display_name.trim() === "" ? null : values.display_name.trim(),
    birth_year: birthYear === "" ? null : Number.isInteger(parsedBirthYear) ? parsedBirthYear : null,
    gender: values.gender === "" ? null : values.gender,
    blood_type: values.blood_type === "" ? null : values.blood_type,
    critical_allergies: splitLines(values.critical_allergies),
    important_conditions: splitLines(values.important_conditions),
    critical_medications: splitLines(values.critical_medications),
    emergency_note: values.emergency_note.trim() === "" ? null : values.emergency_note.trim(),
    emergency_contacts: values.emergency_contacts
      .map((contact) => ({
        name: contact.name.trim(),
        relationship: contact.relationship.trim(),
        phone: contact.phone.trim(),
      }))
      .filter((contact) => contact.name || contact.relationship || contact.phone),
  };
}

function setValidationError(
  setError: UseFormSetError<ProfileFormValues>,
  setFocus: UseFormSetFocus<ProfileFormValues>,
  path: string,
  message: string,
  type: string,
) {
  if (path === "form" || path === "root") {
    setError("root", { type, message });
    return;
  }
  setError(path as FieldPath<ProfileFormValues>, { type, message });
  setFocus(path as FieldPath<ProfileFormValues>);
}

function applyValidationErrors(error: ApiError, setError: UseFormSetError<ProfileFormValues>, setFocus: UseFormSetFocus<ProfileFormValues>) {
  let firstField: string | null = null;
  for (const detail of error.details) {
    if (detail.path !== "form" && detail.path !== "root") {
      firstField ??= detail.path;
    }
    setValidationError(setError, setFocus, detail.path, detail.message, detail.type);
  }
  if (firstField) {
    setFocus(firstField as FieldPath<ProfileFormValues>);
  }
}

function profileErrorMessage(error: ApiError) {
  if (error.status === 429) return "Hệ thống đang bận. Vui lòng thử lại sau.";
  if (error.retryable) return "Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau.";
  return "Đã xảy ra lỗi khi lưu hồ sơ.";
}

function previewValue(value: string | null | undefined, fallback: string) {
  if (!value || value.trim() === "") {
    return fallback;
  }
  return value;
}

function previewList(values: string[], fallback: string) {
  return values.length > 0 ? values.join("\n") : fallback;
}

function PreviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[1rem] border border-border p-4">
      <dt className="text-sm font-semibold text-foreground">{label}</dt>
      <dd className="mt-1 text-muted-foreground">{value}</dd>
    </div>
  );
}

function PreviewContactList({ contacts }: { contacts: ProfilePreviewContact[] }) {
  if (!contacts.length) {
    return <p className="mt-1 text-muted-foreground">Chưa có liên hệ.</p>;
  }

  return (
    <ul className="mt-2 space-y-3">
      {contacts.map((contact) => (
        <li key={`${contact.name}-${contact.phone}-${contact.relationship}`} className="rounded-[0.9rem] border border-border bg-card p-3">
          <p className="font-semibold text-foreground">{contact.name}</p>
          <p className="text-sm text-muted-foreground">{contact.relationship}</p>
          <p className="text-sm text-muted-foreground">{contact.phone}</p>
        </li>
      ))}
    </ul>
  );
}

function ProfileReadinessPanel({ profileView }: { profileView: ProfileView }) {
  const { profile, readiness } = profileView;

  return (
    <Panel className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-foreground">Xem trước trang khẩn cấp</h2>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge variant={readiness.status === "ready" ? "success" : readiness.status === "not_started" ? "warning" : "primary"}>
            {profileReadinessLabel(readiness.status)}
          </StatusBadge>
          <span className="text-sm text-muted-foreground">Chỉ xem trong ứng dụng, không tạo liên kết.</span>
        </div>
      </div>

      <article className="space-y-4 rounded-[1.5rem] border border-border bg-card p-4 shadow-sm">
        <header className="space-y-2">
          <p className="text-sm font-semibold tracking-wide text-primary">EMERCARD</p>
          <h2 className="text-2xl font-bold text-foreground">{previewValue(profile?.display_name, "Chưa đặt tên hiển thị")}</h2>
          <p className="text-sm text-muted-foreground">
            {profile?.birth_year ? `Năm sinh: ${profile.birth_year}` : "Năm sinh: chưa cung cấp"}
            {" • "}
            {genderLabel(profile?.gender)}
            {" • "}
            {bloodTypeLabel(profile?.blood_type)}
          </p>
        </header>

        {profile ? (
          <dl className="grid gap-4">
            <PreviewRow label="Nhóm máu" value={bloodTypeLabel(profile.blood_type)} />
            <PreviewRow label="Dị ứng quan trọng" value={<div className="whitespace-pre-line">{previewList(profile.critical_allergies, "Chưa ghi nhận")}</div>} />
            <PreviewRow label="Tình trạng bệnh quan trọng" value={<div className="whitespace-pre-line">{previewList(profile.important_conditions, "Chưa ghi nhận")}</div>} />
            <PreviewRow label="Thuốc đang sử dụng" value={<div className="whitespace-pre-line">{previewList(profile.critical_medications, "Chưa ghi nhận")}</div>} />
            <PreviewRow label="Ghi chú khẩn cấp" value={<div className="whitespace-pre-line">{previewValue(profile.emergency_note, "Chưa có ghi chú")}</div>} />
            <PreviewRow
              label="Liên hệ khẩn cấp"
              value={<PreviewContactList contacts={profile.emergency_contacts} />}
            />
          </dl>
        ) : (
          <EmptyState title="Chưa có hồ sơ" description="Lưu hồ sơ lần đầu để xem trước dữ liệu khẩn cấp." />
        )}

        <section className="rounded-[1rem] border border-border bg-muted/30 p-4">
          <p className="text-sm font-semibold text-foreground">Cập nhật gần nhất</p>
          <p className="mt-1 text-sm text-muted-foreground">{profile?.updated_at ? new Date(profile.updated_at).toLocaleString("vi-VN") : "chưa có"}</p>
        </section>
      </article>

      {readiness.missing_fields.length > 0 ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
          <p className="font-semibold text-foreground">Cần bổ sung</p>
          <ul className="mt-2 space-y-1">
            {readiness.missing_fields.map((field) => (
              <li key={field}>• {profileMissingFieldLabel(field)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="text-sm text-muted-foreground">
        <p>Liên hệ bắt buộc: {readiness.required_contact_count}</p>
        <p className="mt-1">
          Trường bắt buộc: {readiness.completed_required_field_count}/{readiness.total_required_field_count}
        </p>
      </div>
    </Panel>
  );
}

function ProfileEditor({ profileView }: { profileView: ProfileView }) {
  const { clearSessionCache } = useSession();
  const queryClient = useQueryClient();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const formDefaults = useMemo(() => profileViewToFormValues(profileView.profile), [profileView.profile]);
  const form = useForm<ProfileFormValues>({
    defaultValues: formDefaults,
    mode: "onSubmit",
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "emergency_contacts" });
  const saveMutation = useMutation({
    mutationFn: (payload: ProfileUpsertInput) => saveCurrentProfile(payload),
  });

  useEffect(() => {
    form.reset(formDefaults);
    replace(formDefaults.emergency_contacts);
    setRootMessage(null);
    setSuccessMessage(null);
  }, [form, formDefaults, replace]);

  const submit = form.handleSubmit(async (values) => {
    setRootMessage(null);
    setSuccessMessage(null);
    form.clearErrors();

    if (values.birth_year.trim() && !/^\d{4}$/.test(values.birth_year.trim())) {
      form.setError("birth_year", { type: "pattern", message: "Năm sinh phải có 4 chữ số" });
      form.setFocus("birth_year");
      return;
    }

    try {
      const saved = await saveMutation.mutateAsync(profileFormValuesToPayload(values));
      queryClient.setQueryData(profileKeys.current, saved);
      const nextValues = profileViewToFormValues(saved.profile);
      form.reset(nextValues);
      replace(nextValues.emergency_contacts);
      setSuccessMessage(saved.readiness.status === "ready" ? "Hồ sơ đã sẵn sàng để sử dụng." : "Hồ sơ đã được lưu.");
    } catch (error) {
      if (isApiError(error) && error.status === 401) {
        clearSessionCache();
        assignLocation("/login?returnTo=/app/profile");
        return;
      }
      if (isApiError(error) && error.code === "validation_error") {
        applyValidationErrors(error, form.setError, form.setFocus);
        if (!error.details.length) {
          setRootMessage("Dữ liệu hồ sơ không hợp lệ.");
        }
        return;
      }
      if (isApiError(error) && (error.status === 503 || error.retryable)) {
        setRootMessage("Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau.");
        return;
      }
      setRootMessage(isApiError(error) ? profileErrorMessage(error) : "Không thể kết nối tới máy chủ.");
    }
  });

  return (
    <form className="space-y-6" onSubmit={(event) => void submit(event)} noValidate>
      {rootMessage ? (
        <Alert variant="danger" title="Không thể lưu hồ sơ">
          {rootMessage}
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert variant="success" title="Đã lưu hồ sơ">
          {successMessage}
        </Alert>
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Thông tin cơ bản</h3>
          <p className="text-sm text-muted-foreground">Các trường này tạo nên hồ sơ và trạng thái sẵn sàng.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <TextInput
            label="Tên hiển thị"
            placeholder="Alex Example"
            error={form.formState.errors.display_name?.message}
            {...form.register("display_name")}
          />
          <TextInput
            label="Năm sinh"
            placeholder="1995"
            inputMode="numeric"
            error={form.formState.errors.birth_year?.message}
            {...form.register("birth_year")}
          />
          <Select label="Giới tính" error={form.formState.errors.gender?.message} {...form.register("gender")}>
            <option value="">Chọn giới tính</option>
            {genderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
          <Select label="Nhóm máu" error={form.formState.errors.blood_type?.message} {...form.register("blood_type")}>
            <option value="">Chọn nhóm máu</option>
            {bloodTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Thông tin y tế</h3>
          <p className="text-sm text-muted-foreground">Mỗi dòng là một mục riêng. Hệ thống sẽ tự làm sạch khoảng trắng đầu cuối.</p>
        </div>
        <Textarea
          label="Dị ứng quan trọng"
          rows={4}
          placeholder="Penicillin\nLatex"
          error={form.formState.errors.critical_allergies?.message}
          {...form.register("critical_allergies")}
        />
        <Textarea
          label="Bệnh nền / tình trạng quan trọng"
          rows={4}
          placeholder="Asthma\nHypertension"
          error={form.formState.errors.important_conditions?.message}
          {...form.register("important_conditions")}
        />
        <Textarea
          label="Thuốc quan trọng"
          rows={4}
          placeholder="Metformin\nIbuprofen"
          error={form.formState.errors.critical_medications?.message}
          {...form.register("critical_medications")}
        />
        <Textarea
          label="Ghi chú khẩn cấp"
          rows={4}
          placeholder="Thông tin khẩn cấp cần biết..."
          error={form.formState.errors.emergency_note?.message}
          {...form.register("emergency_note")}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Người liên hệ khẩn cấp</h3>
            <p className="text-sm text-muted-foreground">Cần ít nhất một liên hệ để hồ sơ đạt trạng thái sẵn sàng.</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => append(emptyContact())}>
            Thêm liên hệ
          </Button>
        </div>

        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-[var(--radius-panel)] border border-border bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Liên hệ {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (fields.length === 1) {
                      replace([emptyContact()]);
                      return;
                    }
                    remove(index);
                  }}
                >
                  Xóa
                </Button>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <TextInput
                  label="Tên"
                  placeholder="Sam Example"
                  error={form.formState.errors.emergency_contacts?.[index]?.name?.message}
                  {...form.register(`emergency_contacts.${index}.name` as const)}
                />
                <TextInput
                  label="Mối quan hệ"
                  placeholder="Bạn bè"
                  error={form.formState.errors.emergency_contacts?.[index]?.relationship?.message}
                  {...form.register(`emergency_contacts.${index}.relationship` as const)}
                />
                <TextInput
                  label="Số điện thoại"
                  placeholder="0901234567"
                  error={form.formState.errors.emergency_contacts?.[index]?.phone?.message}
                  {...form.register(`emergency_contacts.${index}.phone` as const)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button type="submit" size="lg" busy={saveMutation.isPending}>
          {saveMutation.isPending ? "Đang lưu..." : "Lưu hồ sơ"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={() => {
            const nextValues = profileViewToFormValues(profileView.profile);
            form.reset(nextValues);
            replace(nextValues.emergency_contacts);
            setRootMessage(null);
            setSuccessMessage(null);
          }}
        >
          Khôi phục
        </Button>
      </div>
    </form>
  );
}

function ProfilePageBody() {
  const { clearSessionCache } = useSession();
  const query = useQuery({
    queryKey: profileKeys.current,
    queryFn: ({ signal }) => getCurrentProfile(signal),
    staleTime: 15_000,
    retry: (failureCount, error) => {
      if (isApiError(error)) {
        return error.retryable && failureCount < 1;
      }
      return failureCount < 1;
    },
  });

  const isSessionExpired = isApiError(query.error) && query.error.status === 401;

  useEffect(() => {
    if (!isSessionExpired) {
      return;
    }
    clearSessionCache();
    assignLocation("/login?returnTo=/app/profile");
  }, [clearSessionCache, isSessionExpired]);

  if (query.isPending) {
    return <PageLoadingState title="Đang tải hồ sơ y tế" description="Kiểm tra trạng thái hồ sơ hiện tại của tài khoản." />;
  }

  if (query.error) {
    if (isSessionExpired) {
      return <PageLoadingState title="Đang chuyển hướng đến đăng nhập" description="Phiên đã hết hạn, bạn sẽ được đăng nhập lại an toàn." />;
    }
    if (isApiError(query.error) && (query.error.status === 503 || query.error.retryable)) {
      return <ServiceUnavailableState title="Không thể tải hồ sơ" description="Máy chủ tạm thời không phản hồi. Vui lòng thử lại sau." />;
    }
    return <RetryState title="Không thể tải hồ sơ" description="Đã xảy ra lỗi khi đọc hồ sơ y tế." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <Panel className="space-y-4">
        <ProfileEditor profileView={query.data} />
      </Panel>
      <ProfileReadinessPanel profileView={query.data} />
    </div>
  );
}

export function ProfilePageRoot() {
  return (
    <PageApplicationRoot
      role="user"
      brand={appBrand}
      title="Hồ sơ y tế"
      description="Cập nhật hồ sơ y tế cá nhân"
      navigation={userNavigation.map((item) => ({ ...item, current: item.href === "/app/profile" }))}
      userLabel={<StatusBadge variant="primary">Người dùng</StatusBadge>}
    >
      <ProfilePageBody />
    </PageApplicationRoot>
  );
}
