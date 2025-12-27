import { mockProposals } from '@/lib/mockData';
import ProposalCard from '@/components/vote/ProposalCard';
import styles from './page.module.css';

export default function Home() {
  return (
    <div className={styles.main}>
      <h1 className={styles.heading}>Proposals</h1>
      <div className={styles.grid}>
        {mockProposals.map((proposal) => (
          <ProposalCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  );
}
