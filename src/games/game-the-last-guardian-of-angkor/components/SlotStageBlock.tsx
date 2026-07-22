import type { ReactNode } from "react";

type SlotStageBlockProps = {
  children: ReactNode;
  className?: string;
};

/** Shared width/inset wrapper for jackpot bar and play cabinet on the game stage. */
export default function SlotStageBlock({
  children,
  className = "",
}: Readonly<SlotStageBlockProps>) {
  return (
    <div
      className={
        className
          ? `slot-stage-block ${className}`
          : "slot-stage-block"
      }
    >
      {children}
    </div>
  );
}
