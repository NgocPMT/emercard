import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Alert, Button, Panel } from "../../components/primitives";

type ProfileLinkQrLabelProps = {
  url: string;
  label?: string | null;
};

export function ProfileLinkQrLabel({ url, label }: ProfileLinkQrLabelProps) {
  const [svgMarkup, setSvgMarkup] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSvgMarkup(null);
    setError(null);

    void QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "H",
      margin: 4,
      width: 280,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((markup) => {
        if (cancelled) return;
        setSvgMarkup(markup);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Không thể tạo mã QR. Vui lòng thử lại liên kết.");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <Panel
      className="profile-link-qr-print-root space-y-4"
      aria-label="Nhãn mã QR liên kết hồ sơ"
    >
      <div className="profile-link-qr-label space-y-3">
        <div>
          <p className="eyebrow">EmerCard</p>
          <h3 className="text-xl font-semibold text-foreground">
            Mã QR hồ sơ khẩn cấp
          </h3>
          <p className="text-sm text-muted-foreground">
            {label
              ? `Nhãn: ${label}`
              : "Gắn nhãn này vào thẻ vật lý sau khi mã hóa."}
          </p>
        </div>
        {svgMarkup ? (
          <div
            className="profile-link-qr-code mx-auto w-fit border-4 border-white bg-white p-2"
            role="img"
            aria-label="Mã QR tĩnh cho liên kết hồ sơ khẩn cấp"
            dangerouslySetInnerHTML={{ __html: svgMarkup }}
          />
        ) : error ? (
          <Alert variant="danger" title="Không tạo được mã QR">
            {error}
          </Alert>
        ) : (
          <div
            className="profile-link-qr-loading"
            role="status"
            aria-live="polite"
          >
            Đang tạo mã QR...
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Đây là mã QR tĩnh chứa liên kết truy cập một lần. Không chia sẻ hoặc
          để lộ nhãn này ngoài mục đích gắn vào thẻ.
        </p>
      </div>
      <div className="profile-link-qr-actions flex flex-wrap gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={!svgMarkup}
          onClick={() => window.print()}
        >
          In nhãn mã QR
        </Button>
      </div>
    </Panel>
  );
}
