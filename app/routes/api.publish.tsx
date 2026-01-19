import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { checkRateLimit } from "../services/rate-limit.server";
import { z } from "zod";

const OptimizedDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  handle: z.string().min(1),
  productType: z.string().optional().default(""),
  vendor: z.string().optional().default(""),
  tags: z.string().optional().default(""),
});

const PublishSchema = z.object({
  productId: z.string().min(1),
  optimizedData: OptimizedDataSchema,
});

const BulkPublishSchema = z.object({
  productsData: z.array(z.object({
    id: z.string().min(1),
    optimizedData: OptimizedDataSchema,
  })).min(1),
});

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (intent === "publish") {
      // Validate and rate limit single publish
      const rateLimit = await checkRateLimit(session.shop, "publish", 100, 60); // 100 per minute
      if (!rateLimit.allowed) {
        return json({ error: "Rate limit exceeded. Please wait a moment." }, { status: 429 });
      }

      const input = {
        productId: formData.get("productId"),
        optimizedData: formData.get("optimizedData") ? JSON.parse(formData.get("optimizedData") as string) : undefined,
      };

      const result = PublishSchema.safeParse(input);
      if (!result.success) {
        return json({ error: "Invalid product data", details: result.error.issues }, { status: 400 });
      }

      const { productId, optimizedData } = result.data;

      // Use serverless-compatible GraphQL client
      const { createServerlessAdminClient } = await import("../utils/shopify-graphql.server");
      const adminClient = createServerlessAdminClient(session.shop, session.accessToken!);

      // Update the product using Shopify GraphQL API
      // Build input object, conditionally including handle only if provided
      const input: any = {
        id: productId,
        title: optimizedData.title,
        descriptionHtml: optimizedData.description,
        productType: optimizedData.productType,
        vendor: optimizedData.vendor || "",
        tags: optimizedData.tags,
      };

      // Only include handle if it exists (respects "Update URL" checkbox)
      if (optimizedData.handle) {
        input.handle = optimizedData.handle;
      }

      // Include SEO fields if provided
      if (optimizedData.seoTitle || optimizedData.seoDescription) {
        input.seo = {};
        if (optimizedData.seoTitle) {
          input.seo.title = optimizedData.seoTitle;
        }
        if (optimizedData.seoDescription) {
          input.seo.description = optimizedData.seoDescription;
        }
      }

      const updateResponse = await adminClient.graphql(
        `mutation updateProduct($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              title
              descriptionHtml
              handle
              productType
              vendor
              tags
              seo {
                title
                description
              }
            }
            userErrors {
              field
              message
            }
          }
        }`,
        { input }
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

        // Mark product as optimized in database
        const { ensureUserExists } = await import("../utils/db.server");
        const { markProductAsOptimized } = await import("../models/product-optimization.server");

        try {
          const user = await ensureUserExists(session.shop);
          await markProductAsOptimized(
            productId,
            session.shop,
            user.id,
            {
              title: optimizedData.title,
              handle: optimizedData.handle,
              productType: optimizedData.productType
            }
          );
          console.log(`✅ Marked product ${productId} as optimized in database`);
        } catch (dbError) {
          console.error(`⚠️ Failed to mark product as optimized in database:`, dbError);
          // Don't fail the whole operation, just log the error
        }

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
      // Validate and rate limit bulk publish
      const rateLimit = await checkRateLimit(session.shop, "publish-bulk", 10, 60); // 10 bulk operations per minute
      if (!rateLimit.allowed) {
        return json({ error: "Bulk rate limit exceeded. Please wait a minute." }, { status: 429 });
      }

      const input = {
        productsData: formData.get("productsData") ? JSON.parse(formData.get("productsData") as string) : undefined,
      };

      const result = BulkPublishSchema.safeParse(input);
      if (!result.success) {
        return json({ error: "Invalid bulk data", details: result.error.issues }, { status: 400 });
      }

      const { productsData } = result.data;

      // Use serverless-compatible GraphQL client
      const { createServerlessAdminClient } = await import("../utils/shopify-graphql.server");
      const adminClient = createServerlessAdminClient(session.shop, session.accessToken!);

      let publishedCount = 0;
      const errors = [];

      for (const productData of productsData) {
        try {
          // Build input object, conditionally including handle only if provided
          const input: any = {
            id: productData.id,
            title: productData.optimizedData.title,
            descriptionHtml: productData.optimizedData.description,
            productType: productData.optimizedData.productType,
            vendor: productData.optimizedData.vendor || "",
            tags: productData.optimizedData.tags,
          };

          // Only include handle if it exists (respects "Update URL" checkbox)
          if (productData.optimizedData.handle) {
            input.handle = productData.optimizedData.handle;
          }

          // Include SEO fields if provided
          if (productData.optimizedData.seoTitle || productData.optimizedData.seoDescription) {
            input.seo = {};
            if (productData.optimizedData.seoTitle) {
              input.seo.title = productData.optimizedData.seoTitle;
            }
            if (productData.optimizedData.seoDescription) {
              input.seo.description = productData.optimizedData.seoDescription;
            }
          }

          const updateResponse = await adminClient.graphql(
            `mutation updateProduct($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
                  id
                  title
                  seo {
                    title
                    description
                  }
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
            { input }
          );

          const updateData = await updateResponse.json();
          const userErrors = updateData.data?.productUpdate?.userErrors;
          const updatedProduct = updateData.data?.productUpdate?.product;

          if (userErrors && userErrors.length > 0) {
            errors.push(`Product ${productData.id}: ${userErrors.map((e: any) => e.message).join(", ")}`);
          } else if (updatedProduct) {
            publishedCount++;
            console.log(`✅ Published: ${updatedProduct.title}`);

            // Mark product as optimized in database for bulk publish
            try {
              const { ensureUserExists } = await import("../utils/db.server");
              const { markProductAsOptimized } = await import("../models/product-optimization.server");
              const user = await ensureUserExists(session.shop);

              await markProductAsOptimized(
                productData.id,
                session.shop,
                user.id,
                {
                  title: productData.optimizedData.title,
                  handle: productData.optimizedData.handle,
                  productType: productData.optimizedData.productType,
                }
              );
            } catch (dbError) {
              console.error(`⚠️ Failed to mark bulk product ${productData.id} as optimized:`, dbError);
            }
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