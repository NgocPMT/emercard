import React, { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Textarea,
  TextInput,
} from "../../components/primitives";
import {
  authorizePrivateProfileWrite,
  type PrivateProfileEnvelope,
} from "../../api/profile";
import {
  createPrivateProfileEnvelope,
  decryptPrivateProfileWithAccessCode,
  decryptPrivateProfileWithRecoveryKey,
  replacePrivateProfilePayload,
  resetAccessCodeWithRecoveryKey,
  resetRecoveryKeyWithAccessCode,
  type PrivateProfilePayload,
} from "../../lib/private-profile-crypto";

const emptyPayload: PrivateProfilePayload = {
  address: "",
  citizen_id: "",
  sensitive_conditions: [],
};

export type PendingChange = {
  envelope: PrivateProfileEnvelope | null;
  authorizationToken: string;
  ready: boolean;
};

type PrivateProfilePanelProps = {
  profileId: string;
  envelope: PrivateProfileEnvelope | null | undefined;
  onPendingChange: (change: PendingChange) => void;
};

type RecoveryNotice = {
  key: string;
  envelope: PrivateProfileEnvelope;
  authorizationToken: string;
};

function linesToConditions(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function conditionsToLines(values: string[]) {
  return values.join("\n");
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText)
    await navigator.clipboard.writeText(value);
}

