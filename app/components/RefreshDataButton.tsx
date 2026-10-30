'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';

const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const calculateDayOffset = (selectedDateStr: string): number => {
  const [sYear, sMonth, sDay] = selectedDateStr.split('-').map(Number);
  const selectedDate = new Date(sYear, sMonth - 1, sDay);
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((selectedDate.getTime() - today.getTime()) / msPerDay);
};

export default function RefreshDataButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isBotRunning, setIsBotRunning] = useState(false);
  
  // Varsayılan bugün
  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  
  // 🎯 En son başarılı rapor çekilen tarihi hafızada tutuyoruz (Başlangıçta bugünün tarihi kabul edelim)
  const [lastFetchedDate, setLastFetchedDate] = useState<string>(todayStr);

  // Süre ve Son Güncelleme Takibi İçin State'ler
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [lastStats, setLastStats] = useState<{ time: string; duration: string } | null>(null);

  // Bot çalışırken saniye sayacı
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isBotRunning) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBotRunning]);

  const handleRefresh = async () => {
    const dayOffset = calculateDayOffset(selectedDate);
    let shouldFetchNewData = false;

    // 🧠 Akıllı Kontrol: Seçilen tarih, en son çekilen tarihten farklı mı?
    if (selectedDate !== lastFetchedDate) {
      shouldFetchNewData = window.confirm(
        `⚠️ DİKKAT!\nŞu an ekrandaki veriler "${lastFetchedDate}" tarihine aittir.\nAncak hedef tarih olarak "${selectedDate}" seçtiniz.\n\n🔄 ${selectedDate} tarihine ait veriler PEPSELL'den yeniden çekilsin mi?\n\n(Tamam: Yeni tarih için bot çalışacak)\n(İptal: İşlem yapılmayacak)`
      );
      
      // Eğer kullanıcı farklı tarih seçip "İptal" derse işlemi tamamen durdurabiliriz
      if (!shouldFetchNewData) return; 
    } else {
      // Aynı tarihse standart yenileme / bot çalıştırma sorma mantığı
      shouldFetchNewData = window.confirm(
        `🔄 ${selectedDate} tarihi için veriler PEPSELL'den tekrar çekilsin mi?\n(Gün Farkı Offset: ${dayOffset})\n\n(Tamam: Bot çalışıp güncel verileri indirecek)\n(İptal: Sadece sayfayı tazele)`
      );
    }

    if (shouldFetchNewData) {
      setIsBotRunning(true);
      setElapsedSeconds(0);
      try {
        const apiUrl = process.env.NEXT_PUBLIC_BOT_API_URL || 'http://localhost:4000/api/run-automation';
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dayOffset, selectedDate }),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Otomasyon çalıştırılamadı!');
        }

        // Başarıyla bittiğinde hafızadaki son çekilen tarihi güncelliyoruz!
        setLastFetchedDate(selectedDate);

        if (result.updatedAt && result.duration) {
          setLastStats({ time: result.updatedAt, duration: result.duration });
        }
      } catch (error) {
        console.error('Bot çalıştırma hatası:', error);
        alert('Veriler güncellenirken bir hata oluştu.');
        setIsBotRunning(false);
        return;
      } finally {
        setIsBotRunning(false);
      }
    }

    startTransition(() => {
      router.refresh();
    });
  };

  const isLoading = isBotRunning || isPending;

  const getButtonText = () => {
    if (isBotRunning) return `Bot çalışıyor... (${elapsedSeconds}s)`;
    if (isPending) return 'Sayfa Yenileniyor...';
    return 'Verileri Yenile';
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Tarih Seçici */}
      <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 text-white text-sm">
        <span className="text-slate-400">Hedef Tarih:</span>
        <input 
          type="date" 
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          disabled={isLoading}
          className="bg-slate-800 text-white px-2 py-1 rounded border border-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer disabled:opacity-50"
        />
      </div>

      {/* Uyarı Banner'ı (Eğer seçilen tarih ile ekrandaki veri tarihi uyuşmuyorsa kullanıcıyı görsel olarak da uyaralım) */}
      {selectedDate !== lastFetchedDate && !isLoading && (
        <div className="text-[11px] text-amber-400 bg-amber-950/40 border border-amber-800/50 px-2 py-1 rounded text-center">
          ⚠️ Seçilen tarih ({selectedDate}) ile ekrandaki veri tarihi ({lastFetchedDate}) farklı!
        </div>
      )}

      {/* Yenileme Butonu */}
      <button
        onClick={handleRefresh}
        disabled={isLoading}
        className="flex items-center justify-center gap-2 px-4 py-2 w-full bg-slate-800 text-white rounded-lg shadow hover:bg-slate-700 transition active:scale-95 disabled:opacity-50 cursor-pointer"
      >
        <span className={`${isLoading ? 'animate-spin' : ''}`}>🔄</span>
        <span>{getButtonText()}</span>
      </button>

      {/* Son İşlem Bilgisi */}
      {lastStats && !isLoading && (
        <div className="flex justify-between items-center px-2 text-xs text-slate-400">
          <span>🕒 Veri Tarihi: <strong className="text-slate-300">{lastFetchedDate}</strong></span>
          <span>⚡ Süre: <strong className="text-emerald-400">{lastStats.duration}s</strong></span>
        </div>
      )}
    </div>
  );
}