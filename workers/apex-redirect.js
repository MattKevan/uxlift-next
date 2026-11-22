export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = 'www.uxlift.org';

    return new Response(null, {
      status: 301,
      headers: {
        Location: url.toString(),
        'Cache-Control': 'public, max-age=3600',
      },
    });
  },
};
