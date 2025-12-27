import Link from 'next/link';
import { Proposal } from '@/types';
import { getTimeRemaining } from '@/lib/utils';
import styles from './ProposalCard.module.css';

interface Props {
    proposal: Proposal;
}

export default function ProposalCard({ proposal }: Props) {
    const isActive = proposal.status === 'active';

    return (
        <Link href={`/proposal/${proposal.id}`} className={styles.card}>
            <div className={styles.header}>
                <div className={styles.statusContainer}>
                    <span className={`${styles.status} ${isActive ? styles.active : styles.closed}`}>
                        {isActive ? 'Active' : 'Closed'}
                    </span>
                    <span className={styles.id}>#{proposal.id}</span>
                </div>
                <h2 className={styles.title}>{proposal.title}</h2>
            </div>

            <p className={styles.summary}>{proposal.summary}</p>

            <div className={styles.footer}>
                <div className={styles.meta}>
                    <span className={styles.label}>Ends in</span>
                    <span className={styles.value}>{getTimeRemaining(proposal.endTime)}</span>
                </div>
                <div className={styles.meta}>
                    <span className={styles.label}>Votes</span>
                    <span className={styles.value}>{proposal.totalVotes.toLocaleString()}</span>
                </div>
            </div>
        </Link>
    );
}
