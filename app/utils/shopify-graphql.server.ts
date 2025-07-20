// Custom GraphQL client for Shopify that works in serverless environments
// This bypasses the browser detection issues in @shopify/admin-api-client

interface ShopifyGraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export async function shopifyGraphQL<T = any>(
  shop: string,
  accessToken: string,
  query: string,
  variables?: Record<string, any>
): Promise<ShopifyGraphQLResponse<T>> {
  const url = `https://${shop}.myshopify.com/admin/api/2025-01/graphql.json`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Helper function to create a simple admin client that works in serverless
export function createServerlessAdminClient(shop: string, accessToken: string) {
  return {
    graphql: async <T = any>(query: string, variables?: Record<string, any>) => {
      const result = await shopifyGraphQL<T>(shop, accessToken, query, variables);
      
      if (result.errors && result.errors.length > 0) {
        throw new Error(`GraphQL Error: ${result.errors[0].message}`);
      }
      
      return {
        json: async () => result,
      };
    },
  };
}