"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─────────────────────────────────────────────────────────────────────────────
// NetworkGraph — an interactive 3D "content universe" rendered on canvas.
// Nodes live on a sphere (fibonacci lattice) around a central hub, projected
// with a perspective transform. Drag to rotate (with inertia), hover for a
// tooltip, click a node to navigate. Auto-rotates when idle.
// Zero dependencies: pure canvas 2D + 3D math.
// ─────────────────────────────────────────────────────────────────────────────

export interface GraphNodeInput {
  id: string;
  label: string;
  sub?: string;
  color: string;
  href?: string;
  kind: "hub" | "platform" | "agent";
}

interface Node extends GraphNodeInput {
  // base position on unit sphere (hub at origin)
  bx: number;
  by: number;
  bz: number;
  // rotated + projected this frame
  rx: number;
  ry: number;
  rz: number;
  px: number;
  py: number;
  scale: number;
  depth: number; // 0 (far) .. 1 (near)
  size: number;
  phase: number;
}

interface Edge {
  a: number;
  b: number;
  color: string;
  width: number;
  pulses: number; // traveling dots on this edge
  speed: number;
}

const TAU = Math.PI * 2;
const GOLD = "#d4a94f";
const GOLD_BRIGHT = "#e8c877";
const TEAL = "#2dd4bf";

function fibSphere(i: number, n: number, radius: number) {
  if (n <= 1) return { x: 0, y: 0, z: radius };
  const y = 1 - (i / (n - 1)) * 2;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = i * Math.PI * (3 - Math.sqrt(5));
  return { x: Math.cos(theta) * r * radius, y: y * radius, z: Math.sin(theta) * r * radius };
}

