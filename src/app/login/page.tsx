import { LoginForm } from '@/components/login-form';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-6">
        <img src="/logo.png" alt="APP WS Logo" className="h-16 w-auto" />
      </div>
      <LoginForm />
    </div>
  );
}
