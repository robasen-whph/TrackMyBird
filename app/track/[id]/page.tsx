'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { SkyKeyApp } from '@/app/components/SkyKeyApp';

export default function TrackPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const guestToken = searchParams.get('guest');

  // Pass the ID and guest token to SkyKeyApp
  // SkyKeyApp will auto-detect whether it's a tail or hex
  // and handle navigation based on guest token presence
  return <SkyKeyApp initialId={id} guestToken={guestToken} />;
}
