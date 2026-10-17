import { useRef, useState } from 'react';
import { walkInput } from './WalkControls';

/** On-screen joystick (left) and drag-to-look area (right) for touch walkthroughs. */
export function TouchControls() {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const stickId = useRef<number | null>(null);
  const lookId = useRef<number | null>(null);
  const lookLast = useRef({ x: 0, y: 0 });
  const R = 44;
  return (
    <>
      <div
        className="touch-stick"
        aria-label="Move"
        role="application"
        onPointerDown={(e) => {
          stickId.current = e.pointerId;
          (e.target as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (stickId.current !== e.pointerId) return;
          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
          let x = e.clientX - (rect.left + rect.width / 2);
          let y = e.clientY - (rect.top + rect.height / 2);
          const l = Math.hypot(x, y);
          if (l > R) {
            x = (x / l) * R;
            y = (y / l) * R;
          }
          setKnob({ x, y });
          walkInput.move = { x: x / R, y: y / R };
          walkInput.run = l > R * 0.95;
        }}
        onPointerUp={() => {
          stickId.current = null;
          setKnob({ x: 0, y: 0 });
          walkInput.move = { x: 0, y: 0 };
          walkInput.run = false;
        }}
        onPointerCancel={() => {
          stickId.current = null;
          setKnob({ x: 0, y: 0 });
          walkInput.move = { x: 0, y: 0 };
        }}
      >
        <span className="touch-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
      <div
        className="touch-look"
        aria-label="Look around"
        role="application"
        onPointerDown={(e) => {
          lookId.current = e.pointerId;
          lookLast.current = { x: e.clientX, y: e.clientY };
          (e.target as Element).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (lookId.current !== e.pointerId) return;
          walkInput.look.dx += e.clientX - lookLast.current.x;
          walkInput.look.dy += e.clientY - lookLast.current.y;
          lookLast.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => (lookId.current = null)}
      />
    </>
  );
}
