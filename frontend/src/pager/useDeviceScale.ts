import { useEffect, useState } from 'react';

export function useDeviceScale(baseWidth: number, margin: number): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const availW = window.innerWidth - margin * 2;
      const next = Math.min(1, availW / baseWidth);
      setScale(next > 0 ? next : 1);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [baseWidth, margin]);

  return scale;
}
