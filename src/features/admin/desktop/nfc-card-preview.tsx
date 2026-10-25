import React from "react";

export interface NfcCardPreviewProps {
  serialRange?: string;
  countLabel?: string;
  chipType?: string;
  standard?: string;
  className?: string;
}

export function NfcCardPreview({
  serialRange = "EMC-12001 → EMC-12100",
  countLabel = "Quy mô: 100 phôi thẻ liên tiếp",
  chipType = "NXP NTAG215 (504 Bytes)",
  standard = "ISO/IEC 14443-A · NTAG215",
  className = "",
}: NfcCardPreviewProps) {
  return (
    <div className={`admin-nfc-card-preview ${className}`} aria-label="Mô phỏng phôi thẻ NFC">
      <div className="admin-nfc-card-top">
        <div className="admin-nfc-card-brand">
          <span style={{ color: "var(--accent)", fontSize: "20px", fontWeight: 700 }}>+</span>
          <span>EmerCard</span>
        </div>
        <div className="admin-nfc-card-chip" aria-hidden="true">
          <div
            style={{
              width: "16px",
              height: "12px",
              border: "1px solid rgba(0, 0, 0, 0.2)",
              borderRadius: "2px",
            }}
          />
        </div>
      </div>

      <div className="admin-nfc-card-mid">
        <div className="admin-nfc-card-type">DẢI MÃ SERIAL TỰ SINH</div>
        <div className="admin-nfc-card-serial">{serialRange}</div>
        <div className="admin-nfc-card-range-badge">{countLabel}</div>
      </div>

      <div className="admin-nfc-card-bottom">
        <div className="admin-nfc-card-meta">
          <span className="admin-nfc-card-type">CHUẨN KỸ THUẬT</span>
          <span className="admin-nfc-card-spec">{standard}</span>
        </div>
        <svg
          className="admin-nfc-signal-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M5 12.55a11 11 0 0 1 14.08 0" />
          <path d="M1.42 9a16 16 0 0 1 21.16 0" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
    </div>
  );
}
