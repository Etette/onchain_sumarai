import { TweetContext, Sentiment, EngagementMetrics } from "./types.ts";
import { config } from "./config.ts";
import { Character } from "@elizaos/core";


export class TwitterUtils {
    private static character: Character;

    static initialize(character: Character) {
        this.character = character;
    }

    static async analyzeContext(tweet: any): Promise<TweetContext> {
        try {
            const text = tweet.text.toLowerCase();
            const keywords = await this.extractKeywords(text);
            const sentiment = await this.analyzeSentiment(text);
            
            return {
                text: tweet.text,
                keywords,
                hashtags: tweet.entities?.hashtags?.map(h => h.text.toLowerCase()) || [],
                mentions: tweet.entities?.user_mentions?.map(m => m.screen_name) || [],
                sentiment,
                user: {
                    id: tweet.user.id_str,
                    followersCount: tweet.user.followers_count,
                    isVerified: tweet.user.verified || false,
                },
                isReplyToBot: tweet.in_reply_to_user_id_str === config.botUserId
            };
        } catch (error) {
            console.error("Error in analyzeContext:", error);
            throw error;
        }
    }

    private static async extractKeywords(text: string): Promise<string[]> {
        const words = text.toLowerCase().split(/\s+/);
        const extracted = new Set<string>();

        // Include character's topics in keyword matching
        const relevantTerms = [...config.targetKeywords, ...this.character.topics];
        
        relevantTerms.forEach(keyword => {
            if (text.includes(keyword.toLowerCase())) {
                extracted.add(keyword.toLowerCase());
            }
        });

        try {
            const prompt = `
            As ${this.character.name}, analyze this text and extract technical keywords related to:
            ${this.character.topics.join(', ')}
            
            Text: "${text}"
            Return only relevant technical keywords, separated by commas.
            `;

            const response = await global.eliza.model.complete({
                prompt,
                max_tokens: 50,
                temperature: 0.3,
                stop: ["\n", "Keywords:"]
            });

            const aiKeywords = response.text
                .split(",")
                .map(k => k.trim().toLowerCase())
                .filter(k => k.length > 0);

            aiKeywords.forEach(k => extracted.add(k));
        } catch (error) {
            console.error("Error in keyword extraction:", error);
        }

        return Array.from(extracted);
    }

    private static async analyzeSentiment(text: string): Promise<Sentiment> {
        try {
            const prompt = `
            As ${this.character.name}, a technical expert, analyze the sentiment of this text.
            Consider technical accuracy and innovation when determining sentiment.
            Respond with exactly one word: positive, negative, neutral, or unknown.
            
            Text: "${text}"
            `;

            const response = await global.eliza.model.complete({
                prompt,
                max_tokens: 10,
                temperature: 0.1,
                stop: ["\n", "Sentiment:"]
            });

            const sentiment = response.text.trim().toLowerCase();
            if (['positive', 'negative', 'neutral', 'unknown'].includes(sentiment)) {
                return sentiment as Sentiment;
            }
            return 'unknown';
        } catch (error) {
            console.error("Error in sentiment analysis:", error);
            return 'unknown';
        }
    }

    static async generateResponse(context: TweetContext): Promise<string | null> {
        try {
            // Select random example posts that match the context
            const relevantExamples = this.character.postExamples.filter(post => 
                context.keywords.some(keyword => 
                    post.toLowerCase().includes(keyword.toLowerCase())
                )
            );

            const prompt = `
            You are ${this.character.name}. ${this.character.system}

            Style guidelines:
            ${this.character.style.post.join('\n')}

            Tweet context:
            - Keywords: ${context.keywords.join(', ')}
            - Hashtags: ${context.hashtags.join(', ')}
            - Sentiment: ${context.sentiment}
            - Text: "${context.text}"

            Example posts for reference:
            ${relevantExamples.slice(0, 3).join('\n')}

            Generate a technical, insightful response (max 280 chars) that matches your character's style and expertise.
            `;

            const response = await global.eliza.model.complete({
                prompt,
                max_tokens: 100,
                temperature: 0.7,
                stop: ["\n", "Response:"]
            });

            let generatedResponse = response.text.trim();

            // Ensure tweet length compliance
            if (generatedResponse.length > 280) {
                generatedResponse = generatedResponse.substring(0, 277) + "...";
            }

            return generatedResponse;
        } catch (error) {
            console.error("Error generating response:", error);
            
            // Fallback to relevant example posts
            const relevantPosts = this.character.postExamples.filter(post => 
                context.keywords.some(keyword => post.toLowerCase().includes(keyword.toLowerCase()))
            );
            
            return relevantPosts.length > 0 
                ? relevantPosts[Math.floor(Math.random() * relevantPosts.length)]
                : null;
        }
    }

    static async searchTweets(params: { 
        query: string, 
        maxResults: number, 
        recent: boolean 
    }): Promise<any[]> {
        try {
            // Add character's topics to search query
            const enhancedQuery = this.enhanceSearchQuery(params.query);
            
            const tweets = await global.eliza.twitter.search({
                query: enhancedQuery,
                count: Math.min(params.maxResults, config.search.maxResults),
                result_type: params.recent ? 'recent' : 'mixed',
                tweet_mode: 'extended',
                include_entities: true
            });

            return tweets.map(tweet => ({
                ...tweet,
                metrics: {
                    likes: tweet.favorite_count || 0,
                    retweets: tweet.retweet_count || 0,
                    replies: tweet.reply_count || 0
                } as EngagementMetrics
            }));
        } catch (error) {
            console.error("Error searching tweets:", error);
            return [];
        }
    }

    private static enhanceSearchQuery(baseQuery: string): string {
        // Add character's most relevant topics to the search
        const topicTerms = this.character.topics
            .slice(0, 5) // Take top 5 topics to avoid query length issues
            .map(topic => `"${topic}"`)
            .join(' OR ');
        
        return `(${baseQuery}) OR (${topicTerms}) -is:retweet -from:${config.botUserId}`;
    }

    static async postReply(tweetId: string, replyText: string): Promise<void> {
        try {
            await global.eliza.twitter.tweet({
                status: replyText,
                in_reply_to_status_id: tweetId,
                auto_populate_reply_metadata: true
            });
        } catch (error) {
            console.error("Error posting reply:", error);
            throw error;
        }
    }
}