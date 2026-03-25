'use client';

import { useParams } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Monitor } from '@/lib/types';
import { MuralWidget, OSWidget } from '@/components/monitor-widgets';
import { Loader2, Maximize, Minimize, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function MonitorViewPage() {
  const { id } = useParams();
  const firestore = useFirestore();
  const [isFullScreen, setIsFullScreen] = useState(false);

  const monitorRef = useMemoFirebase(() => 
    firestore && id ? doc(firestore, 'monitors', id as string) : null
  , [firestore, id]);

  const { data: monitor, isLoading, error } = useDoc<Monitor>(monitorRef);

  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#f2faff]">
        <Loader2 className="h-12 w-12 animate-spin text-[#3091ff]" />
        <p className="mt-4 text-lg font-medium text-[#3091ff]">Carregando Monitor...</p>
      </div>
    );
  }

  if (error || !monitor) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#f2faff]">
        <div className="p-8 bg-white rounded-2xl shadow-xl text-center">
          <h2 className="text-2xl font-bold text-destructive">Monitor não encontrado</h2>
          <p className="mt-2 text-muted-foreground">O monitor solicitado não existe ou você não tem permissão para acessá-lo.</p>
          <Button asChild className="mt-6 bg-[#3091ff]">
            <Link href="/dashboard/monitor">Voltar para Monitoramento</Link>
          </Button>
        </div>
      </div>
    );
  }

  const hasMural = monitor.widgets?.some(w => w.type === 'mural');
  const hasOS = monitor.widgets?.some(w => w.type === 'os');

  return (
    <div className="min-h-screen bg-[#f2faff] p-6 lg:p-10 flex flex-col gap-8 transition-all duration-500">
      {/* Header */}
      {!isFullScreen && (
        <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/dashboard/monitor">
                <ChevronLeft className="h-6 w-6" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{monitor.name}</h1>
              <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold">{monitor.sector}</p>
            </div>
          </div>
          <Button onClick={toggleFullScreen} variant="outline" className="gap-2">
            <Maximize className="h-4 w-4" />
            Tela Cheia
          </Button>
        </div>
      )}

      {/* Grid Layout */}
      <div className={cn(
        "grid gap-8 flex-1",
        hasMural && hasOS ? "grid-cols-1 xl:grid-cols-12" : "grid-cols-1"
      )}>
        {hasMural && (
          <div className={cn(
            "bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white",
            hasOS ? "xl:col-span-4" : "col-span-1"
          )}>
            <MuralWidget sector={monitor.sector} />
          </div>
        )}
        
        {hasOS && (
          <div className={cn(
            "bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white",
            hasMural ? "xl:col-span-8" : "col-span-1"
          )}>
            <OSWidget sector={monitor.sector} />
          </div>
        )}
      </div>

      {/* Footer / Status Bar */}
      <div className="flex justify-between items-center text-xs text-gray-400 font-medium px-4">
        <div>AeroTrack Monitor v1.0</div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          Conectado em Tempo Real
        </div>
        <div>{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
      </div>

      {isFullScreen && (
        <Button 
          onClick={toggleFullScreen} 
          variant="secondary" 
          size="icon" 
          className="fixed bottom-4 right-4 rounded-full shadow-lg opacity-20 hover:opacity-100 transition-opacity"
        >
          <Minimize className="h-6 w-6" />
        </Button>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
