'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AnalyticsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#09090B] flex items-center justify-center text-gray-400 font-mono text-sm">
      Redirecting to Command Center...
    </div>
  );
}