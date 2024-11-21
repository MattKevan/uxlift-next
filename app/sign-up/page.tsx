import { signUpAction } from "@/app/actions";
import { Checkbox } from "@/components/catalyst/checkbox";
import { FormMessage, Message } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export default async function Signup(props: {
  searchParams: Promise<Message>;
}) {
  const searchParams = await props.searchParams;
  if ("message" in searchParams) {
    return (
      <div className="w-full flex-1 flex items-center h-screen sm:max-w-md justify-center gap-2 p-4">
        <FormMessage message={searchParams} />
      </div>
    );
  }

    return (
      <main>
        <div className='px-6 mb-24 sm:mb-32 mt-6'>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 md:w-3/4 lg:w-4/5 tracking-tight">Sign up</h1>
        </div>
        <form className="flex-1 flex flex-col max-w-2xl px-6">
          <div className="flex flex-col gap-2 [&>input]:mb-3">
            <Label htmlFor="email">Email</Label>
            <Input name="email" placeholder="you@example.com" required />
            <Label htmlFor="password">Password</Label>
            <Input
              type="password"
              name="password"
              placeholder="Your password"
              minLength={6}
              required
            />
            <div className="flex items-center space-x-2 my-4">
              <Checkbox id="newsletter" name="newsletter" />
              <Label htmlFor="newsletter">Subscribe to our newsletter for UX tips and resources</Label>
            </div>
            <SubmitButton formAction={signUpAction} pendingText="Signing up...">
              Sign up
            </SubmitButton>
            <FormMessage message={searchParams} />
            <p className="text-sm text text-foreground">
              Already have an account?{" "}
              <Link className="text-primary font-medium underline" href="/sign-in">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </main>
  );
}
