import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );

  return <AuthForm googleEnabled={googleEnabled} mode="signup" />;
}
