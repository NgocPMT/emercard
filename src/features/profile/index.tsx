import React, { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm, type FieldPath, type UseFormSetError, type UseFormSetFocus } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Panel, Select, StatusBadge, Textarea, TextInput } from "../../components/primitives";
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
import { PrivateProfilePanel, type PendingChange } from "./PrivateProfilePanel";

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
  email: string;
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
  location_alerts_enabled: boolean;
  emergency_contacts: ProfileContactRow[];
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const emptyContact = (): ProfileContactRow => ({ name: "", relationship: "", phone: "", email: "" });

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
    location_alerts_enabled: profile?.location_alerts_enabled ?? false,
    emergency_contacts:
      profile?.emergency_contacts.length && profile.emergency_contacts.length > 0
        ? profile.emergency_contacts.map((contact) => ({
            name: contact.name,
            relationship: contact.relationship,
            phone: contact.phone,
            email: contact.email ?? "",
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
    location_alerts_enabled: values.location_alerts_enabled,
    emergency_contacts: values.emergency_contacts
      .map((contact) => ({
        name: contact.name.trim(),
        relationship: contact.relationship.trim(),
        phone: contact.phone.trim(),
        email: contact.email.trim() === "" ? null : contact.email.trim().toLowerCase(),
      }))
      .filter((contact) => contact.name || contact.relationship || contact.phone || contact.email),
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
          {contact.email ? <p className="text-sm text-muted-foreground">Email cảnh báo: {contact.email}</p> : null}
        </li>
      ))}
    </ul>
  );
}

