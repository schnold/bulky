import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  updateUserCredits,
  addUserCredits,
  getCreditsForPlan
} from "../models/user.server";
import { getCurrentSubscription } from "../utils/billing.server";
import { ensureUserExists } from "../utils/db.server";
import { checkRateLimit } from "../services/rate-limit.server";
import { z } from "zod";

const OptimizeSchema = z.object({
  productIds: z.array(z.string().min(1)).min(1),
  context: z.object({
    targetKeywords: z.string().optional(),
    brand: z.string().optional(),
    keyFeatures: z.string().optional(),
    targetAudience: z.string().optional(),
    useCase: z.string().optional(),
    competitorAnalysis: z.boolean().optional(),
    voiceSearchOptimization: z.boolean().optional(),
    specialInstructions: z.string().optional(),
  }).optional(),
});

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

🎯 SEO META TITLE (50-60 characters):
✅ Primary keyword at the beginning
✅ Include brand name
✅ Clear value proposition
✅ Under 60 characters for optimal display in search results
✅ Example: "Nike Air Zoom Pegasus 40 - Men's Running Shoes | Shop Now"

📄 SEO META DESCRIPTION (MAXIMUM 150 characters - MUST END NATURALLY):
✅ Write COMPLETE sentences that end naturally before 150 characters
✅ NO incomplete sentences, NO trailing off, NO "..." needed
✅ Make it self-contained and coherent - every sentence must be complete
✅ Include primary keywords, benefits, and brief CTA
✅ Write concisely - use short, punchy sentences
✅ Aim for 140-150 characters to allow natural sentence endings
✅ Count characters as you write - ensure the last sentence completes within the limit
✅ Example (149 chars): "Premium men's running shoes with cushioned comfort. Lightweight design for long-distance runners. Shop now with free shipping!"
❌ BAD: "Shop Nike Air Zoom Pegasus 40 men's running shoes. Lightweight comfort for runners with breathable mesh and..." (sentence cuts off)
✅ GOOD: "Nike Air Zoom Pegasus 40 men's running shoes. Lightweight, breathable comfort. Free shipping on all orders!"

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
  "vendor": "brand name or empty string (never AliExpress)",
  "seoTitle": "SEO meta title 50-60 characters with primary keyword and brand",
  "seoDescription": "Complete, coherent SEO description that ends naturally at 140-150 characters (NEVER exceed 150!)"
}

