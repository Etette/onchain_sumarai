import { TweetContext, Sentiment, EngagementMetrics } from "./types.ts";
import { config } from "./config.ts";
import { Character } from "@elizaos/core";

// export class TwitterUtils {
//     static async analyzeContext(tweet: any): Promise<TweetContext> {
//         try {
//             const text = tweet.text.toLowerCase();
//             const keywords = await this.extractKeywords(text);
//             const sentiment = await this.analyzeSentiment(text);
            
//             return {
//                 text: tweet.text,
//                 keywords,
//                 hashtags: tweet.entities?.hashtags?.map(h => h.text.toLowerCase()) || [],
//                 mentions: tweet.entities?.user_mentions?.map(m => m.screen_name) || [],
//                 sentiment,
//                 user: {
//                     id: tweet.user.id_str,
//                     followersCount: tweet.user.followers_count,
//                     isVerified: tweet.user.verified || false,
//                 },
//                 isReplyToBot: tweet.in_reply_to_user_id_str === config.botUserId
//             };
//         } catch (error) {
//             console.error("Error in analyzeContext:", error);
//             throw error;
//         }
//     }

//     private static async extractKeywords(text: string): Promise<string[]> {
//         const words = text.toLowerCase().split(/\s+/);
//         const extracted = new Set<string>();

//         // First pass: direct keyword matching
//         config.targetKeywords.forEach(keyword => {
//             if (text.includes(keyword.toLowerCase())) {
//                 extracted.add(keyword.toLowerCase());
//             }
//         });

//         try {
//             // Using ElizaOS model for advanced keyword extraction
//             const prompt = `
//             From the following text, extract keywords related to ${config.targetKeywords.join(', ')}.
//             Text: "${text}"
//             Return only relevant keywords, separated by commas.
//             `;

//             const response = await global.eliza.model.complete({
//                 prompt,
//                 max_tokens: 50,
//                 temperature: 0.3,
//                 stop: ["\n", "Keywords:"]
//             });

//             const aiKeywords = response.text
//                 .split(",")
//                 .map(k => k.trim().toLowerCase())
//                 .filter(k => k.length > 0 && 
//                     (config.targetKeywords.includes(k) || 
//                      text.includes(k)));

//             aiKeywords.forEach(k => extracted.add(k));
//         } catch (error) {
//             console.error("Error in keyword extraction:", error);
//             // Continue with existing keywords if AI extraction fails
//         }

//         return Array.from(extracted);
//     }

//     private static async analyzeSentiment(text: string): Promise<Sentiment> {
//         try {
//             const prompt = `
//             Analyze the sentiment of this text and respond with exactly one word: positive, negative, neutral, or unknown.
//             Text: "${text}"
//             `;

//             const response = await global.eliza.model.complete({
//                 prompt,
//                 max_tokens: 10,
//                 temperature: 0.1,
//                 stop: ["\n", "Sentiment:"]
//             });

//             const sentiment = response.text.trim().toLowerCase();
            
//             if (sentiment === 'positive' || 
//                 sentiment === 'negative' || 
//                 sentiment === 'neutral' || 
//                 sentiment === 'unknown') {
//                 return sentiment as Sentiment;
//             }
            
//             return 'unknown';
//         } catch (error) {
//             console.error("Error in sentiment analysis:", error);
//             return 'unknown';
//         }
//     }

//     static async generateResponse(context: TweetContext): Promise<string | null> {
//         const templates = {
//             lisk: [
//                 "Interesting take on #Lisk! The superchain architecture offers significant advantages for blockchain scalability.",
//                 "Have you explored Lisk's approach to blockchain interoperability? It's quite innovative.",
//                 "The Lisk ecosystem is evolving rapidly. Worth checking out their latest developments.",
//                 "Lisk's superchain design could be a game-changer for cross-chain communication.",
//                 "Great insights on Lisk! The potential for AI integration in their superchain is particularly exciting.",
//                 "Lisk is driving innovation in the Human Layer, enabling new possibilities for blockchain adoption."
//             ],
//             tech: [
//                 "Fascinating perspective on tech innovation! Have you considered the implications for blockchain adoption?",
//                 "This aligns well with recent developments in blockchain architecture and AI integration.",
//                 "Great point about innovation! The intersection with blockchain tech is particularly promising.",
//                 "The convergence of AI and blockchain is creating exciting opportunities in this space."
//             ],
//             general: [
//                 "Interesting thoughts! The blockchain ecosystem is evolving rapidly in this direction.",
//                 "Valid points about tech adoption. The potential for blockchain integration here is significant.",
//                 "This could have interesting implications for blockchain scalability and adoption.",
//                 "Thoughtful analysis! The intersection with blockchain technology is particularly relevant."
//             ]
//         };

//         try {
//             const prompt = `
//             Generate a Twitter response (max 280 chars) related to blockchain, technology or the context keywords.
//             Context keywords: ${context.keywords.join(', ')}
//             Hashtags: ${context.hashtags.join(', ')}
//             Sentiment: ${context.sentiment}
            
//             Requirements:
//             - Be professional and constructive
//             - Relate to blockchain/tech innovation
//             - Include relevant context
//             - End with a thought-provoking point
//             `;

//             const response = await global.eliza.model.complete({
//                 prompt,
//                 max_tokens: 100,
//                 temperature: 0.7,
//                 stop: ["\n", "Response:"]
//             });

//             let generatedResponse = response.text.trim();

//             // Ensure tweet length compliance
//             if (generatedResponse.length > 280) {
//                 generatedResponse = generatedResponse.substring(0, 277) + "...";
//             }

//             return generatedResponse;
//         } catch (error) {
//             console.error("Error generating response:", error);
            
//             // Fallback to templates
//             const category = context.keywords.includes('lisk') ? 'lisk' :
//                            context.keywords.some(k => ['ai', 'tech', 'innovation'].includes(k)) ? 'tech' : 
//                            'general';
            
//             const templates_array = templates[category];
//             return templates_array[Math.floor(Math.random() * templates_array.length)];
//         }
//     }

//     static async searchTweets(params: { 
//         query: string, 
//         maxResults: number, 
//         recent: boolean 
//     }): Promise<any[]> {
//         try {
//             const tweets = await global.eliza.twitter.search({
//                 query: params.query,
//                 count: Math.min(params.maxResults, config.search.maxResults),
//                 result_type: params.recent ? 'recent' : 'mixed',
//                 tweet_mode: 'extended',
//                 include_entities: true
//             });

//             // Add engagement metrics to each tweet
//             return tweets.map(tweet => ({
//                 ...tweet,
//                 metrics: {
//                     likes: tweet.favorite_count || 0,
//                     retweets: tweet.retweet_count || 0,
//                     replies: tweet.reply_count || 0
//                 } as EngagementMetrics
//             }));
//         } catch (error) {
//             console.error("Error searching tweets:", error);
//             return [];
//         }
//     }

//     static async postReply(tweetId: string, replyText: string): Promise<void> {
//         try {
//             await global.eliza.twitter.tweet({
//                 status: replyText,
//                 in_reply_to_status_id: tweetId,
//                 auto_populate_reply_metadata: true
//             });
//         } catch (error) {
//             console.error("Error posting reply:", error);
//             throw error;
//         }
//     }
// }


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