function ProfileViewCard({ profileView, onEdit }: { profileView: ProfileView; onEdit: () => void }) {
  const profile = profileView.profile;
  const contacts = profile?.emergency_contacts ?? [];
  const allergies = profile?.critical_allergies ?? [];
  const conditions = profile?.important_conditions ?? [];
  const medications = profile?.critical_medications ?? [];

  return (
    <div className="w-full max-w-[420px] mx-auto py-6" data-od-id="board-profile-view">
      {/* Top Bar with Mode Indicator */}
      <div className="app-top-header rounded-t-[18px]">
        <div className="app-brand">
          <div className="brand-mark">+</div>
          <span className="brand-name">Hồ Sơ Cứu Sinh</span>
        </div>
        <span className="portal-tag">Chế độ xem trước</span>
      </div>

      <div className="screen-content bg-white border border-[#d3d9e0] border-t-0 rounded-b-[18px] p-5 sm:p-6 shadow-[0_4px_20px_rgba(30,36,44,0.06)] flex flex-col gap-4">
        <div className="flex items-center justify-between text-xs text-[#64748b] border-b border-[#e2e8f0] pb-2">
          <h3 className="font-semibold text-[#1e242c] text-sm">Xem trước trang khẩn cấp</h3>
          <span>Chỉ xem trong ứng dụng, không tạo liên kết.</span>
        </div>

        {/* Hero Identity with Right-Aligned 2-Line Blood Type */}
        <div className="profile-hero-row">
          <div className="patient-identity">
            <h2 className="patient-name">{previewValue(profile?.display_name, "Nguyen Van A")}</h2>
            <span className="patient-meta">
              {profile?.birth_year ? `Năm sinh ${profile.birth_year}` : "Năm sinh chưa rõ"}
              {" • Giới tính "}
              {genderLabel(profile?.gender)}
            </span>
          </div>

          {/* Blood Type Block: 2 lines right aligned */}
          <div className="blood-type-block">
            <span className="blood-type-caption">Nhóm máu</span>
            <span className="blood-type-val">{bloodTypeLabel(profile?.blood_type)}</span>
          </div>
        </div>

        {/* Medical Cards */}
        <dl className="flex flex-col gap-3 m-0">
          <div className="med-card med-card-danger">
            <div className="med-label">
              <dt className="inline">Dị ứng quan trọng</dt>
              <span className="status-pill status-pill-danger">Nguy cơ sốc</span>
            </div>
            <dd className="med-val m-0">{allergies.length > 0 ? allergies.join(", ") : "Chưa ghi nhận"}</dd>
          </div>

          <div className="med-card med-card-warning">
            <div className="med-label">
              <dt className="inline">Tình trạng bệnh quan trọng</dt>
              <span className="status-pill status-pill-warning">Bệnh nền</span>
            </div>
            <dd className="med-val m-0">{conditions.length > 0 ? conditions.join(", ") : "Chưa ghi nhận"}</dd>
          </div>

          <div className="med-card">
            <div className="med-label">
              <dt className="inline">Thuốc đang sử dụng</dt>
            </div>
            <dd className="med-val m-0">{medications.length > 0 ? medications.join(", ") : "Chưa ghi nhận"}</dd>
          </div>

          <div className="med-card">
            <div className="med-label">
              <dt className="inline">Ghi chú khẩn cấp &amp; Chỉ thị</dt>
            </div>
            <dd className="med-val m-0">{previewValue(profile?.emergency_note, "Chưa có ghi chú")}</dd>
          </div>
        </dl>

        {/* Emergency Contacts Section */}
        <div className="contact-container">
          <div className="contact-section-title">
            <span>Người Liên Hệ Khẩn Cấp ({contacts.length})</span>
            <span style={{ fontSize: "11px", color: "var(--muted)", fontWeight: "normal" }}>Ưu tiên gọi tự động</span>
          </div>

          {contacts.length > 0 ? (
            contacts.map((contact, idx) => (
              <div key={idx} className="contact-inner-card">
                <div className="contact-details">
                  <div className="contact-name">{contact.name}</div>
                  <span className="contact-relation">Mối quan hệ: {contact.relationship}</span>
                </div>
                <span className="contact-phone-mono">{contact.phone}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-[#64748b]">Chưa có người liên hệ khẩn cấp.</p>
          )}
        </div>

        {/* Primary CTA Button */}
        <button type="button" className="btn-primary mt-1" onClick={onEdit}>
          Chỉnh Sửa Hồ Sơ Y Tế
        </button>
      </div>
    </div>
  );
}

function ProfileEditorCard({ profileView, onCancel }: { profileView: ProfileView; onCancel: () => void }) {
  const { clearSessionCache } = useSession();
  const queryClient = useQueryClient();
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [privatePendingChange, setPrivatePendingChange] = useState<PendingChange | null>(null);

  const [newAllergy, setNewAllergy] = useState("");
  const [newCondition, setNewCondition] = useState("");
  const [newMedName, setNewMedName] = useState("");
  const [newMedDosage, setNewMedDosage] = useState("");

  const formDefaults = useMemo(() => profileViewToFormValues(profileView.profile), [profileView.profile]);
  const form = useForm<ProfileFormValues>({
    defaultValues: formDefaults,
    mode: "onSubmit",
  });
  const { fields, append, remove, replace } = useFieldArray({ control: form.control, name: "emergency_contacts" });
  const saveMutation = useMutation({
    mutationFn: (payload: ProfileUpsertInput) => saveCurrentProfile(payload, undefined, privatePendingChange?.authorizationToken),
  });

  useEffect(() => {
    form.reset(formDefaults);
    replace(formDefaults.emergency_contacts);
    setRootMessage(null);
    setSuccessMessage(null);
    setPrivatePendingChange(null);
  }, [form, formDefaults, replace]);

  const selectedBloodType = form.watch("blood_type");
  const allergiesList = splitLines(form.watch("critical_allergies") || "");
  const conditionsList = splitLines(form.watch("important_conditions") || "");
  const medicationsList = splitLines(form.watch("critical_medications") || "");

  const handleAddAllergy = () => {
    if (!newAllergy.trim()) return;
    const updated = [...allergiesList, newAllergy.trim()];
    form.setValue("critical_allergies", updated.join("\n"), { shouldDirty: true });
    setNewAllergy("");
  };

  const handleRemoveAllergy = (index: number) => {
    const updated = allergiesList.filter((_, idx) => idx !== index);
    form.setValue("critical_allergies", updated.join("\n"), { shouldDirty: true });
  };

  const handleAddCondition = () => {
    if (!newCondition.trim()) return;
    const updated = [...conditionsList, newCondition.trim()];
    form.setValue("important_conditions", updated.join("\n"), { shouldDirty: true });
    setNewCondition("");
  };

  const handleRemoveCondition = (index: number) => {
    const updated = conditionsList.filter((_, idx) => idx !== index);
    form.setValue("important_conditions", updated.join("\n"), { shouldDirty: true });
  };

  const handleAddMedication = () => {
    if (!newMedName.trim()) return;
    const entry = newMedDosage.trim() ? `${newMedName.trim()} (${newMedDosage.trim()})` : newMedName.trim();
    const updated = [...medicationsList, entry];
    form.setValue("critical_medications", updated.join("\n"), { shouldDirty: true });
    setNewMedName("");
    setNewMedDosage("");
  };

  const handleRemoveMedication = (index: number) => {
    const updated = medicationsList.filter((_, idx) => idx !== index);
    form.setValue("critical_medications", updated.join("\n"), { shouldDirty: true });
  };

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
      if (privatePendingChange && !privatePendingChange.ready) {
        setRootMessage("Hãy xác nhận đã lưu khóa khôi phục trước khi lưu hồ sơ.");
        return;
      }
      const payload = profileFormValuesToPayload(values);
      if (privatePendingChange) {
        payload.private_profile_envelope = privatePendingChange.envelope;
      }
      const saved = await saveMutation.mutateAsync(payload);
      queryClient.setQueryData(profileKeys.current, saved);
      const nextValues = profileViewToFormValues(saved.profile);
      form.reset(nextValues);
      replace(nextValues.emergency_contacts);
      setPrivatePendingChange(null);
      setSuccessMessage("Lưu hồ sơ thành công! Dữ liệu đã đồng bộ lập tức lên thẻ NFC.");
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

  const bloodTypes = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

  return (
    <div className="w-full max-w-[420px] mx-auto py-6" data-od-id="board-profile-edit">
      {/* Top Header */}
      <div className="app-top-header rounded-t-[18px]">
        <div className="app-brand">
          <div className="brand-mark">+</div>
          <span className="brand-name">Chỉnh Sửa Hồ Sơ</span>
        </div>
        <button type="button" className="link-subtle" onClick={onCancel}>
          Hủy
        </button>
      </div>

      <div className="screen-content bg-white border border-[#d3d9e0] border-t-0 rounded-b-[18px] p-5 sm:p-6 shadow-[0_4px_20px_rgba(30,36,44,0.06)] flex flex-col gap-4">
        {rootMessage ? (
          <Alert variant="danger" title="Không thể lưu hồ sơ">
            {rootMessage}
          </Alert>
        ) : null}

        <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4" noValidate>
          {/* Identity Fields */}
          <div className="field-group">
            <label className="field-label" htmlFor="edit-name">Họ và tên</label>
            <input
              id="edit-name"
              type="text"
              className="input-text"
              placeholder="Nguyen Van A"
              {...form.register("display_name")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="field-group">
              <label className="field-label" htmlFor="edit-year">Năm sinh</label>
              <input
                id="edit-year"
                type="text"
                inputMode="numeric"
                className="input-text"
                placeholder="1995"
                {...form.register("birth_year")}
              />
            </div>
            <div className="field-group">
              <label className="field-label" htmlFor="edit-gender">Giới tính</label>
              <select id="edit-gender" className="input-text" {...form.register("gender")}>
                <option value="">Chọn giới tính</option>
                {genderOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Blood Type Selector Grid */}
          <div className="field-group">
            <label className="field-label">Chọn Nhóm Máu</label>
            <div className="blood-selector-grid">
              {bloodTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`blood-option-btn ${selectedBloodType === type ? "active" : ""}`}
                  onClick={() => form.setValue("blood_type", type, { shouldDirty: true, shouldValidate: true })}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Allergies Tag Management */}
          <div className="field-group">
            <label className="field-label">Dị Ứng Quan Trọng</label>
            <div className="tag-cloud-wrap">
              {allergiesList.map((tag, idx) => (
                <span key={idx} className="removable-tag">
                  {tag}{" "}
                  <button type="button" className="removable-tag-btn" onClick={() => handleRemoveAllergy(idx)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="add-tag-row">
              <input
                type="text"
                className="input-text"
                placeholder="Thêm dị ứng mới (VD: Đậu phộng)..."
                value={newAllergy}
                onChange={(e) => setNewAllergy(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAllergy();
                  }
                }}
              />
              <button type="button" className="btn-add-tag" onClick={handleAddAllergy}>
                + Thêm
              </button>
            </div>
          </div>

          {/* Chronic Conditions Tag Management */}
          <div className="field-group">
            <label className="field-label">Bệnh Lý Mãn Tính</label>
            <div className="tag-cloud-wrap">
              {conditionsList.map((tag, idx) => (
                <span key={idx} className="removable-tag">
                  {tag}{" "}
                  <button type="button" className="removable-tag-btn" onClick={() => handleRemoveCondition(idx)}>
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="add-tag-row">
              <input
                type="text"
                className="input-text"
                placeholder="Thêm bệnh lý mới (VD: Hen suyễn)..."
                value={newCondition}
                onChange={(e) => setNewCondition(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCondition();
                  }
                }}
              />
              <button type="button" className="btn-add-tag" onClick={handleAddCondition}>
                + Thêm
              </button>
            </div>
          </div>

          {/* Active Medications Cards */}
          <div className="field-group">
            <label className="field-label">Thuốc Đang Sử Dụng</label>
            <div className="flex flex-col gap-2">
              {medicationsList.map((med, idx) => (
                <div key={idx} className="med-edit-card">
                  <div className="med-edit-header">
                    <span className="med-edit-title">{med}</span>
                    <button type="button" className="btn-remove-item" onClick={() => handleRemoveMedication(idx)}>
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="add-tag-row mt-1">
              <input
                type="text"
                className="input-text"
                placeholder="Tên thuốc..."
                value={newMedName}
                onChange={(e) => setNewMedName(e.target.value)}
              />
              <input
                type="text"
                className="input-text"
                placeholder="Liều lượng (VD: 5mg/ngày)..."
                value={newMedDosage}
                onChange={(e) => setNewMedDosage(e.target.value)}
              />
              <button type="button" className="btn-add-tag" onClick={handleAddMedication}>
                + Thêm
              </button>
            </div>
          </div>

          {/* Emergency Contacts Edit */}
          <div className="field-group">
            <div className="flex items-center justify-between mb-1">
              <label className="field-label m-0">Người Liên Hệ Khẩn Cấp</label>
              <button
                type="button"
                className="link-subtle text-xs"
                onClick={() => append(emptyContact())}
              >
                + Thêm người thân
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {fields.map((field, index) => (
                <div key={field.id} className="med-edit-card">
                  <div className="med-edit-header">
                    <span className="med-edit-title">Người liên hệ {index + 1} {index === 0 ? "(Ưu tiên chính)" : ""}</span>
                    {fields.length > 1 ? (
                      <button type="button" className="btn-remove-item" onClick={() => remove(index)}>
                        Xóa
                      </button>
                    ) : null}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      className="input-text"
                      placeholder="Họ tên"
                      {...form.register(`emergency_contacts.${index}.name` as const)}
                    />
                    <input
                      type="text"
                      className="input-text"
                      placeholder="Mối quan hệ"
                      {...form.register(`emergency_contacts.${index}.relationship` as const)}
                    />
                  </div>
                  <input
                    type="tel"
                    className="input-text input-mono"
                    placeholder="Số điện thoại"
                    {...form.register(`emergency_contacts.${index}.phone` as const)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Success Notification Toast */}
          <div className={`toast-success-banner ${successMessage ? "show" : ""}`} id="saveSuccessToast">
            <svg style={{ width: "18px", height: "18px", fill: "var(--accent)", flexShrink: 0 }} viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
            <div>
              <div style={{ fontWeight: 600 }}>Lưu hồ sơ thành công!</div>
              <div style={{ fontSize: "11px", color: "var(--muted)" }}>Dữ liệu đã đồng bộ lập tức lên thẻ NFC.</div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="btn-primary"
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? "Đang lưu..." : "Lưu Thay Đổi"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              style={{ width: "auto", padding: "11px 18px" }}
              onClick={onCancel}
            >
              Hủy Bỏ
            </button>
          </div>

          <PrivateProfilePanel
            profileId={profileView.profile?.profile_id ?? ""}
            envelope={profileView.profile?.private_profile_envelope}
            onPendingChange={setPrivatePendingChange}
          />
        </form>
      </div>
    </div>
  );
}

function ProfilePageBody() {
  const { clearSessionCache } = useSession();
  const [isEditing, setIsEditing] = useState(false);
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

  return isEditing ? (
    <ProfileEditorCard profileView={query.data} onCancel={() => setIsEditing(false)} />
  ) : (
    <ProfileViewCard profileView={query.data} onEdit={() => setIsEditing(true)} />
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
