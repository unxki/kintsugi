import React, { useEffect, useRef } from "react";

interface ActivePulse {
  id: number;
  isVertical: boolean;
  gridIndex: number; // Row index if horizontal, Column index if vertical
  trackCoord: number; // gridIndex * gridSize (X for vertical, Y for horizontal)
  pos: number;        // Position along the travel axis
  direction: 1 | -1;
  length: number;
  speed: number;
  color: string;
  headColor: string;
  alpha: number;
}

interface HexBlip {
  x: number;
  y: number;
  text: string;
  alpha: number;
  fadeSpeed: number;
  lifetime: number;
}

export const MatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let displayWidth = window.innerWidth;
    let displayHeight = window.innerHeight;

    const gridSize = 48;
    const PULSE_LENGTH = 120; // Sleek elongated line length
    const PULSE_SPEED = 0.95; // Smooth uniform travel speed

    // Vivid cyber green color themes with bright glowing neon heads
    const colorThemes = [
      { body: "0, 255, 65", head: "220, 255, 235" },   // Neon Laser Green
      { body: "16, 235, 100", head: "230, 255, 240" }, // Matrix Lime
      { body: "0, 230, 118", head: "215, 255, 235" },  // Emerald Cyan-Green
      { body: "34, 197, 94", head: "210, 255, 230" },  // Terminal Green
    ];

    const hexSamples = ["0x7F", "0xA4", "ACK", "101", "0x00", "SEC", "OK", "0xFF", "SYS", "0x2E", "NODE_01", "UP", "SYN", "0x3C"];
    const hexBlips: HexBlip[] = [];

    let activePulses: ActivePulse[] = [];
    const occupiedRows = new Set<number>();
    const occupiedCols = new Set<number>();

    let totalCols = Math.floor(displayWidth / gridSize);
    let totalRows = Math.floor(displayHeight / gridSize);

    // Pick an available unoccupied track
    const pickAvailableTrack = (isVertical: boolean): number => {
      const occupiedSet = isVertical ? occupiedCols : occupiedRows;
      const totalTracks = isVertical ? totalCols : totalRows;

      const available: number[] = [];
      for (let i = 1; i < totalTracks; i++) {
        if (!occupiedSet.has(i)) {
          available.push(i);
        }
      }

      if (available.length === 0) {
        return Math.floor(Math.random() * (totalTracks - 2)) + 1;
      }
      return available[Math.floor(Math.random() * available.length)];
    };

    const initSystem = () => {
      if (!canvas) return;
      displayWidth = window.innerWidth;
      displayHeight = window.innerHeight;
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      totalCols = Math.floor(displayWidth / gridSize);
      totalRows = Math.floor(displayHeight / gridSize);

      occupiedRows.clear();
      occupiedCols.clear();
      activePulses = [];

      // Clean line count (~4-5 horizontal, ~5-6 vertical = ~10 lines total)
      const hCount = Math.min(Math.max(Math.floor(totalRows * 0.22), 4), 6);
      const vCount = Math.min(Math.max(Math.floor(totalCols * 0.18), 4), 7);

      let pulseId = 0;

      // Initialize Horizontal Pulses across random unique rows
      for (let i = 0; i < hCount; i++) {
        const row = pickAvailableTrack(false);
        occupiedRows.add(row);

        const direction = Math.random() > 0.5 ? 1 : -1;
        const totalSpan = displayWidth + PULSE_LENGTH * 2;
        const startPos = (totalSpan / hCount) * i + (Math.random() * 80 - 40);
        const theme = colorThemes[pulseId % colorThemes.length];

        activePulses.push({
          id: pulseId++,
          isVertical: false,
          gridIndex: row,
          trackCoord: row * gridSize,
          pos: startPos - PULSE_LENGTH,
          direction,
          length: PULSE_LENGTH,
          speed: PULSE_SPEED,
          color: theme.body,
          headColor: theme.head,
          alpha: Math.random() * 0.18 + 0.45,
        });
      }

      // Initialize Vertical Pulses across random unique columns
      for (let i = 0; i < vCount; i++) {
        const col = pickAvailableTrack(true);
        occupiedCols.add(col);

        const direction = Math.random() > 0.5 ? 1 : -1;
        const totalSpan = displayHeight + PULSE_LENGTH * 2;
        const startPos = (totalSpan / vCount) * i + (Math.random() * 80 - 40);
        const theme = colorThemes[pulseId % colorThemes.length];

        activePulses.push({
          id: pulseId++,
          isVertical: true,
          gridIndex: col,
          trackCoord: col * gridSize,
          pos: startPos - PULSE_LENGTH,
          direction,
          length: PULSE_LENGTH,
          speed: PULSE_SPEED,
          color: theme.body,
          headColor: theme.head,
          alpha: Math.random() * 0.18 + 0.45,
        });
      }
    };

    initSystem();
    window.addEventListener("resize", initSystem);

    const spawnBlip = () => {
      if (hexBlips.length > 15) return;
      const col = Math.floor((Math.random() * displayWidth) / gridSize);
      const row = Math.floor((Math.random() * displayHeight) / gridSize);
      hexBlips.push({
        x: col * gridSize + 6,
        y: row * gridSize - 6,
        text: hexSamples[Math.floor(Math.random() * hexSamples.length)],
        alpha: 0,
        fadeSpeed: 0.009,
        lifetime: Math.random() * 220 + 90,
      });
    };

    let scanY = 0;
    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, displayWidth, displayHeight);

      // Periodically spawn ambient hex telemetry blips
      if (frame % 25 === 0) spawnBlip();

      // --- LAYER 1: Visible Green Coordinate Grid & Junction Crosses ---
      ctx.strokeStyle = "rgba(0, 255, 65, 0.055)";
      ctx.lineWidth = 0.6;

      ctx.beginPath();
      for (let x = 0; x < displayWidth; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, displayHeight);
      }
      for (let y = 0; y < displayHeight; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(displayWidth, y);
      }
      ctx.stroke();

      // Micro intersection crosses
      ctx.fillStyle = "rgba(0, 255, 65, 0.16)";
      for (let x = 0; x < displayWidth; x += gridSize * 2) {
        for (let y = 0; y < displayHeight; y += gridSize * 2) {
          ctx.fillRect(x - 1, y - 1, 2, 2);
        }
      }

      // --- LAYER 2: Enhanced Glowing Hex Code Blips ---
      for (let i = hexBlips.length - 1; i >= 0; i--) {
        const blip = hexBlips[i];
        blip.lifetime--;
        if (blip.lifetime > 40 && blip.alpha < 0.52) {
          blip.alpha += blip.fadeSpeed;
        } else if (blip.lifetime <= 40) {
          blip.alpha -= blip.fadeSpeed;
        }

        if (blip.alpha > 0) {
          ctx.save();
          ctx.font = "9.5px monospace";
          ctx.shadowColor = "rgba(0, 255, 65, 0.9)";
          ctx.shadowBlur = 7;
          ctx.fillStyle = `rgba(0, 255, 65, ${blip.alpha})`;
          ctx.fillText(blip.text, blip.x, blip.y);
          ctx.restore();
        }

        if (blip.lifetime <= 0) {
          hexBlips.splice(i, 1);
        }
      }

      // --- LAYER 3: Dynamic Elongated Cyber Green Lines with Rich Bloom ---
      for (let i = 0; i < activePulses.length; i++) {
        const pulse = activePulses[i];

        // Advance position with uniform speed
        pulse.pos += pulse.speed * pulse.direction;

        const maxAxis = pulse.isVertical ? displayHeight : displayWidth;

        // When pulse finishes traversing the screen, respawn on a new available random grid track
        if (
          (pulse.direction > 0 && pulse.pos > maxAxis + pulse.length + 20) ||
          (pulse.direction < 0 && pulse.pos < -pulse.length - 20)
        ) {
          // Free old track
          if (pulse.isVertical) {
            occupiedCols.delete(pulse.gridIndex);
            const newCol = pickAvailableTrack(true);
            occupiedCols.add(newCol);
            pulse.gridIndex = newCol;
            pulse.trackCoord = newCol * gridSize;
          } else {
            occupiedRows.delete(pulse.gridIndex);
            const newRow = pickAvailableTrack(false);
            occupiedRows.add(newRow);
            pulse.gridIndex = newRow;
            pulse.trackCoord = newRow * gridSize;
          }

          // Randomize new direction & spawn on appropriate edge
          pulse.direction = Math.random() > 0.5 ? 1 : -1;
          pulse.pos = pulse.direction > 0 ? -pulse.length : maxAxis + pulse.length;
          const theme = colorThemes[Math.floor(Math.random() * colorThemes.length)];
          pulse.color = theme.body;
          pulse.headColor = theme.head;
          pulse.alpha = Math.random() * 0.18 + 0.45;
        }

        const dynamicAlpha = pulse.alpha;

        ctx.save();

        if (pulse.isVertical) {
          const headY = pulse.direction > 0 ? pulse.pos + pulse.length : pulse.pos;
          const tailY = pulse.direction > 0 ? pulse.pos : pulse.pos + pulse.length;

          // 1. Soft glowing outer line bloom
          ctx.shadowColor = `rgba(${pulse.color}, 0.95)`;
          ctx.shadowBlur = 9;
          const gradOuter = ctx.createLinearGradient(0, tailY, 0, headY);
          gradOuter.addColorStop(0, `rgba(${pulse.color}, 0)`);
          gradOuter.addColorStop(0.65, `rgba(${pulse.color}, ${dynamicAlpha * 0.38})`);
          gradOuter.addColorStop(1, `rgba(${pulse.headColor}, ${dynamicAlpha * 0.8})`);
          ctx.strokeStyle = gradOuter;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(pulse.trackCoord, tailY);
          ctx.lineTo(pulse.trackCoord, headY);
          ctx.stroke();

          // 2. Crisp sharp laser core
          ctx.shadowBlur = 4;
          const gradCore = ctx.createLinearGradient(0, tailY, 0, headY);
          gradCore.addColorStop(0, `rgba(${pulse.color}, 0)`);
          gradCore.addColorStop(0.7, `rgba(${pulse.color}, ${dynamicAlpha * 0.75})`);
          gradCore.addColorStop(1, `rgba(240, 255, 245, ${dynamicAlpha * 0.95})`);
          ctx.strokeStyle = gradCore;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pulse.trackCoord, tailY);
          ctx.lineTo(pulse.trackCoord, headY);
          ctx.stroke();

          // 3. High-Intensity Glowing Head Point
          ctx.shadowColor = "rgba(0, 255, 65, 1.0)";
          ctx.shadowBlur = 13;

          // Outer halo
          ctx.fillStyle = `rgba(${pulse.color}, ${dynamicAlpha * 0.45})`;
          ctx.beginPath();
          ctx.arc(pulse.trackCoord, headY, 3.2, 0, Math.PI * 2);
          ctx.fill();

          // Inner bright neon core
          ctx.fillStyle = `rgba(${pulse.headColor}, ${dynamicAlpha})`;
          ctx.beginPath();
          ctx.arc(pulse.trackCoord, headY, 1.6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const headX = pulse.direction > 0 ? pulse.pos + pulse.length : pulse.pos;
          const tailX = pulse.direction > 0 ? pulse.pos : pulse.pos + pulse.length;

          // 1. Soft glowing outer line bloom
          ctx.shadowColor = `rgba(${pulse.color}, 0.95)`;
          ctx.shadowBlur = 9;
          const gradOuter = ctx.createLinearGradient(tailX, 0, headX, 0);
          gradOuter.addColorStop(0, `rgba(${pulse.color}, 0)`);
          gradOuter.addColorStop(0.65, `rgba(${pulse.color}, ${dynamicAlpha * 0.38})`);
          gradOuter.addColorStop(1, `rgba(${pulse.headColor}, ${dynamicAlpha * 0.8})`);
          ctx.strokeStyle = gradOuter;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.moveTo(tailX, pulse.trackCoord);
          ctx.lineTo(headX, pulse.trackCoord);
          ctx.stroke();

          // 2. Crisp sharp laser core
          ctx.shadowBlur = 4;
          const gradCore = ctx.createLinearGradient(tailX, 0, headX, 0);
          gradCore.addColorStop(0, `rgba(${pulse.color}, 0)`);
          gradCore.addColorStop(0.7, `rgba(${pulse.color}, ${dynamicAlpha * 0.75})`);
          gradCore.addColorStop(1, `rgba(240, 255, 245, ${dynamicAlpha * 0.95})`);
          ctx.strokeStyle = gradCore;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tailX, pulse.trackCoord);
          ctx.lineTo(headX, pulse.trackCoord);
          ctx.stroke();

          // 3. High-Intensity Glowing Head Point
          ctx.shadowColor = "rgba(0, 255, 65, 1.0)";
          ctx.shadowBlur = 13;

          // Outer halo
          ctx.fillStyle = `rgba(${pulse.color}, ${dynamicAlpha * 0.45})`;
          ctx.beginPath();
          ctx.arc(headX, pulse.trackCoord, 3.2, 0, Math.PI * 2);
          ctx.fill();

          // Inner bright neon core
          ctx.fillStyle = `rgba(${pulse.headColor}, ${dynamicAlpha})`;
          ctx.beginPath();
          ctx.arc(headX, pulse.trackCoord, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      // --- LAYER 4: Sweeping Subtle Green Radar Scanline ---
      scanY = (scanY + 0.65) % (displayHeight + 150);
      const scanGrad = ctx.createLinearGradient(0, scanY - 45, 0, scanY + 45);
      scanGrad.addColorStop(0, "rgba(0, 255, 65, 0)");
      scanGrad.addColorStop(0.5, "rgba(0, 255, 65, 0.025)");
      scanGrad.addColorStop(1, "rgba(0, 255, 65, 0)");
      ctx.fillStyle = scanGrad;
      ctx.fillRect(0, scanY - 45, displayWidth, 90);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", initSystem);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* Dark cyber canvas background */}
      <div className="absolute inset-0 bg-[#040404]" />
      
      {/* High-DPI Canvas with Glowing Matrix Green Lines */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      
      {/* Subtle green ambient lighting */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#00ff41]/3.5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 -right-32 w-96 h-96 bg-[#00ff41]/3 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-[#00ff41]/3 rounded-full blur-3xl pointer-events-none" />
      
      {/* Smooth vignette falloff */}
      <div className="absolute inset-0 shadow-[inset_0_0_110px_rgba(0,0,0,0.85)] pointer-events-none" />
    </div>
  );
};
