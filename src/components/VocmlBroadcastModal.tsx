"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  BellRing, 
  Info, 
  AlertTriangle, 
  AlertOctagon, 
  Clock, 
  X, 
  CheckCircle2, 
  Sparkles 
} from "lucide-react";

export interface VocmlMessage {
  id: number | string;
  title: string;
  message: string;
  type?: "info" | "warning" | "urgent" | "danger" | string;
  interval_minutes?: number;
  display_seconds?: number;
  updated_at?: string;
}

export default function VocmlBroadcastModal() {
  const [activeMessage, setActiveMessage] = useState<VocmlMessage | null>(null);
  const [countdown, setCountdown] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  async function checkMessages() {
    try {
      const res = await fetch("/api/license-status", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const messages: VocmlMessage[] = Array.isArray(data?.messages) ? data.messages : [];

      if (!messages || messages.length === 0) {
        if (activeMessage) setActiveMessage(null);
        return;
      }

      // Cari pesan pertama yang sudah waktunya tayang berdasarkan interval_minutes
      const now = Date.now();
      for (const msg of messages) {
        const key = `vocml_msg_${msg.id}_last_seen`;
        const lastSeen = parseInt(localStorage.getItem(key) || "0", 10);
        const intervalMs = (msg.interval_minutes && msg.interval_minutes > 0 ? msg.interval_minutes : 5) * 60 * 1000;

        // Jika belum pernah dilihat atau sudah melewati interval_minutes
        if (!lastSeen || now - lastSeen >= intervalMs) {
          // Hanya set jika berbeda atau belum ada pesan yang tampil
          if (!activeMessage || activeMessage.id !== msg.id) {
            setActiveMessage(msg);
            const dispSec = msg.display_seconds && msg.display_seconds > 0 ? msg.display_seconds : 30;
            setCountdown(dispSec);
          }
          return;
        }
      }
    } catch {
      // Abaikan bila offline/error
    }
  }

  // Polling cek pesan tiap 12 detik
  useEffect(() => {
    checkMessages();
    const interval = setInterval(checkMessages, 12000);
    return () => clearInterval(interval);
  }, [activeMessage]);

  // Handle countdown display_seconds
  useEffect(() => {
    if (!activeMessage || countdown <= 0) {
      if (activeMessage && countdown <= 0) {
        dismissCurrentMessage();
      }
      return;
    }

    timerRef.current = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeMessage, countdown]);

  function dismissCurrentMessage() {
    if (activeMessage) {
      const key = `vocml_msg_${activeMessage.id}_last_seen`;
      localStorage.setItem(key, Date.now().toString());
    }
    setActiveMessage(null);
    setCountdown(0);
  }

  if (!activeMessage) return null;

  // Tipe & Gaya Visual
  const type = (activeMessage.type || "info").toLowerCase();
  const isUrgent = type === "urgent" || type === "danger";
  const isWarning = type === "warning";

  const theme = isUrgent
    ? {
        bg: "linear-gradient(135deg, #991B1B 0%, #DC2626 100%)",
        border: "#EF4444",
        badgeBg: "rgba(254, 226, 226, 0.2)",
        badgeText: "#FEE2E2",
        icon: <AlertOctagon size={24} className="text-white" />,
        shadow: "0 20px 40px -15px rgba(220, 38, 38, 0.4)",
        btnBg: "#FFFFFF",
        btnText: "#991B1B",
      }
    : isWarning
    ? {
        bg: "linear-gradient(135deg, #B45309 0%, #D97706 100%)",
        border: "#F59E0B",
        badgeBg: "rgba(254, 243, 199, 0.2)",
        badgeText: "#FEF3C7",
        icon: <AlertTriangle size={24} className="text-white" />,
        shadow: "0 20px 40px -15px rgba(217, 119, 6, 0.4)",
        btnBg: "#FFFFFF",
        btnText: "#B45309",
      }
    : {
        bg: "linear-gradient(135deg, #1E3A8A 0%, #2563EB 100%)",
        border: "#3B82F6",
        badgeBg: "rgba(219, 234, 254, 0.2)",
        badgeText: "#DBEAFE",
        icon: <Info size={24} className="text-white" />,
        shadow: "0 20px 40px -15px rgba(37, 99, 235, 0.4)",
        btnBg: "#FFFFFF",
        btnText: "#1E3A8A",
      };

  return (
    <div
      style={{
        position: "fixed",
        top: 20,
        right: 20,
        left: "auto",
        zIndex: 999999,
        maxWidth: 440,
        width: "calc(100vw - 40px)",
        animation: "slideInDown 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
    >
      <div
        style={{
          background: theme.bg,
          borderRadius: 18,
          border: `1.5px solid ${theme.border}`,
          padding: "20px 22px",
          color: "#FFFFFF",
          boxShadow: theme.shadow,
          position: "relative",
          backdropFilter: "blur(12px)",
        }}
      >
        {/* Tombol Tutup X */}
        <button
          onClick={dismissCurrentMessage}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "rgba(255, 255, 255, 0.18)",
            border: "none",
            borderRadius: "50%",
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#FFFFFF",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          title="Tutup pesan"
        >
          <X size={16} />
        </button>

        {/* Header Badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: "rgba(255, 255, 255, 0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {theme.icon}
          </div>
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: theme.badgeBg,
                color: theme.badgeText,
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
              }}
            >
              <Sparkles size={11} />
              Pesan Siaran VOC ML
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2, textShadow: "0 1px 2px rgba(0,0,0,0.15)" }}>
              {activeMessage.title}
            </div>
          </div>
        </div>

        {/* Isi Pesan */}
        <div
          style={{
            fontSize: 14,
            lineHeight: 1.55,
            color: "rgba(255, 255, 255, 0.95)",
            background: "rgba(0, 0, 0, 0.12)",
            padding: "12px 14px",
            borderRadius: 12,
            marginBottom: 14,
            whiteSpace: "pre-line",
          }}
        >
          {activeMessage.message}
        </div>

        {/* Footer: Countdown & Tombol Konfirmasi */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.8)",
            }}
          >
            <Clock size={13} />
            <span>Menutup otomatis dalam <strong>{countdown}s</strong></span>
          </div>

          <button
            onClick={dismissCurrentMessage}
            style={{
              background: theme.btnBg,
              color: theme.btnText,
              border: "none",
              borderRadius: 10,
              padding: "7px 16px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
              transition: "transform 0.1s ease",
            }}
          >
            <CheckCircle2 size={15} />
            Saya Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

