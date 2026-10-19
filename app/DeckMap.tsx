'use client';

import React, { useState, useRef, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map, MapRef } from 'react-map-gl/maplibre';
import { IconLayer, TextLayer } from '@deck.gl/layers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { polygon, point } from '@turf/helpers';

import 'maplibre-gl/dist/maplibre-gl.css';

const INITIAL_VIEW_STATE = {
  longitude: 36.1633,
  latitude: 36.2023,
  zoom: 12,
  pitch: 0,
  bearing: 0
};

/**
 * Plasiyer isminden dinamik, tutarlı ve okunabilir bir RGB renk üretir.
 */
const getSalesRepColor = (name: string): [number, number, number] => {
  if (!name) return [150, 150, 150]; // İsim yoksa gri
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Renklerin çok karanlık veya soluk olmaması için HSL mantığına benzer bir taban seçiyoruz
  const r = (hash & 0xFF) % 180 + 50;     // 50 ile 230 arası
  const g = ((hash >> 8) & 0xFF) % 180 + 50; 
  const b = ((hash >> 16) & 0xFF) % 180 + 50;

  return [r, g, b];
};

export default function DeckMap({ initialData , salesRepSummary }: { initialData: any[]; salesRepSummary: any[] }) {
  const [myData] = useState(initialData || []);
  const [selectedPoints, setSelectedPoints] = useState<any[]>([]);
  //console.log("myData içeriği:", myData);
  //console.log("İlk elemanın parametreleri:", myData[0]);
  const [popupInfo, setPopupInfo] = useState<any>(null);
  const [isLassoActive, setIsLassoActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pixelPath, setPixelPath] = useState<Array<[number, number]>>([]);

  const mapRef = useRef<MapRef>(null);

  const pointsLayer = useMemo(() => {
    return [
      new IconLayer({
        id: 'salesrep-points',
        data: myData,
        getPosition: (d: any) => d.coordinates,
        iconAtlas: '/marker.png', 
        iconMapping: {
          marker: { x: 0, y: 0, width: 512, height: 512, anchorY: 512, mask: true }
        },
        getIcon: () => 'marker',
        // Dinamik renk fonksiyonu her plasiyer için otomatik renk üretir
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
      new TextLayer({
        id: 'salesrep-initials',
        data: myData,
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
  }, [myData, isLassoActive]);

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

      const matched = myData.filter(d => 
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
        cursor: isLassoActive ? 'crosshair' : 'default' 
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <DeckGL
        initialViewState={INITIAL_VIEW_STATE}
        controller={!isDrawing}
        layers={[pointsLayer]}
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
        <div className=" bg-white p-1 rounded-lg">
          <button 
          onClick={() => {
            setIsLassoActive(!isLassoActive);
            setSelectedPoints([]);
            setPixelPath([]);
          }}
          className={`px-4 py-2 rounded-md font-bold text-white transition-colors cursor-pointer ${
            isLassoActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isLassoActive ? 'Lasso Modunu Kapat' : 'Lasso ile Alan Seç'}
        </button>
        </div>
        <div id ="toplam" className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
          <h3 className="font-bold text-gray-800 mb-1">Tüm Siparişler</h3>
          <p className="text-sm text-gray-600">Tüm Siparişler: <span className="font-bold text-blue-600">{myData.length}</span></p>
          <p className="text-sm text-gray-600">Toplam Koli: <span className="font-bold text-blue-600">{myData.reduce((acc, p) => acc + (p.totalQuantity || 0), 0)}</span></p>
          <p className="text-sm text-gray-600">Toplam Palet: <span className="font-bold text-blue-600">{myData.reduce((acc, p) => acc + (p.totalPallet || 0), 0).toFixed(2)}</span></p>
        </div>  
        <div className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
  <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">Plasiyer Özet Tablosu</h3>
  
  {salesRepSummary && salesRepSummary.length > 0 ? (
    <div className="max-h-60 overflow-y-auto">
      <table className="w-full text-left text-xs text-gray-600 border-collapse">
        <thead>
          <tr className="border-b text-gray-400">
            <th className="py-1">Plasiyer</th>
            <th className="py-1 text-right">Koli</th>
            <th className="py-1 text-right">Palet</th>
          </tr>
        </thead>
        <tbody>
          {salesRepSummary.map((item: any, index: number) => (
            <tr key={index} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
              <td className="py-1.5 font-medium text-gray-700">{item.salesrep}</td>
              <td className="py-1.5 text-right font-bold text-blue-600">{item.totalQuantity}</td>
              <td className="py-1.5 text-right font-bold text-blue-600">{item.totalPallet?.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="text-xs text-gray-400">Veri yok.</p>
  )}
</div>
      </div>

      <div id="secilenler" className="absolute top-5 right-5 z-10 flex flex-col gap-4 max-w-xs">
        <div className="bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
          <h3 className="font-bold text-gray-800 mb-1">Lasso Seçim Özeti</h3>
          <p className="text-sm text-gray-600">Seçilen Müşteri Sayısı: <span className="font-bold text-blue-600">{selectedPoints.length}</span></p>
          <p className="text-sm text-gray-600">Seçilen Toplam Koli: <span className="font-bold text-blue-600">{selectedPoints.reduce((acc, p) => acc + (p.totalQuantity || 0), 0)}</span></p>
          <p className="text-sm text-gray-600">Seçilen Toplam Palet: <span className="font-bold text-blue-600">{selectedPoints.reduce((acc, p) => acc + (p.totalPallet || 0), 0).toFixed(2)}</span></p>
          <ul className="max-h-36 overflow-y-auto pl-4 mt-2 text-sm text-gray-700">
            {selectedPoints.map(p => (
              <li key={p.id} className="list-disc">{p.customer} ({p.salesrep})</li>
            ))}
          </ul>
        </div>
        {/* buraya başka bir panel eklenebilir */}   
      </div>

      {popupInfo && (
        <div className="absolute bottom-5 left-5 bg-white p-4 rounded-lg shadow-lg z-10 min-w-[200px] border border-gray-100">
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
          <button 
            onClick={() => setPopupInfo(null)}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold py-1.5 px-3 rounded transition-colors cursor-pointer"
          >
            Kapat
          </button>
        </div>
      )}
    </div>
  );
}