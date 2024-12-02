import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const origin = requestUrl.origin;

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (error) {
      console.error('Error exchanging code for session:', error);
      return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error.message)}`);
    }

    if (session?.user) {
      try {
        // Check if newsletter was requested from user metadata
        const newsletterRequested = session.user.user_metadata.newsletter_requested;

        if (newsletterRequested) {
          console.log('Processing newsletter subscription for user:', session.user.id);
          
          // Subscribe to newsletter
          const newsletterSuccess = await subscribeToNewsletter(session.user.email!, session.user.id);
          
          if (newsletterSuccess) {
            console.log('Newsletter subscription successful, creating profile');
            
            // Create user profile with newsletter status
            const { error: profileError } = await supabase
              .from('user_profiles')
              .insert({
                user_id: session.user.id,
                username: session.user.email!.split('@')[0],
                created_at: new Date().toISOString(),
                newsletter_subscriber: true,
                newsletter_pending: false
              });

            if (profileError) {
              console.error('Error creating profile with newsletter status:', profileError);
            }
          } else {
            console.error('Newsletter subscription failed');
          }
        }
      } catch (err) {
        console.error('Error processing newsletter subscription:', err);
      }

      return NextResponse.redirect(`${origin}/confirmed`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=Unable to verify email`);
}