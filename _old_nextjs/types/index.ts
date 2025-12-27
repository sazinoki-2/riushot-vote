export type VoteOption = 'for' | 'against' | 'abstain';

export interface Proposal {
    id: string;
    title: string;
    summary: string;
    startTime: string; // ISO string
    endTime: string;   // ISO string
    votes: {
        for: number;
        against: number;
        abstain: number;
    };
    totalVotes: number;
    status: 'active' | 'closed';
}
