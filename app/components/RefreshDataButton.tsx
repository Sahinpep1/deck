'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RefreshDataButton() {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingText, setLoadingText] = useState('Verileri Yenile');

  const handleRefresh = async () => {
    // Kullanıcıya onay sorusu çıkartıyoruz
    const shouldFetchNewData = window.confirm(
      "🔄 Yeni veriler PEPSELL'den çekilsin mi?\n\n(Tamam: Bot çalışıp güncel verileri indirecek - Birkaç saniye sürebilir)\n(İptal: Sadece mevcut verilerle sayfayı tazele)"
    );

    setIsRefreshing(true);

    try {
      if (shouldFetchNewData) {
        setLoadingText('Bot çalışıyor...');
        
        // Hono API üzerinden otomasyonu tetikliyoruz
        const response = await fetch('http://localhost:4000/api/run-automation', {
          method: 'POST',
        });

        if (!response.ok) {
          throw new Error('Otomasyon çalıştırılamadı!');
        }
        
        setLoadingText('Güncelleniyor...');
      } else {
        setLoadingText('Yenileniyor...');
      }

      // Next.js önbelleğini temizleyerek yeni/güncel verileri sayfaya yansıtıyoruz
      router.refresh();
    } catch (error) {
      console.error('Güncelleme sırasında hata:', error);
      alert('Veriler güncellenirken bir hata oluştu.');
    } finally {
      setIsRefreshing(false);
      setLoadingText('Verileri Yenile');
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="flex items-center justify-center gap-2 px-4 py-2 w-full bg-slate-800 text-white rounded-lg shadow hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
    >
      <span className={`${isRefreshing ? 'animate-spin' : ''}`}>🔄</span>
      <span>{isRefreshing ? loadingText : 'Verileri Yenile'}</span>
    </button>
  );
}