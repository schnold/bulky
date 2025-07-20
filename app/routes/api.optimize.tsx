import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  updateUserCredits,
  getCreditsForPlan
} from "../models/user.server";
import { getCurrentSubscription } from "../utils/billing.server";
import { ensureUserExists } from "../utils/db.server";

interface OptimizationContext {
  targetKeywords?: string;
  brand?: string;
  keyFeatures?: string;
  targetAudience?: string;
  useCase?: string;
  competitorAnalysis?: boolean;
  voiceSearchOptimization?: boolean;
  specialInstructions?: string;
}

interface Product {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  productType: string;
  vendor: string;
  tags: string[];
  createdAt: string;
}

async function optimizeProductWithAI(product: Product, context?: OptimizationContext) {
  const contextInfo = context ? `
ADDITIONAL CONTEXT:
- Target Keywords: ${context.targetKeywords || "Auto-detect from product"}
- Brand: ${context.brand || "Auto-detect from product"}
- Key Features: ${context.keyFeatures || "Auto-extract from description"}
- Target Audience: ${context.targetAudience || "General consumers"}
- Primary Use Case: ${context.useCase || "General use"}
- Voice Search Focus: ${context.voiceSearchOptimization ? "Yes - include natural Q&A" : "Standard optimization"}
- Competitor Analysis: ${context.competitorAnalysis ? "Yes - use competitive keywords" : "Product-focused"}
` : "";

  const specialInstructionsInfo = context?.specialInstructions ? `
🎯 SPECIAL INSTRUCTIONS (MUST FOLLOW):
${context.specialInstructions}

IMPORTANT: These special instructions take priority and must be incorporated into all optimization decisions.
` : "";

  const prompt = `TASK: Optimize this Shopify product using 2025 e-commerce SEO best practices for maximum search visibility and conversion performance.

=== CURRENT PRODUCT DATA ===
Title: ${product.title}
Description: ${product.descriptionHtml || "No description provided"}
Product Type: ${product.productType || "Uncategorized"}
Tags: ${product.tags?.length > 0 ? product.tags.join(", ") : "No tags"}
Handle: ${product.handle}${contextInfo}${specialInstructionsInfo}

=== 2025 OPTIMIZATION REQUIREMENTS ===

🏷️ TITLE OPTIMIZATION (60-70 characters):
✅ Format: [Primary Keyword] + [Brand/Model] + [Key Attribute] – [Secondary Benefit]
✅ Extract/infer brand, model, key attributes from existing title
✅ Prioritize high-intent commercial keywords
✅ Include size/color in parentheses if applicable
✅ Must be compelling and click-worthy
❌ Bad: "Awesome Comfortable Running Shoes!"
✅ Good: "Nike Air Zoom Pegasus 40 – Men's Lightweight Running Shoes (Black)"

📝 DESCRIPTION OPTIMIZATION (150-250 words):
✅ Hook: One compelling benefit-driven opening line
✅ Features: 3-5 bullet points with **bolded keywords**
✅ Voice Search: Include natural Q&A (e.g., "Perfect for runners who need...")
✅ CTA: Natural urgency without being pushy
✅ Mobile-optimized: Short paragraphs, scannable format
✅ Semantic keywords: Include variations and related terms
✅ HTML FORMATTING: Must use proper HTML tags for styling:
   - Use <strong> for bold keywords instead of **
   - Use <ul><li> for bullet lists
   - Use <p> for paragraphs
   - Use <br> for line breaks where needed
   - Proper HTML structure for readability

🏪 PRODUCT TYPE (Hierarchical):
✅ Format: Category > Subcategory > Specific Type
✅ Examples: "Footwear > Running Shoes > Men's" or "Electronics > Audio > Wireless Headphones"

🏷️ TAGS (5-10 strategic tags):
✅ Primary keyword + brand + attributes + use cases
✅ Long-tail variations (e.g., "running shoes men", "lightweight sneakers")
✅ Seasonal/trending terms where relevant
✅ Intent-based tags (e.g., "gifts for runners", "professional gear")

🔗 URL HANDLE (5-6 words max):
✅ Lowercase, hyphenated format
✅ Remove stop words: and, the, for, with, in, on, at, etc.
✅ Include brand + key attributes
✅ SEO-friendly and memorable
❌ Bad: "awesome-running-shoes-for-men-and-women"
✅ Good: "nike-air-zoom-pegasus-40-black"

🏪 VENDOR RULES:
✅ Use the shop/brand name as vendor OR leave empty
✅ NEVER use "AliExpress" or similar marketplace names
✅ Examples: "Nike", "Apple", "Samsung", "" (empty for generic)

🎯 2025 SEO PRIORITIES:
✅ Voice search optimization with natural language
✅ Mobile-first readability
✅ Intent-based keyword targeting
✅ Semantic keyword variations
✅ E-A-T signals (expertise, authority, trust)

ALWAYS WRITE IN ENGLISH!!!
RESPOND WITH ONLY THIS JSON FORMAT (no markdown, no explanations):
{
  "title": "optimized title exactly 60-70 characters",
  "description": "HTML-formatted description with <p>, <strong>, <ul><li> tags, hook, voice search elements, and CTA (150-250 words)",
  "productType": "Category > Subcategory > Specific Type",
  "tags": ["primary-keyword", "brand", "attribute1", "use-case", "long-tail-variation", "semantic-variant"],
  "handle": "optimized-url-handle",
  "vendor": "brand name or empty string (never AliExpress)"
}`;

  // Log the complete prompt being sent to OpenRouter
  console.log("=== SENDING PROMPT TO OPENROUTER ===");
  console.log(prompt);
  console.log("=== END PROMPT ===");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
      "HTTP-Referer": "https://shopify-product-optimizer.com", // For OpenRouter rankings
      "X-Title": "Shopify Product SEO Optimizer", // For OpenRouter rankings
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-chat-v3-0324:free",
      messages: [
        {
          role: "system",
          content: "You are an expert e-commerce SEO specialist with deep knowledge of 2025 best practices, Shopify optimization, and conversion rate optimization. You specialize in creating compelling product content that ranks well in search engines and converts visitors into customers."
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenRouter API error:", response.status, errorText);
    throw new Error(`OpenRouter API error (${response.status}): ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    console.error("OpenRouter response:", data);
    throw new Error("No content received from AI");
  }

  try {
    // Clean the content in case there's any markdown formatting
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanContent);

    // Validate required fields
    if (!parsed.title || !parsed.description || !parsed.productType || !parsed.tags || !parsed.handle) {
      console.error("Incomplete AI response:", parsed);
      throw new Error("AI response missing required fields");
    }

    // Set vendor to empty if it's AliExpress or similar marketplace names
    if (parsed.vendor && (parsed.vendor.toLowerCase().includes('aliexpress') ||
      parsed.vendor.toLowerCase().includes('alibaba') ||
      parsed.vendor.toLowerCase().includes('dhgate'))) {
      parsed.vendor = "";
    }

    return parsed;
  } catch (error) {
    console.error("JSON parsing error:", error);
    console.error("AI response content:", content);
    throw new Error(`Invalid JSON response from AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  // Ensure this only runs on the server - check for Node.js environment
  if (typeof process === "undefined" || !process.env) {
    throw new Error("This action should only run on the server");
  }

  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const productIds = JSON.parse(formData.get("productIds") as string);
  const optimizationContext = formData.get("context") ? JSON.parse(formData.get("context") as string) : undefined;

  if (intent === "optimize") {
    // Get user data (user is guaranteed to exist from app.tsx loader)
    const user = await ensureUserExists(session.shop);

    const requiredCredits = productIds.length;
    let hasEnoughCredits = user.credits >= requiredCredits;

    // If not enough credits, check if they have an active subscription
    if (!hasEnoughCredits) {
      const subscription = await getCurrentSubscription(request);
      if (subscription) {
        // If they have a subscription, reset their credits based on plan
        const planCredits = getCreditsForPlan(subscription.name);
        await updateUserCredits(session.shop, planCredits);
        hasEnoughCredits = planCredits >= requiredCredits;
        console.log(`🔄 Reset credits for ${session.shop} to ${planCredits} (plan: ${subscription.name})`);
      }
    }

    if (!hasEnoughCredits) {
      return json({
        error: "Insufficient credits",
        creditsNeeded: requiredCredits,
        creditsAvailable: user.credits,
        message: "You need more credits to optimize these products. Please upgrade your plan or wait for credits to reset."
      }, { status: 400 });
    }
    const results = [];
    console.log(`🚀 Starting optimization for ${productIds.length} product(s) via API route`);

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      console.log(`📦 Optimizing product ${i + 1}/${productIds.length}: ${productId}`);

      try {
        // First, get the current product data
        const productResponse = await admin.graphql(
          `#graphql
            query getProduct($id: ID!) {
              product(id: $id) {
                id
                title
                descriptionHtml
                handle
                productType
                vendor
                tags
              }
            }`,
          { variables: { id: productId } }
        );

        const productData = await productResponse.json();
        const product = productData.data?.product;

        if (!product) {
          results.push({ productId, success: false, error: "Product not found" });
          continue;
        }

        // Optimize with AI
        console.log(`🤖 Calling OpenRouter AI for product: ${product.title}`);
        const optimizedData = await optimizeProductWithAI({
          ...product,
          tags: product.tags || [],
          // Map descriptionHtml to description for the AI function
          description: product.descriptionHtml || "",
        } as any, optimizationContext);
        console.log(`✅ AI optimization complete for: ${product.title}`);

        // Update the product using correct Shopify ProductUpdate mutation
        console.log("💾 Updating product with optimized data:", {
          id: productId,
          title: optimizedData.title,
          description: optimizedData.description,
          handle: optimizedData.handle,
          productType: optimizedData.productType,
          tags: optimizedData.tags,
        });

        const updateResponse = await admin.graphql(
          `#graphql
            mutation updateProduct($product: ProductUpdateInput!) {
              productUpdate(product: $product) {
                product {
                  id
                  title
                  descriptionHtml
                  handle
                  productType
                  vendor
                  tags
                  status
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
          {
            variables: {
              product: {
                id: productId,
                title: optimizedData.title,
                descriptionHtml: optimizedData.description,
                handle: optimizedData.handle,
                productType: optimizedData.productType,
                vendor: optimizedData.vendor || "",
                tags: optimizedData.tags,
              },
            },
          }
        );

        const updateData = await updateResponse.json();
        console.log("📋 Shopify update response:", JSON.stringify(updateData, null, 2));

        const userErrors = updateData.data?.productUpdate?.userErrors;
        const updatedProduct = updateData.data?.productUpdate?.product;

        if (userErrors && userErrors.length > 0) {
          console.error("❌ Shopify update errors:", userErrors);
          results.push({
            productId,
            success: false,
            error: userErrors.map((e: any) => e.message).join(", ")
          });
        } else if (updatedProduct) {
          console.log(`🎉 Successfully optimized and updated product: ${updatedProduct.title}`);
          console.log("📊 Updated product data:", {
            id: updatedProduct.id,
            title: updatedProduct.title,
            description: updatedProduct.descriptionHtml,
            handle: updatedProduct.handle,
            productType: updatedProduct.productType,
            tags: updatedProduct.tags,
          });
          results.push({ productId, success: true, optimizedData, updatedProduct });
        } else {
          console.error("❌ No product returned from update mutation");
          results.push({
            productId,
            success: false,
            error: "No product returned from update mutation"
          });
        }

        // Small delay between API calls to respect rate limits
        if (i < productIds.length - 1) {
          console.log("⏱️ Waiting 1 second before next optimization...");
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (error) {
        console.error(`❌ Error optimizing product ${productId}:`, error);
        results.push({
          productId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Deduct credits for successful optimizations
    const successfulOptimizations = results.filter(r => r.success).length;
    if (successfulOptimizations > 0) {
      const newCredits = user.credits - successfulOptimizations;
      await updateUserCredits(session.shop, newCredits);
      console.log(`💳 Deducted ${successfulOptimizations} credits from ${session.shop}. New balance: ${newCredits}`);
    }

    console.log(`🏁 Optimization complete! Results: ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed`);
    return json({
      results,
      creditsUsed: successfulOptimizations,
      creditsRemaining: user.credits - successfulOptimizations
    });
  }

  return json({ error: "Invalid intent" }, { status: 400 });
};