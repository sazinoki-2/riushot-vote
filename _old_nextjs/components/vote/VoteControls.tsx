'use client';

import { useState } from 'react';
import { Proposal, VoteOption } from '@/types';
import styles from './VoteControls.module.css';

interface Props {
    proposal: Proposal;
}

export default function VoteControls({ proposal }: Props) {
    const [selected, setSelected] = useState<VoteOption | null>(null);
    const [hasVoted, setHasVoted] = useState(false);

    // Local state to simulate immediate update
    const [votes, setVotes] = useState(proposal.votes);
    const [total, setTotal] = useState(proposal.totalVotes);

    const handleVote = () => {
        if (!selected) return;

        // Simulate API call / interaction
        const newVotes = { ...votes, [selected]: votes[selected] + 1 };
        setVotes(newVotes);
        setTotal(total + 1);
        setHasVoted(true);
    };

    const calculatePercent = (count: number) => {
        if (total === 0) return 0;
        return ((count / total) * 100).toFixed(1); // 1 decimal place
    };

    const isActive = proposal.status === 'active';

    return (
        <div className={styles.container}>
            <h3 className={styles.heading}>Current Results</h3>

            <div className={styles.results}>
                {/* For */}
                <div className={styles.resultRow}>
                    <div className={styles.resultHeader}>
                        <span>For</span>
                        <span>{votes.for.toLocaleString()} ({calculatePercent(votes.for)}%)</span>
                    </div>
                    <div className={styles.barBg}>
                        <div className={styles.barFill} style={{ width: `${calculatePercent(votes.for)}%`, background: 'var(--success)' }} />
                    </div>
                </div>

                {/* Against */}
                <div className={styles.resultRow}>
                    <div className={styles.resultHeader}>
                        <span>Against</span>
                        <span>{votes.against.toLocaleString()} ({calculatePercent(votes.against)}%)</span>
                    </div>
                    <div className={styles.barBg}>
                        <div className={styles.barFill} style={{ width: `${calculatePercent(votes.against)}%`, background: 'var(--danger)' }} />
                    </div>
                </div>

                {/* Abstain */}
                <div className={styles.resultRow}>
                    <div className={styles.resultHeader}>
                        <span>Abstain</span>
                        <span>{votes.abstain.toLocaleString()} ({calculatePercent(votes.abstain)}%)</span>
                    </div>
                    <div className={styles.barBg}>
                        <div className={styles.barFill} style={{ width: `${calculatePercent(votes.abstain)}%`, background: 'var(--muted)' }} />
                    </div>
                </div>
            </div>

            {isActive && !hasVoted && (
                <div className={styles.votingArea}>
                    <h3 className={styles.heading}>Cast your vote</h3>
                    <div className={styles.options}>
                        <button
                            className={`${styles.optionBtn} ${selected === 'for' ? styles.selectedFor : ''}`}
                            onClick={() => setSelected('for')}
                        >
                            For
                        </button>
                        <button
                            className={`${styles.optionBtn} ${selected === 'against' ? styles.selectedAgainst : ''}`}
                            onClick={() => setSelected('against')}
                        >
                            Against
                        </button>
                        <button
                            className={`${styles.optionBtn} ${selected === 'abstain' ? styles.selectedAbstain : ''}`}
                            onClick={() => setSelected('abstain')}
                        >
                            Abstain
                        </button>
                    </div>

                    <button
                        className={styles.voteBtn}
                        disabled={!selected}
                        onClick={handleVote}
                    >
                        Vote
                    </button>
                </div>
            )}

            {hasVoted && (
                <div className={styles.votedMessage}>
                    You have voted <strong>{selected}</strong>.
                </div>
            )}
        </div>
    );
}
