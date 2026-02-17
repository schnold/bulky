import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { checkRateLimit } from "../services/rate-limit.server";
import { z } from "zod";

const OptimizedDataSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  handle: z.string().optional(),
  /** When URL update is enabled, the pre-update handle so we can create a redirect from old URL to new. */
  originalHandle: z.string().optional(),
  productType: z.string().optional().default(""),
  vendor: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
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

      const formInput = {
        productId: formData.get("productId"),
        optimizedData: formData.get("optimizedData") ? JSON.parse(formData.get("optimizedData") as string) : undefined,
      };

      const result = PublishSchema.safeParse(formInput);
      if (!result.success) {
        return json({ error: "Invalid product data", details: result.error.issues }, { status: 400 });
      }

      const { productId, optimizedData } = result.data;
      console.log(`🔍 API Received - ProductId: ${productId}, Handle: ${optimizedData.handle}, OriginalHandle: ${optimizedData.originalHandle}`);

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

        // When URL was updated, create a redirect from old URL to new (so old links keep working)
        const newHandle = optimizedData.handle;
        const oldHandle = optimizedData.originalHandle;
        
        console.log(`🔍 Redirect Debug - newHandle: ${newHandle}, oldHandle: ${oldHandle}, areEqual: ${oldHandle === newHandle}`);
        
        if (newHandle && oldHandle && oldHandle !== newHandle) {
          console.log(`🔄 Creating redirect: /products/${oldHandle} → /products/${newHandle}`);
          try {
            const redirectResponse = await adminClient.graphql(
              `mutation urlRedirectCreate($urlRedirect: UrlRedirectInput!) {
                urlRedirectCreate(urlRedirect: $urlRedirect) {
                  urlRedirect { id path target }
                  userErrors { field message }
                }
              }`,
              {
                urlRedirect: {
                  path: `/products/${oldHandle}`,
                  target: `/products/${newHandle}`,
                },
              }
            );
            const redirectData = await redirectResponse.json();
            console.log(`🔍 Redirect response:`, JSON.stringify(redirectData, null, 2));
            const redirectErrors = redirectData.data?.urlRedirectCreate?.userErrors;
            if (redirectErrors?.length) {
              console.error("❌ Redirect creation failed:", redirectErrors.map((e: any) => e.message).join(", "));
            } else {
              console.log(`✅ Redirect created: /products/${oldHandle} → /products/${newHandle}`);
            }
          } catch (redirectErr) {
            console.error("❌ Failed to create URL redirect (product update succeeded):", redirectErr);
          }
        } else {
          console.log(`⚠️ Redirect NOT created - Reason: newHandle=${!!newHandle}, oldHandle=${!!oldHandle}, different=${oldHandle !== newHandle}`);
        }

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

      const rawProductsData = formData.get("productsData");
      console.log(`📦 Bulk publish - Raw data received:`, rawProductsData ? 'DATA_PRESENT' : 'NO_DATA');

      const bulkFormInput = {
        productsData: rawProductsData ? JSON.parse(rawProductsData as string) : undefined,
      };

      console.log(`📦 Bulk publish - Parsed ${bulkFormInput.productsData?.length || 0} products`);

      const result = BulkPublishSchema.safeParse(bulkFormInput);
      if (!result.success) {
        console.error(`❌ Bulk publish - Validation failed:`, result.error.issues);
        return json({ error: "Invalid bulk data", details: result.error.issues }, { status: 400 });
      }

      const { productsData } = result.data;
      console.log(`✅ Bulk publish - Validated ${productsData.length} products for publishing`);
      
      // Log redirect data for each product
      productsData.forEach((pd, i) => {
        console.log(`🔍 Bulk API Product ${i + 1}: Handle=${pd.optimizedData.handle}, OriginalHandle=${pd.optimizedData.originalHandle}`);
      });

      // Use serverless-compatible GraphQL client
      const { createServerlessAdminClient } = await import("../utils/shopify-graphql.server");
      const adminClient = createServerlessAdminClient(session.shop, session.accessToken!);

      let publishedCount = 0;
      const errors = [];

      for (let i = 0; i < productsData.length; i++) {
        const productData = productsData[i];
        console.log(`📦 Bulk publish - Processing product ${i + 1}/${productsData.length}: ${productData.id}`);
        console.log(`📦 Bulk publish - Product data:`, {
          id: productData.id,
          title: productData.optimizedData.title?.substring(0, 50),
          hasDescription: !!productData.optimizedData.description,
          handle: productData.optimizedData.handle,
          hasSeoTitle: !!productData.optimizedData.seoTitle,
          hasSeoDescription: !!productData.optimizedData.seoDescription,
        });

        try {
          // Build product input object, conditionally including handle only if provided
          const productInput: any = {
            id: productData.id,
            title: productData.optimizedData.title,
            descriptionHtml: productData.optimizedData.description,
            productType: productData.optimizedData.productType,
            vendor: productData.optimizedData.vendor || "",
            tags: productData.optimizedData.tags,
          };

          // Only include handle if it exists (respects "Update URL" checkbox)
          if (productData.optimizedData.handle) {
            productInput.handle = productData.optimizedData.handle;
          }

          // Include SEO fields if provided
          if (productData.optimizedData.seoTitle || productData.optimizedData.seoDescription) {
            productInput.seo = {};
            if (productData.optimizedData.seoTitle) {
              productInput.seo.title = productData.optimizedData.seoTitle;
            }
            if (productData.optimizedData.seoDescription) {
              productInput.seo.description = productData.optimizedData.seoDescription;
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
            { input: productInput }
          );

          const updateData = await updateResponse.json();
          const userErrors = updateData.data?.productUpdate?.userErrors;
          const updatedProduct = updateData.data?.productUpdate?.product;

          if (userErrors && userErrors.length > 0) {
            errors.push(`Product ${productData.id}: ${userErrors.map((e: any) => e.message).join(", ")}`);
          } else if (updatedProduct) {
            publishedCount++;
            console.log(`✅ Published: ${updatedProduct.title}`);

            // When URL was updated, create redirect from old URL to new
            const newHandle = productData.optimizedData.handle;
            const oldHandle = productData.optimizedData.originalHandle;
            
            console.log(`🔍 Bulk Redirect Debug - Product ${productData.id}: newHandle=${newHandle}, oldHandle=${oldHandle}`);
            
            if (newHandle && oldHandle && oldHandle !== newHandle) {
              console.log(`🔄 Bulk: Creating redirect: /products/${oldHandle} → /products/${newHandle}`);
              try {
                const redirectResponse = await adminClient.graphql(
                  `mutation urlRedirectCreate($urlRedirect: UrlRedirectInput!) {
                    urlRedirectCreate(urlRedirect: $urlRedirect) {
                      urlRedirect { id path target }
                      userErrors { field message }
                    }
                  }`,
                  {
                    urlRedirect: {
                      path: `/products/${oldHandle}`,
                      target: `/products/${newHandle}`,
                    },
                  }
                );
                const redirectData = await redirectResponse.json();
                console.log(`🔍 Bulk redirect response:`, JSON.stringify(redirectData, null, 2));
                const redirectErrors = redirectData.data?.urlRedirectCreate?.userErrors;
                if (redirectErrors?.length) {
                  console.error(`❌ Bulk redirect for ${productData.id}:`, redirectErrors.map((e: any) => e.message).join(", "));
                } else {
                  console.log(`✅ Bulk redirect: /products/${oldHandle} → /products/${newHandle}`);
                }
              } catch (redirectErr) {
                console.error(`❌ Bulk redirect failed for ${productData.id}:`, redirectErr);
              }
            } else {
              console.log(`⚠️ Bulk redirect NOT created for ${productData.id} - newHandle=${!!newHandle}, oldHandle=${!!oldHandle}, different=${oldHandle !== newHandle}`);
            }

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