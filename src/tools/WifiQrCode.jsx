import React, { useState } from 'react';
import QRPreviewPanel from '@/components/QRPreviewPanel';

// The WIFI: URI format requires ;,":\ to be backslash-escaped inside each field.
function escapeWifi(s) {
  return s.replace(/([\\;,":])/g, '\\$1');
}

function buildWifiPayload({ ssid, password, security, hidden }) {
  if (!ssid) return '';
  if (security === 'nopass') return `WIFI:T:nopass;S:${escapeWifi(ssid)};H:${hidden ? 'true' : 'false'};;`;
  return `WIFI:T:${security};S:${escapeWifi(ssid)};P:${escapeWifi(password)};H:${hidden ? 'true' : 'false'};;`;
}

export default function WifiQrCode() {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [security, setSecurity] = useState('WPA');
  const [hidden, setHidden] = useState(false);

  const value = buildWifiPayload({ ssid, password, security, hidden });

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Network name (SSID)</label>
          <input value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder="MyHomeWiFi" className="input-soft" autoFocus />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Security</label>
          <select value={security} onChange={(e) => setSecurity(e.target.value)} className="input-soft">
            <option value="WPA">WPA/WPA2/WPA3</option>
            <option value="WEP">WEP</option>
            <option value="nopass">None (open network)</option>
          </select>
        </div>
        {security !== 'nopass' && (
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase text-muted-foreground">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Network password" className="input-soft" />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} className="h-4 w-4 rounded border-border" /> Hidden network</label>
      </div>
      <QRPreviewPanel value={value} />
    </div>
  );
}
