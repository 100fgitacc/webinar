
export async function POST() {
    const cookies = [
      `authToken=; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(0).toUTCString()}; Path=/`
    ].join(', ');

    const response = new Response(null, {
      status: 302, 
      headers: {
        'Set-Cookie': cookies,
        Location: '/', 
      },
    });

    return response;
  }
