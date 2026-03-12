'use client';
import { redirect } from 'next/navigation';

export default function OldHomePage() {
  redirect('/dashboard');
  return null;
}