CRITICAL RULES FOR seoDescription:
1. MUST be complete sentences that end naturally - NO cut-off sentences
2. MUST NOT exceed 150 characters total (including spaces and punctuation)
3. Write short, punchy sentences to ensure they complete within the limit
4. The description must make perfect sense and read coherently
5. Aim for 140-150 characters to maximize space while ensuring natural endings
6. Count every character before responding to ensure it fits perfectly`;

  // Log the complete prompt being sent to OpenRouter
  console.log("=== SENDING PROMPT TO OPENROUTER ===");
  console.log(prompt);
  console.log("=== END PROMPT ===");

  // Create an abort controller for timeout protection
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    console.warn("⚠️ OpenRouter API call timed out after 30 seconds");
    controller.abort();
  }, 30000); // 30 second timeout to prevent serverless function timeout

  let response, data, content;

  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
        "HTTP-Referer": "https://shopify-product-optimizer.com", // For OpenRouter rankings
        "X-Title": "Shopify Product SEO Optimizer", // For OpenRouter rankings
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-lite-001",
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
      signal: controller.signal, // Add abort signal for timeout
    });

    // Clear the timeout if request completes
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenRouter API error:", response.status, errorText);
      throw new Error(`OpenRouter API error (${response.status}): ${response.statusText}`);
    }

    data = await response.json();
    content = data.choices[0]?.message?.content;

    if (!content) {
      console.error("OpenRouter response:", data);
      throw new Error("No content received from AI");
    }
  } catch (error) {
    // Clear timeout and handle fetch errors (including aborts)
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      console.error("OpenRouter API call was aborted due to timeout");
      throw new Error("AI optimization timed out. Please try again.");
    }

    console.error("OpenRouter fetch error:", error);
    throw error; // Re-throw other errors
  }

  try {
    // Clean the content in case there's any markdown formatting
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleanContent);

    // Validate required fields
    if (!parsed.title || !parsed.description || !parsed.productType || !parsed.tags || !parsed.handle || !parsed.seoTitle || !parsed.seoDescription) {
      console.error("Incomplete AI response:", parsed);
      throw new Error("AI response missing required fields");
    }

    // Set vendor to empty if it's AliExpress or similar marketplace names
    if (parsed.vendor && (parsed.vendor.toLowerCase().includes('aliexpress') ||
      parsed.vendor.toLowerCase().includes('alibaba') ||
      parsed.vendor.toLowerCase().includes('dhgate'))) {
      parsed.vendor = "";
    }

    // Enforce SEO description character limit (truncate if needed - but AI should write it correctly)
    if (parsed.seoDescription && parsed.seoDescription.length > 150) {
      console.warn(`⚠️ SEO description exceeded 150 characters (${parsed.seoDescription.length}), attempting smart truncation...`);

      // Try to find the last complete sentence within 150 characters
      const withinLimit = parsed.seoDescription.substring(0, 150);
      const lastPeriod = withinLimit.lastIndexOf('.');
      const lastExclamation = withinLimit.lastIndexOf('!');
      const lastQuestion = withinLimit.lastIndexOf('?');

      // Find the last sentence boundary
      const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);

      if (lastSentenceEnd > 100) {
        // If we found a sentence boundary after position 100, use it
        parsed.seoDescription = withinLimit.substring(0, lastSentenceEnd + 1).trim();
        console.log(`✅ Truncated to last complete sentence: ${parsed.seoDescription.length} characters`);
      } else {
        // If no good sentence boundary, find last complete word and add period
        const lastSpace = withinLimit.lastIndexOf(' ');
        if (lastSpace > 100) {
          parsed.seoDescription = withinLimit.substring(0, lastSpace).trim() + '.';
          console.log(`⚠️ Truncated to last complete word: ${parsed.seoDescription.length} characters`);
        } else {
          // Last resort: hard truncate
          parsed.seoDescription = withinLimit.substring(0, 147) + "...";
          console.log(`❌ Hard truncated: ${parsed.seoDescription.length} characters`);
        }
      }
    }

    return parsed;
  } catch (error) {
    console.error("JSON parsing error:", error);
    console.error("AI response content:", content);
    throw new Error(`Invalid JSON response from AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "optimize") {
    // Validate request body
    const productIdsRaw = formData.get("productIds");
    const contextRaw = formData.get("context");

    let parsed;
    try {
      parsed = OptimizeSchema.parse({
        productIds: JSON.parse(productIdsRaw as string),
        context: contextRaw ? JSON.parse(contextRaw as string) : undefined
      });
    } catch (error) {
      return json({
        error: "Invalid request data",
        details: error instanceof z.ZodError ? error.issues : "Unknown error"
      }, { status: 400 });
    }

    const { productIds, context: optimizationContext } = parsed;

    // Apply rate limiting (500 per hour)
    const rateLimit = await checkRateLimit(session.shop, "optimize", 500, 3600);
    if (!rateLimit.allowed) {
      return json({
        error: "Rate limit exceeded",
        message: `You have reached the limit of 500 optimizations per hour. Please wait until ${rateLimit.resetTime.toLocaleTimeString()} to continue.`,
        resetTime: rateLimit.resetTime,
      }, { status: 429 });
    }

    // Get user data (user is guaranteed to exist from app.tsx loader)
    const user = await ensureUserExists(session.shop);

    const requiredCredits = productIds.length;
    let hasEnoughCredits = user.credits >= requiredCredits;

    // If not enough credits, check if they have an active subscription
    if (!hasEnoughCredits) {
      const subscription = await getCurrentSubscription(request);
      if (subscription) {
        // If they have a subscription, add plan credits to existing balance
        const planCredits = getCreditsForPlan(subscription.name);
        const updatedUser = await addUserCredits(session.shop, planCredits);
        if (updatedUser) {
          hasEnoughCredits = updatedUser.credits >= requiredCredits;
          console.log(`🔄 Added ${planCredits} credits to ${session.shop} (plan: ${subscription.name}). New balance: ${updatedUser.credits}`);
        }
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
      console.log(`⏰ Start time: ${new Date().toISOString()}`);

      try {
        // Use serverless-compatible GraphQL client
        const { createServerlessAdminClient } = await import("../utils/shopify-graphql.server");
        const adminClient = createServerlessAdminClient(session.shop, session.accessToken!);

        // First, get the current product data
        console.log(`📋 Fetching product data for: ${productId}`);
        const productResponse = await adminClient.graphql(
          `query getProduct($id: ID!) {
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
          { id: productId }
        );

        const productData = await productResponse.json();
        const product = productData.data?.product;

        if (!product) {
          console.error(`❌ Product not found: ${productId}`);
          results.push({ productId, success: false, error: "Product not found" });
          continue;
        }

        // Optimize with AI
        console.log(`🤖 Calling OpenRouter AI for product: ${product.title}`);
        const aiStartTime = Date.now();
        const optimizedData = await optimizeProductWithAI({
          ...product,
          tags: product.tags || [],
          // Map descriptionHtml to description for the AI function
          description: product.descriptionHtml || "",
        } as any, optimizationContext);
        const aiDuration = Date.now() - aiStartTime;
        console.log(`✅ AI optimization complete for: ${product.title} (took ${aiDuration}ms)`);

        // Store the optimized data for review instead of auto-publishing
        console.log(`✅ AI optimization complete for: ${product.title} (took ${aiDuration}ms)`);
        console.log("📊 Optimized data ready for review:", {
          id: productId,
          title: optimizedData.title,
          description: optimizedData.description,
          handle: optimizedData.handle,
          productType: optimizedData.productType,
          tags: optimizedData.tags,
        });

        // Return success with optimized data for client-side storage
        results.push({
          productId,
          success: true,
          optimizedData,
          originalProduct: product
        });

        // No delay needed since we're no longer updating Shopify directly
        console.log(`⏰ Total processing time: ${Date.now() - aiStartTime}ms`);
      } catch (error) {
        console.error(`❌ Error optimizing product ${productId}:`, error);
        console.error(`❌ Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
        results.push({
          productId,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }

    // Deduct credits for successful optimizations (now happens on optimization, not publishing)
    const successfulOptimizations = results.filter(r => r.success).length;
    if (successfulOptimizations > 0) {
      const newCredits = user.credits - successfulOptimizations;
      await updateUserCredits(session.shop, newCredits);
      console.log(`💳 Deducted ${successfulOptimizations} credits from ${session.shop}. New balance: ${newCredits}`);
    }

    console.log(`🏁 Optimization complete! Results: ${results.filter(r => r.success).length} successful, ${results.filter(r => !r.success).length} failed (ready for review)`);
    return json({
      results,
      creditsUsed: successfulOptimizations,
      creditsRemaining: user.credits - successfulOptimizations
    });
  }

  return json({ error: "Invalid intent" }, { status: 400 });
};