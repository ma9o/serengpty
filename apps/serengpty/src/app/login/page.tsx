import { LoginForm } from '../components/login-form';

export default function LoginPage() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <LoginForm />
      </div>
    </div>
  );
}