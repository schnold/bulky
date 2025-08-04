import type { ActionFunctionArgs } from "@remix-run/node";

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log('🔧 TEST WEBHOOK ENDPOINT HIT');
  console.log('🔧 Method:', request.method);
  console.log('🔧 URL:', request.url);
  console.log('🔧 Headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    const body = await request.text();
    console.log('🔧 Body length:', body.length);
    console.log('🔧 Body content:', body);
    
    if (body) {
      try {
        const parsed = JSON.parse(body);
        console.log('🔧 Parsed JSON:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('🔧 Body is not valid JSON');
      }
    }
  } catch (error) {
    console.error('🔧 Error reading body:', error);
  }
  
  return new Response("TEST WEBHOOK OK", { status: 200 });
};

export async function loader() {
  return new Response("GET requests not allowed on webhook endpoint", { status: 405 });
}