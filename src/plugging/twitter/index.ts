import { Character, Plugin } from "@elizaos/core";
import { config } from "./config.ts";
import { TwitterUtils } from "./utils.ts";
import { EngagementMetrics, Sentiment, TweetContext } from "./types.ts";

export class TwitterEngagementPlugin implements Plugin {

    public name: string = "twitter-engagement";
    public description: string = "Twitter engagement plugin for monitoring and responding to relevant tweets";
    
    private cooldowns: Map<string, number> = new Map();
    private dailyReplies: number = 0;
    private lastResetDate: Date = new Date();

    constructor(private character: Character) {
        this.resetDailyCounts();
        TwitterUtils.initialize(character);
    }

    private resetDailyCounts() {
        const now = new Date();
        if (now.getDate() !== this.lastResetDate.getDate()) {
            this.dailyReplies = 0;
            this.lastResetDate = now;
        }
    }

    async analyzeTweet(tweet: any): Promise<boolean> {
        this.resetDailyCounts();
        
        if (this.dailyReplies >= config.engagement.maxDailyReplies) {
            return false;
        }

        const context = await TwitterUtils.analyzeContext(tweet);
        const metrics: EngagementMetrics = tweet.metrics;

        // Check cooldown
        const lastReply = this.cooldowns.get(tweet.user.id);
        if (lastReply && Date.now() - lastReply < config.engagement.cooldownPeriod) {
            return false;
        }

        // Analyze relevance
        const relevanceScore = this.calculateRelevance(context, metrics);
        return relevanceScore >= config.engagement.minRelevanceScore;
    }

    async generateReply(tweet: any): Promise<string | null> {
        const context = await TwitterUtils.analyzeContext(tweet);
        return TwitterUtils.generateResponse(context);
    }

    async initialize(): Promise<void> {
        setInterval(() => this.searchAndEngage(), 5 * 60 * 1000);
    }

    private calculateRelevance(context: TweetContext, metrics: EngagementMetrics): number {
        // Calculate individual relevance components (0-1 scale)
        const keywordScore = this.calculateKeywordScore(context.keywords);
        const influenceScore = this.calculateInfluenceScore(context.user.followersCount);
        const sentimentScore = this.calculateSentimentScore(context.sentiment);
        const engagementScore = this.calculateEngagementScore(metrics);
        const relationScore = this.calculateRelationScore(context);

        // Weighted average calculation
        const relevance = (
            (keywordScore * config.weights.keyword) +
            (influenceScore * config.weights.influence) +
            (sentimentScore * config.weights.sentiment) +
            (engagementScore * config.weights.engagement) +
            (relationScore * config.weights.relation)
        );

        return Math.min(Math.max(relevance, 0), 1); // Clamp between 0-1
    }

    private calculateKeywordScore(keywords: string[]): number {
        const matched = keywords.filter(kw => 
            config.targetKeywords.includes(kw.toLowerCase())
        );
        return matched.length / config.targetKeywords.length;
    }

    private calculateInfluenceScore(followers: number): number {
        return Math.log10(followers + 1) / Math.log10(config.influenceMaxFollowers + 1);
    }

    private calculateSentimentScore(sentiment: Sentiment): number {
        switch (sentiment) {
            case 'positive': return 1.0;
            case 'neutral': return 0.7;
            case 'negative': return 0.3;
            default: return 0.5;
        }
    }

    private calculateEngagementScore(metrics: EngagementMetrics): number {
        const weightedEngagement = 
            (metrics.likes * config.engagementWeights.like) +
            (metrics.retweets * config.engagementWeights.retweet) +
            (metrics.replies * config.engagementWeights.reply);
        
        return weightedEngagement / config.engagementThreshold;
    }

    private calculateRelationScore(context: TweetContext): number {
        let score = 0;
        if (context.mentions.includes(config.botUsername)) score += 0.5;
        if (context.hashtags.some(tag => config.targetHashtags.includes(tag))) score += 0.3;
        if (context.isReplyToBot) score += 0.2;
        return Math.min(score, 1);
    }

    private async searchAndEngage(): Promise<void> {
        try {
            // Reset daily counts if needed
            this.resetDailyCounts();

            // Check rate limits
            if (this.dailyReplies >= config.engagement.maxDailyReplies) {
                return;
            }

            // Search for relevant tweets
            const query = this.buildSearchQuery();
            const tweets = await TwitterUtils.searchTweets({
                query,
                maxResults: config.search.maxResults,
                recent: true
            });

            for (const tweet of tweets) {
                if (this.dailyReplies >= config.engagement.maxDailyReplies) break;

                // Skip own tweets and retweets
                if (tweet.user.id === config.botUserId || tweet.isRetweet) continue;

                // Check if we should reply
                if (await this.analyzeTweet(tweet)) {
                    const replyText = await this.generateReply(tweet);
                    if (replyText) {
                        await TwitterUtils.postReply(tweet.id, replyText);
                        
                        // Update engagement tracking
                        this.cooldowns.set(tweet.user.id, Date.now());
                        this.dailyReplies++;
                        
                        // Add brief delay between replies
                        await new Promise(resolve => 
                            setTimeout(resolve, config.engagement.replyDelay)
                        );
                    }
                }
            }
        } catch (error) {
            console.error('Twitter engagement error:', error);
            // Implement your error reporting here
        }
    }

    private buildSearchQuery(): string {
        const keywords = config.targetKeywords.map(kw => `"${kw}"`).join(' OR ');
        const hashtags = config.targetHashtags.map(tag => `#${tag}`).join(' OR ');
        return `(${keywords} OR ${hashtags}) -is:retweet -from:${config.botUserId}`;
    }
}