'use client';

import { Button } from '@enclaveid/ui/button';
import { HEADER } from '../constants/landing-page';
import { getCurrentUser } from '../actions/getCurrentUser';
import Link from 'next/link';
import { useEffect } from 'react';
import { useState } from 'react';

export function LandingButton() {
  const [user, setUser] = useState<Awaited<
    ReturnType<typeof getCurrentUser>
  > | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getCurrentUser();
      setUser(user);
    };
    fetchUser();
  }, []);

  return user ? (
    <Link href="/dashboard/home">
      <Button size="sm">Dashboard</Button>
    </Link>
  ) : (
    <Link href="/login">
      <Button size="sm">{HEADER.LOGIN_BUTTON_TEXT}</Button>
    </Link>
  );
}
