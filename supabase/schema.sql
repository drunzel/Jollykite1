-- JollyKite Wind Data Schema
-- Create table for storing wind measurements

CREATE TABLE IF NOT EXISTS wind_measurements (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Wind data
  wind_speed_knots DECIMAL(5,2),
  wind_gust_knots DECIMAL(5,2),
  max_gust_knots DECIMAL(5,2),
  wind_direction INTEGER CHECK (wind_direction >= 0 AND wind_direction <= 360),
  wind_direction_avg INTEGER CHECK (wind_direction_avg >= 0 AND wind_direction_avg <= 360),

  -- Weather data
  temperature_f DECIMAL(5,2),
  humidity INTEGER CHECK (humidity >= 0 AND humidity <= 100),
  pressure DECIMAL(6,2),

  -- Safety info
  safety_level VARCHAR(20),
  safety_text TEXT,
  safety_color VARCHAR(20),
  is_offshore BOOLEAN,
  is_onshore BOOLEAN,

  -- Metadata
  data_source VARCHAR(50) DEFAULT 'ambient_weather',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on timestamp for fast queries
CREATE INDEX IF NOT EXISTS idx_wind_measurements_timestamp
ON wind_measurements(timestamp DESC);

-- Create index on created_at
CREATE INDEX IF NOT EXISTS idx_wind_measurements_created_at
ON wind_measurements(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE wind_measurements ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access
CREATE POLICY "Allow public read access"
ON wind_measurements
FOR SELECT
TO public
USING (true);

-- Create policy to allow insert from authenticated service role only
CREATE POLICY "Allow service role insert"
ON wind_measurements
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create view for latest measurements
CREATE OR REPLACE VIEW latest_wind_measurement AS
SELECT * FROM wind_measurements
ORDER BY timestamp DESC
LIMIT 1;

-- Create view for hourly averages
CREATE OR REPLACE VIEW hourly_wind_stats AS
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(wind_speed_knots) as avg_wind_speed,
  MAX(wind_gust_knots) as max_gust,
  AVG(wind_direction) as avg_direction,
  AVG(temperature_f) as avg_temperature,
  COUNT(*) as measurement_count
FROM wind_measurements
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp)
ORDER BY hour DESC;

-- Create function to cleanup old data (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_measurements()
RETURNS void AS $$
BEGIN
  DELETE FROM wind_measurements
  WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
