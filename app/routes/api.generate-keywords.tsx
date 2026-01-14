import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { ensureUserExists } from "../utils/db.server";
import prisma from "../db.server";
import { getCurrentSubscription } from "../utils/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    const { session } = await authenticate.admin(request);

    if (!session || !session.shop) {
      return json({ error: "Authentication failed" }, { status: 401 });
    }

    const formData = await request.formData();
    const userInput = formData.get("userInput") as string;

    if (!userInput || userInput.trim() === "") {
      return json({ error: "Input cannot be empty" }, { status: 400 });
    }

    // Ensure user exists
    const user = await ensureUserExists(session.shop);

    if (!user) {
      return json({ error: "Failed to find user" }, { status: 500 });
    }

    // Check if user has Pro or Enterprise plan
    const subscription = await getCurrentSubscription(request);
    const planMapping: { [key: string]: string } = {
      "Starter Plan": "starter",
      "Pro Plan": "pro",
      "Enterprise Plan": "enterprise",
      "starter_plan": "starter",
      "pro_plan": "pro",
      "enterprise_plan": "enterprise",
      "starter": "starter",
      "pro": "pro",
      "enterprise": "enterprise",
      "B1 Bulk Product SEO Optimizer - Starter": "starter",
      "B1 Bulk Product SEO Optimizer - Pro": "pro",
      "B1 Bulk Product SEO Optimizer - Enterprise": "enterprise"
    };

    const userPlan = subscription 
      ? (planMapping[subscription.name] || user.plan)
      : user.plan;

    if (userPlan !== "pro" && userPlan !== "enterprise") {
      return json({ 
        error: "This feature is only available for Pro and Enterprise plans" 
      }, { status: 403 });
    }

    // Get existing keywords to avoid duplicates
    const existingKeywords = await prisma.keyword.findMany({
      where: { userId: user.id },
      select: { keyword: true }
    });
    const existingKeywordsSet = new Set(
      existingKeywords.map(k => k.keyword.toLowerCase().trim())
    );

    // Create high-quality prompt for keyword generation
    const prompt = `You are an expert SEO specialist specializing in e-commerce keyword research and optimization. Your task is to generate highly relevant, strategic SEO keywords based on the user's input.

USER INPUT: "${userInput.trim()}"

TASK: Generate a comprehensive list of SEO keywords that would be valuable for optimizing Shopify products related to this input. Consider:

1. **Primary Keywords**: Main search terms users would use
2. **Long-tail Keywords**: Specific, detailed search queries (3-5 words)
3. **Semantic Variations**: Related terms and synonyms
4. **Intent-based Keywords**: Commercial, informational, and navigational intent
5. **Product-specific Keywords**: Attributes, features, use cases
6. **Seasonal/Trending Terms**: If relevant to the input

GUIDELINES:
- Generate 10-20 high-quality keywords
- Focus on keywords with commercial intent (buying keywords)
- Include both broad and specific terms
- Consider different user personas and search behaviors
- Keywords should be relevant to e-commerce product optimization
- Avoid overly generic terms unless they're highly valuable
- Include brand variations if applicable
- Consider local/geographic variations if relevant

OUTPUT FORMAT: Return ONLY a JSON array of keyword strings, nothing else. No markdown, no explanations, just the array.

Example format:
["keyword 1", "keyword 2", "keyword 3", ...]`;

    // Call OpenRouter API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, 30000); // 30 second timeout

    let response, data, content;

    try {
      response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPEN_ROUTER_API_KEY}`,
          "HTTP-Referer": "https://shopify-product-optimizer.com",
          "X-Title": "Shopify Product SEO Optimizer",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-001",
          messages: [
            {
              role: "system",
              content: "You are an expert SEO specialist specializing in e-commerce keyword research. You generate high-quality, strategic SEO keywords for Shopify product optimization. Always respond with valid JSON arrays only."
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens: 1000,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

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
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.error("OpenRouter API call was aborted due to timeout");
        throw new Error("AI keyword generation timed out. Please try again.");
      }
      
      console.error("OpenRouter fetch error:", error);
      throw error;
    }

    // Parse the response
    let keywords: string[] = [];
    try {
      // Clean the content in case there's any markdown formatting
      const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleanContent);

      if (Array.isArray(parsed)) {
        keywords = parsed;
      } else if (parsed.keywords && Array.isArray(parsed.keywords)) {
        keywords = parsed.keywords;
      } else {
        throw new Error("Invalid response format from AI");
      }
    } catch (error) {
      console.error("JSON parsing error:", error);
      console.error("AI response content:", content);
      throw new Error(`Invalid JSON response from AI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Filter out duplicates and empty strings, normalize keywords
    const normalizedKeywords = keywords
      .map(k => typeof k === 'string' ? k.trim() : String(k).trim())
      .filter(k => k.length > 0)
      .filter(k => !existingKeywordsSet.has(k.toLowerCase()));

    if (normalizedKeywords.length === 0) {
      return json({ 
        success: true, 
        message: "No new keywords generated (all were duplicates or invalid)",
        keywordsAdded: 0,
        keywords: []
      });
    }

    // Add keywords to database (ignore duplicates via unique constraint)
    const addedKeywords: string[] = [];
    const skippedKeywords: string[] = [];

    for (const keyword of normalizedKeywords) {
      try {
        await prisma.keyword.create({
          data: {
            keyword: keyword,
            userId: user.id,
          }
        });
        addedKeywords.push(keyword);
      } catch (error: any) {
        // If it's a unique constraint violation, it's a duplicate - skip it
        if (error.code === 'P2002') {
          skippedKeywords.push(keyword);
        } else {
          console.error(`Error adding keyword "${keyword}":`, error);
        }
      }
    }

    return json({
      success: true,
      message: `Successfully generated ${addedKeywords.length} keyword(s)`,
      keywordsAdded: addedKeywords.length,
      keywordsSkipped: skippedKeywords.length,
      keywords: addedKeywords
    });

  } catch (error) {
    console.error("Keyword generation error:", error);
    return json({ 
      error: error instanceof Error ? error.message : "Failed to generate keywords" 
    }, { status: 500 });
  }
};
