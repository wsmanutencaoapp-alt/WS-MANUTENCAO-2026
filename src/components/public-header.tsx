'use client';

import Link from 'next/link';
import { useUser } from '@/firebase';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, LogIn, Loader2 } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import Image from 'next/image';

export function PublicHeader() {
  const { user, isUserLoading } = useUser();

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <Link href="/home" className="mr-6 flex items-center space-x-2">
            <Image src="/logo.png" alt="APP WS Logo" width={40} height={40} />
            <span className="font-bold sm:inline-block">
                Portal Interno
            </span>
        </Link>
        <div className="flex flex-1 items-center justify-end space-x-2">
            <ThemeToggle />
            {isUserLoading ? (
                <Button variant="outline" size="icon" disabled>
                    <Loader2 className="h-4 w-4 animate-spin"/>
                </Button>
            ) : user ? (
                <Link href="/dashboard">
                    <Button>
                        <LayoutDashboard className="mr-2 h-4 w-4" />
                        Dashboard
                    </Button>
                </Link>
            ) : (
                <Link href="/login">
                    <Button variant="outline">
                        <LogIn className="mr-2 h-4 w-4" />
                        Login
                    </Button>
                </Link>
            )}
        </div>
      </div>
    </header>
  );
}
