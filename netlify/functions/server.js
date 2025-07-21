import { createRequestHandler } from "@netlify/remix-adapter";
import * as build from "../../build/server/index.js";

const handler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV || "production",
});

export { handler };