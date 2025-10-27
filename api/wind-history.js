/**
 * Vercel Serverless Function to get wind history
 * Public API endpoint for frontend
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Initialize Supabase client (using anon key for public access)
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Parse query parameters
    const { limit = 100, hours = 24 } = req.query;

    // Calculate time range
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - parseInt(hours));

    // Fetch wind measurements
    const { data, error } = await supabase
      .from('wind_measurements')
      .select('*')
      .gte('timestamp', startTime.toISOString())
      .order('timestamp', { ascending: false })
      .limit(parseInt(limit));

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    // Get latest measurement
    const latest = data && data.length > 0 ? data[0] : null;

    // Calculate statistics
    const stats = data && data.length > 0 ? {
      count: data.length,
      avgWindSpeed: (data.reduce((sum, m) => sum + (m.wind_speed_knots || 0), 0) / data.length).toFixed(2),
      maxGust: Math.max(...data.map(m => m.wind_gust_knots || 0)).toFixed(2),
      minWindSpeed: Math.min(...data.filter(m => m.wind_speed_knots).map(m => m.wind_speed_knots)).toFixed(2),
      maxWindSpeed: Math.max(...data.map(m => m.wind_speed_knots || 0)).toFixed(2)
    } : null;

    return res.status(200).json({
      success: true,
      latest,
      history: data,
      stats,
      meta: {
        count: data.length,
        hours: parseInt(hours),
        timeRange: {
          from: startTime.toISOString(),
          to: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Error fetching wind history:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