export function NetworkGraph({
  nodes: nodesIn,
  className,
  background = false,
}: {
  nodes: GraphNodeInput[];
  className?: string;
  background?: boolean; // decorative variant for auth pages: no interaction, fainter
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [hoverLabel, setHoverLabel] = useState<string | null>(null);

  // Mutable engine state kept in refs so the rAF loop never re-creates.
  const engine = useRef({
    nodes: [] as Node[],
    edges: [] as Edge[],
    rotX: -0.18,
    rotY: 0,
    velX: 0,
    velY: 0,
    dragging: false,
    dragMoved: 0,
    lastX: 0,
    lastY: 0,
    hoverIdx: -1,
    idleAt: 0,
    time: 0,
    tiltX: 0,
    tiltY: 0,
    targetTiltX: 0,
    targetTiltY: 0,
    visible: true,
    running: false,
    raf: 0,
  });

  // Build nodes/edges once per data change.
  useEffect(() => {
    const e = engine.current;
    const platformsIn = nodesIn.filter((n) => n.kind === "platform");
    const agentsIn = nodesIn.filter((n) => n.kind === "agent");
    const nodes: Node[] = [];
    const hub = nodesIn.find((n) => n.kind === "hub");
    nodes.push({
      ...(hub || { id: "hub", label: "Studio", color: GOLD, kind: "hub" as const }),
      bx: 0, by: 0, bz: 0, rx: 0, ry: 0, rz: 0, px: 0, py: 0, scale: 1, depth: 1,
      size: 30, phase: 0,
    });
    platformsIn.forEach((n, i) => {
      const p = fibSphere(i, platformsIn.length, 1);
      nodes.push({ ...n, bx: p.x, by: p.y, bz: p.z, rx: 0, ry: 0, rz: 0, px: 0, py: 0, scale: 1, depth: 0, size: 9, phase: i * 1.7 });
    });
    agentsIn.forEach((n, i) => {
      const p = fibSphere(i, agentsIn.length, 1.62);
      nodes.push({ ...n, bx: p.x, by: p.y, bz: p.z, rx: 0, ry: 0, rz: 0, px: 0, py: 0, scale: 1, depth: 0, size: 6, phase: i * 2.3 });
    });
    const edges: Edge[] = [];
    // hub ↔ platforms (gold, strong)
    platformsIn.forEach((_, i) => {
      edges.push({ a: 0, b: 1 + i, color: GOLD, width: 1.4, pulses: 1, speed: 0.22 + (i % 3) * 0.05 });
    });
    // hub ↔ agents (teal, thin)
    agentsIn.forEach((_, i) => {
      edges.push({ a: 0, b: 1 + platformsIn.length + i, color: TEAL, width: 0.8, pulses: 0, speed: 0 });
    });
    // each agent ↔ nearest platform (mesh feel)
    const agentStart = 1 + platformsIn.length;
    agentsIn.forEach((a, i) => {
      const ai = agentStart + i;
      let best = -1;
      let bestDist = Infinity;
      for (let j = 0; j < platformsIn.length; j++) {
        const n = nodes[1 + j];
        const m = nodes[ai];
        const d = (n.bx - m.bx) ** 2 + (n.by - m.by) ** 2 + (n.bz - m.bz) ** 2;
        if (d < bestDist) { bestDist = d; best = 1 + j; }
      }
      if (best >= 0) edges.push({ a: ai, b: best, color: TEAL, width: 0.6, pulses: 1, speed: 0.3 + (i % 4) * 0.04 });
    });
    e.nodes = nodes;
    e.edges = edges;
    e.hoverIdx = -1;
  }, [nodesIn]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const e = engine.current;
    if (!canvas || !wrap || e.nodes.length === 0) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    e.time += 1 / 60;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const idle = !e.dragging && performance.now() > e.idleAt;
    const auto = reduced ? 0 : idle ? (background ? 0.0016 : 0.0032) : 0;

    // rotation integration + inertia decay
    e.rotY += e.velY + auto;
    e.rotX += e.velX;
    e.velX *= 0.94;
    e.velY *= 0.94;
    e.rotX = Math.max(-1.1, Math.min(1.1, e.rotX));
    // gentle parallax tilt toward cursor when idle
    e.tiltX += (e.targetTiltX - e.tiltX) * 0.04;
    e.tiltY += (e.targetTiltY - e.tiltY) * 0.04;
    const rotX = e.rotX + (reduced ? 0 : e.tiltX);
    const rotY = e.rotY + (reduced ? 0 : e.tiltY);

    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * (background ? 0.62 : 0.36);
    const F = 3.1; // perspective focal distance (sphere radius = 1)

    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const bob = reduced ? 0 : 0.035;

    // rotate + project all nodes
    for (const n of e.nodes) {
      const y0 = n.by + Math.sin(e.time * 0.8 + n.phase) * bob * (n.kind === "hub" ? 0 : 1);
      // rotate around Y then X
      const x1 = n.bx * cosY + n.bz * sinY;
      const z1 = -n.bx * sinY + n.bz * cosY;
      const y2 = y0 * cosX - z1 * sinX;
      const z2 = y0 * sinX + z1 * cosX;
      n.rx = x1; n.ry = y2; n.rz = z2;
      const scale = F / (F + z2 / 1.7);
      n.scale = scale;
      n.px = cx + x1 * R * scale;
      n.py = cy + y2 * R * scale * 0.95;
      n.depth = (1 - z2 / 2.2 + 1) / 2; // ~0 far .. ~1 near
    }

    const alphaMul = background ? 0.5 : 1;

    // ── edges (far first) ──
    const edgeOrder = e.edges
      .map((ed, i) => ({ i, d: (e.nodes[ed.a].rz + e.nodes[ed.b].rz) / 2 }))
      .sort((a, b) => a.d - b.d);
    for (const { i } of edgeOrder) {
      const ed = e.edges[i];
      const a = e.nodes[ed.a];
      const b = e.nodes[ed.b];
      const alpha = ((a.depth + b.depth) / 2) * 0.5 * alphaMul;
      const hovered = e.hoverIdx === ed.a || e.hoverIdx === ed.b;
      ctx.strokeStyle = hovered
        ? hexA(GOLD_BRIGHT, Math.min(0.9, alpha + 0.35))
        : hexA(ed.color, alpha * (ed.color === TEAL ? 0.6 : 0.85));
      ctx.lineWidth = ed.width * ((a.scale + b.scale) / 2) * (hovered ? 1.6 : 1);
      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      ctx.stroke();

      // traveling pulse dots
      if (ed.pulses > 0 && !reduced) {
        for (let k = 0; k < ed.pulses; k++) {
          const t = (e.time * ed.speed + i * 0.37 + k * 0.5) % 1;
          const x = a.rx + (b.rx - a.rx) * t;
          const y = a.ry + (b.ry - a.ry) * t;
          const z = a.rz + (b.rz - a.rz) * t;
          const s = F / (F + z / 1.7);
          const px = cx + x * R * s;
          const py = cy + y * R * s * 0.95;
          const fade = Math.sin(t * Math.PI); // ease in/out along the edge
          ctx.fillStyle = hexA(GOLD_BRIGHT, fade * 0.9 * s * alphaMul);
          ctx.shadowColor = GOLD_BRIGHT;
          ctx.shadowBlur = 8 * fade;
          ctx.beginPath();
          ctx.arc(px, py, 2.1 * s, 0, TAU);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    // ── nodes (far first, hovered last) ──
    const order = e.nodes
      .map((n, i) => ({ i, z: n.rz }))
      .sort((a, b) => a.z - b.z);
    for (const { i } of order) {
      const n = e.nodes[i];
      const hovered = i === e.hoverIdx;
      const s = n.scale;
      const size = n.size * s * (hovered ? 1.25 : 1);
      const a = Math.max(0.12, n.depth) * alphaMul;

      // glow halo
      const halo = ctx.createRadialGradient(n.px, n.py, 0, n.px, n.py, size * 3.2);
      halo.addColorStop(0, hexA(n.color, 0.4 * a));
      halo.addColorStop(1, hexA(n.color, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(n.px, n.py, size * 3.2, 0, TAU);
      ctx.fill();

      if (n.kind === "hub") {
        // rotating dashed ring
        ctx.save();
        ctx.translate(n.px, n.py);
        ctx.rotate(reduced ? 0 : e.time * 0.35);
        ctx.strokeStyle = hexA(GOLD, 0.55 * alphaMul);
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 6]);
        ctx.beginPath();
        ctx.arc(0, 0, size + 10, 0, TAU);
        ctx.stroke();
        ctx.restore();
        ctx.setLineDash([]);
        // core
        const core = ctx.createRadialGradient(n.px, n.py - size * 0.3, 1, n.px, n.py, size);
        core.addColorStop(0, "#fff3d6");
        core.addColorStop(0.45, GOLD_BRIGHT);
        core.addColorStop(1, "#8a6b23");
        ctx.fillStyle = core;
        ctx.shadowColor = GOLD;
        ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(n.px, n.py, size, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        // initial letter
        ctx.fillStyle = "#171207";
        ctx.font = canvasFont(700, size * 0.9);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(n.label.charAt(0).toUpperCase(), n.px, n.py + 0.5);
      } else {
        const core = ctx.createRadialGradient(n.px - size * 0.3, n.py - size * 0.3, 0.5, n.px, n.py, size);
        core.addColorStop(0, "#ffffff");
        core.addColorStop(0.35, n.color);
        core.addColorStop(1, hexA(n.color, 0.85));
        ctx.fillStyle = core;
        ctx.shadowColor = n.color;
        ctx.shadowBlur = hovered ? 18 : 8;
        ctx.beginPath();
        ctx.arc(n.px, n.py, size, 0, TAU);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (hovered) {
          ctx.strokeStyle = hexA(GOLD_BRIGHT, 0.9);
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(n.px, n.py, size + 5, 0, TAU);
          ctx.stroke();
        }
      }

      // labels
      const showLabel =
        (n.kind === "hub" || n.kind === "platform" || hovered) && !background;
      if (showLabel) {
        const labelA = n.kind === "agent" && !hovered ? 0 : Math.min(1, a + 0.25);
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.font = canvasFont(600, Math.max(10, 11 * s));
        ctx.fillStyle = hexA("#e9f4f1", labelA);
        ctx.fillText(n.label, n.px, n.py + size + 7);
        if (n.sub) {
          ctx.font = canvasFont(500, Math.max(9, 10 * s));
          ctx.fillStyle = hexA(GOLD_BRIGHT, labelA * 0.95);
          ctx.fillText(n.sub, n.px, n.py + size + 7 + 13 * s);
        }
      }
    }

    // ── tooltip for hovered node ──
    if (e.hoverIdx >= 0 && !background) {
      const n = e.nodes[e.hoverIdx];
      const title = n.label;
      const sub = n.sub || n.id;
      ctx.font = canvasFont(600, 12);
      ctx.font = canvasFont(500, 11);
      const subW = ctx.measureText(sub).width;
      ctx.font = canvasFont(600, 12);
      const tw = Math.max(ctx.measureText(title).width, subW) + 22;
      const th = 44;
      let tx = n.px - tw / 2;
      let ty = n.py - n.size * 1.25 - th - 12;
      tx = Math.max(8, Math.min(w - tw - 8, tx));
      if (ty < 8) ty = n.py + n.size + 30;
      ctx.fillStyle = "rgba(8,17,17,0.94)";
      ctx.strokeStyle = hexA(GOLD, 0.55);
      ctx.lineWidth = 1;
      roundRect(ctx, tx, ty, tw, th, 9);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.font = canvasFont(600, 12);
      ctx.fillStyle = "#edf7f5";
      ctx.fillText(title, tx + 11, ty + 8);
      ctx.font = canvasFont(500, 11);
      ctx.fillStyle = hexA(GOLD_BRIGHT, 0.9);
      ctx.fillText(sub, tx + 11, ty + 25);
      if (n.href) {
        ctx.fillStyle = hexA(TEAL, 0.85);
        ctx.fillText("click to open →", tx + 11, ty + th + 5);
      }
    }
  }, [background]);

  // ── rAF lifecycle ──
  useEffect(() => {
    const e = engine.current;
    const loop = () => {
      if (e.visible) draw();
      e.raf = requestAnimationFrame(loop);
    };
    e.raf = requestAnimationFrame(loop);

    const wrap = wrapRef.current;
    let io: IntersectionObserver | null = null;
    if (wrap && "IntersectionObserver" in window) {
      io = new IntersectionObserver((ents) => { e.visible = ents[0]?.isIntersecting !== false; }, { threshold: 0.05 });
      io.observe(wrap);
    }
    return () => {
      cancelAnimationFrame(e.raf);
      io?.disconnect();
    };
  }, [draw]);

  // ── interaction ──
  const onPointerDown = (ev: React.PointerEvent) => {
    if (background) return;
    const e = engine.current;
    e.dragging = true;
    e.dragMoved = 0;
    e.lastX = ev.clientX;
    e.lastY = ev.clientY;
    (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
  };
  const onPointerMove = (ev: React.PointerEvent) => {
    const e = engine.current;
    if (background) return;
    const rect = (ev.currentTarget as HTMLElement).getBoundingClientRect();
    if (e.dragging) {
      const dx = ev.clientX - e.lastX;
      const dy = ev.clientY - e.lastY;
      e.lastX = ev.clientX;
      e.lastY = ev.clientY;
      e.dragMoved += Math.abs(dx) + Math.abs(dy);
      e.velY = dx * 0.0045;
      e.velX = dy * 0.0035;
    } else {
      // hover hit-test + parallax target
      const mx = ev.clientX - rect.left;
      const my = ev.clientY - rect.top;
      e.targetTiltY = ((mx / rect.width) - 0.5) * 0.16;
      e.targetTiltX = ((my / rect.height) - 0.5) * -0.1;
      let hit = -1;
      let bestD = 26; // px radius
      e.nodes.forEach((n, i) => {
        const d = Math.hypot(n.px - mx, n.py - my);
        const reach = n.size * n.scale + 12;
        if (d < Math.max(bestD, reach) && d < reach) { hit = i; bestD = d; }
      });
      e.hoverIdx = hit;
      const label = hit >= 0 ? e.nodes[hit].label : null;
      setHoverLabel((prev) => (prev === label ? prev : label));
    }
  };
  const onPointerUp = (ev: React.PointerEvent) => {
    const e = engine.current;
    if (!e.dragging) return;
    e.dragging = false;
    e.idleAt = performance.now() + 2200;
    // click (not drag) → navigate
    if (e.dragMoved < 6 && e.hoverIdx >= 0) {
      const n = e.nodes[e.hoverIdx];
      if (n.href) {
        router.push(n.href);
        return;
      }
    }
    void ev;
  };
  const onPointerLeave = () => {
    const e = engine.current;
    e.hoverIdx = -1;
    e.targetTiltX = 0;
    e.targetTiltY = 0;
    setHoverLabel(null);
  };

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        touchAction: "pan-y",
        cursor: background ? "default" : hoverLabel ? "pointer" : "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}

// ── helpers ──
let _bodyFontFamily: string | null = null;
function canvasFont(weight: number, size: number) {
  if (typeof window !== "undefined" && !_bodyFontFamily) {
    _bodyFontFamily = getComputedStyle(document.body).fontFamily || "Inter, sans-serif";
  }
  return `${weight} ${Math.round(size)}px ${_bodyFontFamily || "Inter, sans-serif"}`;
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
