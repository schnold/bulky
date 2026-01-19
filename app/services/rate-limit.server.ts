import prisma from "../db.server";

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetTime: Date;
    limit: number;
}

/**
 * Checks and updates rate limits for a specific shop and action.
 * 
 * @param shop - The shop domain
 * @param action - The action identifier (e.g., "optimize", "generate-keywords")
 * @param limit - Max number of requests allowed in the window
 * @param windowInSeconds - The time window in seconds
 * @returns RateLimitResult
 */
export async function checkRateLimit(
    shop: string,
    action: string,
    limit: number,
    windowInSeconds: number = 3600 // Default 1 hour
): Promise<RateLimitResult> {
    const now = new Date();

    // Find or create the rate limit record
    const rateLimit = await prisma.rateLimit.upsert({
        where: {
            shop_action: {
                shop,
                action,
            },
        },
        update: {},
        create: {
            shop,
            action,
            count: 0,
            windowStart: now,
        },
    });

    const windowStart = new Date(rateLimit.windowStart);
    const windowEnd = new Date(windowStart.getTime() + windowInSeconds * 1000);
    const resetTime = windowEnd;

    // If we are past the current window, reset it
    if (now > windowEnd) {
        const updated = await prisma.rateLimit.update({
            where: { id: rateLimit.id },
            data: {
                count: 1,
                windowStart: now,
            },
        });

        return {
            allowed: true,
            remaining: limit - 1,
            resetTime: new Date(now.getTime() + windowInSeconds * 1000),
            limit,
        };
    }

    // If we are within the window, check the count
    if (rateLimit.count >= limit) {
        return {
            allowed: false,
            remaining: 0,
            resetTime,
            limit,
        };
    }

    // Increment the count
    const updated = await prisma.rateLimit.update({
        where: { id: rateLimit.id },
        data: {
            count: {
                increment: 1,
            },
        },
    });

    return {
        allowed: true,
        remaining: limit - updated.count,
        resetTime,
        limit,
    };
}
