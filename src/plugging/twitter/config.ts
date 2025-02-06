// export const config = {
//     keywords: {
//         technical: [
//             "solidity",
//             "web3",
//             "smart contract",
//             "ethereum",
//             "gas optimization",
//             "blockchain dev",
//             "zk proofs",
//             "L2",
//             "foundry",
//             "hardhat",
//             "defi",
//             "ethereum gas",
//             "cryptography",
//             "smart contract audit",
//             "web3 security",
//             "MEV",
//             "EIP",
//             "rollup",
//             "zero knowledge",
//             "consensus"
//         ],
//         projects: [
//             "uniswap",
//             "aave",
//             "opensea",
//             "arbitrum",
//             "optimism",
//             "polygon",
//             "chainlink",
//             "lisk",
//             "filecoin",
//             "lens protocol",
//             "base"
//         ],
//         topics: [
//             "gas fees",
//             "scalability",
//             "security",
//             "audit",
//             "hack",
//             "vulnerability",
//             "deployment",
//             "testing",
//             "development"
//         ]
//     },
//     users: {
//         developers: [
//             "VitalikButerin",
//             "gakonst",
//             "samczsun",
//             "transmissions11",
//             "PaulRBerg",
//             "pcaversaccio",
//             "bantg",
//             "0xngmi",
//             "noxx3xxon"
//         ],
//         projects: [
//             "ethereum",
//             "arbitrum",
//             "optimismFND",
//             "chainlink",
//             "aaveaave",
//             "uniswap"
//         ]
//     },
//     engagement: {
//         minFollowers: 100,
//         maxDailyReplies: 50,
//         minRelevanceScore: 0.7,
//         cooldownPeriod: 10 * 60 * 1000, // 10 minutes
//         replyProbability: 0.8
//     }
// };

// Example config.ts structure
// import dotenv from 'dotenv';
// dotenv.config();

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
    targetKeywords: ['blockchain', 'crypto', 'lisk', 'superchain','ai', 'tech', 'innovation'],
    targetHashtags: ['technews', 'airesearch', 'ethereum', 'buildeth', 'web3Calabar'],
    search: {
        maxResults: 100
    }
};