import { useEffect, useState } from 'react';

interface CountdownResult {
  remainingMs: number;
  isExpired: boolean;
  formatted: string; // "MM:SS"
}

// 絶対時刻ベースのカウントダウン。startedAt + durationMs が終了時刻。
export function useCountdown(startedAt: number | null, durationMinutes: number | null): CountdownResult {
  const endTime = startedAt && durationMinutes ? startedAt + durationMinutes * 60_000 : null;

  const calcRemaining = () => (endTime ? Math.max(0, endTime - Date.now()) : 0);
  const [remainingMs, setRemainingMs] = useState(calcRemaining);

  useEffect(() => {
    if (!endTime) {
      setRemainingMs(0);
      return;
    }
    setRemainingMs(calcRemaining());
    const id = setInterval(() => {
      const r = calcRemaining();
      setRemainingMs(r);
      if (r <= 0) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
    // endTime は安定した数値なので依存配列に含める
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTime]);

  const totalSec = Math.ceil(remainingMs / 1000);
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');

  return { remainingMs, isExpired: endTime !== null && remainingMs <= 0, formatted: `${mm}:${ss}` };
}
