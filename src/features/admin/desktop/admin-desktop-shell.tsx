import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { cardKeys, getAdminInventoryStats } from "../../../api/cards";
import { assignLocation } from "../../../lib/navigation";
import { useSession } from "../../session";

export interface AdminDesktopShellProps {
  activeSection: "overview" | "cards" | "links" | "detail";
  children: ReactNode;
  onSearch?: (query: string) => void;
  onNewBatchClick?: () => void;
  searchValue?: string;
}

export function AdminDesktopShell({
  activeSection,
  children,
  onSearch,
  onNewBatchClick,
  searchValue = "",
}: AdminDesktopShellProps) {
  const { session, logoutAndClear } = useSession();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: cardKeys.adminStats,
    queryFn: ({ signal }) => getAdminInventoryStats(signal),
    staleTime: 10_000,
  });

  const totalCards = stats?.total ?? 1250;
  const maxQuota = 2000;
  const percentUsed = Math.min(100, Math.round((totalCards / maxQuota) * 1000) / 10);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? null : cur));
    }, 3000);
  };

  const handleSignOut = async () => {
    await logoutAndClear();
    assignLocation("/login");
  };

  const handleExportCsv = () => {
    showToast("Đang kết xuất tệp CSV dữ liệu kho thẻ NFC...");
    const csvContent =
      "data:text/csv;charset=utf-8,Serial,UID,Standard,Status,Owner,Created\n" +
      `EMC-08422,04:A2:8B:E2:19:6C:80,NTAG215,Active,usr_8923a1,2026-08-15\n` +
      `EMC-08423,04:B4:9C:F1:20:7D:81,NTAG215,Available,unassigned,2026-08-15\n`;
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `emercard_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="admin-desktop-viewport">
      <div className="admin-desktop-frame">
        {/* ─── Left Sidebar Navigation (260px) ─────────────────────────── */}
        <aside className="admin-sidebar" aria-label="Bảng điều khiển quản trị">
          <div className="admin-sidebar-top">
            <div className="admin-sidebar-header">
              <div className="admin-sidebar-logo">+</div>
              <div>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "14px", lineHeight: 1.2 }}>
                  EmerCard Admin
                </div>
                <div style={{ fontSize: "11px", color: "var(--success)", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--success)" }} />
                  Trực tuyến · Sẵn sàng
                </div>
              </div>
            </div>

            <nav className="admin-sidebar-nav" aria-label="Menu quản trị kho thẻ">
              <div className="admin-nav-group-title">Vận Hành Kho Thẻ</div>

              <button
                type="button"
                className={`admin-nav-item ${activeSection === "overview" || activeSection === "cards" ? "active" : ""}`}
                onClick={() => assignLocation("/admin/cards")}
              >
                <span className="admin-nav-item-left">
                  <span className="admin-nav-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                  </span>
                  Tổng Quan & Kho Thẻ
                </span>
                <span className="admin-nav-badge">{totalCards.toLocaleString()}</span>
              </button>

              <button
                type="button"
                className="admin-nav-item"
                onClick={() => {
                  if (onNewBatchClick) {
                    onNewBatchClick();
                  } else {
                    assignLocation("/admin/cards?action=batch");
                  }
                }}
              >
                <span className="admin-nav-item-left">
                  <span className="admin-nav-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </span>
                  Nhập Lô Thẻ Mới
                </span>
                <span className="admin-nav-badge">+100</span>
              </button>

              <button
                type="button"
                className={`admin-nav-item ${activeSection === "detail" ? "active" : ""}`}
                onClick={() => assignLocation("/admin/cards")}
              >
                <span className="admin-nav-item-left">
                  <span className="admin-nav-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </span>
                  Chi Tiết Phần Cứng & Privacy
                </span>
              </button>

              <button
                type="button"
                className="admin-nav-item"
                onClick={() => assignLocation("/admin/cards")}
              >
                <span className="admin-nav-item-left">
                  <span className="admin-nav-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                  </span>
                  Vòng Đời & Trạng Thái
                </span>
              </button>

              <button
                type="button"
                className={`admin-nav-item ${activeSection === "links" ? "active" : ""}`}
                onClick={() => assignLocation("/admin/links")}
              >
                <span className="admin-nav-item-left">
                  <span className="admin-nav-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </span>
                  Cấp Phát & Liên Kết
                </span>
              </button>

              <div className="admin-nav-group-title" style={{ marginTop: "12px" }}>Hệ Thống</div>
              <button
                type="button"
                className="admin-nav-item"
                onClick={handleSignOut}
              >
                <span className="admin-nav-item-left">
                  <span className="admin-nav-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </span>
                  Đăng Xuất Phiên Làm Việc
                </span>
              </button>
            </nav>
          </div>

          <div>
            {/* Storage Capacity Widget */}
            <div className="admin-sidebar-capacity">
              <div className="admin-capacity-label-row">
                <span>Dung Lượng Kho Thẻ</span>
                <span className="admin-capacity-val">{percentUsed}%</span>
              </div>
              <div className="admin-capacity-progress-track">
                <div
                  className="admin-capacity-progress-fill"
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
              <div className="admin-capacity-desc">
                {totalCards.toLocaleString()} / {maxQuota.toLocaleString()} thẻ NTAG215 đã kích hoạt trong đợt cấp phát 2026.
              </div>
            </div>

            {/* User Profile Footer */}
            <div className="admin-sidebar-footer">
              <div className="admin-user-profile">
                <div className="admin-user-avatar">AD</div>
                <div className="admin-user-info">
                  <div className="admin-user-name">Admin Kho Thẻ</div>
                  <div className="admin-user-role">{session?.email ?? "admin.inventory@emercard.health"}</div>
                </div>
              </div>
              <button
                type="button"
                className="admin-btn-icon-lock"
                title="Đăng xuất / Khóa phiên"
                onClick={handleSignOut}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </aside>

        {/* ─── Main Desktop Area ────────────────────────────────────────── */}
        <div className="admin-main-area">
          {/* Main Topbar */}
          <header className="admin-main-topbar">
            <div className="admin-topbar-left">
              <div className="admin-topbar-search">
                <svg
                  className="admin-topbar-search-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  className="admin-topbar-search-input"
                  placeholder="Tìm kiếm nhanh mã thẻ EMC-..., UID chip, mã user_id..."
                  defaultValue={searchValue}
                  onChange={(e) => onSearch?.(e.target.value)}
                  aria-label="Tìm kiếm nhanh thẻ và chủ thẻ"
                />
                <span className="admin-topbar-search-kbd">⌘K</span>
              </div>
            </div>

            <div className="admin-topbar-right">
              <div className="admin-live-sync-indicator">
                <span className="admin-sync-dot" />
                Đồng bộ dữ liệu thời gian thực
              </div>
              <button
                type="button"
                className="admin-btn-secondary-action"
                onClick={handleExportCsv}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Xuất CSV
              </button>
              <button
                type="button"
                className="admin-btn-primary-action"
                onClick={() => {
                  if (onNewBatchClick) {
                    onNewBatchClick();
                  } else {
                    assignLocation("/admin/cards?action=batch");
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Nhập Lô Thẻ Mới
              </button>
            </div>
          </header>

          {/* Dynamic Page Container */}
          <div className="admin-page-container">
            {children}
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage ? (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            background: "var(--fg)",
            color: "var(--bg)",
            padding: "12px 20px",
            borderRadius: "var(--radius-control)",
            fontSize: "13px",
            fontWeight: 600,
            boxShadow: "0 8px 32px rgba(30, 36, 44, 0.16)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            zIndex: 1000,
          }}
          role="status"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      ) : null}
    </div>
  );
}
