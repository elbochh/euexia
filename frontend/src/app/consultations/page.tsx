'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/ui/TopBar';
import BottomNav from '@/components/ui/BottomNav';
import ConsultationsList from '@/components/consultations/ConsultationsList';
import { useGameStore } from '@/stores/gameStore';

export default function ConsultationsPage() {
  const router = useRouter();
  const { isAuthenticated, initFromStorage, loadConsultationsWithMaps } = useGameStore();

  useEffect(() => {
    initFromStorage();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('euexia_token');
      if (!token) {
        router.push('/');
        return;
      }
    }
    if (isAuthenticated) {
      loadConsultationsWithMaps();
    }
  }, [isAuthenticated]);

  return (
    <div className="min-h-screen">
      <TopBar />
      <ConsultationsList />
      <BottomNav />
    </div>
  );
}

