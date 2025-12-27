import { notFound } from 'next/navigation';
import { mockProposals } from '@/lib/mockData';
import { getTimeRemaining } from '@/lib/utils';
import VoteControls from '@/components/vote/VoteControls';
import styles from './page.module.css';

// For Static Export (SSG)
export function generateStaticParams() {
    return mockProposals.map((proposal) => ({
        id: proposal.id,
    }));
}

interface Props {
    params: Promise<{ id: string }>;
}

export default async function ProposalPage({ params }: Props) {
    const { id } = await params;
    const proposal = mockProposals.find((p) => p.id === id);

    if (!proposal) {
        notFound();
    }

    const isActive = proposal.status === 'active';

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <div className={styles.statusContainer}>
                    <span className={`${styles.status} ${isActive ? styles.active : styles.closed}`}>
                        {isActive ? 'Active' : 'Closed'}
                    </span>
                    <span className={styles.meta}>{getTimeRemaining(proposal.endTime)}</span>
                </div>
                <h1 className={styles.title}>{proposal.title}</h1>
            </div>

            <div className={styles.content}>
                <div className={styles.mainColumn}>
                    <div className={styles.card}>
                        <h2 className={styles.sectionTitle}>Summary</h2>
                        <p className={styles.summaryText}>{proposal.summary}</p>
                    </div>
                </div>

                <div className={styles.sideColumn}>
                    <div className={styles.card}>
                        <h2 className={styles.sectionTitle}>Vote</h2>
                        <VoteControls proposal={proposal} />
                    </div>

                    <div className={styles.card}>
                        <h2 className={styles.sectionTitle}>Information</h2>
                        <div className={styles.infoRow}>
                            <span>Start</span>
                            <span>{new Date(proposal.startTime).toLocaleDateString()}</span>
                        </div>
                        <div className={styles.infoRow}>
                            <span>End</span>
                            <span>{new Date(proposal.endTime).toLocaleDateString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
