import { Proposal } from '@/types';

const now = new Date();
const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

export const mockProposals: Proposal[] = [
    {
        id: '1',
        title: 'Should we adopt the Snowy Protocol?',
        summary: 'This proposal suggests implementing the new Snowy Protocol to enhance community engagement...',
        startTime: now.toISOString(),
        endTime: fiveDaysLater.toISOString(),
        votes: {
            for: 1500,
            against: 200,
            abstain: 50,
        },
        totalVotes: 1750,
        status: 'active',
    },
    {
        id: '2',
        title: 'Archive: Increase daily rewards',
        summary: 'Proposal to increase the daily token rewards by 10%.',
        startTime: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        endTime: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        votes: {
            for: 5000,
            against: 4500,
            abstain: 1000,
        },
        totalVotes: 10500,
        status: 'closed',
    },
];
