import { SettingsForm } from '@/components/settings-form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function SettingsPage() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4">
      <h1 className="text-3xl font-bold">Configurações</h1>
      <p className="text-muted-foreground">
        Gerencie as configurações da sua conta e informações de perfil.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Perfil</CardTitle>
          <CardDescription>
            Atualize suas informações pessoais aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm />
        </CardContent>
      </Card>
    </div>
  );
}
