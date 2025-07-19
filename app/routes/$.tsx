import type { LoaderFunctionArgs } from "@remix-run/node";

export async function loader({ request, params }: LoaderFunctionArgs) {
  // For unmatched routes, throw a 404
  throw new Response("Not Found", { status: 404 });
}