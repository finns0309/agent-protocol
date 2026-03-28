export function Cartridge({ data, size = "md", isActive = false, isSelected = false, onClick, className = "" }) {
  const sizes = {
    sm: { w: 72, h: 88, font: 16, notch: 18, pins: 6, pinW: 3, pinH: 4, radius: 10, gap: 1 },
    md: { w: 88, h: 108, font: 20, notch: 22, pins: 8, pinW: 3, pinH: 5, radius: 12, gap: 1.5 },
    lg: { w: 120, h: 148, font: 26, notch: 28, pins: 10, pinW: 4, pinH: 6, radius: 14, gap: 2 }
  };
  const metrics = sizes[size];

  return (
    <button
      className={`cartridge size-${size} ${className} ${isSelected ? "is-selected" : ""}`}
      onClick={onClick}
      type="button"
      style={{
        "--cart-w": `${metrics.w}px`,
        "--cart-h": `${metrics.h}px`,
        "--cart-font": `${metrics.font}px`,
        "--cart-notch": `${metrics.notch}px`,
        "--cart-radius": `${metrics.radius}px`,
        "--cart-pin-count": metrics.pins,
        "--cart-pin-w": `${metrics.pinW}px`,
        "--cart-pin-h": `${metrics.pinH}px`,
        "--cart-pin-gap": `${metrics.gap}px`,
        "--cart-color": data.theme.color,
        "--cart-color-dark": data.theme.colorDark,
        "--cart-glow": data.theme.glow,
        "--cart-art": data.asset ? `url("${data.asset}")` : "none"
      }}
    >
      <span className="cartridge-shell">
        <span className="cartridge-notch" />
        <span className="cartridge-face">
          <span className={`cartridge-label motif-${String(data.motif || "default").replace(/[^a-z0-9_-]+/gi, "-").toLowerCase()}`}>
            <span className="cartridge-brand-strip">
              <span className="cartridge-brand-mark">{data.brand || "COSMOS"}</span>
            </span>
            <span className="cartridge-art-panel" />
          </span>
        </span>
        <span className="cartridge-pins">
          {Array.from({ length: metrics.pins }).map((_, index) => (
            <span className="cartridge-pin" key={index} />
          ))}
        </span>
        {isActive ? <span className="cartridge-live" /> : null}
      </span>
    </button>
  );
}
