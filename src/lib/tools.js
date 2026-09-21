import { Link2, Type, Wifi, Mail, MessageSquare, UserSquare2, Phone, Barcode } from 'lucide-react';

export const TOOLS = [
  { slug: 'url-qr-code', name: 'URL QR Code', description: 'Turn any link into a scannable QR code.', icon: Link2 },
  { slug: 'text-qr-code', name: 'Text QR Code', description: 'Encode any plain text into a QR code.', icon: Type },
  { slug: 'wifi-qr-code', name: 'WiFi QR Code', description: 'Let guests join your WiFi by scanning — no typing a password.', icon: Wifi },
  { slug: 'email-qr-code', name: 'Email QR Code', description: 'A scan opens a pre-filled email, ready to send.', icon: Mail },
  { slug: 'sms-qr-code', name: 'SMS QR Code', description: 'A scan opens a pre-filled text message.', icon: MessageSquare },
  { slug: 'vcard-qr-code', name: 'vCard (Contact) QR Code', description: 'Share a contact card that saves straight to the phone.', icon: UserSquare2 },
  { slug: 'phone-qr-code', name: 'Phone Number QR Code', description: 'A scan starts a call to the number.', icon: Phone },
  { slug: 'barcode-generator', name: 'Barcode Generator', description: 'Generate CODE128, EAN-13, and UPC barcodes.', icon: Barcode },
];

export function getTool(slug) {
  return TOOLS.find((t) => t.slug === slug);
}
