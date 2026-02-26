'use client';

import { useState, useEffect, useRef } from 'react';
import { useFirestore, useStorage, useDoc, useMemoFirebase } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { ref as storageRef, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import Image from 'next/image';
import type { AppAppearance } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const CONFIG_DOC_ID = 'appearance';
const LOGIN_BACKGROUND_STORAGE_PATH = 'app_backgrounds/login_background.jpg';

export default function PersonalizarPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const configRef = useMemoFirebase(() => firestore ? doc(firestore, 'app_config', CONFIG_DOC_ID) : null, [firestore]);
  const { data: appearanceConfig, isLoading } = useDoc<AppAppearance>(configRef);

  useEffect(() => {
    if (appearanceConfig?.loginBackgroundUrl) {
      setPreviewImage(appearanceConfig.loginBackgroundUrl);
    }
  }, [appearanceConfig]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!firestore || !storage) return;
    if (!previewImage) {
        toast({ variant: 'destructive', title: 'Erro', description: 'Nenhuma imagem selecionada.' });
        return;
    }
    // Check if the image is a new upload (data URL)
    if (!previewImage.startsWith('data:')) {
        toast({ title: 'Nenhuma alteração', description: 'A imagem de fundo já é a atual.' });
        return;
    }

    setIsSaving(true);
    try {
        const imageRef = storageRef(storage, LOGIN_BACKGROUND_STORAGE_PATH);
        await uploadString(imageRef, previewImage, 'data_url');
        const downloadURL = await getDownloadURL(imageRef);

        await setDoc(configRef, { loginBackgroundUrl: downloadURL }, { merge: true });

        toast({ title: 'Sucesso!', description: 'A imagem de fundo da tela de login foi atualizada.' });
    } catch (error) {
        console.error('Error saving background image:', error);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível salvar a nova imagem.' });
    } finally {
        setIsSaving(false);
    }
  };
  
  const handleRemoveImage = async () => {
    if (!firestore || !storage || !appearanceConfig?.loginBackgroundUrl) return;
    setIsSaving(true);
    try {
        const imageRef = storageRef(storage, LOGIN_BACKGROUND_STORAGE_PATH);
        await deleteObject(imageRef);
        await setDoc(configRef, { loginBackgroundUrl: null }, { merge: true });
        setPreviewImage(null);
        toast({ title: 'Sucesso!', description: 'A imagem de fundo foi removida. O padrão será usado.' });
    } catch (error: any) {
        // If object doesn't exist, we can just clear the DB record.
        if (error.code === 'storage/object-not-found') {
            await setDoc(configRef, { loginBackgroundUrl: null }, { merge: true });
            setPreviewImage(null);
            toast({ title: 'Sucesso!', description: 'A imagem de fundo foi removida.' });
        } else {
            console.error('Error removing background image:', error);
            toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível remover a imagem.' });
        }
    } finally {
        setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Personalizar Aparência</h1>
      <Card>
        <CardHeader>
          <CardTitle>Tela de Login</CardTitle>
          <CardDescription>
            Altere a imagem de fundo da tela de login. A imagem será redimensionada para preencher a tela.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {isLoading ? (
                <div className="flex justify-center items-center h-56 w-full bg-muted rounded-md">
                     <Skeleton className="h-full w-full" />
                </div>
            ) : previewImage ? (
                <div className="relative aspect-video w-full border rounded-md overflow-hidden">
                    <Image src={previewImage} alt="Preview da imagem de fundo" layout="fill" objectFit="cover" />
                </div>
            ) : (
                <div className="flex justify-center items-center h-56 w-full bg-muted/50 border-2 border-dashed rounded-md">
                    <div className="text-center text-muted-foreground">
                        <ImageIcon className="mx-auto h-12 w-12" />
                        <p>Nenhuma imagem personalizada definida.</p>
                        <p className="text-xs">A imagem padrão será utilizada.</p>
                    </div>
                </div>
            )}
             <Input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/png, image/jpeg, image/webp" />
        </CardContent>
        <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isSaving}>
                <Upload className="mr-2 h-4 w-4" />
                Trocar Imagem
            </Button>
            <div className="flex gap-2">
                <Button variant="destructive" onClick={handleRemoveImage} disabled={isSaving || !previewImage || isLoading}>
                     {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                    Remover Imagem
                </Button>
                <Button onClick={handleSave} disabled={isSaving || isLoading}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Salvar
                </Button>
            </div>
        </CardFooter>
      </Card>
    </div>
  );
}
