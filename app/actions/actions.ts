// /app/actions/actions.ts

"use server";

import { encodedRedirect } from "@/utils/utils";
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

async function subscribeToNewsletter(email: string, userId: string) {
  const BEEHIIV_API_KEY = process.env.BEEHIIV_API_KEY;
  const BEEHIIV_PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;

  try {
    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${BEEHIIV_PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${BEEHIIV_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: 'UX Lift',
          utm_medium: 'organic',
          utm_campaign: 'website_signup',
          referring_site: 'www.uxlift.org',
          custom_fields: [
            {
              name: 'User ID',
              value: userId
            }
          ]
        }),
      }
    );

    if (!response.ok) {
      console.error('Failed to subscribe to newsletter:', await response.text());
      return false;
    }

    const data = await response.json();
    return data.data.status === 'active' || data.data.status === 'validating';
  } catch (error) {
    console.error('Error subscribing to newsletter:', error);
    return false;
  }
}

export const signUpAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const newsletterSubscription = formData.get("newsletter") === "on";
  const supabase = await createClient();

  if (!email || !password) {
    return { error: "Email and password are required" };
  }

  // Sign up without email verification
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (signUpError) {
    return encodedRedirect("error", "/sign-up", signUpError.message);
  }

  if (authData?.user) {
    let newsletterStatus = false;

    // Subscribe to newsletter if checkbox was checked
    if (newsletterSubscription) {
      newsletterStatus = await subscribeToNewsletter(email, authData.user.id);
    }

    // Create or update user profile with newsletter status
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: authData.user.id,
        newsletter_subscriber: newsletterStatus,
        // Include other required fields if necessary
        username: email.split('@')[0], // temporary username, you might want to handle this differently
        created_at: new Date().toISOString(),
      });

    if (profileError) {
      console.error('Error updating user profile:', profileError);
    }

    // Check if user already has a profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('username')
      .eq('user_id', authData.user.id)
      .single();

    if (!profile?.username) {
      // Redirect to profile creation if no username
      return redirect("/profile/create");
    }
    
    // If they already have a profile, go to their feed
    return redirect("/profile/edit");
  }

  return redirect("/sign-in");
};

export const signInAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();
  const supabase = await createClient();

  if (!email || !password) {
    return encodedRedirect("error", "/sign-in", "Email and password are required");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return encodedRedirect("error", "/sign-in", error.message);
  }

  return redirect("/feed");
};

export const forgotPasswordAction = async (formData: FormData) => {
  const email = formData.get("email")?.toString();
  const supabase = await createClient();
  const origin = (await headers()).get("origin");
  const callbackUrl = formData.get("callbackUrl")?.toString();

  if (!email) {
    return encodedRedirect("error", "/forgot-password", "Email is required");
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?redirect_to=/protected/reset-password`,
  });

  if (error) {
    console.error(error.message);
    return encodedRedirect(
      "error",
      "/forgot-password",
      "Could not reset password",
    );
  }

  if (callbackUrl) {
    return redirect(callbackUrl);
  }

  return encodedRedirect(
    "success",
    "/forgot-password",
    "Check your email for a link to reset your password.",
  );
};

export const resetPasswordAction = async (formData: FormData) => {
  const supabase = await createClient();

  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!password || !confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password and confirm password are required",
    );
  }

  if (password !== confirmPassword) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Passwords do not match",
    );
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  if (error) {
    encodedRedirect(
      "error",
      "/protected/reset-password",
      "Password update failed",
    );
  }

  encodedRedirect("success", "/protected/reset-password", "Password updated");
};


export async function signOutAction(formData?: FormData) {
  'use server'
  const supabase = await createClient();
  await supabase.auth.signOut();
  return redirect("/sign-in");
}