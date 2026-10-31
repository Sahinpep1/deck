'use client';

import React, { useState, useRef, useMemo, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { Map, MapRef } from 'react-map-gl/maplibre';
import { IconLayer, TextLayer } from '@deck.gl/layers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { polygon, point } from '@turf/helpers';
import RefreshDataButton  from './components/RefreshDataButton'

import 'maplibre-gl/dist/maplibre-gl.css';



/**
 * Plasiyer isminden dinamik, tutarlı ve okunabilir bir RGB renk üretir.
 */
const getSalesRepColor = (name: string): [number, number, number] => {
  if (!name) return [150, 150, 150]; // İsim yoksa gri
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  const r = (hash & 0xFF) % 180 + 50;     
  const g = ((hash >> 8) & 0xFF) % 180 + 50; 
  const b = ((hash >> 16) & 0xFF) % 180 + 50;

  return [r, g, b];
};

export default function DeckMap({ initialData , salesRepSummary, outOfBoundsDf, outOfPalletInfo   }: { initialData: any[]; salesRepSummary: any[]; outOfBoundsDf: any[]; outOfPalletInfo: any[] }) {
  
  const [selectedPoints, setSelectedPoints] = useState<any[]>([]);
  const [popupInfo, setPopupInfo] = useState<any>(null);
  const [allCustomer, setAllCustomer] = useState<boolean >(false);
  const [isLassoActive, setIsLassoActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pixelPath, setPixelPath] = useState<Array<[number, number]>>([]);
  const [showOutOfBounds, setShowOutOfBounds] = useState(false);
  
  const [selectedSalesReps, setSelectedSalesReps] = useState<string[]>([]);

  // Toplam hesaplamalarında da doğrudan initialData kullanılması için:
  const totalCount = initialData?.length || 0;
  const totalQuantity = useMemo(() => (initialData || []).reduce((acc, p) => acc + (p.totalQuantity || 0), 0), [initialData]);
  const totalPallet = useMemo(() => (initialData || []).reduce((acc, p) => acc + (p.totalPallet || 0), 0), [initialData]);
  // Sağ tık menüsü için state'ler
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; point: any } | null>(null);
  const [viewState, setViewState] = useState({
  longitude: 36.1633,
  latitude: 36.2023,
  zoom: 12,
  pitch: 0,
  bearing: 0
});
  const mapRef = useRef<MapRef>(null);

  // Sayfanın herhangi bir yerine tıklandığında sağ tık menüsünü kapat
  useEffect(() => {
    const handleClickOutside = () => setContextMenu(null);
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);
  
  // 🚀 ÖNEMLİ DÜZELTME: initialData değiştiğinde (router.refresh tetiklendiğinde) harita verisi güncellenir
  const filteredData = useMemo(() => {
    const data = initialData || [];
    if (selectedSalesReps.length === 0) return data;
    return data.filter(d => selectedSalesReps.includes(d.salesrep));
  }, [initialData, selectedSalesReps]);
  // Popup üzerinden seçilenlere ekleme/kaldırma fonksiyonu
  const handleToggleSelectPoint = (pointObj: any) => {
    setSelectedPoints(prev => {
      const exists = prev.some(p => p.id === pointObj.id);
      if (exists) {
        // Eğer zaten varsa listeden çıkar
        return prev.filter(p => p.id !== pointObj.id);
      } else {
        // Eğer yoksa listeye ekle
        return [...prev, pointObj];
      }
    });
  };
  const pointsLayer = useMemo(() => {
    // Seçili olan ve seçili olmayan noktaları birbirinden ayıralım
    const unselectedData = filteredData.filter(d => !selectedPoints.some(p => p.id === d.id));
    const selectedData = filteredData.filter(d => selectedPoints.some(p => p.id === d.id));

    return [
      // 1. Normal Noktalar Katmanı
      new IconLayer({
        id: 'salesrep-points-unselected',
        data: unselectedData,
        getPosition: (d: any) => d.coordinates,
        iconAtlas: '/marker.png',
        iconMapping: {
          marker: { x: 0, y: 0, width: 512, height: 512, anchorY: 512, mask: true }
        },
        getIcon: () => 'marker',
        getColor: (d: any) => getSalesRepColor(d.salesrep),
        sizeScale: 1,
        getSize: 35,
        pickable: !isLassoActive,
        onClick: (info: any) => {
          if (info.object && !isLassoActive) {
            setPopupInfo(info.object);
          }
        }
      }),
      // 2. Seçili Noktalar Katmanı (Farklı ikon ile)
      new IconLayer({
        id: 'salesrep-points-selected',
        data: selectedData,
        getPosition: (d: any) => d.coordinates,
        iconAtlas: '/selected.png',
        iconMapping: {
          selected: { x: 0, y: 0, width: 512, height: 512, anchorY: 512, mask: false }
        },
        getIcon: () => 'selected',
        getColor: [255, 255, 255], // mask: false olduğu için kendi renklerini korurlar
        sizeScale: 1,
        getSize: 40, // Seçili olanlar biraz daha büyük görünebilir (isteğe bağlı)
        pickable: !isLassoActive,
        onClick: (info: any) => {
          if (info.object && !isLassoActive) {
            setPopupInfo(info.object);
          }
        }
      }),
      // Metin Katmanı (Tüm filtrelenmiş veriler için)
      new TextLayer({
        id: 'salesrep-initials',
        data: filteredData,
        getPosition: (d: any) => d.coordinates,
        getText: (d: any) => {
          const name = d.salesrep || '';
          return name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
        },
        getSize: 14,
        getColor: [255, 255, 255],
        getAngle: 0,
        getTextAnchor: 'middle',
        getAlignmentBaseline: 'center',
        getPixelOffset: [0, -20],
        fontFamily: 'Arial, sans-serif',
        fontWeight: 'bold',
        pickable: false,
      })
    ];
  }, [filteredData, isLassoActive, selectedPoints]);

  const handleRowClick = (salesrepName: string) => {
    setSelectedSalesReps(prev => {
      if (prev.includes(salesrepName)) {
        return prev.filter(name => name !== salesrepName);
      } else {
        return [...prev, salesrepName];
      }
    });
  };

const handleZoomToPoint = (pointObj: any) => {
  if (pointObj.coordinates) {
    const [longitude, latitude] = pointObj.coordinates;
    
    setViewState(prev => ({
      ...prev,
      longitude,
      latitude,
      zoom: 17,
      transitionDuration: 1000 // Yumuşak geçiş (flyTo efekti) için sürebilirsiniz
    }));
    
    setPopupInfo(pointObj);
  }
  setContextMenu(null);
};

  // Seçilenlerden kaldırma fonksiyonu
  const handleRemovePoint = (pointId: any) => {
    setSelectedPoints(prev => prev.filter(p => p.id !== pointId));
    setContextMenu(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isLassoActive) return;
    setIsDrawing(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setPixelPath([[e.clientX - rect.left, e.clientY - rect.top]]);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isLassoActive || !isDrawing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPixelPath(prev => [...prev, [e.clientX - rect.left, e.clientY - rect.top]]);
  };

  const handleMouseUp = () => {
    if (!isLassoActive || !isDrawing) return;
    setIsDrawing(false);

    if (pixelPath.length > 2 && mapRef.current) {
      const map = mapRef.current.getMap();
      const lngLatCoords = pixelPath.map(([x, y]) => {
        const lngLat = map.unproject([x, y]);
        return [lngLat.lng, lngLat.lat];
      });

      lngLatCoords.push(lngLatCoords[0]);
      const drawnPolygon = polygon([lngLatCoords]);

      const matched = filteredData.filter(d => 
        booleanPointInPolygon(point(d.coordinates), drawnPolygon)
      );

      setSelectedPoints(matched);
    }
    setPixelPath([]);
  };

  return (
    <div 
      style={{ 
        width: '100vw', 
        height: '100vh', 
        position: 'relative', 
        overflow: 'hidden',
        
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
      
    >
      <DeckGL
          viewState={viewState}
          onViewStateChange={(e: any) => setViewState(e.viewState)}
          controller={!isDrawing}
          layers={[pointsLayer]}getCursor={({ isDragging }) => {
    if (isLassoActive) return 'crosshair';
    return isDragging ? 'grabbing' : 'grab';
  }}
          style={{ width: '100%', height: '100%', position: 'absolute' }}
        >
        <Map
          ref={mapRef}
          reuseMaps
          mapboxAccessToken=""
          mapStyle={{
            version: 8,
            sources: {
              'osm-tiles': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap Contributors'
              }
            },
            layers: [
              {
                id: 'osm-raster-layer',
                type: 'raster',
                source: 'osm-tiles',
                minzoom: 0,
                maxzoom: 19
              }
            ]
          }}
        />
      </DeckGL>

      {/* Lasso Çizgi Katmanı (SVG) */}
      {isLassoActive && pixelPath.length > 0 && (
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
          <polyline
            fill="rgba(24, 144, 255, 0.2)"
            stroke="#1890ff"
            strokeWidth="3"
            strokeDasharray="4"
            points={pixelPath.map(p => p.join(',')).join(' ')}
          />
        </svg>
      )}

      {/* Arayüz Butonları ve Paneller */}
      <div className="absolute top-5 left-5 rounded-lg shadow-lg z-10 flex flex-col gap-4 max-w-xs">
        <div className="bg-white p-1 rounded-lg flex flex-col gap-1.5">
          
          <div><RefreshDataButton/></div>
        </div>
          
        <div id="toplam" className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
          <h3 className="font-bold text-gray-800 mb-1">Tüm Siparişler</h3>
          <p className="text-sm text-gray-600">Tüm Siparişler: <span className="font-bold text-blue-600">{totalCount}</span></p>
          <p className="text-sm text-gray-600">Toplam Koli: <span className="font-bold text-blue-600">{totalQuantity}</span></p>
          <p className="text-sm text-gray-600">Toplam Palet: <span className="font-bold text-blue-600">{totalPallet}</span></p>
        </div>  

        <div className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
          <div className="flex flex-col gap-1 mb-2 border-b pb-2">
            <h3 className="font-bold text-gray-800">Plasiyer Özet Tablosu</h3>
            {selectedSalesReps.length > 0 && (
              <div>
                <button 
                  onClick={() => setSelectedSalesReps([])} 
                  className="text-xs text-red-500 hover:underline cursor-pointer font-medium"
                >
                  Filtreyi Temizle ({selectedSalesReps.length})
                </button>
              </div>
            )}
          </div>
          
          {salesRepSummary && salesRepSummary.length > 0 ? (
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs text-gray-600 border-collapse">
                <thead>
                  <tr className="border-b text-gray-400">
                    <th className="py-1">Nokta</th>
                    <th className="py-1">Plasiyer</th>
                    <th className="py-1 text-right">Koli</th>
                    <th className="py-1 text-right">Palet</th>
                  </tr>
                </thead>
                <tbody>
                  {salesRepSummary.map((item: any, index: number) => {
                    const isSelected = selectedSalesReps.includes(item.salesrep);
                    return (
                      <tr 
                        key={index} 
                        onClick={() => handleRowClick(item.salesrep)}
                        className={`border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50 font-semibold' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="py-1.5 font-medium text-gray-700">{item.totalCustomers}</td>
                        <td className="py-1.5 font-medium text-gray-700 flex items-center gap-1">
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>}
                          {item.salesrep}
                        </td>
                        <td className="py-1.5 text-right font-bold text-blue-600">{item.totalQuantity}</td>
                        <td className="py-1.5 text-right font-bold text-blue-600">{item.totalPallet?.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Veri yok.</p>
          )}
        </div>
          {popupInfo && (
        <div className=" bg-white p-4 rounded-lg shadow-lg z-10 min-w-[200px] border border-gray-100">
          <h4 className="font-bold text-gray-800 border-b pb-1 mb-2">Müşteri Detayı</h4>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-semibold text-gray-700">İsim:</span> {popupInfo.customer}
          </p>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-semibold text-gray-700">Id:</span> {popupInfo.id}
          </p>
          <p className="text-sm text-gray-600 mb-3">
            <span className="font-semibold text-gray-700">Plasiyer:</span> {popupInfo.salesrep}
          </p>
          <p className="text-sm text-gray-600 mb-3">
            <span className="font-semibold text-gray-700">Toplam Koli:</span> {popupInfo.totalQuantity}
          </p>
          <p className="text-sm text-gray-600 mb-3">
            <span className="font-semibold text-gray-700">Toplam Palet:</span> {popupInfo.totalPallet.toFixed(2)}
          </p>

          <div className="flex flex-col gap-2">
            {/* Dinamik Seçilenlere Ekle / Kaldır Butonu */}
            {(() => {
              const isSelected = selectedPoints.some(p => p.id === popupInfo.id);
              return (
                <button 
                  onClick={() => handleToggleSelectPoint(popupInfo)}
                  className={`w-full text-xs font-semibold py-1.5 px-3 rounded transition-colors cursor-pointer text-white ${
                    isSelected 
                      ? 'bg-red-500 hover:bg-red-600' 
                      : 'bg-blue-500 hover:bg-blue-600'
                  }`}
                >
                  {isSelected ? '❌ Seçilenlerden Kaldır' : '➕ Seçilenlere Ekle'}
                </button>
              );
            })()}

            <button 
              onClick={() => setPopupInfo(null)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-1.5 px-3 rounded transition-colors cursor-pointer"
            >
              Kapat
            </button>
          </div>
        </div>
      )}
      </div>

      <div id="secilenler" className="absolute top-5 right-5 z-10 flex flex-col gap-4 max-w-xs">
        <div className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
          <h3 className="font-bold text-gray-800 mb-1">Lasso Seçim Özeti</h3>
          <p className="text-sm text-gray-600">Seçilen Müşteri Sayısı: <span className="font-bold text-blue-600">{selectedPoints.length}</span></p>
          <p className="text-sm text-gray-600">Seçilen Toplam Koli: <span className="font-bold text-blue-600">{selectedPoints.reduce((acc, p) => acc + (p.totalQuantity || 0), 0)}</span></p>
          <p className="text-sm text-gray-600">Seçilen Toplam Palet: <span className="font-bold text-blue-600">{selectedPoints.reduce((acc, p) => acc + (p.totalPallet || 0), 0).toFixed(2)}</span></p>
          <div className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
   <div 
  onClick={() => setShowOutOfBounds(!showOutOfBounds)}
  className="cursor-pointer select-none flex justify-between items-center"
>
  <p className={`text-sm ${outOfPalletInfo.length === 0 ? 'text-blue-600' : 'text-red-600'}`}>
    Palet verisi olmayan <br></br> ürünler:{' '}
    <span className={`font-bold ${outOfPalletInfo.length === 0 ? 'text-blue-600' : 'text-red-600'}`}>
      {outOfPalletInfo.length}
    </span>
  </p>
  <span className={`text-xs font-semibold ${outOfPalletInfo.length === 0 ? 'text-blue-500' : 'text-red-500'}`}>
    {showOutOfBounds ? '▲ Gizle' : '▼ Göster'}
  </span>
</div>

  {/* Eğer tıklandıysa açılan liste */}
  {showOutOfBounds && (
    <ul className="max-h-36 overflow-y-auto pl-4 mt-2 text-sm text-gray-700 border-t pt-2">
      {outOfPalletInfo.map((p: any) => (
        <li 
          key={p.id} 
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, point: p });
          }}
          className="list-disc cursor-pointer hover:text-blue-600 transition-colors select-none py-0.5"
          title="İşlem için sağ tıklayın"
        >
          {p.product_code} ürün kodu , {p.PaletSayisi?.toFixed(2)} Koli
        </li>
      ))}
    </ul>
  )}
  
  <div 
  onClick={() => setShowOutOfBounds(!showOutOfBounds)}
  className="cursor-pointer select-none flex justify-between items-center"
>
  <p className={`text-sm ${outOfBoundsDf.length === 0 ? 'text-blue-600' : 'text-red-600'}`}>
    Konumu olmayan <br></br> müşteriler:{' '}
    <span className={`font-bold ${outOfBoundsDf.length === 0 ? 'text-blue-600' : 'text-red-600'}`}>
      {outOfBoundsDf.length}
    </span>
  </p>
  <span className={`text-xs font-semibold ${outOfBoundsDf.length === 0 ? 'text-blue-500' : 'text-red-500'}`}>
    {showOutOfBounds ? '▲ Gizle' : '▼ Göster'}
  </span>
</div>

  {/* Eğer tıklandıysa açılan liste */}
  {showOutOfBounds && (
    <ul className="max-h-36 overflow-y-auto pl-4 mt-2 text-sm text-gray-700 border-t pt-2">
      {outOfBoundsDf.map((p: any) => (
        <li 
          key={p.id} 
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY, point: p });
          }}
          className="list-disc cursor-pointer hover:text-blue-600 transition-colors select-none py-0.5"
          title="İşlem için sağ tıklayın"
        >
          {p.totalQuantity} koli, {p.totalPallet?.toFixed(2)} palet {p.id} {p.customer} ({p.salesrep})
        </li>
      ))}
    </ul>
  )}
</div>
         </div>
         <div className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
          <h4 className="font-bold text-gray-800 mb-1">Seçilen Müşteriler</h4>
          <button 
            onClick={() => {
              setIsLassoActive(!isLassoActive);
              //setSelectedPoints([]);
              setPixelPath([]);
            }}
            className={`px-2 py-2 rounded-md font-bold text-white transition-colors cursor-pointer w-full ${
              isLassoActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
            }`}
          >
            {isLassoActive ? 'Lasso Modunu Kapat' : 'Lasso ile Alan Seç'}
          </button>
          <ul className="max-h-36 overflow-y-auto pl-4 mt-2 text-sm text-gray-700">
  {selectedPoints
    .slice() // Orijinal diziyi mutasyona uğratmamak (bozmamak) için kopyalıyoruz
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .map(p => (
      <li 
        key={p.id} 
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, point: p });
        }}
        className="list-disc cursor-pointer hover:text-blue-600 transition-colors select-none py-0.5"
        title="İşlem için sağ tıklayın"
      >
        {p.totalQuantity} koli, {p.totalPallet?.toFixed(2)} palet {p.id} {p.customer} ({p.salesrep})
      </li>
    ))}
</ul>
        </div>
      </div>

      {/* Sağ Tık Özel Açılır Menüsü (Context Menu) */}
      {contextMenu && (
        <div 
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="absolute z-50 bg-white shadow-xl rounded-md border border-gray-200 py-1 min-w-[160px] text-xs text-gray-700"
        >
          <button
            onClick={() => handleZoomToPoint(contextMenu.point)}
            className="w-full text-left px-3 py-2 hover:bg-blue-50 hover:text-blue-600 font-medium transition-colors flex items-center gap-2 cursor-pointer"
          >
            📍 Haritada Bul / Yakınlaştır
          </button>
          <button
            onClick={() => handleRemovePoint(contextMenu.point.id)}
            className="w-full text-left px-3 py-2 hover:bg-red-50 hover:text-red-600 font-medium transition-colors flex items-center gap-2 cursor-pointer border-t border-gray-100"
          >
            ❌ Seçilenlerden Kaldır
          </button>
        </div>
      )}

      
      {/*Tüm Siparişler */}
      <div className="absolute bottom-5 right-5 bg-white p-4 rounded-lg shadow-lg z-10 min-w-[200px] border border-gray-100">
  {allCustomer && (  
    <div className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs mb-3">
      <h4 className="font-bold text-gray-800 mb-1">Tüm Müşteriler</h4>
      <ul className="max-h-36 overflow-y-auto pl-4 mt-2 text-sm text-gray-700">
        {initialData
          .slice() // Orijinal diziyi mutasyona uğratmamak için kopyalıyoruz
          .sort((a, b) => b.totalQuantity - a.totalQuantity) // Eksik olan '-' operatörü eklendi
          .map(p => (
            <li 
              key={p.id} 
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, point: p });
              }}
              className="list-disc cursor-pointer hover:text-blue-600 transition-colors select-none py-0.5"
              title="İşlem için sağ tıklayın"
            >
              {p.totalQuantity} koli, {p.totalPallet?.toFixed(2)} palet {p.id} {p.customer} ({p.salesrep})
            </li>
          ))}
      </ul>
    </div>
  )}
  
  <button 
    onClick={() => setAllCustomer(!allCustomer)} 
    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-1.5 px-3 rounded transition-colors cursor-pointer"
  >
    {allCustomer ? "Gizle" : "Tüm Müşteriler"}
  </button>
</div>
      
    </div>
  );
}