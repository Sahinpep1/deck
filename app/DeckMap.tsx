'use client';

import React, { useState, useRef, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { Map, MapRef } from 'react-map-gl/maplibre';
import { IconLayer ,TextLayer } from '@deck.gl/layers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { polygon, point } from '@turf/helpers';

import * as maplibregl from 'maplibre-gl'; 
import 'maplibre-gl/dist/maplibre-gl.css';


const INITIAL_VIEW_STATE = {
  longitude: 36.1633,
  latitude: 36.2023,
  zoom: 12,
  pitch: 0,
  bearing: 0
};

// Plasiyer Renkleri
const SALESREP_COLORS: Record<string, [number, number, number]> = {
  'Ahmet Yılmaz': [255, 99, 71],   // Kırmızı
  'Mehmet Demir': [30, 144, 255],  // Mavi
  'Ayşe Kaya': [60, 179, 113],    // Yeşil
};

const INITIAL_DATA = [
  { id: 1, coordinates: [36.1600, 36.2000], salesrep: 'Mehmet Demir', customer: 'Market A' },
  { id: 2, coordinates: [36.1700, 36.2100], salesrep: 'Mehmet Demir', customer: 'Market B' },
  { id: 3, coordinates: [36.1500, 36.1900], salesrep: 'Ayşe Kaya', customer: 'Market C' },
];
const getInitials = (name: string) => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2); // En fazla 2 harf (MD, AY vb.)
};

export default function DeckMap({ selectedPoints, onSelectionChange }: { selectedPoints: any[], onSelectionChange: (points: any[]) => void }) {
  const [myData] = useState(INITIAL_DATA);
  
  const [popupInfo, setPopupInfo] = useState<any>(null);

  const [isLassoActive, setIsLassoActive] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pixelPath, setPixelPath] = useState<Array<[number, number]>>([]);

  const mapRef = useRef<MapRef>(null);

const pointsLayer = useMemo(() => {
  return [
    // 1. Pin Katmanı
    new IconLayer({
      id: 'salesrep-points',
      data: myData,
      getPosition: (d: any) => d.coordinates,
      iconAtlas: '/marker.png', 
      iconMapping: {
        marker: { 
          x: 0, 
          y: 0, 
          width: 512, 
          height: 512, 
          anchorY: 512, 
          mask: true 
        }
      },
      getIcon: () => 'marker',
      getColor: (d: any) => SALESREP_COLORS[d.salesrep] || [150, 150, 150],
      sizeScale: 1,
      getSize: 35,
      pickable: !isLassoActive,
      onClick: (info: any) => {
        if (info.object && !isLassoActive) {
          setPopupInfo(info.object);
        }
      }
    }),

    // 2. Baş Harf Yazı Katmanı
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
      pickable: false, // Yazıların tıklanmasını engeller, tıklama altındaki pine gider
    })
  ];
}, [myData, isLassoActive]); // <-- Dikkat: Tüm bağımlılıklar burada eksiksiz olmalı!

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

      onSelectionChange(matched);
    }
    setPixelPath([]);
  };

  return (
    <div className='grid grid-cols-2 relative'>
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
          // Standart OpenStreetMap Raster katmanı (Sokaklar ve detaylar tam görünür)
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

      {/* Arayüz Butonları ve Paneller (Tailwind ile) */}
      <div className="absolute top-5 left-5 bg-white p-3 rounded-lg shadow-lg z-10">
        <button 
          onClick={() => {
            setIsLassoActive(!isLassoActive);
            onSelectionChange([]);
            setPixelPath([]);
          }}
          className={`px-4 py-2 rounded-md font-bold text-white transition-colors cursor-pointer ${
            isLassoActive ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          {isLassoActive ? 'Lasso Modunu Kapat' : 'Lasso ile Alan Seç'}
        </button>
      </div>
    <div className='absolute top-5 right-5 z-10 flex flex-col gap-4 max-w-xs'>
          <div className=" bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
        <h3 className="font-bold text-gray-800 mb-1">Lasso Seçim Özeti</h3>
        <p className="text-sm text-gray-600">Seçilen Müşteri Sayısı: <span className="font-bold text-blue-600">{selectedPoints.length}</span></p>
        <ul className="max-h-36 overflow-y-auto pl-4 mt-2 text-sm text-gray-700">
          {selectedPoints.map(p => (
            <li key={p.id} className="list-disc">{p.customer} ({p.salesrep})</li>
          ))}
        </ul>
      </div>
      <div className=" bg-white p-4 rounded-lg shadow-lg z-10 max-w-xs">
        <h3 className="font-bold text-gray-800 mb-1">bU SADECE DENEME</h3>
        
      </div>
    </div>
      

      {popupInfo && (
        <div className="absolute bottom-5 left-5 bg-white p-4 rounded-lg shadow-lg z-10 min-w-[200px] border border-gray-100">
          <h4 className="font-bold text-gray-800 border-b pb-1 mb-2">Müşteri Detayı</h4>
          <p className="text-sm text-gray-600 mb-1">
            <span className="font-semibold text-gray-700">İsim:</span> {popupInfo.customer}
          </p>
          <p className="text-sm text-gray-600 mb-3">
            <span className="font-semibold text-gray-700">Plasiyer:</span> {popupInfo.salesrep}
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
    </div>
   
  );
}