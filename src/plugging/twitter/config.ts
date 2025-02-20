export const config = {
    botUserId: process.env.TWITTER_ID,
    botUsername: process.env.TWITTER_USERNAME,
    engagement: {
        maxDailyReplies: 50,
        cooldownPeriod: 3600000, // 1 hour
        minRelevanceScore: 0.65,
        replyDelay: 3000 // 3 seconds
    },
    weights: {
        keyword: 0.4,
        influence: 0.2,
        sentiment: 0.15,
        engagement: 0.15,
        relation: 0.1
    },
    engagementWeights: {
        like: 1,
        retweet: 2,
        reply: 3
    },
    influenceMaxFollowers: 1000000,
    engagementThreshold: 50,
    targetKeywords: ['blockchain', 'crypto', 'lisk', 'superchain','ai', 'tech', 'innovation', 'bitcoin'],
    targetHashtags: ['lisk', 'blockchain', 'ethereum', 'crypto', 'web3'],
    search: {
        maxResults: 100
    }
};