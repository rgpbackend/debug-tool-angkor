import type { ReactNode } from "react";

type TitanCabinetProps = {
  error?: string | null;
  reels: ReactNode;
  controls: ReactNode;
  combo?: ReactNode;
};

export default function TitanCabinet({ error, reels, controls, combo }: TitanCabinetProps) {
  return (
    <section className="titan-cabinet">
      <div className="titan-cabinet-frame">
        {error ? <div className="titan-error-bar"><span className="titan-error">{error}</span></div> : null}

        <div className="titan-reel-window">
          <div className="titan-reel-window-inner">
            {reels}
            {combo}
          </div>
        </div>

        <footer className="titan-console">{controls}</footer>
      </div>
    </section>
  );
}
