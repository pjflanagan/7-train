import { NextResponse } from 'next/server';

export const revalidate = 1800;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const unitParam = searchParams.get('unit') || 'F';
  
  let lat = searchParams.get('lat');
  let lon = searchParams.get('lon');
  let city = 'Detected location';

  if (!lat || !lon) {
    const headLat = request.headers.get('x-vercel-ip-latitude');
    const headLon = request.headers.get('x-vercel-ip-longitude');
    const headCity = request.headers.get('x-vercel-ip-city');

    if (headLat && headLon) {
      lat = headLat;
      lon = headLon;
      if (headCity) city = decodeURIComponent(headCity);
    } else {
      // Running locally: attempt coarse IP geolocation, default to New York if blocked/fail
      try {
        const ipRes = await fetch('https://ipapi.co/json/', { next: { revalidate: 3600 } });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            lat = String(ipData.latitude);
            lon = String(ipData.longitude);
            city = ipData.city || 'Detected location';
          }
        }
      } catch {
        // Ignore ipapi errors
      }

      // Final default if ipapi failed or coordinates were not resolved
      if (!lat || !lon) {
        lat = '40.7128';
        lon = '-74.0060';
        city = 'New York';
      }
    }
  } else {
    // If coords were provided by client, try a quick reverse geocode
    try {
      const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`, { next: { revalidate: 86400 } });
      if (geoRes.ok) {
        const geoData = await geoRes.json();
        if (geoData.city) city = geoData.city;
        else if (geoData.locality) city = geoData.locality;
      }
    } catch {
      // Ignore geo errors
    }
  }

  try {
    const tempUnitQuery = unitParam.toUpperCase() === 'C' ? 'celsius' : 'fahrenheit';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&timezone=auto&forecast_days=16&temperature_unit=${tempUnitQuery}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) throw new Error('Weather API failed');
    const data = await res.json();

    const days = data.daily.time.map((time: string, idx: number) => ({
      date: time,
      code: data.daily.weathercode[idx],
      tempMax: Math.round(data.daily.temperature_2m_max[idx])
    }));

    return NextResponse.json({
      location: { city, lat: parseFloat(lat), lon: parseFloat(lon) },
      unit: unitParam.toUpperCase() === 'C' ? '°C' : '°F',
      days
    });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
