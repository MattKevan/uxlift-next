import { signInAction } from "@/app/actions/actions";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Login(props: { searchParams: Promise<Message> }) {
  const searchParams = await props.searchParams;
  
  return (
    <main className="container mx-auto">
      <div className="px-6 mb-24 sm:mb-32 mt-6">
        <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">
          Sign in
        </h1>
      </div>

      <form className="flex-1 flex flex-col max-w-2xl px-6">
        <div className="flex flex-col gap-2 [&>input]:mb-3">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email"
              name="email" 
              type="email"
              autoComplete="email"
              placeholder="you@example.com" 
              required 
              aria-required="true"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="password">Password</Label>
              <Link
                className="text-xs text-foreground underline hover:text-foreground/80"
                href="/forgot-password"
              >
                Forgot Password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              required
              aria-required="true"
            />
          </div>

          <SubmitButton 
            className="w-full mt-4"
            pendingText="Signing In..." 
            formAction={signInAction}
          >
            Sign in
          </SubmitButton>

          <FormMessage message={searchParams} />

          <p className="text-sm text-foreground text-center mt-4">
            Don't have an account?{" "}
            <Link 
              className="text-foreground font-medium underline hover:text-foreground/80" 
              href="/sign-up"
            >
              Sign up
            </Link>
          </p>
        </div>
      </form>
    </main>
  );
}