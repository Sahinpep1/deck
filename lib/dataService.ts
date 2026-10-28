'use server';

import 'server-only';

const API_BASE = "http://localhost:4000/api";
const SUBE = "antakya"; // Veya dinamik gelen şube parametresi

export async function getMapData() {
  try {
    const res = await fetch(`${API_BASE}/${SUBE}/map-data`, { cache: 'no-store' });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

export async function getSalesRepSummary() {
  try {
    const res = await fetch(`${API_BASE}/${SUBE}/sales-summary`, { cache: 'no-store' });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

export async function getOutOfBoundsDf() {
  try {
    const res = await fetch(`${API_BASE}/${SUBE}/out-of-bounds`, { cache: 'no-store' });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}

export async function getOutOfPalletInfo() {
  try {
    const res = await fetch(`${API_BASE}/${SUBE}/out-of-pallet`, { cache: 'no-store' });
    const json = await res.json();
    return json.success ? json.data : [];
  } catch (error) {
    console.error('API Error:', error);
    return [];
  }
}