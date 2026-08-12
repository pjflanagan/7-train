import { NextResponse } from 'next/server';

export const revalidate = 1800;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  let lat = searchParams.get('lat');
  let lon = searchParams.get('lon');
  let city = 'Detected Location';

  if (!lat || !lon) {
    const headLat = request.headers.get('x-vercel-ip-latitude');
    const headLon = request.headers.get('x-vercel-ip-longitude');
    const headCity = request.headers.get('x-vercel-ip-city');

    if (headLat && headLon) {
      lat = headLat;
      lon = headLon;
      if (headCity) city = decodeURIComponent(headCity);
    } else {
      return NextResponse.json({ error: 'Location required' }, { status: 400 });
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
    } catch (e) {
      // Ignore geo errors
    }
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max&timezone=auto`;
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
      unit: '°C',
      days
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 500 });
  }
}
