interface Blob {
  color: string;
  className: string;
  anim: string;
}

/**
 * Full-bleed pastel aurora wash behind the hero. Several soft colour blobs
 * each drift on their own slow path so the field morphs organically
 * (lessie.ai-style), rather than moving as one block.
 */
const BLOBS: Blob[] = [
  {
    color: "var(--color-aurora-pink)",
    className: "left-[-10%] top-[-15%] h-[60vh] w-[55vw]",
    anim: "animate-blob-a",
  },
  {
    color: "var(--color-aurora-amber)",
    className: "left-[20%] top-[-20%] h-[55vh] w-[50vw]",
    anim: "animate-blob-b",
  },
  {
    color: "var(--color-aurora-cyan)",
    className: "right-[-5%] top-[-10%] h-[60vh] w-[55vw]",
    anim: "animate-blob-c",
  },
  {
    color: "var(--color-aurora-violet)",
    className: "right-[15%] top-[5%] h-[55vh] w-[50vw]",
    anim: "animate-blob-d",
  },
];

export function Aurora() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[95vh] overflow-hidden"
    >
      {BLOBS.map((b, i) => (
        <div
          key={i}
          className={`absolute rounded-full blur-[100px] ${b.className} ${b.anim}`}
          style={{
            background: `radial-gradient(circle at center, color-mix(in srgb, ${b.color} 38%, transparent), transparent 72%)`,
          }}
        />
      ))}
    </div>
  );
}
