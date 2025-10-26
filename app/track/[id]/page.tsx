'use client';

import { useParams } from 'next/navigation';
import { SkyKeyApp } from '@/app/components/SkyKeyApp';

export default function TrackPage() {
  const params = useParams();
  const id = params.id as string;

  // Pass the ID as initialTail or initialHex to SkyKeyApp
  // SkyKeyApp will auto-detect whether it's a tail or hex
  return <SkyKeyApp initialId={id} />;
}
