import { ResetPasswordForm } from "@/components/password-reset-form";

type ResetPasswordPageProps = {
  searchParams: { email?: string; token?: string };
};

export default function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  return (
    <ResetPasswordForm
      email={searchParams.email ?? ""}
      token={searchParams.token ?? ""}
    />
  );
}
