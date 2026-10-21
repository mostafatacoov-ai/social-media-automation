"use client";

import { ReactNode, useMemo } from "react";
import { motion } from "motion/react";
import { NetworkGraph, GraphNodeInput } from "@/components/ui/NetworkGraph";

// Shared animated background for the login and setup pages.
export function AuthShell({ children }: { children: ReactNode }) {
  // A quiet, non-interactive constellation drifting behind the card.
  const nodes = useMemo<GraphNodeInput[]>(
    () => [
      { id: "hub", label: "S", color: "#d4a94f", kind: "hub" },
      ...Array.from({ length: 14 }, (_, i) => ({
        id: "p" + i,
        label: "",
        color: i % 3 === 0 ? "#2dd4bf" : "#d4a94f",
        kind: (i < 7 ? "platform" : "agent") as "platform" | "agent",
      })),
    ],
    []
  );
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-4">
      {/* floating gradient blobs */}
      <div
        className="blob"
        style={{ background: "var(--accent)", width: 420, height: 420, top: "-8%", left: "-6%", animationDelay: "0s" }}
      />
      <div
        className="blob"
        style={{ background: "#2dd4bf", width: 360, height: 360, bottom: "-10%", right: "-5%", animationDelay: "-5s" }}
      />
      <div
        className="blob"
        style={{ background: "#d4a94f", width: 280, height: 280, top: "55%", left: "18%", opacity: 0.25, animationDelay: "-9s" }}
      />
      {/* slow 3D constellation backdrop */}
      <div className="absolute inset-0">
        <NetworkGraph nodes={nodes} background />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm"
      >
        {children}
      </motion.div>
    </div>
  );
}
