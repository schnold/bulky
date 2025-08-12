import type { ActionFunctionArgs } from "@remix-run/node";

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Accept beacons with any content type; read as text to avoid JSON parse failures
    await request.text();
  } catch {}
  return new Response(null, { status: 204 });
}

export async function loader() {
  return new Response(null, { status: 405 });
}


