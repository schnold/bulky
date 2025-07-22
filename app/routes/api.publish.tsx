import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "publish") {
      // Single product publish
      const productId = formData.get("productId") as string;
      const optimizedDataStr = formData.get("optimizedData") as string;
      
      if (!productId || !optimizedDataStr) {
        return json({ error: "Missing product data" }, { status: 400 });
      }

      const optimizedData = JSON.parse(optimizedDataStr);

      // Use serverless-compatible GraphQL client
      const { createServerlessAdminClient } = await import("../utils/shopify-graphql.server");
      const adminClient = createServerlessAdminClient(session.shop, session.accessToken!);

      // Update the product using Shopify GraphQL API
      const updateResponse = await adminClient.graphql(
        `mutation updateProduct($product: ProductUpdateInput!) {
          productUpdate(product: $product) {
            product {
              id
              title
              descriptionHtml
              handle
              productType
              vendor
              tags
            }
            userErrors {
              field
              message
            }
          }
        }`,
        {
          product: {
            id: productId,
            title: optimizedData.title,
            descriptionHtml: optimizedData.description,
            handle: optimizedData.handle,
            productType: optimizedData.productType,
            vendor: optimizedData.vendor || "",
            tags: optimizedData.tags,
          },
        }
      );

      const updateData = await updateResponse.json();
      const userErrors = updateData.data?.productUpdate?.userErrors;
      const updatedProduct = updateData.data?.productUpdate?.product;

      if (userErrors && userErrors.length > 0) {
        console.error("❌ Shopify publish errors:", userErrors);
        return json({
          success: false,
          error: userErrors.map((e: any) => e.message).join(", ")
        });
      }

      if (updatedProduct) {
        console.log(`🎉 Successfully published product: ${updatedProduct.title}`);
        return json({
          success: true,
          productId,
          productTitle: updatedProduct.title
        });
      }

      return json({
        success: false,
        error: "No product returned from update mutation"
      });

    } else if (intent === "publishBulk") {
      // Bulk product publish
      const productsDataStr = formData.get("productsData") as string;
      
      if (!productsDataStr) {
        return json({ error: "Missing products data" }, { status: 400 });
      }

      const productsData = JSON.parse(productsDataStr);
      
      // Use serverless-compatible GraphQL client
      const { createServerlessAdminClient } = await import("../utils/shopify-graphql.server");
      const adminClient = createServerlessAdminClient(session.shop, session.accessToken!);

      let publishedCount = 0;
      const errors = [];

      for (const productData of productsData) {
        try {
          const updateResponse = await adminClient.graphql(
            `mutation updateProduct($product: ProductUpdateInput!) {
              productUpdate(product: $product) {
                product {
                  id
                  title
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
            {
              product: {
                id: productData.id,
                title: productData.optimizedData.title,
                descriptionHtml: productData.optimizedData.description,
                handle: productData.optimizedData.handle,
                productType: productData.optimizedData.productType,
                vendor: productData.optimizedData.vendor || "",
                tags: productData.optimizedData.tags,
              },
            }
          );

          const updateData = await updateResponse.json();
          const userErrors = updateData.data?.productUpdate?.userErrors;
          const updatedProduct = updateData.data?.productUpdate?.product;

          if (userErrors && userErrors.length > 0) {
            errors.push(`Product ${productData.id}: ${userErrors.map((e: any) => e.message).join(", ")}`);
          } else if (updatedProduct) {
            publishedCount++;
            console.log(`✅ Published: ${updatedProduct.title}`);
          }
        } catch (error) {
          console.error(`❌ Error publishing product ${productData.id}:`, error);
          errors.push(`Product ${productData.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return json({
        success: publishedCount > 0,
        publishedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: errors.length > 0 
          ? `Published ${publishedCount} products, ${errors.length} failed`
          : `Successfully published ${publishedCount} products`
      });
    }

    return json({ error: "Invalid intent" }, { status: 400 });
    
  } catch (error) {
    console.error("❌ Publish API error:", error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
};