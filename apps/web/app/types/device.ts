export interface DeviceSession {
  key: string;
  name: string;
  ip: string | null;
  last_used_at: string | null;
  is_current: boolean;
  is_bot: boolean;
  device: { type: string | null; brand: string | null; model: string | null };
  os: { name: string | null; version: string | null; platform: string | null };
  client: {
    type: string | null;
    name: string | null;
    version: string | null;
    engine: string | null;
    engine_version: string | null;
  };
}
