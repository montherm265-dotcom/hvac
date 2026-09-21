import React, { Suspense, lazy } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { getTool } from '@/lib/tools';
import ToolShell from '@/components/ToolShell';

const COMPONENTS = {
  'url-qr-code': lazy(() => import('@/tools/UrlQrCode')),
  'text-qr-code': lazy(() => import('@/tools/TextQrCode')),
  'wifi-qr-code': lazy(() => import('@/tools/WifiQrCode')),
  'email-qr-code': lazy(() => import('@/tools/EmailQrCode')),
  'sms-qr-code': lazy(() => import('@/tools/SmsQrCode')),
  'vcard-qr-code': lazy(() => import('@/tools/VcardQrCode')),
  'phone-qr-code': lazy(() => import('@/tools/PhoneQrCode')),
  'barcode-generator': lazy(() => import('@/tools/BarcodeGenerator')),
};

export default function ToolPage() {
  const { slug } = useParams();
  const tool = getTool(slug);
  const Component = COMPONENTS[slug];

  if (!tool || !Component) return <Navigate to="/" replace />;

  return (
    <ToolShell tool={tool}>
      <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-accent" /></div>}>
        <Component />
      </Suspense>
    </ToolShell>
  );
}
