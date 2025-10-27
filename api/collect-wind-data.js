/**
 * Vercel Serverless Function to collect wind data
 * Triggered by Vercel Cron every 5 minutes
 */

import { createClient } from '@supabase/supabase-js';

// Wind utility functions (copied from frontend)
const mphToKnots = (mph) => mph * 0.868976;

const getWindSafety = (windDir, windSpeedKnots) => {
  // Offshore wind (dangerous): 225-315 degrees (SW to NW)
  const isOffshore = windDir >= 225 && windDir <= 315;

  // Onshore wind (safe): 45-135 degrees (NE to SE)
  const isOnshore = windDir >= 45 && windDir <= 135;

  // Determine safety level
  let level, text, color;

  if (isOffshore || windSpeedKnots > 30) {
    level = 'danger';
    text = 'Опасно - Оффшор';
    color = '#ef4444'; // red
  } else if (isOnshore && windSpeedKnots >= 12 && windSpeedKnots <= 25) {
    level = 'safe';
    text = 'Безопасно - Оншор';
    color = '#10b981'; // green
  } else {
    level = 'caution';
    text = 'Осторожно';
    color = '#f59e0b'; // orange
  }

  return {
    level,
    text,
    color,
    isOffshore,
    isOnshore
  };
};

export default async function handler(req, res) {
  // Verify cron secret for security
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Fetch wind data from Ambient Weather
    const ambientWeatherUrl = 'https://api.ambientweather.net/v1/devices?applicationKey=8e140defbbc64d8e921ec0e22f18e0e03f73e2c7d88e42ca92c1eeda73b681d4&apiKey=8e140defbbc64d8e921ec0e22f18e0e03f73e2c7d88e42ca92c1eeda73b681d4';

    const response = await fetch(ambientWeatherUrl);

    if (!response.ok) {
      throw new Error(`Ambient Weather API error: ${response.status}`);
    }

    const devices = await response.json();

    if (!devices || devices.length === 0) {
      throw new Error('No devices found');
    }

    const device = devices[0];
    const lastData = device.lastData;

    // Convert and process data
    const windSpeedKnots = lastData.windspeedmph ? mphToKnots(lastData.windspeedmph) : null;
    const windGustKnots = lastData.windgustmph ? mphToKnots(lastData.windgustmph) : null;
    const maxGustKnots = lastData.maxdailygust ? mphToKnots(lastData.maxdailygust) : null;
    const windDir = lastData.winddir || null;
    const windDirAvg = lastData.winddir_avg10m || windDir;

    // Calculate safety
    const safety = getWindSafety(windDirAvg, windSpeedKnots);

    // Prepare data for database
    const windMeasurement = {
      timestamp: new Date(lastData.dateutc || lastData.date).toISOString(),
      wind_speed_knots: windSpeedKnots,
      wind_gust_knots: windGustKnots,
      max_gust_knots: maxGustKnots,
      wind_direction: windDir,
      wind_direction_avg: windDirAvg,
      temperature_f: lastData.tempf || null,
      humidity: lastData.humidity || null,
      pressure: lastData.baromrelin || null,
      safety_level: safety.level,
      safety_text: safety.text,
      safety_color: safety.color,
      is_offshore: safety.isOffshore,
      is_onshore: safety.isOnshore,
      data_source: 'ambient_weather'
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from('wind_measurements')
      .insert([windMeasurement])
      .select();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    console.log('✓ Wind data collected successfully:', data);

    return res.status(200).json({
      success: true,
      message: 'Wind data collected successfully',
      data: data[0]
    });

  } catch (error) {
    console.error('Error collecting wind data:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