function downloadRecoveryKey(value: string) {
  const blob = new Blob([`${value}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "emercard-recovery-key.txt";
  link.click();
  URL.revokeObjectURL(url);
}

export function PrivateProfilePanel({
  profileId,
  envelope,
  onPendingChange,
}: PrivateProfilePanelProps) {
  const [currentEnvelope, setCurrentEnvelope] =
    useState<PrivateProfileEnvelope | null>(envelope ?? null);
  const [accessCode, setAccessCode] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [newAccessCode, setNewAccessCode] = useState("");
  const [newAccessCodeConfirmation, setNewAccessCodeConfirmation] =
    useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [payload, setPayload] = useState<PrivateProfilePayload>(emptyPayload);
  const [unlocked, setUnlocked] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryNotice, setRecoveryNotice] = useState<RecoveryNotice | null>(
    null,
  );
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentEnvelope(envelope ?? null);
    setAccessCode("");
    setRecoveryKey("");
    setNewAccessCode("");
    setNewAccessCodeConfirmation("");
    setAccountPassword("");
    setPayload(emptyPayload);
    setUnlocked(false);
    setRecoveryMode(false);
    setRecoveryNotice(null);
    setRecoveryAcknowledged(false);
    setMessage(null);
    setError(null);
  }, [envelope, profileId]);

  const authorize = async () => {
    if (!accountPassword) throw new Error("Mật khẩu tài khoản là bắt buộc.");
    const result = await authorizePrivateProfileWrite(accountPassword);
    setAccountPassword("");
    return result.authorization_token;
  };

  const showError = (value: unknown) => {
    const localMessages = [
      "Mật khẩu tài khoản là bắt buộc.",
      "Mã truy cập phải có ít nhất 10 ký tự.",
      "Mã truy cập mới phải có ít nhất 10 ký tự.",
      "Hai mã truy cập không khớp.",
      "Hồ sơ chưa sẵn sàng.",
    ];
    const localMessage =
      value instanceof Error && localMessages.includes(value.message)
        ? value.message
        : null;
    setError(
      localMessage ??
        "Không thể cập nhật thông tin riêng tư. Vui lòng kiểm tra lại dữ liệu và thử lại.",
    );
    setMessage(null);
  };

  const handleSetup = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (!profileId) throw new Error("Hồ sơ chưa sẵn sàng.");
      if (accessCode.length < 10)
        throw new Error("Mã truy cập phải có ít nhất 10 ký tự.");
      if (accessCode !== newAccessCode)
        throw new Error("Hai mã truy cập không khớp.");
      const created = await createPrivateProfileEnvelope(
        profileId,
        accessCode,
        payload,
      );
      const authorizationToken = await authorize();
      setCurrentEnvelope(created.envelope);
      onPendingChange({
        envelope: created.envelope,
        authorizationToken,
        ready: false,
      });
      setUnlocked(true);
      setRecoveryNotice({
        key: created.recoveryKey,
        envelope: created.envelope,
        authorizationToken,
      });
      setRecoveryAcknowledged(false);
      setMessage("Hãy lưu khóa khôi phục trước khi nhấn Lưu hồ sơ.");
    } catch (value) {
      showError(value);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    if (!currentEnvelope) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const decrypted = await decryptPrivateProfileWithAccessCode(
        currentEnvelope,
        profileId,
        accessCode,
      );
      setPayload(decrypted);
      setUnlocked(true);
      setRecoveryMode(false);
      setMessage("Đã mở khóa cục bộ. Mã truy cập không được gửi lên máy chủ.");
    } catch (value) {
      showError(value);
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    if (!currentEnvelope) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const replacement = await replacePrivateProfilePayload(
        currentEnvelope,
        profileId,
        accessCode,
        payload,
      );
      const authorizationToken = await authorize();
      setCurrentEnvelope(replacement);
      onPendingChange({
        envelope: replacement,
        authorizationToken,
        ready: true,
      });
      setMessage(
        "Thông tin riêng tư đã được mã hóa cục bộ. Nhấn Lưu hồ sơ để hoàn tất.",
      );
    } catch (value) {
      showError(value);
    } finally {
      setBusy(false);
    }
  };

  const handleRecoveryReset = async () => {
    if (!currentEnvelope) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (newAccessCode.length < 10)
        throw new Error("Mã truy cập mới phải có ít nhất 10 ký tự.");
      if (newAccessCode !== newAccessCodeConfirmation)
        throw new Error("Hai mã truy cập không khớp.");
      const replacement = await resetAccessCodeWithRecoveryKey(
        currentEnvelope,
        profileId,
        recoveryKey,
        newAccessCode,
      );
      const authorizationToken = await authorize();
      const decrypted = await decryptPrivateProfileWithAccessCode(
        replacement,
        profileId,
        newAccessCode,
      );
      setCurrentEnvelope(replacement);
      setPayload(decrypted);
      setAccessCode(newAccessCode);
      setRecoveryMode(false);
      setUnlocked(true);
      onPendingChange({
        envelope: replacement,
        authorizationToken,
        ready: true,
      });
      setNewAccessCode("");
      setNewAccessCodeConfirmation("");
      setRecoveryKey("");
      setMessage("Mã truy cập đã được thay thế. Nhấn Lưu hồ sơ để hoàn tất.");
    } catch (value) {
      showError(value);
    } finally {
      setBusy(false);
    }
  };

  const handleRecoveryRotation = async () => {
    if (!currentEnvelope) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const replacement = await resetRecoveryKeyWithAccessCode(
        currentEnvelope,
        profileId,
        accessCode,
      );
      const authorizationToken = await authorize();
      setCurrentEnvelope(replacement.envelope);
      onPendingChange({
        envelope: replacement.envelope,
        authorizationToken,
        ready: false,
      });
      setRecoveryNotice({
        key: replacement.recoveryKey,
        envelope: replacement.envelope,
        authorizationToken,
      });
      setRecoveryAcknowledged(false);
      setMessage("Khóa khôi phục mới chỉ được hiển thị một lần.");
    } catch (value) {
      showError(value);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (
      !window.confirm(
        "Xóa vĩnh viễn toàn bộ thông tin riêng tư? Nếu không còn bản sao khóa khôi phục, dữ liệu sẽ không thể khôi phục.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const authorizationToken = await authorize();
      setCurrentEnvelope(null);
      setUnlocked(false);
      setPayload(emptyPayload);
      onPendingChange({ envelope: null, authorizationToken, ready: true });
      setMessage("Thông tin riêng tư sẽ bị xóa khi bạn nhấn Lưu hồ sơ.");
    } catch (value) {
      showError(value);
    } finally {
      setBusy(false);
    }
  };

  const acknowledgeRecoveryKey = () => {
    setRecoveryAcknowledged(true);
    if (recoveryNotice) {
      onPendingChange({
        envelope: recoveryNotice.envelope,
        authorizationToken: recoveryNotice.authorizationToken,
        ready: true,
      });
    }
    setMessage(
      "Đã xác nhận đã lưu khóa khôi phục. Nhấn Lưu hồ sơ để hoàn tất.",
    );
  };

  if (!profileId) {
    return (
      <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-muted/20 p-5">
        <h3 className="text-lg font-semibold text-foreground">
          Thông tin riêng tư mã hóa
        </h3>
        <p className="text-sm text-muted-foreground">
          Lưu hồ sơ công khai trước khi thiết lập thông tin riêng tư.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-[var(--radius-panel)] border border-primary/20 bg-primary/5 p-5">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          Thông tin riêng tư mã hóa
        </h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Địa chỉ, CCCD và tình trạng nhạy cảm được mã hóa ngay trong trình
          duyệt. Máy chủ chỉ nhận dữ liệu mã hóa; mã truy cập và khóa khôi phục
          không bao giờ được gửi đi.
        </p>
      </div>

      {error ? (
        <Alert variant="danger" title="Không thể cập nhật thông tin riêng tư">
          {error}
        </Alert>
      ) : null}
      {message ? (
        <Alert variant="info" title="Thông tin riêng tư">
          {message}
        </Alert>
      ) : null}

      {!currentEnvelope ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">
            Thiết lập lần đầu
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <TextInput
              label="Mã truy cập"
              type="password"
              autoComplete="new-password"
              hint="Tối thiểu 10 ký tự, không dùng mật khẩu đăng nhập tài khoản."
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
            />
            <TextInput
              label="Nhập lại mã truy cập"
              type="password"
              autoComplete="new-password"
              value={newAccessCode}
              onChange={(event) => setNewAccessCode(event.target.value)}
            />
          </div>
          <PrivateFields payload={payload} onChange={setPayload} />
          <TextInput
            label="Mật khẩu tài khoản để xác nhận"
            type="password"
            autoComplete="current-password"
            hint="Chỉ dùng để xác nhận thao tác với tài khoản, không dùng để mã hóa."
            value={accountPassword}
            onChange={(event) => setAccountPassword(event.target.value)}
          />
          <Button type="button" busy={busy} onClick={() => void handleSetup()}>
            Tạo thông tin riêng tư
          </Button>
        </div>
      ) : null}

      {currentEnvelope && !unlocked && !recoveryMode ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">
            Thông tin riêng tư đang bị khóa
          </p>
          <TextInput
            label="Mã truy cập"
            type="password"
            autoComplete="off"
            value={accessCode}
            onChange={(event) => setAccessCode(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              busy={busy}
              onClick={() => void handleUnlock()}
            >
              Mở khóa
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setRecoveryMode(true);
                setError(null);
              }}
            >
              Dùng khóa khôi phục
            </Button>
          </div>
        </div>
      ) : null}

      {currentEnvelope && recoveryMode ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">
            Khôi phục mã truy cập
          </p>
          <TextInput
            label="Khóa khôi phục"
            type="password"
            autoComplete="off"
            hint="Khóa này có thể mở khóa dữ liệu. Không nhập vào nơi khác ngoài trình duyệt tin cậy."
            value={recoveryKey}
            onChange={(event) => setRecoveryKey(event.target.value)}
          />
          <TextInput
            label="Mã truy cập mới"
            type="password"
            autoComplete="new-password"
            hint="Tối thiểu 10 ký tự."
            value={newAccessCode}
            onChange={(event) => setNewAccessCode(event.target.value)}
          />
          <TextInput
            label="Xác nhận mã truy cập mới"
            type="password"
            autoComplete="new-password"
            value={newAccessCodeConfirmation}
            onChange={(event) =>
              setNewAccessCodeConfirmation(event.target.value)
            }
          />
          <TextInput
            label="Mật khẩu tài khoản để xác nhận"
            type="password"
            autoComplete="current-password"
            value={accountPassword}
            onChange={(event) => setAccountPassword(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              busy={busy}
              onClick={() => void handleRecoveryReset()}
            >
              Đặt lại mã truy cập
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setRecoveryMode(false)}
            >
              Quay lại
            </Button>
          </div>
        </div>
      ) : null}

      {currentEnvelope && unlocked ? (
        <div className="space-y-4">
          <PrivateFields payload={payload} onChange={setPayload} />
          <TextInput
            label="Mật khẩu tài khoản để xác nhận thay đổi"
            type="password"
            autoComplete="current-password"
            hint="Mã truy cập đã mở khóa dữ liệu cục bộ; mật khẩu này chỉ xác nhận việc lưu envelope mới."
            value={accountPassword}
            onChange={(event) => setAccountPassword(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" busy={busy} onClick={() => void handleSave()}>
              Mã hóa thay đổi
            </Button>
            <Button
              type="button"
              variant="secondary"
              busy={busy}
              onClick={() => void handleRecoveryRotation()}
            >
              Tạo khóa khôi phục mới
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setUnlocked(false);
                setAccessCode("");
                setPayload(emptyPayload);
              }}
            >
              Khóa lại
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void handleRemove()}
            >
              Xóa dữ liệu riêng tư
            </Button>
          </div>
        </div>
      ) : null}

      {recoveryNotice ? (
        <div
          className="space-y-4 rounded-[1rem] border border-warning/40 bg-warning/10 p-4"
          data-testid="recovery-key-notice"
        >
          <div>
            <h4 className="font-semibold text-foreground">
              Lưu khóa khôi phục ngay — chỉ hiển thị một lần
            </h4>
            <p className="mt-1 text-sm text-muted-foreground">
              Bất kỳ ai có khóa này và envelope công khai đều có thể giải mã
              thông tin riêng tư. EmerCard không lưu bản sao khóa.
            </p>
          </div>
          <code className="block break-all rounded-lg bg-white px-3 py-3 text-sm font-bold tracking-[0.12em] text-foreground">
            {recoveryNotice.key}
          </code>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void copyText(recoveryNotice.key)}
            >
              Sao chép
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => downloadRecoveryKey(recoveryNotice.key)}
            >
              Tải xuống
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => window.print()}
            >
              In
            </Button>
          </div>
          <Checkbox
            label="Tôi đã lưu khóa khôi phục ở nơi an toàn và hiểu rằng khóa này có thể mở khóa dữ liệu."
            checked={recoveryAcknowledged}
            onChange={acknowledgeRecoveryKey}
          />
        </div>
      ) : null}
    </section>
  );
}

function PrivateFields({
  payload,
  onChange,
}: {
  payload: PrivateProfilePayload;
  onChange: (payload: PrivateProfilePayload) => void;
}) {
  return (
    <div className="space-y-4">
      <TextInput
        label="Địa chỉ"
        autoComplete="street-address"
        value={payload.address}
        onChange={(event) =>
          onChange({ ...payload, address: event.target.value })
        }
      />
      <TextInput
        label="CCCD / mã định danh công dân"
        autoComplete="off"
        value={payload.citizen_id}
        onChange={(event) =>
          onChange({ ...payload, citizen_id: event.target.value })
        }
      />
      <Textarea
        label="Tình trạng nhạy cảm"
        hint="Mỗi dòng là một tình trạng muốn chia sẻ trong trường hợp khẩn cấp."
        value={conditionsToLines(payload.sensitive_conditions)}
        onChange={(event) =>
          onChange({
            ...payload,
            sensitive_conditions: linesToConditions(event.target.value),
          })
        }
      />
    </div>
  );
}
