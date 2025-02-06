export interface EngagementMetrics {
    likes: number;
    retweets: number;
    replies: number;
}

export interface TweetContext {
    text: string;
    keywords: string[];
    hashtags: string[];
    mentions: string[];
    sentiment: Sentiment;
    user: {
        id: string;
        followersCount: number;
        isVerified: boolean;
    };
    isReplyToBot: boolean;
}

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'unknown';