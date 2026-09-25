import { useState, useEffect } from 'react';

export function useLiveTelemetry(startDate: string, endDate: string, bucket: 'hour' | 'day') {
  const [timeline, setTimeline] = useState<any[]>([]);
  const [kpis, setKpis] = useState({ revenue: 0, profit: 0, orders: 0 });
  const [isSyncing, setIsSyncing] = useState(false);

  const fetchTelemetry = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`/api/orders`);
      if (res.ok) {
        const orders = await res.json();
        if (Array.isArray(orders)) {
          const totalRev = orders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
          setKpis({
            revenue: totalRev,
            profit: Math.round(totalRev * 0.4),
            orders: orders.length,
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [startDate, endDate, bucket]);

  return { timeline, kpis, isSyncing };
}